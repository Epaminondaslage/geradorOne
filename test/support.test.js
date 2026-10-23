const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSupport, newProtocol, TIPOS } = require('../lib/support');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const base = { tipo: 'problema', mensagem: 'O botão de gerar não responde.', email: 'Ana@Teste.com', nome: '  Ana Souza ', origem: 'apostila' };
const attach = (nome, buffer) => ({ nome, dados: buffer.toString('base64') });

test('suporte: mensagem válida é normalizada', () => {
  const clean = validateSupport(base);
  assert.equal(clean.tipo, 'problema');
  assert.equal(clean.tipoLabel, 'Problema');
  assert.equal(clean.email, 'ana@teste.com');
  assert.equal(clean.nome, 'Ana Souza');
  assert.equal(clean.origem, 'apostila');
  assert.equal(clean.isca, false);
  assert.deepEqual(Object.keys(TIPOS), ['critica', 'sugestao', 'problema', 'duvida', 'elogio']);
});

test('suporte: recusa tipo inválido, e-mail inválido, mensagem curta e longa demais', () => {
  assert.throws(() => validateSupport({ ...base, tipo: 'xpto' }), /tipo da mensagem/);
  assert.throws(() => validateSupport({ ...base, email: 'sem-arroba' }), /e-mail válido/);
  assert.throws(() => validateSupport({ ...base, mensagem: 'oi' }), /mínimo de 5/);
  assert.throws(() => validateSupport({ ...base, mensagem: 'x'.repeat(2001) }), /2\.000/);
  assert.doesNotThrow(() => validateSupport({ ...base, mensagem: '', anexos: [attach('print.png', PNG)] }), 'só anexo basta');
});

test('suporte: campo isca marca a mensagem como robô e a origem estranha é descartada', () => {
  assert.equal(validateSupport({ ...base, site: 'http://spam.example' }).isca, true);
  assert.equal(validateSupport({ ...base, origem: '../../etc/passwd' }).origem, '');
});

test('suporte: anexos aceitam o tipo certo e recusam tipo, conteúdo e tamanho indevidos', () => {
  const ok = validateSupport({ ...base, anexos: [attach('print.png', PNG), attach('log.txt', Buffer.from('linha 1\nlinha 2'))] });
  assert.deepEqual(ok.anexos.map(file => [file.filename, file.contentType]), [['print.png', 'image/png'], ['log.txt', 'text/plain']]);
  assert.throws(() => validateSupport({ ...base, anexos: [attach('virus.exe', Buffer.from('MZ'))] }), /tipo de arquivo não aceito/);
  assert.throws(() => validateSupport({ ...base, anexos: [attach('falso.png', Buffer.from('isto não é uma imagem'))] }), /não corresponde/);
  assert.throws(() => validateSupport({ ...base, anexos: [attach('binario.txt', Buffer.from([0x41, 0x00, 0x42]))] }), /não corresponde/);
  assert.throws(() => validateSupport({ ...base, anexos: [{ nome: 'a.png', dados: 'não é base64!' }] }), /inválido/);
  assert.throws(() => validateSupport({ ...base, anexos: Array.from({ length: 6 }, (_, i) => attach(`p${i}.png`, PNG)) }), /No máximo 5/);
  assert.throws(() => validateSupport({ ...base, anexos: [attach('grande.png', Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]))] }), /passa de 5 MB/);
  const four = () => Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]);
  assert.throws(() => validateSupport({ ...base, anexos: [attach('a.png', four()), attach('b.png', four()), attach('c.png', four())] }), /8 MB no total/);
});

test('suporte: nome do arquivo é limpo de caminho e caracteres perigosos', () => {
  const [file] = validateSupport({ ...base, anexos: [attach('..\\..\\etc/<script>"x".png', PNG)] }).anexos;
  assert.ok(!/[\\/<>"]/.test(file.filename), file.filename);
  assert.ok(file.filename.endsWith('.png'));
});

test('suporte: protocolo tem data e sufixo sem caracteres ambíguos', () => {
  assert.match(newProtocol(new Date('2026-10-23T12:00:00Z')), /^GO-20261023-[A-HJ-NP-Z2-9]{4}$/);
  assert.notEqual(newProtocol(), newProtocol());
});
