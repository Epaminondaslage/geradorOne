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

Regra: **o contêiner do app não publica porta nenhuma no host.** Só o proxy chega até ele, pela rede do Docker. Isso é o que torna seguro confiar no `X-Forwarded-For` do item 0.2: se a porta do app ficasse aberta na LAN, qualquer um na rede mandaria o cabeçalho que quisesse.

- `compose.prod.yaml`: remover `ports` do serviço `gerador-one`. O acesso pela rede local, que o README descreve como intencional, passa a ser feito pelo Caddy, num segundo bloco do `Caddyfile`:
  ```text
  http://:8123 {
  	reverse_proxy gerador-one:3000
  }
  ```
  publicado em `"${LAN_BIND:-127.0.0.1}:8123:8123"` no serviço `caddy`. Quem quiser o acesso pela LAN define `LAN_BIND` com o IP da interface da LAN (por exemplo `10.0.0.20`), nunca `0.0.0.0`, e o roteador não encaminha essa porta.
- `compose.yaml` (Coolify): remover `ports` do serviço. O Traefik chega pela rede `coolify`. Rótulos novos:
  - roteador `geradorone` no entrypoint `https`, regra `Host(<domínio>)`, `tls.certresolver=letsencrypt` (o nome do resolvedor configurado no Coolify) e middleware `geradorone-headers` com `stsSeconds=31536000`;
  - roteador `geradorone-http` no entrypoint `http`, mesma regra, só com o middleware `redirectscheme` para `https`;
  - remover os middlewares `geradorone-redirect` e `geradorone-strip`, que existiam só para o prefixo `/geradorone`.
- `deploy/Caddyfile`: manter o HSTS e acrescentar `header -Server`. O app já manda CSP, `nosniff` e `Referrer-Policy`.
- **Enquanto os servidores não tiverem internet**, o Let's Encrypt não emite certificado. A saída é `tls internal` no bloco do domínio interno: o Caddy cria uma autoridade certificadora própria, e o certificado raiz dela (`/data/caddy/pki/authorities/local/root.crt` no volume `caddy_data`) é instalado nos computadores e celulares da rede. O HSTS só é ligado depois disso, para não travar o acesso de quem ainda não tem o certificado raiz. Abrir ao público continua exigindo internet e domínio (ver "Servidores sem internet" no README das especificações).
- O app já funciona com prefixo e sem prefixo (`cookiePath`, endereços relativos no frontend), então publicar na raiz não muda código.

### 0.2 Proxy confiável (`TRUSTED_PROXY_HOPS`)

Nova regra para `clientIp(req)`:

1. Se `TRUSTED_PROXY_HOPS` for `0` (padrão), devolver `req.socket.remoteAddress` e ignorar `X-Forwarded-For`.
2. Se for `N ≥ 1`, separar `X-Forwarded-For` por vírgula, tirar espaços e devolver o item na posição `tamanho − N` (o endereço que o primeiro proxy confiável viu). Lista menor que `N` → `req.socket.remoteAddress`.
3. Normalizar IPv4 mapeado em IPv6 (`::ffff:1.2.3.4` → `1.2.3.4`) para a mesma pessoa não ter duas chaves.

Valores de produção: `TRUSTED_PROXY_HOPS=1` atrás do Caddy ou do Traefik. Os dois já substituem um `X-Forwarded-For` vindo de fora quando o remetente não está na lista de proxies confiáveis deles; o app passa a ler só o último item.

A regra só é segura porque, com o item 0.1, nada chega ao app sem passar pelo proxy. Se um dia a porta do app voltar a ser publicada, `TRUSTED_PROXY_HOPS` precisa voltar a `0`. O PR 0-a e o 0-b entram juntos por esse motivo.

`X-Forwarded-Proto` e `X-Forwarded-Prefix` continuam sendo lidos como hoje: forjá-los não dá vantagem (o primeiro só liga o `Secure` do cookie; o segundo é validado por expressão regular).

### 0.3 Tempo igual em cadastro e recuperação

Objetivo: a resposta leva o mesmo tempo, com ou sem conta.

- **Cadastro** (`/api/auth/signup`): calcular `hashPassword(body.password)` **antes** de consultar se o e-mail existe. O envio do e-mail sai do caminho da resposta: `queueMicrotask` ou `setImmediate` com `catch` que só registra a falha. Na Fase 3 essa chamada vira um registro na `outbox_emails`.
- **Recuperação** (`/api/auth/forgot`): mesma regra. O hash é calculado sempre; o e-mail é enviado fora do caminho da resposta.
- **Confirmação** (`/api/auth/confirm` e `/api/auth/signup/confirm`): já respondem com a mesma mensagem genérica; nenhuma mudança.
- A mensagem de resposta continua idêntica nos dois ramos (já é assim).

### 0.4 Login sem travar a conta de terceiros

Trocar o bloqueio por e-mail por quatro camadas. Cada camada é um limitador com nome próprio (ver "Limitadores" no README das especificações):

| Limitador | Chave | Limite | Efeito |
|---|---|---|---|
| `login-par` | `<ip>:<e-mail>` | 8 em 15 min | A 9ª tentativa desse IP para esse e-mail recebe 429 |
| `login-ip` | `<ip>` | 50 em 15 min | A 51ª tentativa do IP, para qualquer e-mail, recebe 429 (tentativa em massa) |
| `login-email` | `<e-mail>` | 5 em 15 min sem efeito; da 6ª à 30ª, atraso | Atraso antes de responder: 1 s, 2 s, 4 s, 8 s, teto de 8 s |
| `login-email` | `<e-mail>` | acima de 30 em 15 min | Exige prova de trabalho (item 0.7) para esse e-mail, em vez de bloquear |

- A conta da pessoa nunca fica bloqueada: acima do teto ela entra resolvendo a prova de trabalho, que o navegador faz sozinho em cerca de 1 segundo. Um ataque distribuído em muitos IPs fica limitado pelo custo da prova, não pelo atraso, que sozinho não segura requisições em paralelo.
- O atraso segura um socket por até 8 s. Para não virar um amplificador de negação de serviço, há um teto global de 200 respostas em espera; acima dele, 429 sem esperar.
- **Contagem antes do trabalho.** Cada tentativa chama `hit()` primeiro e compara a contagem devolvida com o limite, antes de fazer o scrypt. Login certo zera `login-par` e `login-email`. Hoje o código consulta `blocked()`, faz o trabalho e só depois chama `hit()` (`server.js:499-504`); com várias requisições em paralelo, todas passariam pela consulta antes de qualquer registro.
- `/api/auth/delete-account` usa `login-par` e `login-email` (hoje usa `loginLimiter` com `email:` e `ip:<ip>:<e-mail>`).

Nesta fase o limitador continua em memória; a Fase 1 o leva ao banco com a mesma interface.

### 0.5 Logout que invalida o token (migração 7)

```sql
CREATE TABLE revoked_sessions (
  sid uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX revoked_sessions_expires ON revoked_sessions (expires_at);
```

Sem chave estrangeira em `user_id` de propósito: o logout de uma conta que acabou de ser excluída não pode falhar, e a linha some sozinha em até 7 dias.

- `issueSession` passa a gerar `sid = crypto.randomUUID()` e assinar `{uid, v, sid, exp}`.
- `authenticate`: depois de validar a assinatura, uma consulta só:
  `SELECT <colunas de users> FROM users u WHERE u.id = $1 AND NOT EXISTS (SELECT 1 FROM revoked_sessions r WHERE r.sid = $2)`.
  Token sem `sid` (emitido antes desta versão) continua aceito até expirar; depois de 7 dias todos terão `sid`.
- `POST /api/auth/logout`: se houver token válido com `sid`, `INSERT INTO revoked_sessions (sid, user_id, expires_at) VALUES ($1, $2, to_timestamp($3 / 1000.0)) ON CONFLICT DO NOTHING`. A rota continua pública e responde 200 mesmo sem sessão.
- Limpeza: a cada hora, `DELETE FROM revoked_sessions WHERE expires_at < now()`. Com várias instâncias, cada uma pode rodar; a operação é idempotente.
- **Renovação deslizante** (resolve o item 5 dos achados do `CODEBASE_MAP.md`): quando faltar menos da metade do prazo (3,5 dias), `authenticate` sinaliza e a resposta leva um cookie novo com outro `sid`. O token anterior **não** é revogado: outras abas e requisições em andamento ainda o carregam, e revogá-lo daria 401 nelas. Ele expira sozinho. Quem usa o app toda semana não é deslogado; quem some por 7 dias é.
- Tokens com o campo `purpose` (como o token curto de duas etapas da Fase 5) são recusados por `authenticate`, que só aceita tokens de sessão.

### 0.6 Primeiro administrador sem senha no log

- Em `ensureAdmin`, com `NODE_ENV=production` e banco sem usuários: se `ADMIN_PASSWORD` faltar ou tiver menos de 8 caracteres, encerrar com `[erro] Defina ADMIN_PASSWORD no .env (mínimo de 8 caracteres) para criar o primeiro administrador.`
- Fora de produção, o comportamento atual continua (senha gerada e impressa).
- Instalações que já têm usuários não são afetadas: `ensureAdmin` sai antes, na contagem.

### 0.7 Prova de trabalho no cadastro e na recuperação

Sem serviço de terceiros e sem dependência nova. O navegador resolve um desafio de hash que custa cerca de 1 segundo num celular médio.

Isso é **atrito, não barreira**: um robô com código nativo resolve o mesmo desafio em milissegundos. O que a prova de trabalho faz é encarecer ataques em massa feitos com navegador automatizado e tirar do caminho scripts simples. A barreira de verdade continua sendo o limitador e a confirmação por e-mail.

- `POW_DIFFICULTY` (número máximo do desafio) é calibrado medindo o tempo no navegador: começa em `300000` e se ajusta para a mediana ficar perto de 1 segundo num celular de entrada.
- `GET /api/auth/challenge` (pública, sem estado; entra na lista de rotas públicas antes de `authenticate`, `server.js:711-714`): devolve
  ```json
  { "algorithm": "SHA-256", "salt": "<16 bytes hex>.<expira em ms>", "challenge": "<hex>", "maxnumber": 50000, "signature": "<hex>" }
  ```
  `challenge = sha256(salt + número secreto)`, com o número sorteado entre 0 e `POW_DIFFICULTY`; `signature = HMAC(chave derivada 'pow', challenge)`. Expira em 5 minutos.
- O navegador testa números de 0 a `maxnumber` até achar o que gera o `challenge`, num Web Worker (`public/pow-worker.js`, servido de `'self'`, permitido pela CSP atual), e envia `pow: {salt, challenge, number, signature}` junto com o cadastro, a recuperação ou o login acima do teto do item 0.4.
- `crypto.subtle` só existe em contexto seguro (HTTPS ou `localhost`). O acesso pela LAN em `http://<IP>:8123` não é contexto seguro, então o `pow-worker.js` traz um SHA-256 em JavaScript puro como reserva, usado quando `crypto.subtle` não existe.
- O servidor confere: assinatura válida, não expirado, `sha256(salt + number) === challenge`, e desafio ainda não usado. O "não usado" é um `hit()` no limitador `pow` com chave `<signature>`: só aceita quando a contagem devolvida for 1, o que impede duas requisições em paralelo com a mesma solução. Na Fase 1 isso vai para `rate_limits`.
- Falha → 400 `Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.`
- `POW_DIFFICULTY=0` desliga a exigência (testes e instalações internas).

### 0.8 Senhas vazadas

- `lib/password-policy.js` (novo) exporta `checkPasswordStrength(password, {email, name})` que lança erro 400 com motivo.
- Regras: tamanho de 8 a 200 (como hoje); não pode estar na lista local das 10 mil senhas mais comuns (`lib/data/senhas-comuns.txt`, cerca de 80 KB, carregada uma vez em um `Set`, comparação em minúsculas); não pode conter a parte do e-mail antes do `@` nem o primeiro nome.
- Os dados para a comparação vêm **só do que a pessoa enviou na própria requisição**, nunca da conta encontrada no banco. No cadastro, `name` e `email` do corpo. Na troca de senha, os dados da sessão (a pessoa já está autenticada). Na recuperação, só o `email` do corpo: usar o nome da conta encontrada faria o erro aparecer apenas quando a conta existe, revelando quem está cadastrado.
- `PASSWORD_BREACH_CHECK=hibp` acrescenta a consulta `GET https://api.pwnedpasswords.com/range/<5 primeiros do SHA-1>` com 2 s de limite. Falha de rede deixa passar (não impede o cadastro por causa de um serviço externo).
- Vale onde a pessoa escolhe a senha: cadastro, troca de senha, recuperação. Senhas temporárias de administrador continuam só com tamanho mínimo, porque a troca é obrigatória no primeiro acesso.
- Mensagem: `Essa senha aparece em listas de senhas vazadas ou é fácil de adivinhar. Escolha outra.`

### 0.9 Código de recuperação substituído

Fica para a Fase 1, que muda o fluxo da recuperação (a nova senha passa a ser escolhida depois do código) e guarda os códigos no banco. Nesta fase nada muda, e o risco segue limitado a 5 pedidos por 15 min.

## Sequência de entrega

| PR | Conteúdo | Arquivos |
|---|---|---|
| 0-a + 0-b | App sem porta publicada, acesso LAN pelo Caddy com `LAN_BIND`, HTTPS e HSTS no Traefik, `TRUSTED_PROXY_HOPS` em `clientIp`. Entram juntos (item 0.2) | `compose.yaml`, `compose.prod.yaml`, `deploy/Caddyfile`, `server.js`, `test/auth.test.js`, README |
| 0-c | Tempo igual em cadastro e recuperação; envio de e-mail fora da resposta | `server.js`, `test/auth.test.js` |
| 0-d | Login com os limitadores por par, por IP e por e-mail; tentativa registrada antes do scrypt | `server.js`, `test/auth.test.js` |
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
| Teto por e-mail | 30 falhas para `ana@` vindas de 30 IPs | Ana tenta com a senha certa sem prova de trabalho | 400 pedindo a prova; com a prova resolvida, 200 |
| Corrida no limite | 20 logins errados em paralelo do mesmo IP para `ana@` | Todos chegam juntos | No máximo 8 passam do limitador; o resto recebe 429 antes do scrypt |
| Logout de conta excluída | Conta excluída, cookie ainda guardado | `logout` | 200 |
| Logout revoga | Sessão ativa, cookie guardado | `logout`, depois `GET /api/auth/me` com o cookie antigo | 401 |
| Token antigo aceito | Token assinado sem `sid` | `GET /api/auth/me` | 200 até `exp` |
| Renovação | Token com `exp` a 3 dias | `GET /api/auth/me` | Resposta traz `Set-Cookie` novo; o token anterior continua aceito até expirar |
| Token com `purpose` | Token assinado com `purpose: '2fa'` | Usado como cookie de sessão | 401 |
| Admin sem senha | `NODE_ENV=production`, banco vazio, sem `ADMIN_PASSWORD` | Iniciar o servidor | Processo sai com código 1 e a mensagem; nada no log com senha |
| Desafio válido | `POW_DIFFICULTY=100` | Cadastro com desafio resolvido | 200 |
| Desafio reusado | Mesmo desafio já usado | Segundo cadastro | 400 |
| Desafio em paralelo | Mesma solução | Dois cadastros simultâneos | Só um é aceito |
| Senha com o nome na recuperação | Conta de `ana@` com nome Ana | `forgot` com senha `ana12345` para `ana@` e para um e-mail inexistente | As duas respostas são iguais (a regra do nome não é aplicada na recuperação) |
| Desafio expirado | `salt` com expiração no passado | Cadastro | 400 |
| Senha comum | Lista local carregada | Cadastro com `12345678` | 400 com a mensagem de senha vazada |
| HIBP fora do ar | `PASSWORD_BREACH_CHECK=hibp`, rede falhando | Cadastro com senha boa | 200 |

Testes que medem tempo usam folga larga (300 ms contra 500 ms do transporte lento) para não oscilar na CI.

## Critérios de aceite

- [ ] `curl http://<IP público>:8123` não conecta; `https://<domínio>` responde com HSTS, tanto pelo Caddy quanto pelo Traefik do Coolify; `http://<domínio>` redireciona para `https`.
- [ ] `docker compose ps` não mostra porta publicada no serviço do app.
- [ ] Os cenários acima passam, e a suíte inteira continua verde.
- [ ] `grep -n "x-forwarded-for" server.js` aparece só dentro de `clientIp`.
- [ ] FAQ e README atualizados: prova de trabalho, regra de senha, `TRUSTED_PROXY_HOPS`, `LAN_BIND`, `ADMIN_PASSWORD`.

## Reversão

- Cada PR é independente; reverter o commit desfaz o item sem afetar os outros.
- A migração 7 é aditiva. Voltar o código para antes de 0-e deixa a tabela sem uso, sem quebrar nada; tokens com `sid` continuam aceitos pelo código antigo, que ignora campos desconhecidos.
- `POW_DIFFICULTY=0` e `PASSWORD_BREACH_CHECK=off` desligam os dois controles sem novo deploy de código.
