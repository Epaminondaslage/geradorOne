// Geradores de prompt: pt-BR idêntico ao original (arquivo dourado) e, nos outros idiomas, prompt 100% no idioma escolhido.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../public/i18n.js');
const { criarGeradores } = require('../public/prompts.js');

const DOURADO = require('./fixtures/prompts-pt-BR.json');
const DIR = path.join(__dirname, '..', 'public', 'i18n');

const ptBR = require(path.join(DIR, 'pt-BR.js'));
const LINGUAS = ['en', 'es', 'de', 'it'];
const prefixo = codigo => `[${codigo}]`;
// Dicionário espelho: o texto em português com o código do idioma na frente, só nas chaves prompt.*.
function espelho(codigo) {
  return Object.fromEntries(Object.entries(ptBR).filter(([k]) => k.startsWith('prompt.')).map(([k, v]) => [k, v === '' ? v : prefixo(codigo) + v]));
}
const dicionariosEspelho = { 'pt-BR': ptBR, ...Object.fromEntries(LINGUAS.map(c => [c, espelho(c)])) };
const geradores = (idioma, dicionarios = dicionariosEspelho) => criarGeradores(i18n.criar(dicionarios, idioma), idioma);

function gerar(g, caso) {
  if (caso.kind === 'apostila') return g.montarPromptApostila({ ...caso.entrada });
  if (caso.kind === 'imagem') return g.generateImagePrompt({ ...caso.entrada });
  return g.generateCoverPrompt({ ...caso.entrada });
}

test('pt-BR: cada prompt sai byte a byte igual ao do gerador original', () => {
  const g = geradores('pt-BR');
  for (const caso of DOURADO.casos) assert.equal(gerar(g, caso), caso.saida, caso.nome);
});

test('pt-BR: instruções do melhorar, recursos, bloco da BNCC e anexo de ajustes iguais ao original', () => {
  const g = geradores('pt-BR');
  for (const [id, texto] of Object.entries(DOURADO.melhorar)) assert.equal(g.instrucaoMelhorar(id), texto, id);
  const marcados = { mapasMentais: true, diagramas: true, ilustracoes: true, infograficos: true, graficos: true, quadros: true, linhas: true, icones: true };
  assert.deepEqual(g.selectedResources(marcados), Object.values(DOURADO.recursos));
  assert.equal(g.blocoBncc(DOURADO.blocoBncc.entrada), DOURADO.blocoBncc.saida);
  assert.equal(g.anexarAjustes(DOURADO.anexo.atual, DOURADO.anexo.ajustes), DOURADO.anexo.saida);
});

const cabecalhosPt = {
  apostila: ['TAREFA', 'PERFIL PEDAGÓGICO', 'CONFIGURAÇÃO CURRICULAR E FONTES', 'ARQUITETURA DO MATERIAL', 'SISTEMA VISUAL', 'ESPECIFICAÇÃO DOS RECURSOS VISUAIS', 'SAÍDA E MARCAÇÕES TÉCNICAS', 'MICROTEXTOS OBRIGATÓRIOS DE ABERTURA', 'CHECKLIST DE QUALIDADE', 'PARÂMETROS DE PRODUÇÃO DIGITAL', 'FORMATO DE ENTREGA OBRIGATÓRIO', 'IMAGENS OBRIGATÓRIAS'],
  imagem: ['PAPEL', 'CONTEXTO', 'REVISÃO TÉCNICA', 'MISSÃO', 'DESCRIÇÃO DA IMAGEM', 'MICROTEXTOS DENTRO DA IMAGEM', 'ELEMENTOS VISUAIS', 'DIFICULDADE DOS ALUNOS', 'RESTRIÇÃO', 'CRITÉRIOS DE QUALIDADE', 'PLANO DE PÁGINAS', 'ORIENTAÇÕES ADICIONAIS', 'CONTEÚDO DE REFERÊNCIA'],
  capa: ['PAPEL', 'CONTEXTO', 'REVISÃO TÉCNICA', 'TEXTOS DA CAPA', 'DIREÇÃO DE ARTE', 'COMPOSIÇÃO', 'RESTRIÇÕES'],
};
const estrutura = texto => texto.split('\n').filter(l => /^(\d+[.)] )/.test(l)).map(l => l.match(/^\d+[.)]/)[0]);

// Cabeçalho que a tradução real escreve igual ao português (palavra parecida, como CONTEXTO em espanhol) vale como traduzido.
const igualAoPt = (dicionarios, codigo, cab) => Object.entries(dicionarios[codigo]).some(([k, v]) => k.startsWith('prompt.') && String(v).toUpperCase() === cab);

function conferirIdioma(codigo, dicionarios, { exigirTraduzido }) {
  const g = geradores(codigo, dicionarios);
  const t = i18n.criar(dicionarios, codigo);
  const nome = t(`prompt.idioma.nome.${codigo}`);
  for (const caso of DOURADO.casos) {
    const saida = gerar(g, caso);
    const ref = DOURADO.casos.find(c => c.nome === caso.nome).saida;
    assert.ok(!/prompt\.[a-z_0-9]+\./.test(saida), `${caso.nome}: chave crua na saída`);
    assert.ok(saida.includes(t('prompt.idioma.clausula', { idioma: nome })), `${caso.nome}: falta a cláusula de idioma`);
    assert.deepEqual(estrutura(saida), estrutura(ref), `${caso.nome}: seções numeradas diferentes do pt-BR`);
    assert.equal(saida.split('\n').length >= ref.split('\n').length, true, `${caso.nome}: perdeu linhas`);
    if (caso.kind !== 'apostila') assert.ok(saida.includes(t('prompt.idioma.texto_literal', { idioma: nome })), `${caso.nome}: falta a regra do texto literal`);
    const chaves = cabecalhosPt[caso.kind].filter(cab => !(exigirTraduzido && igualAoPt(dicionarios, codigo, cab)));
    for (const cab of chaves) {
      const achados = saida.split('\n').filter(l => l.replace(/^(\d+[.)] |- )/, '').startsWith(cab));
      const traduzidoNaFrente = exigirTraduzido ? [] : achados.filter(l => !l.replace(/^(\d+[.)] |- )/, '').startsWith(prefixo(codigo)));
      if (exigirTraduzido) assert.equal(achados.length, 0, `${caso.nome}: cabeçalho em português "${cab}"`);
      else assert.equal(traduzidoNaFrente.length, 0, `${caso.nome}: cabeçalho "${cab}" sem tradução`);
    }
    if (!exigirTraduzido) {
      // Com o espelho, toda linha de texto fixo vem com o código do idioma na frente; só o texto digitado fica cru.
      const digitado = new Set(Object.values(caso.entrada).filter(v => typeof v === 'string').flatMap(v => v.split('\n').map(l => l.trim())));
      for (const linha of saida.split('\n')) {
        const limpa = linha.replace(/^\s*(\d+[.)] |- |\* )/, '').trim();
        if (!limpa || limpa.startsWith(prefixo(codigo))) continue;
        const ehDigitado = [...digitado].some(d => d && (limpa === d || (d.length >= 6 && (limpa.includes(d) || d.includes(limpa)))));
        assert.ok(ehDigitado, `${caso.nome}: linha sem tradução: ${linha}`);
      }
    }
  }
}

for (const codigo of LINGUAS) {
  test(`${codigo}: prompt montado só com texto do dicionário (espelho), cláusula e estrutura`, () => {
    conferirIdioma(codigo, dicionariosEspelho, { exigirTraduzido: false });
  });
  test(`${codigo}: o texto fixo de cada seção usa o dicionário do idioma`, () => {
    const g = geradores(codigo);
    const saida = g.montarPromptApostila({ ...DOURADO.casos[1].entrada });
    assert.ok(saida.startsWith(prefixo(codigo)), 'a abertura vem do dicionário');
    assert.ok(saida.includes(`${prefixo(codigo)}Escreva todo o conteúdo`));
    // Valor de enum traduzido por prompt.opt e texto livre intacto.
    assert.ok(saida.includes(`${prefixo(codigo)}Guia do professor`), 'tipo traduzido');
    assert.ok(saida.includes('Lei de Ohm'), 'assunto digitado não é traduzido');
  });
}

test('BNCC em outro idioma: nota traduzida antes do texto oficial, que segue em português', () => {
  const entrada = DOURADO.blocoBncc.entrada;
  assert.ok(!geradores('pt-BR').blocoBncc(entrada).includes('Nota:'));
  for (const codigo of LINGUAS) {
    const bloco = geradores(codigo).blocoBncc(entrada);
    const linhas = bloco.split('\n');
    assert.ok(linhas[0].startsWith(`- ${prefixo(codigo)}Nota:`), codigo);
    assert.ok(bloco.includes('  * EM13CNT101: Analisar e representar transformações de energia.'), codigo);
  }
});

test('valor de enum sem chave cai no valor cru; texto livre não é traduzido', () => {
  const g = geradores('en');
  assert.equal(g.opt('Valor que não existe'), 'Valor que não existe');
  assert.equal(g.opt('Ensino Médio'), `${prefixo('en')}Ensino Médio`);
});

test('regras de imagem: nada de crianças em personagens de público adulto continua em todos os idiomas', () => {
  for (const codigo of ['pt-BR', ...LINGUAS]) {
    const g = geradores(codigo);
    const saida = g.generateImagePrompt({ ...DOURADO.casos[3].entrada, publico: 'Adulto' });
    assert.ok(saida.includes('NÃO use figuras infantis nem imagens de crianças'), codigo);
  }
});

// Dicionários reais: só rodam quando en/es/de/it já têm as chaves prompt.*.
const reais = Object.fromEntries(i18n.CODIGOS.map(c => [c, require(path.join(DIR, `${c}.js`))]));
const temTraducoes = LINGUAS.every(c => reais[c]['prompt.apostila.atencao']);
for (const codigo of LINGUAS) {
  test(`${codigo}: dicionário real traduz tudo (sem cabeçalho em português, chaves completas)`, { skip: !temTraducoes && 'chaves prompt.* ainda não existem nos dicionários reais' }, () => {
    const faltando = Object.keys(ptBR).filter(k => k.startsWith('prompt.') && typeof reais[codigo][k] !== 'string');
    assert.deepEqual(faltando, []);
    conferirIdioma(codigo, reais, { exigirTraduzido: true });
  });
}
