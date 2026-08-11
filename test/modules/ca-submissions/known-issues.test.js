// Encodes the findings in issues.md as tests. Two different intents here,
// clearly separated:
//
//  - "confirmed & fixed" issues get a normal regression assertion: the fix
//    is expected to hold, and a failure here is a real regression.
//
//  - "unconfirmed" issues get a CHARACTERIZATION assertion of whatever the
//    app currently does, not a claim that behavior is correct. The point of
//    this file for a migration is parity, not correctness: the Node.js
//    rewrite must reproduce today's behavior (bugs included) unless someone
//    deliberately decides to fix a bug, in which case that PR should update
//    the matching test here alongside the fix - a failing test in this file
//    means "the migration silently changed behavior", not "found a new bug".
const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createCaSubmission } = require('../../fixtures/caSubmissionFactory');

describe('CA Submissions - known issues (see issues.md)', () => {
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

  describe('unconfirmed - current behavior characterized for parity, not endorsed as correct', () => {
    // issues.md #1: sub-service filter is documented as OR ("any of"), even
    // though search intent is AND ("all of"). This asserts the CURRENT OR
    // behavior. If #1 is fixed to real AND semantics, this test's expected
    // count must drop from 3 to 1 in the same change.
    it('#1 - services filter with multiple sub-services currently matches ANY, not ALL', async () => {
      await createCaSubmission({
        name: 'Offers Compliance Only',
        services: { incomeTax: { offered: true, details: 'Compliance' } }
      });
      await createCaSubmission({
        name: 'Offers Tax Planning Only',
        services: { incomeTax: { offered: true, details: 'Tax Planning' } }
      });
      await createCaSubmission({
        name: 'Offers Both',
        services: { incomeTax: { offered: true, details: 'Compliance, Tax Planning' } }
      });

      const res = await agent
        .get(apiPath('/ca/search'))
        .query({ services: 'incomeTax:Compliance|Tax Planning' })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      // Documents the bug: an AND-correct implementation would return 1 (only
      // "Offers Both"), not 3.
      expect(res.body.data).toHaveLength(3);
    });

    // issues.md #2: /ca/search returns totalCount/totalPages as null on any
    // page past the first, unlike /ca/submissions which computes them on
    // every page.
    it('#2 - page 2 of /ca/search currently loses totalCount/totalPages', async () => {
      const { createManyCaSubmissions } = require('../../fixtures/caSubmissionFactory');
      await createManyCaSubmissions(3);

      const page1 = await agent
        .get(apiPath('/ca/search'))
        .query({ limit: 2, page: 1 })
        .set(authHeader(token));
      const page2 = await agent
        .get(apiPath('/ca/search'))
        .query({ limit: 2, page: 2 })
        .set(authHeader(token));

      expect(page1.body.pagination.totalCount).toBe(3);
      expect(page1.body.pagination.totalPages).toBe(2);

      expect(page2.body.pagination.totalCount).toBeNull();
      expect(page2.body.pagination.totalPages).toBeNull();
    });

    // issues.md #3: /ca/submissions has no sub-service filter at all - only
    // service-level `services.<alias>.offered`. A `subServices` query param
    // is silently ignored rather than rejected or applied.
    it('#3 - /ca/submissions ignores an attempted sub-service filter', async () => {
      await createCaSubmission({
        name: 'Compliance CA',
        services: { incomeTax: { offered: true, details: 'Compliance' } }
      });
      await createCaSubmission({
        name: 'Tax Planning CA',
        services: { incomeTax: { offered: true, details: 'Tax Planning' } }
      });

      const res = await agent
        .get(apiPath('/ca/submissions'))
        .query({ services: 'incomeTax', subServices: 'Compliance' })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      // Both come back - the subServices param had no effect.
      expect(res.body.data).toHaveLength(2);
    });

    // issues.md #6: same param name (`state`), different match semantics
    // depending on the endpoint - /ca/submissions anchors to an exact
    // (case-insensitive) match, /ca/search does an unanchored substring match.
    it('#6 - state filter is exact on /ca/submissions but substring on /ca/search', async () => {
      await createCaSubmission({ state: 'Delhi' });

      const listRes = await agent
        .get(apiPath('/ca/submissions'))
        .query({ state: 'Del' })
        .set(authHeader(token));
      const searchRes = await agent
        .get(apiPath('/ca/search'))
        .query({ state: 'Del' })
        .set(authHeader(token));

      expect(listRes.body.data).toHaveLength(0); // 'Del' != 'Delhi' under ^$ anchoring
      expect(searchRes.body.data).toHaveLength(1); // 'Del' matches as a substring of 'Delhi'
    });
  });

  describe('confirmed & fixed - real regression guards', () => {
    // issues.md #13
    it('#13 - a freshly created submission echoes back real services data, not {}', async () => {
      const res = await agent
        .post(apiPath('/ca/submissions'))
        .set(authHeader(token))
        .send({
          name: 'Services Echo Check',
          services: { incomeTax: { offered: true, details: 'GST Filing' } }
        });

      expect(res.status).toBe(201);
      expect(res.body.data.services.incomeTax).toMatchObject({ offered: true, details: 'GST Filing' });
    });

    // issues.md #10
    it('#10 - manual create normalizes mobile the same way CSV import does', async () => {
      const res = await agent
        .post(apiPath('/ca/submissions'))
        .set(authHeader(token))
        .send({ name: 'Normalized Mobile Check', mobile: '09876543210' });

      expect(res.status).toBe(201);
      expect(res.body.data.mobile).toBe('+919876543210');
    });
  });
});
