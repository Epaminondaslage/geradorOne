# Fase 0: segurança antes de expor à internet

## Objetivo

Abrir o GeradorOne num domínio público com HTTPS sem que um visitante consiga ler senhas em trânsito, forjar o próprio IP, descobrir quem tem conta, travar a conta de outra pessoa ou continuar usando uma sessão depois do logout.

## Estado atual

| Ponto | Onde | Comportamento hoje |
|---|---|---|
| Porta 8123 | `compose.yaml` e `compose.prod.yaml`, `ports: "8123:3000"` | Publicada em todas as interfaces do host, em HTTP |
| IP do cliente | `clientIp`, `server.js:115-117` | Usa o primeiro item de `X-Forwarded-For`, que o próprio cliente pode escrever |
| Login | `server.js:494-508` | Bloqueia por 15 min após 8 falhas na chave `email:<e-mail>`, de qualquer IP |
| Recuperação | `server.js:515-531` | Faz o hash da nova senha e envia o e-mail só quando a conta existe; resposta mais rápida quando não existe |
| Cadastro | `server.js:549-572` | Faz o hash e envia o e-mail só quando o e-mail ainda não está cadastrado; resposta mais rápida quando já está |
| Código de recuperação | `resets` (`Map`), `server.js:106,526-527` | Um código por e-mail; pedir de novo substitui o anterior, inclusive o de outra pessoa |
| Logout | `server.js:509-511` | Só apaga o cookie; o token continua válido por até 7 dias |
| Sessão | `issueSession`, `server.js:136-140` | Token `{uid, v, exp}` por 7 dias, sem renovação |
| Primeiro admin | `ensureAdmin`, `server.js:204-212` | Sem `ADMIN_PASSWORD`, gera uma senha e a imprime no log |
| Robôs | cadastro e recuperação | Só limites por e-mail e por IP (que é forjável) |
| Senhas fracas | `checkPassword`, `server.js:159-163` | Só tamanho de 8 a 200 caracteres |

## Desenho

### 0.1 Rede e HTTPS

- `compose.yaml` (Coolify): `ports: - "${LAN_BIND:-127.0.0.1}:8123:3000"`. O Traefik continua chegando ao contêiner pela rede `coolify`.
- `compose.prod.yaml`: a mesma linha. O README diz que a 8123 fica de propósito na rede local; quem quiser esse acesso define `LAN_BIND` com o IP da interface da LAN (por exemplo `10.0.0.20`), nunca `0.0.0.0`.
- `deploy/Caddyfile`: manter o HSTS e acrescentar `header -Server` e `header X-Content-Type-Options nosniff`. O app já manda CSP, `nosniff` e `Referrer-Policy` nos estáticos.
- Publicação na raiz do domínio: o Caddy já faz isso; no Coolify, trocar a regra `PathPrefix(/geradorone)` por `Host(<domínio>)` e remover os middlewares `redirect` e `strip`. O app já funciona com prefixo e sem prefixo (`cookiePath`, endereços relativos no frontend).

### 0.2 Proxy confiável (`TRUSTED_PROXY_HOPS`)

Nova regra para `clientIp(req)`:

1. Se `TRUSTED_PROXY_HOPS` for `0` (padrão), devolver `req.socket.remoteAddress` e ignorar `X-Forwarded-For`.
2. Se for `N ≥ 1`, separar `X-Forwarded-For` por vírgula, tirar espaços e devolver o item na posição `tamanho − N` (o endereço que o primeiro proxy confiável viu). Lista menor que `N` → `req.socket.remoteAddress`.
3. Normalizar IPv4 mapeado em IPv6 (`::ffff:1.2.3.4` → `1.2.3.4`) para a mesma pessoa não ter duas chaves.

Valores de produção: `TRUSTED_PROXY_HOPS=1` atrás do Caddy ou do Traefik. Os dois já substituem um `X-Forwarded-For` vindo de fora quando o remetente não está na lista de proxies confiáveis deles; o app passa a ler só o último item.

`X-Forwarded-Proto` e `X-Forwarded-Prefix` continuam sendo lidos como hoje: forjá-los não dá vantagem (o primeiro só liga o `Secure` do cookie; o segundo é validado por expressão regular).

### 0.3 Tempo igual em cadastro e recuperação

Objetivo: a resposta leva o mesmo tempo, com ou sem conta.

- **Cadastro** (`/api/auth/signup`): calcular `hashPassword(body.password)` **antes** de consultar se o e-mail existe. O envio do e-mail sai do caminho da resposta: `queueMicrotask` ou `setImmediate` com `catch` que só registra a falha. Na Fase 3 essa chamada vira um registro na `outbox_emails`.
- **Recuperação** (`/api/auth/forgot`): mesma regra. O hash é calculado sempre; o e-mail é enviado fora do caminho da resposta.
- **Confirmação** (`/api/auth/confirm` e `/api/auth/signup/confirm`): já respondem com a mesma mensagem genérica; nenhuma mudança.
- A mensagem de resposta continua idêntica nos dois ramos (já é assim).

### 0.4 Login sem travar a conta de terceiros

Trocar o bloqueio por e-mail por três camadas:

| Chave | Limite | Efeito |
|---|---|---|
| `login:ip:<ip>:<e-mail>` | 8 falhas em 15 min | Bloqueio (429) só desse IP para esse e-mail |
| `login:ip:<ip>` | 50 falhas em 15 min | Bloqueio (429) do IP para qualquer e-mail (tentativa em massa) |
| `login:email:<e-mail>` | conta falhas em 15 min, sem bloquear | A partir da 5ª falha, atraso antes de responder: 1 s, 2 s, 4 s, 8 s, teto de 16 s |

O atraso é um `await` de `setTimeout` antes de responder, não bloqueia o processo. O dono da conta continua conseguindo entrar, só que mais devagar, enquanto um atacante faz no máximo uns 60 palpites por 15 min por e-mail.

`/api/auth/delete-account` usa as mesmas chaves (hoje usa `loginLimiter` com `email:` e `ip:<ip>:<e-mail>`).

Nesta fase o limitador continua em memória; a Fase 1 o leva ao banco com a mesma interface.

### 0.5 Logout que invalida o token (migração 7)

```sql
CREATE TABLE revoked_sessions (
  sid uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX revoked_sessions_expires ON revoked_sessions (expires_at);
```

- `issueSession` passa a gerar `sid = crypto.randomUUID()` e assinar `{uid, v, sid, exp}`.
- `authenticate`: depois de validar a assinatura, uma consulta só:
  `SELECT <colunas de users> FROM users u WHERE u.id = $1 AND NOT EXISTS (SELECT 1 FROM revoked_sessions r WHERE r.sid = $2)`.
  Token sem `sid` (emitido antes desta versão) continua aceito até expirar; depois de 7 dias todos terão `sid`.
- `POST /api/auth/logout`: se houver token válido com `sid`, `INSERT INTO revoked_sessions (sid, user_id, expires_at) VALUES ($1, $2, to_timestamp($3 / 1000.0)) ON CONFLICT DO NOTHING`. A rota continua pública e responde 200 mesmo sem sessão.
- Limpeza: a cada hora, `DELETE FROM revoked_sessions WHERE expires_at < now()`. Com várias instâncias, cada uma pode rodar; a operação é idempotente.
- **Renovação deslizante** (resolve o item 5 dos achados do `CODEBASE_MAP.md`): quando faltar menos da metade do prazo (3,5 dias), `authenticate` sinaliza e a resposta leva um cookie novo com outro `sid`, revogando o anterior. Quem usa o app toda semana não é deslogado; quem some por 7 dias é.

### 0.6 Primeiro administrador sem senha no log

- Em `ensureAdmin`, com `NODE_ENV=production` e banco sem usuários: se `ADMIN_PASSWORD` faltar ou tiver menos de 8 caracteres, encerrar com `[erro] Defina ADMIN_PASSWORD no .env (mínimo de 8 caracteres) para criar o primeiro administrador.`
- Fora de produção, o comportamento atual continua (senha gerada e impressa).
- Instalações que já têm usuários não são afetadas: `ensureAdmin` sai antes, na contagem.

### 0.7 Prova de trabalho no cadastro e na recuperação

Sem serviço de terceiros e sem dependência nova. O navegador resolve um desafio de hash que custa cerca de 1 segundo; um robô que queira mil cadastros paga mil segundos de CPU.

- `GET /api/auth/challenge` (pública, sem estado): devolve
  ```json
  { "algorithm": "SHA-256", "salt": "<16 bytes hex>.<expira em ms>", "challenge": "<hex>", "maxnumber": 50000, "signature": "<hex>" }
  ```
  `challenge = sha256(salt + número secreto)`, com o número sorteado entre 0 e `POW_DIFFICULTY`; `signature = HMAC(chave derivada 'pow', challenge)`. Expira em 5 minutos.
- O navegador testa números de 0 a `maxnumber` até achar o que gera o `challenge`, num Web Worker (`public/pow-worker.js`, servido de `'self'`, permitido pela CSP atual), e envia `pow: {salt, challenge, number, signature}` junto com o cadastro ou a recuperação.
- O servidor confere: assinatura válida, não expirado, `sha256(salt + number) === challenge`, e desafio ainda não usado (chave `pow:<signature>` no limitador, máximo 1; na Fase 1 isso vai para `rate_limits`).
- Falha → 400 `Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.`
- `POW_DIFFICULTY=0` desliga a exigência (testes e instalações internas).

### 0.8 Senhas vazadas

- `lib/password-policy.js` (novo) exporta `checkPasswordStrength(password, {email, name})` que lança erro 400 com motivo.
- Regras: tamanho de 8 a 200 (como hoje); não pode estar na lista local das 10 mil senhas mais comuns (`lib/data/senhas-comuns.txt`, cerca de 80 KB, carregada uma vez em um `Set`, comparação em minúsculas); não pode conter o e-mail antes do `@` nem o primeiro nome.
- `PASSWORD_BREACH_CHECK=hibp` acrescenta a consulta `GET https://api.pwnedpasswords.com/range/<5 primeiros do SHA-1>` com 2 s de limite. Falha de rede deixa passar (não impede o cadastro por causa de um serviço externo).
- Vale onde a pessoa escolhe a senha: cadastro, troca de senha, recuperação. Senhas temporárias de administrador continuam só com tamanho mínimo, porque a troca é obrigatória no primeiro acesso.
- Mensagem: `Essa senha aparece em listas de senhas vazadas ou é fácil de adivinhar. Escolha outra.`

### 0.9 Código de recuperação substituído

Fica para a Fase 1, onde a tabela `pending_codes` aceita vários códigos por e-mail. Nesta fase nada muda, e o risco segue limitado a 5 pedidos por 15 min.

## Sequência de entrega

| PR | Conteúdo | Arquivos |
|---|---|---|
| 0-a | Porta 8123 com `LAN_BIND`, cabeçalhos no Caddy, regra do Traefik por domínio | `compose.yaml`, `compose.prod.yaml`, `deploy/Caddyfile`, README |
| 0-b | `TRUSTED_PROXY_HOPS` em `clientIp` | `server.js`, `test/auth.test.js` |
| 0-c | Tempo igual em cadastro e recuperação; envio de e-mail fora da resposta | `server.js`, `test/auth.test.js` |
| 0-d | Login em três camadas | `server.js`, `test/auth.test.js` |
| 0-e | Migração 7, `sid` no token, logout que revoga, renovação deslizante | `lib/db.js`, `lib/crypto.js`, `server.js`, `test/store.test.js`, `test/auth.test.js` |
| 0-f | `ADMIN_PASSWORD` obrigatória em produção | `server.js`, README, `test/secret.test.js` (sobe o servidor como processo) |
| 0-g | Prova de trabalho | `server.js`, `lib/crypto.js`, `public/pow-worker.js`, `public/app.js`, `test/auth.test.js` |
| 0-h | Política de senha | `lib/password-policy.js`, `lib/data/senhas-comuns.txt`, `server.js`, `public/faq-data.js`, testes |

## Testes

| Cenário | Dado | Quando | Então |
|---|---|---|---|
| IP forjado ignorado | `TRUSTED_PROXY_HOPS=0` | 9 logins errados com `X-Forwarded-For` diferente em cada | O 9º recebe 429 (todos contam no mesmo IP real) |
| IP atrás do proxy | `TRUSTED_PROXY_HOPS=1` | `X-Forwarded-For: 6.6.6.6, 10.0.0.5` | A chave usa `10.0.0.5` |
| Cadastro sem pista | SMTP com transporte que demora 500 ms | Cadastro com e-mail novo e com e-mail existente | As duas respostas chegam em menos de 300 ms e têm o mesmo corpo |
| Recuperação sem pista | Igual ao anterior | `forgot` com e-mail existente e inexistente | Mesmo corpo, as duas abaixo de 300 ms |
| Conta não trava | 8 falhas de `ip A` para `ana@` | Ana entra do `ip B` com a senha certa | 200 (com atraso), não 429 |
| Bloqueio por par | 8 falhas de `ip A` para `ana@` | 9ª tentativa de `ip A` | 429 |
| Bloqueio em massa | 50 falhas de `ip A` em e-mails diferentes | Nova tentativa de `ip A` | 429 |
| Logout revoga | Sessão ativa, cookie guardado | `logout`, depois `GET /api/auth/me` com o cookie antigo | 401 |
| Token antigo aceito | Token assinado sem `sid` | `GET /api/auth/me` | 200 até `exp` |
| Renovação | Token com `exp` a 3 dias | `GET /api/auth/me` | Resposta traz `Set-Cookie` novo; o `sid` anterior fica revogado |
| Admin sem senha | `NODE_ENV=production`, banco vazio, sem `ADMIN_PASSWORD` | Iniciar o servidor | Processo sai com código 1 e a mensagem; nada no log com senha |
| Desafio válido | `POW_DIFFICULTY=100` | Cadastro com desafio resolvido | 200 |
| Desafio reusado | Mesmo desafio já usado | Segundo cadastro | 400 |
| Desafio expirado | `salt` com expiração no passado | Cadastro | 400 |
| Senha comum | Lista local carregada | Cadastro com `12345678` | 400 com a mensagem de senha vazada |
| HIBP fora do ar | `PASSWORD_BREACH_CHECK=hibp`, rede falhando | Cadastro com senha boa | 200 |

Testes que medem tempo usam folga larga (300 ms contra 500 ms do transporte lento) para não oscilar na CI.

## Critérios de aceite

- [ ] `curl http://<IP público>:8123` não conecta; `https://<domínio>` responde com HSTS.
- [ ] Os 16 cenários acima passam, e a suíte inteira continua verde.
- [ ] `grep -n "x-forwarded-for" server.js` aparece só dentro de `clientIp`.
- [ ] FAQ e README atualizados: prova de trabalho, regra de senha, `TRUSTED_PROXY_HOPS`, `LAN_BIND`, `ADMIN_PASSWORD`.

## Reversão

- Cada PR é independente; reverter o commit desfaz o item sem afetar os outros.
- A migração 7 é aditiva. Voltar o código para antes de 0-e deixa a tabela sem uso, sem quebrar nada; tokens com `sid` continuam aceitos pelo código antigo, que ignora campos desconhecidos.
- `POW_DIFFICULTY=0` e `PASSWORD_BREACH_CHECK=off` desligam os dois controles sem novo deploy de código.
