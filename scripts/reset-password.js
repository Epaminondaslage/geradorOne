#!/usr/bin/env node
// Define uma senha temporária para um usuário (e o reativa). Troca obrigatória no próximo login.
// Uso: node scripts/reset-password.js email@exemplo.com   |   docker exec gerador-one node scripts/reset-password.js email@exemplo.com
const path = require('node:path');
const { createUserStore, normalizeEmail } = require('../lib/users');
const crypto = require('../lib/crypto');

(async () => {
  const email = normalizeEmail(process.argv[2]);
  if (!email) { console.error('Uso: node scripts/reset-password.js email@exemplo.com'); process.exit(2); }
  const store = createUserStore(path.join(process.env.RUNTIME_DIR || path.join(__dirname, '..', 'runtime'), 'users.json'));
  const user = await store.getByEmail(email);
  if (!user) { console.error('Usuário não encontrado.'); process.exit(1); }
  const password = crypto.randomPassword();
  await store.update(user.id, { passwordHash: await crypto.hashPassword(password), mustChangePassword: true, active: true });
  console.log(`Senha temporária de ${user.email}: ${password}`);
})().catch(error => { console.error(error.message); process.exit(1); });
