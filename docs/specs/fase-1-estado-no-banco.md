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

Interface (assíncrona, com nome obrigatório):

```text
createLimiter(db, { name, max, windowMs }) → {
  hit(key)     → Promise<{ count, limited }>   // registra e devolve a contagem; limited = count > max
  blocked(key) → Promise<boolean>              // só consulta, para telas que mostram o estado sem registrar
  reset(key)   → Promise<void>
}
```

- **Nome obrigatório.** A linha gravada é `key = name + ':' + chave`. Hoje cada limitador tem o seu `Map`, e as mesmas chaves se repetem entre eles: `email:<e-mail>` aparece em `loginLimiter` (na exclusão de conta), `resetLimiter` e `signupEmailLimiter`, e `ip:<ip>` aparece em `resetLimiter` e `signupIpLimiter` (`server.js:498, 518, 535, 555-556, 633`). Numa tabela única sem o nome, os contadores se somariam.
- **Registrar antes de trabalhar.** As rotas chamam `hit()` primeiro e usam `limited` para decidir, antes do scrypt ou do envio de e-mail. Sucesso chama `reset()` quando a regra pede (login certo). Esse padrão já vale desde a Fase 0.

Nomes usados: `login-par`, `login-ip`, `login-email` (Fase 0), `reset-email`, `reset-ip`, `signup-email`, `signup-ip`, `confirm-par`, `confirm-email`, `support`, `pow`, `pdf`, `render`, `2fa`.

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

Mudança nas rotas: todas as chamadas ganham `await` e passam ao padrão "registrar antes". Pontos: `login`, `forgot`, `confirm`, `signup`, `signup/confirm`, `delete-account`, `support`, mais os limitadores da Fase 0.

A versão em memória continua no arquivo como `createMemoryLimiter`, com a mesma interface, usada só nos testes de unidade de `crypto.test.js`. Não há reserva sem banco: o servidor já encerra quando falta `DATABASE_URL` (`server.js:966`).

As chaves têm e-mails (dado pessoal). Elas somem sozinhas em até uma hora depois de expirar, e a exclusão de conta não precisa tratá-las.

### 1.2 Códigos pendentes e novo fluxo da recuperação (migração 9)

**Mudança de fluxo na recuperação.** Hoje a pessoa escolhe a nova senha **antes** de receber o código (`/api/auth/forgot` recebe `password`, `server.js:521-527`). Isso deixa um caminho para tomar a conta: o atacante pede recuperação para `ana@` com a senha dele; se Ana receber o código e digitá-lo achando que é o dela, a senha passa a ser a do atacante. Com vários códigos vivos ao mesmo tempo (abaixo), o risco cresceria.

Fluxo novo:

1. `POST /api/auth/forgot` recebe só `{ email, pow }` e envia o código. Não recebe senha.
2. `POST /api/auth/confirm` recebe `{ email, code, password }`. O servidor confere o código, aplica `checkPasswordStrength` à senha nova e só então troca.
3. Frontend: o painel `forgot` do login (`showAuth`) perde o campo de senha; o painel `confirm` ganha os campos "Nova senha" e "Repita a nova senha".

O cadastro continua como está (a pessoa escolhe a senha da própria conta nova junto com o pedido), porque ali não há conta de outra pessoa a tomar.

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

- `payload` de `reset`: vazio (a senha nova chega só na confirmação). De `signup`: `{ name, phone, termsVersion, passwordHash }`, o mesmo conteúdo que hoje fica no `Map`; o `passwordHash` é scrypt, igual ao da tabela `users`.
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
- Tentativas: saem da linha e vão para dois limitadores. `confirm-par` (chave `<kind>:<ip>:<e-mail>`): 5 em 10 minutos, bloqueia só aquele IP. `confirm-email` (chave `<kind>:<e-mail>`): 20 em 10 minutos, bloqueia a confirmação daquele e-mail por 10 minutos. **Falhas nunca apagam os códigos**: se apagassem, alguém de outro IP poderia invalidar a recuperação de outra pessoa errando de propósito. Com 3 códigos vivos e 20 tentativas por 10 minutos, a chance de acertar um código de 6 dígitos no chute é de 60 em 1 milhão por janela.
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

- `lib/settings.js` ganha `getWithMeta(key)` → `{ value, updatedAt } | null`, porque `get` devolve só o valor.
- Cada instância chama `getWithMeta('smtp')` a cada `SMTP_RELOAD_SECONDS` (padrão 30) e roda `loadSmtpSettings` só se `updatedAt` mudou.
- Escolha deliberada de leitura periódica em vez de `LISTEN/NOTIFY`: não exige conexão dedicada e funciona atrás do PgBouncer em modo transação (Fase 4).
- `DELETE /api/settings/smtp` grava um marcador (`settings.smtp = {}`, com `updated_at` novo) em vez de apagar a linha, para as outras instâncias perceberem a volta ao `.env`.
- O `PUT` do SMTP hoje só copia a senha do `.env` quando não há configuração anterior (`!previous`, `server.js:754`). Com o marcador, `previous` passa a ser `{}`, que é verdadeiro. A condição muda para `!previous?.host`, e `loadSmtpSettings` e `smtpView` já tratam `!stored.host` como ausente.

### 1.5 Registro de auditoria (migração 10)

```sql
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_email text,
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
- Eventos sem pessoa (`secret.replaced` na inicialização, `DISABLE_2FA` da Fase 5) gravam `actor_id` e `actor_email` nulos e `details.origem = 'sistema'`.
- `GET /api/audit?page=1&pageSize=50&action=user.delete` (só admin) → `{ entries: [...], total, page }`. A tela fica para depois; a rota já permite consulta.
- Retenção: `DELETE FROM audit_log WHERE at < now() - make_interval(days => $AUDIT_RETENTION_DAYS)` na limpeza diária. A Política de privacidade passa a mencionar o registro e o prazo.

## Sequência de entrega

| PR | Conteúdo | Arquivos |
|---|---|---|
| 1-a | Migração 8 e limitador no banco; rotas com `await` | `lib/db.js`, `lib/rate-limit.js`, `server.js`, `test/store.test.js`, `test/crypto.test.js`, `test/auth.test.js` |
| 1-b | Migração 9 e `lib/pending-codes.js`; remove `resets`, `signups` e o `setInterval`; novo fluxo da recuperação (senha escolhida depois do código) | `lib/db.js`, `lib/pending-codes.js`, `server.js`, `public/index.html`, `public/app.js`, `public/faq-data.js`, testes |
| 1-c | `APP_SECRET` obrigatória em produção; impressão digital em `settings`; nova ordem de inicialização | `lib/crypto.js`, `lib/secret-check.js`, `server.js`, `test/secret.test.js`, README |
| 1-d | Releitura periódica do SMTP | `server.js`, `lib/settings.js`, `test/auth.test.js` |
| 1-e | Migração 10, auditoria e `GET /api/audit` | `lib/db.js`, `lib/audit.js`, `server.js`, `public/privacidade.html`, `lib/legal.js` (nova versão), testes |

O PR 1-e muda o texto da Política, então muda `LEGAL_VERSION` e todos aceitam de novo. Pode ser agrupado com outra mudança de texto para não pedir aceite duas vezes.

## Testes

| Cenário | Dado | Quando | Então |
|---|---|---|---|
| Limite compartilhado entre instâncias | Dois `createLimiter` com o mesmo `db`, mesmo `name` e `max: 3` | 2 `hit` em um e 2 no outro | O 4º devolve `limited: true` |
| Nomes não colidem | Limitadores `reset-email` e `signup-email`, `max: 3` | 3 `hit` em `reset-email` para `ana@` | `signup-email` para `ana@` continua com contagem 0 |
| Janela expira | `windowMs: 200` | 3 `hit`, espera 250 ms | O próximo `hit` devolve `count: 1` |
| Corrida no limite | `max: 5` | 20 `hit` simultâneos | Contagens de 1 a 20, cada uma uma vez; exatamente 15 com `limited: true` |
| Código entre instâncias | Dois servidores no mesmo banco (dois processos filhos) | `forgot` no A, `confirm` com senha nova no B | Senha trocada |
| Senha só depois do código | — | `forgot` com campo `password` | Campo ignorado; a senha só muda no `confirm` |
| Código de outra pessoa | Atacante pede código para `ana@` | Ana pede o dela e confirma com ele | Aceito; o pedido do atacante não mudou nada |
| Quatro códigos | 4 `issue` para o mesmo e-mail | `consume` com o 1º código | `null` (o mais antigo foi apagado) |
| Falhas de outro IP | 20 `confirm` errados para `ana@` vindos de vários IPs | Ana confirma com o código certo depois de 10 min | Aceito (os códigos não foram apagados) |
| Tentativas por IP | Código válido emitido | 5 `confirm` errados do mesmo IP, depois o certo do mesmo IP | O certo recebe 429 até a janela passar |
| Cadastro sobrevive ao deploy | Cadastro pedido | Reiniciar o servidor e confirmar | Conta criada |
| Chave obrigatória | `NODE_ENV=production`, sem `APP_SECRET` | Iniciar | Sai com código 1 e a mensagem |
| Transição do `secret.check` | `runtime/secret.check` com a chave A, `settings` vazio | Iniciar com a chave A | Inicia, e `settings.master-fingerprint` passa a existir |
| Chave trocada | Impressão digital da chave A no banco | Iniciar com a chave B | Recusa, como hoje |
| SMTP propagado | Duas instâncias, `SMTP_RELOAD_SECONDS=1` | Admin salva SMTP na A | Em até 2 s, `GET /api/auth/config` da B mostra `emailReset: true` |
| Auditoria registra | Admin desativa um usuário | `GET /api/audit` | Uma entrada `user.update` com `active: true → false`, sem hash em lugar nenhum |
| Auditoria restrita | Usuário comum | `GET /api/audit` | 403 |

## Critérios de aceite

- [ ] `grep -nE "new Map\(|createMemoryLimiter|setInterval" server.js` não devolve estado de segurança nem limpeza de `Map`.
- [ ] Duas instâncias no mesmo banco passam por um roteiro manual: 8 logins errados do mesmo IP alternando instâncias, e a 9ª tentativa recebe 429; código pedido numa instância e confirmado na outra funciona. Para o teste, `docker compose up --scale gerador-one=2` exige o serviço sem `container_name` e sem `ports` (o `ports` já sai na Fase 0).
- [ ] Os cenários acima passam, e a suíte inteira continua verde.
- [ ] Política de privacidade e FAQ mencionam o registro de auditoria.

## Reversão

- As migrações 8 a 10 são aditivas. Reverter o código deixa as tabelas sem uso.
- O PR 1-c é o único com efeito de inicialização: se algo der errado, `ALLOW_NEW_SECRET` **não** deve ser usado como saída. O caminho é reverter o commit, porque o `runtime/secret.check` continua no disco e o código antigo volta a lê-lo.
- Os códigos pendentes durante um deploy de reversão se perdem (voltam a ficar em memória). Impacto: quem estava no meio de uma recuperação pede um código novo.
