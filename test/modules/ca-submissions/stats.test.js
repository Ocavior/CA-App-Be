const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createManyCaSubmissions } = require('../../fixtures/caSubmissionFactory');
const { createService } = require('../../fixtures/serviceFactory');

describe('CA Submissions - Statistics', () => {
  let token;

  beforeAll(async () => {
    await db.connect();
    ({ token } = await registerAdmin());
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.cleanDatabase(['CaSubmission', 'Service']);
  });

  describe('GET /ca/stats', () => {
    it('returns aggregate counts with the expected shape', async () => {
      await createManyCaSubmissions(3, i => ({ state: i === 0 ? 'Delhi' : 'Punjab' }));

      const res = await agent.get(apiPath('/ca/stats')).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          totalSubmissions: 3,
          byState: expect.any(Array),
          byCity: expect.any(Array),
          bySource: expect.any(Array),
          topServices: expect.any(Array),
          serviceStats: expect.objectContaining({
            averageServicesPerCA: expect.any(Number),
            maxServicesOffered: expect.any(Number),
            minServicesOffered: expect.any(Number)
          })
        })
      );
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await agent.get(apiPath('/ca/stats'));
      expect(res.status).toBe(401);
    });
  });

  describe('GET /ca/stats/services', () => {
    it('returns per-service counts and percentages', async () => {
      const service = await createService({ name: 'Income Tax', alias: 'incomeTax' });
      await createManyCaSubmissions(2, () => ({
        services: { incomeTax: { offered: true, details: 'Filing' } }
      }));
      await createManyCaSubmissions(2); // no services offered

      const res = await agent.get(apiPath('/ca/stats/services')).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.totalCAs).toBe(4);
      const incomeTaxStat = res.body.data.services.find(s => s.key === service.alias);
      expect(incomeTaxStat).toMatchObject({ key: 'incomeTax', count: 2, percentage: 50 });
    });
  });
});
