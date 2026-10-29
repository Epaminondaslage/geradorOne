// Perguntas e respostas da tela FAQ. Os textos moram nos dicionários de idioma (public/i18n/*.js):
// faq.cat.<categoria>, faq.<id>.pergunta e faq.<id>.resposta. Aqui fica só a estrutura (id estável e
// categoria de cada item). Texto puro: parágrafos separados por linha em branco, listas com "- " e
// passos com "1. ". Ao mudar um rótulo ou fluxo do app, atualize os textos nos dicionários junto.
const FAQ_ESTRUTURA = [
  ['01', 'primeiros-passos'],
  ['02', 'primeiros-passos'],
  ['03', 'primeiros-passos'],
  ['04', 'primeiros-passos'],
  ['05', 'primeiros-passos'],
  ['06', 'primeiros-passos'],
  ['07', 'primeiros-passos'],
  ['08', 'conta-e-acesso'],
  ['09', 'conta-e-acesso'],
  ['10', 'conta-e-acesso'],
  ['11', 'conta-e-acesso'],
  ['12', 'conta-e-acesso'],
  ['13', 'conta-e-acesso'],
  ['14', 'conta-e-acesso'],
  ['15', 'conta-e-acesso'],
  ['16', 'conta-e-acesso'],
  ['17', 'conta-e-acesso'],
  ['18', 'conta-e-acesso'],
  ['19', 'apostila'],
  ['20', 'apostila'],
  ['21', 'apostila'],
  ['22', 'apostila'],
  ['23', 'apostila'],
  ['24', 'apostila'],
  ['25', 'apostila'],
  ['26', 'apostila'],
  ['27', 'apostila'],
  ['28', 'apostila'],
  ['29', 'apostila'],
  ['30', 'apostila'],
  ['31', 'apostila'],
  ['32', 'bncc'],
  ['33', 'bncc'],
  ['34', 'bncc'],
  ['35', 'bncc'],
  ['36', 'bncc'],
  ['37', 'bncc'],
  ['38', 'bncc'],
  ['39', 'bncc'],
  ['40', 'suporte'],
  ['41', 'suporte'],
  ['42', 'suporte'],
  ['43', 'suporte'],
  ['44', 'suporte'],
  ['45', 'capa'],
  ['46', 'capa'],
  ['47', 'capa'],
  ['48', 'resultado-e-exportacao'],
  ['49', 'resultado-e-exportacao'],
  ['50', 'resultado-e-exportacao'],
  ['51', 'resultado-e-exportacao'],
  ['52', 'resultado-e-exportacao'],
  ['53', 'resultado-e-exportacao'],
  ['54', 'projetos'],
  ['55', 'projetos'],
  ['56', 'projetos'],
  ['57', 'projetos'],
  ['58', 'ia-e-chave'],
  ['59', 'ia-e-chave'],
  ['60', 'ia-e-chave'],
  ['61', 'ia-e-chave'],
  ['62', 'ia-e-chave'],
  ['63', 'ia-e-chave'],
  ['64', 'ia-e-chave'],
  ['65', 'ia-e-chave'],
  ['66', 'ia-e-chave'],
  ['67', 'ia-e-chave'],
  ['68', 'ia-e-chave'],
  ['69', 'ia-e-chave'],
  ['70', 'ia-e-chave'],
  ['71', 'ia-e-chave'],
  ['72', 'obter-a-chave-de-ia'],
  ['73', 'obter-a-chave-de-ia'],
  ['74', 'obter-a-chave-de-ia'],
  ['75', 'obter-a-chave-de-ia'],
  ['76', 'ia-e-chave'],
  ['77', 'ia-e-chave'],
  ['78', 'ia-e-chave'],
  ['79', 'aparencia-e-celular'],
  ['80', 'aparencia-e-celular'],
  ['81', 'aparencia-e-celular'],
  ['82', 'seguranca-e-privacidade'],
  ['83', 'seguranca-e-privacidade'],
  ['84', 'seguranca-e-privacidade'],
  ['85', 'seguranca-e-privacidade'],
  ['86', 'seguranca-e-privacidade'],
  ['87', 'seguranca-e-privacidade'],
  ['88', 'seguranca-e-privacidade'],
  ['89', 'seguranca-e-privacidade'],
  ['90', 'administracao'],
  ['91', 'administracao'],
  ['92', 'administracao'],
  ['93', 'administracao'],
  ['94', 'administracao']
];

// Sem o núcleo de idiomas (testes em Node ou carga fora de ordem), cai no dicionário pt-BR.
function faqTraduzir() {
  if (typeof window !== 'undefined' && typeof window.t === 'function') return window.t;
  const dict = typeof module !== 'undefined' && module.exports
    ? require('./i18n/pt-BR.js')
    : ((typeof window !== 'undefined' && window.I18N_DICT) || {})['pt-BR'] || {};
  return chave => (typeof dict[chave] === 'string' ? dict[chave] : chave);
}

// FAQ_ITEMS é preguiçoso: categoria, pergunta e resposta são lidas no idioma atual a cada acesso,
// então a lista acompanha a troca de idioma sem remontar nada.
const FAQ_ITEMS = FAQ_ESTRUTURA.map(([id, categoria]) => ({
  id: 'faq.' + id,
  get categoria() { return faqTraduzir()('faq.cat.' + categoria); },
  get pergunta() { return faqTraduzir()('faq.' + id + '.pergunta'); },
  get resposta() { return faqTraduzir()('faq.' + id + '.resposta'); }
}));

// Cópia simples (sem getters) no idioma atual.
function faqItens() {
  return FAQ_ITEMS.map(({ id, categoria, pergunta, resposta }) => ({ id, categoria, pergunta, resposta }));
}

if (typeof module !== 'undefined') module.exports = { FAQ_ITEMS, FAQ_ESTRUTURA, faqItens };
