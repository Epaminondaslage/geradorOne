// Idioma do prompt: o prompt pode sair num idioma diferente do da tela do app.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../public/i18n.js');
const { resolverIdioma, sobreposicao } = require('../public/idioma-prompt.js');

const raiz = path.join(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const app = ler('public/app.js');
const html = ler('public/index.html');
const css = ler('public/app.css');
const dicts = Object.fromEntries(i18n.IDIOMAS.map(l => [l.codigo, require(path.join(raiz, 'public/i18n', `${l.codigo}.js`))]));

test('idioma do prompt: sem escolha vale o idioma da tela; com escolha válida vale a escolha, mesmo diferente da tela', () => {
  assert.equal(resolverIdioma(null, 'en'), 'en');
  assert.equal(resolverIdioma('', 'de'), 'de');
  assert.equal(resolverIdioma('xx', 'it'), 'it');
  assert.equal(resolverIdioma('de', 'pt-BR'), 'de');
  assert.equal(resolverIdioma('es', 'en'), 'es');
});

test('idioma do prompt: escolher o mesmo idioma da tela volta a acompanhar a tela', () => {
  assert.equal(sobreposicao('en', 'en'), null);
  assert.equal(sobreposicao('de', 'en'), 'de');
  assert.equal(sobreposicao('xx', 'en'), null);
});

test('idioma do prompt: o app gera, melhora e exporta no idioma do prompt, e a conta continua com o idioma da tela', () => {
  assert.match(app, /const geradores = \(\) => window\.prompts\.criarGeradores\(window\.idiomaPrompt\.t, window\.idiomaPrompt\.idioma\);/);
  for (const rota of ['api/generate', 'api/render', 'api/pdf', 'api/improve']) {
    const corpo = app.match(new RegExp(`apiFetch\\('${rota}'[^\\n]*`))[0];
    assert.match(corpo, /language: window\.idiomaPrompt\.idioma/, `${rota} precisa mandar o idioma do prompt`);
    assert.doesNotMatch(corpo, /language: window\.idioma\.idioma/, rota);
  }
  assert.match(app, /postJson\('api\/auth\/language', \{ language: codigo \}\)/);
});

test('idioma do prompt: seletor nos dois formulários, acima do botão de gerar, e script carregado antes do app', () => {
  assert.equal((html.match(/data-idioma-prompt/g) || []).length, 2);
  const apostila = html.indexOf('data-idioma-prompt');
  assert.ok(apostila > 0 && apostila < html.indexOf('id="generate-button"'));
  const capa = html.lastIndexOf('data-idioma-prompt');
  assert.ok(capa > html.indexOf('id="reset-apostila"') && capa < html.indexOf('id="generate-capa"'));
  const ordem = ['i18n-ui.js', 'idioma-prompt.js', 'app.js'].map(s => html.indexOf(`<script src="${s}"`));
  assert.ok(ordem[0] > 0 && ordem[0] < ordem[1] && ordem[1] < ordem[2], 'ordem dos scripts');
});

test('idioma do prompt: título nos cinco idiomas', () => {
  const esperado = { 'pt-BR': 'Idioma do prompt', en: 'Prompt language', es: 'Idioma del prompt', de: 'Sprache des Prompts', it: 'Lingua del prompt' };
  for (const [codigo, texto] of Object.entries(esperado)) assert.equal(dicts[codigo]['idioma.prompt_titulo'], texto, codigo);
});

test('idioma do prompt: o anel que anda entre as bandeiras usa só tokens, sem sombra nem gradiente', () => {
  const bloco = css.slice(css.indexOf('/* Idioma do prompt'));
  assert.ok(bloco.length > 100, 'bloco de CSS do idioma do prompt');
  assert.doesNotMatch(bloco, /box-shadow|gradient/);
  assert.match(bloco, /\.idioma-prompt-anel \{[^}]*transform: translateX\(calc\(var\(--i\)/);
  assert.match(bloco, /border-radius: 50%/);
});
