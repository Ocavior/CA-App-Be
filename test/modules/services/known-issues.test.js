// Real behaviors found while reading src/controllers/ServiceController.js and
// src/services/ServiceManagementService.js, characterized here for migration
// parity (see test/modules/ca-submissions/known-issues.test.js for the
// philosophy: these assert current behavior, not that it's correct).
const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createService } = require('../../fixtures/serviceFactory');

describe('Services - known issues', () => {
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

  // updateService's alias field has no pre-check against the existing unique
  // index the way createService's auto-generation does - it just passes
  // whatever alias the caller supplies straight to findByIdAndUpdate. A
  // collision with another service's alias surfaces as a raw, unformatted
  // MongoDB E11000 duplicate-key error via the generic 500 branch, not a
  // clean 400/409 with a friendly message like the equivalent sub-service
  // paths get.
  it('#no-precheck - updating alias to collide with another service raises a raw Mongo E11000, not a clean error', async () => {
    await createService({ name: 'Income Tax', alias: 'incomeTax' });
    const other = await createService({ name: 'GST', alias: 'gst' });

    const res = await agent
      .put(apiPath(`/ca/services/${other._id}`))
      .set(authHeader(token))
      .send({ alias: 'incomeTax' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/E11000 duplicate key error/);
  });

  // createService has no equivalent pre-check either, for the exact same
  // reason - explicit duplicate top-level aliases aren't caught with a
  // friendly message, unlike the inline-sub-service case (issues.md #9).
  it('#no-precheck - creating a service with an alias that already exists raises the same raw Mongo error', async () => {
    await createService({ name: 'Income Tax', alias: 'incomeTax' });

    const res = await agent
      .post(apiPath('/ca/services'))
      .set(authHeader(token))
      .send({ name: 'Income Tax Again', alias: 'incomeTax' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/E11000 duplicate key error/);
  });
});
