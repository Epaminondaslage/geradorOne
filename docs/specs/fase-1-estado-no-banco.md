# Fase 1: tirar todo estado da memória do processo

## Objetivo

Qualquer instância do app atende qualquer requisição com o mesmo resultado, e um deploy não apaga limites de tentativa, códigos pendentes nem a configuração de SMTP.

## Estado atual

| Estado | Onde | Problema com duas instâncias ou após deploy |
|---|---|---|
| 5 limitadores (`loginLimiter`, `resetLimiter`, `supportLimiter`, `signupEmailLimiter`, `signupIpLimiter`) | `server.js:101-105`, `lib/rate-limit.js` | Cada instância conta só o que viu; o limite efetivo dobra; tudo zera no deploy |
| Códigos de recuperação | `resets` (`Map`), `server.js:106` | Código pedido na instância A não é encontrado na B |
| Cadastros pendentes | `signups` (`Map`), `server.js:107` | Mesmo problema; cadastro em andamento se perde no deploy |
| Limpeza dos dois `Map` | `setInterval`, `server.js:109-113` | Só faz sentido com estado local |
| Impressão digital da chave mestra | `runtime/secret.check`, `lib/secret-check.js` | Arquivo local; cada réplica teria o seu |
| Chave mestra sem `APP_SECRET` | `loadMasterSecret`, `lib/crypto.js:31-42` | Cada réplica geraria um `secret.key` diferente: sessões e chaves BYOK ilegíveis entre elas |
| SMTP do painel | `loadSmtpSettings`, `server.js:179-187` | Lido só no boot e após salvar; a outra instância não vê a mudança |
| Desafios de prova de trabalho usados | limitador em memória (Fase 0) | Um desafio usado na A seria aceito na B |

## Desenho

### 1.1 Limitador no Postgres (migração 8)

```sql
CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_expires ON rate_limits (expires_at);
```

Semântica: janela fixa que começa na primeira ocorrência. É um pouco mais permissiva que a janela deslizante atual no limite da janela, o que é aceitável para estes usos e cabe numa única consulta.

Interface (assíncrona, mesma forma de hoje):

```text
createLimiter(db, { max, windowMs }) → {
  blocked(key) → Promise<boolean>
  hit(key)     → Promise<number>   // contagem após registrar
  reset(key)   → Promise<void>
}
```

Consultas:

- `hit`:
  ```sql
  INSERT INTO rate_limits (key, hits, expires_at)
  VALUES ($1, 1, now() + make_interval(secs => $2 / 1000.0))
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
    expires_at = CASE WHEN rate_limits.expires_at <= now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END
  RETURNING hits;
  ```
- `blocked`: `SELECT hits FROM rate_limits WHERE key = $1 AND expires_at > now()` → `hits >= max`.
- `reset`: `DELETE FROM rate_limits WHERE key = $1`.
- Limpeza: a cada 10 minutos, `DELETE FROM rate_limits WHERE expires_at < now() - interval '1 hour'`.

Mudança nas rotas: todas as chamadas a `blocked`, `hit` e `reset` em `server.js` ganham `await`. Pontos: `login`, `forgot`, `confirm`, `signup`, `signup/confirm`, `delete-account`, `support`, mais as chaves da Fase 0 (`login:ip:*`, `login:email:*`, `pow:*`).

A versão em memória continua no arquivo como `createMemoryLimiter`, usada só nos testes de unidade de `crypto.test.js` e como reserva se `DATABASE_URL` faltar no desenvolvimento.

As chaves têm e-mails (dado pessoal). Elas somem sozinhas em até uma hora depois de expirar, e a exclusão de conta não precisa tratá-las.

### 1.2 Códigos pendentes (migração 9)

```sql
CREATE TABLE pending_codes (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('reset', 'signup')),
  email text NOT NULL,
  code_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pending_codes_lookup ON pending_codes (kind, email, expires_at);
```

- `payload` de `reset`: `{ passwordHash }`. De `signup`: `{ name, phone, termsVersion, passwordHash }`. É o mesmo conteúdo que hoje fica nos `Map`; o `passwordHash` é scrypt, igual ao da tabela `users`.
- Novo módulo `lib/pending-codes.js`:

```text
createPendingCodes(db, { hmacKey }) → {
  issue(kind, email, payload, minutes) → Promise<code>   // gera o código, grava o hash, devolve o código em claro
  consume(kind, email, code) → Promise<payload | null>   // confere e apaga todos os códigos daquele e-mail e tipo
  purgeExpired() → Promise<number>
}
```

- `issue`: até 3 códigos vivos por `(kind, email)`. Ao emitir o 4º, apaga o mais antigo na mesma transação. Pedir de novo **não** invalida o código de outra pessoa (fecha o item 4 dos achados do `CODEBASE_MAP.md`).
- `consume`: numa transação, `SELECT ... FOR UPDATE` dos códigos vivos, compara o HMAC em tempo constante com cada um e, se algum bater, apaga todos daquele `(kind, email)` e devolve o `payload`.
- Tentativas: saem da linha (`attempts`) e vão para o limitador: chave `confirm:<kind>:<e-mail>`, 5 tentativas em 10 minutos. Na 5ª falha, `consume` também apaga os códigos vivos.
- `resets`, `signups`, `MAX_PENDING_RESETS` e o `setInterval` de limpeza saem de `server.js`. `purgeExpired` roda junto com a limpeza do limitador.

### 1.3 Chave mestra obrigatória e impressão digital no banco

- `loadMasterSecret`: com `NODE_ENV=production`, exigir `APP_SECRET` com 32 caracteres ou mais e encerrar com mensagem clara se faltar. Fora de produção, o `runtime/secret.key` continua como hoje.
- `checkMasterSecret(settingsStore, master, { allowNew, legacyDir })`:
  1. Lê `settings.master-fingerprint`.
  2. Se não existir e houver `legacyDir/secret.check`, compara com o arquivo (mesma regra de hoje) e copia o valor para `settings`. Transição sem intervenção para quem já está no ar.
  3. Se não existir nada, grava e devolve `created`.
  4. Se for diferente, recusa iniciar (ou aceita com `ALLOW_NEW_SECRET=true` e devolve `replaced`).
- Ordem nova de inicialização (`server.js:963-973`): conferir `DATABASE_URL` → `db.migrate()` → `checkMasterSecret` → `importLegacyJson` → `loadSmtpSettings` → `ensureAdmin` → `listen`. As migrações vêm antes porque a tabela `settings` precisa existir; não dependem da chave.
- Depois desta fase, o volume `./runtime` só é necessário para o `legacy-import` em instalações antigas. Em instalação nova, sai do `compose`.

### 1.4 SMTP coerente entre instâncias

- Cada instância relê `SELECT value, updated_at FROM settings WHERE key = 'smtp'` a cada `SMTP_RELOAD_SECONDS` (padrão 30) e chama `loadSmtpSettings` só se `updated_at` mudou.
- Escolha deliberada de leitura periódica em vez de `LISTEN/NOTIFY`: não exige conexão dedicada e funciona atrás do PgBouncer em modo transação (Fase 4).
- `DELETE /api/settings/smtp` grava um marcador (`settings.smtp = {}` com `updated_at`) em vez de apagar a linha, para as outras instâncias perceberem a volta ao `.env`.

### 1.5 Registro de auditoria (migração 10)

```sql
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  action text NOT NULL,
  target_id text,
  ip text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_log_at ON audit_log (at DESC);
CREATE INDEX audit_log_actor ON audit_log (actor_id, at DESC);
```

| `action` | Onde | `details` |
|---|---|---|
| `user.create` | `POST /api/users` | `{ role }` |
| `user.update` | `PUT /api/users/:id` | nomes dos campos alterados e, para `role` e `active`, valor antigo e novo |
| `user.reset_password` | `POST /api/users/:id/reset-password` | `{ generated: true \| false }` |
| `user.delete` | `DELETE /api/users/:id` | `{ removedProjects }` |
| `account.delete` | `POST /api/auth/delete-account` | `{ removedProjects }` |
| `smtp.update` | `PUT /api/settings/smtp` | `{ host, port, user, passwordChanged }` |
| `smtp.delete` | `DELETE /api/settings/smtp` | `{}` |
| `smtp.test` | `POST /api/settings/smtp/test` | `{ ok }` |
| `secret.replaced` | inicialização com `ALLOW_NEW_SECRET` | `{}` |

- Nunca entram em `details`: senha, hash, código, valor de chave de IA, corpo de e-mail.
- `actor_email` guarda uma cópia do e-mail porque `actor_id` vira nulo quando a conta do administrador é excluída.
- `GET /api/audit?page=1&pageSize=50&action=user.delete` (só admin) → `{ entries: [...], total, page }`. A tela fica para depois; a rota já permite consulta.
- Retenção: `DELETE FROM audit_log WHERE at < now() - make_interval(days => $AUDIT_RETENTION_DAYS)` na limpeza diária. A Política de privacidade passa a mencionar o registro e o prazo.

## Sequência de entrega

| PR | Conteúdo | Arquivos |
|---|---|---|
| 1-a | Migração 8 e limitador no banco; rotas com `await` | `lib/db.js`, `lib/rate-limit.js`, `server.js`, `test/store.test.js`, `test/crypto.test.js`, `test/auth.test.js` |
| 1-b | Migração 9 e `lib/pending-codes.js`; remove `resets`, `signups` e o `setInterval` | `lib/db.js`, `lib/pending-codes.js`, `server.js`, testes |
| 1-c | `APP_SECRET` obrigatória em produção; impressão digital em `settings`; nova ordem de inicialização | `lib/crypto.js`, `lib/secret-check.js`, `server.js`, `test/secret.test.js`, README |
| 1-d | Releitura periódica do SMTP | `server.js`, `lib/settings.js`, `test/auth.test.js` |
| 1-e | Migração 10, auditoria e `GET /api/audit` | `lib/db.js`, `lib/audit.js`, `server.js`, `public/privacidade.html`, `lib/legal.js` (nova versão), testes |

O PR 1-e muda o texto da Política, então muda `LEGAL_VERSION` e todos aceitam de novo. Pode ser agrupado com outra mudança de texto para não pedir aceite duas vezes.

## Testes

| Cenário | Dado | Quando | Então |
|---|---|---|---|
| Limite compartilhado | Dois `createLimiter` com o mesmo `db` e `max: 3` | 2 `hit` em um e 1 no outro | `blocked` é verdadeiro nos dois |
| Janela expira | `windowMs: 200` | 3 `hit`, espera 250 ms | `blocked` é falso; o próximo `hit` devolve 1 |
| Corrida no limite | `max: 5` | 20 `hit` simultâneos | A contagem final é 20, sem perder incremento |
| Código entre instâncias | Dois servidores no mesmo banco (dois processos filhos) | `forgot` no A, `confirm` no B | Senha trocada |
| Código não é substituído | Ana e um atacante pedem código para `ana@` | Ana usa o código dela | Aceito |
| Quatro códigos | 4 `issue` para o mesmo e-mail | `consume` com o 1º código | `null` (o mais antigo foi apagado) |
| Tentativas | Código válido emitido | 5 `confirm` errados, depois o certo | O certo é recusado; os códigos foram apagados |
| Cadastro sobrevive ao deploy | Cadastro pedido | Reiniciar o servidor e confirmar | Conta criada |
| Chave obrigatória | `NODE_ENV=production`, sem `APP_SECRET` | Iniciar | Sai com código 1 e a mensagem |
| Transição do `secret.check` | `runtime/secret.check` com a chave A, `settings` vazio | Iniciar com a chave A | Inicia, e `settings.master-fingerprint` passa a existir |
| Chave trocada | Impressão digital da chave A no banco | Iniciar com a chave B | Recusa, como hoje |
| SMTP propagado | Duas instâncias, `SMTP_RELOAD_SECONDS=1` | Admin salva SMTP na A | Em até 2 s, `GET /api/auth/config` da B mostra `emailReset: true` |
| Auditoria registra | Admin desativa um usuário | `GET /api/audit` | Uma entrada `user.update` com `active: true → false`, sem hash em lugar nenhum |
| Auditoria restrita | Usuário comum | `GET /api/audit` | 403 |

## Critérios de aceite

- [ ] `grep -nE "new Map\(|createMemoryLimiter|setInterval" server.js` não devolve estado de segurança nem limpeza de `Map`.
- [ ] Duas instâncias (`docker compose up --scale gerador-one=2` com o `container_name` removido só neste teste) passam por um roteiro manual: login errado alternando instâncias bloqueia no 8º; código pedido numa instância e confirmado na outra funciona.
- [ ] Os 14 cenários acima passam, e a suíte inteira continua verde.
- [ ] Política de privacidade e FAQ mencionam o registro de auditoria.

## Reversão

- As migrações 8 a 10 são aditivas. Reverter o código deixa as tabelas sem uso.
- O PR 1-c é o único com efeito de inicialização: se algo der errado, `ALLOW_NEW_SECRET` **não** deve ser usado como saída. O caminho é reverter o commit, porque o `runtime/secret.check` continua no disco e o código antigo volta a lê-lo.
- Os códigos pendentes durante um deploy de reversão se perdem (voltam a ficar em memória). Impacto: quem estava no meio de uma recuperação pede um código novo.
