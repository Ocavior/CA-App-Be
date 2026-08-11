const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createCaSubmission } = require('../../fixtures/caSubmissionFactory');

describe('CA Submissions - POST /ca/validate-contacts', () => {
  let token;

  beforeAll(async () => {
    await db.connect();
    ({ token } = await registerAdmin());
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.cleanDatabase(['CaSubmission']);
  });

  it('validates emails and summarizes valid/invalid/missing', async () => {
    const valid = await createCaSubmission({ email: 'valid@example.test' });
    const invalid = await createCaSubmission({ email: undefined, name: 'No proper email' });
    // Force an "invalid" shaped value directly (create() would strip a bad
    // email via the pre-save hook), so seed it past the hook with updateOne.
    await db.models.CaSubmission.updateOne({ _id: invalid._id }, { $set: { email: 'not-an-email' } });

    const res = await agent
      .post(apiPath('/ca/validate-contacts'))
      .set(authHeader(token))
      .send({ ids: [valid._id.toString(), invalid._id.toString()], validationType: 'email' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toEqual({ total: 2, valid: 1, invalid: 1, missing: 0 });
  });

  it('validates whatsapp numbers using the mobile field', async () => {
    const doc = await createCaSubmission({ mobile: '+919876543210' });

    const res = await agent
      .post(apiPath('/ca/validate-contacts'))
      .set(authHeader(token))
      .send({ ids: [doc._id.toString()], validationType: 'whatsapp' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 1, valid: 1, invalid: 0, missing: 0 });
  });

  it('silently drops malformed ids and validates the well-formed ones', async () => {
    const doc = await createCaSubmission({ email: 'valid@example.test' });

    const res = await agent
      .post(apiPath('/ca/validate-contacts'))
      .set(authHeader(token))
      .send({ ids: [doc._id.toString(), 'not-a-valid-id'], validationType: 'email' });

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(1);
  });

  it('rejects when every id is malformed', async () => {
    const res = await agent
      .post(apiPath('/ca/validate-contacts'))
      .set(authHeader(token))
      .send({ ids: ['not-a-valid-id'], validationType: 'email' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'No valid CA IDs provided' });
  });

  it('rejects a missing/empty ids array with 400', async () => {
    const res = await agent
      .post(apiPath('/ca/validate-contacts'))
      .set(authHeader(token))
      .send({ ids: [], validationType: 'email' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'ids must be a non-empty array' });
  });

  it('rejects an invalid validationType with 400', async () => {
    const doc = await createCaSubmission();

    const res = await agent
      .post(apiPath('/ca/validate-contacts'))
      .set(authHeader(token))
      .send({ ids: [doc._id.toString()], validationType: 'sms' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'validationType must be either email or whatsapp' });
  });
});
