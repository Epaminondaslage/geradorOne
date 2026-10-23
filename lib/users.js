const crypto = require('node:crypto');
const { createJsonFile } = require('./json-store');

const ROLES = ['admin', 'user'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function createUserStore(filePath) {
  const file = createJsonFile(filePath, []);
  const fail = (message, status) => Object.assign(new Error(message), { status });
  return {
    async list() {
      return (await file.read()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
    async getById(id) {
      return (await file.read()).find(user => user.id === id) || null;
    },
    async getByEmail(email) {
      const wanted = normalizeEmail(email);
      return (await file.read()).find(user => user.email === wanted) || null;
    },
    async count() {
      return (await file.read()).length;
    },
    create({ name, email, phone, role, passwordHash, mustChangePassword = true, bootstrap = false }) {
      const cleanEmail = normalizeEmail(email);
      const cleanName = String(name || '').trim().slice(0, 120);
      if (!cleanName) throw fail('Informe o nome.', 400);
      if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 200) throw fail('E-mail inválido.', 400);
      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone && !bootstrap) throw fail('Informe o telefone.', 400);
      if (cleanPhone && !isValidPhone(cleanPhone)) throw fail('Telefone inválido. Use DDD + número, por exemplo (35) 99999-8888.', 400);
      if (!ROLES.includes(role)) throw fail('Perfil inválido.', 400);
      return file.mutate(users => {
        if (users.some(user => user.email === cleanEmail)) throw fail('Já existe um usuário com este e-mail.', 409);
        const now = new Date().toISOString();
        const user = { id: crypto.randomUUID(), name: cleanName, email: cleanEmail, phone: cleanPhone, role, active: true, passwordHash, mustChangePassword, pwdVersion: 1, ai: {}, createdAt: now, updatedAt: now };
        users.push(user);
        return { save: users, value: user };
      });
    },
    // Só aplica campos conhecidos; mudar senha, e-mail, perfil ou situação invalida sessões antigas.
    update(id, patch) {
      return file.mutate(users => {
        const index = users.findIndex(user => user.id === id);
        if (index === -1) throw fail('Usuário não encontrado.', 404);
        const next = { ...users[index] };
        let invalidate = false;
        if (patch.name !== undefined) {
          const name = String(patch.name).trim().slice(0, 120);
          if (!name) throw fail('Informe o nome.', 400);
          next.name = name;
        }
        if (patch.email !== undefined) {
          const email = normalizeEmail(patch.email);
          if (!EMAIL_RE.test(email) || email.length > 200) throw fail('E-mail inválido.', 400);
          if (users.some(user => user.email === email && user.id !== id)) throw fail('Já existe um usuário com este e-mail.', 409);
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
        if (invalidate && !patch.keepSessions) next.pwdVersion = (next.pwdVersion || 1) + 1;
        next.updatedAt = new Date().toISOString();
        users[index] = next;
        return { save: users, value: next };
      });
    },
    remove(id) {
      return file.mutate(users => {
        const next = users.filter(user => user.id !== id);
        if (next.length === users.length) return { value: false };
        return { save: next, value: true };
      });
    }
  };
}

module.exports = { createUserStore, publicUser, normalizeEmail, normalizePhone, isValidPhone, ROLES, EMAIL_RE };
