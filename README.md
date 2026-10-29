<p align="center">
  <img src="public/assets/icons/mapa-mental.png" alt="Logotipo do GeradorOne: cabeça com um mapa mental no lugar do cérebro" width="170">
</p>

<h1 align="center">GeradorOne</h1>

<p align="center">Gerador de prompts de imagem para apostilas, capas e materiais didáticos, com geração opcional do material pela IA do próprio usuário.</p>

<p align="center">
  <a href="LICENSE"><img alt="Licença AGPL-3.0" src="https://img.shields.io/badge/licen%C3%A7a-AGPL--3.0-blue"></a>
  <img alt="Node.js 22" src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white">
  <img alt="PostgreSQL 17" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white">
  <img alt="Docker Compose" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
  <img alt="Idioma português do Brasil" src="https://img.shields.io/badge/idioma-portugu%C3%AAs%20(BR)-009C3B">
</p>

## Sumário

- [O que é](#o-que-é)
- [Funcionalidades](#funcionalidades)
- [Como funciona](#como-funciona)
- [Início rápido](#início-rápido)
- [Configuração](#configuração)
- [Hospedagem própria com HTTPS](#hospedagem-própria-com-https)
- [Banco de dados e backup](#banco-de-dados-e-backup)
- [Arquitetura e estrutura de pastas](#arquitetura-e-estrutura-de-pastas)
- [Desenvolvimento e testes](#desenvolvimento-e-testes)
- [Como contribuir](#como-contribuir)
- [Segurança](#segurança)
- [Licença](#licença)
- [Créditos e dados de terceiros](#créditos-e-dados-de-terceiros)
- [Prefere não hospedar? Use a versão pronta](#prefere-não-hospedar-use-a-versão-pronta)

## O que é

O GeradorOne é um aplicativo web para quem prepara material didático: professores, autores de apostilas, cursos e escolas. A pessoa descreve o material (disciplina, assunto, público, objetivo, tipo, estilo visual) e o app monta um prompt detalhado, com uma imagem por página, para colar em uma ferramenta de geração de imagens.

Quem cadastrar a própria chave de IA (BYOK: OpenAI, Google Gemini ou Anthropic) pode pedir o material pronto em PDF ou HTML, gerado pelo servidor com essa chave. O app não tem chave global: cada pessoa usa e paga a própria.

> O GeradorOne não valida conteúdo curricular. Os prompts pedem à IA que não invente códigos, fontes, normas ou dados, mas o resultado precisa ser revisado por quem vai usá-lo.

## Funcionalidades

**Idiomas**

- Interface, FAQ, e-mails e prompts em português do Brasil, inglês, espanhol, alemão e italiano, com seletor de bandeiras na tela de entrada e no menu. O idioma escolhido também vale para o texto que o prompt pede dentro das imagens e fica salvo na conta. Termos e Política de privacidade existem só em português do Brasil.

**Apostila**

- 12 tipos de material e a opção Outro, entre eles apostila didática, material de revisão, caderno de atividades, guia de estudos, sequência didática e guia do professor.
- Disciplina, assunto, público, objetivo de aprendizagem e cinco níveis de profundidade (de Introdutório a Completo).
- 12 estilos de ilustração com miniatura (Cartoon, Hand-drawn, Livro Didático, Realista, 3D Educacional e outros) e paleta escolhida à parte.
- Formatos para impressão A4, tela e apresentação 16:9.
- Recursos gráficos: mapas mentais, diagramas, ilustrações, infográficos, gráficos (só com dados verificáveis), quadros comparativos, linhas do tempo, ícones e sinalização, com controles de frequência e de profundidade visual.
- Seletor de habilidades da BNCC, com filtros por etapa, ano e componente e busca por texto, sobre uma cópia local dos 1.721 códigos oficiais. O app confere os códigos digitados e leva o texto oficial para o prompt.

**Capa:** prompt da arte frontal, com os textos exatos da capa e a mesma tabela de estilos.

**Resultado e exportação**

- O prompt aparece no painel de resultado, com cópia em um clique e download em TXT, JSON ou PDF.
- "Melhorar com IA" reescreve o prompt com a chave do usuário.
- "Gerar material com IA" produz o material completo em PDF ou HTML autônomo, com até três imagens geradas pela IA e incorporadas. Diagramas Mermaid e gráficos Chart.js descritos pela IA são desenhados no servidor, sem rede, e entram no arquivo como SVG e imagem.
- Com a Anthropic, o app gera só texto: "Imagens por IA" precisa estar em "Não usar imagens geradas por IA".

**Contas e projetos**

- Login por e-mail e senha, perfis administrador e usuário, troca de senha obrigatória no primeiro acesso.
- Projetos salvos por usuário (Meus projetos), com importação e exportação em JSON.
- Autocadastro e recuperação de senha por código enviado por e-mail, quando há SMTP configurado. Sem SMTP, só o administrador cadastra e redefine senhas.
- Minha conta: perfil, troca de senha, "Baixar meus dados (JSON)" e exclusão da própria conta.
- Termos de uso e Política de privacidade (`public/termos.html` e `public/privacidade.html`), com aceite registrado na conta. Os textos são modelos sem revisão jurídica: quem hospedar uma instância deve adaptá-los.

**Interface**

- Páginas Início (guia dos primeiros passos, com demonstração animada e um prompt de exemplo), Sobre, FAQ com busca e Suporte (formulário com anexos que envia a mensagem por e-mail).
- Seis temas de cores: Papel, Grafite, Lousa, Azul-tinta, Sépia e Alto contraste, ou seguir o sistema. Veja [docs/DESIGN.md](docs/DESIGN.md).
- Interface responsiva para computador, tablet e celular, em português do Brasil.

**Administração:** a tela Configurações tem as abas Usuários (criar, editar, ativar, desativar, redefinir senha e excluir), E-mail (SMTP), com envio de teste, e Backup, que mostra a situação das cópias do banco.

## Como funciona

1. A pessoa preenche o formulário da Apostila ou da Capa. O prompt é montado no navegador, sem chamar o servidor nem a IA.
2. Ela copia o prompt ou baixa o arquivo e usa na ferramenta de imagens que preferir.
3. Se tiver uma chave de IA cadastrada, pode pedir "Gerar material com IA". O servidor decifra a chave só na memória, chama o provedor, limpa o HTML devolvido e, para PDF, converte com o Chromium do contêiner.

## Início rápido

Pré-requisitos: Docker com o plugin Compose.

```sh
git clone https://github.com/Epaminondaslage/geradorOne.git
cd geradorOne
```

Crie um arquivo `.env` ao lado do `compose.yaml` com permissão 600 (`chmod 600 .env`). O mínimo é este:

```env
POSTGRES_PASSWORD=troque-por-um-valor-aleatorio
APP_SECRET=troque-por-32-ou-mais-caracteres-aleatorios
ADMIN_NAME=Seu Nome Completo
ADMIN_EMAIL=voce@seu-dominio.com.br
ADMIN_PASSWORD=uma-senha-com-8-ou-mais-caracteres
```

Para gerar valores aleatórios:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O `compose.yaml` liga o app a uma rede externa chamada `coolify`, usada pelo proxy reverso do ambiente de desenvolvimento. Em uma máquina que não tem essa rede, crie-a uma vez (os rótulos do Traefik ficam sem efeito sem esse proxy):

```sh
docker network create coolify
docker compose up -d --build
```

O app responde em `http://seu-servidor:8123`. Entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD`; a troca da senha é exigida no primeiro acesso. Se `ADMIN_PASSWORD` ficar vazia ou tiver menos de 8 caracteres, o app gera uma senha temporária e a imprime uma vez no log:

```sh
docker compose logs gerador-one | grep setup
```

Depois, cada usuário cadastra a própria chave em **Minha chave de IA** para usar os recursos de IA.

Se perder o acesso de administrador, gere uma senha temporária de emergência:

```sh
docker exec gerador-one node scripts/reset-password.js EMAIL-DO-ADMIN
```

## Configuração

Todas as variáveis ficam no `.env`, que nunca vai para o Git. Não publique esse arquivo, as chaves de API nem o `APP_SECRET`.

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `POSTGRES_PASSWORD` | sim | Senha do banco. Sem ela, o `docker compose` recusa subir. |
| `APP_SECRET` | recomendada | Chave mestra (32 ou mais caracteres): cifra as chaves de IA e assina as sessões. Sem ela, o app gera `runtime/secret.key`, opção menos segura. |
| `ALLOW_NEW_SECRET` | não | `true` aceita uma chave mestra nova por uma inicialização (veja abaixo). |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD` | não | Primeiro administrador, criado só quando o banco não tem usuários. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | não | Envio de e-mail (cadastro, recuperação de senha, suporte). Porta padrão 587; `SMTP_SECURE=true` para TLS direto na 465; `SMTP_REQUIRE_TLS=true` para exigir STARTTLS. |
| `APP_URL` | não | Endereço do app que aparece nos e-mails. |
| `CONTACT_EMAIL` | não | E-mail de contato nos e-mails, nos Termos, na Política e na FAQ. |
| `DOMINIO` | só no `compose.prod.yaml` | Domínio do certificado HTTPS emitido pelo Caddy. |

O SMTP também pode ser configurado pelo administrador na tela **Configurações → E-mail (SMTP)**. O que for salvo ali tem prioridade sobre o `.env`, e a senha fica cifrada no banco. Para testar pelo terminal: `docker exec gerador-one node scripts/test-smtp.js --verify`.

**Cuidado com o `APP_SECRET`.** O app guarda uma impressão digital da chave em `runtime/secret.check` e recusa iniciar se ela mudar, porque as chaves de IA salvas ficariam ilegíveis. Para trocar a chave de propósito, inicie uma vez com `ALLOW_NEW_SECRET=true` e depois remova a variável. Guarde uma cópia do `.env` separada do backup do banco.

## Hospedagem própria com HTTPS

O `compose.prod.yaml` sobe o app, o Postgres e um Caddy que emite e renova o certificado Let's Encrypt do domínio em `DOMINIO`:

```sh
docker compose -f compose.prod.yaml --env-file .env up -d --build
```

O DNS do domínio precisa apontar para o IP público do servidor, e as portas 80 e 443 precisam chegar ao contêiner do Caddy. A porta 8123 continua publicada em HTTP sem criptografia; não a encaminhe para a internet. Nesse arquivo, a aba Backup espera os arquivos de status das cópias na pasta `monitor/` e avisa quando eles não existem.

## Banco de dados e backup

Usuários, projetos e configurações ficam em um Postgres 17 (serviço `db`), no volume `pgdata`. O banco só existe na rede interna do Docker e não publica porta. O esquema é criado e atualizado sozinho na inicialização, por migrações versionadas em `lib/db.js`.

Backup:

```sh
scripts/backup-db.sh
```

O script grava `backups/geradorone-AAAAMMDD-HHMM.sql.gz` (permissão 600) e apaga as cópias com mais de 14 dias. A pasta muda com `BACKUP_DIR`; agende o script no cron do servidor. Para restaurar em um banco vazio:

```sh
zcat backups/ARQUIVO.sql.gz | docker exec -i gerador-one-db psql -U geradorone geradorone
```

## Arquitetura e estrutura de pastas

Node.js 22 sem framework e sem etapa de build: `node:http` no servidor, JavaScript puro no navegador, `pg` para o banco, `pdfkit` para o PDF do prompt, `nodemailer` para e-mail e Chromium para converter o HTML gerado em PDF. O contêiner roda como usuário sem privilégios, com sistema de arquivos somente leitura e sem capabilities.

```text
.
├── server.js              # servidor HTTP, rotas /api, sessão, IA e PDF
├── lib/                   # banco, usuários, projetos, criptografia, e-mail, suporte, diagramas
├── public/                # interface estática (HTML, CSS, app.js, FAQ, temas, dados da BNCC)
├── vendor/                # Mermaid e Chart.js usados pelo servidor para desenhar diagramas
├── scripts/               # testes, backup, senha de emergência, teste de SMTP, dados da BNCC
├── test/                  # testes contra um Postgres real
├── docs/                  # mapa do código, identidade visual, padrão de ícones, exemplos de prompt
├── deploy/Caddyfile       # proxy HTTPS do compose.prod.yaml
├── compose.yaml           # app + banco
├── compose.prod.yaml      # app + banco + Caddy
└── Dockerfile
```

O [mapa do código](docs/CODEBASE_MAP.md) descreve as rotas da API, o modelo de dados, os fluxos e os pontos em aberto. A identidade visual e os temas estão em [docs/DESIGN.md](docs/DESIGN.md), e o padrão dos botões de ícone em [docs/PADRAO_ICONES.md](docs/PADRAO_ICONES.md). Há um prompt de exemplo por tipo de material em [docs/exemplos/](docs/exemplos/).

## Desenvolvimento e testes

```sh
npm ci
npm test            # sobe um Postgres 17 descartável em Docker, roda a suíte e remove o contêiner
npm run test:node   # usa um Postgres seu, indicado em TEST_DATABASE_URL
```

Para rodar o app fora do Docker, defina `DATABASE_URL` apontando para um Postgres e rode `npm start` (escuta em `127.0.0.1:3000`). A conversão para PDF do modo IA precisa de um Chromium instalado (`CHROMIUM_PATH`).

O código é copiado para a imagem no build: depois de mudar `server.js`, `lib/` ou `public/`, reconstrua com `docker compose up -d --build`.

## Como contribuir

Contribuições são bem-vindas. O fluxo, o estilo de commit e as regras estão em [CONTRIBUTING.md](CONTRIBUTING.md). Em resumo: abra uma issue para discutir a mudança, mande um pull request para a `main`, escreva commits em português no estilo `feat:`, `fix:` ou `docs:` e deixe o `npm test` passando.

## Segurança

Se encontrar uma vulnerabilidade, não publique os detalhes em uma issue aberta. Use o relato privado do GitHub (aba Security, "Report a vulnerability"); o passo a passo está em [SECURITY.md](SECURITY.md).

Pontos do desenho que vale conhecer: senhas com scrypt, chaves de IA cifradas com AES-256-GCM e nunca devolvidas ao navegador (só os 4 últimos caracteres), sessão em cookie `HttpOnly` e `SameSite=Lax`, política de conteúdo (CSP) sem scripts inline e HTML gerado pela IA filtrado por lista de permissão antes da conversão em PDF.

## Licença

O GeradorOne é software livre, licenciado sob a [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). Você pode usar, estudar, modificar e redistribuir o código. Se oferecer uma versão modificada para outras pessoas usarem pela rede, como um serviço na internet, precisa disponibilizar a elas o código-fonte dessa versão, sob a mesma licença. Em caso de dúvida, vale o texto da licença, não este resumo.

## Créditos e dados de terceiros

- **BNCC:** os códigos e textos das habilidades vêm do dataset [bncc.dev](https://github.com/bncc-dev/bncc-dados), sob licença CC BY 4.0. Detalhes, versão e forma de atualizar em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Para uso formal, confira sempre o documento oficial do MEC.
- **Fontes:** Literata e Atkinson Hyperlegible Next, sob a SIL Open Font License, em `public/fonts/`.
- **Diagramas e gráficos:** Mermaid e Chart.js, em `vendor/`, com as licenças ao lado (`vendor/LICENSE-mermaid` e `vendor/LICENSE-chartjs`).

## Prefere não hospedar? Use a versão pronta

Se você só quer usar o GeradorOne, sem instalar nada, existe uma versão hospedada em **<https://geradorone.com.br>**. Ela gera o material pronto em PDF com a IA do próprio serviço, e começa no Trial, sem custo. Os planos Gold e Diamond liberam mais folhas por mês e o uso da sua própria chave de IA.

Este repositório continua sendo o projeto de código aberto: você pode instalar, estudar, modificar e hospedar a sua instância sob a AGPL-3.0.
