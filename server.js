const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { URL } = require('node:url');
const crypto = require('node:crypto');
const PDFDocument = require('pdfkit');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const RUNTIME_DIR = path.join(__dirname, 'runtime');
const RUNTIME_CONFIG_PATH = path.join(RUNTIME_DIR, 'ai-config.json');
const MAX_BODY = 1_000_000;
const execFileAsync = promisify(execFile);

const PROVIDERS = ['openai', 'gemini'];
const DEFAULT_MODEL = { openai: 'gpt-6-astra', gemini: 'gemini-3.8-flash' };
const DEFAULT_IMAGE_MODEL = { openai: 'gpt-image-2.5-flare', gemini: 'gemini-3-pro-image-preview' };

function readRuntimeAiConfig() {
  try {
    const raw = fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      provider: PROVIDERS.includes(parsed.provider) ? parsed.provider : 'openai',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : '',
      imageModel: typeof parsed.imageModel === 'string' && parsed.imageModel.trim() ? parsed.imageModel.trim() : ''
    };
  } catch {
    return { provider: 'openai', apiKey: '', model: '', imageModel: '' };
  }
}

function getAiConfig() {
  const runtime = readRuntimeAiConfig();
  const provider = runtime.provider;
  const envKey = provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
  return {
    provider,
    apiKey: runtime.apiKey || envKey || '',
    model: runtime.model || DEFAULT_MODEL[provider],
    imageModel: runtime.imageModel || DEFAULT_IMAGE_MODEL[provider]
  };
}

async function writeRuntimeAiConfig(partial) {
  const current = readRuntimeAiConfig();
  const next = {
    provider: PROVIDERS.includes(partial.provider) ? partial.provider : current.provider,
    apiKey: typeof partial.apiKey === 'string' && partial.apiKey.trim() ? partial.apiKey.trim() : current.apiKey,
    model: typeof partial.model === 'string' ? partial.model.trim() : current.model,
    imageModel: typeof partial.imageModel === 'string' ? partial.imageModel.trim() : current.imageModel
  };
  if (partial.clearApiKey) next.apiKey = '';
  if (partial.provider && partial.provider !== current.provider) {
    if (!(typeof partial.apiKey === 'string' && partial.apiKey.trim())) next.apiKey = '';
    if (!(typeof partial.model === 'string' && partial.model.trim())) next.model = '';
    if (!(typeof partial.imageModel === 'string' && partial.imageModel.trim())) next.imageModel = '';
  }
  await fs.promises.mkdir(RUNTIME_DIR, { recursive: true, mode: 0o700 });
  await fs.promises.writeFile(RUNTIME_CONFIG_PATH, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

const PROJECT_KINDS = ['apostila', 'capa'];
const MAX_PROJECTS = 500;

function createProjectStore(filePath) {
  let queue = Promise.resolve();
  const read = async () => {
    try {
      const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const write = async projects => {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const tmp = `${filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(projects), { mode: 0o600 });
    await fs.promises.rename(tmp, filePath);
  };
  const serialized = task => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };
  return {
    async list() {
      return (await read())
        .map(({ id, name, kind, updatedAt }) => ({ id, name, kind, updatedAt }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async get(id) {
      return (await read()).find(project => project.id === id) || null;
    },
    save(input) {
      return serialized(async () => {
        const projects = await read();
        const now = new Date().toISOString();
        const index = input.id ? projects.findIndex(project => project.id === input.id) : -1;
        if (index === -1 && projects.length >= MAX_PROJECTS) throw Object.assign(new Error(`Limite de ${MAX_PROJECTS} projetos atingido. Exclua projetos antigos.`), { status: 409 });
        const project = {
          id: index === -1 ? crypto.randomUUID() : input.id,
          name: input.name,
          kind: input.kind,
          settings: input.settings,
          prompt: input.prompt,
          createdAt: index === -1 ? now : projects[index].createdAt,
          updatedAt: now
        };
        if (index === -1) projects.push(project); else projects[index] = project;
        await write(projects);
        return project;
      });
    },
    remove(id) {
      return serialized(async () => {
        const projects = await read();
        const next = projects.filter(project => project.id !== id);
        if (next.length === projects.length) return false;
        await write(next);
        return true;
      });
    }
  };
}

function validateProject(payload) {
  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : '';
  if (!name) throw Object.assign(new Error('Dê um nome ao projeto.'), { status: 400 });
  if (!PROJECT_KINDS.includes(payload.kind)) throw Object.assign(new Error('Tipo de projeto inválido.'), { status: 400 });
  if (!payload.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings)) throw Object.assign(new Error('Configurações do projeto inválidas.'), { status: 400 });
  const settings = Object.fromEntries(Object.entries(payload.settings).filter(([key, value]) => key.length <= 60 && ['string', 'boolean', 'number'].includes(typeof value)).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 20_000) : value]));
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.slice(0, 100_000) : '';
  const id = typeof payload.id === 'string' && /^[0-9a-f-]{36}$/.test(payload.id) ? payload.id : undefined;
  return { id, name, kind: payload.kind, settings, prompt };
}

const projectStore = createProjectStore(process.env.PROJECTS_PATH || path.join(RUNTIME_DIR, 'projects.json'));

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

async function requestAiText(instructions, input, timeoutMs, timeoutMessage) {
  const config = getAiConfig();
  if (!config.apiKey) throw Object.assign(new Error('A IA ainda não foi configurada no servidor.'), { status: 503 });
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

async function requestAiHtml(prompt) {
  const result = await requestAiText(HTML_INSTRUCTIONS, prompt, 180_000, 'A geração excedeu o tempo máximo de três minutos.');
  return { html: cleanGeneratedHtml(result.text), model: result.model };
}

function cleanImprovedPrompt(value) {
  const text = String(value || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  if (!text) throw Object.assign(new Error('A IA não devolveu um prompt.'), { status: 502 });
  return text;
}

async function improvePrompt(prompt, adjustments, instruction) {
  const asks = [...adjustments, instruction].filter(Boolean).map(item => `- ${item}`).join('\n');
  const result = await requestAiText(IMPROVE_INSTRUCTIONS, `PROMPT ATUAL:\n${prompt}\n\nAJUSTES PEDIDOS:\n${asks}`, 90_000, 'A melhoria excedeu o tempo máximo de 90 segundos.');
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

async function requestAiImage(prompt, position, total) {
  const config = getAiConfig();
  if (!config.apiKey) throw Object.assign(new Error('A IA ainda não foi configurada no servidor.'), { status: 503 });
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

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, service: 'gerador-one' });
  if (req.method === 'GET' && pathname === '/api/ai/status') {
    const config = getAiConfig();
    return json(res, 200, { available: Boolean(config.apiKey), provider: config.provider === 'gemini' ? 'Gemini' : 'OpenAI', model: config.apiKey ? config.model : null });
  }
  if (req.method === 'GET' && pathname === '/api/ai/config') {
    const config = getAiConfig();
    return json(res, 200, { provider: config.provider, hasApiKey: Boolean(config.apiKey), model: config.model, imageModel: config.imageModel });
  }
  if (req.method === 'POST' && pathname === '/api/ai/config') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      if (payload.provider !== undefined && !PROVIDERS.includes(payload.provider)) return json(res, 400, { error: 'Provedor inválido.' });
      if (payload.apiKey !== undefined && typeof payload.apiKey !== 'string') return json(res, 400, { error: 'Chave inválida.' });
      if (payload.model !== undefined && typeof payload.model !== 'string') return json(res, 400, { error: 'Modelo inválido.' });
      if (payload.imageModel !== undefined && typeof payload.imageModel !== 'string') return json(res, 400, { error: 'Modelo de imagem inválido.' });
      const saved = await writeRuntimeAiConfig(payload);
      return json(res, 200, { provider: saved.provider, hasApiKey: Boolean(saved.apiKey), model: saved.model, imageModel: saved.imageModel });
    } catch (error) {
      return json(res, error.status || 400, { error: error.status === 413 ? error.message : 'Não foi possível salvar a configuração.' });
    }
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
      if (req.method === 'GET' && pathname === '/api/projects') return json(res, 200, { projects: await projectStore.list() });
      if (req.method === 'POST' && pathname === '/api/projects') {
        const saved = await projectStore.save(validateProject(JSON.parse(await readBody(req) || '{}')));
        return json(res, 200, { project: saved });
      }
      if (req.method === 'GET' && id) {
        const project = await projectStore.get(id);
        return project ? json(res, 200, { project }) : json(res, 404, { error: 'Projeto não encontrado.' });
      }
      if (req.method === 'DELETE' && id) {
        return (await projectStore.remove(id)) ? json(res, 200, { ok: true }) : json(res, 404, { error: 'Projeto não encontrado.' });
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
      return json(res, 200, await improvePrompt(payload.prompt, adjustments, instruction));
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
      const generated = await requestAiHtml(payload.prompt);
      const imageCount = payload.generateImages ? Math.max(1, Math.min(3, Number(payload.imageCount) || 1)) : 0;
      const images = imageCount ? await Promise.all(Array.from({ length: imageCount }, (_, index) => requestAiImage(payload.prompt, index + 1, imageCount))) : [];
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

module.exports = { server, renderDocument, renderPdf, escapeHtml, cleanGeneratedHtml, cleanImprovedPrompt, extractOutputText, htmlToPdf, embedImages, createProjectStore, validateProject };
