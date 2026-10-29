// Geradores de prompt do GeradorOne (apostila, imagem e capa). O mesmo arquivo roda no navegador
// (window.prompts) e no Node (require), para o teste conferir a saída nos cinco idiomas.
// Todo texto fixo vem do dicionário (chaves prompt.*); os valores dos campos do formulário seguem em
// português (compatibilidade com projetos salvos) e são traduzidos na hora por prompt.opt.<slug>.
// Texto livre do usuário (assunto, observações, textos da capa) nunca é traduzido.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.prompts = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const RECURSOS = ['mapasMentais', 'diagramas', 'ilustracoes', 'infograficos', 'graficos', 'quadros', 'linhas', 'icones'];
  const MELHORAR = ['detalhado', 'simples', 'visual', 'didatico', 'profissional', 'criancas', 'dificuldade_mais', 'dificuldade_menos'];

  const slug = valor => String(valor).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const recursoSlug = nome => nome.replace(/[A-Z]/g, letra => `_${letra.toLowerCase()}`);

  function criarGeradores(t, idioma = 'pt-BR') {
    const P = 'prompt.';
    const ptBR = idioma === 'pt-BR';
    const plural = t.plural || ((chave, n, params) => t(`${chave}.${n === 1 ? 'um' : 'outros'}`, { n, ...params }));
    const tem = chave => t(chave) !== chave;
    // Traduz um valor de campo do formulário (estilo, tipo, nível...). Sem chave, devolve o valor cru.
    const opt = valor => {
      const cru = String(valor);
      const chave = `${P}opt.${slug(cru)}`;
      return tem(chave) ? t(chave) : cru;
    };
    // Versão em minúsculas para o meio da frase ("material de revisão"); em alemão os substantivos mantêm a maiúscula.
    const tipoBaixo = valor => {
      const cru = String(valor);
      const chave = `${P}tipo_baixa.${slug(cru)}`;
      return tem(chave) ? t(chave) : opt(cru).toLowerCase();
    };
    const itens = prefixo => {
      const lista = [];
      for (let i = 1; i <= 30; i += 1) {
        const chave = `${prefixo}_${i}`;
        if (!tem(chave)) break;
        lista.push(t(chave));
      }
      return lista;
    };
    const vazio = (valor, chave) => valor?.trim() || t(`${P}comum.${chave}`);
    const nomeIdioma = () => t(`${P}idioma.nome.${idioma}`);
    const clausulaIdioma = () => t(`${P}idioma.clausula`, { idioma: nomeIdioma() });
    const aprendizes = publico => (publico === 'Adulto' ? t(`${P}comum.aprendizes_adulto`)
      : publico === 'Outro' ? t(`${P}comum.aprendizes_outro`)
        : t(`${P}comum.aprendizes_alunos`, { publico: opt(publico) }));

    function selectedResources(data) {
      return RECURSOS.filter(nome => data[nome]).map(nome => t(`${P}recurso.${recursoSlug(nome)}`));
    }

    function perfilTipo(tipo) {
      const base = `${P}tipo.${slug(tipo)}`;
      const chave = tem(`${base}.foco`) ? base : `${P}tipo.apostila_didatica`;
      return { apoio: t(`${chave}.apoio`), foco: t(`${chave}.foco`), microtextos: itens(`${chave}.micro`), restricao: t(`${chave}.restricao`) };
    }
    function perfilEstilo(estilo) {
      const base = `${P}estilo.${slug(estilo)}`;
      const chave = tem(`${base}.ilustracao`) ? base : `${P}estilo.livro_didatico`;
      return { ilustracao: t(`${chave}.ilustracao`), pagina: t(`${chave}.pagina`), tipografia: t(`${chave}.tipografia`), evitar: t(`${chave}.evitar`) };
    }
    const layoutsTipo = tipo => itens(`${P}layout.${slug(tipo)}`);

    // Bloco com o texto oficial das habilidades; o texto da BNCC é oficial e brasileiro, então segue em português.
    function blocoBncc({ conhecidas = [], desconhecidas = [], fonte = '', versao = '' } = {}) {
      const linhas = [];
      if (conhecidas.length) {
        if (!ptBR) linhas.push(`- ${t(`${P}bncc.nota_pt`)}`);
        linhas.push(`- ${t(`${P}bncc.texto_oficial`, { fonte, versao })}`, ...conhecidas.map(item => `  * ${item.c}: ${item.t}`));
      }
      if (desconhecidas.length) linhas.push(`- ${t(`${P}bncc.desconhecidas`, { codigos: desconhecidas.join(', ') })}`);
      return linhas.join('\n');
    }

    function generatePrompt(data) {
      const visualItems = selectedResources(data);
      const bnccInstruction = t(`${P}apostila.${data.sugerirBncc ? 'bncc_sugerir' : 'bncc_apenas'}`);
      const a = chave => t(`${P}apostila.${chave}`);
      const publico = opt(data.publico);
      const comuns = { extensao: data.extensao, publico };
      const lista = (prefixo, extra) => itens(`${P}apostila.${prefixo}`).map((_, i) => `- ${t(`${P}apostila.${prefixo}_${i + 1}`, { ...comuns, ...extra })}`).join('\n');
      const campo = (chave, valor) => `- ${t(`${P}apostila.${chave}`, { valor })}`;
      const recursosSel = RECURSOS.map(nome => (data[nome] ? `- ${a(`s5_${recursoSlug(nome)}`)}\n` : '')).join('');
      const tarefaIdioma = a('tarefa_idioma') + (ptBR ? '' : ` ${clausulaIdioma()}`);
      return [
        a('atencao'), '\n\n', a('papel'), '\n\n', a('h_tarefa'), '\n',
        t(`${P}apostila.tarefa`, { tipo: opt(data.tipo), assunto: vazio(data.assunto, 'nao_informado'), disciplina: vazio(data.disciplina, 'nao_informado') }),
        ' ', tarefaIdioma,
        '\n\n1. ', a('s1_titulo'), '\n',
        [
          campo('s1_publico', publico),
          campo('s1_objetivo', vazio(data.objetivo, 'nao_informado')),
          campo('s1_profundidade', opt(data.profundidade)),
          campo('s1_escrita', opt(data.escrita)),
          campo('s1_densidade', opt(data.densidade)),
          campo('s1_extensao', data.extensao),
          `- ${a('s1_adapte')}`, `- ${a('s1_hipoteses')}`,
        ].join('\n'),
        '\n\n2. ', a('s2_titulo'), '\n',
        `- ${t(`${P}apostila.s2_bncc`, { valor: vazio(data.bncc, 'nenhum') })}`, data.bnccTextos ? `\n${data.bnccTextos}` : '',
        `\n- ${bnccInstruction}\n- ${t(`${P}apostila.s2_referencia`)}\n${vazio(data.referencias, 'sem_referencia')}\n- ${a('s2_ilustrativos')}`,
        '\n\n3. ', a('s3_titulo'), '\n', lista('s3'),
        '\n\n4. ', a('s4_titulo'), '\n',
        [
          campo('s4_estilo', opt(data.estiloVisual)),
          campo('s4_paleta', opt(data.paleta)),
          campo('s4_formato', opt(data.formato)),
          campo('s4_frequencia', opt(data.frequencia)),
          campo('s4_prof_visual', opt(data.profundidadeVisual)),
          campo('s4_recursos', visualItems.length ? visualItems.join(', ') : a('s4_nenhum_recurso')),
          `- ${a('s4_hierarquia')}`,
          `- ${t(`${P}apostila.s4_personagens`, { publico })}`,
        ].join('\n'),
        '\n\n5. ', a('s5_titulo'), '\n', a('s5_intro'), '\n', recursosSel,
        '\n', t(`${P}apostila.orientacoes`, { valor: vazio(data.orientacoes, 'nao_informado') }),
        '\n\n6. ', a('s6_titulo'), '\n', lista('s6'),
        '\n\n7. ', a('s7_titulo'), '\n', lista('s7'),
        '\n\n8. ', a('s8_titulo'), '\n', lista('s8'),
        '\n\n', a('final'),
      ].join('');
    }

    function pagePlan(total, tipo) {
      if (total === 1) return [];
      const plan = [t(`${P}plano.abertura`, { pagina: 1 })];
      const answerPage = tipo === 'Caderno de atividades';
      const lastContent = answerPage ? total - 1 : total;
      for (let page = 2; page < lastContent; page += 1) plan.push(t(`${P}plano.desenvolvimento`, { pagina: page, parte: page - 1 }));
      if (lastContent >= 2) plan.push(t(`${P}plano.${answerPage ? 'atividades_finais' : 'sintese'}`, { pagina: lastContent }));
      if (answerPage) plan.push(t(`${P}plano.gabarito`, { pagina: total }));
      return plan;
    }

    const formatoPagina = formato => t(`${P}formato_pagina.${{ 'Somente tela': 'tela', 'Apresentação 16:9': 'slide' }[formato] || 'padrao'}`);
    const formatoCapa = formato => t(`${P}formato_capa.${{ 'Somente tela': 'tela', 'Apresentação 16:9': 'slide' }[formato] || 'padrao'}`);
    const CRIANCAS = ['Educação Infantil', 'Ensino Fundamental I'];

    // Regras de texto dentro da imagem, só para idiomas diferentes do português (no pt-BR o prompt original já cobre).
    const regrasTextoImagem = prefixo => (ptBR ? [] : [prefixo + clausulaIdioma(), prefixo + t(`${P}idioma.texto_literal`, { idioma: nomeIdioma() })]);

    function generateImagePrompt(data) {
      const perfil = perfilTipo(data.tipo);
      const tipoNome = data.tipo === 'Outro' ? 'Material didático' : data.tipo;
      const tipoLow = tipoBaixo(tipoNome);
      const tipoOpt = opt(tipoNome);
      const estilo = opt(data.estiloVisual);
      const style = perfilEstilo(data.estiloVisual);
      const formato = formatoPagina(data.formato);
      const total = Math.max(1, Number.parseInt(data.paginas, 10) || 1);
      const assunto = vazio(data.assunto, 'nao_informado');
      const disciplina = vazio(data.disciplina, 'nao_informado');
      const visualItems = selectedResources(data);
      const plan = pagePlan(total, data.tipo);
      const childAudience = CRIANCAS.includes(data.publico);
      const publico = opt(data.publico);
      const learners = aprendizes(data.publico);
      const i = (chave, params) => t(`${P}imagem.${chave}`, params);
      const c = (chave, params) => t(`${P}comum.${chave}`, params);
      const extras = [
        data.objetivo?.trim() && i('extra_objetivo', { valor: data.objetivo.trim() }),
        data.bncc?.trim() && i('extra_bncc', { valor: data.bncc.trim() }),
        data.bnccTextos?.trim() && data.bnccTextos.trim(),
      ].filter(Boolean);
      const layouts = layoutsTipo(data.tipo);
      const elementoTipo = tem(`${P}elementos.${slug(data.tipo)}`) ? t(`${P}elementos.${slug(data.tipo)}`) : null;
      const lines = [
        c('atencao_imagem'),
        total === 1
          ? i('saida_uma', { tipo: tipoLow, assunto, formato })
          : i('saida_varias', { n: total, tipo: tipoLow, assunto, formato }),
        c('estilo_obrigatorio', { estilo }),
        i('tipo_obrigatorio', { tipo: tipoOpt }),
        i('nao_responda'),
        '',
        c('h_papel'),
        i('papel'),
        '',
        c('h_contexto'),
        c('l_disciplina', { valor: disciplina }),
        i('l_tema', { valor: assunto }),
        c('l_publico', { valor: publico }),
        i('l_profundidade', { valor: opt(data.profundidade) }),
        i('l_tipo', { valor: tipoOpt }),
        i('l_formato', { valor: formato }),
        plural(`${P}imagem.total_paginas`, total),
        i('l_escrita', { valor: opt(data.escrita) }),
        c('l_estilo', { valor: estilo }),
        c('l_paleta', { valor: opt(data.paleta) }),
        ...extras,
        '',
        c('h_revisao'),
        i('revisao'),
        '',
        i('h_missao'),
        total === 1
          ? i('missao_uma', { tipo: tipoLow, assunto, estilo, foco: perfil.foco })
          : i('missao_varias', { n: total, tipo: tipoLow, assunto, estilo, foco: perfil.foco }),
        '',
        `1) ${i('h_descricao')}`,
        i('descricao', { tipo: tipoLow, assunto, disciplina }),
        i('siga_estilo', { estilo }),
        `- ${c('linha_ilustracao', { valor: style.ilustracao })}`,
        `- ${c('linha_pagina', { valor: style.pagina })}`,
        `- ${c('linha_tipografia', { valor: style.tipografia })}`,
        `- ${c('linha_evite', { valor: style.evitar })}`,
        childAudience ? c('crianca_sim', { publico }) : i('crianca_nao', { aprendizes: learners }),
        i('d_1'),
        i('d_2'),
        i('d_3'),
        i('d_4'),
        data.paleta === 'Automática' ? i('paleta_auto') : i('paleta_fixa', { paleta: opt(data.paleta) }),
        i('d_5'),
        i('d_6'),
        i('idioma_texto'),
        ...regrasTextoImagem(''),
        ...(layouts.length ? [
          '',
          i('regra_layout', { tipo: opt(data.tipo).toUpperCase() }),
          ...layouts.map(rule => `- ${rule}`),
          ...(data.tipo === 'Mapa mental' && ['Doodle', 'Hand-drawn'].includes(data.estiloVisual) ? [`- ${i('mapa_caderno')}`] : []),
        ] : []),
        '',
        `2) ${i('h_microtextos')}`,
        i('titulo_caixa_alta', { valor: assunto.toUpperCase() }),
        i('linha_apoio', { disciplina, apoio: perfil.apoio, publico }),
        ...perfil.microtextos,
        '',
        `3) ${i('h_elementos')}`,
        ...(elementoTipo ? [elementoTipo] : [
          visualItems.length ? i('elementos_priorizando', { itens: visualItems.join(', ') }) : i('elementos_usar'),
          i('elementos_opcoes'),
        ]),
        '',
        `4) ${i('h_dificuldade')}`,
        i('dificuldade', { aprendizes: learners, assunto }),
      ];
      if (data.referencias?.trim()) lines.push('', i('h_referencia'), data.referencias.trim());
      if (plan.length) lines.push('', i('plano_h', { n: total }), ...plan, i('plano_distribua'), '', i('plano_gere'), i('plano_mantenha', { n: total }));
      lines.push(
        '',
        i('h_restricao'),
        perfil.restricao,
        '',
        i('h_criterios'),
        ...itens(`${P}imagem.criterio`).map(item => `- ${item}`),
      );
      if (data.orientacoes?.trim()) lines.push('', i('h_orientacoes'), data.orientacoes.trim());
      return lines.join('\n');
    }

    function generateCoverPrompt(data) {
      const formato = formatoCapa(data.formato);
      const style = perfilEstilo(data.estiloVisual);
      const estilo = opt(data.estiloVisual);
      const titulo = vazio(data.titulo, 'nao_informado');
      const disciplina = data.disciplina?.trim();
      const tema = disciplina ? `${titulo} (${disciplina})` : titulo;
      const childAudience = CRIANCAS.includes(data.publico);
      const publico = opt(data.publico);
      const learners = aprendizes(data.publico);
      const k = (chave, params) => t(`${P}capa.${chave}`, params);
      const c = (chave, params) => t(`${P}comum.${chave}`, params);
      const texts = [
        ['texto_superior', data.textoSuperior],
        ['titulo_principal', data.titulo],
        ['subtitulo', data.subtitulo],
        ['frase_inferior', data.fraseInferior],
        ['serie', data.serie],
        ['professor', data.professor],
        ['instituicao', data.instituicao],
      ].filter(([, value]) => value?.trim());
      const hasCredits = [data.serie, data.professor, data.instituicao].some(value => value?.trim());
      const lines = [
        c('atencao_imagem'),
        k('saida', { formato }),
        c('estilo_obrigatorio', { estilo }),
        k('nao_responda'),
        '',
        c('h_papel'),
        k('papel'),
        '',
        c('h_contexto'),
        ...(disciplina ? [c('l_disciplina', { valor: disciplina })] : []),
        k('l_tema', { valor: titulo }),
        c('l_publico', { valor: publico }),
        c('l_estilo', { valor: estilo }),
        c('l_paleta', { valor: opt(data.paleta) }),
        '',
        c('h_revisao'),
        k('revisao'),
        '',
        k('h_textos'),
        ...texts.map(([chave, value]) => `${k(`rotulo_${chave}`)}: "${value.trim()}"`),
        k('nenhum_outro_texto'),
        ...regrasTextoImagem(''),
        '',
        k('h_direcao', { estilo: estilo.toUpperCase() }),
        `- ${c('linha_ilustracao', { valor: style.ilustracao })}`,
        `- ${c('linha_pagina', { valor: style.pagina })}`,
        `- ${c('linha_tipografia', { valor: style.tipografia })}`,
        `- ${c('linha_evite', { valor: style.evitar })}`,
        '',
        k('h_composicao'),
        `- ${k('c_hierarquia')}`,
        `- ${k('c_titulo', { tema })}`,
        ...(data.elementos?.trim() ? [`- ${k('c_elementos', { valor: data.elementos.trim() })}`] : []),
        ...(hasCredits ? [`- ${k('c_creditos')}`] : []),
        `- ${k('c_margens')}`,
        `- ${data.paleta === 'Automática' ? k('c_paleta_auto') : k('c_paleta_fixa', { paleta: opt(data.paleta) })}`,
        `- ${childAudience ? c('crianca_sim', { publico }) : k('crianca_nao', { aprendizes: learners })}`,
        '',
        k('h_restricoes'),
        `- ${k('r_1')}`,
        `- ${k('r_formato', { formato })}`,
        `- ${k('r_mockup')}`,
        `- ${k('r_marca')}`,
        `- ${k('r_idioma')}`,
      ];
      return lines.join('\n');
    }

    // Prompt de texto da apostila (modo IA): o prompt base mais as seções 9, 10 e 11.
    function montarPromptApostila(settings) {
      const dados = { ...settings };
      const pages = Math.max(1, Number.parseInt(dados.paginas, 10) || 1);
      dados.extensao = plural(`${P}apostila.extensao`, pages);
      const pdf = dados.formatoEntrega === 'pdf';
      const entrega = itens(`${P}entrega.${pdf ? 'pdf' : 'html'}`).map(item => `- ${item}`).join('\n');
      let prompt = `${generatePrompt(dados)}\n\n9. ${t(`${P}entrega.s9_titulo`)}\n- ${t(`${P}entrega.s9_diagramas`, { valor: opt(dados.formatoDiagrama) })}\n- ${t(`${P}entrega.s9_imagens`, { valor: opt(dados.modoImagem) })}\n- ${t(`${P}entrega.s9_formato`, { valor: pdf ? 'PDF' : 'HTML' })}\n- ${t(`${P}entrega.s9_segredos`)}\n\n10. ${t(`${P}entrega.s10_titulo`)}\n${entrega}`;
      if (dados.modoImagem === 'gerar') prompt += `\n\n11. ${t(`${P}entrega.s11_titulo`)}\n${itens(`${P}entrega.s11`).map(item => `- ${item}`).join('\n')}`;
      return prompt;
    }

    const instrucaoMelhorar = id => t(`${P}melhorar.${id}`);
    function anexarAjustes(promptAtual, ajustes) {
      return `${promptAtual}\n\n${t(`${P}melhorar.cabecalho`)}\n${ajustes.filter(Boolean).map(item => `- ${item}`).join('\n')}`;
    }

    return { generatePrompt, generateImagePrompt, generateCoverPrompt, montarPromptApostila, selectedResources, blocoBncc, instrucaoMelhorar, anexarAjustes, opt };
  }

  return { criarGeradores, RECURSOS, MELHORAR, slug };
});
