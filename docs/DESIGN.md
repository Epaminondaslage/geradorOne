# Sistema de design do GeradorOne

Este documento explica a identidade visual aplicada em 23/10/2026 e como usá-la em páginas novas. O código vive em `public/design.css` (tokens, temas e acabamento); as pranchas de referência estão em `docs/design/`.

## Princípios

O app é uma ferramenta de trabalho para professores, não uma vitrine. O visual segue isto:

- **Sem cara de IA genérica.** Nada de gradientes, brilhos, vidro, sombras, cartões que sobem no hover, chips em pílula, ícones em caixinha colorida nem numeração decorativa (01/02/03).
- **Linha em vez de sombra.** Separação por borda de 1 px e por degrau de tom (`--bg` para `--paper`). Cantos de 2 px.
- **Uma cor de acento por tema**, usada só onde há ação, foco ou seleção. O erro tem cor própria (`--danger`).
- **Tipografia com personalidade.** Serifa de livro para títulos e para o texto do prompt (ele aparece como uma folha); sans de alta legibilidade na interface.
- **Interação sem movimento.** O botão inverte para tinta ao passar o mouse; nada se desloca. `prefers-reduced-motion` desliga as transições.
- **Textos concretos em português**, sem frases de marketing e sem emojis. Ícones são SVG inline (traço de 2 px, sem preenchimento).

## Tipografia

| Uso | Fonte | Observação |
|---|---|---|
| Títulos, nome da marca, texto do prompt | Literata (variável, 400 a 700) | `--serif` |
| Interface, formulários, tabelas | Atkinson Hyperlegible Next (400, 500, 700) | `--sans`, desenhada para baixa visão |

As fontes são servidas pelo próprio app em `public/fonts/` (somente subconjunto latino, licença SIL OFL 1.1). Não use Google Fonts: a CSP (`style-src 'self'`) bloqueia. Se precisar de outra fonte, copie o arquivo `.woff2` para `public/fonts/`, declare `@font-face` em `design.css` e confirme que `server.js` serve a extensão (hoje `.woff2` já está em `MIME`).

Tamanhos: texto 15 px; título de página 34 px; título de seção 20 px; texto de apoio 13 px.

## Temas

A escolha acontece na tela **Tema** (item "Tema: …" no rodapé do menu): uma galeria com a miniatura da tela em cada tema, e a opção "Seguir o sistema". A tabela de cores e contraste que existe na prancha foi retirada do app a pedido (23/10/2026). A prancha de referência é `docs/design/Temas.dc.html`. Qualquer elemento com `data-theme-scope="nome"` recebe os tokens daquele tema sem mudar o resto da página; é assim que as miniaturas da galeria se pintam.

São seis combinações de cores aplicadas ao mesmo app. O tema fica em `<html data-theme="...">` e a escolha fica salva **na conta**, na coluna `users.theme` (vazia = ainda não escolheu), pela rota `POST /api/auth/theme`. Ao entrar, o app aplica o tema da conta; "Seguir o sistema" grava vazio na conta. O `localStorage` (`apostila-theme`) só guarda uma cópia para a tela de login e para quem ainda não escolheu. Sem escolha, vale a preferência do sistema: escuro vira Grafite, claro vira Papel. Valores antigos (`light`, `dark`) são convertidos.

| Tema (`data-theme`) | `--bg` | `--paper` | `--ink` | `--muted` | `--line` | `--field` | `--accent` | `--accent-ink` | `--danger` |
|---|---|---|---|---|---|---|---|---|---|
| `papel` (padrão) | #F2F0EB | #FCFBF8 | #1D1B17 | #5C574E | #D3CEC4 | #8A8378 | #13704A | #FFFFFF | #B42318 |
| `grafite` | #161719 | #1F2124 | #ECEAE5 | #A6A39C | #3A3D42 | #77746E | #F0A040 | #1A1206 | #FF8A7A |
| `lousa` | #1D3A2F | #244537 | #F2F0E6 | #BCC9BF | #45685A | #86A596 | #E9D26A | #1D2A14 | #FFB4A8 |
| `azul-tinta` | #ECF0F6 | #FFFFFF | #0F1A33 | #475471 | #C6CEDD | #7A87A3 | #1D3FBF | #FFFFFF | #B42318 |
| `sepia` | #ECE2CD | #F6EEDC | #2A2015 | #5D4C38 | #CBB896 | #8C7656 | #7A3812 | #FFFFFF | #A0261A |
| `alto-contraste` | #000000 | #0A0A0A | #FFFFFF | #DADADA | #FFFFFF | #FFFFFF | #FFE14D | #000000 | #FF6B6B |

Significado dos tokens:

- `--bg`: fundo da página e do menu lateral.
- `--paper`: superfície de cartão, campo e painel.
- `--ink`: texto principal, contorno de botão e logo do menu.
- `--muted`: texto de apoio e legendas.
- `--line`: divisória e borda de cartão (não serve como borda de campo).
- `--field`: borda de campo e de controle, com contraste de pelo menos 3:1 contra `--paper`.
- `--accent`: botão primário, foco, seleção, link e logo da página inicial.
- `--accent-ink`: texto sobre `--accent`.
- `--danger`: erro e ação destrutiva.

Contraste (calculado por script no desenho, a conferir de novo ao mudar uma cor): texto e apoio acima de 4,5:1 em todos os temas; o menor é `--muted` na Lousa (6,2:1). O texto do botão primário sobre `--accent` fica em 6,1:1 ou mais.

Para **adicionar um tema**: crie o bloco `html[data-theme="novo"]` em `design.css` com os nove tokens, acrescente a chave em `themeNames` no `app.js` e em `THEMES` no `lib/users.js`, e crie uma migração que amplie o `CHECK` da coluna `users.theme`, um botão `data-theme-pick="novo"` no `#theme-menu` do `index.html` e as três variáveis `--sw-*` do `.theme-option[data-theme-pick="novo"]` (miniatura no seletor). Se o tema for escuro, inclua-o também na regra que inverte `.resource-icon`.

Os nomes antigos das folhas anteriores (`--teal`, `--teal-dark`, `--aqua`, `--violet`) continuam existindo, mas apontam para os tokens novos. **Em código novo use só os nove tokens.**

## Componentes

Todos usam só os tokens, então funcionam em qualquer tema.

- **Botão secundário** (`.ghost`, `.icon-button`, botões de ação): fundo transparente, contorno de 1 px em `--ink`; no hover vira fundo `--ink` com texto `--paper`.
- **Botão primário** (`.primary`): fundo `--accent`, texto `--accent-ink`; no hover inverte para tinta. Um por tela.
- **Campo** (`input`, `select`, `textarea`): borda `--field`, canto de 2 px, texto `--ink` em peso 400; foco com contorno de 2 px em `--accent`. Rótulo em negrito acima.
- **Cartão** (`.card`): fundo `--paper`, borda `--line`, sem sombra. Título de seção em serifa 20 px.
- **Escolha** (`.option`, `.resource`): retângulo com borda `--line`; selecionado com borda e filete interno em `--accent` e fundo `--aqua` (acento a 11% sobre `--paper`).
- **Linha de caminho do projeto** (`.crumbs`, só na Apostila e na Capa): "Meus projetos / nome do projeto · salvo às HH:MM" à esquerda; Renomear, Salvar projeto (ou Atualizar projeto) e Salvar como novo à direita. Substituiu a linha de salvar que ficava dentro do painel de resultado. O botão avisa se ainda não há prompt gerado.
- **Celular (até 900 px)**: cabeçalho com menu, logo, nome e atalho para Meus projetos; abas Dados | Resultado (`.mobile-steps`, a ativa em tinta cheia); o formulário mostra só os dados e o painel só o resultado. Ao gerar, abre sozinho na aba Resultado. O botão "Gerar prompt" (48 px) fica fixo no pé da tela, com a nota "O resultado abre na aba Resultado.". Entre 901 e 1180 px a tela empilha formulário e resultado, sem abas.
- **Menu lateral**: fundo `--bg`; item ativo com fundo `--paper` e contorno fino de `--line`, sem barra colorida.
- **Caixa de aceite** (`.terms-check`): caixa de seleção de 20 px à esquerda e texto em peso 400 com links sublinhados em `--accent`; usada no cadastro e na tela de aceite dos Termos.
- **Páginas de texto longo** (`termos.html`, `privacidade.html`, estilo em `legal.css`): coluna de 780 px, títulos em serifa, nota de rascunho com filete em `--accent`; `legal.js` aplica o tema guardado no navegador.
- **Painel de resultado**: o prompt em serifa 15 px com entrelinha 1,7, dentro de uma folha com borda.
- **Aviso e erro**: texto em `--danger` ou `--accent`, nunca só pela cor (acompanha texto claro).
- **Logo**: o mesmo desenho (`assets/icons/mapa-mental.png`) pintado por máscara CSS na classe `.logo`, assumindo a cor do tema. Use `<span class="logo">` e defina largura e `aspect-ratio: 897 / 1000`.

## Estrutura das telas

As telas seguem as pranchas de `docs/design/`. Os blocos reutilizáveis:

- **Seção plana** (`.sec`): título em serifa 20 px (`.sec-head h2`) com legenda (`.help`), separada da anterior por uma linha de 1 px, sem cartão. Para grupos de opções use `<fieldset class="sec"><legend><span class="sec-title">…</span><span class="help">…</span></legend>`.
- **Lista de opções** (`.opt-grid` com `<label class="opt"><input type="radio">…`): usada no tipo de material. A opção marcada fica em negrito.
- **Cartão de escolha** (`.option`, `.resource`): retângulo reto; selecionado, borda de 2 px em tinta. Os 12 estilos levam a miniatura de `style-art.js`.
- **Rodapé do formulário** (`.form-foot`): linha de 2 px em tinta, botão primário alto (`.primary.big`), "Limpar formulário" como botão de texto (`.textbtn`) e uma nota à direita. No celular vira uma barra fixa no pé da tela.
- **Painel de resultado** (`.out-panel`): folha com borda de tinta. Cabeçalho "Resultado" com hora, abas Prompt/Prévia (`.out-tabs`), barra de ferramentas com o grupo segmentado Copiar/TXT/JSON/PDF (`.seg`) e "Melhorar com IA" (`.outline`), o prompt em serifa e, no fim, o bloco "Gerar o material com IA" (`.ai-block`), que escolhe o formato de entrega e dispara a geração.
- **Tabela** (`.data-table`): cabeçalho em caixa-alta pequena com linha de tinta, linhas separadas por `--line`, ações em botões de contorno; a edição abre embaixo da linha.
- **Login**: duas metades. À esquerda, marca, formulário sem cartão (título com linha, "Esqueci a senha" ao lado do rótulo, botão "Mostrar" junto do campo) e rodapé; à direita, painel sempre no tema Lousa (`data-theme-scope="lousa"`) com o logo e a frase de apresentação.
- **Título de cada tela**: leva na frente o mesmo ícone do botão do menu. O `app.js` copia o `<svg>` do próprio item do menu (classe `.title-icon`), então os dois nunca divergem; ao criar uma tela nova, o ícone vem de graça se o item do menu tiver `data-view` igual ao da seção.
- **FAQ**: caixa explicativa recolhível, busca, filtro por categoria e tabela Categoria/Pergunta; a resposta abre na própria linha. No celular a tabela vira lista.
- **Abas** (`.config-tabs`, em Configurações): texto sem caixa, aba ativa com sublinhado de 2 px em `--accent` e peso 700; no celular rolam na horizontal. Painel de backup: `.backup-alert` (borda esquerda `--accent` ou `--danger`), `.backup-stat`, tabelas `.data-table` e log em `.backup-log`.
- **Menu lateral**: sem rótulos de grupo; rodapé com Tema (nome do tema à direita), Sair e o nome com o perfil.

## Miniaturas dos estilos de ilustração

Cada um dos 12 estilos do formulário tem uma miniatura em SVG (`public/style-art.js`): a mesma maçã desenhada em Cartoon, Hand-drawn, Doodle, Cartoon Educacional, Scientific Illustration, Futuristic Digital, Infográfico Moderno, Minimalista, 3D Educacional, Realista, Livro Didático e Colorido Infantil. Usar o mesmo objeto nos 12 faz a diferença de traço aparecer sem ruído. As miniaturas são monocromáticas: só `currentColor` (a tinta do tema) e `var(--paper)`, com opacidade para criar tons. O que muda entre os estilos é o traço, o preenchimento e os detalhes, nunca a cor. Não use cores fixas nelas. A ordem do array tem que seguir a de `styles` em `app.js`. Gradientes SVG precisam de `id` único (o prefixo vem de `renderStyleOptions`, porque a lista aparece em Apostila e em Capa).

## Como criar uma página nova

1. Use as classes existentes (`.view`, `.view-head`, `.card`, `.primary`, `.ghost`) antes de inventar CSS.
2. Cores só por `var(--token)`. Nada de hexadecimal fora de `design.css`.
3. Sem `style=` nem script inline (CSP). Ajustes dinâmicos por `element.style.setProperty`.
4. Sem sombra, gradiente, `transform` no hover nem canto maior que 2 px.
5. Teste nos seis temas, em 1440 px e em 390 px, e navegando só pelo teclado (o foco precisa aparecer).
6. Confira o contraste dos pares novos com os tokens antes de criar um par de cor que não esteja na tabela.

## Pranchas de referência

Em `docs/design/` estão os arquivos do desenho feito no Artifact "GeradorOne — Redesenho de UI" (formato `.dc.html`, que só abre no próprio Artifact): identidade e componentes (`Main`), `Login`, `Apostila`, `Temas`, `Usuarios` e `Mobile`. Servem de guia visual; o código de verdade é `public/design.css`. Os nomes, e-mails e textos de exemplo das pranchas são inventados.

## Pendências do redesenho

- `styles.css`, `theme.css` e `app.css` ainda carregam regras do desenho antigo, anuladas por `design.css`. O token `--field` era fundo de campo no desenho antigo e hoje é a cor da borda: ao mexer nessas folhas, nunca use `--field` como `background`.
- A prancha Mobile usa menus suspensos para tipo e estilo; no app continuam a lista de opções e os cartões, que rolam normalmente no celular.
- A prancha Temas tem também a seção "A mesma tela em três temas" (comparação lado a lado); no app só há a galeria. A tabela "cores e contraste" da prancha também ficou de fora.
