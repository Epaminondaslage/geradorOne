# Internacionalização do GeradorOne: pt-BR, en, es, de, it

Data: 2026-10-29. Pedido do dono: o app pode ser usado em escolas internacionais no Brasil; tudo muda de idioma, inclusive a geração de prompts e o texto dentro das imagens. O português do Brasil continua o idioma nativo.

Os padrões abaixo são decisões minhas (o dono pediu para escolher); ficam marcados como tal.

## Objetivo

Um usuário escolhe o idioma na landing (bandeiras em dropdown). O app herda a escolha. Interface, FAQ, e-mails, páginas legais, prompts de apostila, de imagem e de capa, e o texto que a IA põe dentro das imagens saem no idioma escolhido.

## Fora do escopo

- Tradução automática em tempo de execução (sempre dicionários revisados).
- Conteúdo salvo pelo usuário (projetos, assunto, textos livres): não é traduzido.
- BNCC: referência brasileira. Em outro idioma, o campo continua disponível, mas o texto oficial entra no prompt em português, com nota. (Minha decisão.)
- Idiomas além dos cinco; direção RTL.

## Decisões de arquitetura (minhas)

1. **Dicionários JSON** em `public/i18n/<idioma>.json`, chaves planas em português semântico (`gerar.botao`, `erro.sessao_expirada`). `pt-BR.json` é a fonte; os outros quatro seguem as mesmas chaves. Sem biblioteca nova.
2. **Navegador:** `public/i18n.js` expõe `t(chave, params)`, `setIdioma(codigo)` e troca os textos de elementos marcados com `data-i18n`, `data-i18n-attr` (placeholder, aria-label, title). Fallback: idioma → pt-BR → chave.
3. **Escolha do idioma:** ordem de precedência: parâmetro `?lang=` na URL da landing → cookie `idioma` (1 ano, SameSite=Lax, sem dado pessoal) → conta do usuário (coluna `usuarios.idioma`) → `Accept-Language` → pt-BR. A landing grava o cookie; o app lê o mesmo cookie (mesmo domínio). Logado, a escolha também é gravada na conta.
4. **Seletor:** dropdown com bandeira + nome do idioma na própria língua (Português, English, Español, Deutsch, Italiano), acessível por teclado, botão com `aria-haspopup`, mesmo componente na landing e no app, tokens de `design.css` (sem sombra nem gradiente). Bandeiras em SVG inline (BR, GB/US, ES, DE, IT), sem CDN.
5. **Servidor:** `lib/i18n.js` com o mesmo `t()` para mensagens de erro da API, e-mails (`lib/mailer.js`, `email-template.js`) e títulos de PDF. A API devolve `code` estável além do texto traduzido, para o cliente poder traduzir sozinho.
6. **Geração de prompt:** `generatePrompt`, `generateImagePrompt` e `generateCoverPrompt` (`public/app.js`) deixam de ter texto fixo e passam a montar o prompt de gabaritos por idioma (`public/i18n/prompts/<idioma>.js`). O prompt inteiro é escrito no idioma escolhido, e o prompt de imagem inclui a instrução explícita "todo texto dentro da imagem deve estar em <idioma>" mais as palavras-chave rotuladas já traduzidas. `api/improve` e `api/generate` recebem `lang` e instruem a IA a responder nesse idioma.
7. **Texto dentro de imagens:** nunca pedir à IA que "invente" texto; o prompt traz o texto literal já traduzido entre aspas. Revisão por falante nativo antes de ligar em produção (ver riscos).
8. **Textos jurídicos e pagamento ficam só em português (decisão do dono, 29/10):** Termos, Política de Privacidade e demais textos legais não são traduzidos, porque o contrato é firmado no Brasil, pela lei brasileira. O mesmo vale para o meio de pagamento (Mercado Pago, em reais, com as telas e recibos dele). Em en, es, de e it, cada página legal e cada tela que leva a pagamento mostra a ressalva, traduzida nos quatro idiomas: "Este documento está disponível apenas em português do Brasil. O contrato é regido pela legislação brasileira e o pagamento é processado no Brasil, em reais (BRL)." `<html lang="pt-BR">` nessas páginas, mesmo com o app em outro idioma. `LEGAL_VERSION` não muda por causa da ressalva.
    Sugestões minhas (a aprovar): (a) a ressalva também aparece ao lado do checkbox de aceite no cadastro e no passo anterior ao checkout; (b) preços sempre em R$, sem conversão; (c) e-mails transacionais de cobrança e recibo seguem em português, os demais e-mails no idioma do usuário; (d) o link "Termos" abre em português em nova aba, sem redirecionar o idioma do app; (e) um resumo não vinculante nos quatro idiomas só se o advogado aprovar o texto.
9. **`<html lang>`, `hreflang`, sitemap e Open Graph** acompanham o idioma (landing, repositório comercial).
10. **Teste de paridade:** `test/i18n.test.js` falha se algum dicionário não tiver exatamente as chaves do `pt-BR.json`, se faltar parâmetro `{x}` ou se sobrar texto em português fora dos dicionários nos arquivos já migrados.

## Onde cada parte mora (dois repositórios)

- **Repositório aberto (`geradorOne`, esta branch):** motor, seletor, app inteiro, FAQ, prompts, servidor, e-mails, páginas legais, `index.html` do app.
- **Repositório comercial (`geradorone-comercial`):** a landing e as páginas comerciais. Recebe o motor por `git merge upstream/main`, depois migra a landing. Só começa depois que a fase 1 estiver mergeada aqui.

## Fases

1. **Motor + seletor + `pt-BR.json` extraído** (nenhuma mudança visível; teste de paridade e regressão em pt-BR).
2. **Interface do app** (`index.html`, `app.js`, mensagens do servidor): extração para chaves e quatro traduções.
3. **Geração de prompts** (apostila, imagem, capa, improve, generate) por gabarito de idioma, com testes por idioma.
4. **FAQ, e-mails, PDF e ressalva nas páginas legais e no caminho de pagamento** (texto legal permanece em português).
5. **Landing no repositório comercial** + `hreflang`/sitemap/SEO.
6. **Revisão por falante nativo** (en, es, de, it) e deploy no dev; produção só a pedido.

Estimativa de volume: cerca de 360 linhas de `app.js`, 200 de `index.html`, 165 de `faq-data.js`, 104 de `server.js` e arquivos de `lib/` com texto em português; da ordem de 1.500 a 2.000 chaves.

## Riscos

- Tradução de prompt altera a qualidade da geração: precisa de comparação lado a lado por idioma antes de produção.
- Texto dentro de imagem em alemão (palavras longas) pode estourar o layout: prompts pedem margens e quebra segura.
- Qualidade das traduções: eu gero, falante nativo revisa. Não publicar sem essa revisão.
- A ressalva em en/es/de/it também é texto sobre contrato: o advogado deve aprovar a redação.
