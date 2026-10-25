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
| `ports: 8123:3000` | idem (`LAN_BIND` na Fase 0) | Duas réplicas não publicam a mesma porta do host |
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

O acesso pela LAN na porta 8123, se ainda for necessário, passa a ser feito pelo Caddy: um segundo bloco `http://:8123` no `Caddyfile`, publicado em `${LAN_BIND}:8123`.

O `compose.yaml` do Coolify recebe as mesmas mudanças no serviço web (sem `container_name`, sem `ports`) e o Coolify passa a fazer o balanceamento pelo Traefik com a verificação de saúde.

### 4.2 Proxy com balanceamento e verificação de saúde

```text
{$DOMINIO} {
	encode zstd gzip
	header Strict-Transport-Security "max-age=31536000"
	header -Server
	reverse_proxy gerador-one:3000 {
		dynamic a gerador-one 3000
		lb_policy least_conn
		lb_try_duration 5s
		health_uri /api/health
		health_interval 5s
		health_fails 2
		fail_duration 10s
	}
}
```

- `dynamic a` faz o Caddy perguntar ao DNS do Docker todos os IPs do serviço, então réplicas novas entram no balanceamento sem recarregar a configuração.
- `lb_try_duration 5s`: se uma instância recusar a conexão (porque está saindo), o Caddy tenta outra dentro de 5 s em vez de devolver 502.
- `TRUSTED_PROXY_HOPS=1` continua correto: o Caddy é o único salto.

### 4.3 Encerramento gracioso

Ao receber `SIGTERM`, o processo web:

1. Passa a responder `GET /api/health` com 503 (`{ ok: false, draining: true }`), para o Caddy tirá-lo do balanceamento na próxima verificação (até 10 s).
2. Continua atendendo normalmente durante esses 10 s, porque o Caddy ainda pode mandar requisições até perceber.
3. Chama `server.close()` e espera as requisições em andamento até `SHUTDOWN_GRACE_SECONDS` (30 s).
4. Fecha conexões ociosas (`server.closeIdleConnections()`), fecha o pool do banco e sai com código 0.

`stop_grace_period: 45s` no serviço web, para o Docker não matar o processo antes do fim.

O worker já tem o próprio encerramento na Fase 2 (`stop_grace_period: 3m`).

### 4.4 Deploy sem queda

O Docker Compose não troca réplicas uma a uma sozinho. Duas opções, em ordem de preferência:

| Opção | Como | Prós e contras |
|---|---|---|
| Plugin `docker rollout` | `docker rollout -f compose.prod.yaml gerador-one`: sobe o dobro de réplicas com a imagem nova, espera a verificação de saúde e para as antigas | Uma linha; exige instalar o plugin no host |
| Script próprio `scripts/deploy.sh` | `docker compose up -d --no-deps --no-recreate --scale gerador-one=4`, espera os novos ficarem saudáveis, para os 2 antigos pelo id, volta a escala para 2 | Sem dependência; mais código para manter |

Ordem de um deploy:

1. `docker compose build`.
2. Workers primeiro: `docker compose up -d --no-deps worker`. Os workers antigos terminam os jobs em andamento (até 3 min).
3. Web com a opção escolhida acima. A primeira instância nova roda as migrações; a trava `pg_advisory_xact_lock` em `migrate()` impede corrida. As instâncias antigas continuam funcionando porque as migrações são só aditivas (regra em `docs/specs/README.md`).
4. Conferir o log do Caddy: nenhuma linha com `status: 502` no intervalo.

Com o Coolify, a atualização gradual do próprio Coolify faz o passo 3, desde que o serviço não tenha `container_name` nem `ports` e tenha verificação de saúde.

### 4.5 Conexões com o banco

- Hoje: `max: 10` por processo. Com 2 web e 2 workers: 40 conexões, abaixo do padrão de 100 do Postgres. Não precisa de PgBouncer.
- Regra: quando `réplicas × 10` passar de 80, colocar o PgBouncer em modo `transaction` entre o app e o banco, com `default_pool_size=20`.
- Compatibilidade já garantida pelo desenho das fases anteriores:
  - As travas do projeto são `pg_advisory_xact_lock` (por transação), que funcionam no modo `transaction`.
  - Nenhuma fase usa `LISTEN/NOTIFY` (a Fase 1 escolheu leitura periódica do SMTP por esse motivo).
  - O `pg` só usa comandos preparados com nome quando o código passa `name`, e o projeto não passa.
- `DATABASE_URL` aponta para `pgbouncer:6432`; a migração continua indo direto ao `db` por `MIGRATION_DATABASE_URL`, porque `migrate()` usa uma transação longa.

### 4.6 Recuperação a um ponto no tempo

- Ferramenta: `pgBackRest` num contêiner ao lado do `db`, gravando no mesmo HD de backup do `backup-db.sh` (`/backup/lxc-geradorone/pgbackrest`).
- Postgres: `wal_level=replica`, `archive_mode=on`, `archive_command='pgbackrest --stanza=geradorone archive-push %p'`, `max_wal_senders=5`.
- Agenda: completo aos domingos às 02:30, diferencial nos outros dias às 02:30. Retenção de 2 completos (cerca de 14 dias) e de todo o WAL desse intervalo.
- O `backup-db.sh` diário continua: é o arquivo SQL simples, fácil de restaurar em qualquer lugar. Passa a usar `--exclude-table-data=generation_files --exclude-table-data=generation_jobs`, que são dados temporários (Fase 2).
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
| 4-a | Encerramento gracioso e `/api/health` com `draining` |
| 4-b | `compose.prod.yaml` sem `container_name` e `ports`, com réplicas e limites; `Caddyfile` com balanceamento |
| 4-c | `scripts/deploy.sh` (ou instruções do plugin) no README |
| 4-d | pgBackRest, agenda, exclusão das tabelas temporárias do `pg_dump`, `docs/RESTAURACAO.md` |
| 4-e | Dependabot ou Renovate |
| 4-f | PgBouncer (só quando a regra de 4.5 disparar) |
| 4-g | Réplica (só com segunda máquina) |

## Testes

| Cenário | Como | Então |
|---|---|---|
| Saída graciosa | Teste automatizado: requisição lenta em andamento, `SIGTERM` no processo | A requisição termina com 200; `/api/health` responde 503 logo depois do sinal |
| Deploy sem queda | Teste de carga leve (20 usuários) rodando durante um deploy em homologação | Zero 502 e zero 5xx no log do Caddy |
| Queda de uma instância | `docker kill` numa réplica durante o teste de carga | O Caddy tira a réplica em até 10 s; nenhuma requisição de usuário falha depois disso |
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
