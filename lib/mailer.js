const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const { renderEmail, LOGO_CID } = require('./email-template');

// Logotipo embutido nos e-mails; se o arquivo faltar, o e-mail sai só com o nome em texto.
let logoPng = null;
try { logoPng = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'icons', 'logo-email.png')); } catch { logoPng = null; }


function createMailer(initialConfig = {}, transportOverride) {
  let config = initialConfig;
  let transport = transportOverride;
  let injected = Boolean(transportOverride);
  let brand = { appUrl: '', contactEmail: '' };
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
  async function deliver(self, to, subject, parts) {
    if (!self.enabled) throw new Error('E-mail não configurado.');
    const { html, text } = renderEmail(parts, brand, Boolean(logoPng));
    await getTransport().sendMail({
      from: config.from,
      to,
      subject,
      text,
      html,
      attachments: logoPng ? [{ filename: 'geradorone.png', content: logoPng, cid: LOGO_CID, contentType: 'image/png', contentDisposition: 'inline' }] : []
    });
  }
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
    // Endereço do app e e-mail de contato mostrados no rodapé; vazio = padrão do modelo.
    setBrand(next) { brand = { appUrl: next?.appUrl || '', contactEmail: next?.contactEmail || '' }; },
    get brand() { return brand; },
    async sendTest(to) {
      await deliver(this, to, 'GeradorOne: e-mail de teste', {
        preheader: 'O envio de e-mails do GeradorOne está funcionando.',
        title: 'E-mail de teste',
        paragraphs: ['Se você recebeu esta mensagem, o envio de e-mails do GeradorOne está funcionando.'],
        closing: 'Este é só um teste feito por um administrador. Não precisa responder.'
      });
    },
    async sendResetCode(to, code, minutes) {
      await deliver(this, to, 'GeradorOne: código para redefinir sua senha', {
        preheader: `Seu código para redefinir a senha é ${code}.`,
        title: 'Redefinir a sua senha',
        paragraphs: ['Use o código abaixo para confirmar a troca de senha no GeradorOne.'],
        code,
        codeNote: `O código vale por ${minutes} minutos.`,
        closing: 'Se você não pediu a troca de senha, ignore esta mensagem. A sua senha continua a mesma.'
      });
    },
    async sendSignupCode(to, name, code, minutes) {
      const firstName = String(name || '').trim().split(/\s+/)[0] || 'tudo bem';
      await deliver(this, to, 'GeradorOne: confirme o seu cadastro', {
        preheader: `Seu código para confirmar o cadastro é ${code}.`,
        title: 'Confirme o seu cadastro',
        paragraphs: [`Olá, ${firstName}. Falta só um passo para usar o GeradorOne: digite o código abaixo na tela de cadastro.`],
        code,
        codeNote: `O código vale por ${minutes} minutos.`,
        closing: 'Se você não pediu este cadastro, ignore esta mensagem. Nenhuma conta é criada sem o código.'
      });
    }
  };
}

module.exports = { createMailer };
