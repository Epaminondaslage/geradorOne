# GeradorOne

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
- Temas claro e escuro, com detecção do sistema e preferência persistente.
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

## Executar com Docker

```bash
docker compose up -d --build
```

A aplicação será publicada na porta `8123` do servidor. O contêiner executa como usuário não privilegiado, usa sistema de arquivos somente leitura, remove capabilities Linux, impede elevação de privilégios, possui verificação de saúde e reinício automático.

Crie um arquivo `.env` no servidor, sem adicioná-lo ao Git, com:

```env
OPENAI_API_KEY=sua-chave
OPENAI_MODEL=gpt-6-astra
OPENAI_IMAGE_MODEL=gpt-image-2.5-flare
```

A chave é lida somente pelo backend e nunca é enviada ao navegador ou incluída nos arquivos gerados.

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
├── public/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── theme.css
└── test/
    └── server.test.js
```

## Limitações e próximas integrações

- Renderização real de Mermaid e Chart.js na apostila final.
- Autenticação, limites por usuário e histórico persistente de projetos.
- Proxy HTTPS e domínio definitivo para acesso fora da rede local.

Chaves de API nunca devem ser colocadas nos arquivos de `public/` nem enviadas ao repositório.
