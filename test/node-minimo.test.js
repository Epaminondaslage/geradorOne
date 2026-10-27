const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { atende, minimoDoPacote } = require('../scripts/node-minimo');

test('versão mínima: compara por parte numérica, não por texto', () => {
  assert.equal(atende('22.23.4', '22.23.4'), true);
  assert.equal(atende('22.23.10', '22.23.4'), true);
  assert.equal(atende('22.24.0', '22.23.4'), true);
  assert.equal(atende('24.1.0', '22.23.4'), true);
  assert.equal(atende('22.23.3', '22.23.4'), false);
  assert.equal(atende('22.9.9', '22.23.4'), false);
  assert.equal(atende('20.19.0', '22.23.4'), false);
  assert.equal(atende('v22.23.4', '22.23.4'), true, 'aceita o prefixo v');
  assert.equal(atende('lixo', '22.23.4'), false);
});

test('mínimo vem do engines.node do package.json', () => {
  assert.equal(minimoDoPacote({ engines: { node: '>=22.23.4' } }), '22.23.4');
  assert.equal(minimoDoPacote({ engines: { node: '>= 22' } }), '22');
  assert.equal(minimoDoPacote({ engines: {} }), null);
  assert.equal(minimoDoPacote({}), null);
});

test('o package.json exige pelo menos o Node 22.23.4 (boletim de segurança de outubro de 2026)', () => {
  const pacote = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(atende(minimoDoPacote(pacote), '22.23.4'), true, `engines.node é ${pacote.engines?.node}`);
});

test('o Dockerfile roda a checagem de versão antes de instalar as dependências', () => {
  const docker = fs.readFileSync('Dockerfile', 'utf8');
  const checagem = docker.indexOf('RUN node scripts/node-minimo.js');
  assert.ok(checagem > 0, 'falta o RUN node scripts/node-minimo.js');
  assert.ok(docker.indexOf('COPY --chown=node:node scripts ./scripts') < checagem, 'a checagem precisa vir depois de copiar scripts/');
  assert.ok(docker.indexOf('COPY --chown=node:node package.json') < checagem, 'a checagem precisa vir depois de copiar o package.json');
  assert.ok(checagem < docker.indexOf('npm ci'), 'a checagem precisa vir antes do npm ci');
});
