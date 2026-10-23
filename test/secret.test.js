const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { checkMasterSecret } = require('../lib/secret-check');

const A = Buffer.alloc(48, 1);
const B = Buffer.alloc(48, 2);

test('primeira execução grava a impressão digital; mesma chave passa; outra chave é recusada', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-check-'));
  assert.equal(checkMasterSecret(dir, A), 'created');
  assert.equal(fs.statSync(path.join(dir, 'secret.check')).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(path.join(dir, 'secret.check'), 'utf8').includes(A.toString()), false);
  assert.equal(checkMasterSecret(dir, A), 'ok');
  assert.throws(() => checkMasterSecret(dir, B), /chave mestra mudou/);
  assert.equal(checkMasterSecret(dir, B, { allowNew: true }), 'replaced');
  assert.equal(checkMasterSecret(dir, B), 'ok');
  assert.throws(() => checkMasterSecret(dir, A), /chave mestra mudou/);
  fs.rmSync(dir, { recursive: true, force: true });
});

function run(env) {
  return new Promise(resolve => {
    const child = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ADMIN_EMAIL: 'a@teste.com', ADMIN_PASSWORD: 'AdminSenha1', ALLOW_NEW_SECRET: '', APP_SECRET: '', ...env } });
    let out = '';
    let done = false;
    const finish = (code, listening) => { if (done) return; done = true; if (listening) child.kill(); resolve({ code, out, listening }); };
    child.stdout.on('data', chunk => { out += chunk; if (out.includes('GeradorOne: http')) finish(null, true); });
    child.stderr.on('data', chunk => { out += chunk; });
    child.on('exit', code => finish(code, false));
  });
}

test('o servidor recusa subir com a chave mestra errada ou ausente, e sobe com a original', async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-boot-'));
  const original = 'a'.repeat(40);
  const first = await run({ RUNTIME_DIR: runtime, APP_SECRET: original });
  assert.equal(first.listening, true, first.out);
  const same = await run({ RUNTIME_DIR: runtime, APP_SECRET: original });
  assert.equal(same.listening, true, same.out);
  const wrong = await run({ RUNTIME_DIR: runtime, APP_SECRET: 'b'.repeat(40) });
  assert.equal(wrong.code, 1);
  assert.match(wrong.out, /chave mestra mudou/);
  const missing = await run({ RUNTIME_DIR: runtime });
  assert.equal(missing.code, 1);
  assert.match(missing.out, /chave mestra mudou/);
  assert.equal(fs.existsSync(path.join(runtime, 'secret.key')), true);
  const accepted = await run({ RUNTIME_DIR: runtime, APP_SECRET: 'b'.repeat(40), ALLOW_NEW_SECRET: 'true' });
  assert.equal(accepted.listening, true, accepted.out);
  assert.match(accepted.out, /Chave mestra nova aceita/);
  fs.rmSync(runtime, { recursive: true, force: true });
});
