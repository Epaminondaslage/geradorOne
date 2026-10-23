const _fs = require('node:fs');
const _os = require('node:os');
const _path = require('node:path');
process.env.RUNTIME_DIR = _fs.mkdtempSync(_path.join(_os.tmpdir(), 'g1-server-test-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderDocument, renderPdf, escapeHtml, cleanGeneratedHtml, cleanImprovedPrompt, extractOutputText, embedImages } = require('../server');
const { createProjectStore, validateProject } = require('../lib/projects');

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

test('salva, lista, atualiza e exclui projetos por dono', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-projects-'));
  const store = createProjectStore(path.join(dir, 'projects.json'));
  const created = await store.save('u1', { name: 'Lei de Ohm', kind: 'apostila', settings: { assunto: 'Lei de Ohm' }, prompt: 'P1' });
  assert.match(created.id, /^[0-9a-f-]{36}$/);
  const updated = await store.save('u1', { id: created.id, name: 'Lei de Ohm v2', kind: 'apostila', settings: {}, prompt: 'P2' });
  assert.equal(updated.createdAt, created.createdAt);
  const list = await store.list('u1');
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Lei de Ohm v2');
  assert.equal(list[0].prompt, undefined);
  assert.equal((await store.get('u1', created.id)).prompt, 'P2');
  assert.equal(await store.get('u2', created.id), null);
  assert.deepEqual(await store.list('u2'), []);
  assert.equal(await store.remove('u2', created.id), false);
  const hijack = await store.save('u2', { id: created.id, name: 'Roubado', kind: 'apostila', settings: {}, prompt: 'X' });
  assert.notEqual(hijack.id, created.id);
  assert.equal((await store.get('u1', created.id)).name, 'Lei de Ohm v2');
  assert.equal(await store.remove('u1', created.id), true);
  assert.equal(await store.removeAllFrom('u2'), 1);
  assert.deepEqual(await store.list('u1'), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('valida projetos recebidos', () => {
  assert.throws(() => validateProject({ name: '', kind: 'apostila', settings: {} }), /nome/);
  assert.throws(() => validateProject({ name: 'X', kind: 'outro', settings: {} }), /Tipo/);
  const clean = validateProject({ id: '../etc', name: ' Capa ', kind: 'capa', settings: { titulo: 'A', nested: { x: 1 } }, prompt: 'p' });
  assert.equal(clean.id, undefined);
  assert.equal(clean.name, 'Capa');
  assert.deepEqual(clean.settings, { titulo: 'A' });
});

test('projetos criados antes do login passam para o primeiro administrador', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-orphans-'));
  const file = path.join(dir, 'projects.json');
  fs.writeFileSync(file, JSON.stringify([{ id: '11111111-1111-1111-1111-111111111111', name: 'Antigo', kind: 'capa', settings: {}, prompt: 'P', createdAt: 'a', updatedAt: 'a' }]));
  const store = createProjectStore(file);
  assert.deepEqual(await store.list('admin'), []);
  assert.equal(await store.adoptOrphans('admin'), 1);
  assert.equal((await store.list('admin'))[0].name, 'Antigo');
  assert.equal(await store.adoptOrphans('outro'), 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
