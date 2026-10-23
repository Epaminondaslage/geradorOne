const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'bncc.json'), 'utf8'));
const CODE = /^E[IFM]\d{2}[A-Z]{2,3}\d{2,3}$/;

test('BNCC: arquivo de dados traz a fonte, a licença e a versão para dar o crédito', () => {
  assert.equal(data.formato, 'geradorone-bncc');
  assert.match(data.versao, /^dados-\d{4}\.\d{2}/);
  assert.equal(data.fonte.licenca, 'CC BY 4.0');
  assert.match(data.fonte.url, /^https:\/\/github\.com\/bncc-dev\/bncc-dados/);
  assert.match(data.fonte.doi, /^10\./);
});

test('BNCC: 1.721 aprendizagens, sem repetição, com código no padrão e texto preenchido', () => {
  assert.equal(data.itens.length, 1721);
  assert.equal(new Set(data.itens.map(item => item.c)).size, 1721);
  for (const item of data.itens) {
    assert.match(item.c, CODE, item.c);
    assert.ok(item.t.trim().length > 10, `${item.c}: texto vazio`);
    assert.ok(['EI', 'EF', 'EM'].includes(item.e), item.c);
    assert.ok(Array.isArray(item.r), item.c);
    assert.ok(item.g, `${item.c}: sem componente, área ou campo`);
    assert.ok(item.c.startsWith(item.e), `${item.c}: código não começa pela etapa`);
  }
});

test('BNCC: contagens por etapa batem com o dataset (93 EI, 1.304 EF, 183 EM, mais 141 de Computação)', () => {
  const count = filter => data.itens.filter(filter).length;
  assert.equal(count(item => item.e === 'EI' && item.g !== 'Computação'), 93);
  assert.equal(count(item => item.e === 'EF' && item.g !== 'Computação'), 1304);
  assert.equal(count(item => item.e === 'EM' && item.g !== 'Computação'), 183);
  assert.equal(count(item => item.g === 'Computação'), 141);
});

test('BNCC: registros conhecidos têm o texto e os recortes corretos', () => {
  const find = code => data.itens.find(item => item.c === code);
  assert.deepEqual(find('EF67LP08').r, ['6º ano', '7º ano']);
  assert.equal(find('EF67LP08').g, 'Língua Portuguesa');
  assert.match(find('EF01LP01').t, /^Reconhecer que textos são lidos e escritos da esquerda para a direita/);
  assert.deepEqual(find('EF01LP01').r, ['1º ano']);
  assert.equal(find('EM13LP02').h, 'Língua Portuguesa');
  assert.deepEqual(find('EM13LGG103').r, []);
  assert.match(find('EI02TS01').r[0], /^Crianças bem pequenas/);
  assert.equal(find('EF01CO01').g, 'Computação');
});

test('BNCC: o reconhecimento de códigos digitados acha todos e só eles', () => {
  const regex = /\bE[IFM]\d{2}[A-Z]{2,3}\d{2,3}\b/gi;
  const found = ('Usar ef67lp08, EM13CHS101 e EI03CO01; ignorar EF9XLP1, ABC12345.' .match(regex) || []).map(code => code.toUpperCase());
  assert.deepEqual(found, ['EF67LP08', 'EM13CHS101', 'EI03CO01']);
});
