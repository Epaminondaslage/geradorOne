const crypto = require('node:crypto');

const ROLES = ['admin', 'user'];
const THEMES = ['papel', 'grafite', 'lousa', 'azul-tinta', 'sepia', 'alto-contraste'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = 'id, name, email, phone, role, active, password_hash, must_change_password, pwd_version, ai, theme, terms_version, terms_accepted_at, created_at, updated_at';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// Guarda só os dígitos (com DDI se informado). Aceita 10 ou 11 dígitos (DDD + número) ou 12 a 13 com o 55 do Brasil.
function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidPhone(digits) {
  return /^\d{10,13}$/.test(digits) && (digits.length <= 11 || digits.startsWith('55'));
}

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    active: row.active,
    passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password,
    pwdVersion: row.pwd_version,
    ai: row.ai || {},
    theme: row.theme || '',
    termsVersion: row.terms_version || '',
    termsAcceptedAt: row.terms_accepted_at ? row.terms_accepted_at.toISOString() : '',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    active: user.active,
    mustChangePassword: Boolean(user.mustChangePassword),
    hasApiKey: Boolean(user.ai?.keyEnc),
    theme: user.theme || '',
    termsVersion: user.termsVersion || '',
    termsAcceptedAt: user.termsAcceptedAt || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

const fail = (message, status) => Object.assign(new Error(message), { status });
const isUniqueViolation = error => error?.code === '23505';

function createUserStore(db) {
  return {
    async list() {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM users`);
      return rows.map(fromRow).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
    async getById(id) {
      if (!UUID_RE.test(String(id))) return null;
      return fromRow((await db.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id])).rows[0]);
    },
    async getByEmail(email) {
      return fromRow((await db.query(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [normalizeEmail(email)])).rows[0]);
    },
    async count() {
      return Number((await db.query('SELECT count(*) AS total FROM users')).rows[0].total);
    },
    async create({ name, email, phone, role, passwordHash, mustChangePassword = true, bootstrap = false, phoneOptional = false, termsVersion = '' }) {
      const cleanEmail = normalizeEmail(email);
      const cleanName = String(name || '').trim().slice(0, 120);
      if (!cleanName) throw fail('Informe o nome.', 400);
      if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 200) throw fail('E-mail inválido.', 400);
      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone && !bootstrap && !phoneOptional) throw fail('Informe o telefone.', 400);
      if (cleanPhone && !isValidPhone(cleanPhone)) throw fail('Telefone inválido. Use DDD + número, por exemplo (35) 99999-8888.', 400);
      if (!ROLES.includes(role)) throw fail('Perfil inválido.', 400);
      try {
        const { rows } = await db.query(
          `INSERT INTO users (id, name, email, phone, role, password_hash, must_change_password, terms_version, terms_accepted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8::text IS NULL THEN NULL ELSE now() END) RETURNING ${COLUMNS}`,
          [crypto.randomUUID(), cleanName, cleanEmail, cleanPhone, role, passwordHash, mustChangePassword, termsVersion || null]
        );
        return fromRow(rows[0]);
      } catch (error) {
        if (isUniqueViolation(error)) throw fail('Já existe um usuário com este e-mail.', 409);
        throw error;
      }
    },
    // Registra o aceite dos Termos e da Política. Não mexe em pwd_version: aceitar não derruba sessões.
    async acceptTerms(id, version) {
      if (!UUID_RE.test(String(id))) throw fail('Usuário não encontrado.', 404);
      const { rows } = await db.query(`UPDATE users SET terms_version = $2, terms_accepted_at = now() WHERE id = $1 RETURNING ${COLUMNS}`, [id, version]);
      if (!rows[0]) throw fail('Usuário não encontrado.', 404);
      return fromRow(rows[0]);
    },
    // Só aplica campos conhecidos; mudar senha, e-mail, perfil ou situação invalida sessões antigas.
    async update(id, patch) {
      if (!UUID_RE.test(String(id))) throw fail('Usuário não encontrado.', 404);
      try {
        return await db.tx(async client => {
          const found = await client.query(`SELECT ${COLUMNS} FROM users WHERE id = $1 FOR UPDATE`, [id]);
          if (!found.rows[0]) throw fail('Usuário não encontrado.', 404);
          const next = fromRow(found.rows[0]);
          let invalidate = false;
          if (patch.name !== undefined) {
            const name = String(patch.name).trim().slice(0, 120);
            if (!name) throw fail('Informe o nome.', 400);
            next.name = name;
          }
          if (patch.email !== undefined) {
            const email = normalizeEmail(patch.email);
            if (!EMAIL_RE.test(email) || email.length > 200) throw fail('E-mail inválido.', 400);
            if (email !== next.email) invalidate = true;
            next.email = email;
          }
          if (patch.phone !== undefined) {
            const phone = normalizePhone(patch.phone);
            if (!phone && next.phone) throw fail('Informe o telefone.', 400);
            if (phone && !isValidPhone(phone)) throw fail('Telefone inválido. Use DDD + número, por exemplo (35) 99999-8888.', 400);
            next.phone = phone;
          }
          if (patch.role !== undefined) {
            if (!ROLES.includes(patch.role)) throw fail('Perfil inválido.', 400);
            if (patch.role !== next.role) invalidate = true;
            next.role = patch.role;
          }
          if (patch.active !== undefined) {
            if (Boolean(patch.active) !== next.active) invalidate = true;
            next.active = Boolean(patch.active);
          }
          if (patch.passwordHash !== undefined) {
            next.passwordHash = patch.passwordHash;
            invalidate = true;
          }
          if (patch.mustChangePassword !== undefined) next.mustChangePassword = Boolean(patch.mustChangePassword);
          if (patch.ai !== undefined) next.ai = patch.ai;
          if (patch.theme !== undefined) {
            if (patch.theme !== '' && patch.theme !== 'sistema' && !THEMES.includes(patch.theme)) throw fail('Tema inválido.', 400);
            next.theme = patch.theme;
          }
          if (invalidate && !patch.keepSessions) next.pwdVersion += 1;
          const saved = await client.query(
            `UPDATE users SET name = $2, email = $3, phone = $4, role = $5, active = $6, password_hash = $7, must_change_password = $8, pwd_version = $9, ai = $10, theme = $11, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
            [id, next.name, next.email, next.phone, next.role, next.active, next.passwordHash, next.mustChangePassword, next.pwdVersion, JSON.stringify(next.ai), next.theme]
          );
          return fromRow(saved.rows[0]);
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw fail('Já existe um usuário com este e-mail.', 409);
        throw error;
      }
    },
    async remove(id) {
      if (!UUID_RE.test(String(id))) return false;
      return (await db.query('DELETE FROM users WHERE id = $1', [id])).rowCount > 0;
    }
  };
}

module.exports = { createUserStore, publicUser, normalizeEmail, normalizePhone, isValidPhone, ROLES, THEMES, EMAIL_RE, UUID_RE };
