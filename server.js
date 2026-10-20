const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { URL } = require('node:url');
const PDFDocument = require('pdfkit');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 1_000_000;
const execFileAsync = promisify(execFile);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
      if (data.length > MAX_BODY) reject(Object.assign(new Error('Corpo muito grande'), { status: 413 }));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderDocument(payload) {
  const title = escapeHtml(payload.title || 'Material didático');
  const prompt = escapeHtml(payload.prompt || '').replace(/\n/g, '<br>');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:auto;padding:48px;color:#17212b}h1{color:#087f78}.box{background:#f1faf9;border:1px solid #c5e7e3;border-radius:16px;padding:24px}@media print{body{padding:0}.box{border:0}}</style></head><body><h1>${title}</h1><p>Roteiro estruturado para geração do material.</p><div class="box">${prompt}</div></body></html>`;
}

function renderPdf(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 54, bottom: 54, left: 54, right: 54 }, info: { Title: String(payload.title || 'Prompt GeradorOne'), Author: 'GeradorOne' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#08766f').text(String(payload.title || 'Prompt GeradorOne'));
    doc.moveDown(.5).font('Helvetica').fontSize(10).fillColor('#62717f').text('Prompt estruturado pelo GeradorOne');
    doc.moveDown(1.2).font('Helvetica').fontSize(9.5).fillColor('#17212b').text(String(payload.prompt || ''), { lineGap: 3, align: 'left' });
    doc.end();
  });
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  return (response?.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text || '').join('\n');
}

function cleanGeneratedHtml(value) {
  let html = String(value || '').trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
  const first = html.search(/<!doctype html|<html/i);
  if (first > 0) html = html.slice(first);
  if (!/<html[\s>]/i.test(html)) throw Object.assign(new Error('A IA não devolveu um documento HTML válido.'), { status: 502 });
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)>/gi, '')
    .replace(/<(?:iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:src|href)\s*=\s*(["'])\s*(?:https?:)?\/\/[^"']*\1/gi, '')
    .replace(/url\(\s*(["']?)(?:https?:)?\/\/[^)]*\)/gi, 'none')
    .replace(/@import\s+[^;]+;/gi, '');
}

async function requestAiHtml(prompt) {
  if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error('A IA ainda não foi configurada no servidor.'), { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-6-astra',
        instructions: 'Crie o material completo solicitado como um único HTML autônomo. Retorne somente o HTML, começando por <!doctype html>. Use CSS e SVG inline para todos os elementos visuais. Não use JavaScript, URLs externas, fontes externas, Mermaid, arquivos auxiliares, Markdown ou explicações. Não invente dados, fontes, citações ou códigos curriculares.',
        input: prompt
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body?.error?.message || 'O provedor de IA recusou a solicitação.'), { status: response.status >= 500 ? 502 : 400 });
    return { html: cleanGeneratedHtml(extractOutputText(body)), model: body.model || process.env.OPENAI_MODEL || 'OpenAI' };
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('A geração excedeu o tempo máximo de três minutos.'), { status: 504 });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function htmlToPdf(html) {
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'geradorone-'));
  const htmlPath = path.join(workDir, 'material.html');
  const pdfPath = path.join(workDir, 'material.pdf');
  try {
    await fs.promises.writeFile(htmlPath, html, { mode: 0o600 });
    await execFileAsync(process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser', [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking',
      `--user-data-dir=${path.join(workDir, 'chrome')}`, '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`
    ], { timeout: 90_000, maxBuffer: 1_000_000, env: { ...process.env, HOME: os.tmpdir() } });
    return await fs.promises.readFile(pdfPath);
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, service: 'gerador-one' });
  if (req.method === 'GET' && pathname === '/api/ai/status') return json(res, 200, { available: Boolean(process.env.OPENAI_API_KEY), provider: 'OpenAI', model: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || 'gpt-6-astra') : null });
  if (req.method === 'POST' && pathname === '/api/render') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return json(res, 400, { error: 'O prompt é obrigatório.' });
      const html = renderDocument(payload);
      return json(res, 200, { html, renderer: 'preview', note: 'Prévia segura. A geração por IA e o PDF devem ser conectados no servidor.' });
    } catch (error) {
      return json(res, error.status || 400, { error: error.status === 413 ? error.message : 'JSON inválido.' });
    }
  }
  if (req.method === 'POST' && pathname === '/api/pdf') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return json(res, 400, { error: 'O prompt é obrigatório.' });
      const pdf = await renderPdf(payload);
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="prompt-geradorone.pdf"', 'Content-Length': pdf.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
      res.end(pdf);
      return true;
    } catch (error) {
      return json(res, error.status || 400, { error: error.status === 413 ? error.message : 'Não foi possível gerar o PDF.' });
    }
  }
  if (req.method === 'POST' && pathname === '/api/generate') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return json(res, 400, { error: 'O prompt é obrigatório.' });
      if (!['pdf', 'html'].includes(payload.format)) return json(res, 400, { error: 'Formato de saída inválido.' });
      const generated = await requestAiHtml(payload.prompt);
      const safeName = String(payload.title || 'material-didatico').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 70).toLowerCase() || 'material-didatico';
      if (payload.format === 'pdf') {
        const pdf = await htmlToPdf(generated.html);
        return json(res, 200, { model: generated.model, files: [{ name: `${safeName}.pdf`, mimeType: 'application/pdf', encoding: 'base64', data: pdf.toString('base64') }] });
      }
      return json(res, 200, { model: generated.model, files: [{ name: `${safeName}.html`, mimeType: 'text/html;charset=utf-8', encoding: 'base64', data: Buffer.from(generated.html).toString('base64'), preview: generated.html }] });
    } catch (error) {
      console.error('Falha na geração por IA:', error.message);
      return json(res, error.status || 500, { error: error.status ? error.message : 'Não foi possível gerar o material com IA.' });
    }
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, url.pathname);
    if (handled === false) json(res, 404, { error: 'Rota não encontrada.' });
    return;
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const decoded = decodeURIComponent(requested);
  const filePath = path.resolve(PUBLIC_DIR, `.${decoded}`);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) return json(res, 403, { error: 'Acesso negado.' });
  fs.readFile(filePath, (error, data) => {
    if (error) return json(res, error.code === 'ENOENT' ? 404 : 500, { error: 'Arquivo não encontrado.' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    res.end(data);
  });
});

if (require.main === module) server.listen(PORT, HOST, () => console.log(`GeradorOne: http://${HOST}:${PORT}`));

module.exports = { server, renderDocument, renderPdf, escapeHtml, cleanGeneratedHtml, extractOutputText, htmlToPdf };
