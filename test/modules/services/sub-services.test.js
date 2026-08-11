const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createService } = require('../../fixtures/serviceFactory');

describe('Services - sub-services (/ca/services/:id/sub-services...)', () => {
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

  describe('POST /ca/services/:id/sub-services', () => {
    it('adds a sub-service with an auto-generated alias', async () => {
      const service = await createService();

      const res = await agent
        .post(apiPath(`/ca/services/${service._id}/sub-services`))
        .set(authHeader(token))
        .send({ name: 'Tax Planning' });

      expect(res.status).toBe(201);
      const added = res.body.data.subServices.find(s => s.name === 'Tax Planning');
      expect(added.alias).toBe('taxPlanning');
    });

    it('rejects a missing name with 400', async () => {
      const service = await createService();

      const res = await agent
        .post(apiPath(`/ca/services/${service._id}/sub-services`))
        .set(authHeader(token))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Sub-service name is required' });
    });

    it('returns 404 when the parent service does not exist', async () => {
      const res = await agent
        .post(apiPath('/ca/services/665f1f77bcf86cd799439011/sub-services'))
        .set(authHeader(token))
        .send({ name: 'Tax Planning' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Service not found' });
    });

    // Contract characterization: this is the SAME conceptual error (a
    // duplicate sub-service alias) as the inline-create-time check in
    // createService, but that one returns 400 while this one returns 409.
    // Not necessarily wrong, but worth deciding on purpose during migration
    // rather than preserving the inconsistency by accident.
    it('rejects an alias that collides with an existing sub-service with 409 (not 400)', async () => {
      const service = await createService({ subServices: [{ name: 'Compliance', alias: 'compliance' }] });

      const res = await agent
        .post(apiPath(`/ca/services/${service._id}/sub-services`))
        .set(authHeader(token))
        .send({ name: 'Compliance Again', alias: 'compliance' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'Sub-service alias "compliance" already exists on this service' });
    });
  });

  describe('PUT /ca/services/:id/sub-services/:subServiceId', () => {
    it('updates a sub-service\'s fields', async () => {
      const service = await createService({ subServices: [{ name: 'Old', alias: 'old', isActive: true }] });
      const subServiceId = service.subServices[0]._id;

      const res = await agent
        .put(apiPath(`/ca/services/${service._id}/sub-services/${subServiceId}`))
        .set(authHeader(token))
        .send({ name: 'New Name', isOfferedDefault: true });

      expect(res.status).toBe(200);
      const updated = res.body.data.subServices.find(s => String(s._id) === String(subServiceId));
      expect(updated).toMatchObject({ name: 'New Name', isOfferedDefault: true, alias: 'old' });
    });

    it('returns 404 when the parent service does not exist', async () => {
      const res = await agent
        .put(apiPath('/ca/services/665f1f77bcf86cd799439011/sub-services/665f1f77bcf86cd799439012'))
        .set(authHeader(token))
        .send({ name: 'X' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Service not found' });
    });

    it('returns 404 when the sub-service does not exist on an existing service', async () => {
      const service = await createService();

      const res = await agent
        .put(apiPath(`/ca/services/${service._id}/sub-services/665f1f77bcf86cd799439012`))
        .set(authHeader(token))
        .send({ name: 'X' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Sub-service not found' });
    });

    it('rejects an unauthenticated request with 401', async () => {
      const service = await createService({ subServices: [{ name: 'A', alias: 'a' }] });

      const res = await agent
        .put(apiPath(`/ca/services/${service._id}/sub-services/${service.subServices[0]._id}`))
        .send({ name: 'X' });

      expect(res.status).toBe(401);
    });
  });
});
