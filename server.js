const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { URL } = require('node:url');
const PDFDocument = require('pdfkit');
const appCrypto = require('./lib/crypto');
const { createUserStore, publicUser, normalizeEmail, normalizePhone } = require('./lib/users');
const { createProjectStore, validateProject } = require('./lib/projects');
const { createLimiter } = require('./lib/rate-limit');
const { createDb } = require('./lib/db');
const { importLegacyJson } = require('./lib/legacy-import');
const { createMailer } = require('./lib/mailer');
const { checkMasterSecret } = require('./lib/secret-check');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const RUNTIME_DIR = process.env.RUNTIME_DIR || path.join(__dirname, 'runtime');
const MAX_BODY = 1_000_000;
const execFileAsync = promisify(execFile);

const PROVIDERS = ['openai', 'gemini'];
const DEFAULT_MODEL = { openai: 'gpt-6-astra', gemini: 'gemini-3.8-flash' };
const DEFAULT_IMAGE_MODEL = { openai: 'gpt-image-2.5-flare', gemini: 'gemini-3-pro-image-preview' };

const API_KEY_RE = /^[\w\-.:~+/=]{8,512}$/;

function aiConfigFor(user) {
  const ai = user.ai || {};
  const provider = PROVIDERS.includes(ai.provider) ? ai.provider : 'openai';
  let apiKey = '';
  try { apiKey = ai.keyEnc ? appCrypto.decrypt(ai.keyEnc, keyEncKey) : ''; } catch { apiKey = ''; }
  return { provider, apiKey, model: ai.model || DEFAULT_MODEL[provider], imageModel: ai.imageModel || DEFAULT_IMAGE_MODEL[provider] };
}

function publicAiConfig(user) {
  const config = aiConfigFor(user);
  return { provider: config.provider, hasApiKey: Boolean(config.apiKey), keyHint: config.apiKey ? `••••${config.apiKey.slice(-4)}` : '', model: config.model, imageModel: config.imageModel };
}

function nextAiSettings(user, partial) {
  const current = user.ai || {};
  const currentProvider = PROVIDERS.includes(current.provider) ? current.provider : 'openai';
  const next = {
    provider: PROVIDERS.includes(partial.provider) ? partial.provider : currentProvider,
    keyEnc: current.keyEnc || '',
    model: typeof partial.model === 'string' ? partial.model.trim() : current.model || '',
    imageModel: typeof partial.imageModel === 'string' ? partial.imageModel.trim() : current.imageModel || ''
  };
  const newKey = typeof partial.apiKey === 'string' ? partial.apiKey.trim() : '';
  if (newKey) next.keyEnc = appCrypto.encrypt(newKey, keyEncKey);
  if (partial.clearApiKey) next.keyEnc = '';
  if (next.provider !== currentProvider) {
    if (!newKey) next.keyEnc = '';
    if (!(typeof partial.model === 'string' && partial.model.trim())) next.model = '';
    if (!(typeof partial.imageModel === 'string' && partial.imageModel.trim())) next.imageModel = '';
  }
  return next;
}
const SESSION_COOKIE = 'g1_session';
const SESSION_DAYS = 7;
const RESET_MINUTES = 10;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

const masterSecret = appCrypto.loadMasterSecret(RUNTIME_DIR);
const sessionKey = appCrypto.deriveKey(masterSecret, 'session');
const keyEncKey = appCrypto.deriveKey(masterSecret, 'byok');
const resetKey = appCrypto.deriveKey(masterSecret, 'reset');
const db = createDb(process.env.DATABASE_URL);
const userStore = createUserStore(db);
const projectStore = createProjectStore(db);
const mailer = createMailer({ host: process.env.SMTP_HOST, port: process.env.SMTP_PORT, secure: process.env.SMTP_SECURE, requireTLS: process.env.SMTP_REQUIRE_TLS, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.SMTP_FROM });
const loginLimiter = createLimiter({ max: 8, windowMs: 15 * 60_000 });
const resetLimiter = createLimiter({ max: 5, windowMs: 15 * 60_000 });
const resets = new Map();

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return index === -1 ? [part, ''] : [part.slice(0, index), part.slice(index + 1)];
  }));
}

function cookiePath(req) {
  const prefix = String(req.headers['x-forwarded-prefix'] || '').replace(/\/+$/, '');
  return /^\/[\w\-./]*$/.test(prefix) ? `${prefix}/` : '/';
}

function sessionCookie(req, token, maxAgeSeconds) {
  const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
  return [`${SESSION_COOKIE}=${token}`, `Path=${cookiePath(req)}`, 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`, ...(secure ? ['Secure'] : [])].join('; ');
}

function issueSession(req, user) {
  const maxAge = SESSION_DAYS * 86_400;
  const token = appCrypto.signToken({ uid: user.id, v: user.pwdVersion, exp: Date.now() + maxAge * 1000 }, sessionKey);
  return { 'Set-Cookie': sessionCookie(req, token, maxAge) };
}

async function authenticate(req) {
  const payload = appCrypto.verifyToken(parseCookies(req.headers.cookie)[SESSION_COOKIE], sessionKey);
  if (!payload) return null;
  const user = await userStore.getById(payload.uid);
  return user && user.active && user.pwdVersion === payload.v ? user : null;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
}

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) throw fail(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
  if (password.length > MAX_PASSWORD) throw fail('Senha muito longa.');
  return password;
}

async function readJson(req) {
  try {
    const value = JSON.parse(await readBody(req) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError('corpo');
    return value;
  } catch (error) {
    throw error.status ? error : fail('JSON inválido.');
  }
}

async function prepare() {
  const applied = await db.migrate();
  if (applied.length) console.log(`[db] migrações aplicadas: ${applied.join(', ')}`);
  await importLegacyJson(db, RUNTIME_DIR);
}

async function ensureAdmin() {
  if (await userStore.count()) return null;
  const email = normalizeEmail(process.env.ADMIN_EMAIL || 'admin@geradorone.local');
  const given = process.env.ADMIN_PASSWORD;
  const password = given && given.length >= MIN_PASSWORD ? given : appCrypto.randomPassword();
  const admin = await userStore.create({ name: (process.env.ADMIN_NAME || '').trim() || 'Administrador', email, phone: process.env.ADMIN_PHONE || '', role: 'admin', passwordHash: await appCrypto.hashPassword(password), mustChangePassword: true, bootstrap: true });
  console.log(`[setup] Administrador criado: ${email}${password === given ? ' (senha definida em ADMIN_PASSWORD)' : ` · senha temporária: ${password}`} — a troca é exigida no primeiro acesso.`);
  return { email, password };
}

async function activeAdminCount() {
  return (await userStore.list()).filter(user => user.role === 'admin' && user.active).length;
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ...headers
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

const PDF_FONT_DIR = process.env.PDF_FONT_DIR || '/usr/share/fonts/dejavu';
const pdfFonts = fs.existsSync(path.join(PDF_FONT_DIR, 'DejaVuSans.ttf'))
  ? { regular: path.join(PDF_FONT_DIR, 'DejaVuSans.ttf'), bold: path.join(PDF_FONT_DIR, 'DejaVuSans-Bold.ttf') }
  : { regular: 'Helvetica', bold: 'Helvetica-Bold' };

function renderPdf(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 54, bottom: 54, left: 54, right: 54 }, info: { Title: String(payload.title || 'Prompt GeradorOne'), Author: 'GeradorOne' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('Body', pdfFonts.regular);
    doc.registerFont('Body-Bold', pdfFonts.bold);
    doc.font('Body-Bold').fontSize(20).fillColor('#08766f').text(String(payload.title || 'Prompt GeradorOne'));
    doc.moveDown(.5).font('Body').fontSize(10).fillColor('#62717f').text('Prompt estruturado pelo GeradorOne');
    doc.moveDown(1.2).font('Body').fontSize(9.5).fillColor('#17212b').text(String(payload.prompt || ''), { lineGap: 3, align: 'left' });
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

function extractGeminiText(response) {
  return (response?.candidates || []).flatMap(c => c?.content?.parts || []).filter(p => typeof p.text === 'string').map(p => p.text).join('\n');
}

const HTML_INSTRUCTIONS = 'Crie o material completo solicitado como um único HTML autônomo. Retorne somente o HTML, começando por <!doctype html>. Use CSS e SVG inline para todos os elementos visuais. Não use JavaScript, URLs externas, fontes externas, Mermaid, arquivos auxiliares, Markdown ou explicações. Não invente dados, fontes, citações ou códigos curriculares.';

const IMPROVE_INSTRUCTIONS = 'Você revisa prompts de geração de imagens didáticas em português do Brasil. Reescreva o prompt recebido aplicando os ajustes pedidos. Mantenha a mesma estrutura de seções e títulos, o tipo de material, o estilo visual, o formato da página, o número de páginas, o público e todas as restrições, exceto quando um ajuste pedir explicitamente para mudá-los. Não acrescente dados factuais, normas ou números que não possa garantir. Responda somente com o prompt final completo, sem comentários, sem explicações e sem Markdown.';

async function requestOpenAiText(config, instructions, input, signal) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, instructions, input })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || 'O provedor de IA recusou a solicitação.'), { status: response.status >= 500 ? 502 : 400 });
  return { text: extractOutputText(body), model: body.model || config.model };
}

async function requestGeminiText(config, instructions, input, signal) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${instructions}\n\n${input}` }] }] })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || 'O provedor de IA recusou a solicitação.'), { status: response.status >= 500 ? 502 : 400 });
  return { text: extractGeminiText(body), model: config.model };
}

async function requestAiText(config, instructions, input, timeoutMs, timeoutMessage) {
  if (!config.apiKey) throw Object.assign(new Error('Configure sua chave de API em "Modelo de IA" para usar este recurso.'), { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await (config.provider === 'gemini' ? requestGeminiText : requestOpenAiText)(config, instructions, input, controller.signal);
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error(timeoutMessage), { status: 504 });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestAiHtml(config, prompt) {
  const result = await requestAiText(config, HTML_INSTRUCTIONS, prompt, 180_000, 'A geração excedeu o tempo máximo de três minutos.');
  return { html: cleanGeneratedHtml(result.text), model: result.model };
}

function cleanImprovedPrompt(value) {
  const text = String(value || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  if (!text) throw Object.assign(new Error('A IA não devolveu um prompt.'), { status: 502 });
  return text;
}

async function improvePrompt(config, prompt, adjustments, instruction) {
  const asks = [...adjustments, instruction].filter(Boolean).map(item => `- ${item}`).join('\n');
  const result = await requestAiText(config, IMPROVE_INSTRUCTIONS, `PROMPT ATUAL:\n${prompt}\n\nAJUSTES PEDIDOS:\n${asks}`, 90_000, 'A melhoria excedeu o tempo máximo de 90 segundos.');
  return { prompt: cleanImprovedPrompt(result.text), model: result.model };
}

function imageBriefing(prompt, position, total) {
  return `Crie a ilustração educacional ${position} de ${total} para o material descrito a seguir. A imagem deve ensinar um conceito central diferente das demais, respeitar o público, a paleta e o estilo solicitados, ter composição clara e não conter textos, letras, marcas ou logotipos. Não invente dados factuais.\n\n${prompt.slice(0, 24000)}`;
}

async function requestOpenAiImage(config, prompt, position, total, signal) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      input: imageBriefing(prompt, position, total),
      tools: [{ type: 'image_generation', model: config.imageModel }],
      tool_choice: { type: 'image_generation' }
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || 'A geração de imagem foi recusada.'), { status: response.status >= 500 ? 502 : 400 });
  const image = (body.output || []).find(item => item.type === 'image_generation_call' && item.result);
  if (!image) throw Object.assign(new Error('A IA não devolveu a imagem obrigatória.'), { status: 502 });
  return { data: image.result, prompt: image.revised_prompt || `Ilustração educacional ${position}` };
}

async function requestGeminiImage(config, prompt, position, total, signal) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
    body: JSON.stringify({
      model: config.imageModel,
      input: [{ type: 'text', text: imageBriefing(prompt, position, total) }],
      response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: '4:3' }
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || 'A geração de imagem foi recusada.'), { status: response.status >= 500 ? 502 : 400 });
  const block = (body.steps || []).flatMap(step => step?.content || []).find(item => item.type === 'image' && item.data);
  if (!block) throw Object.assign(new Error('A IA não devolveu a imagem obrigatória.'), { status: 502 });
  return { data: block.data, prompt: `Ilustração educacional ${position}` };
}

async function requestAiImage(config, prompt, position, total) {
  if (!config.apiKey) throw Object.assign(new Error('Configure sua chave de API em "Modelo de IA" para usar este recurso.'), { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    return await (config.provider === 'gemini'
      ? requestGeminiImage(config, prompt, position, total, controller.signal)
      : requestOpenAiImage(config, prompt, position, total, controller.signal));
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('A geração de imagem excedeu o tempo máximo.'), { status: 504 });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function embedImages(html, images) {
  if (!images.length) return html;
  const gallery = `<style>.geradorone-ai-images{break-inside:avoid;margin:2rem 0}.geradorone-ai-images figure{margin:1.5rem 0;break-inside:avoid}.geradorone-ai-images img{display:block;width:100%;max-height:720px;object-fit:contain;border-radius:18px}.geradorone-ai-images figcaption{margin-top:.6rem;font:500 .9rem/1.5 system-ui,sans-serif;color:#52605f}</style><section class="geradorone-ai-images" aria-label="Ilustrações educacionais geradas por inteligência artificial"><h2>Ilustrações do conteúdo</h2>${images.map((image, index) => `<figure><img src="data:image/png;base64,${image.data}" alt="Ilustração educacional gerada por IA para apoiar o conceito ${index + 1}"><figcaption>Ilustração educacional ${index + 1}, criada para este material.</figcaption></figure>`).join('')}</section>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${gallery}</body>`) : `${html}${gallery}`;
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

const PASSWORD_CHANGE_ALLOWED = ['/api/auth/me', '/api/auth/change-password', '/api/auth/logout'];

async function handleAuthApi(req, res, pathname, user) {
  const method = req.method;
  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password.slice(0, MAX_PASSWORD) : '';
    const keys = [`email:${email}`, `ip:${clientIp(req)}:${email}`];
    if (keys.some(key => loginLimiter.blocked(key))) return json(res, 429, { error: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' });
    const found = email ? await userStore.getByEmail(email) : null;
    const valid = found ? await appCrypto.verifyPassword(password, found.passwordHash) : (await appCrypto.verifyDummy(password), false);
    if (!valid || !found.active) {
      keys.forEach(key => loginLimiter.hit(key));
      return json(res, 401, { error: 'Credenciais inválidas.' });
    }
    keys.forEach(key => loginLimiter.reset(key));
    return json(res, 200, { user: publicUser(found) }, issueSession(req, found));
  }
  if (method === 'POST' && pathname === '/api/auth/logout') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
  }
  if (method === 'GET' && pathname === '/api/auth/config') {
    return json(res, 200, { emailReset: mailer.enabled });
  }
  if (method === 'POST' && pathname === '/api/auth/forgot') {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const keys = [`email:${email}`, `ip:${clientIp(req)}`];
    if (keys.some(key => resetLimiter.blocked(key))) return json(res, 429, { error: 'Muitas solicitações. Aguarde 15 minutos e tente de novo.' });
    if (!mailer.enabled) return json(res, 503, { error: 'A recuperação por e-mail não está disponível. Peça ao administrador para redefinir sua senha.' });
    checkPassword(body.password);
    keys.forEach(key => resetLimiter.hit(key));
    const found = email ? await userStore.getByEmail(email) : null;
    if (found && found.active) {
      const code = appCrypto.randomCode();
      resets.set(email, { codeHash: appCrypto.hmacHex(code, resetKey), passwordHash: await appCrypto.hashPassword(body.password), expiresAt: Date.now() + RESET_MINUTES * 60_000, attempts: 0 });
      try { await mailer.sendResetCode(found.email, code, RESET_MINUTES); } catch (error) { console.error('Falha ao enviar e-mail de redefinição:', error.message); }
    }
    return json(res, 200, { ok: true, message: 'Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos válido por 10 minutos.' });
  }
  if (method === 'POST' && pathname === '/api/auth/confirm') {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const keys = [`email:${email}`, `ip:${clientIp(req)}`];
    if (keys.some(key => resetLimiter.blocked(key))) return json(res, 429, { error: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' });
    const entry = resets.get(email);
    const invalid = () => { keys.forEach(key => resetLimiter.hit(key)); return json(res, 400, { error: 'Código inválido ou expirado.' }); };
    if (!entry || entry.expiresAt < Date.now()) { resets.delete(email); return invalid(); }
    entry.attempts += 1;
    if (entry.attempts > 5) { resets.delete(email); return invalid(); }
    if (!appCrypto.safeEqualHex(appCrypto.hmacHex(String(body.code || '').trim(), resetKey), entry.codeHash)) return invalid();
    resets.delete(email);
    const target = await userStore.getByEmail(email);
    if (!target || !target.active) return invalid();
    await userStore.update(target.id, { passwordHash: entry.passwordHash, mustChangePassword: false });
    return json(res, 200, { ok: true, message: 'Senha redefinida. Entre com a nova senha.' });
  }
  if (method === 'GET' && pathname === '/api/auth/me') {
    return json(res, 200, { user: publicUser(user), emailReset: mailer.enabled });
  }
  if (method === 'POST' && pathname === '/api/auth/change-password') {
    const body = await readJson(req);
    if (!(await appCrypto.verifyPassword(String(body.current || ''), user.passwordHash))) return json(res, 400, { error: 'A senha atual está incorreta.' });
    checkPassword(body.password);
    if (body.password === body.current) return json(res, 400, { error: 'A nova senha precisa ser diferente da atual.' });
    const updated = await userStore.update(user.id, { passwordHash: await appCrypto.hashPassword(body.password), mustChangePassword: false });
    return json(res, 200, { user: publicUser(updated) }, issueSession(req, updated));
  }
  if (method === 'POST' && pathname === '/api/auth/profile') {
    const body = await readJson(req);
    if (!normalizePhone(body.phone)) throw fail('Informe o telefone.');
    const updated = await userStore.update(user.id, { name: body.name, phone: body.phone, keepSessions: true });
    return json(res, 200, { user: publicUser(updated) });
  }
  return false;
}

async function handleUsersApi(req, res, pathname, user) {
  if (user.role !== 'admin') return json(res, 403, { error: 'Apenas administradores podem gerenciar usuários.' });
  const method = req.method;
  const [, , , id, action] = pathname.split('/');
  if (method === 'GET' && !id) return json(res, 200, { users: (await userStore.list()).map(publicUser) });
  if (method === 'POST' && !id) {
    const body = await readJson(req);
    if (!body.password) throw fail('Informe a senha temporária do usuário.');
    const password = checkPassword(body.password);
    const created = await userStore.create({ name: body.name, email: body.email, phone: body.phone, role: body.role || 'user', passwordHash: await appCrypto.hashPassword(password), mustChangePassword: true });
    return json(res, 200, { user: publicUser(created) });
  }
  const target = id ? await userStore.getById(id) : null;
  if (!target) return json(res, 404, { error: 'Usuário não encontrado.' });
  if (method === 'PUT' && !action) {
    const body = await readJson(req);
    const patch = {};
    ['name', 'email', 'phone'].forEach(key => { if (body[key] !== undefined) patch[key] = body[key]; });
    const losesAdmin = target.role === 'admin' && target.active && ((body.role !== undefined && body.role !== 'admin') || body.active === false);
    if (target.id === user.id && (body.role !== undefined && body.role !== target.role || body.active === false)) return json(res, 409, { error: 'Você não pode alterar o próprio perfil ou desativar a própria conta.' });
    if (losesAdmin && (await activeAdminCount()) <= 1) return json(res, 409, { error: 'É preciso manter ao menos um administrador ativo.' });
    if (body.role !== undefined) patch.role = body.role;
    if (body.active !== undefined) patch.active = Boolean(body.active);
    return json(res, 200, { user: publicUser(await userStore.update(target.id, patch)) });
  }
  if (method === 'POST' && action === 'reset-password') {
    const body = await readJson(req);
    const generated = !body.password;
    const password = generated ? appCrypto.randomPassword() : checkPassword(body.password);
    const updated = await userStore.update(target.id, { passwordHash: await appCrypto.hashPassword(password), mustChangePassword: true });
    return json(res, 200, { user: publicUser(updated), temporaryPassword: generated ? password : undefined });
  }
  if (method === 'DELETE' && !action) {
    if (target.id === user.id) return json(res, 409, { error: 'Você não pode excluir a própria conta.' });
    if (target.role === 'admin' && target.active && (await activeAdminCount()) <= 1) return json(res, 409, { error: 'É preciso manter ao menos um administrador ativo.' });
    const removedProjects = await projectStore.countFor(target.id);
    await userStore.remove(target.id);
    return json(res, 200, { ok: true, removedProjects });
  }
  return json(res, 405, { error: 'Método não permitido.' });
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      try { await db.ping(); } catch { return json(res, 503, { ok: false, service: 'gerador-one', db: false }); }
      return json(res, 200, { ok: true, service: 'gerador-one', db: true });
    }
    if (req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'Origem não permitida.' });
    const isPublicAuth = ['/api/auth/login', '/api/auth/logout', '/api/auth/config', '/api/auth/forgot', '/api/auth/confirm'].includes(pathname);
    if (isPublicAuth) return await handleAuthApi(req, res, pathname, null);
    const user = await authenticate(req);
    if (!user) return json(res, 401, { error: 'Sessão expirada. Entre novamente.' });
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.includes(pathname)) return json(res, 403, { error: 'Troque a senha para continuar.', code: 'PASSWORD_CHANGE_REQUIRED' });
    if (pathname.startsWith('/api/auth/')) return await handleAuthApi(req, res, pathname, user);
    if (pathname === '/api/users' || pathname.startsWith('/api/users/')) return await handleUsersApi(req, res, pathname, user);
    return await handleAppApi(req, res, pathname, user);
  } catch (error) {
    if (!error.status) console.error('Falha na API:', error.message);
    return json(res, error.status || 500, { error: error.status ? error.message : 'Erro interno. Tente novamente.' });
  }
}

async function handleAppApi(req, res, pathname, user) {
  if (req.method === 'GET' && pathname === '/api/ai/status') {
    const config = aiConfigFor(user);
    return json(res, 200, { available: Boolean(config.apiKey), provider: config.provider === 'gemini' ? 'Gemini' : 'OpenAI', model: config.apiKey ? config.model : null });
  }
  if (req.method === 'GET' && pathname === '/api/ai/config') return json(res, 200, publicAiConfig(user));
  if (req.method === 'POST' && pathname === '/api/ai/config') {
    const payload = await readJson(req);
    if (payload.provider !== undefined && !PROVIDERS.includes(payload.provider)) throw fail('Provedor inválido.');
    if (payload.apiKey !== undefined && (typeof payload.apiKey !== 'string' || (payload.apiKey.trim() && !API_KEY_RE.test(payload.apiKey.trim())))) throw fail('Chave com formato inválido.');
    for (const key of ['model', 'imageModel']) {
      if (payload[key] !== undefined && (typeof payload[key] !== 'string' || payload[key].length > 100)) throw fail('Nome de modelo inválido.');
    }
    const updated = await userStore.update(user.id, { ai: nextAiSettings(user, payload), keepSessions: true });
    return json(res, 200, publicAiConfig(updated));
  }
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
  if (pathname === '/api/projects' || pathname.startsWith('/api/projects/')) {
    try {
      const id = pathname.slice('/api/projects/'.length);
      if (req.method === 'GET' && pathname === '/api/projects') return json(res, 200, { projects: await projectStore.list(user.id) });
      if (req.method === 'POST' && pathname === '/api/projects') {
        const saved = await projectStore.save(user.id, validateProject(JSON.parse(await readBody(req) || '{}')));
        return json(res, 200, { project: saved });
      }
      if (req.method === 'GET' && id) {
        const project = await projectStore.get(user.id, id);
        return project ? json(res, 200, { project }) : json(res, 404, { error: 'Projeto não encontrado.' });
      }
      if (req.method === 'DELETE' && id) {
        return (await projectStore.remove(user.id, id)) ? json(res, 200, { ok: true }) : json(res, 404, { error: 'Projeto não encontrado.' });
      }
      return json(res, 405, { error: 'Método não permitido.' });
    } catch (error) {
      if (!error.status) console.error('Falha em projetos:', error.message);
      return json(res, error.status || (error instanceof SyntaxError ? 400 : 500), { error: error.status ? error.message : error instanceof SyntaxError ? 'JSON inválido.' : 'Não foi possível acessar os projetos.' });
    }
  }
  if (req.method === 'POST' && pathname === '/api/improve') {
    try {
      const payload = JSON.parse(await readBody(req) || '{}');
      if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return json(res, 400, { error: 'O prompt é obrigatório.' });
      const adjustments = Array.isArray(payload.adjustments) ? payload.adjustments.filter(item => typeof item === 'string' && item.trim()).slice(0, 10).map(item => item.trim().slice(0, 300)) : [];
      const instruction = typeof payload.instruction === 'string' ? payload.instruction.trim().slice(0, 1000) : '';
      if (!adjustments.length && !instruction) return json(res, 400, { error: 'Escolha ao menos um ajuste ou escreva uma instrução.' });
      return json(res, 200, await improvePrompt(aiConfigFor(user), payload.prompt, adjustments, instruction));
    } catch (error) {
      console.error('Falha ao melhorar prompt:', error.message);
      return json(res, error.status || 500, { error: error.status ? error.message : 'Não foi possível melhorar o prompt com IA.' });
    }
  }
  if (req.method === 'POST' && pathname === '/api/generate') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return json(res, 400, { error: 'O prompt é obrigatório.' });
      if (!['pdf', 'html'].includes(payload.format)) return json(res, 400, { error: 'Formato de saída inválido.' });
      const config = aiConfigFor(user);
      const generated = await requestAiHtml(config, payload.prompt);
      const imageCount = payload.generateImages ? Math.max(1, Math.min(3, Number(payload.imageCount) || 1)) : 0;
      const images = imageCount ? await Promise.all(Array.from({ length: imageCount }, (_, index) => requestAiImage(config, payload.prompt, index + 1, imageCount))) : [];
      generated.html = embedImages(generated.html, images);
      const safeName = String(payload.title || 'material-didatico').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 70).toLowerCase() || 'material-didatico';
      const imageFiles = images.map((image, index) => ({ name: `${safeName}-ilustracao-${index + 1}.png`, mimeType: 'image/png', encoding: 'base64', data: image.data }));
      if (payload.format === 'pdf') {
        const pdf = await htmlToPdf(generated.html);
        return json(res, 200, { model: generated.model, files: [{ name: `${safeName}.pdf`, mimeType: 'application/pdf', encoding: 'base64', data: pdf.toString('base64') }, ...imageFiles] });
      }
      return json(res, 200, { model: generated.model, files: [{ name: `${safeName}.html`, mimeType: 'text/html;charset=utf-8', encoding: 'base64', data: Buffer.from(generated.html).toString('base64'), preview: generated.html }, ...imageFiles] });
    } catch (error) {
      console.error('Falha na geração por IA:', error.message);
      return json(res, error.status || 500, { error: error.status ? error.message : 'Não foi possível gerar o material com IA.' });
    }
  }
  return false;
}

async function handleRequest(req, res) {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return json(res, 400, { error: 'Endereço inválido.' });
  }
  if (url.pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, url.pathname);
    if (handled === false) json(res, 404, { error: 'Rota não encontrada.' });
    return;
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  let decoded;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    return json(res, 400, { error: 'Endereço inválido.' });
  }
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
}

// Nenhuma falha em uma requisição pode derrubar o processo: erro inesperado vira 500.
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(error => {
    console.error('Falha ao atender a requisição:', error.message);
    if (!res.headersSent) json(res, 500, { error: 'Erro interno. Tente novamente.' });
    else res.end();
  });
});

if (require.main === module) {
  Promise.resolve()
    .then(() => {
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida. Configure a conexão com o Postgres (veja o compose.yaml e o README).');
      const outcome = checkMasterSecret(RUNTIME_DIR, masterSecret, { allowNew: process.env.ALLOW_NEW_SECRET === 'true' });
      if (outcome === 'replaced') console.warn('[aviso] Chave mestra nova aceita (ALLOW_NEW_SECRET=true). Chaves de IA antigas ficaram ilegíveis e as sessões foram encerradas; remova ALLOW_NEW_SECRET do .env.');
    })
    .then(prepare)
    .then(ensureAdmin)
    .then(() => server.listen(PORT, HOST, () => console.log(`GeradorOne: http://${HOST}:${PORT}`)))
    .catch(error => { console.error(`[erro] ${error.message}`); process.exit(1); });
  const shutdown = () => { server.close(() => db.close().finally(() => process.exit(0))); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { server, prepare, ensureAdmin, db, userStore, projectStore, mailer, renderDocument, renderPdf, escapeHtml, cleanGeneratedHtml, cleanImprovedPrompt, extractOutputText, htmlToPdf, embedImages, createProjectStore, validateProject };
