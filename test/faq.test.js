const test = require('node:test');
const assert = require('node:assert/strict');
const { FAQ_ITEMS, FAQ_ESTRUTURA } = require('../public/faq-data.js');

// Os itens leem o dicionário pt-BR (public/i18n/pt-BR.js) pelas chaves faq.*; os testes abaixo
// valem para os textos em português e a última garante as mesmas chaves nos cinco idiomas.
const IDIOMAS = ['pt-BR', 'en', 'es', 'de', 'it'];

test('FAQ: todo item tem categoria, pergunta e resposta preenchidas', () => {
  assert.ok(FAQ_ITEMS.length >= 40);
  for (const item of FAQ_ITEMS) {
    for (const campo of ['categoria', 'pergunta', 'resposta']) {
      assert.equal(typeof item[campo], 'string', `${item.pergunta}: ${campo}`);
      assert.ok(item[campo].trim().length > 0, `${item.pergunta}: ${campo} vazio`);
    }
  }
});

test('FAQ: perguntas não se repetem', () => {
  const perguntas = FAQ_ITEMS.map(item => item.pergunta);
  assert.equal(new Set(perguntas).size, perguntas.length);
});

test('FAQ: cobre os temas principais do app', () => {
  const categorias = new Set(FAQ_ITEMS.map(item => item.categoria));
  for (const nome of ['Primeiros passos', 'Conta e acesso', 'Apostila', 'Capa', 'Projetos', 'IA e chave', 'Obter a chave de IA', 'BNCC', 'Suporte', 'Administração']) {
    assert.ok(categorias.has(nome), `falta a categoria ${nome}`);
  }
});

test('FAQ: links são https e apontam para as páginas oficiais conferidas', () => {
  const textos = FAQ_ITEMS.map(item => item.resposta).join('\n');
  const links = textos.match(/https?:\/\/[^\s)]*[^\s).,;:]/g) || [];
  assert.ok(links.length >= 3);
  for (const link of links) assert.ok(link.startsWith('https://'), link);
  for (const esperado of ['https://platform.openai.com/api-keys', 'https://aistudio.google.com/apikey', 'https://platform.claude.com/settings/keys', 'https://github.com/bncc-dev/bncc-dados', 'https://basenacionalcomum.mec.gov.br/']) {
    assert.ok(links.includes(esperado), `falta ${esperado}`);
  }
});

test('FAQ: textos sem travessão e sem chave de exemplo parecida com segredo real', () => {
  const textos = FAQ_ITEMS.map(item => `${item.pergunta} ${item.resposta}`).join('\n');
  assert.ok(!textos.includes('—'), 'travessão no texto');
  assert.ok(!/sk-[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}/.test(textos), 'parece uma chave real');
});

test('FAQ: cada item tem id estável e único', () => {
  const ids = FAQ_ITEMS.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^faq\.\d+$/);
});

test('FAQ: os cinco idiomas têm as mesmas chaves (categorias, perguntas e respostas)', () => {
  const chaves = [];
  for (const [id, categoria] of FAQ_ESTRUTURA) chaves.push(`faq.cat.${categoria}`, `faq.${id}.pergunta`, `faq.${id}.resposta`);
  assert.equal(FAQ_ESTRUTURA.length, FAQ_ITEMS.length);
  for (const idioma of IDIOMAS) {
    const dict = require(`../public/i18n/${idioma}.js`);
    for (const chave of chaves) {
      assert.equal(typeof dict[chave], 'string', `${idioma}: falta ${chave}`);
      assert.ok(dict[chave].trim().length > 0, `${idioma}: ${chave} vazio`);
    }
  }
});
