# Fase 3: operação

## Objetivo

Toda regressão aparece na CI antes do deploy, toda falha em produção aparece num alerta antes de o usuário reclamar, e o caminho mais usado (abrir o app, entrar, listar projetos) não depende de disco nem de threads disputadas.

A fase tem cinco blocos. **A e B** vêm antes da Fase 2, porque protegem a refatoração de `server.js`. **C, D e E** vêm depois, porque usam o worker da Fase 2.

## Estado atual

| Ponto | Onde | Situação |
|---|---|---|
| CI | — | Não existe pasta `.github` |
| Testes dependentes | `test/auth.test.js` (29 testes num arquivo) | O próprio arquivo avisa que a ordem importa e que o teste do script de emergência precisa ser o último |
| Cobertura | `CODEBASE_MAP.md`, achado 11 | Sem testes de `/api/generate`, `/api/improve`, `/api/pdf` e `/api/render` autenticados, cabeçalhos HTTP, estáticos, `backup-db.sh` |
| Log | 15 chamadas a `console.*` em `server.js` | Texto livre, sem identificação de requisição nem usuário |
| Métricas e erros | — | Nenhuma |
| Estáticos | `server.js:928-951` | `fs.readFile` a cada pedido; sem `Cache-Control`, `ETag` nem compressão; `app.js` tem 138 KB e `data/bncc.json` 486 KB |
| Threads | padrão do Node | 4 threads do libuv divididas entre scrypt (`N=16384`) e leitura de arquivos |
| E-mail | `lib/mailer.js` | Enviado dentro da requisição; SMTP lento atrasa a resposta |
| Lista de usuários | `userStore.list`, `lib/users.js:67-70`; `activeAdminCount`, `server.js:214-216` | Carrega todos os usuários; conta administradores em JavaScript |

## Bloco A: CI e qualidade (antes da Fase 2)

### A.1 Fluxo da CI

Arquivo `.github/workflows/ci.yml`, disparado em `push` para `main` e em todo `pull_request`:

| Passo | Comando | Falha bloqueia? |
|---|---|---|
| Checkout e Node 22 | `actions/checkout`, `actions/setup-node` com cache de npm | — |
| Dependências | `npm ci` | sim |
| Sintaxe | `node --check` em cada `.js` de `server.js`, `worker.js`, `lib/`, `scripts/`, `public/` | sim |
| Testes | `npm run test:node` com `services: postgres:17-alpine` e `TEST_DATABASE_URL` definido | sim |
| Chromium nos testes | `apk`/`apt` instala `chromium` para o teste de `visuals.test.js` não ser pulado | sim |
| Imagem | `docker build --target web` e `--target worker` (depois da Fase 2) | sim |
| Auditoria de dependências | `npm audit --omit=dev --audit-level=high` | não (só aviso) |

Proteção da `main` no GitHub: exigir a CI verde para fazer merge.

### A.2 Testes independentes

`test/auth.test.js` vira arquivos por assunto. Cada arquivo do `node --test` roda em processo próprio, então cada um pode carregar `server.js` com um banco novo (`createTestDatabase`) sem interferir nos outros:

| Arquivo novo | Conteúdo vindo de `auth.test.js` |
|---|---|
| `test/http-login.test.js` | sessão, login, bloqueio, origem, URLs malformadas, corpo grande |
| `test/http-senha.test.js` | troca de senha, recuperação por e-mail, script de emergência |
| `test/http-usuarios.test.js` | administração de usuários, isolamento entre usuários |
| `test/http-conta.test.js` | perfil, tema, termos, exportação, exclusão da conta |
| `test/http-ia.test.js` | BYOK, `/api/ai/*`, `/api/generate`, `/api/improve` com provedor simulado |
| `test/http-estaticos.test.js` | cabeçalhos, CSP, `ETag`, compressão, travessia de caminho |

Um `test/helpers/app.js` sobe o servidor, cria o admin e devolve `client()` e `loginAs()`, hoje definidos dentro de `auth.test.js` (linhas 20-53). Cada arquivo prepara os próprios dados no `before`, sem depender de outro teste.

### A.3 Cobertura que falta

| Rota ou parte | Teste |
|---|---|
| `/api/generate`, `/api/improve` | Provedor simulado injetado por `lib/ai/providers.js` (Fase 2) ou, antes dela, servidor HTTP local apontado por variável de teste |
| `/api/pdf`, `/api/render` autenticados | Resposta 200, tipo correto, 400 sem prompt, 413 com corpo grande |
| Estáticos | `Content-Security-Policy` presente; `../` recusado com 403; arquivo inexistente 404 |
| `backup-db.sh` | Na CI, com o Postgres de serviço: gera o arquivo, passa no `gunzip -t`, tem a linha final do `pg_dump`, grava `backup-db.json` |

## Bloco B: log estruturado (antes da Fase 2)

### B.1 Módulo `lib/log.js`

```text
createLogger({ level, stream = process.stdout, base = {} }) → logger
logger.debug | info | warn | error (msg, fields?)
logger.child(fields) → logger com os campos somados
```

Cada linha é um JSON: `{"ts":"2026-11-03T14:02:11.120Z","level":"info","msg":"http","service":"web","reqId":"…","uid":"…","method":"POST","route":"/api/projects","status":200,"ms":12}`.

- `service`: `web` ou `worker`.
- `reqId`: `crypto.randomUUID()` por requisição, devolvido no cabeçalho `X-Request-Id`. Aparece na mensagem de erro 500 ao usuário (`Erro interno. Código: <8 primeiros caracteres>`) para o suporte achar a linha.
- `route`: o caminho com ids trocados por marcadores (`/api/projects/:id`, `/api/generate/:id/files/:n`), para as métricas não explodirem em séries.
- Uma linha `http` por resposta, gravada no evento `finish` da resposta.

### B.2 O que nunca vai para o log

Corpo de requisição ou resposta, cookies, cabeçalho `Authorization`, chaves de IA, senhas, hashes, códigos de 6 dígitos, prompts, conteúdo de mensagens de suporte e **e-mails**. A pessoa é identificada por `uid`. Exceção: a senha temporária do admin em desenvolvimento, que a Fase 0 já limita a fora de produção.

Um teste lê a saída do logger durante a suíte de login e de recuperação e falha se encontrar o e-mail, a senha ou o código usados.

### B.3 Rotação

O Docker guarda o `stdout`. No `compose`, `logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }` em todos os serviços: no máximo 50 MB por contêiner.

## Bloco C: métricas, erros e alertas (depois da Fase 2)

### C.1 `GET /api/metrics`

- Exige `Authorization: Bearer <METRICS_TOKEN>`. Sem a variável, a rota responde 404. Comparação em tempo constante.
- Formato de texto do Prometheus, escrito à mão (sem dependência).

| Métrica | Tipo | Rótulos |
|---|---|---|
| `geradorone_http_requests_total` | contador | `route`, `method`, `status` |
| `geradorone_http_request_duration_seconds` | histograma (0,01; 0,05; 0,1; 0,25; 0,5; 1; 2,5; 5; 10) | `route` |
| `geradorone_jobs` | medidor, lido do banco na coleta | `status` |
| `geradorone_job_duration_seconds` | histograma (5; 15; 30; 60; 120; 300; 600) | `kind`, `outcome` |
| `geradorone_chromium_active` | medidor (só no worker) | — |
| `geradorone_pg_pool_connections` | medidor | `state` = `total`, `idle`, `waiting` |
| `geradorone_outbox_pending` | medidor, lido do banco | — |
| `geradorone_event_loop_delay_seconds` | medidor (p99 de `monitorEventLoopDelay`) | — |
| `geradorone_process_resident_memory_bytes` | medidor | — |

- O worker não tem porta HTTP: expõe as métricas num servidor mínimo só na rede `internal` (`WORKER_METRICS_PORT`, padrão 9464), com o mesmo token.
- Com réplicas, o coletor busca cada contêiner pela rede interna, nunca pelo Caddy (que entregaria uma instância aleatória).

### C.2 Captura de erros

- `@sentry/node`, versão fixada, ativada só com `SENTRY_DSN`. Serve tanto para o Sentry em nuvem quanto para um GlitchTip no próprio servidor.
- Captura: erros sem `status` em `handleApi` e no `catch` de `http.createServer`; falhas de job no worker que não vêm do provedor.
- `beforeSend` remove corpo, cookies, `Authorization` e `query`, e mantém só `reqId`, `route` e `uid`.

### C.3 Alertas mínimos

| Alerta | Condição | Fonte |
|---|---|---|
| Fora do ar | `/api/health` falha por 2 minutos | verificador externo (Uptime Kuma ou similar) |
| Fila parada | algum job `queued` há mais de 10 minutos | `geradorone_jobs` + idade do mais antigo (`geradorone_oldest_queued_seconds`) |
| Erros em alta | mais de 5% de respostas 5xx em 5 minutos | `geradorone_http_requests_total` |
| Backup atrasado | último backup bom com mais de 26 h | `GET /api/settings/backup` (o cálculo já existe em `lib/backup.js`) ou o próprio `backup-db.json` |
| Disco | uso acima de 85% | coletor do host |
| E-mail travado | `geradorone_outbox_pending` acima de 20 por 15 minutos | métrica |

Canal do alerta: e-mail do administrador e, se existir, o canal de mensagens que você já usa no servidor. É uma decisão em aberto.

## Bloco D: caminho quente

### D.1 Estáticos em memória

- No início do processo, ler todo `public/` para um `Map` de `caminho → { bytes, gzip, etag, tipo }`. São cerca de 1,2 MB.
- `gzip`: `zlib.gzipSync` nível 9 para HTML, CSS, JS, JSON e SVG acima de 1 KB. O `bncc.json` cai de 486 KB para algo em torno de 60 KB.
- `etag`: os primeiros 16 caracteres do SHA-1 em base64url.
- Resposta: `If-None-Match` igual → 304. `Accept-Encoding` com `gzip` → corpo comprimido, `Content-Encoding: gzip`, `Vary: Accept-Encoding`.
- `Cache-Control`:

| Arquivo | Valor |
|---|---|
| nome com hash (`app.3f9a1c2b.js`) | `public, max-age=31536000, immutable` |
| `index.html`, `termos.html`, `privacidade.html` | `no-cache` (revalida sempre, usa o `ETag`) |
| `faq-data.js` | `no-cache` (o contato muda com o SMTP do painel) |
| fontes, ícones, `data/bncc.json` | `public, max-age=2592000` (30 dias) |

- `CONTACT_PAGES` (`termos.html`, `privacidade.html`, `faq-data.js`): a troca do e-mail de contato acontece na carga e é refeita quando a Fase 1 detecta mudança no SMTP, com novo `ETag`.
- Os cabeçalhos de segurança atuais (CSP, `nosniff`, `Referrer-Policy`) continuam iguais.

### D.2 Nomes com hash, sem etapa de build no desenvolvimento

`scripts/hash-assets.js` roda só no `Dockerfile`, depois do `COPY public`:

1. Para `app.js`, `style-art.js`, `faq-data.js`, `legal.js`, `styles.css`, `theme.css`, `app.css`, `design.css` e `legal.css`: calcula 8 caracteres do SHA-256 e renomeia para `nome.<hash>.ext`.
2. Reescreve as referências em `index.html`, `termos.html` e `privacidade.html`.
3. Falha o build se alguma referência não for encontrada.

No desenvolvimento (`npm start` direto), os nomes originais continuam funcionando.

### D.3 Threads

`UV_THREADPOOL_SIZE=16` no `environment` do web e do worker. O valor precisa estar no ambiente antes de o Node iniciar; não funciona definido dentro do código.

## Bloco E: e-mail em fila e paginação

### E.1 Fila de e-mails (migração 12)

```sql
CREATE TABLE outbox_emails (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  payload_enc text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts smallint NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX outbox_emails_due ON outbox_emails (next_attempt_at) WHERE status = 'queued';
```

- `payload_enc`: destinatário e partes do e-mail cifrados com AES-256-GCM e chave derivada `outbox` (mesma função `deriveKey` de `lib/crypto.js`). Códigos de recuperação e de cadastro não ficam legíveis no banco nem no backup.
- Depois de enviado, `payload_enc` vira texto vazio. Linhas `sent` e `failed` são apagadas após 7 dias.
- Tentativas: até 3, com espera de 30 s, 2 min e 5 min. E-mails com código expiram junto com o código (10 min): passou disso, `failed` sem nova tentativa.
- O worker da Fase 2 processa a fila com `FOR UPDATE SKIP LOCKED`, como os jobs.
- `lib/mailer.js`: os métodos públicos (`sendResetCode`, `sendSignupCode`, `sendSupportReceipt`, `sendTest`) passam a gravar na fila e voltam na hora. Um método interno `deliverNow` faz o envio real e é o que o worker chama.
- **Exceções que continuam síncronas:**
  - `sendSupportMessage`, porque leva anexos de até 8 MB e o README promete que os anexos não ficam guardados. Volume baixo (5 por hora por conta).
  - `sendTest` do painel SMTP, porque o administrador espera o resultado na tela.
- Testes: o transporte injetado (`setTransport`) continua funcionando; um `outbox.drain()` nos testes processa a fila na hora.

### E.2 Lista de usuários paginada

- `GET /api/users?q=&role=&page=1&pageSize=50` → `{ users, total, page, pageSize }`. `q` busca em nome e e-mail com `ILIKE`; `pageSize` máximo de 100.
- Índice: `CREATE INDEX users_name_lower ON users (lower(name))` na migração 12.
- `activeAdminCount` vira `SELECT count(*) FROM users WHERE role = 'admin' AND active`.
- Frontend (`loadUsers` e `renderUsers`, `public/app.js:2238-2261`): a busca e o filtro de perfil passam a ir ao servidor, com paginação de 50.

## Sequência de entrega

| PR | Bloco | Conteúdo |
|---|---|---|
| 3-a | A | `ci.yml` com a suíte atual e proteção da `main` |
| 3-b | A | `test/helpers/app.js` e divisão de `auth.test.js` |
| 3-c | A | Testes que faltam (A.3) |
| 3-d | B | `lib/log.js`, `X-Request-Id`, troca dos `console.*`, rotação no `compose`, teste de vazamento |
| — | — | **Fase 2 entra aqui** |
| 3-e | C | `/api/metrics`, métricas do worker |
| 3-f | C | Sentry ou GlitchTip e alertas |
| 3-g | D | Estáticos em memória, gzip, `ETag`, `Cache-Control`, `hash-assets.js`, `UV_THREADPOOL_SIZE` |
| 3-h | E | Migração 12, fila de e-mails |
| 3-i | E | Usuários paginados |

## Testes

| Cenário | Então |
|---|---|
| CI num PR que quebra um teste | Merge bloqueado |
| Arquivos `http-*.test.js` rodados em qualquer ordem, ou um só | Todos passam |
| Login com senha errada | Linha `http` com `status: 401`, sem e-mail nem senha em nenhuma linha |
| Erro forçado numa rota | 500 com código; a mesma `reqId` aparece no log e no evento de erro |
| `/api/metrics` sem token | 401; com `METRICS_TOKEN` vazio, 404 |
| `/api/metrics` com token | Texto com `geradorone_http_requests_total` |
| `GET /app.<hash>.js` com `Accept-Encoding: gzip` | `Content-Encoding: gzip`, `immutable` |
| `GET /index.html` com o `ETag` recebido antes | 304 |
| Contato trocado no painel | `termos.html` muda de `ETag` e mostra o novo e-mail |
| Cadastro com SMTP falhando | Resposta 200 na hora; a linha da fila fica `queued` e depois `failed` após 3 tentativas |
| Código na fila | `payload_enc` não contém o código em texto |
| `GET /api/users?q=ana` | Só quem tem "ana" no nome ou no e-mail; `total` correto |

## Critérios de aceite

- [ ] CI obrigatória e verde na `main`.
- [ ] Nenhum `console.` sobra em `server.js` e `worker.js`, exceto o `ensureAdmin` em desenvolvimento.
- [ ] Um erro forçado em homologação aparece no Sentry ou GlitchTip com `reqId`.
- [ ] Os alertas de fora do ar e de backup atrasado chegam ao canal escolhido num teste provocado.
- [ ] `curl -sI -H 'Accept-Encoding: gzip' https://<domínio>/app.<hash>.js` mostra `immutable` e `content-encoding: gzip`.
- [ ] Cadastro responde em menos de 300 ms com o SMTP desligado.

## Reversão

- Blocos A e B não mudam o comportamento do app.
- `METRICS_TOKEN` e `SENTRY_DSN` vazios desligam C.
- D: reverter o commit volta à leitura do disco; os navegadores com arquivos em cache longo continuam corretos porque o nome muda a cada versão.
- E: reverter o código deixa a tabela `outbox_emails` sem uso. E-mails ainda na fila no momento da reversão se perdem: rodar o worker até a fila esvaziar antes de reverter.
