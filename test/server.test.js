const _fs = require('node:fs');
const _os = require('node:os');
const _path = require('node:path');
process.env.RUNTIME_DIR = _fs.mkdtempSync(_path.join(_os.tmpdir(), 'g1-server-test-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderDocument, renderPdf, escapeHtml, cleanGeneratedHtml, cleanImprovedPrompt, extractOutputText, embedImages } = require('../server');
const { validateProject } = require('../lib/projects');

test('escapa HTML não confiável', () => {
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

test('renderiza prévia sem executar conteúdo do usuário', () => {
  const html = renderDocument({ title: '<img onerror=alert(1)>', prompt: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /lang="pt-BR"/);
});

test('gera um arquivo PDF real', async () => {
  const pdf = await renderPdf({ title: 'Teste', prompt: 'Conteúdo do prompt' });
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 500);
});

test('extrai texto da resposta da IA', () => {
  assert.equal(extractOutputText({ output: [{ content: [{ type: 'output_text', text: '<html></html>' }] }] }), '<html></html>');
});

test('limpa recursos ativos e externos do HTML gerado', () => {
  const html = cleanGeneratedHtml('```html\n<html><body onload="x()"><script>alert(1)</script><img src="https://example.com/x.png"><h1>Seguro</h1></body></html>\n```');
  assert.match(html, /<h1>Seguro<\/h1>/);
  assert.doesNotMatch(html, /script|onload|https:\/\//i);
});

test('incorpora imagens reais ao HTML final', () => {
  const html = embedImages('<html><body><h1>Aula</h1></body></html>', [{ data: 'aW1hZ2Vt' }]);
  assert.match(html, /data:image\/png;base64,aW1hZ2Vt/);
  assert.match(html, /Ilustrações do conteúdo/);
  assert.ok(html.indexOf('geradorone-ai-images') < html.indexOf('</body>'));
});

test('limpa o prompt melhorado pela IA', () => {
  assert.equal(cleanImprovedPrompt('```text\nATENÇÃO: prompt\n```'), 'ATENÇÃO: prompt');
  assert.throws(() => cleanImprovedPrompt('   '), /não devolveu um prompt/);
});

test('valida projetos recebidos', () => {
  assert.throws(() => validateProject({ name: '', kind: 'apostila', settings: {} }), /nome/);
  assert.throws(() => validateProject({ name: 'X', kind: 'outro', settings: {} }), /Tipo/);
  const clean = validateProject({ id: '../etc', name: ' Capa ', kind: 'capa', settings: { titulo: 'A', nested: { x: 1 } }, prompt: 'p' });
  assert.equal(clean.id, undefined);
  assert.equal(clean.name, 'Capa');
  assert.deepEqual(clean.settings, { titulo: 'A' });
});

test('sanitizador do HTML da IA bloqueia variações de script, eventos e endereços perigosos', () => {
  const wrap = body => cleanGeneratedHtml(`<html><head><meta charset="utf-8"><style>${body.css || ''}</style></head><body>${body.html || ''}</body></html>`);
  const dirty = {
    'evento sem espaço': '<img/onerror=alert(1) src="data:image/png;base64,AAAA">',
    'javascript:': '<a href="javascript:alert(1)">x</a>',
    'javascript: com entidade': '<a href="java&#x73;cript:alert(1)">x</a>',
    'file:': '<img src="file:///etc/passwd">',
    'data html': '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
    'http': '<img src="http://evil.example/x.png">',
    'protocolo relativo': '<link rel="stylesheet" href="//evil.example/x.css">',
    'base': '<base href="https://evil.example/">',
    'refresh': '<meta http-equiv="refresh" content="0;url=//evil.example">',
    'script sem fechar': '<script>alert(1)',
    'svg com script': '<svg><script>alert(1)</script></svg>',
    'srcset': '<img srcset="//evil.example/a.png 1x">',
    'iframe': '<iframe src="x"></iframe>',
    'form action': '<form action="//evil.example"><button formaction="//evil.example">x</button></form>',
  };
  for (const [name, html] of Object.entries(dirty)) {
    const result = wrap({ html });
    assert.doesNotMatch(result, /javascript:|file:|evil\.example|onerror|<script|<iframe|<base|http-equiv|java&#x73;|data:text/i, name);
  }
  const css = wrap({ css: 'body{background:url(http://evil.example/a.png)} .a{background:url("file:///etc/passwd")} @import url(//evil.example/x.css); .b{fill:url(#grad)} .c{background:url(data:image/png;base64,AAAA)}' });
  assert.doesNotMatch(css, /evil\.example|file:|@import/);
  assert.match(css, /url\(#grad\)/);
  assert.match(css, /url\(data:image\/png;base64,AAAA\)/);
  const clean = wrap({ html: '<a href="#topo">ir</a><img src="data:image/png;base64,AAAA" alt="ok"><p>Texto com online = 3</p>' });
  assert.match(clean, /href="#topo"/);
  assert.match(clean, /src="data:image\/png;base64,AAAA"/);
  assert.match(clean, /<meta charset="utf-8">/);
});
