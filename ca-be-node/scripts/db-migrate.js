// Applies db/migrations/*.sql in filename order, each once, each in a transaction.
// Usage: npm run db:migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, withTransaction, closePool } = require('../src/db/pool');

const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations');

async function main() {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const { rows } = await query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map(r => r.filename));

  for (const filename of fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()) {
    if (applied.has(filename)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    });
    console.log(`Applied ${filename}`);
  }
  console.log('Schema is up to date.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(closePool);
