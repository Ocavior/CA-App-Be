const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createWhatsappTemplate } = require('../../fixtures/whatsappTemplateFactory');

describe('WhatsApp Templates - CRUD (parts unaffected by the request.body bug - see known-issues.test.js)', () => {
  let token;

  beforeAll(async () => {
    await db.connect();
    ({ token } = await registerAdmin());
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.cleanDatabase(['WhatsappTemplate']);
  });

  describe('GET /whatsapp/templates', () => {
    it('lists all templates', async () => {
      await createWhatsappTemplate({ isActive: true });
      await createWhatsappTemplate({ isActive: false });

      const res = await agent.get(apiPath('/whatsapp/templates')).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('filters to active only with activeOnly=true', async () => {
      await createWhatsappTemplate({ isActive: true });
      await createWhatsappTemplate({ isActive: false });

      const res = await agent
        .get(apiPath('/whatsapp/templates'))
        .query({ activeOnly: 'true' })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].isActive).toBe(true);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await agent.get(apiPath('/whatsapp/templates'));
      expect(res.status).toBe(401);
    });
  });

  describe('GET /whatsapp/templates/:id', () => {
    it('returns the template when it exists', async () => {
      const template = await createWhatsappTemplate();

      const res = await agent.get(apiPath(`/whatsapp/templates/${template._id}`)).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(template._id.toString());
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
      const res = await agent
        .get(apiPath('/whatsapp/templates/665f1f77bcf86cd799439011'))
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Template not found' });
    });

    // Contract characterization: unlike Services' getServiceById, this
    // controller has no `err.name === 'CastError'` special-case at all - a
    // malformed id falls through to the generic 500 branch with a fixed,
    // non-leaky message.
    it('returns 500 (not 400) for a malformed id, with a generic message', async () => {
      const res = await agent
        .get(apiPath('/whatsapp/templates/not-a-valid-id'))
        .set(authHeader(token));

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, message: 'Failed to fetch template' });
    });
  });

  describe('DELETE /whatsapp/templates/:id', () => {
    it('deletes an existing template', async () => {
      const template = await createWhatsappTemplate();

      const res = await agent.delete(apiPath(`/whatsapp/templates/${template._id}`)).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Template deleted' });
      expect(await db.models.WhatsappTemplate.findById(template._id)).toBeNull();
    });

    it('returns 404 when the template does not exist', async () => {
      const res = await agent
        .delete(apiPath('/whatsapp/templates/665f1f77bcf86cd799439011'))
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Template not found' });
    });
  });

  describe('PATCH /whatsapp/templates/:id/toggle', () => {
    it('flips isActive', async () => {
      const template = await createWhatsappTemplate({ isActive: true });

      const res = await agent.patch(apiPath(`/whatsapp/templates/${template._id}/toggle`)).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('returns 404 when the template does not exist', async () => {
      const res = await agent
        .patch(apiPath('/whatsapp/templates/665f1f77bcf86cd799439011/toggle'))
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Template not found' });
    });
  });
});
