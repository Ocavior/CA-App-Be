const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    // Without a listener, an idle client's network error crashes the process.
    pool.on('error', (error) => logger.error('PostgreSQL pool error:', error));
  }
  return pool;
}

function query(text, params, client) {
  return (client || getPool()).query(text, params);
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { getPool, query, withTransaction, closePool };
