const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { deriveKey, hmacHex, safeEqualHex } = require('./crypto');

function fingerprint(master) {
  return hmacHex('geradorone:chave-mestra', deriveKey(master, 'fingerprint'));
}

// Guarda uma impressão digital da chave mestra na primeira execução e, nas seguintes, recusa uma chave
// diferente: com ela as chaves de IA salvas ficariam ilegíveis e todas as sessões cairiam sem aviso.
function checkMasterSecret(runtimeDir, master, { allowNew = false } = {}) {
  const file = path.join(runtimeDir, 'secret.check');
  const current = fingerprint(master);
  let stored = '';
  try { stored = fs.readFileSync(file, 'utf8').trim(); } catch {}
  if (stored && !safeEqualHex(stored, current)) {
    if (!allowNew) {
      throw new Error('A chave mestra mudou desde a última execução (APP_SECRET ausente ou diferente do original). Com ela, as chaves de IA salvas ficariam ilegíveis e todas as sessões seriam encerradas. Restaure o APP_SECRET original no .env. Para aceitar a chave nova mesmo assim, inicie uma vez com ALLOW_NEW_SECRET=true.');
    }
  }
  if (stored !== current) {
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, current, { mode: 0o600 });
    return stored ? 'replaced' : 'created';
  }
  return 'ok';
}

module.exports = { checkMasterSecret, fingerprint };
