const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createService, buildService } = require('../../fixtures/serviceFactory');

describe('Services - CRUD (/ca/services)', () => {
  let token;

  beforeAll(async () => {
    await db.connect();
    ({ token } = await registerAdmin());
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    // Admin fixture above must survive - see the equivalent note in
    // test/modules/ca-submissions/crud.test.js.
    await db.cleanDatabase(['Service']);
  });

  describe('POST /ca/services', () => {
    it('creates a service and auto-generates a camelCase alias from the name', async () => {
      const res = await agent
        .post(apiPath('/ca/services'))
        .set(authHeader(token))
        .send({ name: 'Income Tax' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ name: 'Income Tax', alias: 'incomeTax', isActive: true, source: 'manual' });
    });

    it('honors an explicit alias', async () => {
      const res = await agent
        .post(apiPath('/ca/services'))
        .set(authHeader(token))
        .send({ name: 'GST Filing', alias: 'gst' });

      expect(res.status).toBe(201);
      expect(res.body.data.alias).toBe('gst');
    });

    it('creates inline sub-services', async () => {
      const res = await agent
        .post(apiPath('/ca/services'))
        .set(authHeader(token))
        .send({
          name: 'Income Tax',
          subServices: [{ name: 'Compliance' }, { name: 'Tax Planning' }]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.subServices).toHaveLength(2);
      expect(res.body.data.subServices.map(s => s.alias)).toEqual(['compliance', 'taxPlanning']);
    });

    it('rejects a missing name with 400', async () => {
      const res = await agent.post(apiPath('/ca/services')).set(authHeader(token)).send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Service name is required' });
    });

    it('rejects an inline sub-service with no name', async () => {
      const res = await agent
        .post(apiPath('/ca/services'))
        .set(authHeader(token))
        .send({ name: 'Income Tax', subServices: [{ name: '' }] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Sub-service name is required' });
    });

    // issues.md #9 (confirmed & fixed) - regression guard for its own module.
    it('#9 - two inline sub-services with the same name (no alias given) get distinct auto-generated aliases', async () => {
      const res = await agent
        .post(apiPath('/ca/services'))
        .set(authHeader(token))
        .send({
          name: 'Income Tax',
          subServices: [{ name: 'Compliance' }, { name: 'Compliance' }]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.subServices.map(s => s.alias)).toEqual(['compliance', 'compliance2']);
    });

    it('#9 - two inline sub-services given the same explicit alias are rejected with 400', async () => {
      const res = await agent
        .post(apiPath('/ca/services'))
        .set(authHeader(token))
        .send({
          name: 'Income Tax',
          subServices: [
            { name: 'Compliance', alias: 'dup' },
            { name: 'Tax Planning', alias: 'dup' }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Duplicate sub-service alias "dup" in request' });
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await agent.post(apiPath('/ca/services')).send({ name: 'Income Tax' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /ca/services (admin list)', () => {
    it('returns every service, including inactive ones', async () => {
      await createService({ isActive: true });
      await createService({ isActive: false });

      const res = await agent.get(apiPath('/ca/services')).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await agent.get(apiPath('/ca/services'));
      expect(res.status).toBe(401);
    });
  });

  describe('GET /ca/services/:id', () => {
    it('returns the service when it exists', async () => {
      const service = await createService();

      const res = await agent.get(apiPath(`/ca/services/${service._id}`)).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(service._id.toString());
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
      const res = await agent
        .get(apiPath('/ca/services/665f1f77bcf86cd799439011'))
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Service not found' });
    });

    it('returns 400 for a malformed id (this endpoint DOES special-case CastError)', async () => {
      const res = await agent
        .get(apiPath('/ca/services/not-a-valid-id'))
        .set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Invalid service ID' });
    });
  });

  describe('PUT /ca/services/:id', () => {
    it('updates name, alias, and isActive', async () => {
      const service = await createService({ name: 'Old Name', isActive: true });

      const res = await agent
        .put(apiPath(`/ca/services/${service._id}`))
        .set(authHeader(token))
        .send({ name: 'New Name', isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ name: 'New Name', isActive: false });
    });

    // Contract characterization: updateService only projects the request
    // body through an explicit allow-list (['name', 'alias', 'isActive']) -
    // any other field, including subServices, is silently dropped rather
    // than rejected or applied.
    it('silently ignores fields outside the allow-list, e.g. subServices', async () => {
      const service = await createService({ subServices: [{ name: 'Original', alias: 'original' }] });

      const res = await agent
        .put(apiPath(`/ca/services/${service._id}`))
        .set(authHeader(token))
        .send({ subServices: [{ name: 'Injected', alias: 'injected' }] });

      expect(res.status).toBe(200);
      expect(res.body.data.subServices).toHaveLength(1);
      expect(res.body.data.subServices[0].alias).toBe('original');
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
      const res = await agent
        .put(apiPath('/ca/services/665f1f77bcf86cd799439011'))
        .set(authHeader(token))
        .send({ name: 'X' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Service not found' });
    });

    it('returns 400 for a malformed id', async () => {
      const res = await agent
        .put(apiPath('/ca/services/not-a-valid-id'))
        .set(authHeader(token))
        .send({ name: 'X' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Invalid service ID' });
    });
  });
});
