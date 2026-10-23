const nodemailer = require('nodemailer');

function createMailer(config = {}, transportOverride) {
  let transport = transportOverride;
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
    setTransport(next) { transport = next; },
    async sendResetCode(to, code, minutes) {
      if (!this.enabled) throw new Error('E-mail não configurado.');
      await getTransport().sendMail({
        from: config.from,
        to,
        subject: 'GeradorOne — código para redefinir sua senha',
        text: `Seu código de verificação é ${code}.\nEle vale por ${minutes} minutos. Se você não pediu a troca de senha, ignore esta mensagem.`,
        html: `<p>Seu código de verificação do GeradorOne é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Ele vale por ${minutes} minutos. Se você não pediu a troca de senha, ignore esta mensagem.</p>`
      });
    }
  };
}

module.exports = { createMailer };
