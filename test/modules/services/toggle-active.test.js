const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createService } = require('../../fixtures/serviceFactory');

describe('Services - active toggling', () => {
  let token;

  beforeAll(async () => {
    await db.connect();
    ({ token } = await registerAdmin());
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.cleanDatabase(['Service']);
  });

  describe('PATCH /ca/services/:id/active', () => {
    it('toggles isActive when no body is sent at all', async () => {
      const service = await createService({ isActive: true });

      const res = await agent.patch(apiPath(`/ca/services/${service._id}/active`)).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.message).toBe('Service is now inactive');
    });

    it('sets an explicit isActive value', async () => {
      const service = await createService({ isActive: false });

      const res = await agent
        .patch(apiPath(`/ca/services/${service._id}/active`))
        .set(authHeader(token))
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('requires authentication (unlike the equivalent CA Submissions endpoint)', async () => {
      const service = await createService();

      const res = await agent.patch(apiPath(`/ca/services/${service._id}/active`)).send({});

      expect(res.status).toBe(401);
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
      const res = await agent
        .patch(apiPath('/ca/services/665f1f77bcf86cd799439011/active'))
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Service not found' });
    });

    it('returns 400 for a malformed id', async () => {
      const res = await agent
        .patch(apiPath('/ca/services/not-a-valid-id/active'))
        .set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Invalid service ID' });
    });

    it('deactivating a service removes it from the public master-services list', async () => {
      const service = await createService({ isActive: true });

      const before = await agent.get(apiPath('/ca/master-services'));
      expect(before.body.data.some(s => s.alias === service.alias)).toBe(true);

      await agent
        .patch(apiPath(`/ca/services/${service._id}/active`))
        .set(authHeader(token))
        .send({ isActive: false });

      const after = await agent.get(apiPath('/ca/master-services'));
      expect(after.body.data.some(s => s.alias === service.alias)).toBe(false);
    });
  });

  describe('PATCH /ca/services/:id/sub-services/:subServiceId/active', () => {
    it('toggles a sub-service without affecting the parent service or siblings', async () => {
      const service = await createService({
        subServices: [
          { name: 'A', alias: 'a', isActive: true },
          { name: 'B', alias: 'b', isActive: true }
        ]
      });
      const subServiceId = service.subServices[0]._id;

      const res = await agent
        .patch(apiPath(`/ca/services/${service._id}/sub-services/${subServiceId}/active`))
        .set(authHeader(token));

      expect(res.status).toBe(200);
      const toggled = res.body.data.subServices.find(s => String(s._id) === String(subServiceId));
      const sibling = res.body.data.subServices.find(s => String(s._id) !== String(subServiceId));
      expect(toggled.isActive).toBe(false);
      expect(sibling.isActive).toBe(true);
      expect(res.body.data.isActive).toBe(true); // parent untouched
    });

    it('returns 404 when the sub-service id does not exist on that service', async () => {
      const service = await createService({ subServices: [{ name: 'A', alias: 'a' }] });

      const res = await agent
        .patch(apiPath(`/ca/services/${service._id}/sub-services/665f1f77bcf86cd799439011/active`))
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Sub-service not found' });
    });

    it('returns 404 (not 400) for a malformed sub-service id - Mongoose subdocument .id() just fails to match', async () => {
      const service = await createService({ subServices: [{ name: 'A', alias: 'a' }] });

      const res = await agent
        .patch(apiPath(`/ca/services/${service._id}/sub-services/not-a-valid-id/active`))
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Sub-service not found' });
    });
  });
});
