const crypto = require('node:crypto');
const { Client } = require('pg');

// Cada arquivo de teste ganha um banco próprio dentro do Postgres de teste (TEST_DATABASE_URL), então podem rodar em paralelo.
async function createTestDatabase() {
  const admin = process.env.TEST_DATABASE_URL;
  if (!admin) throw new Error('TEST_DATABASE_URL não definida. Rode os testes com "npm test", que sobe um Postgres descartável.');
  const name = `g1_${crypto.randomBytes(6).toString('hex')}`;
  const client = new Client({ connectionString: admin });
  await client.connect();
  await client.query(`CREATE DATABASE ${name}`);
  await client.end();
  const url = new URL(admin);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    async drop() {
      const cleanup = new Client({ connectionString: admin });
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await cleanup.end();
    }
  };
}

module.exports = { createTestDatabase };
