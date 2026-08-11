const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const mockControl = require('../../helpers/mockControl');
const { registerAdmin } = require('../../helpers/auth');

describe('Notifications - Email dispatch and logs', () => {
  let token;

  beforeAll(async () => {
    await db.connect();
    ({ token } = await registerAdmin());
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await mockControl.reset();
  });

  describe('POST /notifications/email/bulk', () => {
    it('sends every email and reports sent/failed/total', async () => {
      const res = await agent
        .post(apiPath('/notifications/email/bulk'))
        .set(authHeader(token))
        .send({ emails: ['a@example.test', 'b@example.test', 'c@example.test'], subject: 'Hi', message: 'Body text' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ total: 3, sent: 3, failed: 0, errors: [] });

      const calls = await mockControl.getCalls('email:send');
      expect(calls).toHaveLength(3);
      expect(calls.map(c => c.body.to)).toEqual(['a@example.test', 'b@example.test', 'c@example.test']);
    });

    // sendBulkSimpleEmails sends the FIRST email as a synchronous "gate
    // check" outside the per-email try/catch that protects the rest of the
    // loop - if it fails, the whole request fails and nothing after it is
    // even attempted (not "0 sent, N failed" - a hard 400).
    it('a failure on the first ("gate check") email fails the whole request before trying the rest', async () => {
      await mockControl.configure('email:send', 502, { message: 'Simulated email outage' });

      const res = await agent
        .post(apiPath('/notifications/email/bulk'))
        .set(authHeader(token))
        .send({ emails: ['a@example.test', 'b@example.test'], subject: 'Hi', message: 'Body text' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Simulated email outage' });

      const calls = await mockControl.getCalls('email:send');
      expect(calls).toHaveLength(1); // the second email was never attempted
    });

    it('rejects an empty emails array with 400', async () => {
      const res = await agent
        .post(apiPath('/notifications/email/bulk'))
        .set(authHeader(token))
        .send({ emails: [], subject: 'Hi', message: 'Body' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'emails must be a non-empty array' });
    });

    it('rejects a missing subject/message with 400', async () => {
      const res = await agent
        .post(apiPath('/notifications/email/bulk'))
        .set(authHeader(token))
        .send({ emails: ['a@example.test'] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'subject and message are required' });
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await agent
        .post(apiPath('/notifications/email/bulk'))
        .send({ emails: ['a@example.test'], subject: 'Hi', message: 'Body' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /emailLogs', () => {
    it('proxies to the email service and formats each item down to a fixed field set', async () => {
      await mockControl.configure('email:getLogs', 200, {
        data: {
          items: [
            {
              _id: 'log-1',
              appCode: 'CaApp',
              emailMessage: 'Body',
              recipients: ['a@example.test'],
              subject: 'Hi',
              status: 'sent',
              emailDetails: { provider: 'gmail' },
              createdAt: '2026-01-01T00:00:00.000Z',
              internalSecretField: 'should not leak to the client'
            }
          ],
          page: 1,
          limit: 10,
          total: 1,
          hasMore: false
        }
      });

      const res = await agent.get(apiPath('/emailLogs')).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([
        {
          _id: 'log-1',
          appCode: 'CaApp',
          emailMessage: 'Body',
          recipients: ['a@example.test'],
          subject: 'Hi',
          status: 'sent',
          emailDetails: { provider: 'gmail' },
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ]);
      expect(res.body.data).toMatchObject({ page: 1, limit: 10, total: 1, hasMore: false });
    });

    it('forwards query params as filters (excluding appCode)', async () => {
      await mockControl.configure('email:getLogs', 200, { data: { items: [], page: 1, limit: 10, total: 0, hasMore: false } });

      await agent
        .get(apiPath('/emailLogs'))
        .query({ status: 'sent', appCode: 'ignored-should-not-pass-through' })
        .set(authHeader(token));

      const calls = await mockControl.getCalls('email:getLogs');
      expect(calls[0].query.status).toBe('sent');
      // The controller strips the client's appCode; EmailApiService then
      // adds its own from process.env.APP_CODE - either way, the client's
      // value must never reach the outgoing request.
      expect(calls[0].query.appCode).not.toBe('ignored-should-not-pass-through');
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await agent.get(apiPath('/emailLogs'));
      expect(res.status).toBe(401);
    });
  });
});
