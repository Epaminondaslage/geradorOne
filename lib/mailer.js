const nodemailer = require('nodemailer');

function createMailer(initialConfig = {}, transportOverride) {
  let config = initialConfig;
  let transport = transportOverride;
  let injected = Boolean(transportOverride);
  const getTransport = () => {
    if (!transport) {
      transport = nodemailer.createTransport({
        host: config.host,
        port: Number(config.port) || 587,
        secure: String(config.secure) === 'true',
        requireTLS: String(config.requireTLS) === 'true',
        auth: config.user ? { user: config.user, pass: config.pass } : undefined
      });
    }
    return transport;
  };
  return {
    get enabled() { return Boolean(transport || (config.host && config.from)); },
    setTransport(next) { transport = next; injected = true; },
    // Troca a configuração em uso sem reiniciar; um transporte injetado (testes) é preservado.
    setConfig(next) {
      config = next || {};
      if (!injected) transport = undefined;
    },
    async verify() {
      if (!this.enabled) throw new Error('E-mail não configurado.');
      const current = getTransport();
      if (current.verify) await current.verify();
    },
    async sendTest(to) {
      if (!this.enabled) throw new Error('E-mail não configurado.');
      await getTransport().sendMail({
        from: config.from,
        to,
        subject: 'GeradorOne — e-mail de teste',
        text: 'Este é um e-mail de teste do GeradorOne. Se você o recebeu, o envio de e-mails está funcionando.',
        html: '<p>Este é um e-mail de teste do GeradorOne. Se você o recebeu, o envio de e-mails está funcionando.</p>'
      });
    },
    async sendResetCode(to, code, minutes) {
      if (!this.enabled) throw new Error('E-mail não configurado.');
      await getTransport().sendMail({
        from: config.from,
        to,
        subject: 'GeradorOne — código para redefinir sua senha',
        text: `Seu código de verificação é ${code}.\nEle vale por ${minutes} minutos. Se você não pediu a troca de senha, ignore esta mensagem.`,
        html: `<p>Seu código de verificação do GeradorOne é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Ele vale por ${minutes} minutos. Se você não pediu a troca de senha, ignore esta mensagem.</p>`
      });
    },
    async sendSignupCode(to, name, code, minutes) {
      if (!this.enabled) throw new Error('E-mail não configurado.');
      const safeName = String(name).replace(/[<>&"]/g, '');
      await getTransport().sendMail({
        from: config.from,
        to,
        subject: 'GeradorOne — confirme o seu cadastro',
        text: `Olá, ${safeName}. Seu código para confirmar o cadastro no GeradorOne é ${code}.\nEle vale por ${minutes} minutos. Se você não pediu este cadastro, ignore esta mensagem.`,
        html: `<p>Olá, ${safeName}. Seu código para confirmar o cadastro no GeradorOne é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Ele vale por ${minutes} minutos. Se você não pediu este cadastro, ignore esta mensagem.</p>`
      });
    }
  };
}

module.exports = { createMailer };
