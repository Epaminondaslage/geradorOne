const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-auth-'));
process.env.RUNTIME_DIR = runtime;
process.env.ADMIN_EMAIL = 'admin@teste.com';
process.env.ADMIN_PASSWORD = 'AdminSenha1';
process.env.ADMIN_NAME = 'Administrador do Teste';
const { createTestDatabase } = require('./helpers/db');

let app;
let testDb;
let base;
const sent = [];
test.before(async () => {
  testDb = await createTestDatabase();
  process.env.DATABASE_URL = testDb.url;
  app = require('../server');
  await app.prepare();
  app.mailer.setTransport({ sendMail: async message => { sent.push(message); } });
  await app.ensureAdmin();
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
test.after(async () => {
  await new Promise(resolve => app.server.close(resolve));
  await app.db.close();
  await testDb.drop();
  fs.rmSync(runtime, { recursive: true, force: true });
});

function client() {
  let cookie = '';
  return async function call(method, url, body, headers = {}) {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data, setCookie: set };
  };
}

async function loginAs(email, password) {
  const call = client();
  const result = await call('POST', '/api/auth/login', { email, password });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return call;
}

test('rotas protegidas exigem sessão, mas health e config são públicas', async () => {
  const anon = client();
  assert.equal((await anon('GET', '/api/health')).status, 200);
  assert.equal((await anon('GET', '/api/auth/config')).status, 200);
  for (const url of ['/api/projects', '/api/ai/config', '/api/users', '/api/auth/me']) {
    assert.equal((await anon('GET', url)).status, 401, url);
  }
  assert.equal((await anon('POST', '/api/pdf', { prompt: 'x' })).status, 401);
});

test('login: erro genérico, cookie HttpOnly e bloqueio por tentativas', async () => {
  const call = client();
  const wrongPassword = await call('POST', '/api/auth/login', { email: 'admin@teste.com', password: 'errada123' });
  const unknownUser = await call('POST', '/api/auth/login', { email: 'ninguem@teste.com', password: 'errada123' });
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(wrongPassword.data, unknownUser.data);
  const ok = await call('POST', '/api/auth/login', { email: 'ADMIN@teste.com', password: 'AdminSenha1' });
  assert.equal(ok.status, 200);
  assert.match(ok.setCookie, /HttpOnly/);
  assert.match(ok.setCookie, /SameSite=Lax/);
  assert.equal(ok.data.user.role, 'admin');
  assert.equal(ok.data.user.passwordHash, undefined);
  const attacker = client();
  let last;
  for (let i = 0; i < 9; i += 1) last = await attacker('POST', '/api/auth/login', { email: 'alvo@teste.com', password: `tentativa${i}` });
  assert.equal(last.status, 429);
});

test('primeiro acesso: troca de senha é obrigatória antes de usar o app', async () => {
  const admin = await loginAs('admin@teste.com', 'AdminSenha1');
  assert.equal((await admin('GET', '/api/projects')).data.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await admin('POST', '/api/auth/change-password', { current: 'errada', password: 'NovaSenha12' })).status, 400);
  assert.equal((await admin('POST', '/api/auth/change-password', { current: 'AdminSenha1', password: 'curta' })).status, 400);
  const changed = await admin('POST', '/api/auth/change-password', { current: 'AdminSenha1', password: 'NovaSenha12' });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.user.mustChangePassword, false);
  assert.equal((await admin('GET', '/api/projects')).status, 200);
  const old = client();
  assert.equal((await old('POST', '/api/auth/login', { email: 'admin@teste.com', password: 'AdminSenha1' })).status, 401);
});

test('admin gerencia usuários; usuário comum não', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const base = { name: 'Ana', email: 'ana@teste.com', phone: '(35) 99999-8888', role: 'user', password: 'TempDaAna123' };
  assert.equal((await admin('POST', '/api/users', { ...base, password: undefined })).status, 400);
  assert.equal((await admin('POST', '/api/users', { ...base, password: 'curta' })).status, 400);
  assert.equal((await admin('POST', '/api/users', { ...base, phone: undefined })).status, 400);
  assert.equal((await admin('POST', '/api/users', { ...base, phone: '12345' })).status, 400);
  assert.equal((await admin('POST', '/api/users', { ...base, name: '' })).status, 400);
  assert.equal((await admin('POST', '/api/users', { ...base, email: 'sem-arroba' })).status, 400);
  const created = await admin('POST', '/api/users', base);
  assert.equal(created.status, 200);
  assert.equal(created.data.user.phone, '35999998888');
  assert.equal(created.data.temporaryPassword, undefined);
  assert.equal((await admin('POST', '/api/users', { ...base, email: 'ANA@teste.com' })).status, 409);
  const ana = client();
  assert.equal((await ana('POST', '/api/auth/login', { email: 'ana@teste.com', password: 'TempDaAna123' })).status, 200);
  assert.equal((await ana('GET', '/api/projects')).status, 403);
  assert.equal((await ana('POST', '/api/auth/change-password', { current: 'TempDaAna123', password: 'SenhaDaAna12' })).status, 200);
  assert.equal((await ana('GET', '/api/users')).status, 403);
  assert.equal((await ana('POST', '/api/users', { name: 'X', email: 'x@teste.com' })).status, 403);

  const list = await admin('GET', '/api/users');
  assert.deepEqual(list.data.users.map(user => user.email).sort(), ['admin@teste.com', 'ana@teste.com']);
  const adminId = list.data.users.find(user => user.email === 'admin@teste.com').id;
  assert.equal((await admin('PUT', `/api/users/${adminId}`, { active: false })).status, 409);
  assert.equal((await admin('PUT', `/api/users/${adminId}`, { role: 'user' })).status, 409);
  assert.equal((await admin('DELETE', `/api/users/${adminId}`)).status, 409);
});

test('desativar ou redefinir a senha derruba as sessões do usuário', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const ana = await loginAs('ana@teste.com', 'SenhaDaAna12');
  assert.equal((await ana('GET', '/api/projects')).status, 200);
  const anaId = (await admin('GET', '/api/users')).data.users.find(user => user.email === 'ana@teste.com').id;
  assert.equal((await admin('PUT', `/api/users/${anaId}`, { active: false })).status, 200);
  assert.equal((await ana('GET', '/api/projects')).status, 401);
  assert.equal((await client()('POST', '/api/auth/login', { email: 'ana@teste.com', password: 'SenhaDaAna12' })).status, 401);
  assert.equal((await admin('PUT', `/api/users/${anaId}`, { active: true })).status, 200);
  const reset = await admin('POST', `/api/users/${anaId}/reset-password`, {});
  assert.equal(reset.status, 200);
  assert.equal((await client()('POST', '/api/auth/login', { email: 'ana@teste.com', password: 'SenhaDaAna12' })).status, 401);
  await loginAs('ana@teste.com', reset.data.temporaryPassword);
});

test('projetos e chaves de API são isolados por usuário', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const created = await admin('POST', '/api/users', { name: 'Bia', email: 'bia@teste.com', phone: '11 98888-7777', role: 'user', password: 'SenhaDaBia12' });
  assert.equal(created.status, 200);
  assert.equal(created.data.temporaryPassword, undefined);
  const bia = client();
  await bia('POST', '/api/auth/login', { email: 'bia@teste.com', password: 'SenhaDaBia12' });
  assert.equal((await bia('POST', '/api/auth/change-password', { current: 'SenhaDaBia12', password: 'BiaNovaSenha1' })).status, 200);

  const mine = await admin('POST', '/api/projects', { name: 'Do admin', kind: 'apostila', settings: { assunto: 'A' }, prompt: 'P' });
  assert.equal(mine.status, 200);
  assert.deepEqual((await bia('GET', '/api/projects')).data.projects, []);
  assert.equal((await bia('GET', `/api/projects/${mine.data.project.id}`)).status, 404);
  assert.equal((await bia('DELETE', `/api/projects/${mine.data.project.id}`)).status, 404);
  assert.equal((await admin('GET', `/api/projects/${mine.data.project.id}`)).status, 200);

  const secret = 'sk-teste-ABCDEFGH12345678';
  const saved = await admin('POST', '/api/ai/config', { provider: 'openai', apiKey: secret });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.hasApiKey, true);
  assert.equal(saved.data.keyHint, '••••5678');
  assert.equal(JSON.stringify(saved.data).includes(secret), false);
  assert.equal(JSON.stringify((await admin('GET', '/api/ai/config')).data).includes(secret), false);
  assert.equal((await bia('GET', '/api/ai/config')).data.hasApiKey, false);
  assert.equal((await bia('GET', '/api/ai/status')).data.available, false);
  assert.equal((await admin('GET', '/api/ai/status')).data.available, true);
  assert.equal((await bia('POST', '/api/improve', { prompt: 'x', adjustments: ['y'] })).status, 503);

  const stored = JSON.stringify((await app.db.query('SELECT ai FROM users')).rows);
  assert.equal(stored.includes(secret), false);
  assert.match(stored, /"keyEnc":"v1\./);
  assert.equal((await admin('POST', '/api/ai/config', { apiKey: 'curta' })).status, 400);
  assert.equal((await admin('POST', '/api/ai/config', { apiKey: 'tem espaco e\nnova linha' })).status, 400);
  assert.equal((await admin('POST', '/api/ai/config', { clearApiKey: true })).data.hasApiKey, false);
});

test('excluir usuário apaga os projetos dele', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const bia = await loginAs('bia@teste.com', 'BiaNovaSenha1');
  await bia('POST', '/api/projects', { name: 'Da Bia', kind: 'capa', settings: {}, prompt: 'P' });
  const biaId = (await admin('GET', '/api/users')).data.users.find(user => user.email === 'bia@teste.com').id;
  const removed = await admin('DELETE', `/api/users/${biaId}`);
  assert.equal(removed.status, 200);
  assert.equal(removed.data.removedProjects, 1);
  assert.equal((await bia('GET', '/api/projects')).status, 401);
});

test('recuperação de senha por código enviado por e-mail', async () => {
  const anon = client();
  sent.length = 0;
  const generic = await anon('POST', '/api/auth/forgot', { email: 'ninguem@teste.com', password: 'OutraSenha123' });
  assert.equal(generic.status, 200);
  assert.equal(sent.length, 0);
  assert.equal((await anon('POST', '/api/auth/forgot', { email: 'ana@teste.com', password: 'curta' })).status, 400);
  const asked = await anon('POST', '/api/auth/forgot', { email: 'ana@teste.com', password: 'OutraSenha123' });
  assert.equal(asked.status, 200);
  assert.deepEqual(asked.data, generic.data);
  assert.equal(sent.length, 1);
  const code = /\b(\d{6})\b/.exec(sent[0].text)[1];
  assert.equal((await anon('POST', '/api/auth/confirm', { email: 'ana@teste.com', code: code === '000000' ? '111111' : '000000' })).status, 400);
  assert.equal((await anon('POST', '/api/auth/login', { email: 'ana@teste.com', password: 'OutraSenha123' })).status, 401);
  const confirmed = await anon('POST', '/api/auth/confirm', { email: 'ana@teste.com', code });
  assert.equal(confirmed.status, 200);
  assert.equal((await anon('POST', '/api/auth/confirm', { email: 'ana@teste.com', code })).status, 400);
  const login = await anon('POST', '/api/auth/login', { email: 'ana@teste.com', password: 'OutraSenha123' });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.mustChangePassword, false);
});

test('código de recuperação trava após 5 tentativas erradas', async () => {
  const anon = client();
  sent.length = 0;
  await anon('POST', '/api/auth/forgot', { email: 'ana@teste.com', password: 'MaisUmaSenha12' });
  const code = /\b(\d{6})\b/.exec(sent[0].text)[1];
  const wrong = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i += 1) await anon('POST', '/api/auth/confirm', { email: 'ana@teste.com', code: wrong });
  const late = await anon('POST', '/api/auth/confirm', { email: 'ana@teste.com', code });
  assert.ok([400, 429].includes(late.status), `status ${late.status}`);
  assert.equal((await anon('POST', '/api/auth/login', { email: 'ana@teste.com', password: 'MaisUmaSenha12' })).status, 401);
});

test('rejeita requisições de outra origem e corpo inválido', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const cross = await admin('POST', '/api/projects', { name: 'x', kind: 'capa', settings: {} }, { Origin: 'http://evil.example' });
  assert.equal(cross.status, 403);
  const raw = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{quebrado' });
  assert.equal(raw.status, 400);
});

test('sessão adulterada é rejeitada', async () => {
  const response = await fetch(`${base}/api/projects`, { headers: { Cookie: 'g1_session=eyJ1aWQiOiJ4In0.assinatura-falsa' } });
  assert.equal(response.status, 401);
});

test('a chave mestra, quando fica em arquivo, tem permissão restrita', () => {
  if (!process.env.APP_SECRET) assert.equal(fs.statSync(path.join(runtime, 'secret.key')).mode & 0o777, 0o600);
});

test('a saúde do serviço inclui o banco e a senha do banco não aparece em nenhuma resposta', async () => {
  const anon = client();
  const health = await anon('GET', '/api/health');
  assert.deepEqual(health.data, { ok: true, service: 'gerador-one', db: true });
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const everything = JSON.stringify([(await admin('GET', '/api/auth/me')).data, (await admin('GET', '/api/users')).data]);
  assert.equal(everything.includes(new URL(testDb.url).password), false);
  assert.equal(everything.includes('passwordHash'), false);
  assert.equal(everything.includes('password_hash'), false);
});

test('perfil exige telefone válido e o admin edita o telefone de outros usuários', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const ana = await loginAs('ana@teste.com', 'OutraSenha123');
  assert.equal((await ana('POST', '/api/auth/profile', { name: 'Ana Souza', phone: '' })).status, 400);
  assert.equal((await ana('POST', '/api/auth/profile', { name: 'Ana Souza', phone: '123' })).status, 400);
  const saved = await ana('POST', '/api/auth/profile', { name: 'Ana Souza', phone: '+55 (35) 3333-4444' });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.user.phone, '553533334444');
  assert.equal(saved.data.user.name, 'Ana Souza');
  const anaId = (await admin('GET', '/api/users')).data.users.find(user => user.email === 'ana@teste.com').id;
  assert.equal((await admin('PUT', `/api/users/${anaId}`, { phone: '' })).status, 400);
  assert.equal((await admin('PUT', `/api/users/${anaId}`, { phone: '35 98888-1111' })).data.user.phone, '35988881111');
  assert.equal((await ana('GET', '/api/projects')).status, 200);
});

test('administrador inicial nasce sem telefone e é obrigado a informá-lo no perfil', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const me = (await admin('GET', '/api/auth/me')).data.user;
  assert.equal(me.name, 'Administrador do Teste');
  assert.equal(me.phone, '');
  assert.equal((await admin('POST', '/api/auth/profile', { name: me.name })).status, 400);
  assert.equal((await admin('POST', '/api/auth/profile', { name: 'Fulano', phone: '(35) 99999-0000' })).data.user.phone, '35999990000');
});

test('endereços malformados e arquivos fora de public/ são recusados sem derrubar o servidor', async () => {
  const http = require('node:http');
  const raw = (requestPath, headers = {}) => new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: app.server.address().port, path: requestPath, headers }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
    request.end();
  });
  assert.equal(await raw('/%E0%A4%A'), 400);
  assert.equal(await raw('/%'), 400);
  assert.equal(await raw('/..%2f..%2fetc/passwd'), 403);
  assert.equal(await raw('/%2e%2e/server.js'), 404);
  assert.equal(await raw('/index.html', { Host: 'host invalido' }), 400);
  assert.equal(await raw('/nao-existe.png'), 404);
  assert.equal((await client()('GET', '/api/health')).status, 200);
});

test('corpo maior que o limite recebe 413 sem derrubar o servidor', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const huge = 'x'.repeat(1_200_000);
  const response = await admin('POST', '/api/render', { prompt: huge });
  assert.equal(response.status, 413);
  assert.equal((await admin('GET', '/api/projects')).status, 200);
  const small = await admin('POST', '/api/render', { prompt: 'ok' });
  assert.equal(small.status, 200);
});

test('chave de IA que não pode mais ser decifrada não aparece como cadastrada', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  await admin('POST', '/api/ai/config', { provider: 'openai', apiKey: 'sk-teste-ZZZZ0000AAAA' });
  const adminId = (await admin('GET', '/api/auth/me')).data.user.id;
  assert.equal((await admin('GET', '/api/auth/me')).data.user.hasApiKey, true);
  assert.equal((await admin('GET', '/api/users')).data.users.find(user => user.id === adminId).hasApiKey, true);
  await app.db.query(`UPDATE users SET ai = jsonb_set(ai, '{keyEnc}', '"v1.AAAA.BBBB.CCCC"') WHERE id = $1`, [adminId]);
  assert.equal((await admin('GET', '/api/auth/me')).data.user.hasApiKey, false);
  assert.equal((await admin('GET', '/api/users')).data.users.find(user => user.id === adminId).hasApiKey, false);
  assert.equal((await admin('GET', '/api/ai/status')).data.available, false);
  assert.equal((await admin('POST', '/api/ai/config', { clearApiKey: true })).data.hasApiKey, false);
});

test('script de emergência redefine a senha e exige troca', async () => {
  const { execFileSync } = require('node:child_process');
  const output = execFileSync('node', [path.join(__dirname, '..', 'scripts', 'reset-password.js'), 'ADMIN@teste.com'], { env: { ...process.env, RUNTIME_DIR: runtime, DATABASE_URL: testDb.url } }).toString();
  const password = /: (\S+)\s*$/.exec(output)[1];
  const call = client();
  const login = await call('POST', '/api/auth/login', { email: 'admin@teste.com', password });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.mustChangePassword, true);
  assert.equal((await client()('POST', '/api/auth/login', { email: 'admin@teste.com', password: 'NovaSenha12' })).status, 401);
});
