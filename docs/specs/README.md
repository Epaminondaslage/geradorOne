# Especificações do plano de escala

Especificações técnicas das fases do [ROADMAP](../ROADMAP.md). Cada arquivo descreve o que construir, em que ordem, com que contratos e como provar que ficou pronto. Nenhuma especificação aqui foi implementada ainda.

Base: commit `366a756` (25/10/2026). Suíte atual: 88 testes, 87 passam e 1 é pulado quando o Chromium não está instalado (conferido em 25/10/2026 contra um Postgres local).

| Fase | Arquivo | Tema | Depende de |
|---|---|---|---|
| 0 | [fase-0-seguranca.md](fase-0-seguranca.md) | HTTPS, proxy confiável, enumeração, bloqueio de terceiros, logout real, captcha, senhas vazadas | nada |
| 1 | [fase-1-estado-no-banco.md](fase-1-estado-no-banco.md) | Limites, códigos, chave mestra e SMTP fora da memória; auditoria | Fase 0 |
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

| Versão | Nome | Fase | Tabelas |
|---|---|---|---|
| 7 | `sessoes-revogadas` | 0 | `revoked_sessions` |
| 8 | `limites-de-tentativas` | 1 | `rate_limits` |
| 9 | `codigos-pendentes` | 1 | `pending_codes` |
| 10 | `registro-de-auditoria` | 1 | `audit_log` |
| 11 | `tarefas-de-geracao` | 2 | `generation_jobs`, `generation_files` |
| 12 | `fila-de-emails` | 3b | `outbox_emails` |
| 13 a 16 | `organizacoes`, `planos-e-assinaturas`, `eventos-de-cobranca`, `verificacao-em-duas-etapas` | 5 | ver a especificação da Fase 5 |

### Variáveis de ambiente novas

Todas opcionais, com padrão seguro, salvo indicação. Entram no `compose.yaml`, no `compose.prod.yaml`, na tabela do `CODEBASE_MAP.md` e no exemplo de `.env` do README no mesmo PR que as cria.

| Variável | Fase | Padrão | Função |
|---|---|---|---|
| `TRUSTED_PROXY_HOPS` | 0 | `0` | Quantos proxies confiáveis existem na frente do app; com `0`, `X-Forwarded-For` é ignorado |
| `LAN_BIND` | 0 | `127.0.0.1` | Interface onde a porta 8123 é publicada no host |
| `PASSWORD_BREACH_CHECK` | 0 | `local` | `local` (lista embutida), `hibp` (consulta k-anonymity) ou `off` |
| `POW_DIFFICULTY` | 0 | `50000` | Número máximo do desafio de prova de trabalho no cadastro e na recuperação |
| `SMTP_RELOAD_SECONDS` | 1 | `30` | Intervalo para cada instância reler o SMTP salvo no painel |
| `AUDIT_RETENTION_DAYS` | 1 | `365` | Prazo do registro de auditoria |
| `GENERATION_MODE` | 2 | `queue` | `queue` (fila) ou `inline` (comportamento atual, para reversão) |
| `WORKER_CONCURRENCY` | 2 | `2` | Jobs simultâneos por worker |
| `CHROMIUM_CONCURRENCY` | 2 | `1` | Chromiums simultâneos por worker |
| `DAILY_GENERATION_QUOTA` | 2 | `20` | Gerações por usuário por dia (fuso de Brasília) |
| `MAX_ACTIVE_JOBS_PER_USER` | 2 | `2` | Jobs na fila ou rodando ao mesmo tempo por usuário |
| `JOB_DEADLINE_SECONDS` | 2 | `600` | Tempo máximo de um job antes de falhar |
| `GENERATION_RETENTION_HOURS` | 2 | `24` | Por quanto tempo os arquivos gerados ficam disponíveis |
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

### Regras que valem em todo PR

- `npm test` verde, com pelo menos um teste novo para cada comportamento novo.
- Nenhum segredo, prompt, e-mail, cookie ou corpo de requisição em log.
- `docs/ROADMAP.md` com a caixa marcada e `docs/CODEBASE_MAP.md` atualizado quando rotas, tabelas, variáveis ou módulos mudarem.
- Mensagens ao usuário em português do Brasil, no tom das existentes.
