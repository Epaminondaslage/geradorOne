// Idioma no navegador: escolhe o idioma, traduz o HTML marcado e desenha o seletor com bandeiras.
// Marcas no HTML: data-i18n="chave" (texto), data-i18n-attr="placeholder:chave;aria-label:chave2".
(function () {
  const { IDIOMAS, escolher, criar, normalizar } = window.i18n;
  const COOKIE = 'idioma';
  const lerCookie = () => (document.cookie.match(/(?:^|; )idioma=([^;]*)/) || [])[1];
  const gravarCookie = codigo => {
    const seguro = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${codigo}; Path=/; Max-Age=31536000; SameSite=Lax${seguro}`;
  };

  let contaIdioma = null;
  let atual = escolher({ query: new URLSearchParams(location.search).get('lang'), cookie: lerCookie(), conta: contaIdioma, aceita: navigator.languages?.join(',') || navigator.language });
  let t = criar(window.I18N_DICT, atual);
  const ouvintes = [];

  function traduzirDocumento(raiz = document) {
    document.documentElement.lang = atual;
    for (const el of raiz.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    // Avisos que só fazem sentido fora do português (ex.: texto legal só em português do Brasil).
    for (const el of raiz.querySelectorAll('[data-fora-pt]')) el.hidden = atual === 'pt-BR';
    for (const el of raiz.querySelectorAll('[data-i18n-attr]')) {
      for (const par of el.dataset.i18nAttr.split(';')) {
        const [atributo, chave] = par.split(':');
        if (atributo && chave) el.setAttribute(atributo.trim(), t(chave.trim()));
      }
    }
  }

  function desenharSeletor(host) {
    const ativo = IDIOMAS.find(l => l.codigo === atual);
    host.innerHTML = '';
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'idioma-botao';
    botao.setAttribute('aria-haspopup', 'listbox');
    botao.setAttribute('aria-expanded', 'false');
    botao.setAttribute('aria-label', `${t('idioma.rotulo')}: ${ativo.nome}`);
    botao.innerHTML = `${ativo.bandeira}<span class="idioma-nome">${ativo.nome}</span><span class="idioma-seta" aria-hidden="true">▾</span>`;
    const lista = document.createElement('ul');
    lista.className = 'idioma-lista';
    lista.setAttribute('role', 'listbox');
    lista.hidden = true;
    for (const l of IDIOMAS) {
      const item = document.createElement('li');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(l.codigo === atual));
      item.tabIndex = -1;
      item.dataset.codigo = l.codigo;
      item.lang = l.codigo;
      item.innerHTML = `${l.bandeira}<span>${l.nome}</span>`;
      lista.append(item);
    }
    const abrir = (aberto, foco) => {
      lista.hidden = !aberto;
      botao.setAttribute('aria-expanded', String(aberto));
      if (aberto) (lista.querySelector('[aria-selected="true"]') || lista.firstChild).focus();
      else if (foco) botao.focus();
    };
    botao.addEventListener('click', () => abrir(lista.hidden));
    lista.addEventListener('click', e => { const item = e.target.closest('li'); if (item) definir(item.dataset.codigo); });
    lista.addEventListener('keydown', e => {
      const itens = [...lista.children];
      const i = itens.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); itens[Math.min(i + 1, itens.length - 1)].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); itens[Math.max(i - 1, 0)].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); itens[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); itens[itens.length - 1].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (document.activeElement.dataset.codigo) definir(document.activeElement.dataset.codigo); }
      else if (e.key === 'Escape' || e.key === 'Tab') abrir(false, e.key === 'Escape');
    });
    document.addEventListener('click', e => { if (!host.contains(e.target)) abrir(false); });
    host.append(botao, lista);
  }

  function definir(codigo, { gravar = true } = {}) {
    const novo = normalizar(codigo);
    if (!novo) return;
    atual = novo;
    t = criar(window.I18N_DICT, atual);
    api.t = t;
    gravarCookie(atual);
    document.querySelectorAll('[data-seletor-idioma]').forEach(desenharSeletor);
    traduzirDocumento();
    if (gravar) for (const fn of ouvintes) fn(atual);
  }

  const api = {
    t,
    get idioma() { return atual; },
    definir,
    traduzirDocumento,
    aoMudar: fn => ouvintes.push(fn),
    // A conta do usuário vence o cookie só quando não há ?lang= na URL.
    usarIdiomaDaConta(codigo) {
      contaIdioma = normalizar(codigo);
      if (contaIdioma && contaIdioma !== atual && !new URLSearchParams(location.search).get('lang')) definir(contaIdioma);
    }
  };
  window.idioma = api;
  window.t = (...args) => api.t(...args);
  window.t.plural = (...args) => api.t.plural(...args);

  gravarCookie(atual);
  document.querySelectorAll('[data-seletor-idioma]').forEach(desenharSeletor);
  traduzirDocumento();
})();
