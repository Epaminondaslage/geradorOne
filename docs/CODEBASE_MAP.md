---
last_mapped: 2026-10-23T03:06:30Z
total_files: 33
total_tokens: 83516
---

# Mapa do código do GeradorOne

> Gerado pelo Cartographer em 23/10/2026 (03:06 UTC) e revisado à mão. Os números contam só os arquivos do projeto: ficam de fora `.agents/`, `.claude/`, `.remember/` (ferramentas), `docs/exemplos/`, `docs/branding/` e o `package-lock.json`.

## Visão geral

Aplicativo web em Node.js 22 (sem framework, sem etapa de build) que gera prompts de imagem para materiais didáticos (apostilas e capas) e, opcionalmente, chama uma IA (OpenAI ou Gemini) para gerar o material. Tem login por e-mail e senha, perfis admin e usuário, projetos salvos por usuário e a chave de IA de cada pessoa (BYOK) cifrada no servidor.

```mermaid
graph TB
    subgraph Navegador
        UI[public/index.html + app.js<br/>JS puro, sem módulos]
    end
    subgraph Proxy
        T[Traefik / Coolify<br/>/geradorone e porta 8123]
    end
    subgraph App["Contêiner gerador-one (Node 22, usuário node, somente leitura)"]
        S[server.js<br/>node:http]
        L[lib/*<br/>db, users, projects, crypto, mailer...]
        C[Chromium<br/>HTML para PDF]
    end
    subgraph Dados
        PG[(Postgres 17<br/>contêiner gerador-one-db<br/>rede interna)]
        RT[runtime/<br/>secret.check]
        ENV[.env<br/>APP_SECRET, POSTGRES_PASSWORD, SMTP]
    end
    subgraph Externos
        AI[OpenAI / Gemini<br/>chave de cada usuário]
        SMTP[Zimbra SMTP]
    end
    UI --> T --> S
    S --> L
    L --> PG
    S --> RT
    S --> C
    S --> AI
    S --> SMTP
    ENV -.variáveis.-> S
```

## Estrutura de pastas

```text
.
├── server.js                 # servidor HTTP, rotas /api, sessão, IA, PDF (~670 linhas)
├── lib/
│   ├── db.js                 # Pool do pg, transações, migrações versionadas com trava
│   ├── users.js              # armazenamento e validação de usuários (Postgres)
│   ├── projects.js           # armazenamento de projetos por dono + validateProject
│   ├── legacy-import.js      # importa os JSONs antigos uma única vez
│   ├── crypto.js             # scrypt, AES-256-GCM, HKDF, token de sessão, códigos
│   ├── secret-check.js       # impressão digital da chave mestra (recusa iniciar se mudar)
│   ├── mailer.js             # nodemailer: envio dos e-mails; setConfig troca o SMTP sem reiniciar e setBrand define endereço e contato do rodapé
│   ├── legal.js              # LEGAL_VERSION: versão vigente dos Termos e da Política (mudar a data exige novo aceite de todos)
│   ├── support.js            # validação da mensagem e dos anexos, protocolo e tabela support_messages
│   ├── email-template.js     # modelo HTML (tabelas e estilos inline) e texto puro dos e-mails; logotipo embutido por cid
│   └── rate-limit.js         # limitador em memória (janela deslizante)
├── scripts/
│   ├── reset-password.js     # senha temporária de emergência (docker exec)
│   ├── test-smtp.js          # testa o SMTP (--verify só conecta e autentica)
│   ├── backup-db.sh          # pg_dump comprimido, rotação de 14 dias
│   ├── build-bncc-data.js    # converte o clone de bncc-dev/bncc-dados em public/data/bncc.json (com checagens de contagem)
│   └── run-tests.js          # sobe um Postgres descartável e roda a suíte
├── public/                   # frontend estático servido com CSP restrita
│   ├── index.html            # tela de login + app (menu, páginas, painel de resultado)
│   ├── app.js                # toda a lógica do navegador (~1.330 linhas)
│   ├── app.css               # shell, menu, painel de resultado, login, páginas novas
│   ├── theme.css             # componentes compartilhados (herança do desenho antigo)
│   ├── design.css            # identidade: tokens dos 6 temas, fontes, acabamento (ver docs/DESIGN.md)
│   ├── style-art.js          # miniaturas SVG dos 12 estilos de ilustração (window.styleArt)
│   ├── fonts/                # Literata e Atkinson Hyperlegible Next (woff2, SIL OFL)
│   ├── styles.css            # base legada minificada (ainda necessária)
│   └── assets/icons/         # PNGs dos recursos, logo (mapa-mental.png) e favicon
├── test/                     # node:test contra Postgres real (ver "Testes")
├── docs/
│   ├── ROADMAP.md            # caminho até virar SaaS
│   ├── CODEBASE_MAP.md       # este arquivo
│   ├── exemplos/             # um prompt de exemplo por modelo (aguardando as imagens)
│   └── branding/             # foto original do logotipo
├── Dockerfile, compose.yaml  # app + db, redes, volumes, rótulos do Traefik
├── PROJECT_MEMORY.md         # identidade, regras e operação
└── CLAUDE.md                 # orientações para agentes
```

## Backend

### `server.js`

Único ponto de entrada. Carrega a chave mestra, cria o pool do banco e os armazenamentos, e só escuta quando executado diretamente (`require.main === module`), o que permite os testes importarem as funções.

| Bloco | O que faz |
|---|---|
| `handleRequest` | Converte a URL (400 se inválida), manda `/api/*` para `handleApi` e serve arquivos de `public/` com CSP, `nosniff` e `Referrer-Policy`. Qualquer erro vira 500, sem derrubar o processo. |
| `handleApi` | Ordem de guardas: saúde pública, verificação de origem em métodos que não são GET, rotas públicas de autenticação, sessão, troca de senha obrigatória, e então usuários (admin) ou rotas do app. |
| Sessão | Cookie `g1_session` (HttpOnly, SameSite=Lax, `Secure` com HTTPS, caminho vindo de `X-Forwarded-Prefix`). Token assinado `{uid, v, exp}`; `v` é a versão da senha. |
| IA | `aiConfigFor(user)` decifra a chave do usuário. Texto, imagem e "melhorar prompt" para OpenAI e Gemini; a Anthropic (`requestAnthropicText`, `POST https://api.anthropic.com/v1/messages`, cabeçalho `anthropic-version: 2026-10-21`) só faz texto, e `/api/generate` recusa pedido com imagens para ela. Todos com tempo limite. |
| PDF e HTML | `renderPdf` (pdfkit, só do prompt), `renderDocument` (prévia), `cleanGeneratedHtml` (sanitizador), `embedImages`, `htmlToPdf` (Chromium). |

### Rotas da API

| Método | Caminho | Acesso | Função |
|---|---|---|---|
| GET | `/api/health` | público | `{ok, db}`; 503 se o banco não responde |
| POST | `/api/auth/login` | público | Entrar; erro genérico; 429 após 8 falhas em 15 min |
| POST | `/api/auth/logout` | público | Apaga o cookie |
| GET | `/api/auth/config` | público | `{emailReset, signup}` (mostram "Esqueci minha senha" e "Criar conta"; ambos dependem do SMTP) |
| POST | `/api/auth/forgot` | público | Guarda código e nova senha pendentes e envia o e-mail; resposta sempre genérica |
| POST | `/api/auth/confirm` | público | Confere o código (5 tentativas, 10 min) e aplica a senha |
| POST | `/api/auth/signup` | público | Autocadastro: valida nome, e-mail e senha, guarda o pedido na memória e envia código de 6 dígitos; resposta sempre genérica (e-mail já cadastrado não recebe código); 503 sem SMTP |
| POST | `/api/auth/signup/confirm` | público | Confere o código (5 tentativas, 10 min), cria o usuário com perfil `user` sem troca obrigatória de senha e abre a sessão |
| GET/PUT/DELETE | `/api/settings/smtp` | admin | Ler, salvar (senha cifrada com a chave BYOK; em branco mantém a atual) e remover a configuração de SMTP do painel; vale na hora e tem prioridade sobre o `.env`; DELETE volta ao `.env` |
| POST | `/api/settings/smtp/test` | admin | Verifica a conexão e envia e-mail de teste |
| GET | `/api/auth/me` | sessão | Usuário atual |
| POST | `/api/auth/change-password` | sessão | Troca a senha e emite sessão nova |
| POST | `/api/auth/profile` | sessão | Nome e telefone (telefone obrigatório) |
| GET | `/api/auth/export` | sessão | Baixa um JSON (`Content-Disposition: attachment`) com a conta, as preferências de IA (sem o valor da chave) e todos os projetos do usuário; nunca inclui hash de senha |
| POST | `/api/auth/accept-terms` | sessão | Registra o aceite (`{accept: true}`): grava `terms_version` = `LEGAL_VERSION` e `terms_accepted_at`, sem mexer em `pwd_version` (não derruba sessões). `userView` devolve `termsCurrent` e `legalVersion`; o frontend bloqueia o app (painel `terms`) enquanto `termsCurrent` for falso |
| POST | `/api/support` | sessão | "Fale com o suporte": valida tipo, texto (5 a 2.000), e-mail e anexos (até 5, 5 MB cada, 8 MB no total, conferindo extensão e primeiros bytes), guarda em `support_messages`, envia ao `mailer.supportAddress()` com `replyTo` na pessoa e manda a confirmação com protocolo. Corpo de até 12 MB só nesta rota; 5 por hora por conta (429); campo isca `site` devolve sucesso sem enviar |
| POST | `/api/auth/delete-account` | sessão | Exclui a própria conta. Exige a senha atual (erros contam no limite de login); 409 se for o único administrador ativo; apaga os projetos em cascata, devolve `removedProjects` e limpa o cookie |
| POST | `/api/auth/theme` | sessão | Tema de cores da conta (`papel`, `grafite`, `lousa`, `azul-tinta`, `sepia`, `alto-contraste`; vazio = seguir o sistema) |
| GET/POST | `/api/users` | admin | Listar e criar (senha e telefone obrigatórios) |
| PUT/DELETE | `/api/users/:id` | admin | Editar e excluir; nunca deixa sem administrador ativo |
| POST | `/api/users/:id/reset-password` | admin | Senha temporária, troca obrigatória |
| GET | `/api/ai/status` | sessão | A IA está disponível para este usuário? |
| GET/POST | `/api/ai/config` | sessão | Provedor, modelos e chave (BYOK); nunca devolve a chave |
| POST | `/api/render` | sessão | Prévia HTML do prompt |
| POST | `/api/pdf` | sessão | PDF do prompt (pdfkit) |
| GET/POST | `/api/projects` | sessão | Listar e salvar (id alheio cria outro projeto) |
| GET/DELETE | `/api/projects/:id` | sessão | Abrir e excluir (só do dono) |
| POST | `/api/improve` | sessão | Reescreve o prompt com a IA do usuário |
| POST | `/api/generate` | sessão | Gera HTML ou PDF com imagens opcionais |

Com `mustChangePassword`, só `/api/auth/me`, `change-password` e `logout` funcionam; o resto responde 403 com `code: PASSWORD_CHANGE_REQUIRED`.

### Banco de dados (`lib/db.js`)

Migração 1 (`usuarios-e-projetos`), aplicada sozinha na inicialização:

- `users`: `id uuid`, `name`, `email` (único, minúsculo), `phone`, `role` (`admin`/`user`), `active`, `password_hash`, `must_change_password`, `pwd_version`, `ai jsonb`, `theme` (vazio até escolher), `created_at`, `updated_at`.
- `projects`: `id uuid`, `owner_id` (cascata ao excluir o usuário), `name`, `kind` (`apostila`/`capa`), `settings jsonb`, `prompt`, `created_at`, `updated_at`; índice `(owner_id, updated_at DESC)`.
- `users.ai`: `{provider, keyEnc, model, imageModel}`; `keyEnc` tem o formato `v1.<iv>.<tag>.<texto>` (AES-256-GCM, chave derivada por HKDF com o propósito `byok`).
- Novas mudanças de esquema entram como novas versões em `MIGRATIONS`.

### Módulos de `lib/`

| Arquivo | Pontos principais |
|---|---|
| `users.js` | Normaliza e-mail e telefone (10 a 13 dígitos). `update` roda em transação com `FOR UPDATE` e soma 1 em `pwd_version` quando muda senha, e-mail, perfil ou situação (derruba as sessões). `publicUser` esconde o hash e a chave. |
| `projects.js` | `save` usa trava consultiva por dono, atualiza só se o projeto for do usuário, e limita 500 projetos por pessoa. `validateProject` filtra campos e tamanhos. |
| `crypto.js` | scrypt (N=16384, r=8, p=1) com comparação em tempo constante e `verifyDummy` para e-mails inexistentes; AES-256-GCM; `loadMasterSecret` (APP_SECRET, ou `runtime/secret.key`); HKDF; token HMAC. |
| `secret-check.js` | Guarda uma impressão digital da chave mestra em `runtime/secret.check`; se ela mudar, o servidor recusa iniciar, a menos que `ALLOW_NEW_SECRET=true`. |
| `legacy-import.js` | Importa `runtime/users.json` e `projects.json` quando o banco está vazio e renomeia os arquivos para `*.migrado-AAAAMMDD`. |
| `mailer.js` | Transporte criado sob demanda; `enabled` só com `SMTP_HOST` e `SMTP_FROM`; `setTransport` para testes. |
| `rate-limit.js` | Janela deslizante em memória, por processo. |

### Variáveis de ambiente

| Variável | Padrão | Função |
|---|---|---|
| `DATABASE_URL` | obrigatória | Conexão com o Postgres (no compose, montada com `POSTGRES_PASSWORD`) |
| `POSTGRES_PASSWORD` | obrigatória no compose | Senha do banco |
| `APP_SECRET` | gera `runtime/secret.key` | Chave mestra (32+ caracteres); cifra as chaves de IA e assina as sessões |
| `ALLOW_NEW_SECRET` | vazio | `true` aceita uma chave mestra nova por uma inicialização |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD` | `Administrador`, `admin@geradorone.local`, vazio, aleatória | Primeiro administrador |
| `SMTP_HOST/PORT/SECURE/REQUIRE_TLS/USER/PASS/FROM` | porta 587 | Recuperação de senha por e-mail |
| `PORT`, `HOST`, `RUNTIME_DIR`, `CHROMIUM_PATH`, `PDF_FONT_DIR` | 3000, 127.0.0.1, `./runtime`, `/usr/bin/chromium-browser`, `/usr/share/fonts/dejavu` | Servidor e PDF |
| `TEST_DATABASE_URL` | definida por `npm test` | Postgres dos testes |
| `BACKUP_DIR` | `./backups` | Destino do `backup-db.sh` |

### Inicialização

`checkMasterSecret` → `prepare()` (migrações e importação dos JSONs) → `ensureAdmin()` (cria o administrador se não há usuários; imprime a senha temporária no log se ela foi gerada) → `listen`. Qualquer erro imprime `[erro] ...` e sai com código 1. `SIGTERM` e `SIGINT` fecham o servidor e o banco.

## Frontend

Um único script clássico (`app.js`), sem módulos. Não há `style=` nem scripts inline por causa da CSP; o JS ajusta variáveis CSS pela API do navegador, o que é permitido.

**Tela de login** (`#auth-screen`): duas áreas (formulário à esquerda, logo à direita), com quatro painéis alternados por `showAuth`: `login`, `forgot`, `confirm` e `first` (troca obrigatória de senha).

**App** (`#shell`): menu lateral recolhível (Ctrl+B; gaveta no celular) e uma `<section class="view">` por página, mais o painel de resultado à direita.

| Página (`data-view`) | Função | Chamadas |
|---|---|---|
| `inicio` | Só o logo | nenhuma |
| `apostila` | Formulário e geração do prompt (`form#formulario`) | `/api/generate` (modo IA) |
| `capa` | Prompt da arte frontal (`form#form-capa`) | nenhuma |
| `projetos` | Listar, abrir, excluir e importar | `/api/projects` |
| `ia` | BYOK: provedor, chave e modelos | `/api/ai/config` |
| `conta` | Perfil, troca de senha, exportação dos dados (JSON) e exclusão da conta (senha atual + segundo clique em "Confirmar exclusão") | `/api/auth/profile`, `change-password`, `export`, `delete-account` |
| `tema` | Galeria de temas e "Seguir o sistema" | `/api/auth/theme` |
| `apostila` (seletor da BNCC) | No bloco "Configuração pedagógica": painel com filtros e busca sobre `public/data/bncc.json` (carregado só ao abrir o painel ou ao digitar códigos); "Usar as selecionadas" grava os códigos no campo `bncc`, e `bnccTextBlock` junta o texto oficial ao prompt | `GET /data/bncc.json` (estático) |
| `suporte` | Formulário "Fale com o suporte" (tipo em botões, texto, anexos por clique, arrastar ou colar, nome e e-mail) | `POST /api/support` |
| `faq` | Perguntas e respostas (dados em `public/faq-data.js`), com busca, filtro por categoria e resposta aberta na linha | nenhuma |
| `usuarios` | Gestão de usuários em tabela, com busca, filtro e edição por linha (admin) | `/api/users*` |

O painel de resultado só aparece nas páginas `apostila` e `capa` (regra de CSS por `data-view`).

### Geradores de prompt (`app.js`)

- `generateImagePrompt` (modo "somente prompt", o padrão): prompt de imagem, uma imagem por página. Usa `typeProfiles` (13 tipos), `typeLayouts` (regras de layout por tipo), `typeElements`, `styleProfiles` (12 estilos), `pagePlan` (plano de páginas quando há mais de uma) e `imagePageFormats`. O número de páginas padrão é 1.
- `generateCoverPrompt`: capa, com os textos exatos entre aspas e a mesma tabela de estilos.
- `generatePrompt` (modo IA): prompt de documento completo, com as seções 1 a 8, mais as seções 9 a 11 acrescentadas no envio.

### Estado e fluxos

- `apiFetch` envolve `fetch`: 401 abre o login; 403 com `PASSWORD_CHANGE_REQUIRED` abre a troca de senha. Todos os endereços são relativos (`'api/...'`, sem barra inicial) para funcionar sob um prefixo de caminho.
- Projeto atual: `currentProjectId` e `currentProjectKind`. Gerar de novo e salvar atualiza o projeto aberto ("Salvar como novo" é a saída). O id é zerado se o tipo mudar.
- Sair ou trocar de usuário recarrega a página, o que apaga todo o estado em memória.

### CSS

Ordem de carga: `styles.css`, `theme.css`, `app.css`, `design.css` (por último, vence as anteriores). O tema vem de `html[data-theme]` (`papel`, `grafite`, `lousa`, `azul-tinta`, `sepia`, `alto-contraste`; `papel` é o padrão) e a escolha fica na conta (`users.theme`, rota `POST /api/auth/theme`), com cópia em `localStorage` (`apostila-theme`). Detalhes em `docs/DESIGN.md`. Pontos de quebra: 1180 px (resultado vai para baixo), 900 px (menu vira gaveta), 860 px (login em coluna única) e 600 px (barra de ação compacta). `[hidden]` tem regra global com `!important`.

## Fluxos principais

```mermaid
sequenceDiagram
    participant U as Usuário
    participant B as Navegador
    participant S as server.js
    participant DB as Postgres
    U->>B: e-mail e senha
    B->>S: POST /api/auth/login
    S->>DB: busca o usuário por e-mail
    S->>S: scrypt (ou verifyDummy se não existe)
    S-->>B: cookie g1_session (HttpOnly) + usuário
    alt mustChangePassword
        B->>S: POST /api/auth/change-password
        S->>DB: nova senha, pwd_version + 1
        S-->>B: nova sessão
    end
    B->>S: GET /api/projects (cookie)
    S->>DB: confere usuário ativo e pwd_version
    S-->>B: projetos do dono
```

```mermaid
sequenceDiagram
    participant B as Navegador
    participant S as server.js
    participant AI as OpenAI/Gemini
    participant C as Chromium
    B->>B: gera o prompt (generateImagePrompt)
    Note over B: modo "somente prompt" não envia nada ao servidor
    B->>S: POST /api/generate (modo IA)
    S->>S: decifra a chave do usuário
    S->>AI: texto (HTML) e imagens em paralelo
    S->>S: cleanGeneratedHtml (lista de permissão de endereços)
    S->>C: HTML para PDF (sem rede, ambiente mínimo)
    S-->>B: arquivos em base64
```

## Segurança

- **Senhas:** scrypt com salt; e-mail inexistente gasta o mesmo tempo; mensagem de erro igual para os dois casos.
- **Sessões:** sem armazenamento no servidor. O cookie carrega a versão da senha; mudar senha, e-mail, perfil ou situação invalida todas as sessões. O servidor recarrega o usuário a cada requisição.
- **CSRF:** `SameSite=Lax` mais verificação de `Origin` em tudo que não é GET.
- **BYOK:** chave cifrada com AES-256-GCM; `GET /api/ai/config` devolve só `••••` e os 4 últimos caracteres; a chave só é decifrada em memória, na hora de chamar o provedor.
- **Chave mestra:** `APP_SECRET` no `.env`, fora do banco; HKDF deriva chaves separadas para sessão, BYOK e recuperação; `secret.check` impede iniciar com uma chave diferente.
- **HTML gerado pela IA:** o sanitizador usa lista de permissão: em atributos de endereço (`src`, `href`, `srcset`, `action`...) só passam `#âncora` e imagens `data:image/...;base64`. Remove `script`, `iframe`, `object`, `embed`, `base`, `link`, `meta http-equiv`, manipuladores `on*` (mesmo sem espaço antes) e `url()` externos. O Chromium roda sem resolução de nomes (`--host-resolver-rules`) e só recebe `PATH`, `HOME` e `LANG`.
- **Limites:** corpo da requisição de 1 MB (conta bytes e descarta o excedente); 500 projetos por usuário; 10 ajustes e 1.000 caracteres no "melhorar prompt".
- **Contêiner:** usuário sem privilégios, sistema de arquivos somente leitura, sem capabilities, `no-new-privileges`; o banco só existe na rede `internal` e não publica porta.

## Testes

`npm test` sobe um Postgres 17 descartável em Docker, cria um banco por arquivo de teste e remove tudo no fim (45 testes). `npm run test:node` usa um Postgres seu (`TEST_DATABASE_URL`).

| Arquivo | Cobre |
|---|---|
| `auth.test.js` | Fluxo HTTP completo: sessão, login, troca de senha, usuários, BYOK, isolamento, recuperação por e-mail, origem, URLs malformadas, corpo grande. **Os testes dependem uns dos outros e a ordem importa**; o do script de emergência troca a senha do admin e precisa ser o último. |
| `auth.test.js` (termos) | Cadastro sem `acceptTerms: true` dá 400; aceite de conta antiga, nova versão exige novo aceite, exportação traz versão e data, e as páginas `termos.html` e `privacidade.html` são públicas. |
| `store.test.js` | Armazenamento: migração, corridas (e-mail duplicado, limite de projetos), cascata, transação, importação dos JSONs. |
| `crypto.test.js` | Senha, AES-GCM, token, limitador, chave mestra. |
| `secret.test.js` | Impressão digital da chave e recusa de iniciar (sobe o servidor como processo filho). |
| `server.test.js` | Funções puras: sanitizador, PDF, prévia, validação. |

## Convenções

- Interface, documentos, comentários, mensagens de erro e nomes de teste em português do Brasil. Commits no estilo `feat:`, `fix:`, `docs:` com assunto em português.
- CommonJS com prefixo `node:`; dependências mínimas e fixadas (`pg`, `nodemailer`, `pdfkit`).
- Segredos nunca no Git nem em logs; arquivos com segredo ficam com permissão 600.
- Cada mudança vai em commit e é enviada ao GitHub; tudo roda em Docker.
- Os testes usam banco real, sem simulação; só o transporte de e-mail é injetado.

## Cuidados ao mexer

- **`event.currentTarget` é `null` depois de um `await`.** Guarde em uma constante antes do primeiro `await` (o código já faz isso em todos os formulários).
- Sem estilos nem scripts inline (CSP). Endereços da API sempre relativos e sem barra inicial; `AUTH_PUBLIC` compara essas strings exatas.
- `styles.css` parece legado, mas ainda define `.card`, `.option`, `.resource`, `.action-bar` e `.primary`; não apague.
- `currentProjectId` persiste entre gerações do mesmo tipo.
- Os limites de login, os códigos de recuperação, os cadastros pendentes e o rate limit ficam na memória do processo: não valem com mais de uma instância.
- `hasApiKey` reflete uma chave que ainda pode ser decifrada; se a chave mestra for trocada, as chaves salvas somem da interface sem apagar o dado.
- O teste do script de emergência e os testes de `auth.test.js` compartilham estado.

## Guia de navegação

| Para... | Mexa em |
|---|---|
| Novo tipo de material | `typeProfiles` (e, se tiver layout próprio, `typeLayouts`) em `public/app.js`; opção em `select[name=tipo]` em `public/index.html` |
| Novo estilo visual | `styles` e `styleProfiles` em `public/app.js` e a amostra em `styleSamples` |
| Nova rota da API | `handleAppApi` (ou `handleAuthApi`/`handleUsersApi`) em `server.js`; teste em `test/auth.test.js` |
| Nova coluna ou tabela | nova versão em `MIGRATIONS` (`lib/db.js`); ajuste a store correspondente e os testes de `store.test.js` |
| Nova página no menu | `<a class="nav-item" data-view>` e `<section class="view" data-view>` em `index.html`; incluir em `VIEWS` e tratar em `showView` (`app.js`); decidir se esconde o painel de resultado em `app.css` |
| Regra de login ou sessão | `handleAuthApi`, `authenticate`, `issueSession` em `server.js`; `lib/users.js` (`pwd_version`) |
| Chave de IA e provedores | `aiConfigFor`, `nextAiSettings`, `requestOpenAiText`, `requestGeminiText`, `requestAiImage` em `server.js` |
| E-mail | `lib/mailer.js` e as variáveis `SMTP_*` |
| Deploy, rede, volumes | `compose.yaml` e `Dockerfile` |
| Backup e restauração | `scripts/backup-db.sh` e o README |

## Achados em aberto (revisão de 23/10/2026)

Corrigidos nesta revisão: queda do processo com `%` inválido na URL, ambiente completo repassado ao Chromium, sanitizador por lista de bloqueio, corpo de requisição grande continuar sendo acumulado, mapa de códigos pendentes sem limpeza, `hasApiKey` verdadeiro com chave ilegível, nota antiga em `/api/render`, `pipefail` no backup.

Ainda abertos, por ordem de importância:

1. **Chromium com `--no-sandbox`** processando conteúdo gerado por IA (o contêiner não tem capabilities para o sandbox).
2. **`X-Forwarded-For` é confiado** para a chave de limite por IP; sem proxy que sobrescreva o cabeçalho, ele pode ser forjado. O limite por e-mail continua valendo.
3. **O limite de login por e-mail permite travar uma conta de terceiros** por 15 minutos com 8 tentativas erradas; o mesmo vale para a recuperação de senha.
4. **Pedir recuperação de senha substitui um código pendente de outra pessoa** (basta o e-mail dela), limitado a 5 pedidos por janela.
5. **Sair não invalida o token** do lado do servidor (ele só expira ou cai com a troca de versão da senha); o cookie de 7 dias não renova.
6. **Porta 8123 publicada em todas as interfaces**, em HTTP puro (previsto na Fase 1 do roadmap).
7. **`/tmp` de 32 MB** no contêiner: PDFs grandes com muitas imagens podem estourar.
8. **Modelos padrão** (`gpt-6-astra`, `gemini-3.8-flash`, `gpt-image-2.5-flare`, `gemini-3-pro-image-preview`) não foram verificados nos provedores.
9. **`ensureAdmin` imprime a senha temporária no log** do contêiner quando ela é gerada.
10. **Interface:** sem `hashchange` (Voltar do navegador não navega), "Redefinir senha" de usuário sem confirmação, o JSON do painel mantém o nome fixo `projeto-geradorone.json`, piscar de tema ao carregar e CSS morto das telas antigas (`.hero*`, `.result-modal`, `.topbar`, `.workflow-*`, `.live-dot`, `.mini-card`).
11. **Cobertura de testes ausente:** endpoints de IA (`/api/generate`, `/api/improve` com provedor simulado), `/api/pdf` e `/api/render` autenticados, o caminho do Chromium, cabeçalhos HTTP e arquivos estáticos, o frontend inteiro, o `backup-db.sh`, e não há CI.
