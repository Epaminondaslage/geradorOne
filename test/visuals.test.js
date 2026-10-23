const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { renderVisuals, extractVisuals, normalizeChart, drawInBrowser } = require('../lib/visuals');

const DOC = body => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;
const CHART = '{"type":"bar","data":{"labels":["A","B"],"datasets":[{"label":"Notas","data":[3,5]}]},"options":{"plugins":{"title":{"text":"Notas da turma"}}}}';

test('visuais: sem blocos, o HTML volta igual e o navegador não é chamado', async () => {
  const html = DOC('<p>texto</p>');
  const draw = async () => { throw new Error('não devia desenhar'); };
  assert.equal(await renderVisuals(html, { draw }), html);
});

test('visuais: extrai Mermaid e gráfico, decodifica entidades e tira tags do código', () => {
  const { html, items } = extractVisuals(DOC(`<pre class="mermaid">graph TD\n A --&gt; B<br/>\n<b>x</b></pre><pre class="chartjs">${CHART}</pre>`));
  assert.equal(items.length, 2);
  assert.equal(items[0].kind, 'mermaid');
  assert.match(items[0].source, /A --> B/);
  assert.doesNotMatch(items[0].source, /<b>/);
  assert.equal(items[1].kind, 'chartjs');
  assert.equal(items[1].source.options.animation, false);
  assert.match(html, /data-gv="0"/);
  assert.match(html, /data-gv="1"/);
});

test('visuais: gráfico com tipo fora da lista, dados demais ou JSON ruim vira aviso, sem desenhar', () => {
  assert.equal(normalizeChart('{"type":"bubble","data":{"datasets":[{"data":[1]}]}}'), null);
  assert.equal(normalizeChart('nao e json'), null);
  assert.equal(normalizeChart(JSON.stringify({ type: 'line', data: { datasets: [{ data: new Array(201).fill(1) }] } })), null);
  assert.equal(normalizeChart(JSON.stringify({ type: 'line', data: { datasets: [] } })), null);
  const { html, items } = extractVisuals(DOC('<pre class="chartjs">{"type":"bubble"}</pre>'));
  assert.equal(items.length, 0);
  assert.match(html, /Não foi possível desenhar este gráfico/);
});

test('visuais: passa dos 12 blocos, os extras viram aviso', () => {
  const blocos = Array.from({ length: 14 }, (_, i) => `<pre class="mermaid">graph TD; A${i}-->B</pre>`).join('');
  const { items, html } = extractVisuals(DOC(blocos));
  assert.equal(items.length, 12);
  assert.equal((html.match(/class="gv gv-erro"/g) || []).length, 2);
});

test('visuais: troca os blocos pelo SVG e pela imagem, passa o SVG pela limpeza e não deixa script', async () => {
  const html = DOC(`<pre class="mermaid">graph TD; A-->B</pre><pre class="chartjs">${CHART}</pre>`);
  const draw = async items => items.map(item => (item.kind === 'mermaid'
    ? { ok: true, svg: '<svg><script>alert(1)</script><text>ok</text></svg>' }
    : { ok: true, png: 'data:image/png;base64,iVBORw0KGgo=' }));
  const sanitizeSvg = svg => svg.replace(/<script[\s\S]*?<\/script>/g, '');
  const out = await renderVisuals(html, { draw, sanitizeSvg });
  assert.match(out, /<figure class="gv"><svg><text>ok<\/text><\/svg><\/figure>/);
  assert.match(out, /<img alt="Gráfico: Notas da turma" src="data:image\/png;base64,iVBORw0KGgo=">/);
  assert.doesNotMatch(out, /<script/);
  assert.match(out, /<style>\.gv\{/);
});

test('visuais: PNG que não seja imagem base64 válida é descartado, e falha do navegador vira aviso', async () => {
  const html = DOC(`<pre class="chartjs">${CHART}</pre>`);
  const ruim = await renderVisuals(html, { draw: async () => [{ ok: true, png: 'javascript:alert(1)' }] });
  assert.doesNotMatch(ruim, /<img/);
  assert.match(ruim, /Não foi possível desenhar este gráfico/);
  const quebrado = await renderVisuals(html, { draw: async () => { throw new Error('sem chromium'); } });
  assert.match(quebrado, /Não foi possível desenhar este gráfico/);
});

// Desenho de verdade: só roda onde há Chromium (o contêiner tem; a máquina de desenvolvimento pode não ter).
const CHROMIUM = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';
test('visuais: Mermaid e Chart.js são desenhados de verdade no Chromium', { skip: !fs.existsSync(CHROMIUM) && 'Chromium não instalado' }, async () => {
  const results = await drawInBrowser([
    { kind: 'mermaid', source: 'graph TD; A[Início]-->B[Fim]' },
    { kind: 'chartjs', source: normalizeChart(CHART) },
    { kind: 'mermaid', source: 'isto não é mermaid ((' }
  ]);
  assert.equal(results[0].ok, true);
  assert.match(results[0].svg, /<svg/);
  assert.equal(results[1].ok, true);
  assert.match(results[1].png, /^data:image\/png;base64,/);
  assert.equal(results[2].ok, false);
});
