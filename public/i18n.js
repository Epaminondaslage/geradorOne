// Núcleo de idiomas: o mesmo arquivo roda no navegador (window.i18n) e no servidor (require).
// Os dicionários ficam em public/i18n/<código>.js; o pt-BR é a fonte e o último recurso de tradução.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.i18n = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const PADRAO = 'pt-BR';
  const svg = corpo => `<svg viewBox="0 0 30 20" width="24" height="16" aria-hidden="true" focusable="false">${corpo}</svg>`;
  const IDIOMAS = [
    { codigo: 'pt-BR', nome: 'Português', bandeira: svg('<rect width="30" height="20" fill="#009b3a"/><path d="M15 2.5 27 10 15 17.5 3 10z" fill="#fedf00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/>') },
    { codigo: 'en', nome: 'English', bandeira: svg('<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0 0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0 0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.4"/>') },
    { codigo: 'es', nome: 'Español', bandeira: svg('<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>') },
    { codigo: 'de', nome: 'Deutsch', bandeira: svg('<rect width="30" height="20" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#dd0000"/><rect y="13.33" width="30" height="6.67" fill="#ffce00"/>') },
    { codigo: 'it', nome: 'Italiano', bandeira: svg('<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#009246"/><rect x="20" width="10" height="20" fill="#ce2b37"/>') }
  ];
  const CODIGOS = IDIOMAS.map(l => l.codigo);

  // 'pt', 'PT-br', 'en-US', 'es_MX' viram o código suportado; qualquer outra coisa vira null.
  function normalizar(valor) {
    if (typeof valor !== 'string') return null;
    const base = valor.trim().toLowerCase().replace('_', '-').split('-')[0];
    return CODIGOS.find(c => c.toLowerCase().split('-')[0] === base) || null;
  }

  // Precedência: ?lang= na URL, cookie, conta do usuário, Accept-Language, padrão.
  function escolher({ query, cookie, conta, aceita } = {}) {
    for (const candidato of [query, cookie, conta]) {
      const codigo = normalizar(candidato);
      if (codigo) return codigo;
    }
    if (typeof aceita === 'string') {
      const lista = aceita.split(',').map(parte => {
        const [tag, q] = parte.trim().split(';q=');
        return { tag, q: q === undefined ? 1 : Number(q) || 0 };
      }).sort((a, b) => b.q - a.q);
      for (const { tag } of lista) {
        const codigo = normalizar(tag);
        if (codigo) return codigo;
      }
    }
    return PADRAO;
  }

  function preencher(texto, params) {
    if (!params) return texto;
    return texto.replace(/\{([a-z_]+)\}/g, (inteiro, nome) => (params[nome] === undefined ? inteiro : String(params[nome])));
  }

  function criar(dicionarios, idioma) {
    const lingua = normalizar(idioma) || PADRAO;
    const regra = new Intl.PluralRules(lingua);
    const buscar = chave => {
      const achado = dicionarios[lingua]?.[chave] ?? dicionarios[PADRAO]?.[chave];
      return typeof achado === 'string' ? achado : null;
    };
    const t = (chave, params) => preencher(buscar(chave) ?? chave, params);
    t.plural = (chave, n, params) => t(`${chave}.${regra.select(n) === 'one' ? 'um' : 'outros'}`, { n, ...params });
    t.idioma = lingua;
    return t;
  }

  return { PADRAO, IDIOMAS, CODIGOS, normalizar, escolher, criar };
});
