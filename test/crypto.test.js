const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../lib/crypto');
const { createLimiter } = require('../lib/rate-limit');

test('senha: confere certa, rejeita errada e formato inválido', async () => {
  const hash = await c.hashPassword('senha-forte-1');
  assert.match(hash, /^scrypt\$/);
  assert.equal(await c.verifyPassword('senha-forte-1', hash), true);
  assert.equal(await c.verifyPassword('senha-forte-2', hash), false);
  assert.equal(await c.verifyPassword('x', 'lixo'), false);
  assert.notEqual(await c.hashPassword('senha-forte-1'), hash);
});

test('BYOK: cifra e decifra, e falha com chave errada ou adulteração', () => {
  const key = c.deriveKey(Buffer.alloc(48, 7), 'byok');
  const other = c.deriveKey(Buffer.alloc(48, 7), 'session');
  const sealed = c.encrypt('sk-segredo-1234', key);
  assert.doesNotMatch(sealed, /segredo/);
  assert.equal(c.decrypt(sealed, key), 'sk-segredo-1234');
  assert.throws(() => c.decrypt(sealed, other));
  const parts = sealed.split('.');
  parts[3] = Buffer.from('adulterado').toString('base64url');
  assert.throws(() => c.decrypt(parts.join('.'), key));
});

test('token de sessão: assina, expira e rejeita adulteração', () => {
  const key = c.deriveKey(Buffer.alloc(48, 1), 'session');
  const token = c.signToken({ uid: 'a', exp: 2000 }, key);
  assert.equal(c.verifyToken(token, key, 1000).uid, 'a');
  assert.equal(c.verifyToken(token, key, 3000), null);
  assert.equal(c.verifyToken(`${token}x`, key, 1000), null);
  const [body] = token.split('.');
  assert.equal(c.verifyToken(`${body}.${'A'.repeat(43)}`, key, 1000), null);
});

test('limitador: bloqueia após o máximo e libera depois da janela', () => {
  const limiter = createLimiter({ max: 3, windowMs: 1000 });
  for (let i = 0; i < 3; i += 1) limiter.hit('k', 100);
  assert.equal(limiter.blocked('k', 200), true);
  assert.equal(limiter.blocked('k', 1200), false);
  limiter.hit('k', 1300); limiter.reset('k');
  assert.equal(limiter.blocked('k', 1300), false);
});

test('chave mestra: APP_SECRET tem prioridade e não grava arquivo; sem ele, gera e reutiliza secret.key', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-secret-'));
  const fromEnv = c.loadMasterSecret(dir, 'x'.repeat(40));
  assert.equal(fromEnv.toString(), 'x'.repeat(40));
  assert.equal(fs.existsSync(path.join(dir, 'secret.key')), false);
  assert.notDeepEqual(c.deriveKey(fromEnv, 'byok'), c.deriveKey(fromEnv, 'session'));
  const generated = c.loadMasterSecret(dir, 'curto');
  assert.equal(generated.length, 48);
  assert.equal(fs.statSync(path.join(dir, 'secret.key')).mode & 0o777, 0o600);
  assert.deepEqual(c.loadMasterSecret(dir, ''), generated);
  fs.rmSync(dir, { recursive: true, force: true });
});
