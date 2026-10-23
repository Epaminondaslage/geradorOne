// Desenha diagramas Mermaid e gráficos Chart.js que a IA descreve no HTML da apostila.
// A IA só escreve texto declarativo (<pre class="mermaid"> e <pre class="chartjs">); quem desenha são as bibliotecas locais de vendor/,
// numa página nossa no Chromium sem rede. O resultado volta como SVG ou imagem PNG embutida: o HTML final nunca ganha script.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const VENDOR_DIR = path.join(__dirname, '..', 'vendor');
const MAX_VISUALS = 12;
const MAX_SOURCE = 20_000;
const CHART_TYPES = new Set(['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter']);
const MAX_DATASETS = 8;
const MAX_POINTS = 200;

const BLOCK = /<pre\b[^>]*\bclass\s*=\s*["'][^"']*\b(mermaid|chartjs)\b[^"']*["'][^>]*>([\s\S]*?)<\/pre\s*>/gi;

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&amp;': '&' };
function decode(text) {
  return text.replace(/&(?:lt|gt|quot|amp|#39|#x27);/g, entity => ENTITIES[entity]);
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Confere o JSON do gráfico e fixa o que não pode variar (tamanho, animação, tipos aceitos). Devolve null se não servir.
function normalizeChart(source) {
  let config;
  try { config = JSON.parse(source); } catch { return null; }
  if (!config || typeof config !== 'object' || !CHART_TYPES.has(config.type)) return null;
  const datasets = config.data?.datasets;
  if (!Array.isArray(datasets) || !datasets.length || datasets.length > MAX_DATASETS) return null;
  if (datasets.some(set => !set || !Array.isArray(set.data) || set.data.length > MAX_POINTS)) return null;
  if (Array.isArray(config.data.labels) && config.data.labels.length > MAX_POINTS) return null;
  const options = config.options && typeof config.options === 'object' ? config.options : {};
  return { type: config.type, data: config.data, options: { ...options, animation: false, responsive: false, maintainAspectRatio: false, events: [] } };
}

// Troca cada bloco por um marcador e devolve o que precisa ser desenhado.
function extractVisuals(html) {
  const items = [];
  const marked = html.replace(BLOCK, (whole, kind) => {
    const source = decode(whole.replace(/^<pre\b[^>]*>|<\/pre\s*>$/gi, '').replace(/<(?!br\s*\/?>)[^>]*>/gi, '')).trim();
    const index = items.length;
    if (index >= MAX_VISUALS || !source || source.length > MAX_SOURCE) return fallback(kind.toLowerCase(), source);
    const type = kind.toLowerCase();
    const payload = type === 'chartjs' ? normalizeChart(source) : source;
    if (!payload) return fallback(type, source);
    items.push({ kind: type, source: payload });
    return `<div data-gv="${index}"></div>`;
  });
  return { html: marked, items };
}

function fallback(kind, source) {
  const label = kind === 'chartjs' ? 'gráfico' : 'diagrama';
  return `<figure class="gv gv-erro"><figcaption>Não foi possível desenhar este ${label}.</figcaption><pre>${escapeHtml(source.slice(0, 2000))}</pre></figure>`;
}

function renderPage(items) {
  const data = JSON.stringify(items).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="stage"></div>
<script src="${path.join(VENDOR_DIR, 'mermaid.min.js')}"></script>
<script src="${path.join(VENDOR_DIR, 'chart.umd.min.js')}"></script>
<script type="application/json" id="in">${data}</script>
<script>
(async () => {
  const items = JSON.parse(document.getElementById('in').textContent);
  const stage = document.getElementById('stage');
  const mm = globalThis.mermaid && (globalThis.mermaid.default || globalThis.mermaid);
  if (mm) mm.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, flowchart: { htmlLabels: false }, theme: 'default', fontFamily: 'DejaVu Sans, sans-serif', maxTextSize: 20000, maxEdges: 300 });
  Chart.defaults.font.family = 'DejaVu Sans, sans-serif';
  Chart.defaults.color = '#17212b';
  Chart.defaults.font.size = 24;
  const results = [];
  for (let i = 0; i < items.length; i++) {
    try {
      if (items[i].kind === 'mermaid') {
        const { svg } = await mm.render('gv' + i, items[i].source, stage);
        results.push({ ok: true, svg });
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = 1200; canvas.height = 675;
        stage.append(canvas);
        const chart = new Chart(canvas.getContext('2d'), items[i].source);
        chart.update('none');
        results.push({ ok: true, png: canvas.toDataURL('image/png') });
      }
    } catch (error) {
      results.push({ ok: false });
    }
  }
  const out = document.createElement('script');
  out.type = 'application/json';
  out.id = 'out';
  out.textContent = JSON.stringify(results).replace(/</g, '\\\\u003c');
  document.body.append(out);
})();
</script></body></html>`;
}

// Abre a página de desenho no Chromium (sem rede, sem sandbox de usuário, como no PDF) e lê o resultado do DOM.
async function drawInBrowser(items) {
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'geradorone-gv-'));
  const pagePath = path.join(workDir, 'visuals.html');
  try {
    await fs.promises.writeFile(pagePath, renderPage(items), { mode: 0o600 });
    const { stdout } = await execFileAsync(process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser', [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-extensions',
      '--host-resolver-rules=MAP * ~NOTFOUND', '--virtual-time-budget=30000',
      `--user-data-dir=${path.join(workDir, 'chrome')}`, '--dump-dom', `file://${pagePath}`
    ], { timeout: 60_000, maxBuffer: 60_000_000, env: { PATH: process.env.PATH, HOME: os.tmpdir(), LANG: 'C.UTF-8' } });
    const match = stdout.match(/<script type="application\/json" id="out">([\s\S]*?)<\/script>/);
    if (!match) throw new Error('o navegador não devolveu o resultado');
    const results = JSON.parse(match[1]);
    if (!Array.isArray(results) || results.length !== items.length) throw new Error('resultado incompleto');
    return results;
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
}

const STYLE = '<style>.gv{margin:1.2rem 0;break-inside:avoid;text-align:center}.gv svg,.gv img{max-width:100%;height:auto}.gv-erro{border:1px solid #c6cdd4;padding:.8rem;text-align:left;font-size:.9rem}.gv-erro pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>';

function chartAlt(source) {
  const title = source.options?.plugins?.title?.text;
  return escapeHtml(typeof title === 'string' && title ? `Gráfico: ${title}` : 'Gráfico');
}

// `draw` e `sanitizeSvg` são injetáveis (testes e limpeza compartilhada com o resto do HTML gerado).
async function renderVisuals(html, { draw = drawInBrowser, sanitizeSvg = svg => svg } = {}) {
  const { html: marked, items } = extractVisuals(html);
  if (!items.length && marked === html) return html;
  let results = [];
  if (items.length) {
    try { results = await draw(items); } catch (error) {
      console.error('Falha ao desenhar diagramas e gráficos:', error.message);
      results = items.map(() => ({ ok: false }));
    }
  }
  let out = marked.replace(/<div data-gv="(\d+)"><\/div>/g, (marker, indexText) => {
    const index = Number(indexText);
    const item = items[index];
    const result = results[index];
    if (result?.ok && item.kind === 'mermaid' && typeof result.svg === 'string') return `<figure class="gv">${sanitizeSvg(result.svg)}</figure>`;
    if (result?.ok && item.kind === 'chartjs' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(result.png || '')) return `<figure class="gv"><img alt="${chartAlt(item.source)}" src="${result.png}"></figure>`;
    return fallback(item.kind, item.kind === 'chartjs' ? JSON.stringify(item.source.data) : item.source);
  });
  out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${STYLE}</head>`) : `${STYLE}${out}`;
  return out;
}

module.exports = { renderVisuals, extractVisuals, normalizeChart, drawInBrowser };
