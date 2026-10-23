const test = require('node:test');
const assert = require('node:assert/strict');
const { createMailer } = require('../lib/mailer');

function mailerWithOutbox() {
  const sent = [];
  const mailer = createMailer({ host: 'smtp.exemplo.com', from: 'GeradorOne <teste@exemplo.com>' }, { sendMail: async message => { sent.push(message); } });
  return { mailer, sent };
}

test('e-mail de cadastro: HTML com cabeçalho, código, rodapé, logotipo embutido e texto puro', async () => {
  const { mailer, sent } = mailerWithOutbox();
  await mailer.sendSignupCode('ana@teste.com', 'Ana Maria Souza', '482913', 10);
  const [message] = sent;
  assert.equal(message.to, 'ana@teste.com');
  assert.equal(message.subject, 'GeradorOne: confirme o seu cadastro');
  assert.match(message.html, /^<!DOCTYPE html>/);
  assert.match(message.html, /<h1[^>]*>Confirme o seu cadastro<\/h1>/);
  assert.ok(message.html.includes('482913'));
  assert.ok(message.html.includes('Olá, Ana.'));
  assert.ok(message.html.includes('O código vale por 10 minutos.'));
  assert.equal((message.html.match(/src="cid:logo-geradorone"/g) || []).length, 2, 'logotipo no cabeçalho e no rodapé');
  assert.equal(message.attachments.length, 1);
  assert.equal(message.attachments[0].cid, 'logo-geradorone');
  assert.equal(message.attachments[0].contentType, 'image/png');
  assert.ok(message.html.includes('mailto:fulano@dominio.com.br'));
  assert.ok(message.html.includes('https://github.com/Epaminondaslage/geradorOne'));
  assert.equal(/\b(\d{6})\b/.exec(message.text)[1], '482913');
  assert.ok(message.text.includes('Contato: fulano@dominio.com.br'));
  assert.ok(!/<[a-z]/i.test(message.text), 'texto puro sem HTML');
});

test('e-mail: endereço do app e contato configurados aparecem no rodapé', async () => {
  const { mailer, sent } = mailerWithOutbox();
  mailer.setBrand({ appUrl: 'https://app.exemplo.com.br', contactEmail: 'privacidade@exemplo.com' });
  await mailer.sendResetCode('ana@teste.com', '135790', 10);
  const [message] = sent;
  assert.ok(message.html.includes('href="https://app.exemplo.com.br"'));
  assert.ok(message.html.includes('mailto:privacidade@exemplo.com'));
  assert.ok(message.text.includes('Endereço: https://app.exemplo.com.br'));
  assert.ok(!message.html.includes('fulano@dominio.com.br'));
  assert.equal(message.subject, 'GeradorOne: código para redefinir sua senha');
});

test('e-mail: nome com HTML não é interpretado e o teste do administrador usa o mesmo modelo', async () => {
  const { mailer, sent } = mailerWithOutbox();
  await mailer.sendSignupCode('x@teste.com', '<script>alert(1)</script> Eva', '246801', 10);
  assert.ok(!sent[0].html.includes('<script>'));
  assert.ok(sent[0].html.includes('&lt;script&gt;'));
  await mailer.sendTest('x@teste.com');
  assert.match(sent[1].html, /<h1[^>]*>E-mail de teste<\/h1>/);
  assert.ok(sent[1].html.includes('cid:logo-geradorone'));
});
