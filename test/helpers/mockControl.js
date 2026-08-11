// Talks to test/mocks/externalServicesServer.js's control endpoints over
// HTTP (it's a separate process from both Jest and the server-under-test).
const axios = require('axios');
const env = require('../config/env');

const client = axios.create({ baseURL: env.MOCK_SERVER_URL, timeout: 5000 });

/** Queues a one-shot override for the next call matching routeKey (see externalServicesServer.js for the routeKey list, e.g. 'whatsapp:sendText', 'email:send'). */
async function configure(routeKey, status, body) {
  await client.post('/_mock/configure', { routeKey, status, body });
}

/** Returns every recorded call for routeKey since the last reset(), in order. */
async function getCalls(routeKey) {
  const res = await client.get(`/_mock/calls/${encodeURIComponent(routeKey)}`);
  return res.data.calls;
}

/** Clears all queued overrides and recorded calls. Call in beforeEach for tests that assert on outbound calls. */
async function reset() {
  await client.post('/_mock/reset');
}

module.exports = { configure, getCalls, reset };
