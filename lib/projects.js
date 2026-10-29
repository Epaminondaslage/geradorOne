const crypto = require('node:crypto');
const { UUID_RE } = require('./users');
const { erro } = require('./i18n-servidor');

const PROJECT_KINDS = ['apostila', 'capa'];
const MAX_PROJECTS_PER_USER = 500;
const COLUMNS = 'id, owner_id, name, kind, settings, prompt, created_at, updated_at';

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    kind: row.kind,
    settings: row.settings || {},
    prompt: row.prompt,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function createProjectStore(db) {
  return {
    async list(ownerId) {
      const { rows } = await db.query('SELECT id, name, kind, updated_at FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC', [ownerId]);
      return rows.map(row => ({ id: row.id, name: row.name, kind: row.kind, updatedAt: row.updated_at.toISOString() }));
    },
    // Todos os projetos completos do dono, para a exportação da conta.
    async listAll(ownerId) {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM projects WHERE owner_id = $1 ORDER BY created_at ASC`, [ownerId]);
      return rows.map(fromRow).map(({ ownerId: _owner, ...project }) => project);
    },
    async get(ownerId, id) {
      if (!UUID_RE.test(String(id))) return null;
      return fromRow((await db.query(`SELECT ${COLUMNS} FROM projects WHERE id = $1 AND owner_id = $2`, [id, ownerId])).rows[0]);
    },
    save(ownerId, input) {
      return db.tx(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`projects:${ownerId}`]);
        if (input.id) {
          const updated = await client.query(
            `UPDATE projects SET name = $3, kind = $4, settings = $5, prompt = $6, updated_at = now() WHERE id = $1 AND owner_id = $2 RETURNING ${COLUMNS}`,
            [input.id, ownerId, input.name, input.kind, JSON.stringify(input.settings), input.prompt]
          );
          if (updated.rows[0]) return fromRow(updated.rows[0]);
        }
        const total = Number((await client.query('SELECT count(*) AS total FROM projects WHERE owner_id = $1', [ownerId])).rows[0].total);
        if (total >= MAX_PROJECTS_PER_USER) throw erro('srv.erro.projeto_limite', { max: MAX_PROJECTS_PER_USER }, 409);
        const created = await client.query(
          `INSERT INTO projects (id, owner_id, name, kind, settings, prompt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
          [crypto.randomUUID(), ownerId, input.name, input.kind, JSON.stringify(input.settings), input.prompt]
        );
        return fromRow(created.rows[0]);
      });
    },
    async remove(ownerId, id) {
      if (!UUID_RE.test(String(id))) return false;
      return (await db.query('DELETE FROM projects WHERE id = $1 AND owner_id = $2', [id, ownerId])).rowCount > 0;
    },
    async countFor(ownerId) {
      return Number((await db.query('SELECT count(*) AS total FROM projects WHERE owner_id = $1', [ownerId])).rows[0].total);
    }
  };
}

function validateProject(payload) {
  const fail = chave => erro(chave, undefined, 400);
  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : '';
  if (!name) throw fail('srv.erro.projeto_nome');
  if (!PROJECT_KINDS.includes(payload.kind)) throw fail('srv.erro.projeto_tipo');
  if (!payload.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings)) throw fail('srv.erro.projeto_config');
  const settings = Object.fromEntries(Object.entries(payload.settings)
    .filter(([key, value]) => key.length <= 60 && ['string', 'boolean', 'number'].includes(typeof value))
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 20_000) : value]));
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.slice(0, 100_000) : '';
  const id = typeof payload.id === 'string' && UUID_RE.test(payload.id) ? payload.id : undefined;
  return { id, name, kind: payload.kind, settings, prompt };
}

module.exports = { createProjectStore, validateProject, PROJECT_KINDS };
