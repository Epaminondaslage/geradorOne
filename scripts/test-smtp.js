#!/usr/bin/env node
// Envia um e-mail de teste com as variáveis SMTP_* do ambiente.
// Uso: docker exec gerador-one node scripts/test-smtp.js destino@exemplo.com
const { createMailer } = require('../lib/mailer');

(async () => {
  const to = process.argv[2];
  if (!to) { console.error('Uso: node scripts/test-smtp.js destino@exemplo.com'); process.exit(2); }
  const mailer = createMailer({ host: process.env.SMTP_HOST, port: process.env.SMTP_PORT, secure: process.env.SMTP_SECURE, requireTLS: process.env.SMTP_REQUIRE_TLS, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.SMTP_FROM });
  if (!mailer.enabled) { console.error('SMTP não configurado: defina SMTP_HOST e SMTP_FROM no .env.'); process.exit(1); }
  await mailer.sendResetCode(to, '123456', 10);
  console.log(`E-mail de teste enviado para ${to} (o código 123456 é só de exemplo).`);
})().catch(error => { console.error(`Falha ao enviar: ${error.message}`); process.exit(1); });
