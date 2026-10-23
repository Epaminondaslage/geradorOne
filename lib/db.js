const { Pool } = require('pg');

// Migrações em ordem; cada uma roda uma única vez, dentro de uma transação, com trava para duas instâncias não migrarem juntas.
const MIGRATIONS = [
  {
    version: 1,
    name: 'usuarios-e-projetos',
    sql: `
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL,
        phone text NOT NULL DEFAULT '',
        role text NOT NULL CHECK (role IN ('admin', 'user')),
        active boolean NOT NULL DEFAULT true,
        password_hash text NOT NULL,
        must_change_password boolean NOT NULL DEFAULT true,
        pwd_version integer NOT NULL DEFAULT 1,
        ai jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX users_email_key ON users (email);
      CREATE TABLE projects (
        id uuid PRIMARY KEY,
        owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL,
        kind text NOT NULL CHECK (kind IN ('apostila', 'capa')),
        settings jsonb NOT NULL DEFAULT '{}'::jsonb,
        prompt text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX projects_owner_updated ON projects (owner_id, updated_at DESC);
    `
  }
];

const MIGRATION_LOCK = 727_274;

function createDb(connectionString, options = {}) {
  const pool = new Pool({ connectionString, max: options.max || 10, idleTimeoutMillis: 30_000 });
  pool.on('error', error => console.error('[db] conexão ociosa falhou:', error.message));

  async function tx(work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    query: (text, params) => pool.query(text, params),
    tx,
    async ping() {
      await pool.query('SELECT 1');
    },
    async migrate() {
      return tx(async client => {
        await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
        await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
        const done = new Set((await client.query('SELECT version FROM schema_migrations')).rows.map(row => row.version));
        const applied = [];
        for (const migration of MIGRATIONS) {
          if (done.has(migration.version)) continue;
          await client.query(migration.sql);
          await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
          applied.push(migration.version);
        }
        return applied;
      });
    },
    close: () => pool.end()
  };
}

module.exports = { createDb, MIGRATIONS };
