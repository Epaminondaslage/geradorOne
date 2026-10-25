# Fase 2: geração assíncrona com fila, worker e Chromium isolado

## Objetivo

`POST /api/generate` responde em menos de 100 ms. O trabalho pesado (IA, imagens, diagramas, PDF) roda num processo separado, com concorrência limitada e cota por usuário, e nenhum usuário consegue esgotar a CPU, a memória ou o `/tmp` do servidor.

## Estado atual

| Ponto | Onde | Comportamento hoje |
|---|---|---|
| Rota | `server.js:888-911` | Requisição HTTP aberta durante todo o trabalho |
| Texto da IA | `requestAiHtml`, `server.js:392-395` | Até 180 s; inclui `renderVisuals` |
| Diagramas | `drawInBrowser`, `lib/visuals.js:105-123` | Um Chromium por chamada, até 60 s |
| Imagens | `server.js:897-898` | Até 3 em paralelo, até 180 s, **só depois** que o texto termina |
| PDF | `htmlToPdf`, `server.js:473-488` | Outro Chromium, até 90 s |
| Resposta | `server.js:904-906` | JSON com todos os arquivos em base64 (um PDF com 3 imagens passa de 10 MB) |
| Limites | nenhum | Sem fila, sem cota, sem limite de Chromiums simultâneos |
| Contêiner | `Dockerfile`, `compose*.yaml` | Chromium instalado no contêiner web, `/tmp` de 32 MB, `--no-sandbox` |
| Frontend | `public/app.js:993-1015` | Uma espera única; recarregar a página perde o resultado |
| Arquivos no frontend | `renderGeneratedFiles`, `saveGeneratedFile`, `public/app.js:1038-1061` | Tamanho calculado do base64; download por `Blob` |

Pior caso de uma geração: 180 s (texto, com diagramas) + 180 s (imagens) + 90 s (PDF) = 7,5 min numa única conexão HTTP.

## Desenho

### 2.1 Visão geral

1. O navegador envia o pedido. O servidor valida, confere a cota, grava um job `queued` e responde `202` com o id.
2. Um `worker.js` reivindica o job com `FOR UPDATE SKIP LOCKED`, marca `running` e executa: texto e imagens em paralelo, depois diagramas e PDF sob o semáforo do Chromium.
3. O worker grava o progresso no job a cada etapa e um sinal de vida a cada 15 s.
4. O navegador consulta o job a cada 2 s, mostra a etapa e o percentual e, ao fim, lista os arquivos.
5. Os arquivos ficam no banco por `GENERATION_RETENTION_HOURS` (24 h) e são baixados por rota própria, um por vez.

### 2.2 Tabelas (migração 11)

```sql
CREATE TABLE generation_jobs (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('generate', 'improve')),
  status text NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  request jsonb NOT NULL,
  stage text NOT NULL DEFAULT 'fila',
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  cancel_requested boolean NOT NULL DEFAULT false,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  worker_id text,
  heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX generation_jobs_queue ON generation_jobs (created_at) WHERE status = 'queued';
CREATE INDEX generation_jobs_running ON generation_jobs (heartbeat_at) WHERE status = 'running';
CREATE INDEX generation_jobs_owner ON generation_jobs (owner_id, created_at DESC);
CREATE INDEX generation_jobs_finished ON generation_jobs (finished_at) WHERE finished_at IS NOT NULL;

CREATE TABLE generation_files (
  job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  name text NOT NULL,
  mime_type text NOT NULL,
  size integer NOT NULL,
  bytes bytea NOT NULL,
  PRIMARY KEY (job_id, position)
);
```

- `request`: o que a rota recebe hoje, já validado. Para `generate`: `{ title, format, prompt, generateImages, imageCount }`. Para `improve`: `{ prompt, adjustments, instruction }`.
- `result`: `{ model }` para `generate`; `{ model, prompt }` para `improve`, sem arquivos.
- **A chave de IA nunca vai para o job.** O worker carrega o usuário por `owner_id` e decifra a chave na hora, como `aiConfigFor` faz hoje. Se a pessoa apagar a chave enquanto o job espera, o job falha com a mensagem atual de chave ausente.
- Excluir a conta apaga jobs e arquivos em cascata. O prompt fica no banco por até 24 h depois de terminar o job; a Política de privacidade passa a dizer isso.

### 2.3 Módulos

| Módulo | Conteúdo | Origem |
|---|---|---|
| `lib/ai/providers.js` | `requestOpenAiText`, `requestGeminiText`, `requestAnthropicText`, `requestOpenAiImage`, `requestGeminiImage`, `requestAiText`, `requestAiImage`, `PROVIDERS`, `DEFAULT_MODEL`, `DEFAULT_IMAGE_MODEL`, `PROVIDERS_WITH_IMAGES`, `NO_IMAGES_MESSAGE` | movidos de `server.js:35-43, 335-465` sem mudar a lógica; cada função passa a aceitar um `signal` externo |
| `lib/ai/html.js` | `HTML_INSTRUCTIONS`, `IMPROVE_INSTRUCTIONS`, `cleanGeneratedHtml`, `stripUnsafeMarkup`, `cleanDiagramSvg`, `embedImages`, `cleanImprovedPrompt`, `imageBriefing` | movidos de `server.js:295-333, 397-411, 467-471` |
| `lib/ai/pdf.js` | `htmlToPdf(html, { signal })` | movido de `server.js:473-488` |
| `lib/semaphore.js` | `createSemaphore(n)` → `{ run(fn), active, waiting }` | novo, cerca de 30 linhas, sem dependência |
| `lib/jobs.js` | armazenamento dos jobs (abaixo) | novo |
| `worker.js` | laço do worker (abaixo) | novo, na raiz, ao lado de `server.js` |

`server.js` continua exportando os mesmos nomes (reexportados de `lib/ai/*`) para `test/server.test.js` não mudar neste PR.

Interface de `lib/jobs.js`:

```text
createJobStore(db) → {
  enqueue(ownerId, kind, request, { dailyQuota, maxActive }) → Promise<job>   // 429 com code QUOTA_DAILY ou QUOTA_ACTIVE
  get(ownerId, id) → Promise<job | null>                                      // só do dono
  listRecent(ownerId, { activeOnly }) → Promise<job[]>
  requestCancel(ownerId, id) → Promise<job | null>
  claim(workerId) → Promise<job | null>
  heartbeat(id, workerId) → Promise<{ cancelRequested }>
  progress(id, workerId, stage, percent) → Promise<void>
  finish(id, workerId, { result, files }) → Promise<void>                     // grava arquivos e marca done numa transação
  fail(id, workerId, message) → Promise<void>
  cancelled(id, workerId) → Promise<void>
  reapStale(staleSeconds) → Promise<number>
  purgeFinished(retentionHours) → Promise<number>
  readFile(ownerId, id, position) → Promise<{ name, mimeType, size, bytes } | null>
}
```

Consultas que precisam ser exatas:

- **Cota** (em `enqueue`, dentro de uma transação com `pg_advisory_xact_lock(hashtext('jobs:' || owner_id))`, a mesma técnica de `projects.save`):
  - ativos: `count(*) WHERE owner_id = $1 AND status IN ('queued', 'running')` ≥ `maxActive` → 429 `QUOTA_ACTIVE`, mensagem `Você já tem 2 gerações em andamento. Espere uma terminar.`
  - do dia: `count(*) WHERE owner_id = $1 AND kind = 'generate' AND status <> 'cancelled' AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'` ≥ `dailyQuota` → 429 `QUOTA_DAILY`, mensagem `Você chegou ao limite de 20 gerações por dia. O limite volta à meia-noite.`
  - Cancelados antes de começar não contam; cancelados depois de começar contam, porque a IA já foi chamada.
- **Reivindicação**:
  ```sql
  UPDATE generation_jobs SET status = 'running', worker_id = $1, started_at = now(), heartbeat_at = now(), stage = 'iniciando', progress = 5
  WHERE id = (SELECT id FROM generation_jobs WHERE status = 'queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING *;
  ```
- **Toda escrita do worker** filtra `WHERE id = $1 AND worker_id = $2 AND status = 'running'`. Se o job foi recolhido como órfão, a escrita atrasada de um worker antigo não sobrescreve nada.
- **Órfãos** (`reapStale`): `status = 'running' AND heartbeat_at < now() - 120 s` → `failed` com `O processamento foi interrompido. Tente gerar de novo.` **Sem nova tentativa automática**: a chamada de IA usa a chave e o saldo da pessoa (BYOK), e repetir sem ela pedir gastaria o dinheiro dela duas vezes.

### 2.4 Worker

```text
worker.js
  WORKER_ID = <hostname>:<pid>
  semáforo de jobs (WORKER_CONCURRENCY) e semáforo do Chromium (CHROMIUM_CONCURRENCY)
  laço: enquanto houver vaga no semáforo de jobs → claim(); sem job → espera 1 s
  a cada 60 s: reapStale(120); a cada 10 min: purgeFinished(24) e as limpezas da Fase 1
  SIGTERM: para de reivindicar, espera os jobs em andamento até 150 s, depois marca os restantes como failed ("interrompido por atualização") e sai
```

Execução de um job `generate`:

| Etapa (`stage`) | `progress` | O que acontece |
|---|---|---|
| `iniciando` | 5 | Carrega o usuário e decifra a chave |
| `texto` / `imagens` | 10 a 60 | Texto (`requestAiText` com `HTML_INSTRUCTIONS`) e imagens rodam **em paralelo**, porque as duas só dependem do prompt. O percentual sobe a cada parte concluída |
| `diagramas` | 70 | `renderVisuals` com `draw` dentro do semáforo do Chromium |
| `pdf` | 85 | `embedImages` e, se `format = pdf`, `htmlToPdf` dentro do semáforo |
| `salvando` | 95 | `finish`: grava os arquivos e marca `done` |

- Um `AbortController` por job, ligado a três gatilhos: prazo de `JOB_DEADLINE_SECONDS`, `cancel_requested` lido no sinal de vida e `SIGTERM` após o tempo de espera. O mesmo `signal` vai para os `fetch` dos provedores e para o `execFile` do Chromium.
- Imagens em paralelo com o texto mudam um detalhe: se o texto falhar, as imagens já pedidas continuam a ser cobradas pelo provedor. Ao falhar o texto, o worker aborta as imagens pendentes pelo mesmo `signal`.
- Erros com `status` (mensagens já escritas para o usuário em `lib/ai/*`) vão para `error` como estão. Erros sem `status` viram `Não foi possível gerar o material com IA.` no job, e a mensagem original vai só para o log.

Job `improve`: uma etapa só (`texto`), com o prazo atual de 90 s; o `result` traz o prompt reescrito. Fica no mesmo mecanismo para ter a mesma cota de concorrência, mas não conta na cota diária de gerações.

### 2.5 Rotas

| Método e caminho | Resposta |
|---|---|
| `POST /api/generate` | `202 { job }`. Mesmas validações de hoje (400), mais `503` sem chave de IA e `429` de cota. Com `GENERATION_MODE=inline`, mantém o comportamento atual (200 com arquivos), para reversão |
| `GET /api/generate?active=1` | `200 { jobs: [...] }`, os últimos 10 jobs do usuário, ou só os ativos; o frontend usa ao abrir a página para retomar um job em andamento |
| `GET /api/generate/:id` | `200 { job }` ou 404 (inclusive job de outra pessoa) |
| `GET /api/generate/:id/files/:position` | O arquivo com `Content-Type`, `Content-Length`, `Content-Disposition: attachment; filename*=UTF-8''<nome>`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`. Com `?inline=1`, só para `text/html`: `Content-Disposition: inline` e `Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox` |
| `DELETE /api/generate/:id` | `200 { job }`. Na fila → `cancelled` na hora; rodando → `cancel_requested = true` e o worker para na próxima verificação; terminado → 409 |
| `POST /api/improve` | Igual ao `generate`, com `kind = 'improve'` |

Formato de `job`:

```json
{
  "id": "6f1c…",
  "kind": "generate",
  "status": "running",
  "stage": "imagens",
  "progress": 40,
  "error": null,
  "model": null,
  "createdAt": "2026-11-03T14:02:11.000Z",
  "finishedAt": null,
  "expiresAt": null,
  "files": []
}
```

Quando `status = done`: `model`, `finishedAt`, `expiresAt` e `files: [{ "position": 0, "name": "fotossintese.pdf", "mimeType": "application/pdf", "size": 812345 }]`.

O arquivo HTML aberto com `?inline=1` tem CSP própria com `sandbox`: mesmo que o sanitizador deixe passar algo, o navegador não executa script nem acessa a origem do app.

### 2.6 Contêineres

`Dockerfile` com dois alvos sobre a mesma base:

| Alvo | Base | Instala | Comando |
|---|---|---|---|
| `web` | `node:22-alpine` | só o app | `node server.js` |
| `worker` | `web` | `chromium font-dejavu` | `node worker.js` |

`compose.prod.yaml` ganha o serviço `worker`:

| Chave | Valor | Motivo |
|---|---|---|
| `build.target` | `worker` | imagem com Chromium |
| `read_only` | `true` | como o web |
| `tmpfs` | `/tmp:size=512m,mode=1777` | PDFs com imagens não cabem em 32 MB |
| `pids_limit` | `256` | contém um Chromium descontrolado |
| `mem_limit` / `cpus` | `2g` / `2` | um worker não derruba o host |
| `cap_drop`, `security_opt` | `ALL`, `no-new-privileges:true` | como o web; o `seccomp` padrão do Docker continua ativo |
| `networks` | `internal` e `web` | banco e saída para as APIs de IA (a rede `internal` não tem saída) |
| `ports` | nenhuma | não atende HTTP |
| `stop_grace_period` | `3m` | termina o job em andamento no deploy |
| `healthcheck` | `node -e` que confere o arquivo `/tmp/worker-alive`, atualizado a cada laço | sem porta HTTP |

O serviço web perde o Chromium, e o `tmpfs` dele pode continuar com 32 MB.

`--no-sandbox` continua: o sandbox do Chromium precisa de `CAP_SYS_ADMIN` ou de namespaces de usuário no host, que o contêiner endurecido não tem. A compensação é o isolamento acima. Se o conteúdo gerado por IA passar a ser tratado como hostil, o próximo passo é rodar o worker com `runtime: runsc` (gVisor).

### 2.7 Frontend

Em `public/app.js`, no envio do formulário da apostila (linhas 993-1015):

1. `POST api/generate` → guarda `job.id` em `sessionStorage` (`g1-job`) e começa a consultar.
2. Consulta: `GET api/generate/<id>` a cada 2 s no primeiro minuto e a cada 5 s depois; para quando `status` não for `queued` nem `running`. Pausa com a aba escondida (`document.hidden`) e retoma ao voltar.
3. Mostra no lugar do `ai-loading` uma barra de progresso acessível (`<progress>` com `aria-valuetext` = etapa em português) e um botão **Cancelar** (`DELETE`).
4. Ao concluir, `currentFiles` passa a ter `{ position, name, mimeType, size, url }`. `renderGeneratedFiles` usa `size` (em vez de calcular do base64). `saveGeneratedFile` baixa por `url` com `<a download>`.
5. A prévia do HTML abre `api/generate/<id>/files/0?inline=1` no `previewFrame` com `src` em vez de `srcdoc`.
6. Ao abrir a página, `GET api/generate?active=1`: se houver job ativo, retoma a consulta e mostra o progresso. O aviso `Não saia desta página` vira `Pode sair desta página: o material continua sendo gerado e aparece aqui quando você voltar.`
7. Mensagens de 429 aparecem como estão no campo de status.

O botão **Melhorar com IA** (linhas 1176-1182) segue o mesmo fluxo, com uma etapa só.

### 2.8 Outras rotas pesadas

- `/api/pdf` (pdfkit, só o prompt, sem Chromium) continua síncrona, com limitador `pdf:<uid>` de 10 por minuto.
- `/api/render` (prévia em HTML do prompt) é barata; limitador `render:<uid>` de 60 por minuto.

## Sequência de entrega

| PR | Conteúdo | Observação |
|---|---|---|
| 2-a | Extrair `lib/ai/*` de `server.js`, sem mudar comportamento | Suíte inteira verde é o único critério; nenhum teste novo é exigido além de importar de `lib/ai` |
| 2-b | Migração 11, `lib/jobs.js`, `lib/semaphore.js` com testes de armazenamento | Ainda sem uso nas rotas |
| 2-c | `worker.js` e rotas novas atrás de `GENERATION_MODE` (padrão `inline` neste PR) | Permite testar a fila em homologação sem mudar produção |
| 2-d | Frontend com consulta, progresso, cancelar e retomar | Funciona nos dois modos (no `inline` não há `job`) |
| 2-e | `Dockerfile` com dois alvos, serviço `worker` no `compose.prod.yaml` e no `compose.yaml` | |
| 2-f | `GENERATION_MODE=queue` como padrão; limitadores de `/api/pdf` e `/api/render`; Política de privacidade (prompt guardado por 24 h) | Muda `LEGAL_VERSION` |

## Testes

`test/jobs.test.js` (armazenamento, contra Postgres real):

| Cenário | Então |
|---|---|
| Dois `claim` simultâneos com um job na fila | Só um recebe o job |
| `enqueue` com 2 ativos | 429 `QUOTA_ACTIVE` |
| `enqueue` após 20 no dia, incluindo um cancelado na fila | O cancelado não conta; o 21º válido recebe 429 `QUOTA_DAILY` |
| 5 `enqueue` simultâneos com `maxActive: 2` | Exatamente 2 gravados |
| Escrita de worker com `worker_id` errado | Não altera o job |
| `reapStale` com sinal de vida de 3 min atrás | Job vira `failed` com a mensagem de interrupção |
| `purgeFinished` | Apaga jobs terminados há mais de 24 h e seus arquivos; mantém os recentes e os ativos |
| `get` e `readFile` de outro usuário | `null` |

`test/worker.test.js` (worker com dependências injetadas: `createWorker({ db, userStore, keyEncKey, providers, draw, htmlToPdf })`, provedor simulado sem rede):

| Cenário | Então |
|---|---|
| Geração HTML sem imagens | `done`, um arquivo `text/html`, `model` preenchido |
| Geração PDF com 2 imagens | `done`, 3 arquivos; o provedor de imagem foi chamado antes de o texto terminar (provedor simulado registra a ordem) |
| Provedor devolve erro com `status` | `failed` com a mensagem do provedor |
| Texto falha com imagens em andamento | Imagens abortadas (o `signal` chega abortado ao provedor simulado) |
| Cancelar durante o texto | `cancelled`; o `signal` do provedor foi abortado |
| Prazo estourado | `failed` com mensagem de tempo máximo |
| Chave apagada enquanto o job esperava | `failed` com `Configure sua chave de API…` |
| `CHROMIUM_CONCURRENCY=1` com 3 jobs de PDF | `draw` e `htmlToPdf` nunca rodam mais de um ao mesmo tempo (contador no simulado) |

`test/auth.test.js` (rotas, com `GENERATION_MODE=queue` e o worker rodando no mesmo processo de teste):

| Cenário | Então |
|---|---|
| `POST /api/generate` válido | 202 em menos de 200 ms, com `job.status = queued` |
| Consulta até terminar | `done`, arquivos listados, `GET …/files/0` devolve os bytes com `Content-Disposition` |
| `…/files/0?inline=1` de um HTML | CSP com `sandbox` |
| Job de outro usuário | 404 em `GET`, `DELETE` e arquivos |
| `DELETE` de job terminado | 409 |
| `GENERATION_MODE=inline` | Mesmo resultado de hoje (200 com arquivos em base64) |

## Critérios de aceite

- [ ] `docker compose -f compose.prod.yaml exec gerador-one which chromium-browser` não encontra nada.
- [ ] Com um provedor simulado em homologação (`AI_FAKE_PROVIDER=1`, recusado quando `NODE_ENV=production`), 20 pedidos simultâneos de PDF terminam sem nenhum 5xx, e `ps` no worker nunca mostra mais Chromiums que `CHROMIUM_CONCURRENCY`.
- [ ] `POST /api/generate` tem p95 abaixo de 100 ms nesse teste.
- [ ] Recarregar a página no meio de uma geração retoma o progresso.
- [ ] Os cenários acima passam, e a suíte inteira continua verde.
- [ ] Política de privacidade, FAQ e README atualizados (cota, retenção de 24 h, cancelamento).

## Reversão

- `GENERATION_MODE=inline` devolve o comportamento atual sem novo deploy de código. Para isso funcionar, o contêiner web mantém o Chromium **até** o PR 2-f estar estável por duas semanas; só então o alvo `web` perde o pacote.
- A migração 11 é aditiva.
- Jobs na fila no momento de uma reversão ficam parados. O roteiro de reversão inclui `UPDATE generation_jobs SET status = 'failed', error = 'Serviço atualizado. Gere de novo.' WHERE status IN ('queued', 'running')`.

## Volume esperado

Um PDF com 3 imagens tem cerca de 10 MB. Com 50 gerações por hora e retenção de 24 h, ficam em torno de 12 GB na tabela `generation_files` em regime. Cabe no disco atual (936 GB); o `pg_dump` diário deve excluir os dados dessa tabela (`--exclude-table-data=generation_files`), porque são temporários e dobrariam o tamanho do backup.
