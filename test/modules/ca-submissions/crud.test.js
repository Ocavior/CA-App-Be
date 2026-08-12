const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createCaSubmission, createManyCaSubmissions, buildCaSubmission } = require('../../fixtures/caSubmissionFactory');

describe('CA Submissions - CRUD', () => {
  let token;

  beforeAll(async () => {
    await db.connect();
    ({ token } = await registerAdmin());
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    // Only wipe submission data - the admin fixture above must survive so
    // `token` stays valid for the rest of this file (see helpers/db.js).
    await db.cleanDatabase(['CaSubmission']);
  });

  describe('POST /ca/submissions', () => {
    it('creates a submission and returns 201 with the saved document', async () => {
      const payload = buildCaSubmission({
        services: { incomeTax: { offered: true, details: 'Compliance' } }
      });

      const res = await agent
        .post(apiPath('/ca/submissions'))
        .set(authHeader(token))
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ success: true, message: expect.any(String) });
      expect(res.body.data).toMatchObject({ name: payload.name, mobile: payload.mobile });
      expect(res.body.data._id).toBeDefined();
      // Regression guard for issues.md #13: services is a Map field: without
      // `toObject({ flattenMaps: true })` in createCaSubmission it serializes
      // to `{}` even though the save succeeded. Confirm it's echoed as real data.
      expect(res.body.data.services).toEqual(
        expect.objectContaining({ incomeTax: expect.objectContaining({ offered: true, details: 'Compliance' }) })
      );
      expect(res.body.data.rawData).toBeUndefined();
    });

    it('normalizes a bare 10-digit mobile number to +91-prefixed form', async () => {
      const payload = buildCaSubmission({ mobile: '9876543210' });

      const res = await agent
        .post(apiPath('/ca/submissions'))
        .set(authHeader(token))
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.mobile).toBe('+919876543210');
    });

    it('rejects a payload with no name with 400 and does not create a document', async () => {
      const payload = buildCaSubmission();
      delete payload.name;

      const res = await agent
        .post(apiPath('/ca/submissions'))
        .set(authHeader(token))
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: 'Name is required to create a CA submission'
      });
      expect(await db.models.CaSubmission.countDocuments()).toBe(0);
    });

    it('rejects a whitespace-only name the same as a missing one', async () => {
      const res = await agent
        .post(apiPath('/ca/submissions'))
        .set(authHeader(token))
        .send(buildCaSubmission({ name: '   ' }));

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Name is required to create a CA submission');
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await agent.post(apiPath('/ca/submissions')).send(buildCaSubmission());

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, message: 'Access token is required' });
    });

    it('rejects a malformed/expired token with 403', async () => {
      const res = await agent
        .post(apiPath('/ca/submissions'))
        .set(authHeader('this-is-not-a-valid-jwt'))
        .send(buildCaSubmission());

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ success: false, message: 'Invalid or expired token' });
    });
  });

  describe('GET /ca/submissions/:id', () => {
    it('returns the submission when it exists', async () => {
      const doc = await createCaSubmission();

      const res = await agent
        .get(apiPath(`/ca/submissions/${doc._id}`))
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(doc._id.toString());
      expect(res.body.data.rawData).toBeUndefined();
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
      const res = await agent
        .get(apiPath('/ca/submissions/665f1f77bcf86cd799439011'))
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Submission not found' });
    });

    // Contract characterization, not a claim this is "correct": unlike
    // toggleActiveStatus and validateCaContacts (which explicitly check
    // err.name === 'CastError' and return 400), getSubmissionById has no
    // such check - an invalid ObjectId throws inside CaSubmission.findById
    // and falls through to the generic catch block, which returns 500. A
    // Node.js rewrite that "fixes" this to 400 would be an intentional
    // behavior change, not a silent regression - update this test alongside
    // that fix.
    it('returns 500 (not 400) for a malformed id - current inconsistent behavior', async () => {
      const res = await agent
        .get(apiPath('/ca/submissions/not-a-valid-object-id'))
        .set(authHeader(token));

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /ca/submissions (list)', () => {
    beforeEach(async () => {
      await createManyCaSubmissions(3, i => ({
        name: `Listed CA ${i}`,
        state: i === 0 ? 'Delhi' : 'Maharashtra',
        city: i === 0 ? 'New Delhi' : 'Mumbai'
      }));
    });

    it('returns paginated results with correct metadata', async () => {
      const res = await agent
        .get(apiPath('/ca/submissions'))
        .query({ limit: 2, page: 1 })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toMatchObject({
        currentPage: 1,
        totalCount: 3,
        totalPages: 2,
        limit: 2,
        hasNextPage: true,
        hasPrevPage: false
      });
    });

    it('filters by exact state match (anchored regex)', async () => {
      const res = await agent
        .get(apiPath('/ca/submissions'))
        .query({ state: 'Delhi' })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].state).toBe('Delhi');
    });

    it('filters by name (case-insensitive partial match)', async () => {
      const res = await agent
        .get(apiPath('/ca/submissions'))
        .query({ name: 'listed ca 1' })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Listed CA 1');
    });

    it('excludes rawData from every list item', async () => {
      const res = await agent.get(apiPath('/ca/submissions')).set(authHeader(token));
      res.body.data.forEach(item => expect(item.rawData).toBeUndefined());
    });
  });

  describe('PUT /ca/submissions/:id', () => {
    it('updates an existing submission and returns the new document', async () => {
      const doc = await createCaSubmission({ city: 'Pune' });

      const res = await agent
        .put(apiPath(`/ca/submissions/${doc._id}`))
        .set(authHeader(token))
        .send({ city: 'Mumbai' });

      expect(res.status).toBe(200);
      expect(res.body.data.city).toBe('Mumbai');

      const stored = await db.models.CaSubmission.findById(doc._id).lean();
      expect(stored.city).toBe('Mumbai');
    });

    it('normalizes mobile on update the same way as create', async () => {
      const doc = await createCaSubmission();

      const res = await agent
        .put(apiPath(`/ca/submissions/${doc._id}`))
        .set(authHeader(token))
        .send({ mobile: '9123456780' });

      expect(res.status).toBe(200);
      expect(res.body.data.mobile).toBe('+919123456780');
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
      const res = await agent
        .put(apiPath('/ca/submissions/665f1f77bcf86cd799439011'))
        .set(authHeader(token))
        .send({ city: 'Mumbai' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Submission not found' });
    });
  });

  describe('DELETE /ca/submissions/:id', () => {
    it('deletes an existing submission', async () => {
      const doc = await createCaSubmission();

      const res = await agent
        .delete(apiPath(`/ca/submissions/${doc._id}`))
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Submission deleted successfully' });
      expect(await db.models.CaSubmission.findById(doc._id)).toBeNull();
    });

    it('returns 404 when the submission does not exist', async () => {
      const res = await agent
        .delete(apiPath('/ca/submissions/665f1f77bcf86cd799439011'))
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Submission not found' });
    });
  });

  describe('DELETE /ca/submissions/bulk', () => {
    it('deletes multiple submissions and reports the count', async () => {
      const docs = await createManyCaSubmissions(3);
      const ids = docs.slice(0, 2).map(d => d._id.toString());

      const res = await agent
        .delete(apiPath('/ca/submissions/bulk'))
        .set(authHeader(token))
        .send({ ids });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, deletedCount: 2 });
      expect(await db.models.CaSubmission.countDocuments()).toBe(1);
    });

    it('rejects a missing/empty ids array with 400', async () => {
      const res = await agent
        .delete(apiPath('/ca/submissions/bulk'))
        .set(authHeader(token))
        .send({ ids: [] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Array of IDs is required' });
    });

    // Platform-boundary characterization, verified directly against a live
    // Azure Functions host (not assumed): request.json() on a genuinely
    // empty body actually THROWS on the real platform - bulkDelete has no
    // .catch() around its `(await request.json()) || {}` call, so that
    // throw propagates to bulkDelete's own try/catch and comes back as a
    // 500, not the clean 400 an empty-but-present `{}` body gets (see the
    // test above). This is why several OTHER handlers (e.g.
    // ServiceController.toggleServiceStatus) defensively wrap their own
    // request.json() call in `.catch(() => ({}))` - bulkDelete just doesn't.
    // ca-be-node's index.js adapter reproduces this exactly by letting
    // JSON.parse('') throw naturally rather than special-casing an empty
    // body to `null` - see ca-be-node/MIGRATION_NOTES.md.
    it('a request with NO body at all (not even {}) 500s - request.json() throws, uncaught', async () => {
      const res = await agent.delete(apiPath('/ca/submissions/bulk')).set(authHeader(token));

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        message: 'Failed to delete submissions',
        error: 'Unexpected end of JSON input'
      });
    });
  });

  describe('PATCH /ca/submissions/:id/active', () => {
    // Security-relevant characterization: unlike every sibling CA Submissions
    // route, this one is registered with no `middleware` array at all in
    // src/routes/caSubmissionRoutes.js, so authenticateToken never runs -
    // the endpoint is reachable with zero authentication. Confirm this is
    // intentional before the Node.js rewrite; if not, fix it there and
    // update this test together with the fix.
    it('succeeds with no Authorization header at all (no auth middleware wired up)', async () => {
      const doc = await createCaSubmission({ isActive: true });

      const res = await agent.patch(apiPath(`/ca/submissions/${doc._id}/active`)).send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('toggles isActive when no explicit value is given', async () => {
      const doc = await createCaSubmission({ isActive: true });

      const res = await agent.patch(apiPath(`/ca/submissions/${doc._id}/active`)).send({});

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.message).toBe('CA is now inactive');
    });

    it('sets isActive to an explicit value when provided', async () => {
      const doc = await createCaSubmission({ isActive: false });

      const res = await agent
        .patch(apiPath(`/ca/submissions/${doc._id}/active`))
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('returns 400 for a malformed id (this endpoint DOES special-case CastError)', async () => {
      const res = await agent.patch(apiPath('/ca/submissions/not-a-valid-id/active')).send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Invalid submission ID' });
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
      const res = await agent
        .patch(apiPath('/ca/submissions/665f1f77bcf86cd799439011/active'))
        .send({});

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'CA submission not found' });
    });
  });
});
