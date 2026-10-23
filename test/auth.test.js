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

test('autocadastro: código por e-mail cria conta de usuário e abre a sessão', async () => {
  const anon = client();
  sent.length = 0;
  assert.equal((await anon('GET', '/api/auth/config')).data.signup, true);
  assert.equal((await anon('POST', '/api/auth/signup', { name: '', email: 'novo@teste.com', password: 'SenhaNova123' })).status, 400);
  assert.equal((await anon('POST', '/api/auth/signup', { name: 'Novo', email: 'invalido', password: 'SenhaNova123' })).status, 400);
  assert.equal((await anon('POST', '/api/auth/signup', { name: 'Novo', email: 'novo@teste.com', password: 'curta' })).status, 400);
  assert.equal(sent.length, 0);
  const asked = await anon('POST', '/api/auth/signup', { name: 'Novo Usuário', email: 'Novo@Teste.com', password: 'SenhaNova123', acceptTerms: true });
  assert.equal(asked.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'novo@teste.com');
  const code = /\b(\d{6})\b/.exec(sent[0].text)[1];
  assert.equal((await anon('POST', '/api/auth/login', { email: 'novo@teste.com', password: 'SenhaNova123' })).status, 401);
  assert.equal((await anon('POST', '/api/auth/signup/confirm', { email: 'novo@teste.com', code: code === '000000' ? '111111' : '000000' })).status, 400);
  const confirmed = await anon('POST', '/api/auth/signup/confirm', { email: 'novo@teste.com', code });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.user.role, 'user');
  assert.equal(confirmed.data.user.mustChangePassword, false);
  assert.equal(confirmed.data.user.termsCurrent, true);
  assert.ok(confirmed.data.user.termsAcceptedAt);
  assert.equal((await anon('GET', '/api/auth/me')).status, 200);
  assert.equal((await anon('POST', '/api/auth/signup/confirm', { email: 'novo@teste.com', code })).status, 400);
  assert.equal((await client()('POST', '/api/auth/login', { email: 'novo@teste.com', password: 'SenhaNova123' })).status, 200);
});

test('autocadastro: e-mail já cadastrado recebe a mesma resposta e nenhum e-mail', async () => {
  const anon = client();
  sent.length = 0;
  const fresh = await anon('POST', '/api/auth/signup', { name: 'Outro', email: 'outro@teste.com', password: 'SenhaNova123', acceptTerms: true });
  const dup = await anon('POST', '/api/auth/signup', { name: 'Ana', email: 'ana@teste.com', password: 'SenhaNova123', acceptTerms: true });
  assert.equal(dup.status, 200);
  assert.deepEqual(dup.data, fresh.data);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'outro@teste.com');
});

test('autocadastro: código trava após 5 tentativas erradas', async () => {
  const anon = client();
  sent.length = 0;
  await anon('POST', '/api/auth/signup', { name: 'Trava', email: 'trava@teste.com', password: 'SenhaNova123', acceptTerms: true });
  const code = /\b(\d{6})\b/.exec(sent[0].text)[1];
  const wrong = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i += 1) await anon('POST', '/api/auth/signup/confirm', { email: 'trava@teste.com', code: wrong });
  const late = await anon('POST', '/api/auth/signup/confirm', { email: 'trava@teste.com', code });
  assert.ok([400, 429].includes(late.status), `status ${late.status}`);
  assert.equal((await anon('POST', '/api/auth/login', { email: 'trava@teste.com', password: 'SenhaNova123' })).status, 401);
});

test('termos e privacidade: cadastro exige aceite, conta anterior aceita depois e as páginas são públicas', async () => {
  const anon = client();
  sent.length = 0;
  const semAceite = { name: 'Sem Aceite', email: 'semaceite@teste.com', password: 'SenhaNova123' };
  assert.equal((await anon('POST', '/api/auth/signup', semAceite)).status, 400);
  assert.equal((await anon('POST', '/api/auth/signup', { ...semAceite, acceptTerms: 'true' })).status, 400);
  assert.equal((await anon('POST', '/api/auth/signup', { ...semAceite, acceptTerms: false })).status, 400);
  assert.equal(sent.length, 0);

  const { LEGAL_VERSION } = require('../lib/legal');
  const ana = await loginAs('ana@teste.com', 'OutraSenha123');
  const antes = (await ana('GET', '/api/auth/me')).data.user;
  assert.equal(antes.termsCurrent, false);
  assert.equal(antes.termsAcceptedAt, '');
  assert.equal(antes.legalVersion, LEGAL_VERSION);
  assert.equal((await client()('POST', '/api/auth/accept-terms', { accept: true })).status, 401);
  assert.equal((await ana('POST', '/api/auth/accept-terms', {})).status, 400);
  assert.equal((await ana('POST', '/api/auth/accept-terms', { accept: false })).status, 400);
  const aceito = await ana('POST', '/api/auth/accept-terms', { accept: true });
  assert.equal(aceito.status, 200);
  assert.equal(aceito.data.user.termsCurrent, true);
  assert.equal(aceito.data.user.termsVersion, LEGAL_VERSION);
  assert.ok(Date.parse(aceito.data.user.termsAcceptedAt) > 0);
  assert.equal((await ana('GET', '/api/auth/me')).status, 200, 'aceitar não derruba a sessão');
  const exported = (await ana('GET', '/api/auth/export')).data;
  assert.equal(exported.account.termsVersion, LEGAL_VERSION);

  // Se o texto mudar (nova versão), quem aceitou a anterior precisa aceitar de novo.
  await app.db.query("UPDATE users SET terms_version = '2000-01-01' WHERE email = 'ana@teste.com'");
  assert.equal((await ana('GET', '/api/auth/me')).data.user.termsCurrent, false);
  assert.equal((await ana('POST', '/api/auth/accept-terms', { accept: true })).data.user.termsCurrent, true);

  for (const page of ['termos.html', 'privacidade.html']) {
    const response = await fetch(`${base}/${page}`);
    assert.equal(response.status, 200, page);
    const html = await response.text();
    assert.ok(html.includes('fulano@dominio.com.br'), page);
    assert.ok(html.includes('rascunho'), `${page} deve avisar que falta a revisão jurídica`);
  }
});

test('configuração de SMTP: só administrador, senha cifrada e aplicada na hora', async () => {
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const ana = await loginAs('ana@teste.com', 'OutraSenha123');
  assert.equal((await ana('GET', '/api/settings/smtp')).status, 403);
  assert.equal((await ana('PUT', '/api/settings/smtp', { host: 'x.com', port: 587, from: 'a@b.com' })).status, 403);
  assert.equal((await client()('GET', '/api/settings/smtp')).status, 401);
  assert.equal((await client()('GET', '/api/settings/backup')).status, 401);
  assert.equal((await ana('GET', '/api/settings/backup')).status, 403);
  const backupView = await admin('GET', '/api/settings/backup');
  assert.equal(backupView.status, 200);
  assert.equal(backupView.data.disponivel, false, 'o teste não tem pasta de status do backup');
  assert.equal((await admin('PUT', '/api/settings/smtp', { host: '', port: 587, from: 'GeradorOne <a@b.com>' })).status, 400);
  assert.equal((await admin('PUT', '/api/settings/smtp', { host: 'smtp.exemplo.com', port: 99999, from: 'GeradorOne <a@b.com>' })).status, 400);
  assert.equal((await admin('PUT', '/api/settings/smtp', { host: 'smtp.exemplo.com', port: 587, from: 'sem-email' })).status, 400);
  assert.equal((await admin('PUT', '/api/settings/smtp', { host: 'smtp.exemplo.com', port: 587, from: 'GeradorOne <a@b.com>', user: 'a@b.com' })).status, 400);
  const base = { host: 'smtp.exemplo.com', port: 587, requireTLS: true, user: 'a@b.com', pass: 'SenhaSecreta1', from: 'GeradorOne <a@b.com>' };
  assert.equal((await admin('PUT', '/api/settings/smtp', { ...base, appUrl: 'javascript:alert(1)' })).status, 400);
  assert.equal((await admin('PUT', '/api/settings/smtp', { ...base, appUrl: 'nao-e-url' })).status, 400);
  assert.equal((await admin('PUT', '/api/settings/smtp', { ...base, appUrl: 'https://user:senha@app.exemplo.com' })).status, 400);
  assert.equal((await admin('PUT', '/api/settings/smtp', { ...base, contactEmail: 'sem-arroba' })).status, 400);
  const saved = await admin('PUT', '/api/settings/smtp', { ...base, appUrl: 'https://app.exemplo.com.br', contactEmail: 'Contato@Exemplo.com' });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.source, 'painel');
  assert.equal(saved.data.hasPass, true);
  assert.equal(saved.data.appUrl, 'https://app.exemplo.com.br');
  assert.equal(saved.data.contactEmail, 'contato@exemplo.com');
  assert.deepEqual(app.mailer.brand, { appUrl: 'https://app.exemplo.com.br', contactEmail: 'contato@exemplo.com' });
  // Termos, Política e FAQ passam a mostrar o e-mail de contato configurado, em vez do padrão.
  for (const page of ['termos.html', 'privacidade.html', 'faq-data.js']) {
    const text = await (await fetch(`http://127.0.0.1:${app.server.address().port}/${page}`)).text();
    assert.ok(text.includes('contato@exemplo.com'), page);
    assert.ok(!text.includes('fulano@dominio.com.br'), page);
  }
  assert.ok(!JSON.stringify(saved.data).includes('SenhaSecreta1'));
  const stored = (await app.db.query("SELECT value FROM settings WHERE key = 'smtp'")).rows[0].value;
  assert.ok(stored.passEnc && !JSON.stringify(stored).includes('SenhaSecreta1'));
  const kept = await admin('PUT', '/api/settings/smtp', { host: 'smtp.exemplo.com', port: 587, requireTLS: true, user: 'a@b.com', pass: '', from: 'GeradorOne <a@b.com>', appUrl: 'https://app.exemplo.com.br', contactEmail: 'contato@exemplo.com' });
  assert.equal(kept.data.hasPass, true);
  sent.length = 0;
  const tested = await admin('POST', '/api/settings/smtp/test', { to: 'destino@teste.com' });
  assert.equal(tested.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'destino@teste.com');
  assert.ok(sent[0].html.includes('https://app.exemplo.com.br'));
  assert.equal((await admin('POST', '/api/settings/smtp/test', { to: 'invalido' })).status, 400);
  const back = await admin('DELETE', '/api/settings/smtp');
  assert.equal(back.status, 200);
  assert.notEqual(back.data.source, 'painel');
  assert.deepEqual(app.mailer.brand, { appUrl: '', contactEmail: '' });
});

test('exportar a conta: exige sessão, traz conta e projetos e não vaza senha nem chave', async () => {
  assert.equal((await client()('GET', '/api/auth/export')).status, 401);
  const ana = await loginAs('ana@teste.com', 'OutraSenha123');
  assert.equal((await ana('POST', '/api/projects', { name: 'Para exportar', kind: 'capa', settings: { titulo: 'Lei de Ohm' }, prompt: 'PROMPT-EXPORTADO' })).status, 200);
  await app.db.query("UPDATE users SET ai = $2 WHERE email = $1", ['ana@teste.com', JSON.stringify({ provider: 'gemini', keyEnc: 'SEGREDO-CIFRADO-XYZ', model: '', imageModel: '' })]);
  const exported = await ana('GET', '/api/auth/export');
  assert.equal(exported.status, 200);
  assert.equal(exported.data.format, 'geradorone-account');
  assert.equal(exported.data.account.email, 'ana@teste.com');
  assert.equal(exported.data.ai.provider, 'gemini');
  assert.ok(Array.isArray(exported.data.supportMessages));
  assert.equal(exported.data.ai.hasApiKey, false);
  const mine = exported.data.projects.find(project => project.name === 'Para exportar');
  assert.ok(mine);
  assert.equal(mine.prompt, 'PROMPT-EXPORTADO');
  assert.equal(mine.settings.titulo, 'Lei de Ohm');
  assert.ok(!('ownerId' in mine));
  const texto = JSON.stringify(exported.data);
  assert.ok(!/passwordHash|password_hash|keyEnc|SEGREDO-CIFRADO-XYZ|scrypt/i.test(texto), 'vazou segredo');
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const doAdmin = await admin('GET', '/api/auth/export');
  assert.equal(doAdmin.status, 200);
  assert.ok(!doAdmin.data.projects.some(project => project.name === 'Para exportar'));
  assert.equal(doAdmin.data.account.email, 'admin@teste.com');
});

test('provedor Anthropic: usa a API de mensagens, lê só os blocos de texto e não gera imagens', async () => {
  const ana = await loginAs('ana@teste.com', 'OutraSenha123');
  const saved = await ana('POST', '/api/ai/config', { provider: 'anthropic', apiKey: 'sk-ant-api03-TESTE1234567890' });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.provider, 'anthropic');
  assert.equal(saved.data.hasApiKey, true);
  assert.equal(saved.data.model, 'claude-sonnet-5-5');
  assert.equal(saved.data.imageModel, '');
  const status = (await ana('GET', '/api/ai/status')).data;
  assert.equal(status.provider, 'Anthropic');
  assert.equal(status.images, false);

  const calls = [];
  let reply = { status: 200, body: { content: [{ type: 'thinking', thinking: 'raciocínio interno', signature: 'x' }, { type: 'text', text: 'PROMPT MELHORADO' }], model: 'claude-sonnet-5-5', stop_reason: 'end_turn' } };
  const realFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (!String(url).startsWith('https://api.anthropic.com/')) return realFetch(url, options);
    calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const improved = await ana('POST', '/api/improve', { prompt: 'PROMPT ORIGINAL', adjustments: ['Mais simples'], instruction: '' });
    assert.equal(improved.status, 200);
    assert.equal(improved.data.prompt, 'PROMPT MELHORADO');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
    assert.equal(calls[0].headers.Authorization, 'Bearer sk-ant-api03-TESTE1234567890');
    assert.equal(calls[0].headers['anthropic-version'], '2026-10-21');
    assert.equal(calls[0].body.model, 'claude-sonnet-5-5');
    assert.equal(calls[0].body.max_tokens, 16000);
    assert.equal(typeof calls[0].body.system, 'string');
    assert.deepEqual(calls[0].body.messages.map(message => message.role), ['user']);
    assert.ok(!('temperature' in calls[0].body));

    const withImages = await ana('POST', '/api/generate', { prompt: 'P', format: 'html', generateImages: true, imageCount: 1 });
    assert.equal(withImages.status, 400);
    assert.match(withImages.data.error, /gera só texto/);
    assert.equal(calls.length, 1, 'não chama a API quando o pedido exige imagens');

    reply = { status: 200, body: { content: [{ type: 'text', text: '<!doctype html><html><body>Material</body></html>' }], model: 'claude-sonnet-5-5', stop_reason: 'end_turn' } };
    const generated = await ana('POST', '/api/generate', { prompt: 'P', format: 'html', generateImages: false });
    assert.equal(generated.status, 200);
    assert.match(generated.data.files[0].name, /\.html$/);

    reply = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' }, request_id: 'req_1' } };
    const refused = await ana('POST', '/api/improve', { prompt: 'P', adjustments: ['Mais simples'], instruction: '' });
    assert.equal(refused.status, 400);
    assert.equal(refused.data.error, 'invalid x-api-key');

    reply = { status: 200, body: { content: [{ type: 'text', text: 'cortado' }], model: 'claude-sonnet-5-5', stop_reason: 'max_tokens' } };
    const cut = await ana('POST', '/api/improve', { prompt: 'P', adjustments: ['Mais simples'], instruction: '' });
    assert.equal(cut.status, 502);
    assert.match(cut.data.error, /cortada/);
  } finally {
    global.fetch = realFetch;
  }
  assert.equal((await ana('POST', '/api/ai/config', { provider: 'openai', apiKey: 'x'.repeat(2) })).status, 400);
});

test('fale com o suporte: valida, guarda, avisa o contato e confirma para a pessoa', async () => {
  assert.equal((await client()('POST', '/api/support', { tipo: 'duvida', mensagem: 'Olá, tudo bem?', email: 'a@b.com' })).status, 401);
  const ana = await loginAs('ana@teste.com', 'OutraSenha123');
  assert.equal((await ana('POST', '/api/support', { tipo: 'xpto', mensagem: 'Mensagem de teste', email: 'ana@teste.com' })).status, 400);
  assert.equal((await ana('POST', '/api/support', { tipo: 'duvida', mensagem: 'oi', email: 'ana@teste.com' })).status, 400);
  assert.equal((await ana('POST', '/api/support', { tipo: 'duvida', mensagem: 'Mensagem de teste', email: 'sem-arroba' })).status, 400);
  const exe = await ana('POST', '/api/support', { tipo: 'duvida', mensagem: 'Mensagem de teste', email: 'ana@teste.com', anexos: [{ nome: 'x.exe', dados: Buffer.from('MZ').toString('base64') }] });
  assert.equal(exe.status, 400);
  assert.match(exe.data.error, /não aceito/);

  sent.length = 0;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(30, 2)]).toString('base64');
  const done = await ana('POST', '/api/support', { tipo: 'problema', mensagem: 'A tela de tema não muda.', nome: 'Ana', email: 'ana@teste.com', origem: 'tema', anexos: [{ nome: 'print.png', dados: png }] });
  assert.equal(done.status, 200);
  assert.equal(done.data.enviado, true);
  assert.match(done.data.protocolo, /^GO-\d{8}-[A-Z0-9]{4}$/);
  assert.equal(sent.length, 2);
  const [toSupport, receipt] = sent;
  assert.equal(toSupport.to, app.mailer.supportAddress());
  assert.equal(toSupport.replyTo, 'ana@teste.com');
  assert.ok(toSupport.subject.includes(done.data.protocolo) && toSupport.subject.includes('Problema'));
  assert.ok(toSupport.html.includes('A tela de tema não muda.') && toSupport.html.includes('tema'));
  assert.deepEqual(toSupport.attachments.map(file => file.filename), ['geradorone.png', 'print.png']);
  assert.equal(receipt.to, 'ana@teste.com');
  assert.ok(receipt.subject.includes(done.data.protocolo));
  assert.equal(receipt.replyTo, app.mailer.supportAddress());
  assert.ok(receipt.text.includes('A tela de tema não muda.'));

  const row = (await app.db.query('SELECT tipo, mensagem, email, origem, sent, anexos FROM support_messages WHERE protocolo = $1', [done.data.protocolo])).rows[0];
  assert.equal(row.tipo, 'problema');
  assert.equal(row.sent, true);
  assert.equal(row.origem, 'tema');
  assert.deepEqual(row.anexos.map(file => file.nome), ['print.png']);
  const exported = await ana('GET', '/api/auth/export');
  assert.ok(exported.data.supportMessages.some(message => message.protocolo === done.data.protocolo && message.enviada === true));

  sent.length = 0;
  const robot = await ana('POST', '/api/support', { tipo: 'duvida', mensagem: 'Compre agora!!!', email: 'ana@teste.com', site: 'http://spam.example' });
  assert.equal(robot.status, 200);
  assert.equal(robot.data.enviado, false);
  assert.equal(sent.length, 0);
  assert.equal(Number((await app.db.query("SELECT count(*) AS total FROM support_messages WHERE mensagem = 'Compre agora!!!'")).rows[0].total), 0);

  const huge = await ana('POST', '/api/support', { tipo: 'duvida', mensagem: 'x'.repeat(13_000_000), email: 'ana@teste.com' });
  assert.equal(huge.status, 413);

  for (let i = 0; i < 4; i += 1) assert.equal((await ana('POST', '/api/support', { tipo: 'elogio', mensagem: `Mensagem número ${i + 2}`, email: 'ana@teste.com' })).status, 200);
  const limited = await ana('POST', '/api/support', { tipo: 'elogio', mensagem: 'Mensagem demais', email: 'ana@teste.com' });
  assert.equal(limited.status, 429);
});

test('excluir a própria conta: exige sessão e senha, protege o último administrador e apaga os projetos', async () => {
  assert.equal((await client()('POST', '/api/auth/delete-account', { password: 'qualquer123' })).status, 401);
  const admin = await loginAs('admin@teste.com', 'NovaSenha12');
  const lastAdmin = await admin('POST', '/api/auth/delete-account', { password: 'NovaSenha12' });
  assert.equal(lastAdmin.status, 409);
  assert.equal((await admin('GET', '/api/auth/me')).status, 200);
  const novo = await loginAs('novo@teste.com', 'SenhaNova123');
  assert.equal((await novo('POST', '/api/projects', { name: 'Para apagar', kind: 'capa', settings: {}, prompt: 'P' })).status, 200);
  const wrong = await novo('POST', '/api/auth/delete-account', { password: 'SenhaErrada99' });
  assert.equal(wrong.status, 400);
  assert.equal((await novo('GET', '/api/auth/me')).status, 200);
  const done = await novo('POST', '/api/auth/delete-account', { password: 'SenhaNova123' });
  assert.equal(done.status, 200);
  assert.equal(done.data.removedProjects, 1);
  assert.equal((await novo('GET', '/api/auth/me')).status, 401);
  assert.equal((await client()('POST', '/api/auth/login', { email: 'novo@teste.com', password: 'SenhaNova123' })).status, 401);
  assert.equal(await app.userStore.getByEmail('novo@teste.com'), null);
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

test('o tema escolhido fica salvo na conta e volta no login seguinte', async () => {
  const ana = await loginAs('ana@teste.com', 'OutraSenha123');
  assert.equal((await ana('GET', '/api/auth/me')).data.user.theme, '');
  assert.equal((await ana('POST', '/api/auth/theme', { theme: 'neon' })).status, 400);
  assert.equal((await ana('POST', '/api/auth/theme', {})).status, 400);
  const saved = await ana('POST', '/api/auth/theme', { theme: 'azul-tinta' });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.user.theme, 'azul-tinta');
  assert.equal((await ana('GET', '/api/projects')).status, 200);
  const again = await loginAs('ana@teste.com', 'OutraSenha123');
  assert.equal((await again('GET', '/api/auth/me')).data.user.theme, 'azul-tinta');
  const followed = await again('POST', '/api/auth/theme', { theme: 'sistema' });
  assert.equal(followed.status, 200);
  assert.equal(followed.data.user.theme, 'sistema');
  assert.equal((await again('POST', '/api/auth/theme', { theme: '' })).data.user.theme, '', 'vazio volta ao padrão (Papel)');
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
