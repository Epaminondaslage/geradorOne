const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ler = arquivo => fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');

test('olho da senha: o app.js põe o botão em todo campo de senha e um só clique trata todos', () => {
  const app = ler('public/app.js');
  assert.match(app, /document\.querySelectorAll\('input\[type="password"\]'\)\.forEach\(addEyeToggle\)/);
  assert.match(app, /document\.addEventListener\('click', event => \{\s*const button = event\.target\.closest\('\.eye-toggle'\)/);
  assert.match(app, /aria-pressed/);
  assert.doesNotMatch(app, /querySelector\('#toggle-password'\)/, 'o tratamento antigo, só do login, saiu');
});

test('olho da senha: o login mantém o botão no HTML e o CSS posiciona o olho dentro do campo, sem sombra nem movimento', () => {
  const html = ler('public/index.html');
  assert.match(html, /id="toggle-password"/);
  assert.ok((html.match(/type="password"/g) || []).length >= 10, 'há vários campos de senha, todos cobertos pelo app.js');
  const css = ler('public/design.css');
  assert.match(css, /\.input-join \{ position: relative; display: block; \}/);
  assert.doesNotMatch(css.match(/\.eye-toggle[^\n]*/g).join('\n'), /box-shadow|transform|gradient/);
});
