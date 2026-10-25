# Roadmap: do GeradorOne atual a um SaaS que escala com segurança

Avaliação feita em 22/10/2026 e reorganizada em 25/10/2026 a partir da releitura completa do código (commit `bd82dbb`). Cada item tem uma caixa para marcar quando for concluído. O detalhamento técnico de cada fase (tabelas, arquivos e testes) está em [Plano de escala do GeradorOne](https://claude.ai/artifact/K8J6ux2kfVgj98gr6vyUWR).

## Onde estamos

**Pronto**

- [x] Servidor com folga de recursos: 16 CPUs, 31 GB de RAM, 936 GB de disco.
- [x] Postgres 17 na rede interna do Docker, sem porta publicada, com migrações versionadas, volume próprio e verificação de saúde.
- [x] Backup do banco em `scripts/backup-db.sh`, com restauração comprovada, status lido pela aba Backup.
- [x] Login por e-mail e senha, perfis admin e usuário, troca de senha obrigatória no primeiro acesso, recuperação por código enviado por e-mail e limite de tentativas.
- [x] Chaves de IA por usuário (BYOK), cifradas com AES-256-GCM. A chave mestra fica em `APP_SECRET`, fora do banco, e o app recusa iniciar se ela mudar.
- [x] Contêiner endurecido (usuário sem privilégios, sistema de arquivos somente leitura, sem capabilities) e suíte de 94 testes contra Postgres real.
- [x] Cadastro público com verificação de e-mail por código de 6 dígitos (23/10/2026).
- [x] Termos de uso e política de privacidade com aceite registrado e versionado (`lib/legal.js`), ainda sem revisão jurídica.
- [x] LGPD, parte técnica: exportação dos dados da conta, exclusão da conta, prazo de retenção e canal do responsável.
- [x] Caixa de e-mail própria do projeto, configurável na tela **E-mail (SMTP)** (23/10/2026).
- [x] Revisão técnica pedida à IA antes de gerar a imagem (24/10/2026).

**Não está pronto para clientes.** O que impede escalar, em ordem:

| Área | Situação hoje | Efeito ao escalar |
|---|---|---|
| Geração (`/api/generate`) | Texto, imagens e PDF numa única requisição HTTP de até 6 min; Chromium abre no mesmo contêiner, sem fila nem cota | Um usuário esgota CPU e os 32 MB de `/tmp`; proxies cortam a conexão longa |
| Estado do processo | Limites de login, códigos de recuperação, cadastros pendentes e `rate-limit.js` em `Map` na memória | Com duas instâncias os limites valem pela metade e um código pedido numa instância falha na outra; tudo some a cada deploy |
| Operação | `console.log`, sem CI, sem métricas, sem captura de erros, estáticos sem `Cache-Control` nem compressão | Falhas ficam invisíveis; `app.js` e `bncc.json` são relidos do disco a cada pedido |
| Deploy | `container_name` fixo, porta 8123 aberta em HTTP, `--no-sandbox` no Chromium | Impede réplicas; expõe senha em texto claro fora da rede interna |

As fases abaixo são sequenciais porque cada uma remove um bloqueio da seguinte. Ordem recomendada de execução: **0 → 1 → 3 (CI e logs) → 2 → 3 (restante) → 4 → 5**.

Princípios que valem para todas as fases:

- Nenhuma mudança entra sem teste correspondente em `test/` e sem passar na suíte inteira (`npm test`).
- Zero dependências novas sem necessidade real; quando entrar uma, fixar a versão como já se faz com `pg` e `nodemailer`.
- O processo web nunca executa trabalho pesado (Chromium, scrypt em massa, SMTP lento) de forma síncrona.
- Todo estado que precisa sobreviver a um deploy ou ser visto por outra instância vive no Postgres.
- Cada fase termina com este arquivo e o `docs/CODEBASE_MAP.md` atualizados no mesmo commit.

---

## Fase 0: segurança antes de expor à internet (1 a 2 semanas)

Meta: convidados usam o app num endereço público sem vazar senha e sem que um terceiro consiga travar contas alheias.

### Acesso público e HTTPS

- [ ] Definir o domínio e apontar o DNS (quem administra o DNS?).
- [ ] Liberar o servidor para a internet (NAT e firewall nas portas 80 e 443) ou hospedar em outro lugar.
- [ ] Usar o `compose.prod.yaml` com Caddy como padrão de produção (certificado Let's Encrypt automático; HSTS já está no `Caddyfile`).
- [ ] Fechar a porta 8123: no `compose.yaml`, trocar `"8123:3000"` por `"127.0.0.1:8123:3000"` ou remover o `ports:`.
- [ ] Publicar na raiz do domínio, em vez do caminho `/geradorone`.

### Brechas conhecidas no código

- [ ] **`X-Forwarded-For` confiado cegamente** (`clientIp`, `server.js`). Ler só o último IP da cadeia quando `TRUSTED_PROXY=1`; senão usar `req.socket.remoteAddress`. Sem isso qualquer cliente forja o IP e burla os limites por IP.
- [ ] **Enumeração de contas por tempo de resposta.** Em `/api/auth/signup` e `/api/auth/forgot`, quando o e-mail já existe (ou não existe), o servidor pula o `hashPassword` e o envio de e-mail e responde mais rápido. Sempre fazer o hash e mover o envio para a fila (Fase 3), para que o tempo seja igual nos dois ramos.
- [ ] **Travar conta de terceiros** com 8 tentativas erradas (`loginLimiter` por e-mail). Trocar por bloqueio por par IP+e-mail e atraso progressivo por e-mail (1 s, 2 s, 4 s).
- [ ] **Recuperação substitui código pendente de outra pessoa.** Guardar vários códigos por e-mail; resolve-se de graça ao mover os códigos para o banco na Fase 1.
- [ ] **Sair não invalida a sessão.** Incluir um `sid` aleatório no token e uma tabela `revoked_sessions (sid, exp)` consultada em `authenticate`.
- [ ] **Senha temporária no log** (`ensureAdmin`). Exigir `ADMIN_PASSWORD` quando `NODE_ENV=production`; só gerar aleatória em desenvolvimento.
- [ ] **Captcha ou prova de trabalho no cadastro.** Sem terceiros: desafio de hash no navegador (Altcha ou equivalente). Com terceiros: Turnstile.
- [ ] **Política de senha**: checar contra senhas vazadas (HIBP por k-anonymity) ou uma lista local das 100 mil mais comuns.

### Backup que protege de verdade

- [x] `scripts/backup-db.sh` agendado todo dia às 03:15 pelo cron, com cópia do `.env` e status lido pelo app.
- [ ] Copiar os backups para fora do servidor (outro servidor ou armazenamento em nuvem).
- [ ] Testar a restauração periodicamente, por exemplo todo mês.

### E-mail

- [ ] Configurar SPF, DKIM e DMARC do domínio, para os e-mails não caírem no spam.
- [ ] Trocar a senha da caixa do projeto que foi enviada por e-mail em texto aberto.

**Pronto quando:** o app abre só em `https://`, a 8123 não responde de fora, e os testes de `auth.test.js` cobrem o `TRUSTED_PROXY`, o tempo igual no cadastro e o logout que invalida a sessão.

---

## Fase 1: tirar todo estado da memória do processo (2 semanas)

Meta: qualquer instância do app atende qualquer requisição, e um deploy não apaga limites nem códigos pendentes. É o pré-requisito da Fase 4.

O que vive hoje em memória (`server.js`): cinco limitadores (`loginLimiter`, `resetLimiter`, `supportLimiter`, `signupEmailLimiter`, `signupIpLimiter`), os `Map` `resets` e `signups`, o `setInterval` que os limpa, e o `runtime/secret.check` em disco local.

- [ ] **Migração `rate_limits`**: `key text PRIMARY KEY, window_start timestamptz, count int`. Reescrever `lib/rate-limit.js` como `createLimiter(db, {max, windowMs})` com a mesma interface `blocked/hit/reset`, usando `INSERT ... ON CONFLICT DO UPDATE` numa única consulta. Limpeza diária por `window_start`.
- [ ] **Migração `pending_codes`**: `id uuid, kind ('reset'|'signup'), email, code_hash, payload jsonb, attempts int, expires_at`, índice em `(kind, email)`. Substitui `resets` e `signups`. Vários códigos por e-mail passam a coexistir.
- [ ] **Migração `revoked_sessions`** para o logout da Fase 0.
- [ ] **`secret.check` no banco**: mover a impressão digital para a tabela `settings` (chave `master-fingerprint`). `lib/secret-check.js` passa a receber `settingsStore`. O `runtime/` deixa de ser necessário em produção.
- [ ] **SMTP do painel em várias instâncias**: `loadSmtpSettings` roda só no boot; recarregar a cada N minutos ou usar `LISTEN/NOTIFY` no `PUT /api/settings/smtp`.
- [ ] **Auditoria de administrador** (barato de fazer agora): tabela `audit_log (actor_id, action, target_id, at, details jsonb)` gravada em `handleUsersApi` e `handleSettingsApi`.
- [ ] **Testes**: duas instâncias de `createLimiter` com o mesmo `db` compartilham contagem; código pedido num `server` e confirmado em outro, ambos no mesmo banco.

Por que Postgres e não Redis: o projeto já tem Postgres com transações e travas; o volume de escritas é baixo; uma dependência a menos. A interface `blocked/hit/reset` permite trocar o armazenamento depois sem mexer nas rotas.

**Pronto quando:** `grep -n "new Map\|createLimiter" server.js` não devolve estado global; `docker compose up --scale gerador-one=2` passa a suíte inteira contra as duas instâncias.

---

## Fase 2: geração assíncrona com fila, worker e Chromium isolado (3 a 4 semanas)

Meta: `/api/generate` responde em menos de 100 ms, o trabalho pesado roda em processo separado com concorrência limitada, e nenhum usuário consegue esgotar o servidor.

### Desenho alvo

1. `POST /api/generate` valida, grava um job em `generation_jobs` com status `queued` e devolve `202 {jobId}`.
2. Um processo `worker.js` (mesma imagem, comando diferente) reivindica jobs com `SELECT ... FOR UPDATE SKIP LOCKED`, roda as etapas e grava o progresso (`etapa`, `percentual`, `erro`).
3. O navegador consulta `GET /api/generate/:id` a cada 2 s (ou abre um `EventSource`) e, ao fim, baixa os arquivos por `GET /api/generate/:id/files/:n`.
4. Os arquivos ficam em `generation_files (job_id, name, mime, bytes bytea)` por 24 h e são apagados por job de limpeza.

### Tarefas

- [ ] Migrações `generation_jobs` e `generation_files`; índices `(status, created_at)` e `(owner_id, created_at DESC)`.
- [ ] Extrair de `server.js` para `lib/ai/` as funções já existentes: `requestOpenAiText`, `requestGeminiText`, `requestAnthropicText`, `requestAiImage`, `cleanGeneratedHtml`, `embedImages`, `htmlToPdf`. Worker e servidor importam o mesmo módulo.
- [ ] `worker.js`: laço com concorrência configurável (`WORKER_CONCURRENCY`, padrão 2) e semáforo próprio para o Chromium (`CHROMIUM_CONCURRENCY`, padrão 1 por worker). Texto e imagens rodam em paralelo, pois só dependem do prompt; o PDF espera os dois.
- [ ] Cota por usuário: no máximo 2 jobs ativos e N por dia (`DAILY_GENERATION_QUOTA`, padrão 20), checada na inserção com a mesma trava consultiva de `projects.save`.
- [ ] Chromium num contêiner próprio (`gerador-one-worker`) com `/tmp` de 512 MB, `seccomp` do Docker e `pids_limit: 256`; o contêiner web deixa de ter Chromium instalado. Opcional: um Chromium persistente por worker via CDP, reaproveitado entre jobs.
- [ ] `/api/pdf` (pdfkit, só do prompt) continua síncrono, com limite de 10 por minuto por usuário.
- [ ] `/api/improve` vira job ou, no mínimo, ganha a mesma cota diária.
- [ ] Frontend (`public/app.js`): trocar a espera única por consulta periódica com barra de progresso e botão Cancelar (`DELETE /api/generate/:id`).
- [ ] Testes: `worker.test.js` com provedor de IA simulado e `draw` injetado; cancelamento; cota excedida (429).

**Pronto quando:** o contêiner web não tem o binário do Chromium; 20 pedidos simultâneos de PDF entram na fila e terminam sem erro 5xx; no host há no máximo `CHROMIUM_CONCURRENCY` processos do Chromium por worker.

---

## Fase 3: operação (2 semanas; CI e logs antes da Fase 2)

Meta: toda regressão aparece no CI antes do deploy, e toda falha em produção aparece num alerta antes de o usuário reclamar.

### CI e qualidade

- [ ] `.github/workflows/ci.yml`: `npm ci`, `npm test` com `services: postgres` e `TEST_DATABASE_URL`, `docker build`, `npm audit --omit=dev` como aviso.
- [ ] `node --check` em todos os `.js` (sem dependência); ESLint só se compensar.
- [ ] Quebrar a dependência de ordem em `auth.test.js`: um banco por `describe` ou `beforeEach` que recria o admin.
- [ ] Cobrir o que falta: `/api/generate` e `/api/improve` com provedor simulado, `/api/pdf` e `/api/render` autenticados, cabeçalhos dos estáticos, `backup-db.sh` com `pg_dump` real.

### Logs, métricas e alertas

- [ ] `lib/log.js` com JSON por linha (`{ts, level, msg, reqId, uid, route, ms}`) no lugar dos `console.*`; `reqId` por requisição, devolvido no cabeçalho.
- [ ] `GET /api/metrics` (rede interna ou token) em formato Prometheus: requisições por rota e status, latência p50/p95, jobs por estado, Chromiums ativos, pool do `pg`.
- [ ] Captura de erros: Sentry ou GlitchTip auto-hospedado nos `catch` de `handleApi` e no worker.
- [ ] Alertas mínimos: `/api/health` fora do ar por 2 min, job `queued` há mais de 10 min, backup com mais de 26 h (`lib/backup.js` já calcula), disco acima de 85%.

### Desempenho do caminho quente

- [ ] Estáticos lidos uma vez no boot para a memória (1,2 MB), com `ETag`, `Cache-Control: public, max-age=31536000, immutable` para arquivos com hash no nome e `no-cache` para `index.html`. `scripts/hash-assets.js` gera `app.<hash>.js` e reescreve o `index.html` no build da imagem.
- [ ] Compressão: `zlib.gzipSync` no boot para cada estático de texto (`bncc.json` de 486 KB cai para ~60 KB).
- [ ] `UV_THREADPOOL_SIZE=16` no `compose`: scrypt e `fs.readFile` dividem as 4 threads padrão do libuv.
- [ ] E-mail fora da requisição: tabela `outbox_emails` processada pelo worker da Fase 2, com 3 tentativas. Resolve o SMTP lento no cadastro e a enumeração da Fase 0.
- [ ] `GET /api/users` paginado (`?page=&q=`); `activeAdminCount` vira `SELECT count(*)`.

**Pronto quando:** CI verde em todo PR; um erro forçado aparece no Sentry com `reqId`; `curl -I /app.<hash>.js` devolve `immutable` e `content-encoding: gzip`.

---

## Fase 4: múltiplas instâncias, proxy e banco (2 semanas)

Meta: 2 instâncias web e 2 workers no servidor atual, deploy sem derrubar o serviço, banco com recuperação a um ponto no tempo.

- [ ] `compose.prod.yaml`: remover `container_name` e `ports` do serviço web; `deploy.replicas: 2`; Caddy com `lb_policy least_conn` e `health_uri /api/health`. Serviço `worker` com `command: node worker.js` e `replicas: 2`.
- [ ] `runtime/` sai do `volumes` (resolvido na Fase 1); `monitor/` continua somente leitura em todas.
- [ ] Deploy sem derrubar: `docker compose up -d --no-deps --scale gerador-one=2`; `shutdown` em `server.js` espera até 30 s (hoje 5 s); o worker termina o job atual antes de sair ou o devolve a `queued`.
- [ ] Pool do `pg`: `max: 10` por instância × 5 processos = 50 conexões. Acima de 8 processos, PgBouncer em modo transação (as travas do projeto são `_xact_`, compatíveis).
- [ ] Postgres: `wal_level=replica`, `archive_mode=on` com pgBackRest ou `wal-g` gravando no HD de backup; réplica em streaming quando houver segunda máquina; `shared_buffers` em 25% da RAM do contêiner.
- [ ] `backup-db.sh` aponta para a réplica quando ela existir.
- [ ] Dependabot ou Renovate para `node:22-alpine`, `postgres:17-alpine`, `caddy:2-alpine` e os pacotes npm.

**Pronto quando:** `docker compose ps` mostra 2 web + 2 workers; matar uma instância web no meio de um login não gera erro para o usuário; um deploy inteiro acontece sem nenhum 502 no log do Caddy.

---

## Fase 5: produto SaaS (organizações, planos e pagamento)

Depende das decisões de negócio em aberto. Entra aqui o que a arquitetura precisa prever antes para não retrabalhar.

- [ ] **Organizações**: tabelas `orgs` e `org_members (org_id, user_id, role)`; `projects` ganha `org_id` opcional; o filtro entra onde hoje se filtra por `owner_id` (`lib/projects.js`).
- [ ] **Cotas por plano**: a tabela de jobs da Fase 2 já registra uso por usuário e dia; a cota passa a ler o plano da org.
- [ ] **Pagamento**: webhooks do provedor (Asaas, Stripe ou Pagar.me) como rota pública com assinatura verificada, gravando em `subscriptions`; bloqueio por inadimplência é uma checagem em `authenticate`.
- [ ] **Verificação em duas etapas** (TOTP): coluna `totp_secret_enc` cifrada com a chave HKDF `byok`; sem dependência nova.
- [ ] **Painel de uso** para o cliente e de faturamento para o administrador; nota fiscal, se aplicável.
- [ ] **Página de status** pública alimentada pelo `/api/metrics`.
- [ ] **LGPD, parte jurídica**: revisão dos termos e da política com advogado antes de abrir ao público em geral.
- [ ] **Modelos de e-mail transacional** (boas-vindas, verificação, recuperação) com a identidade do GeradorOne.

**Pronto quando:** um cliente cria a org, convida um colega, assina um plano, gera dentro da cota e é bloqueado com aviso claro ao vencer.

---

## Mapa de mudanças por arquivo

| Arquivo | Fase | Mudança |
|---|---|---|
| `server.js` | 0, 1, 2, 3 | `clientIp` com `TRUSTED_PROXY`; `sid` no token e revogação; rotas `/api/generate/:id`; log JSON; estáticos em memória com `ETag` e gzip; `/api/metrics` |
| `lib/rate-limit.js` | 1 | Mesma interface, armazenamento no Postgres |
| `lib/db.js` | 1, 2, 5 | Migrações: `rate_limits`, `pending_codes`, `revoked_sessions`, `audit_log`, `generation_jobs`, `generation_files`, `outbox_emails` |
| `lib/secret-check.js` | 1 | Impressão digital em `settings`, não em `runtime/` |
| `lib/ai/*.js` (novo) | 2 | Provedores, sanitizador, `embedImages`, `htmlToPdf` extraídos de `server.js` |
| `lib/jobs.js` (novo) | 2 | Enfileirar, reivindicar com `SKIP LOCKED`, progresso, cancelar, cota |
| `worker.js` (novo) | 2, 3 | Laço de jobs, semáforo do Chromium, envio da `outbox_emails` |
| `lib/visuals.js` | 2 | Chamado só pelo worker; opcional: Chromium persistente via CDP |
| `lib/mailer.js` | 3 | `deliver` grava na outbox; o worker envia |
| `lib/log.js` (novo) | 3 | JSON por linha com `reqId` |
| `lib/users.js` | 3, 5 | `list` paginado; `countActiveAdmins`; `totp_secret_enc` |
| `public/app.js` | 2 | Consulta periódica do job, barra de progresso, cancelar |
| `public/index.html` | 3 | Referências com hash (`app.<hash>.js`) geradas no build da imagem |
| `Dockerfile` | 2, 3 | Web sem Chromium, worker com Chromium; `scripts/hash-assets.js` no build |
| `compose.yaml`, `compose.prod.yaml` | 0, 2, 4 | Porta 8123 fechada; serviço `worker`; sem `container_name`; `replicas`; `UV_THREADPOOL_SIZE`; `pids_limit` |
| `deploy/Caddyfile` | 4 | `lb_policy least_conn`, `health_uri` |
| `.github/workflows/ci.yml` (novo) | 3 | Testes com Postgres de serviço, build da imagem |
| `test/*.test.js` | todas | Casos novos de cada fase; `auth.test.js` sem dependência de ordem |
| `docs/ROADMAP.md`, `docs/CODEBASE_MAP.md` | todas | Atualizados no mesmo commit de cada fase |

## Decisões em aberto

| Decisão | Afeta | Padrão assumido no plano |
|---|---|---|
| Domínio público e quem controla o DNS | Fase 0 inteira | Não assumido |
| Hospedar no servidor atual ou em nuvem | Fase 4 (réplica do banco, Caddy vs. balanceador externo) | Servidor atual, Caddy |
| Arquivos gerados em `bytea` ou em disco/S3 | Fase 2 | `bytea` com retenção de 24 h |
| Captcha com terceiro (Turnstile) ou sem (Altcha) | Fase 0 | Altcha, sem dependência externa |
| Sentry em nuvem ou GlitchTip local | Fase 3 | GlitchTip no mesmo servidor |
| Cota diária de gerações por usuário no beta | Fase 2 | 20 por dia, 2 simultâneas |
| Onde guardar a cópia externa do backup | Fase 0 | Não assumido |
| Modelo de cobrança e provedor de pagamento | Fase 5 | Não assumido |
| Revisão jurídica dos termos e da política | Fase 5 | Necessária antes de abrir ao público em geral |

## Riscos conhecidos hoje

- **Disco único, sem cópia externa:** uma falha de disco perde todos os dados.
- **Porta 8123 aberta e tráfego sem HTTPS:** senhas e cookies trafegam sem proteção fora da rede interna.
- **PDF sem limite:** um único usuário pode esgotar CPU e memória do servidor.
- **Perda do `.env`:** sem o `APP_SECRET`, as chaves de IA salvas ficam ilegíveis e cada pessoa cadastra a sua de novo.
- **Refatoração de `server.js` sem CI:** a extração para `lib/ai/` e `worker.js` é a maior mudança do plano; sem a CI da Fase 3 antes, há risco de regressão silenciosa no sanitizador.
- **Arquivos em `bytea`:** 50 gerações por hora com retenção de 24 h são ~12 GB rotativos; o job de limpeza precisa existir desde o primeiro dia.
- **`--no-sandbox` no Chromium:** mantido, compensado com contêiner separado, `seccomp` e `pids_limit`; avaliar gVisor se o conteúdo gerado por IA for considerado hostil.

## Como saber que o projeto escala

- [ ] Teste de carga reproduzível (`scripts/load-test.js` com `autocannon` ou `k6`): 200 usuários virtuais e 50 gerações por hora, p95 de `/api/projects` abaixo de 200 ms, zero 5xx.
- [ ] Derrubar uma instância web e um worker durante o teste de carga sem erro visível ao usuário.
- [ ] Restauração do backup num banco vazio seguida da suíte de testes passando contra ele.
- [ ] Revisão de segurança externa (ou ao menos um OWASP ZAP baseline) antes de abrir o cadastro público.
