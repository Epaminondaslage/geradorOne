# Padrão de ícones de ação

Adaptado do padrão de ícones CRUD do outro produto (spec de 04/07/2026) ao tema e à pilha do GeradorOne: JS puro, sem React, e só os tokens de `public/design.css`. Vale para qualquer botão de ação de linha: tabelas, cartões e listas.

## Regra

Ação de linha é sempre um botão só com ícone e uma dica (`title`), nunca um botão de texto ("Editar", "Excluir", "Redefinir senha") e nunca emoji. Botões de formulário (Salvar, Cancelar, Gerar, Criar usuário) e botões principais de uma tela continuam com texto.

## Fonte única

- **JS:** `ACTION_ICONS`, `actionButton()` e `armAction()` em `public/app.js`. Não redefina um ícone por tela.
- **CSS:** o bloco `.act` no fim de `public/design.css`.

```js
actionButton('edit', 'edit', 'Editar usuário', `data-edit-user="${id}"`)
actionButton('del', 'trash', 'Excluir projeto', `data-delete-project="${id}"`)
```

A assinatura é `actionButton(natureza, ícone, título, atributos)`. O título vira `title` e `aria-label`.

## Anatomia do botão

- Caixa de 30 por 30 px, raio de 6 px.
- Ícone SVG de 16 px, traço de 2 px, `stroke="currentColor"`, estilo Feather (o mesmo do outro produto).
- Fundo tonal: `color-mix(cor 9%)`; borda `color-mix(cor 30%)`; ícone na cor cheia.
- Hover: o fundo sobe para 18%. Nada se move, sem sombra e sem gradiente, como em `docs/DESIGN.md`.
- Acessível: `title` e `aria-label` iguais; foco visível herdado do tema.

## Cores: só por token do tema

O outro produto usa seis cores semânticas. O GeradorOne não tem tokens de sucesso e de aviso, e o padrão visual proíbe criar cor fora de `design.css`, então a natureza da ação fica em três tokens que existem nos seis temas.

| Natureza | Classe | Token | Ações |
|---|---|---|---|
| Ação normal | `act-edit`, `act-add`, `act-on`, `act-sync`, `act-exp` | `--accent` | Editar, abrir, criar, ativar, atualizar, exportar |
| Só ver ou neutra | `act-view`, `act-off`, `act-neutral` | `--ink` | Ver detalhes, desativar, redefinir senha |
| Destrutiva | `act-del` | `--danger` | Excluir |

Desativar usa `--ink` porque não há âmbar no tema. Se um dia o tema ganhar um token de aviso, só a linha de `act-off` muda.

## Ação → ícone

| Natureza | Ícone (`ACTION_ICONS`) | Quando usar |
|---|---|---|
| `view` | `view` (olho) | Abrir ou visualizar sem editar |
| `edit` | `edit` (lápis) | Editar um registro; também abrir um projeto |
| `del` | `trash` (lixeira) | Remover, sempre com confirmação em dois cliques |
| `on` / `off` | `power` | Ativar / desativar |
| `sync` | `sync` (setas circulares) | Recarregar ou reprocessar |
| `exp` | `grid` ou `download` | Exportar planilha ou baixar arquivo |
| `add` | `plus` | Criar (um botão principal com texto "Novo ..." continua com texto) |
| `neutral` | `key` (chave) | Extra do GeradorOne: redefinir senha |

## Exclusão em dois cliques

Um botão só de ícone não tem lugar para o texto "Confirmar exclusão". Por isso o primeiro clique chama `armAction(botão, textoDeConfirmação, títuloOriginal, milissegundos)`: o botão fica sólido em `--danger`, mostra o texto de confirmação ao lado do ícone, troca `title` e `aria-label` e volta ao normal sozinho depois do prazo. O segundo clique, ainda armado, exclui. Prazos em uso: 3,5 s em projetos e 4 s em usuários.

## Fazer e não fazer

Fazer: usar `actionButton`; cor por natureza da ação; 16 px e 30 px em toda tela; ação de linha com ícone e dica.

Não fazer: emoji como ação; texto "Editar" ou "Excluir" em botão de linha; cor fixa em hexadecimal; um ícone novo copiado numa tela só; tamanhos misturados.

## Onde já vale

- Aba **Usuários** de Configurações: editar, redefinir senha e excluir.
- Tela **Meus projetos**: abrir e excluir.

## Diferenças em relação ao outro produto

- Sem componente React: o botão é uma string HTML gerada por `actionButton`, e a CSP continua sem `style=` inline.
- Sem `loading` com spinner: nenhuma ação de linha daqui precisa dele ainda.
- Sem selo de status (`IconBadge`): o app não tem esse caso. Se surgir, use a mesma caixa tonal, sem clique e sem texto.
- Sem a regra de cor por tipo de arquivo (PDF, DOCX, XLS) das Propostas, que não existe aqui.
