const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
const DUMMY_HASH = `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(SCRYPT.keylen).toString('base64')}`;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  if (!expected.length) return false;
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(actual, expected);
}

// Gasta o mesmo tempo de uma verificação real quando o e-mail não existe.
async function verifyDummy(password) {
  await verifyPassword(password, DUMMY_HASH);
}

function loadMasterSecret(runtimeDir, envSecret = process.env.APP_SECRET) {
  if (envSecret && envSecret.length >= 32) return Buffer.from(envSecret);
  const file = path.join(runtimeDir, 'secret.key');
  try {
    const value = fs.readFileSync(file, 'utf8').trim();
    if (value.length >= 64) return Buffer.from(value, 'hex');
  } catch {}
  fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  const secret = crypto.randomBytes(48);
  fs.writeFileSync(file, secret.toString('hex'), { mode: 0o600 });
  return secret;
}

function deriveKey(master, purpose) {
  return Buffer.from(crypto.hkdfSync('sha256', master, Buffer.alloc(0), `geradorone:${purpose}`, 32));
}

function encrypt(plain, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

function decrypt(payload, key) {
  const [version, iv, tag, data] = String(payload || '').split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Segredo inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

function signToken(payload, key) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token, key, now = Date.now()) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', key).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

function randomCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function randomPassword(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
}

function hmacHex(value, key) {
  return crypto.createHmac('sha256', key).update(String(value)).digest('hex');
}

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), 'hex');
  const y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

module.exports = { hashPassword, verifyPassword, verifyDummy, loadMasterSecret, deriveKey, encrypt, decrypt, signToken, verifyToken, randomCode, randomPassword, hmacHex, safeEqualHex };
