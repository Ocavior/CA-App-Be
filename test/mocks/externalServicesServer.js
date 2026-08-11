// Standalone stand-in for the two real external HTTP dependencies this app
// calls: the WhatsApp backend microservice (ConversationController,
// NotificationController, AuthService.registerDevice) and the Email API
// microservice (EmailApiService). Runs as its own process/port because the
// server-under-test (Azure Functions host or the future Node server) is a
// separate process from the Jest process - an in-process interceptor like
// nock can't reach across that process boundary, so this has to be a real
// HTTP server the server-under-test's WHATSAPP_API_BASE_URL /
// EMAIL_SERVICE_URL / EMAIL_SERVICE_BASE_URL env vars are pointed at.
//
// Run standalone:   npm run test:mocks
// Configure from tests via test/helpers/mockControl.js, which talks to the
// control endpoints below over HTTP (same reason: separate process).
const express = require('express');
const env = require('../config/env');

function createApp() {
  const app = express();
  app.use(express.json());

  // routeKey -> { status, body } override queued for the NEXT matching call
  const overrides = new Map();
  // routeKey -> [] of { method, path, params, query, body, at }
  const calls = new Map();

  const record = (routeKey, req) => {
    if (!calls.has(routeKey)) calls.set(routeKey, []);
    calls.get(routeKey).push({
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      body: req.body,
      at: new Date().toISOString()
    });
  };

  const respond = (routeKey, req, res, defaultBody) => {
    record(routeKey, req);
    if (overrides.has(routeKey)) {
      const { status, body } = overrides.get(routeKey);
      overrides.delete(routeKey); // one-shot override
      return res.status(status).json(body);
    }
    return res.status(200).json(defaultBody);
  };

  // ---------------- control endpoints ----------------
  app.get('/_mock/health', (req, res) => res.status(200).json({ ok: true }));

  app.post('/_mock/configure', (req, res) => {
    const { routeKey, status, body } = req.body || {};
    if (!routeKey || !status) {
      return res.status(400).json({ error: 'routeKey and status are required' });
    }
    overrides.set(routeKey, { status, body: body || {} });
    res.status(200).json({ ok: true });
  });

  app.get('/_mock/calls/:routeKey', (req, res) => {
    res.status(200).json({ calls: calls.get(req.params.routeKey) || [] });
  });

  app.post('/_mock/reset', (req, res) => {
    overrides.clear();
    calls.clear();
    res.status(200).json({ ok: true });
  });

  // ---------------- WhatsApp backend stand-in ----------------
  // Real base: https://whatsapp-backend.../api/whatsapp — mirrored under /api/whatsapp here.
  const wa = express.Router();

  wa.get('/users', (req, res) =>
    respond('whatsapp:getUsers', req, res, { users: [] }));

  wa.get('/users/search', (req, res) =>
    respond('whatsapp:searchUsers', req, res, { users: [] }));

  wa.get('/chats/:userId', (req, res) =>
    respond('whatsapp:getChats', req, res, { userId: req.params.userId, messages: [] }));

  wa.post('/send/text', (req, res) =>
    respond('whatsapp:sendText', req, res, { messageId: 'mock-msg-1', status: 'queued' }));

  wa.post('/send/template', (req, res) =>
    respond('whatsapp:sendTemplate', req, res, { messageId: 'mock-msg-2', status: 'queued' }));

  wa.post('/send/bulk', (req, res) =>
    respond('whatsapp:sendBulk', req, res, { queued: (req.body.recipients || []).length }));

  wa.post('/send/bulk/template', (req, res) =>
    respond('whatsapp:sendBulkTemplate', req, res, { queued: (req.body.recipients || []).length }));

  wa.post('/register/device', (req, res) =>
    respond('whatsapp:registerDevice', req, res, { registered: true }));

  app.use('/api/whatsapp', wa);

  // ---------------- Email API stand-in ----------------
  // EmailApiService.emailConfig.apiUrl points directly at /email/send (a full
  // endpoint, not base+path); apiBaseUrl points at /email for /emailLogs.
  app.post('/email/send', (req, res) =>
    respond('email:send', req, res, { messageId: 'mock-email-1', status: 'sent' }));

  app.get('/email/emailLogs', (req, res) =>
    respond('email:getLogs', req, res, {
      data: { items: [], page: 1, limit: 10, total: 0, hasMore: false }
    }));

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(env.MOCK_SERVER_PORT, () => {
    console.log(`Mock external-services server listening on http://127.0.0.1:${env.MOCK_SERVER_PORT}`);
    console.log(`  WhatsApp backend stand-in: http://127.0.0.1:${env.MOCK_SERVER_PORT}/api/whatsapp`);
    console.log(`  Email API stand-in:        http://127.0.0.1:${env.MOCK_SERVER_PORT}/email`);
  });
}

module.exports = { createApp };
