# Fase 4: múltiplas instâncias, deploy sem queda e banco resiliente

## Objetivo

Duas instâncias web e dois workers no servidor atual, um deploy inteiro sem nenhuma resposta 502, e um banco que pode ser recuperado em qualquer ponto dos últimos 7 dias.

## Pré-requisitos

Esta fase só começa com as Fases 1, 2 e 3 concluídas. Ela depende de quatro garantias:

- Nenhum estado de segurança em memória (Fase 1).
- `APP_SECRET` obrigatória em produção e igual em todas as instâncias (Fase 1).
- Nenhum trabalho pesado no processo web (Fase 2).
- Métricas por instância e alertas funcionando (Fase 3), para enxergar o efeito das réplicas.

## Estado atual

| Ponto | Onde | Impede réplicas porque |
|---|---|---|
| `container_name: gerador-one` | `compose.yaml`, `compose.prod.yaml` | O Docker não cria dois contêineres com o mesmo nome |
| `ports: 8123:3000` | idem | Duas réplicas não publicam a mesma porta do host. A Fase 0 já remove essa linha (o acesso pela LAN passa pelo Caddy) |
| `./runtime` montado | idem | Sai na Fase 1; confirmar que nenhum código grava nele em produção |
| Encerramento | `shutdown`, `server.js:974` | Espera só 5 s e não avisa o proxy que vai sair |
| Pool do banco | `createDb`, `lib/db.js:103` | `max: 10` por processo, sem limite global pensado |
| Backup | `scripts/backup-db.sh` | `pg_dump` diário: perde até 24 h de dados numa falha de disco |
| Atualização de imagens | — | Feita à mão, sem aviso de versão nova |

## Desenho

### 4.1 Composição de produção

Serviços em `compose.prod.yaml`:

| Serviço | Réplicas | Limites | Rede | Observação |
|---|---|---|---|---|
| `gerador-one` (web) | 2 | `mem_limit: 512m`, `cpus: 1` | `web`, `internal` | sem `container_name`; sem `ports` (o Caddy chega pela rede `web`) |
| `worker` | 2 | `mem_limit: 2g`, `cpus: 2` | `web`, `internal` | definido na Fase 2 |
| `db` | 1 | `mem_limit: 4g` | `internal` | `shared_buffers=1GB`, `effective_cache_size=3GB` |
| `caddy` | 1 | `mem_limit: 256m` | `web` | publica 80 e 443 |
| `pgbouncer` | 1 | `mem_limit: 128m` | `internal` | só quando passar de 8 processos (ver 4.4) |

O acesso pela LAN na porta 8123 já passa pelo Caddy desde a Fase 0 (bloco `http://:8123`) e recebe o mesmo balanceamento abaixo.

O `compose.yaml` do Coolify também perde o `container_name`. Ver o item 4.4 sobre o que o Coolify faz e não faz com réplicas.

### 4.2 Proxy com balanceamento e verificação de saúde

```text
(app) {
	reverse_proxy {
		dynamic a gerador-one 3000 {
			refresh 5s
		}
		lb_policy least_conn
		lb_try_duration 10s
		lb_try_interval 250ms
		fail_duration 30s
		max_fails 1
		unhealthy_status 502 503 504
	}
}

{$DOMINIO} {
	encode zstd gzip
	header Strict-Transport-Security "max-age=31536000"
	header -Server
	import app
}

http://:8123 {
	import app
}
```

- `dynamic a` faz o Caddy perguntar ao DNS do Docker os IPs do serviço a cada 5 s, então réplicas novas entram no balanceamento sem recarregar a configuração, e réplicas paradas saem.
- **O Caddy não faz verificação de saúde ativa (`health_uri`) em upstreams dinâmicos.** Por isso o desenho usa só a verificação **passiva**: uma conexão recusada, ou uma resposta 502, 503 ou 504, tira a instância do balanceamento por 30 s (`fail_duration`, `max_fails 1`, `unhealthy_status`).
- `lb_try_duration 10s`: se a conexão com uma instância falhar (porque ela está saindo), o Caddy tenta outra dentro de 10 s em vez de devolver 502 ao usuário. Isso vale para falhas de conexão, que é o que o encerramento abaixo produz.
- `TRUSTED_PROXY_HOPS=1` continua correto: o Caddy é o único salto.

### 4.3 Encerramento gracioso

Como o Caddy só percebe a saída de forma passiva (item 4.2), o processo precisa **parar de aceitar conexões na hora** em vez de esperar o proxy notar. Ao receber `SIGTERM`, o processo web:

1. Chama `server.close()` imediatamente: novas conexões passam a ser recusadas, e o Caddy tenta outra réplica dentro do `lb_try_duration`.
2. Fecha as conexões ociosas mantidas abertas pelo Caddy (`server.closeIdleConnections()`).
3. Responde às requisições já em andamento com `Connection: close`, para o Caddy não reaproveitar aquela conexão.
4. Passa a responder `GET /api/health` com 503 (`{ ok: false, draining: true }`), útil para a verificação de saúde do Docker e para o log.
5. Espera as requisições em andamento até `SHUTDOWN_GRACE_SECONDS` (30 s), fecha o pool do banco e sai com código 0.

`stop_grace_period: 45s` no serviço web, para o Docker não matar o processo antes do fim.

O worker tem o próprio encerramento na Fase 2 (`stop_grace_period: 11m`, maior que o prazo de um job).

### 4.4 Deploy sem queda

O Docker Compose não troca réplicas uma a uma sozinho. Duas opções, em ordem de preferência:

| Opção | Como | Prós e contras |
|---|---|---|
| Plugin `docker rollout` | `docker rollout -f compose.prod.yaml gerador-one`: sobe o dobro de réplicas com a imagem nova, espera a verificação de saúde e para as antigas | Uma linha; exige instalar o plugin no host |
| Script próprio `scripts/deploy.sh` | `docker compose up -d --no-deps --no-recreate --scale gerador-one=4`, espera os novos ficarem saudáveis, para os 2 antigos pelo id, volta a escala para 2 | Sem dependência; mais código para manter |

Ordem de um deploy:

1. `docker compose build`.
2. Workers primeiro: `docker compose up -d --no-deps worker`. Os workers antigos terminam os jobs em andamento (até 10,5 min no pior caso). A fila não para: os workers novos já reivindicam jobs enquanto os antigos terminam.
3. Web com a opção escolhida acima. A primeira instância nova roda as migrações; a trava `pg_advisory_xact_lock` em `migrate()` impede corrida. As instâncias antigas continuam funcionando porque as migrações são só aditivas (regra em `docs/specs/README.md`).
4. Conferir o log do Caddy: nenhuma linha com `status: 502` no intervalo.

**Coolify:** a documentação do Coolify diz que a atualização gradual (rolling update) **não** é suportada em aplicações do tipo Docker Compose, que é como o `compose.yaml` atual está implantado. Duas saídas:

- Implantar o web no Coolify como aplicação com o build pack **Dockerfile** (sem nome de contêiner fixo e sem porta publicada), que tem atualização gradual com verificação de saúde; o banco e o worker continuam como serviços à parte.
- Ou aceitar que, no ambiente do Coolify, o deploy tem alguns segundos de queda e usar o `compose.prod.yaml` com Caddy como o ambiente sem queda.

A escolha depende de qual ambiente vira a produção (decisão em aberto: servidor atual com Caddy ou Coolify).

### 4.5 Conexões com o banco

- Hoje: `max: 10` por processo. Com 2 web e 2 workers: 40 conexões, abaixo do padrão de 100 do Postgres. Não precisa de PgBouncer.
- Regra: quando `réplicas × 10` passar de 80, colocar o PgBouncer em modo `transaction` entre o app e o banco, com `default_pool_size=20`.
- Compatibilidade já garantida pelo desenho das fases anteriores:
  - As travas do projeto são `pg_advisory_xact_lock` (por transação), que funcionam no modo `transaction`.
  - Nenhuma fase usa `LISTEN/NOTIFY` (a Fase 1 escolheu leitura periódica do SMTP por esse motivo).
  - O `pg` só usa comandos preparados com nome quando o código passa `name`, e o projeto não passa.
- `DATABASE_URL` aponta para `pgbouncer:6432`; a migração continua indo direto ao `db` por `MIGRATION_DATABASE_URL`, porque `migrate()` usa uma transação longa.

### 4.6 Recuperação a um ponto no tempo

- Ferramenta: `pgBackRest`.
- **O `archive_command` é executado pelo próprio servidor Postgres**, dentro do contêiner do banco. A imagem `postgres:17-alpine` não tem `pgbackrest`; sem ele, cada arquivamento falha e o WAL se acumula até encher o disco. Por isso:
  - `deploy/db/Dockerfile` (novo): `FROM postgres:17-alpine` + `apk add --no-cache pgbackrest`. O serviço `db` passa a usar essa imagem.
  - O repositório do pgBackRest fica no HD de backup, montado no contêiner do banco (`/backup/lxc-geradorone/pgbackrest:/var/lib/pgbackrest`). Não há contêiner separado: o pgBackRest roda dentro do `db`, e os backups completos e diferenciais são disparados pelo cron do host com `docker compose exec db pgbackrest --stanza=geradorone backup --type=full|diff`.
  - A pasta é a mesma do `backup-db.sh`, com o mesmo cuidado de conferir se o HD está montado (`BACKUP_MOUNT`) antes de rodar.
- Postgres: `wal_level=replica`, `archive_mode=on`, `archive_command='pgbackrest --stanza=geradorone archive-push %p'`, `max_wal_senders=5`.
- Alerta: `pg_stat_archiver.failed_count` crescendo, exposto como métrica (Fase 3), para perceber arquivamento falhando antes de o disco encher.
- Agenda: completo aos domingos às 02:30, diferencial nos outros dias às 02:30. Retenção de 2 completos (cerca de 14 dias) e de todo o WAL desse intervalo.
- O `backup-db.sh` diário continua: é o arquivo SQL simples, fácil de restaurar em qualquer lugar. Passa a usar `--exclude-table-data=generation_files`, que são dados temporários (Fase 2). A tabela `generation_jobs` continua no backup, porque é a base das cotas.
- Exercício mensal documentado em `docs/RESTAURACAO.md`: restaurar num contêiner descartável até um horário escolhido, rodar a suíte de testes contra ele e registrar o tempo gasto.

### 4.7 Réplica do banco

Só quando houver uma segunda máquina. Até lá, o PITR do item 4.6 cobre a falha de disco, e a réplica no mesmo host não acrescenta proteção.

- Réplica em streaming (`pg_basebackup`, `primary_conninfo`, `hot_standby=on`) na segunda máquina.
- O app continua lendo e escrevendo só no primário. Separar leituras fica para quando as métricas mostrarem o banco como gargalo.
- Troca para a réplica é manual e documentada (`pg_ctl promote` e troca da `DATABASE_URL`).

### 4.8 Atualização de dependências e imagens

- `.github/dependabot.yml` (ou Renovate) para `npm` e `docker`, semanal, agrupando atualizações de patch.
- A CI da Fase 3 valida cada PR. Atualizações de versão maior (Node 24, Postgres 18) são feitas à mão, com roteiro próprio.

## Sequência de entrega

| PR | Conteúdo |
|---|---|
| 4-a | Encerramento gracioso (fecha o listener na hora, `Connection: close`, `/api/health` com `draining`) |
| 4-b | `compose.prod.yaml` sem `container_name`, com réplicas e limites; `Caddyfile` com upstream dinâmico e verificação passiva |
| 4-c | `scripts/deploy.sh` (ou instruções do plugin) no README; decisão sobre o Coolify |
| 4-d | Imagem do `db` com pgBackRest, agenda no cron do host, métrica do arquivador, exclusão de `generation_files` do `pg_dump`, `docs/RESTAURACAO.md` |
| 4-e | Dependabot ou Renovate |
| 4-f | PgBouncer (só quando a regra de 4.5 disparar) |
| 4-g | Réplica (só com segunda máquina) |

## Testes

| Cenário | Como | Então |
|---|---|---|
| Saída graciosa | Teste automatizado: requisição lenta em andamento, `SIGTERM` no processo | A requisição termina com 200 e `Connection: close`; uma conexão nova depois do sinal é recusada |
| Arquivamento de WAL | `SELECT pg_switch_wal()` no banco de homologação | `pg_stat_archiver.archived_count` sobe e `failed_count` não muda |
| Deploy sem queda | Teste de carga leve (20 usuários) rodando durante um deploy em homologação | Zero 502 e zero 5xx no log do Caddy |
| Queda de uma instância | `docker kill` numa réplica durante o teste de carga | As requisições que estavam naquela réplica podem falhar; as seguintes vão para a outra (conexão recusada → nova tentativa no Caddy), e a réplica morta sai do DNS em até 5 s |
| Sessão entre instâncias | Login, depois 20 requisições seguidas | Todas 200, distribuídas nas duas réplicas (conferido pelo `X-Request-Id` no log de cada uma) |
| Migração durante deploy | Versão nova com migração aditiva sobe ao lado da antiga | A antiga continua respondendo 200 durante e depois da migração |
| PITR | Apagar uma tabela de propósito numa cópia, restaurar até 1 minuto antes | Dados de volta; suíte de testes passa contra o banco restaurado |

## Critérios de aceite

- [ ] `docker compose -f compose.prod.yaml ps` mostra 2 web e 2 workers saudáveis.
- [ ] Um deploy completo em produção sem nenhum 502 no log do Caddy.
- [ ] Exercício de PITR registrado em `docs/RESTAURACAO.md` com data, horário restaurado e tempo gasto.
- [ ] O primeiro PR do Dependabot ou Renovate passa pela CI.

## Reversão

- Voltar a uma réplica: `--scale gerador-one=1`. Nada no código depende de haver duas.
- O `Caddyfile` antigo continua funcionando com uma réplica.
- O pgBackRest é independente do app; desligar o `archive_mode` volta ao estado anterior sem perda.
- PgBouncer: apontar a `DATABASE_URL` de volta para `db:5432`.
