// "Fale com o suporte": validação da mensagem e dos anexos, protocolo e guarda no banco.
const crypto = require('node:crypto');
const { EMAIL_RE, normalizeEmail } = require('./users');

const TIPOS = { critica: 'Crítica', sugestao: 'Sugestão', problema: 'Problema', duvida: 'Dúvida', elogio: 'Elogio' };
const MIN_MESSAGE = 5;
const MAX_MESSAGE = 2000;
const MAX_FILES = 5;
const MAX_FILE = 5 * 1024 * 1024;
const MAX_TOTAL = 8 * 1024 * 1024;
// Imagens, PDF e texto. O tipo vem da extensão e do conteúdo do arquivo, nunca do que o navegador declara.
const TIPOS_ARQUIVO = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain', log: 'text/plain', csv: 'text/csv' };

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function cleanFilename(name) {
  const base = String(name || '').split(/[\\/]/).pop().replace(/[^\w.\- ()]/g, '_').replace(/^\.+/, '').trim().slice(-80);
  return base || 'anexo';
}

// Confere os primeiros bytes: um .png que não é PNG (ou um executável renomeado) é recusado.
function contentMatches(ext, buffer) {
  const starts = (...bytes) => bytes.every((byte, index) => buffer[index] === byte);
  if (ext === 'png') return starts(0x89, 0x50, 0x4e, 0x47);
  if (ext === 'jpg' || ext === 'jpeg') return starts(0xff, 0xd8, 0xff);
  if (ext === 'gif') return starts(0x47, 0x49, 0x46, 0x38);
  if (ext === 'webp') return starts(0x52, 0x49, 0x46, 0x46) && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
  if (ext === 'pdf') return starts(0x25, 0x50, 0x44, 0x46);
  return !buffer.subarray(0, 8192).includes(0);
}

function decodeAttachment(item) {
  const filename = cleanFilename(item?.nome);
  const ext = (/\.([a-z0-9]+)$/i.exec(filename)?.[1] || '').toLowerCase();
  if (!TIPOS_ARQUIVO[ext]) throw fail(`${filename}: tipo de arquivo não aceito.`);
  const data = typeof item?.dados === 'string' ? item.dados : '';
  if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw fail(`${filename}: arquivo inválido.`);
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.toString('base64') !== data) throw fail(`${filename}: arquivo inválido.`);
  if (buffer.length > MAX_FILE) throw fail(`${filename} passa de 5 MB.`);
  if (!contentMatches(ext, buffer)) throw fail(`${filename}: o conteúdo não corresponde ao tipo do arquivo.`);
  return { filename, contentType: TIPOS_ARQUIVO[ext], buffer };
}

function validateSupport(payload) {
  if (!payload || typeof payload !== 'object') throw fail('Pedido inválido.');
  const tipo = Object.hasOwn(TIPOS, payload.tipo) ? payload.tipo : null;
  if (!tipo) throw fail('Escolha o tipo da mensagem.');
  const mensagem = String(payload.mensagem || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  if (mensagem.length > MAX_MESSAGE) throw fail('A mensagem passa de 2.000 caracteres.');
  const email = normalizeEmail(payload.email);
  if (!EMAIL_RE.test(email) || email.length > 200) throw fail('Informe um e-mail válido para podermos responder.');
  const nome = String(payload.nome || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120);
  const origem = /^[a-z0-9-]{1,30}$/.test(String(payload.origem || '')) ? payload.origem : '';
  const list = Array.isArray(payload.anexos) ? payload.anexos : [];
  if (list.length > MAX_FILES) throw fail('No máximo 5 anexos.');
  const anexos = list.map(decodeAttachment);
  if (anexos.reduce((total, file) => total + file.buffer.length, 0) > MAX_TOTAL) throw fail('Os anexos passam de 8 MB no total.');
  if (mensagem.length < MIN_MESSAGE && !anexos.length) throw fail('Escreva a mensagem (mínimo de 5 caracteres) ou anexe um arquivo.');
  return { tipo, tipoLabel: TIPOS[tipo], mensagem, email, nome, origem, anexos, isca: Boolean(String(payload.site || '').trim()) };
}

// Ex.: GO-20261023-7K2Q. Sem 0, O, 1 e I, para não confundir ao ditar.
function newProtocol(now = new Date()) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from(crypto.randomBytes(4), byte => alphabet[byte % alphabet.length]).join('');
  return `GO-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${suffix}`;
}

function createSupportStore(db) {
  return {
    async create({ id, userId, protocolo, tipo, mensagem, nome, email, origem, anexos }) {
      await db.query(
        'INSERT INTO support_messages (id, user_id, protocolo, tipo, mensagem, nome, email, origem, anexos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [id, userId, protocolo, tipo, mensagem, nome, email, origem, JSON.stringify(anexos.map(file => ({ nome: file.filename, tamanho: file.buffer.length })))]
      );
    },
    async markSent(id) {
      await db.query('UPDATE support_messages SET sent = true WHERE id = $1', [id]);
    },
    async listFor(userId) {
      const { rows } = await db.query('SELECT protocolo, tipo, mensagem, nome, email, origem, anexos, sent, created_at FROM support_messages WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
      return rows.map(row => ({ protocolo: row.protocolo, tipo: row.tipo, mensagem: row.mensagem, nome: row.nome, email: row.email, origem: row.origem, anexos: row.anexos || [], enviada: row.sent, criadaEm: row.created_at.toISOString() }));
    }
  };
}

module.exports = { TIPOS, MAX_FILES, MAX_FILE, MAX_TOTAL, MAX_MESSAGE, validateSupport, newProtocol, createSupportStore };
