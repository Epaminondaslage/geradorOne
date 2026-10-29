// Idiomas no servidor: escolhe o idioma da requisição, traduz mensagens (`srv.*`) e monta erros com chave.
// Os dicionários são os mesmos do navegador (public/i18n/<código>.js). Faltou a chave no dicionário:
// vale o texto de lib/mensagens-pt.js; faltou lá também: devolve a própria chave.
const i18n = require('../public/i18n.js');
const PT = require('./mensagens-pt');

const DICIONARIOS = Object.fromEntries(i18n.CODIGOS.map(codigo => [codigo, require(`../public/i18n/${codigo}.js`)]));

// O pt-BR do servidor é a base (mensagens-pt) coberta pelo dicionário do app, quando a chave existe nele.
function combinar(dicionarios) {
  return { ...dicionarios, [i18n.PADRAO]: { ...PT, ...(dicionarios[i18n.PADRAO] || {}) } };
}
const PADRAO_COMBINADO = combinar(DICIONARIOS);

// `dicionarios` é opcional e serve para os testes injetarem textos.
function criarT(codigo, dicionarios) {
  return i18n.criar(dicionarios ? combinar(dicionarios) : PADRAO_COMBINADO, codigo);
}

function lerCookie(header, nome) {
  for (const parte of String(header || '').split(';')) {
    const indice = parte.indexOf('=');
    if (indice !== -1 && parte.slice(0, indice).trim() === nome) {
      try { return decodeURIComponent(parte.slice(indice + 1).trim()); } catch { return ''; }
    }
  }
  return '';
}

// Cookie `idioma`, depois o idioma da conta, depois Accept-Language, depois pt-BR.
function idiomaDaRequisicao(req, user) {
  const headers = req?.headers || {};
  return i18n.escolher({ cookie: lerCookie(headers.cookie, 'idioma'), conta: user?.language, aceita: headers['accept-language'] });
}

// `language` vindo do corpo de uma requisição: vale se for um idioma suportado; senão, o idioma da requisição.
function idiomaDoCorpo(req, user, language) {
  return i18n.normalizar(language) || idiomaDaRequisicao(req, user);
}

function tr(req, user, chave, params, dicionarios) {
  return criarT(idiomaDaRequisicao(req, user), dicionarios)(chave, params);
}

// `srv.erro.tema_invalido` vira `erro.tema_invalido`.
const codigoDe = chave => String(chave).replace(/^srv\./, '');

// Erro com chave e parâmetros: `message` já sai em português (compatível com quem lê só o texto),
// e o server.js traduz pela chave ao responder.
function erro(chave, params, status = 400) {
  return Object.assign(new Error(criarT(i18n.PADRAO)(chave, params)), { status, key: chave, params, code: codigoDe(chave) });
}

// Corpo `{ error, code }` de uma resposta de falha. Erro sem chave mantém a própria mensagem
// (por exemplo, a que o provedor de IA devolveu); sem status ele é inesperado e vira `reserva`.
function corpoErro(req, user, falha, reserva = 'srv.erro.erro_interno', dicionarios) {
  const t = criarT(idiomaDaRequisicao(req, user), dicionarios);
  if (falha?.key) return { error: t(falha.key, falha.params), code: codigoDe(falha.key) };
  if (falha?.status) return { error: falha.message };
  return { error: t(reserva), code: codigoDe(reserva) };
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Textos jurídicos ficam só em português; em outro idioma, a página ganha a ressalva no topo do conteúdo.
// Mantém `<html lang="pt-BR">`. Sem a chave `legal.ressalva` no dicionário, não injeta nada.
function injetarRessalva(html, idioma, dicionarios) {
  if (!idioma || idioma === i18n.PADRAO) return html;
  const t = criarT(idioma, dicionarios);
  const texto = t('legal.ressalva');
  if (texto === 'legal.ressalva') return html;
  const bloco = `<p class="ressalva-legal" lang="${idioma}" role="note">${escapar(texto)}</p>`;
  if (/<main\b[^>]*>/i.test(html)) return html.replace(/<main\b[^>]*>/i, abertura => `${abertura}\n      ${bloco}`);
  if (/<\/h1\s*>/i.test(html)) return html.replace(/<\/h1\s*>/i, fecho => `${fecho}\n      ${bloco}`);
  return html;
}

// Regra de idioma acrescentada ao que vai para a IA: toda a saída, inclusive o texto dentro de imagens, nesse idioma.
function regraDeIdioma(idioma, dicionarios) {
  const t = criarT(idioma, dicionarios);
  return t('srv.ia.responder_em', { idioma: t(`srv.ia.idioma.${t.idioma}`) });
}

// Troca o e-mail de contato padrão pelo configurado. O valor entra como dado: em arquivo .js vira texto de
// literal entre aspas (escapado), em HTML vira texto escapado. Um e-mail com aspas ou < > não quebra nem injeta código.
function trocarContato(texto, extensao, padrao, contato) {
  const seguro = extensao === '.js' ? JSON.stringify(contato).slice(1, -1) : escapar(contato);
  return texto.split(padrao).join(seguro);
}

module.exports = { trocarContato, criarT, idiomaDaRequisicao, idiomaDoCorpo, tr, erro, codigoDe, corpoErro, injetarRessalva, regraDeIdioma, escapar, DICIONARIOS };
