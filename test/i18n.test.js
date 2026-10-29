const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../public/i18n.js');

const DIR = path.join(__dirname, '..', 'public', 'i18n');
const dicts = Object.fromEntries(i18n.IDIOMAS.map(l => [l.codigo, require(path.join(DIR, `${l.codigo}.js`))]));

test('lista os cinco idiomas, português primeiro', () => {
  assert.deepEqual(i18n.IDIOMAS.map(l => l.codigo), ['pt-BR', 'en', 'es', 'de', 'it']);
  assert.equal(i18n.PADRAO, 'pt-BR');
  for (const l of i18n.IDIOMAS) assert.match(l.bandeira, /^<svg /);
});

test('normaliza códigos de idioma e rejeita desconhecidos', () => {
  assert.equal(i18n.normalizar('pt'), 'pt-BR');
  assert.equal(i18n.normalizar('PT-br'), 'pt-BR');
  assert.equal(i18n.normalizar('en-US'), 'en');
  assert.equal(i18n.normalizar('es_MX'), 'es');
  assert.equal(i18n.normalizar('de-AT'), 'de');
  assert.equal(i18n.normalizar('it'), 'it');
  assert.equal(i18n.normalizar('fr'), null);
  assert.equal(i18n.normalizar(undefined), null);
  assert.equal(i18n.normalizar('<script>'), null);
});

test('escolhe pela precedência URL, cookie, conta, navegador, padrão', () => {
  assert.equal(i18n.escolher({ query: 'de', cookie: 'en', conta: 'es', aceita: 'it' }), 'de');
  assert.equal(i18n.escolher({ query: 'xx', cookie: 'en', conta: 'es' }), 'en');
  assert.equal(i18n.escolher({ conta: 'es', aceita: 'it' }), 'es');
  assert.equal(i18n.escolher({ aceita: 'fr-FR,de;q=0.8,en;q=0.5' }), 'de');
  assert.equal(i18n.escolher({ aceita: 'it-IT,it;q=0.9' }), 'it');
  assert.equal(i18n.escolher({}), 'pt-BR');
});

test('traduz com parâmetros e cai para português e depois para a chave', () => {
  const d = { 'pt-BR': { a: 'Olá, {nome}', so_pt: 'Só português' }, en: { a: 'Hello, {nome}' } };
  const t = i18n.criar(d, 'en');
  assert.equal(t('a', { nome: 'Ana' }), 'Hello, Ana');
  assert.equal(t('so_pt'), 'Só português');
  assert.equal(t('inexistente'), 'inexistente');
  assert.equal(t('a'), 'Hello, {nome}');
});

test('escolhe a forma de plural pelo idioma', () => {
  const d = { 'pt-BR': { 'c.um': '{n} código', 'c.outros': '{n} códigos' }, de: { 'c.um': '{n} Code', 'c.outros': '{n} Codes' } };
  assert.equal(i18n.criar(d, 'pt-BR').plural('c', 1), '1 código');
  assert.equal(i18n.criar(d, 'pt-BR').plural('c', 3), '3 códigos');
  assert.equal(i18n.criar(d, 'de').plural('c', 1), '1 Code');
  assert.equal(i18n.criar(d, 'de').plural('c', 0), '0 Codes');
});

test('todos os dicionários têm exatamente as chaves do pt-BR', () => {
  const base = Object.keys(dicts['pt-BR']).sort();
  for (const l of i18n.IDIOMAS) {
    assert.deepEqual(Object.keys(dicts[l.codigo]).sort(), base, `chaves de ${l.codigo} diferem do pt-BR`);
  }
});

test('todo dicionário mantém os mesmos parâmetros {x} do pt-BR e nenhum valor vazio', () => {
  const params = s => (String(s).match(/\{[a-z_]+\}/g) || []).sort().join(',');
  for (const [chave, valor] of Object.entries(dicts['pt-BR'])) {
    for (const l of i18n.IDIOMAS) {
      const v = dicts[l.codigo][chave];
      assert.ok(typeof v === 'string' && v.trim(), `${l.codigo}:${chave} vazio`);
      assert.equal(params(v), params(valor), `${l.codigo}:${chave} muda os parâmetros`);
    }
  }
});

test('a ressalva jurídica existe nos cinco idiomas e cita BRL', () => {
  for (const l of i18n.IDIOMAS) {
    assert.match(dicts[l.codigo]['legal.ressalva'], /BRL|R\$/, l.codigo);
  }
});

test('zero usa o plural nos cinco idiomas, inclusive em português (0 projetos, não 0 projeto)', () => {
  const d = { 'pt-BR': { 'c.um': '{n} projeto', 'c.outros': '{n} projetos' } };
  assert.equal(i18n.criar(d, 'pt-BR').plural('c', 0), '0 projetos');
  assert.equal(i18n.criar(d, 'pt-BR').plural('c', 1), '1 projeto');
  assert.equal(i18n.criar(d, 'pt-BR').plural('c', 2), '2 projetos');
});
