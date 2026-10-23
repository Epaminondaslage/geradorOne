// Modelo dos e-mails do GeradorOne: HTML com estilos inline e tabelas (único formato que os clientes de e-mail respeitam),
// mais a versão em texto puro. O logotipo vai como imagem embutida (cid), sem depender de endereço público.
const REPO_URL = 'https://github.com/Epaminondaslage/geradorOne';
const DEFAULT_CONTACT = 'fulano@dominio.com.br';
const LOGO_CID = 'logo-geradorone';

const C = { bg: '#f2f0eb', paper: '#fcfbf8', ink: '#1d1b17', muted: '#5c574e', line: '#d3cec4', accent: '#13704a' };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Arial,Helvetica,sans-serif";
const MONO = "'Courier New',Courier,monospace";

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function link(url, label, color = C.accent) {
  return `<a href="${escapeHtml(url)}" style="color:${color};text-decoration:underline;" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function logoImg(width, hasLogo) {
  if (!hasLogo) return '';
  const height = Math.round(width * 240 / 216);
  return `<img src="cid:${LOGO_CID}" width="${width}" height="${height}" alt="Logotipo do GeradorOne" style="display:block;border:0;outline:none;width:${width}px;height:${height}px;">`;
}

// partes: { preheader, title, paragraphs: [texto], code, codeNote, closing }
function renderEmail(parts, brand = {}, hasLogo = true) {
  const appUrl = brand.appUrl || '';
  const contact = brand.contactEmail || DEFAULT_CONTACT;
  const paragraphs = (parts.paragraphs || []).map(text => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">${escapeHtml(text)}</p>`).join('');
  const codeBlock = parts.code ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 8px;">
          <tr><td align="center" style="border:2px solid ${C.ink};background:${C.paper};padding:16px 28px;font-family:${MONO};font-size:38px;font-weight:bold;letter-spacing:10px;color:${C.ink};">${escapeHtml(parts.code)}</td></tr>
        </table>
        <p style="margin:0 0 20px;text-align:center;font-family:${SANS};font-size:14px;color:${C.muted};">${escapeHtml(parts.codeNote || '')}</p>` : '';
  const rows = (parts.rows || []).length ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${parts.rows.map(([label, value]) => `
          <tr><td valign="top" style="padding:4px 14px 4px 0;font-family:${SANS};font-size:13px;color:${C.muted};white-space:nowrap;">${escapeHtml(label)}</td><td valign="top" style="padding:4px 0;font-family:${SANS};font-size:14px;color:${C.ink};">${escapeHtml(value)}</td></tr>`).join('')}
        </table>` : '';
  const quote = parts.quote ? `
        <div style="margin:4px 0 20px;padding:14px 16px;border-left:3px solid ${C.accent};background:${C.bg};font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink};">${escapeHtml(parts.quote).replace(/\r?\n/g, '<br>')}</div>` : '';
  const closing = parts.closing ? `<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.muted};">${escapeHtml(parts.closing)}</p>` : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(parts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};">${escapeHtml(parts.preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.paper};border:1px solid ${C.line};">
      <tr><td style="padding:24px 28px;border-bottom:2px solid ${C.ink};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          ${hasLogo ? `<td valign="middle" style="padding-right:16px;">${logoImg(54, hasLogo)}</td>` : ''}
          <td valign="middle">
            <div style="font-family:${SERIF};font-size:28px;line-height:1.1;font-weight:bold;color:${C.ink};">GeradorOne</div>
            <div style="margin-top:4px;font-family:${SANS};font-size:13px;color:${C.muted};">Prompts visuais para apostilas, capas e materiais didáticos</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px 28px 28px;">
        <h1 style="margin:0 0 20px;font-family:${SERIF};font-size:24px;line-height:1.25;color:${C.ink};">${escapeHtml(parts.title)}</h1>
        ${paragraphs}${rows}${quote}${codeBlock}
        ${closing}
      </td></tr>
      <tr><td style="padding:20px 28px 24px;border-top:1px solid ${C.line};background:${C.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${hasLogo ? `<td valign="top" width="40" style="padding-right:14px;">${logoImg(36, hasLogo)}</td>` : ''}
          <td valign="top" style="font-family:${SANS};font-size:13px;line-height:1.7;color:${C.muted};">
            <div style="font-family:${SERIF};font-size:16px;font-weight:bold;color:${C.ink};">GeradorOne</div>
            ${appUrl ? `<div>Endereço: ${link(appUrl, appUrl)}</div>` : ''}
            <div>Contato: ${link(`mailto:${contact}`, contact)}</div>
            <div>Código aberto (AGPL-3.0): ${link(REPO_URL, 'github.com/Epaminondaslage/geradorOne')}</div>
            <div style="margin-top:10px;font-size:12px;">Você recebeu esta mensagem porque este endereço de e-mail foi usado no GeradorOne. Se não foi você, ignore-a: nada será feito sem o código.</div>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    parts.title,
    '',
    ...(parts.paragraphs || []).flatMap(p => [p, '']),
    ...((parts.rows || []).flatMap(([label, value]) => [`${label}: ${value}`])),
    ...((parts.rows || []).length ? [''] : []),
    ...(parts.quote ? [...parts.quote.split(/\r?\n/).map(line => `> ${line}`), ''] : []),
    ...(parts.code ? [`Código: ${parts.code}`, parts.codeNote || '', ''] : []),
    ...(parts.closing ? [parts.closing, ''] : []),
    '--',
    'GeradorOne: prompts visuais para apostilas, capas e materiais didáticos',
    ...(appUrl ? [`Endereço: ${appUrl}`] : []),
    `Contato: ${contact}`,
    `Código aberto (AGPL-3.0): ${REPO_URL}`
  ].join('\n');

  return { html, text };
}

module.exports = { renderEmail, escapeHtml, LOGO_CID, DEFAULT_CONTACT, REPO_URL };
