const fs = require('node:fs');
const path = require('node:path');
const { UUID_RE, isValidPhone, normalizePhone } = require('./users');

function readJsonArray(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

// Importa runtime/users.json e runtime/projects.json (formato anterior ao Postgres) uma única vez, quando o banco está vazio.
// Projetos sem dono passam para o primeiro administrador. Os arquivos não são apagados: ganham o sufixo .migrado-AAAAMMDD.
async function importLegacyJson(db, runtimeDir, log = console.log) {
  const usersFile = path.join(runtimeDir, 'users.json');
  const projectsFile = path.join(runtimeDir, 'projects.json');
  const legacyUsers = readJsonArray(usersFile).filter(user => user && UUID_RE.test(String(user.id)) && user.email && user.passwordHash);
  if (!legacyUsers.length) return { users: 0, projects: 0, skipped: true };
  const existing = Number((await db.query('SELECT count(*) AS total FROM users')).rows[0].total);
  if (existing > 0) return { users: 0, projects: 0, skipped: true };

  const ordered = [...legacyUsers].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const orphanOwner = (ordered.find(user => user.role === 'admin') || ordered[0]).id;
  const ids = new Set(legacyUsers.map(user => user.id));
  const legacyProjects = readJsonArray(projectsFile).filter(project => project && UUID_RE.test(String(project.id)));

  const counts = await db.tx(async client => {
    let users = 0;
    for (const user of legacyUsers) {
      const phone = normalizePhone(user.phone);
      const result = await client.query(
        `INSERT INTO users (id, name, email, phone, role, active, password_hash, must_change_password, pwd_version, ai, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT DO NOTHING`,
        [user.id, String(user.name || user.email).slice(0, 120), String(user.email).toLowerCase(), isValidPhone(phone) ? phone : '', user.role === 'admin' ? 'admin' : 'user', user.active !== false, user.passwordHash,
          Boolean(user.mustChangePassword), Number(user.pwdVersion) || 1, JSON.stringify(user.ai || {}), user.createdAt || new Date().toISOString(), user.updatedAt || new Date().toISOString()]
      );
      users += result.rowCount;
    }
    let projects = 0;
    for (const project of legacyProjects) {
      const owner = ids.has(project.ownerId) ? project.ownerId : orphanOwner;
      const result = await client.query(
        `INSERT INTO projects (id, owner_id, name, kind, settings, prompt, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [project.id, owner, String(project.name || 'Projeto').slice(0, 120), project.kind === 'capa' ? 'capa' : 'apostila', JSON.stringify(project.settings || {}), String(project.prompt || ''),
          project.createdAt || new Date().toISOString(), project.updatedAt || new Date().toISOString()]
      );
      projects += result.rowCount;
    }
    return { users, projects };
  });

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (const file of [usersFile, projectsFile]) {
    if (fs.existsSync(file)) fs.renameSync(file, `${file}.migrado-${stamp}`);
  }
  log(`[migração] ${counts.users} usuário(s) e ${counts.projects} projeto(s) importados dos arquivos JSON para o Postgres. Os arquivos antigos foram renomeados com o sufixo .migrado-${stamp}.`);
  return { ...counts, skipped: false };
}

module.exports = { importLegacyJson };
