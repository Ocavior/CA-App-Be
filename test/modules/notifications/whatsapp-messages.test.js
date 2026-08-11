const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const mockControl = require('../../helpers/mockControl');
const { registerAdmin } = require('../../helpers/auth');

describe('Notifications - WhatsApp message dispatch', () => {
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

  describe('POST /messages/send', () => {
    it('sends a single message and passes through the WhatsApp backend response', async () => {
      await mockControl.configure('whatsapp:sendText', 200, { messageId: 'wa-1', status: 'queued' });

      const res = await agent
        .post(apiPath('/messages/send'))
        .set(authHeader(token))
        .send({ to: '+919876543210', text: 'Hello there', user_name: 'Priya' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: { messageId: 'wa-1', status: 'queued' } });

      const calls = await mockControl.getCalls('whatsapp:sendText');
      expect(calls[0].body).toMatchObject({ to: '+919876543210', text: 'Hello there', user_name: 'Priya' });
    });

    it('rejects a missing "to" with 400', async () => {
      const res = await agent.post(apiPath('/messages/send')).set(authHeader(token)).send({ text: 'Hi' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'to (phone number) is required' });
    });

    it('rejects a missing "text" with 400', async () => {
      const res = await agent.post(apiPath('/messages/send')).set(authHeader(token)).send({ to: '+919876543210' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'text is required' });
    });

    it('propagates the external API\'s error status', async () => {
      await mockControl.configure('whatsapp:sendText', 429, { message: 'Rate limited' });

      const res = await agent
        .post(apiPath('/messages/send'))
        .set(authHeader(token))
        .send({ to: '+919876543210', text: 'Hi' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await agent.post(apiPath('/messages/send')).send({ to: '+919876543210', text: 'Hi' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /messages/sendTemplate', () => {
    it('sends a template message with defaults for language and bodyParams', async () => {
      await mockControl.configure('whatsapp:sendTemplate', 200, { messageId: 'wa-2' });

      const res = await agent
        .post(apiPath('/messages/sendTemplate'))
        .set(authHeader(token))
        .send({ to: '+919876543210', name: 'welcome_template' });

      expect(res.status).toBe(200);
      const calls = await mockControl.getCalls('whatsapp:sendTemplate');
      expect(calls[0].body).toMatchObject({ to: '+919876543210', name: 'welcome_template', language: 'en', bodyParams: [] });
    });

    it('rejects bodyParams that is not an array', async () => {
      const res = await agent
        .post(apiPath('/messages/sendTemplate'))
        .set(authHeader(token))
        .send({ to: '+919876543210', name: 'welcome_template', bodyParams: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'bodyParams must be an array' });
    });

    it('rejects a missing name with 400', async () => {
      const res = await agent
        .post(apiPath('/messages/sendTemplate'))
        .set(authHeader(token))
        .send({ to: '+919876543210' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'name (template name) is required' });
    });
  });

  describe('POST /messages/sendBulkTemplate', () => {
    it('formats recipients and forwards them', async () => {
      await mockControl.configure('whatsapp:sendBulkTemplate', 200, { queued: 2 });

      const res = await agent
        .post(apiPath('/messages/sendBulkTemplate'))
        .set(authHeader(token))
        .send({
          name: 'welcome_template',
          recipients: [{ phone: '+919876543210', user_name: 'A' }, { phone: '+919876543211' }]
        });

      expect(res.status).toBe(200);
      const calls = await mockControl.getCalls('whatsapp:sendBulkTemplate');
      expect(calls[0].body.recipients).toEqual([
        { phone: '+919876543210', user_name: 'A', bodyParams: [] },
        { phone: '+919876543211', user_name: '', bodyParams: [] }
      ]);
    });

    it('drops recipients with no phone and rejects if none remain', async () => {
      const res = await agent
        .post(apiPath('/messages/sendBulkTemplate'))
        .set(authHeader(token))
        .send({ name: 'welcome_template', recipients: [{ user_name: 'No Phone' }] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: 'No valid recipients found (each recipient must have a phone number)'
      });
    });

    it('rejects a missing/empty recipients array', async () => {
      const res = await agent
        .post(apiPath('/messages/sendBulkTemplate'))
        .set(authHeader(token))
        .send({ name: 'welcome_template', recipients: [] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'recipients must be a non-empty array' });
    });
  });

  describe('POST /notifications/whatsapp/bulk', () => {
    it('sends bulk plain-text messages with the default delay', async () => {
      await mockControl.configure('whatsapp:sendBulk', 200, { queued: 2 });

      const res = await agent
        .post(apiPath('/notifications/whatsapp/bulk'))
        .set(authHeader(token))
        .send({ text: 'Reminder', recipients: ['+919876543210', '+919876543211'] });

      expect(res.status).toBe(200);
      const calls = await mockControl.getCalls('whatsapp:sendBulk');
      expect(calls[0].body).toMatchObject({ text: 'Reminder', recipients: ['+919876543210', '+919876543211'], delay_seconds: 1 });
    });

    it('rejects a missing text with 400', async () => {
      const res = await agent
        .post(apiPath('/notifications/whatsapp/bulk'))
        .set(authHeader(token))
        .send({ recipients: ['+919876543210'] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'text is required' });
    });
  });
});
