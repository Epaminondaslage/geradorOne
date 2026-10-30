// Idioma do prompt: a pessoa escolhe em que idioma o prompt é gerado, mesmo que a tela do app esteja em outro.
// Sem escolha, o prompt acompanha o idioma da tela. A escolha fica só neste navegador (localStorage).
// Marca no HTML: <div data-idioma-prompt></div> (cinco bandeiras pequenas, com um anel que anda de uma a outra).
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./i18n.js') : root.i18n);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root.i18n && root.idioma) root.idiomaPrompt = api.iniciar(root);
})(typeof self !== 'undefined' ? self : globalThis, function (i18n) {
  const CHAVE = 'idioma_prompt';

  // Escolha válida vence; sem ela (ou inválida), vale o idioma da tela.
  function resolverIdioma(escolhido, pagina) {
    return i18n.normalizar(escolhido) || pagina;
  }

  // Valor a guardar depois de um clique: igual ao da tela volta a acompanhar a tela (null).
  function sobreposicao(codigo, pagina) {
    const valido = i18n.normalizar(codigo);
    return valido && valido !== pagina ? valido : null;
  }

  function iniciar(win) {
    const { IDIOMAS, criar } = win.i18n;
    const doc = win.document;
    const cache = {};
    let contador = 0;
    let escolhido = null;
    try { escolhido = win.localStorage.getItem(CHAVE); } catch { /* sem armazenamento: acompanha a tela */ }

    const idioma = () => resolverIdioma(escolhido, win.idioma.idioma);
    const hosts = () => [...doc.querySelectorAll('[data-idioma-prompt]')];

    function guardar() {
      try {
        if (escolhido) win.localStorage.setItem(CHAVE, escolhido);
        else win.localStorage.removeItem(CHAVE);
      } catch { /* sem armazenamento: vale só nesta página */ }
    }

    // Atualiza anel e estado dos botões sem refazer os elementos, para o anel andar de uma bandeira à outra.
    function atualizar() {
      const atual = idioma();
      const indice = IDIOMAS.findIndex(l => l.codigo === atual);
      for (const host of hosts()) {
        const grupo = host.querySelector('.idioma-prompt-grupo');
        if (!grupo) continue;
        grupo.style.setProperty('--i', String(indice));
        for (const b of grupo.querySelectorAll('.idioma-prompt-bandeira')) {
          const marcado = b.dataset.idioma === atual;
          b.setAttribute('aria-checked', String(marcado));
          b.tabIndex = marcado ? 0 : -1;
        }
      }
    }

    function escolher(codigo, host) {
      escolhido = sobreposicao(codigo, win.idioma.idioma);
      guardar();
      atualizar();
      host?.querySelector('.idioma-prompt-bandeira[aria-checked="true"]')?.focus();
    }

    function desenhar(host) {
      const titulo = doc.createElement('span');
      titulo.className = 'idioma-prompt-titulo';
      titulo.id = `idioma-prompt-titulo-${++contador}`;
      titulo.textContent = win.t('idioma.prompt_titulo');
      const grupo = doc.createElement('div');
      grupo.className = 'idioma-prompt-grupo';
      grupo.setAttribute('role', 'radiogroup');
      grupo.setAttribute('aria-labelledby', titulo.id);
      const anel = doc.createElement('span');
      anel.className = 'idioma-prompt-anel';
      anel.setAttribute('aria-hidden', 'true');
      grupo.appendChild(anel);
      for (const l of IDIOMAS) {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'idioma-prompt-bandeira';
        b.dataset.idioma = l.codigo;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', l.nome);
        b.title = l.nome;
        // A bandeira vem do núcleo de idiomas como texto SVG; o analisador HTML a transforma em elemento.
        b.appendChild(new win.DOMParser().parseFromString(l.bandeira, 'text/html').body.firstChild);
        b.addEventListener('click', () => escolher(l.codigo, host));
        b.addEventListener('keydown', evento => {
          const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[evento.key];
          const de = IDIOMAS.findIndex(x => x.codigo === l.codigo);
          const para = evento.key === 'Home' ? 0 : evento.key === 'End' ? IDIOMAS.length - 1 : passo ? (de + passo + IDIOMAS.length) % IDIOMAS.length : -1;
          if (para < 0) return;
          evento.preventDefault();
          escolher(IDIOMAS[para].codigo, host);
        });
        grupo.appendChild(b);
      }
      host.replaceChildren(titulo, grupo);
    }

    const desenharTodos = () => { hosts().forEach(desenhar); atualizar(); };
    win.idioma.aoMudar(desenharTodos);
    desenharTodos();

    return {
      get idioma() { return idioma(); },
      // Tradutor do idioma do prompt (com .plural), para os geradores de prompt.
      get t() {
        const codigo = idioma();
        return cache[codigo] || (cache[codigo] = criar(win.I18N_DICT, codigo));
      }
    };
  }

  return { resolverIdioma, sobreposicao, iniciar };
});
