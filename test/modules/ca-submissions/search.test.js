const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createCaSubmission, createManyCaSubmissions } = require('../../fixtures/caSubmissionFactory');

describe('CA Submissions - Search (/ca/search)', () => {
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

  it('finds a submission by a text query against name', async () => {
    await createCaSubmission({ name: 'Rajesh Kumar Sharma' });
    await createCaSubmission({ name: 'Someone Else Entirely' });

    const res = await agent
      .get(apiPath('/ca/search'))
      .query({ q: 'Rajesh' })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Rajesh Kumar Sharma');
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await agent.get(apiPath('/ca/search')).query({ q: 'anything' });
    expect(res.status).toBe(401);
  });

  it('with no query params, returns everything paginated (no filter applied)', async () => {
    await createManyCaSubmissions(3);

    const res = await agent.get(apiPath('/ca/search')).set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.totalCount).toBe(3);
  });

  it('filters on isActive', async () => {
    await createCaSubmission({ isActive: true });
    await createCaSubmission({ isActive: false });

    const res = await agent
      .get(apiPath('/ca/search'))
      .query({ isActive: 'true' })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isActive).toBe(true);
  });

  it('filters on employerAvailable=true (non-empty employer field)', async () => {
    await createCaSubmission({ employer: 'Acme Corp' });
    await createCaSubmission({ employer: '' });

    const res = await agent
      .get(apiPath('/ca/search'))
      .query({ employerAvailable: 'true' })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employer).toBe('Acme Corp');
  });
});
