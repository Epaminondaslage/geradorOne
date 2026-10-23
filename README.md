<p align="center">
  <img src="public/assets/icons/mapa-mental.png" alt="Logotipo do GeradorOne: cabeça com um mapa mental no lugar do cérebro" width="170">
</p>

<h1 align="center">GeradorOne</h1>

<p align="center">Prompts visuais para apostilas, capas e materiais didáticos.</p>

Plataforma web para planejar materiais didáticos visualmente ricos e gerar prompts completos para ferramentas de inteligência artificial. O GeradorOne organiza intenção pedagógica, referências, identidade visual e recursos gráficos em um briefing estruturado, acessível e exportável.

O usuário pode escolher entre gerar apenas o prompt ou solicitar que a IA produza diretamente o material final em HTML ou PDF.

## Recursos atuais

### Configuração pedagógica

- Disciplina, assunto principal, público e objetivo de aprendizagem.
- Cinco níveis de profundidade.
- Diferentes tipos de material e estilos de escrita.
- Inclusão opcional de códigos e habilidades da BNCC.
- Campo para textos e materiais de referência.
- Instruções explícitas para não inventar códigos, fontes, normas ou dados.

### Direção visual

- 12 estilos de ilustração com miniaturas de acabamento.
- Paleta visual configurada separadamente do estilo das ilustrações.
- Formatos para tela, impressão A4 e apresentação 16:9.
- Seis temas de cores (Papel, Grafite, Lousa, Azul-tinta, Sépia e Alto contraste), com detecção do sistema e preferência persistente. Veja [docs/DESIGN.md](docs/DESIGN.md).
- Interface responsiva para computadores, tablets e celulares.
- Linha de progresso numerada que avança entre configuração, revisão e exportação.

### Recursos gráficos

- Mapas mentais, diagramas, ilustrações e infográficos.
- Gráficos baseados apenas em dados verificáveis.
- Quadros comparativos, linhas do tempo, ícones e sinalização.
- Controles de frequência, profundidade visual e densidade textual.
- Saída de diagramas em Mermaid, SVG editável ou especificação visual.
- Políticas para uso opcional de imagens geradas por IA.
- Geração de imagens reais pela mesma integração de IA, incorporadas ao HTML/PDF e também disponibilizadas como arquivos PNG separados.

Cada recurso possui uma miniatura que representa sua estrutura visual, além de instruções para objetivo pedagógico, conteúdo, legenda, produção gráfica e texto alternativo.

### Projetos e exportações

- Geração do prompt em um modal, sem perder ou limpar o formulário.
- Cópia com confirmação visual e notificação.
- Prévia HTML exibida dentro do modal.
- Exportação do prompt em TXT.
- Exportação e importação do projeto em JSON.
- Salvamento e restauração de rascunhos no navegador.
- Geração e download direto de um arquivo PDF real pelo backend.
- Prompt orientado a entregar um único HTML autônomo com CSS e SVG incorporados, sem arquivos Python auxiliares.
- Modo opcional **Gerar material com IA**, executado exclusivamente pelo backend.
- Arquivos gerados apresentados em modal, com nome, tipo, tamanho aproximado e botão **Salvar localmente**.
- Conversão do HTML interno produzido pela IA em PDF real pelo Chromium do contêiner.
- Frequência visual controla a geração de uma a três imagens por material; a entrega falha se a IA não devolver as imagens obrigatórias.

No modo **somente prompt**, o botão de PDF exporta o prompt/roteiro. No modo **IA**, o PDF contém o material didático completo produzido pelo modelo e renderizado pelo servidor.

## Arquitetura

### Navegador

O diretório `public/` contém HTML, CSS e JavaScript sem framework. A montagem inicial do prompt, os rascunhos e as exportações TXT/JSON são processados no navegador.

### Backend Node.js

O arquivo `server.js`:

- serve os arquivos da interface;
- expõe `GET /api/health` para monitoramento;
- expõe `POST /api/render` para gerar a prévia HTML segura;
- expõe `GET /api/ai/status` para informar se a IA está configurada;
- expõe `POST /api/generate` para produzir o material com IA e devolver os arquivos ao modal;
- limita requisições a 1 MB;
- escapa conteúdo fornecido pelo usuário;
- aplica cabeçalhos de segurança e política de conteúdo.

## Executar com Node.js

Requer Node.js 18 ou superior.

```bash
npm start
```

Acesse `http://127.0.0.1:3000`.

Para executar os testes:

```bash
npm test
```

> **Documentação:** [mapa do código](docs/CODEBASE_MAP.md) (arquitetura, rotas, fluxos e achados em aberto) e [roadmap para SaaS](docs/ROADMAP.md).

## Executar com Docker

```bash
docker compose up -d --build
```

A aplicação será publicada na porta `8123` do servidor. O contêiner executa como usuário não privilegiado, usa sistema de arquivos somente leitura, remove capabilities Linux, impede elevação de privilégios, possui verificação de saúde e reinício automático.

## Login, usuários e chaves de IA (BYOK)

Todo o app exige login por e-mail e senha. Cada usuário tem os próprios projetos e a própria chave de IA.

- **Primeiro administrador:** criado na primeira inicialização, com `ADMIN_NAME`, `ADMIN_EMAIL` e (opcional) `ADMIN_PHONE`. Sem telefone, o app pede para completá-lo em Minha conta. Sem `ADMIN_PASSWORD`, uma senha temporária aleatória é impressa uma vez no log do contêiner (`docker logs gerador-one | grep setup`). A troca da senha é exigida no primeiro acesso. Projetos criados antes do login passam para esse administrador.
- **Usuários:** cada cadastro tem nome completo, telefone, e-mail e senha temporária (com botão para gerar). O administrador cria, edita, ativa/desativa, redefine a senha (temporária, com troca obrigatória) e exclui usuários na página **Usuários**. Sempre sobra ao menos um administrador ativo.
- **Recuperar senha por e-mail:** código de 6 dígitos, válido por 10 minutos, com limite de tentativas. Só fica disponível com SMTP configurado; sem SMTP, o administrador redefine a senha.
- **BYOK:** cada pessoa cadastra a própria chave na página **Minha chave de IA**. A chave é cifrada (AES-256-GCM), nunca volta ao navegador (só os 4 últimos caracteres) e não é visível nem para administradores. Não há chave global do servidor.
- **Sessão:** cookie `HttpOnly` e `SameSite=Lax`, válido por 7 dias; trocar a senha, mudar o perfil ou desativar a conta encerra as sessões antigas. Login com limite de tentativas por e-mail e por IP.

Variáveis em um arquivo `.env` ao lado do `compose.yaml` (não versionado):

```env
ADMIN_NAME=Seu Nome Completo
ADMIN_EMAIL=voce@exemplo.com
# ADMIN_PHONE=35999998888
# ADMIN_PASSWORD=          opcional; mínimo de 8 caracteres
APP_SECRET=                # recomendado; 32+ caracteres (gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
POSTGRES_PASSWORD=         # obrigatória; gere com: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
# SMTP_HOST=smtp.exemplo.com
# SMTP_PORT=587
# SMTP_SECURE=false        true para TLS direto (porta 465)
# SMTP_REQUIRE_TLS=false   true para exigir STARTTLS na porta 587 (Zimbra costuma usar)
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM="GeradorOne <no-reply@exemplo.com>"
```

Para conferir o SMTP sem esperar um pedido de recuperação, envie um e-mail de teste: `docker exec gerador-one node scripts/test-smtp.js destino@exemplo.com`.

## Banco de dados (Postgres)

Usuários e projetos ficam em um Postgres 17 (serviço `db` no `compose.yaml`), com volume nomeado `pgdata`. O banco só existe na rede interna do Docker: não publica porta no servidor. A conexão usa `DATABASE_URL`, montada a partir de `POSTGRES_PASSWORD` (obrigatória no `.env`; sem ela o `docker compose` recusa subir).

- **Esquema:** criado e atualizado sozinho na inicialização (migrações versionadas em `lib/db.js`, com trava para não rodarem em duplicidade). Excluir um usuário apaga os projetos dele na mesma transação.
- **Dados antigos:** se existirem `runtime/users.json` e `runtime/projects.json` e o banco estiver vazio, são importados uma única vez e renomeados para `*.migrado-AAAAMMDD` (nada é apagado).
- **Backup:** `scripts/backup-db.sh` gera `backups/geradorone-AAAAMMDD-HHMM.sql.gz` (permissão 600, rotação de 14 dias). Agende no cron, por exemplo `0 3 * * * /opt/geradorOne/scripts/backup-db.sh`. Restaurar: `zcat backups/ARQUIVO.sql.gz | docker exec -i gerador-one-db psql -U geradorone geradorone` (em um banco vazio).
- **Chave mestra:** `APP_SECRET` fica no `.env`, **fora** do banco e de `runtime/`. O app **recusa iniciar** se a chave for diferente da usada antes (`.env` apagado ou `APP_SECRET` trocado), pois as chaves de IA salvas ficariam ilegíveis e as sessões cairiam: ele guarda só uma impressão digital em `runtime/secret.check` e explica o motivo no log do contêiner. Para aceitar uma chave nova de propósito, inicie uma vez com `ALLOW_NEW_SECRET=true` e depois remova a variável. Sem `APP_SECRET`, o app gera `runtime/secret.key` (alternativa menos segura). Guarde o backup do `.env` separado do backup do banco: o banco sozinho não revela as chaves de IA cifradas.

## Implantação atual

- Diretório: `/opt/geradorOne`
- Contêiner: `gerador-one`
- Imagem: `gerador-one:2.0.0`
- Porta externa: `8123`
- Rede local: `http://IP-INTERNO:8123`

## Estrutura do projeto

```text
.
├── Dockerfile
├── compose.yaml
├── package.json
├── server.js
├── lib/                 # banco (Postgres), usuários, projetos, criptografia, limitador e e-mail
├── scripts/             # reset de senha, teste de SMTP, backup do banco, executor de testes
├── CLAUDE.md            # orientações para agentes
├── PROJECT_MEMORY.md    # identidade, regras e operação
├── docs/CODEBASE_MAP.md # mapa completo do código
├── docs/exemplos/       # um prompt de exemplo por modelo
├── docs/ROADMAP.md      # caminho até virar SaaS
├── docs/branding/       # foto original do logotipo
├── public/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── theme.css
└── test/                # rodam contra um Postgres descartável (npm test)
```

## Limitações e próximas integrações

- Renderização real de Mermaid e Chart.js na apostila final.
- Autenticação, limites por usuário e histórico persistente de projetos.
- Proxy HTTPS e domínio definitivo para acesso fora da rede local.

Chaves de API nunca devem ser colocadas nos arquivos de `public/` nem enviadas ao repositório.
