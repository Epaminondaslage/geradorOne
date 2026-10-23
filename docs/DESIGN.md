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

São seis combinações de cores aplicadas ao mesmo app. O tema fica em `<html data-theme="...">` e a escolha fica salva **na conta**, na coluna `users.theme` (vazia = ainda não escolheu), pela rota `POST /api/auth/theme`. Ao entrar, o app aplica o tema da conta. O `localStorage` (`apostila-theme`) só guarda uma cópia para a tela de login e para quem ainda não escolheu. Sem escolha, vale a preferência do sistema: escuro vira Grafite, claro vira Papel. Valores antigos (`light`, `dark`) são convertidos.

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
- **Menu lateral**: fundo `--bg`; item ativo com fundo `--paper` e contorno fino de `--line`, sem barra colorida.
- **Painel de resultado**: o prompt em serifa 15 px com entrelinha 1,7, dentro de uma folha com borda.
- **Aviso e erro**: texto em `--danger` ou `--accent`, nunca só pela cor (acompanha texto claro).
- **Logo**: o mesmo desenho (`assets/icons/mapa-mental.png`) pintado por máscara CSS na classe `.logo`, assumindo a cor do tema. Use `<span class="logo">` e defina largura e `aspect-ratio: 897 / 1000`.

## Miniaturas dos estilos de ilustração

Cada um dos 12 estilos do formulário tem uma miniatura em SVG (`public/style-art.js`): a mesma maçã desenhada em Cartoon, Hand-drawn, Doodle, Cartoon Educacional, Scientific Illustration, Futuristic Digital, Infográfico Moderno, Minimalista, 3D Educacional, Realista, Livro Didático e Colorido Infantil. Usar o mesmo objeto nos 12 faz a diferença de traço aparecer sem ruído. O traço usa `currentColor` e acompanha o tema; as cores fixas (vermelho, verde, arco-íris) só aparecem nos estilos que dependem delas. A ordem do array tem que seguir a de `styles` em `app.js`. Gradientes SVG precisam de `id` único (o prefixo vem de `renderStyleOptions`, porque a lista aparece em Apostila e em Capa).

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

- `styles.css`, `theme.css` e `app.css` ainda carregam regras do desenho antigo, anuladas por `design.css`. Dá para enxugá-las aos poucos.
- Falta a tela de Usuários em tabela como no desenho (hoje são cartões).
