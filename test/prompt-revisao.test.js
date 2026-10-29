const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FAQ_ITEMS } = require('../public/faq-data.js');

const ler = arquivo => fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');

test('revisão técnica: os geradores de imagem e de capa trazem o bloco, uma vez, antes da missão ou dos textos da capa', () => {
  const casos = JSON.parse(ler('test/fixtures/prompts-pt-BR.json')).casos.filter(caso => caso.kind === 'imagem' || caso.kind === 'capa');
  assert.ok(casos.some(caso => caso.kind === 'imagem') && casos.some(caso => caso.kind === 'capa'), 'um caso de material e outro de capa');
  for (const caso of casos) {
    const titulo = 'REVISÃO TÉCNICA (FAÇA ANTES DE GERAR A IMAGEM)';
    assert.equal(caso.saida.split(titulo).length - 1, 1, caso.nome);
    assert.match(caso.saida, /não inclua dado, fonte ou citação que você não possa confirmar/, caso.nome);
    assert.match(caso.saida, /sem escrever essa revisão na resposta/, caso.nome);
    if (caso.kind === 'imagem') assert.ok(caso.saida.indexOf(titulo) < caso.saida.indexOf('MISSÃO'), caso.nome);
  }
});

test('revisão técnica: a geração de PDF/HTML e a melhoria do prompt também a preservam', () => {
  const servidor = ler('server.js');
  assert.match(servidor, /HTML_INSTRUCTIONS = '[^\n]*revise com rigor técnico todo o conteúdo/);
  assert.match(servidor, /IMPROVE_INSTRUCTIONS = '[^\n]*seção REVISÃO TÉCNICA, sem enfraquecê-la/);
});

test('revisão técnica: os 16 exemplos de docs/exemplos mostram o prompt com o bloco, uma vez cada', () => {
  const pasta = path.join(__dirname, '..', 'docs', 'exemplos');
  const arquivos = fs.readdirSync(pasta).filter(nome => /^\d\d-.+\.md$/.test(nome));
  assert.equal(arquivos.length, 16);
  for (const nome of arquivos) {
    const texto = fs.readFileSync(path.join(pasta, nome), 'utf8');
    assert.equal((texto.match(/REVISÃO TÉCNICA \(FAÇA ANTES DE GERAR A IMAGEM\)/g) || []).length, 1, nome);
  }
});

test('revisão técnica: a FAQ explica o bloco e avisa que não elimina os erros', () => {
  const item = FAQ_ITEMS.find(i => /revise o conteúdo antes de gerar a imagem/.test(i.pergunta));
  assert.ok(item);
  assert.match(item.resposta, /não os elimina/);
  assert.ok(!item.resposta.includes('—'), 'sem travessão');
});
