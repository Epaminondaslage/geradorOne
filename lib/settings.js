// Configurações gerais do sistema, uma linha por chave, guardadas no banco.
function createSettingsStore(db) {
  return {
    async get(key) {
      const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
      return rows[0]?.value || null;
    },
    async set(key, value) {
      await db.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
        [key, JSON.stringify(value)]
      );
    },
    async remove(key) {
      await db.query('DELETE FROM settings WHERE key = $1', [key]);
    }
  };
}

module.exports = { createSettingsStore };
