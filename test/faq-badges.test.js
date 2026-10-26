const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ler = arquivo => fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');

test('FAQ: as categorias viram badges que filtram, no lugar da caixa de seleção', () => {
  const html = ler('public/index.html');
  assert.match(html, /id="faq-badges"/);
  assert.doesNotMatch(html, /id="faq-category"/);
  const app = ler('public/app.js');
  assert.doesNotMatch(app, /faqCategory\b/);
  assert.match(app, /faqFiltrarPor/);
  assert.match(app, /data-faq-cat|dataset\.faqCat/);
});

test('FAQ: os badges usam só tokens do tema, sem cores fixas nem style inline', () => {
  const css = ler('public/design.css');
  const bloco = css.slice(css.indexOf('.faq-badges {'), css.indexOf('span.faq-badge { cursor: default; }') + 40);
  assert.ok(bloco.length > 200, 'bloco dos badges encontrado');
  assert.doesNotMatch(bloco, /#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/, 'sem cor fixa');
  assert.doesNotMatch(ler('public/app.js').slice(ler('public/app.js').indexOf('function faqBadge'), ler('public/app.js').indexOf('function renderFaq()')), /\.style\b|setAttribute\('style'/);
});

test('FAQ: tem uma cor para cada posição de 0 a 7 e o ativo muda de aparência', () => {
  const css = ler('public/design.css');
  for (let i = 0; i <= 7; i += 1) assert.match(css, new RegExp(`\\.faq-badge\\[data-cor="${i}"\\]`));
  assert.match(css, /\.faq-badge\[aria-pressed="true"\]/);
});
