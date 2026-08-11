// This whole module is a thin proxy over the external WhatsApp backend - no
// local database involvement at all. Tests here exercise
// test/helpers/mockControl.js to configure canned responses/failures and
// assert on what was actually forwarded, rather than seeding fixtures.
const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const mockControl = require('../../helpers/mockControl');
const { registerAdmin } = require('../../helpers/auth');

describe('Conversations - proxy to the WhatsApp backend', () => {
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

  describe('GET /conversations', () => {
    it('passes through the WhatsApp backend\'s response', async () => {
      await mockControl.configure('whatsapp:getUsers', 200, { users: [{ id: 'u1', name: 'Alice' }] });

      const res = await agent.get(apiPath('/conversations')).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { users: [{ id: 'u1', name: 'Alice' }] } });
    });

    it('propagates the external API\'s error status and payload', async () => {
      await mockControl.configure('whatsapp:getUsers', 503, { message: 'WhatsApp backend is down' });

      const res = await agent.get(apiPath('/conversations')).set(authHeader(token));

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        success: false,
        message: 'Failed to fetch users',
        error: { message: 'WhatsApp backend is down' }
      });
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await agent.get(apiPath('/conversations'));
      expect(res.status).toBe(401);
    });
  });

  describe('GET /conversations/search', () => {
    it('requires a q parameter', async () => {
      const res = await agent.get(apiPath('/conversations/search')).set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'q parameter is required' });
    });

    it('forwards q to the WhatsApp backend and passes through the response', async () => {
      await mockControl.configure('whatsapp:searchUsers', 200, { users: [{ id: 'u2', name: 'Bob' }] });

      const res = await agent
        .get(apiPath('/conversations/search'))
        .query({ q: 'Bob' })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.users).toHaveLength(1);

      const calls = await mockControl.getCalls('whatsapp:searchUsers');
      expect(calls[0].query.q).toBe('Bob');
    });
  });

  describe('GET /conversations/:userId/messages', () => {
    it('forwards the userId and defaults limit to 50', async () => {
      await mockControl.configure('whatsapp:getChats', 200, { messages: [] });

      const res = await agent
        .get(apiPath('/conversations/user-123/messages'))
        .set(authHeader(token));

      expect(res.status).toBe(200);
      const calls = await mockControl.getCalls('whatsapp:getChats');
      expect(calls[0].params.userId).toBe('user-123');
      expect(calls[0].query.limit).toBe('50');
    });

    it('forwards a custom limit', async () => {
      await mockControl.configure('whatsapp:getChats', 200, { messages: [] });

      await agent
        .get(apiPath('/conversations/user-123/messages'))
        .query({ limit: 10 })
        .set(authHeader(token));

      const calls = await mockControl.getCalls('whatsapp:getChats');
      expect(calls[0].query.limit).toBe('10');
    });
  });
});
