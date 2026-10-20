const test = require('node:test');
const assert = require('node:assert/strict');
const { renderDocument, renderPdf, escapeHtml, cleanGeneratedHtml, extractOutputText, embedImages } = require('../server');

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
