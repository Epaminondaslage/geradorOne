#!/usr/bin/env node
// Converte o dataset bncc.dev (https://github.com/bncc-dev/bncc-dados, CC BY 4.0) no arquivo compacto public/data/bncc.json,
// usado pelo seletor de habilidades da Apostila. Só copia os campos de que a tela precisa: código, texto oficial e recortes.
// Uso: node scripts/build-bncc-data.js CAMINHO_DO_CLONE_DE_bncc-dados
const fs = require('node:fs');
const path = require('node:path');

const source = process.argv[2];
if (!source) { console.error('Uso: node scripts/build-bncc-data.js CAMINHO_DO_CLONE_DE_bncc-dados'); process.exit(2); }
const read = relative => JSON.parse(fs.readFileSync(path.join(source, 'dados', relative), 'utf8'));
const fail = message => { console.error(`Erro: ${message}`); process.exit(1); };

const citation = fs.readFileSync(path.join(source, 'CITATION.cff'), 'utf8');
const version = /^version:\s*"?([^"\n]+)"?/m.exec(citation)?.[1];
if (!version) fail('versão não encontrada no CITATION.cff.');

const structure = read('bncc-2018/estrutura.json');
const computation = read('computacao-2022/computacao.json');
const byId = list => new Map(list.map(item => [item.id, item]));
const components = byId(structure.componentes_curriculares);
const areas = byId(structure.areas_conhecimento);
const fields = byId(structure.campos_experiencias);
const axes = byId(computation.eixos);

// As três faixas da Educação Infantil. Se o dataset mudar a faixa, o script para em vez de publicar um rótulo errado.
const EI_GROUPS = {
  'ei-grupo-01': { faixa: '0–1a6m', rotulo: 'Bebês (0 a 1 ano e 6 meses)' },
  'ei-grupo-02': { faixa: '1a7m–3a11m', rotulo: 'Crianças bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)' },
  'ei-grupo-03': { faixa: '4a–5a11m', rotulo: 'Crianças pequenas (4 anos a 5 anos e 11 meses)' }
};
for (const group of structure.recortes_temporais.filter(item => item.tipo === 'grupo_etario')) {
  if (!EI_GROUPS[group.id] || EI_GROUPS[group.id].faixa !== group.faixa) fail(`faixa etária inesperada: ${group.id} ${group.faixa}`);
}

const yearLabel = year => `${year}º ano`;
const items = [];
const add = (etapa, record, recortes, grupo, extra = {}) => {
  if (!record.codigo || !record.texto?.trim()) fail(`registro sem código ou texto: ${JSON.stringify(record.codigo)}`);
  if (record.vigencia?.status && record.vigencia.status !== 'vigente') return;
  items.push({ c: record.codigo, t: record.texto.trim(), e: etapa, r: recortes, g: grupo, ...extra });
};

const counts = {};
const count = (key, expected, actual) => { counts[key] = actual; if (actual !== expected) fail(`${key}: esperado ${expected}, veio ${actual}`); };

const ei = read('bncc-2018/educacao-infantil.json').objetivos;
count('EI', 93, ei.length);
for (const record of ei) add('EI', record, [EI_GROUPS[record.grupo_etario].rotulo], fields.get(record.campo_experiencias).nome);

const ef = read('bncc-2018/ensino-fundamental.json').habilidades;
count('EF', 1304, ef.length);
for (const record of ef) add('EF', record, record.anos.map(yearLabel), components.get(record.componente).nome);

const em = read('bncc-2018/ensino-medio.json').habilidades;
count('EM', 183, em.length);
for (const record of em) add('EM', record, [], areas.get(record.area).nome, record.componente ? { h: components.get(record.componente).nome } : {});

count('CO-EI', 11, computation.objetivos_ei.length);
for (const record of computation.objetivos_ei) add('EI', record, [EI_GROUPS[record.grupo_etario].rotulo], 'Computação', { k: axes.get(record.eixo).nome });
count('CO-EF', 104, computation.habilidades_ef.length);
for (const record of computation.habilidades_ef) add('EF', record, record.anos.map(yearLabel), 'Computação', { k: axes.get(record.eixo).nome });
count('CO-EM', 26, computation.habilidades_em.length);
for (const record of computation.habilidades_em) add('EM', record, [], 'Computação');

const order = { EI: 0, EF: 1, EM: 2 };
items.sort((a, b) => order[a.e] - order[b.e] || a.c.localeCompare(b.c, 'pt-BR', { numeric: true }));
if (new Set(items.map(item => item.c)).size !== items.length) fail('há códigos repetidos.');
if (items.length !== 1721) fail(`total esperado 1721, veio ${items.length}`);

const output = {
  formato: 'geradorone-bncc',
  versao: version,
  fonte: {
    nome: 'bncc.dev (mantido pela Profy)',
    url: 'https://github.com/bncc-dev/bncc-dados',
    licenca: 'CC BY 4.0',
    licencaUrl: 'https://github.com/bncc-dev/bncc-dados/blob/main/dados/LICENSE.md',
    doi: '10.5281/zenodo.21625233',
    documentos: 'BNCC (2018), Educação Infantil, Ensino Fundamental e Ensino Médio, e complemento de Computação (Parecer CNE/CEB nº 2/2022)'
  },
  etapas: { EI: 'Educação Infantil', EF: 'Ensino Fundamental', EM: 'Ensino Médio' },
  itens: items
};
const target = path.join(__dirname, '..', 'public', 'data', 'bncc.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(output));
console.log(`public/data/bncc.json: ${items.length} aprendizagens (versão ${version}), ${(fs.statSync(target).size / 1024).toFixed(0)} KB`, counts);
