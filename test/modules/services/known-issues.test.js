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

  // ca-be-node's updateService refuses any alias change outright, so a collision
  // with another service's alias can never reach the unique index.
  it('updating alias is refused because aliases are immutable after creation', async () => {
    await createService({ name: 'Income Tax', alias: 'incomeTax' });
    const other = await createService({ name: 'GST', alias: 'gst' });

    const res = await agent
      .put(apiPath(`/ca/services/${other._id}`))
      .set(authHeader(token))
      .send({ alias: 'incomeTax' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/alias cannot be changed/);
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
