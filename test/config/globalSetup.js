const axios = require('axios');
const mongoose = require('mongoose');
const env = require('./env');

module.exports = async function globalSetup() {
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

  // 2. Server under test (Azure Functions host or the Node server, whichever BASE_URL points at)
  try {
    await axios.get(`${env.BASE_URL}${env.API_PREFIX}/ca/health`, { timeout: 5000 });
  } catch (err) {
    throw new Error(
      `\n\nServer under test is not reachable at ${env.BASE_URL}${env.API_PREFIX}/ca/health.\n` +
      `Start either the Azure Functions host ("func start") or the target Node server, pointed ` +
      `at TEST_MONGODB_URI and the mock services server, then re-run tests. See test/README.md.\n`
    );
  }

  // 3. Direct DB connectivity check (the fixtures/helpers connect for real per test file)
  try {
    await mongoose.connect(env.TEST_MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await mongoose.disconnect();
  } catch (err) {
    throw new Error(
      `\n\nCould not connect directly to TEST_MONGODB_URI ("${env.TEST_MONGODB_URI.replace(/\/\/.*@/, '//<redacted>@')}").\n` +
      `Original error: ${err.message}\n`
    );
  }
};
