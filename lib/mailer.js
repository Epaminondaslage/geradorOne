const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const { renderEmail, LOGO_CID, DEFAULT_CONTACT } = require('./email-template');
const { criarT } = require('./i18n-servidor');

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
  async function deliver(self, to, subject, parts, extra = {}) {
    if (!self.enabled) throw new Error('E-mail não configurado.');
    const { html, text } = renderEmail(parts, brand, Boolean(logoPng), extra.idioma);
    await getTransport().sendMail({
      from: config.from,
      to,
      subject,
      text,
      html,
      ...(extra.replyTo ? { replyTo: extra.replyTo } : {}),
      attachments: [...(logoPng ? [{ filename: 'geradorone.png', content: logoPng, cid: LOGO_CID, contentType: 'image/png', contentDisposition: 'inline' }] : []), ...(extra.attachments || [])]
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
    // Para onde vão as mensagens do "Fale com o suporte".
    supportAddress() { return brand.contactEmail || DEFAULT_CONTACT; },
    async sendSupportMessage(data) {
      const sizeLabel = file => `${file.filename} (${Math.max(1, Math.round(file.buffer.length / 1024))} KB)`;
      await deliver(this, this.supportAddress(), `[GeradorOne] Suporte (${data.tipoLabel}) · ${data.protocolo}`, {
        preheader: `${data.tipoLabel} de ${data.nome || data.email}, protocolo ${data.protocolo}.`,
        title: `${data.tipoLabel} enviada pelo app`,
        paragraphs: ['Mensagem recebida pela tela "Fale com o suporte". Para responder, use "Responder": a resposta vai para o e-mail informado pela pessoa.'],
        rows: [
          ['Protocolo', data.protocolo],
          ['Tipo', data.tipoLabel],
          ['Nome', data.nome || '(não informado)'],
          ['E-mail para resposta', data.email],
          ['Conta no app', `${data.conta.name} <${data.conta.email}>, perfil ${data.conta.role}`],
          ['Tela de origem', data.origem || '(não informada)'],
          ['Anexos', data.anexos.length ? data.anexos.map(sizeLabel).join(', ') : 'nenhum']
        ],
        quote: data.mensagem || '(sem texto, só anexos)'
      }, { replyTo: data.email, attachments: data.anexos.map(file => ({ filename: file.filename, content: file.buffer, contentType: file.contentType })) });
    },
    // Os e-mails abaixo saem no idioma do destinatário (`idioma`, padrão pt-BR). O da mensagem de suporte vai para o
    // operador e fica em português; os de cobrança e recibo (repositório comercial) também ficam sempre em português.
    async sendSupportReceipt(data, idioma) {
      const t = criarT(idioma);
      const arquivos = data.anexos.length ? t.plural('srv.email.recibo_arquivos', data.anexos.length) : t('srv.email.recibo_nenhum');
      const primeiroNome = String(data.nome || '').split(/\s+/)[0];
      await deliver(this, data.email, t('srv.email.recibo_assunto', { protocolo: data.protocolo }), {
        preheader: t('srv.email.recibo_preheader', { protocolo: data.protocolo }),
        title: t('srv.email.recibo_titulo'),
        paragraphs: [`${data.nome ? t('srv.email.recibo_ola', { nome: primeiroNome }) : ''}${t('srv.email.recibo_corpo')}`],
        rows: [[t('srv.email.recibo_protocolo'), data.protocolo], [t('srv.email.recibo_tipo'), data.tipo ? t(`srv.suporte.tipo.${data.tipo}`) : data.tipoLabel], [t('srv.email.recibo_anexos'), arquivos]],
        quote: data.mensagem || t('srv.email.recibo_sem_texto'),
        closing: t('srv.email.recibo_fecho')
      }, { replyTo: this.supportAddress(), idioma });
    },
    async sendTest(to, idioma) {
      const t = criarT(idioma);
      await deliver(this, to, t('srv.email.teste_assunto'), {
        preheader: t('srv.email.teste_preheader'),
        title: t('srv.email.teste_titulo'),
        paragraphs: [t('srv.email.teste_corpo')],
        closing: t('srv.email.teste_fecho')
      }, { idioma });
    },
    async sendResetCode(to, code, minutes, idioma) {
      const t = criarT(idioma);
      await deliver(this, to, t('srv.email.codigo_assunto'), {
        preheader: t('srv.email.reset_preheader', { codigo: code }),
        title: t('srv.email.reset_titulo'),
        paragraphs: [t('srv.email.reset_corpo')],
        code,
        codeNote: t('srv.email.codigo_validade', { minutos: minutes }),
        closing: t('srv.email.reset_fecho')
      }, { idioma });
    },
    async sendSignupCode(to, name, code, minutes, idioma) {
      const t = criarT(idioma);
      const firstName = String(name || '').trim().split(/\s+/)[0] || t('srv.email.cadastro_nome_padrao');
      await deliver(this, to, t('srv.email.cadastro_assunto'), {
        preheader: t('srv.email.cadastro_preheader', { codigo: code }),
        title: t('srv.email.cadastro_titulo'),
        paragraphs: [t('srv.email.cadastro_corpo', { nome: firstName })],
        code,
        codeNote: t('srv.email.codigo_validade', { minutos: minutes }),
        closing: t('srv.email.cadastro_fecho')
      }, { idioma });
    }
  };
}

module.exports = { createMailer };
