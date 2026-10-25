# Especificações do plano de escala

Especificações técnicas das fases do [ROADMAP](../ROADMAP.md). Cada arquivo descreve o que construir, em que ordem, com que contratos e como provar que ficou pronto. Nenhuma especificação aqui foi implementada ainda.

> **Observação — revisar quando a internet voltar e o acesso aos servidores for possível.** Estas especificações foram escritas só a partir do repositório, com os servidores sem internet e sem acesso. Antes de implementar qualquer fase, percorrer a seção [Revisão pendente nos servidores](#revisão-pendente-nos-servidores), no fim deste arquivo.

Base: commit `366a756` (25/10/2026). Suíte atual: 88 testes, 87 passam e 1 é pulado quando o Chromium não está instalado (conferido em 25/10/2026 contra um Postgres local). As especificações foram revisadas contra o código por uma segunda leitura independente, e os 24 problemas encontrados já estão corrigidos no texto.

| Fase | Arquivo | Tema | Depende de |
|---|---|---|---|
| 0 | [fase-0-seguranca.md](fase-0-seguranca.md) | HTTPS, proxy confiável, enumeração, bloqueio de terceiros, logout real, prova de trabalho, senhas vazadas | nada |
| 1 | [fase-1-estado-no-banco.md](fase-1-estado-no-banco.md) | Limites, códigos, chave mestra e SMTP fora da memória; novo fluxo da recuperação; auditoria | Fase 0 |
| 3a | [fase-3-operacao.md](fase-3-operacao.md) (blocos A e B) | CI, testes independentes, log estruturado | Fase 1 |
| 2 | [fase-2-geracao-assincrona.md](fase-2-geracao-assincrona.md) | Fila de geração, worker, Chromium isolado, cotas | Fases 1 e 3a |
| 3b | [fase-3-operacao.md](fase-3-operacao.md) (blocos C a E) | Métricas, alertas, estáticos, e-mail em fila, paginação | Fase 2 |
| 4 | [fase-4-replicas-e-banco.md](fase-4-replicas-e-banco.md) | Réplicas, deploy sem queda, PgBouncer, WAL | Fases 1 a 3 |
| 5 | [fase-5-saas.md](fase-5-saas.md) | Organizações, planos, pagamento, 2FA | Fase 4 e decisões de negócio |

## Convenções comuns a todas as fases

### Formato de cada especificação

1. **Objetivo**: o resultado em uma frase.
2. **Estado atual**: o que o código faz hoje, com arquivo e linha.
3. **Desenho**: tabelas, módulos, rotas e variáveis de ambiente.
4. **Sequência de entrega**: PRs pequenos, cada um com a suíte verde.
5. **Testes**: cenários no formato Dado / Quando / Então.
6. **Critérios de aceite**: o que precisa ser verdade para marcar a fase como pronta.
7. **Reversão**: como voltar atrás se algo der errado em produção.

### Migrações

- Uma migração nova por mudança de esquema, acrescentada ao fim de `MIGRATIONS` em `lib/db.js`, com nome em português no estilo das existentes (`tema-sistema`, `aceite-dos-termos`).
- A numeração abaixo segue a ordem de execução recomendada (0 → 1 → 3a → 2 → 3b → 4 → 5). Se a ordem mudar, vale o próximo número livre.
- `test/store.test.js` confere a lista exata de versões aplicadas (`[1, 2, 3, 4, 5, 6]`, linhas 21 e 35). Toda migração nova atualiza esse teste no mesmo PR.
- **Só migrações aditivas** (criar tabela, criar coluna com padrão, criar índice). Remover ou renomear coluna só numa versão seguinte, depois que nenhuma instância antiga estiver no ar. Essa regra é o que permite o deploy sem queda da Fase 4, quando uma instância nova migra o banco enquanto a antiga ainda atende.
- Índices em tabelas que já têm dados usam `CREATE INDEX` comum enquanto o volume for pequeno; acima de 100 mil linhas, `CREATE INDEX CONCURRENTLY` numa migração fora de transação (exige ajustar `migrate()`).

| Versão | Nome | Fase | Conteúdo |
|---|---|---|---|
| 7 | `sessoes-revogadas` | 0 | `revoked_sessions` |
| 8 | `limites-de-tentativas` | 1 | `rate_limits` |
| 9 | `codigos-pendentes` | 1 | `pending_codes` |
| 10 | `registro-de-auditoria` | 1 | `audit_log` |
| 11 | `tarefas-de-geracao` | 2 | `generation_jobs`, `generation_files` |
| 12 | `fila-de-emails` | 3b | `outbox_emails`; extensão `pg_trgm` e índice de busca em `users` |
| 13 | `organizacoes` | 5 | `orgs`, `org_members`, `org_invites`, `projects.org_id` |
| 14 | `planos-e-assinaturas` | 5 | `plans`, `subscriptions`, `generation_jobs.org_id` |
| 15 | `eventos-de-cobranca` | 5 | `billing_events` |
| 16 | `verificacao-em-duas-etapas` | 5 | `users.totp_*`, `recovery_codes` |

### Limitadores

- Todo limitador tem **nome próprio** (`createLimiter(db, { name, max, windowMs })`), e a chave gravada é `nome:chave`. Hoje as mesmas chaves (`email:<e-mail>`, `ip:<ip>`) se repetem entre limitadores diferentes; numa tabela única sem o nome, os contadores se somariam.
- **Registrar antes de trabalhar**: a rota chama `hit()`, compara a contagem devolvida com o limite e só então faz o trabalho caro (scrypt, envio de e-mail). Consultar primeiro e registrar depois deixa passar várias requisições em paralelo.
- Nomes previstos: `login-par`, `login-ip`, `login-email`, `reset-email`, `reset-ip`, `signup-email`, `signup-ip`, `confirm-par`, `confirm-email`, `support`, `pow`, `pdf`, `render`, `2fa`.

### Rotas públicas novas

`handleApi` exige sessão para tudo que não está na lista `isPublicAuth` (`server.js:710-714`). Toda rota pública nova entra **antes** dessa verificação, e a especificação diz onde:

| Rota | Fase | Onde entra |
|---|---|---|
| `GET /api/auth/challenge` | 0 | lista `isPublicAuth` |
| `GET /api/metrics` | 3 | antes da verificação de origem, ao lado de `/api/health` |
| `POST /api/billing/webhook/:provider` | 5 | antes da verificação de origem (o provedor não manda `Origin` do app) |

### Variáveis de ambiente novas

Todas opcionais, com padrão seguro, salvo indicação. Entram no `compose.yaml`, no `compose.prod.yaml`, na tabela do `CODEBASE_MAP.md` e no exemplo de `.env` do README no mesmo PR que as cria.

| Variável | Fase | Padrão | Função |
|---|---|---|---|
| `TRUSTED_PROXY_HOPS` | 0 | `0` | Quantos proxies confiáveis existem na frente do app; com `0`, `X-Forwarded-For` é ignorado |
| `LAN_BIND` | 0 | `127.0.0.1` | Interface do host onde o Caddy publica o acesso pela rede local (porta 8123). O app em si não publica porta |
| `PASSWORD_BREACH_CHECK` | 0 | `local` | `local` (lista embutida), `hibp` (consulta k-anonymity, exige internet) ou `off` |
| `POW_DIFFICULTY` | 0 | `300000` | Número máximo do desafio de prova de trabalho; `0` desliga |
| `SMTP_RELOAD_SECONDS` | 1 | `30` | Intervalo para cada instância reler o SMTP salvo no painel |
| `AUDIT_RETENTION_DAYS` | 1 | `365` | Prazo do registro de auditoria |
| `GENERATION_MODE` | 2 | `queue` | `queue` (fila) ou `inline` (comportamento atual, para reversão) |
| `WORKER_CONCURRENCY` | 2 | `2` | Jobs simultâneos por worker |
| `CHROMIUM_CONCURRENCY` | 2 | `1` | Chromiums simultâneos por worker |
| `DAILY_GENERATION_QUOTA` | 2 | `20` | Gerações por usuário por dia (fuso de Brasília) |
| `MAX_ACTIVE_JOBS_PER_USER` | 2 | `2` | Jobs na fila ou rodando ao mesmo tempo por usuário |
| `JOB_DEADLINE_SECONDS` | 2 | `600` | Tempo máximo de um job antes de falhar |
| `GENERATION_RETENTION_HOURS` | 2 | `24` | Por quanto tempo os arquivos gerados e o prompt ficam guardados |
| `AI_FAKE_PROVIDER` | 2 | vazio | `1` troca os provedores de IA por um simulado, para teste de carga; recusado com `NODE_ENV=production` |
| `LOG_LEVEL` | 3 | `info` | `debug`, `info`, `warn` ou `error` |
| `METRICS_TOKEN` | 3 | vazio | Token para `GET /api/metrics`; vazio desliga a rota (404) |
| `WORKER_METRICS_PORT` | 3 | `9464` | Porta das métricas do worker, só na rede interna |
| `SENTRY_DSN` | 3 | vazio | Endereço do Sentry ou GlitchTip; vazio desliga a captura |
| `UV_THREADPOOL_SIZE` | 3 | `16` | Threads do libuv (scrypt e leitura de arquivos) |
| `SHUTDOWN_GRACE_SECONDS` | 4 | `30` | Espera por requisições em andamento ao receber `SIGTERM` |
| `MIGRATION_DATABASE_URL` | 4 | igual a `DATABASE_URL` | Conexão direta ao banco para as migrações quando houver PgBouncer |
| `BILLING_WEBHOOK_SECRET` | 5 | vazio | Segredo para conferir a assinatura dos webhooks do provedor de pagamento |
| `REQUIRE_ADMIN_2FA` | 5 | `false` | Exige verificação em duas etapas dos administradores do sistema |
| `DISABLE_2FA` | 5 | `false` | Desligamento de emergência do segundo fator, registrado na auditoria |

## Servidores sem internet

Hoje os servidores de desenvolvimento e de produção não têm acesso à internet. O que isso muda no plano:

| Parte | Funciona sem internet? | Alternativa |
|---|---|---|
| Login, projetos, banco, modo "somente prompt", BNCC | Sim | — |
| Diagramas e gráficos (`vendor/mermaid.min.js`, `vendor/chart.umd.min.js`) e fontes | Sim | Já são arquivos locais |
| Modo "Gerar material com IA" e "Melhorar com IA" | **Não** | Exige saída para a API do provedor (OpenAI, Gemini ou Anthropic). Não há alternativa local no projeto. O worker da Fase 2 precisa de uma rede com saída só para esses três domínios, se e quando ela existir |
| HTTPS com Let's Encrypt (Fase 0) | Não | `tls internal` no Caddy: o Caddy cria uma autoridade certificadora própria, e o certificado raiz dela é instalado nos computadores da rede. HSTS só depois disso |
| Abrir ao público (domínio, DNS) | Não, por definição | Fica para quando houver saída e entrada pela internet |
| Consulta de senhas vazadas | Não | Padrão `PASSWORD_BREACH_CHECK=local` (lista embutida) |
| `npm ci` e `apk add` no build das imagens | Não | Gerar as imagens numa máquina com internet e levar com `docker save` / `docker load`, ou manter um espelho local (Verdaccio para npm, espelho do Alpine) |
| Imagem do banco com pgBackRest (Fase 4) | Não, no build | Mesma saída do item anterior |
| E-mail | Depende de o servidor SMTP estar na rede interna | O Zimbra citado no `CODEBASE_MAP.md` resolve se estiver na mesma rede |
| Captura de erros | Sentry em nuvem não | GlitchTip no próprio servidor (padrão assumido) |
| Verificação de disponibilidade e alertas | Sim, se rodarem na rede interna | Uptime Kuma local; alerta por e-mail pelo SMTP interno |
| CI no GitHub Actions e Dependabot | Sim | Rodam no GitHub, não no servidor. Só o deploy das imagens geradas precisa do caminho de transferência acima |
| Certificados e imagens base desatualizados | — | Sem internet, a atualização das imagens (Fase 4.8) depende do mesmo caminho manual de transferência; vale registrar a data de cada atualização |

## Revisão pendente nos servidores

Itens que o repositório não mostra e que precisam ser conferidos nos servidores de desenvolvimento e de produção assim que a internet e o acesso voltarem. Cada um pode mudar uma decisão das especificações.

| # | O que conferir | Como | Afeta |
|---|---|---|---|
| 1 | Versão realmente implantada é a do repositório (`366a756` ou posterior) | `docker inspect gerador-one`, data da imagem, `git log` em `/opt/geradorOne` | todas |
| 2 | Variáveis no `.env` de cada servidor (`APP_SECRET` definido e com 32+ caracteres, `NODE_ENV`, SMTP, `APP_URL`) | conferir o arquivo, sem copiar segredos | Fases 0 e 1 |
| 3 | Se existe `runtime/secret.key` ou `runtime/secret.check` em uso | `ls -l runtime/` | Fase 1 (transição da impressão digital) |
| 4 | Qual ambiente é a produção de fato: `compose.prod.yaml` com Caddy ou Coolify com Traefik | `docker ps`, painel do Coolify | Fases 0 e 4 |
| 5 | Quem acessa a porta 8123 hoje e de onde | log do proxy, regras do firewall e do roteador | Fase 0 (`LAN_BIND`) |
| 6 | Se a saída para as APIs de IA (OpenAI, Gemini, Anthropic) vai existir e com quais domínios liberados | política de rede do servidor | Fase 2 e o modo "Gerar com IA" |
| 7 | Se o SMTP (Zimbra) é alcançável pela rede interna sem internet | `node scripts/test-smtp.js --verify` | Fases 0, 1 e 3 |
| 8 | Domínio, DNS e certificado: Let's Encrypt (com internet) ou `tls internal` (sem internet) | decisão de rede | Fase 0 |
| 9 | Disco: espaço livre, HD de backup montado em `/backup/lxc-geradorone`, cron do `backup-db.sh` rodando | `df -h`, `crontab -l`, `monitor/backup-db.json` | Fases 0 e 4 |
| 10 | Versões de Docker e Docker Compose (plugin `docker rollout`, `dynamic a` no Caddy) | `docker version`, `docker compose version` | Fase 4 |
| 11 | Recursos reais do servidor (CPU, RAM) e o que mais roda nele | `nproc`, `free -h`, `docker stats` | Fases 2 e 4 (limites dos contêineres) |
| 12 | Quantidade de usuários, projetos e tamanho do banco | `SELECT count(*)` nas tabelas, `pg_database_size` | Fases 2, 3 e 4 (volume e índices) |
| 13 | Caminho para levar imagens ao servidor sem internet (máquina de build, `docker save`/`docker load`, espelho local) | combinar o processo | todas as que mudam a imagem |
| 14 | Rodar a suíte inteira no servidor de desenvolvimento, com Chromium (aqui 1 teste foi pulado por falta dele) | `npm test` | linha de base de todas |
| 15 | Calibrar `POW_DIFFICULTY` medindo o tempo num celular de entrada da rede | página de teste com o `pow-worker.js` | Fase 0 |
| 16 | Conferir os modelos padrão de IA (`gpt-6-astra`, `gemini-3.8-flash`, `gpt-image-2.5-flare`, `gemini-3-pro-image-preview`, `claude-sonnet-5-5`) nos provedores | chamada de teste com uma chave válida | Fase 2 (achado 8 do `CODEBASE_MAP.md`) |

Depois da revisão, registrar a data aqui e marcar no ROADMAP o que mudou.

## Regras que valem em todo PR

- `npm test` verde, com pelo menos um teste novo para cada comportamento novo.
- Nenhum segredo, prompt, e-mail, cookie ou corpo de requisição em log.
- `docs/ROADMAP.md` com a caixa marcada e `docs/CODEBASE_MAP.md` atualizado quando rotas, tabelas, variáveis ou módulos mudarem.
- Mensagens ao usuário em português do Brasil, no tom das existentes.
