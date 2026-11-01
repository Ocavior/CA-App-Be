const axios = require('axios');
const env = require('./env');

module.exports = async function globalSetup() {
  // Set before loading the pool, which reads DATABASE_URL when first used.
  process.env.DATABASE_URL = env.TEST_DATABASE_URL;
  const { query, closePool } = require('../../ca-be-node/src/db/pool');

  // 1. Mock external-services server (WhatsApp backend + Email API stand-ins)
  try {
    await axios.get(`${env.MOCK_SERVER_URL}/_mock/health`, { timeout: 3000 });
  } catch (err) {
    throw new Error(
      `\n\nMock external-services server is not reachable at ${env.MOCK_SERVER_URL}.\n` +
      `Start it first, in its own terminal:  npm run test:mocks\n` +
      `It must already be running - with WHATSAPP_API_BASE_URL / EMAIL_SERVICE_URL / ` +
      `EMAIL_SERVICE_BASE_URL on the server-under-test pointed at it - before you start the ` +
      `server-under-test. See test/README.md.\n`
    );
  }

  // 2. Server under test (ca-be-node, at whatever BASE_URL points at)
  try {
    await axios.get(`${env.BASE_URL}${env.API_PREFIX}/ca/health`, { timeout: 5000 });
  } catch (err) {
    throw new Error(
      `\n\nServer under test is not reachable at ${env.BASE_URL}${env.API_PREFIX}/ca/health.\n` +
      `Start ca-be-node with DATABASE_URL set to TEST_DATABASE_URL and pointed at the mock ` +
      `services server, then re-run tests. See test/README.md.\n`
    );
  }

  // 3. Direct DB connectivity check (the fixtures/helpers connect for real per test file)
  try {
    await query('SELECT 1 FROM schema_migrations LIMIT 1');
  } catch (err) {
    throw new Error(
      `\n\nCould not query TEST_DATABASE_URL ("${env.TEST_DATABASE_URL.replace(/\/\/.*@/, '//<redacted>@')}"). ` +
      `Is PostgreSQL up and the schema applied? See test/README.md.\n` +
      `Original error: ${err.message}\n`
    );
  } finally {
    await closePool();
  }
};
