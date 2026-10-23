const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createTestDatabase } = require('./helpers/db');
const { createDb } = require('../lib/db');
const { createUserStore } = require('../lib/users');
const { createProjectStore } = require('../lib/projects');
const { importLegacyJson } = require('../lib/legacy-import');

let testDb;
let db;
let users;
let projects;

test.before(async () => {
  testDb = await createTestDatabase();
  db = createDb(testDb.url);
  assert.deepEqual(await db.migrate(), [1, 2, 3, 4, 5, 6]);
  users = createUserStore(db);
  projects = createProjectStore(db);
});
test.after(async () => {
  await db.close();
  await testDb.drop();
});

const person = (n, extra = {}) => ({ name: `Pessoa ${n}`, email: `pessoa${n}@teste.com`, phone: '(35) 99999-8888', role: 'user', passwordHash: 'hash', ...extra });

test('migração roda uma vez só e pode ser repetida sem erro', async () => {
  assert.deepEqual(await db.migrate(), []);
  const { rows } = await db.query('SELECT version FROM schema_migrations');
  assert.deepEqual(rows.map(row => row.version), [1, 2, 3, 4, 5, 6]);
});

test('usuários: cria, normaliza, impede e-mail repetido (mesmo em corrida) e valida campos', async () => {
  const created = await users.create(person(1, { email: '  Pessoa1@Teste.COM ' }));
  assert.equal(created.email, 'pessoa1@teste.com');
  assert.equal(created.phone, '35999998888');
  assert.equal(created.pwdVersion, 1);
  assert.equal((await users.getByEmail('PESSOA1@teste.com')).id, created.id);
  await assert.rejects(() => users.create(person(1)), error => error.status === 409);
  const race = await Promise.allSettled([users.create(person(2)), users.create(person(2)), users.create(person(2))]);
  assert.equal(race.filter(item => item.status === 'fulfilled').length, 1);
  assert.ok(race.filter(item => item.status === 'rejected').every(item => item.reason.status === 409));
  await assert.rejects(() => users.create(person(3, { phone: '' })), error => error.status === 400);
  await assert.rejects(() => users.create(person(3, { phone: '123' })), error => error.status === 400);
  await assert.rejects(() => users.create(person(3, { role: 'root' })), error => error.status === 400);
  await assert.rejects(() => users.create(person(3, { email: 'sem-arroba' })), error => error.status === 400);
  assert.equal((await users.create(person(4, { phone: '', bootstrap: true }))).phone, '');
});

test('usuários: atualizar muda a versão da sessão só quando deve, e protege contra ids inválidos', async () => {
  const user = await users.create(person(10));
  const renamed = await users.update(user.id, { name: 'Outro Nome' });
  assert.equal(renamed.pwdVersion, 1);
  const kept = await users.update(user.id, { ai: { keyEnc: 'x' }, keepSessions: true });
  assert.equal(kept.pwdVersion, 1);
  assert.equal((await users.update(user.id, { active: false })).pwdVersion, 2);
  assert.equal((await users.update(user.id, { role: 'admin' })).pwdVersion, 3);
  assert.equal((await users.update(user.id, { passwordHash: 'novo' })).pwdVersion, 4);
  assert.equal((await users.update(user.id, { active: false })).pwdVersion, 4);
  await assert.rejects(() => users.update(user.id, { email: person(1).email }), error => error.status === 409);
  await assert.rejects(() => users.update(user.id, { phone: '' }), error => error.status === 400);
  await assert.rejects(() => users.update('00000000-0000-0000-0000-000000000000', { name: 'x' }), error => error.status === 404);
  await assert.rejects(() => users.update('nao-e-uuid', { name: 'x' }), error => error.status === 404);
  assert.equal(await users.getById("'; DROP TABLE users; --"), null);
  const stored = (await users.getById(user.id)).ai;
  assert.deepEqual(stored, { keyEnc: 'x' });
});

test('tema: começa vazio, aceita só os temas conhecidos e não derruba a sessão', async () => {
  const user = await users.create(person(91));
  assert.equal(user.theme, '');
  const saved = await users.update(user.id, { theme: 'lousa', keepSessions: true });
  assert.equal(saved.theme, 'lousa');
  assert.equal(saved.pwdVersion, user.pwdVersion);
  await assert.rejects(users.update(user.id, { theme: 'neon' }), { status: 400 });
  assert.equal((await users.getById(user.id)).theme, 'lousa');
  assert.equal((await users.update(user.id, { theme: '', keepSessions: true })).theme, '');
});

test('atualizações simultâneas do mesmo usuário não se perdem', async () => {
  const user = await users.create(person(20));
  await Promise.all(Array.from({ length: 10 }, () => users.update(user.id, { passwordHash: crypto.randomBytes(4).toString('hex') })));
  assert.equal((await users.getById(user.id)).pwdVersion, 11);
});

test('projetos: salvar, atualizar, listar por dono e impedir que outro usuário mexa', async () => {
  const dono = await users.create(person(30));
  const outro = await users.create(person(31));
  const criado = await projects.save(dono.id, { name: 'Lei de Ohm', kind: 'apostila', settings: { assunto: 'Ohm', ok: true, n: 3 }, prompt: 'P1' });
  assert.match(criado.id, /^[0-9a-f-]{36}$/);
  const atualizado = await projects.save(dono.id, { id: criado.id, name: 'Lei de Ohm v2', kind: 'apostila', settings: {}, prompt: 'P2' });
  assert.equal(atualizado.id, criado.id);
  assert.equal(atualizado.createdAt, criado.createdAt);
  assert.ok(atualizado.updatedAt >= criado.updatedAt);
  const lista = await projects.list(dono.id);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].prompt, undefined);
  assert.deepEqual((await projects.get(dono.id, criado.id)).settings, {});
  assert.equal(await projects.get(outro.id, criado.id), null);
  assert.deepEqual(await projects.list(outro.id), []);
  assert.equal(await projects.remove(outro.id, criado.id), false);
  const sequestro = await projects.save(outro.id, { id: criado.id, name: 'Roubado', kind: 'capa', settings: {}, prompt: 'X' });
  assert.notEqual(sequestro.id, criado.id);
  assert.equal((await projects.get(dono.id, criado.id)).name, 'Lei de Ohm v2');
  assert.equal(await projects.get(dono.id, 'x'), null);
  assert.equal(await projects.remove(dono.id, criado.id), true);
});

test('projetos: limite por usuário vale mesmo com gravações simultâneas', async () => {
  const dono = await users.create(person(90));
  await db.query(`INSERT INTO projects (id, owner_id, name, kind) SELECT gen_random_uuid(), $1, 'p' || g, 'capa' FROM generate_series(1, 498) g`, [dono.id]);
  const corrida = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => projects.save(dono.id, { name: `n${i}`, kind: 'capa', settings: {}, prompt: '' })));
  assert.equal(corrida.filter(item => item.status === 'fulfilled').length, 2);
  assert.ok(corrida.filter(item => item.status === 'rejected').every(item => item.reason.status === 409));
  assert.equal(await projects.countFor(dono.id), 500);
});

test('excluir o usuário apaga os projetos dele em cascata e só os dele', async () => {
  const a = await users.create(person(50));
  const b = await users.create(person(51));
  await projects.save(a.id, { name: 'A1', kind: 'capa', settings: {}, prompt: '' });
  await projects.save(a.id, { name: 'A2', kind: 'capa', settings: {}, prompt: '' });
  await projects.save(b.id, { name: 'B1', kind: 'capa', settings: {}, prompt: '' });
  assert.equal(await projects.countFor(a.id), 2);
  assert.equal(await users.remove(a.id), true);
  assert.equal(await users.remove(a.id), false);
  assert.equal(await projects.countFor(a.id), 0);
  assert.equal(await projects.countFor(b.id), 1);
});

test('transação desfaz tudo quando algo falha no meio', async () => {
  const before = await users.count();
  await assert.rejects(() => db.tx(async client => {
    await client.query(`INSERT INTO users (id, name, email, role, password_hash) VALUES ($1, 'T', 'tx@teste.com', 'user', 'h')`, [crypto.randomUUID()]);
    throw new Error('falha de propósito');
  }), /falha de propósito/);
  assert.equal(await users.count(), before);
  assert.equal(await users.getByEmail('tx@teste.com'), null);
});

test('importação dos JSONs antigos: preserva ids e senhas, adota órfãos, renomeia os arquivos e roda uma vez', async () => {
  const fresh = await createTestDatabase();
  const freshDb = createDb(fresh.url);
  await freshDb.migrate();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-legacy-'));
  const adminId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const orphanId = crypto.randomUUID();
  const ownedId = crypto.randomUUID();
  fs.writeFileSync(path.join(dir, 'users.json'), JSON.stringify([
    { id: userId, name: 'Ana', email: 'Ana@Teste.com', phone: '11988887777', role: 'user', active: true, passwordHash: 'scrypt$x', mustChangePassword: false, pwdVersion: 3, ai: { keyEnc: 'v1.a.b.c', provider: 'gemini' }, createdAt: '2026-10-22T10:00:00.000Z', updatedAt: '2026-10-22T10:00:00.000Z' },
    { id: adminId, name: 'Admin', email: 'admin@teste.com', role: 'admin', active: true, passwordHash: 'scrypt$y', mustChangePassword: true, pwdVersion: 1, ai: {}, createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z' },
    { id: 'lixo', email: 'x@y.co', passwordHash: 'h' }
  ]));
  fs.writeFileSync(path.join(dir, 'projects.json'), JSON.stringify([
    { id: orphanId, name: 'Sem dono', kind: 'capa', settings: { a: 1 }, prompt: 'P', createdAt: '2026-10-21T10:00:00.000Z', updatedAt: '2026-10-21T10:00:00.000Z' },
    { id: ownedId, ownerId: userId, name: 'Da Ana', kind: 'apostila', settings: {}, prompt: 'Q', createdAt: '2026-10-21T11:00:00.000Z', updatedAt: '2026-10-21T11:00:00.000Z' }
  ]));
  const logs = [];
  const result = await importLegacyJson(freshDb, dir, message => logs.push(message));
  assert.deepEqual({ users: result.users, projects: result.projects, skipped: result.skipped }, { users: 2, projects: 2, skipped: false });
  const importedUsers = createUserStore(freshDb);
  const importedProjects = createProjectStore(freshDb);
  const ana = await importedUsers.getById(userId);
  assert.equal(ana.email, 'ana@teste.com');
  assert.equal(ana.passwordHash, 'scrypt$x');
  assert.equal(ana.pwdVersion, 3);
  assert.equal(ana.mustChangePassword, false);
  assert.deepEqual(ana.ai, { keyEnc: 'v1.a.b.c', provider: 'gemini' });
  assert.equal((await importedUsers.getById(adminId)).mustChangePassword, true);
  assert.equal((await importedProjects.get(adminId, orphanId)).name, 'Sem dono');
  assert.equal((await importedProjects.get(userId, ownedId)).prompt, 'Q');
  assert.deepEqual(fs.readdirSync(dir).sort().map(name => name.replace(/\d{8}$/, 'AAAAMMDD')), ['projects.json.migrado-AAAAMMDD', 'users.json.migrado-AAAAMMDD']);
  assert.match(logs[0], /2 usuário\(s\) e 2 projeto\(s\)/);
  assert.equal((await importLegacyJson(freshDb, dir, () => {})).skipped, true);
  await freshDb.close();
  await fresh.drop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('importação ignora a pasta sem arquivos e não mexe em banco que já tem usuários', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-legacy-empty-'));
  assert.equal((await importLegacyJson(db, dir, () => {})).skipped, true);
  fs.writeFileSync(path.join(dir, 'users.json'), JSON.stringify([{ id: crypto.randomUUID(), name: 'Z', email: 'z@teste.com', role: 'user', passwordHash: 'h' }]));
  const before = await users.count();
  assert.equal((await importLegacyJson(db, dir, () => {})).skipped, true);
  assert.equal(await users.count(), before);
  assert.deepEqual(fs.readdirSync(dir), ['users.json']);
  fs.rmSync(dir, { recursive: true, force: true });
});
