const test = require('node:test');
const assert = require('node:assert/strict');
const { FAQ_ITEMS } = require('../public/faq-data.js');

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
  for (const nome of ['Primeiros passos', 'Conta e acesso', 'Apostila', 'Capa', 'Projetos', 'IA e chave', 'Obter a chave de IA', 'Administração']) {
    assert.ok(categorias.has(nome), `falta a categoria ${nome}`);
  }
});

test('FAQ: links são https e apontam para as páginas oficiais conferidas', () => {
  const textos = FAQ_ITEMS.map(item => item.resposta).join('\n');
  const links = textos.match(/https?:\/\/[^\s)]*[^\s).,;:]/g) || [];
  assert.ok(links.length >= 3);
  for (const link of links) assert.ok(link.startsWith('https://'), link);
  for (const esperado of ['https://platform.openai.com/api-keys', 'https://aistudio.google.com/apikey']) {
    assert.ok(links.includes(esperado), `falta ${esperado}`);
  }
});

test('FAQ: textos sem travessão e sem chave de exemplo parecida com segredo real', () => {
  const textos = FAQ_ITEMS.map(item => `${item.pergunta} ${item.resposta}`).join('\n');
  assert.ok(!textos.includes('—'), 'travessão no texto');
  assert.ok(!/sk-[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}/.test(textos), 'parece uma chave real');
});
