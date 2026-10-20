const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 1_000_000;

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

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, service: 'gerador-one' });
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

module.exports = { server, renderDocument, escapeHtml };
