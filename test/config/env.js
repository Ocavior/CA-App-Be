const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.test') });

function required(name, hint) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. ${hint || ''}`);
  }
  return value;
}

const TEST_DATABASE_URL = required(
  'TEST_DATABASE_URL',
  'Copy .env.test.example to .env.test and set it to a DEDICATED test database.'
);

// Safety guard: the real local database is named "ca_app" and sits on the same
// PostgreSQL server as the test database. Refuse to run if TEST_DATABASE_URL
// doesn't clearly point at a test database, so a misconfigured .env.test can't seed/clean data into production.
const dbNameMatch = TEST_DATABASE_URL.match(/\/([^/?]+)(\?|$)/);
const dbName = dbNameMatch ? dbNameMatch[1] : '';
if (!/test/i.test(dbName)) {
  throw new Error(
    `TEST_DATABASE_URL targets database "${dbName}", which doesn't look like a test database ` +
    `(expected the database name to contain "test"). Refusing to run so this suite can never ` +
    `seed or delete data in a non-test database. Point TEST_DATABASE_URL at a dedicated test DB.`
  );
}

const MOCK_SERVER_PORT = parseInt(process.env.MOCK_SERVER_PORT || '4100', 10);

module.exports = {
  BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:7071',
  // Empirically "/api/v1" against a real `func start`, not "/v1" as
  // host.json's routePrefix:"" would suggest - see .env.test.example.
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  TEST_DATABASE_URL,
  MOCK_SERVER_PORT,
  MOCK_SERVER_URL: `http://127.0.0.1:${MOCK_SERVER_PORT}`
};
