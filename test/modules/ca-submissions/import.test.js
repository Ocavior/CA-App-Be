const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createCaSubmission } = require('../../fixtures/caSubmissionFactory');

function csvBuffer(rows) {
  return Buffer.from(rows.map(r => r.join(',')).join('\n'), 'utf8');
}

describe('CA Submissions - Import (/ca/import, /ca/import/preview)', () => {
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

  describe('POST /ca/import/preview', () => {
    it('parses and forecasts insert/update counts without writing to the database', async () => {
      const csv = csvBuffer([
        ['Name', 'Mobile', 'Email', 'State', 'City'],
        ['Preview Only CA', '9990001111', 'preview.only@example.test', 'Delhi', 'New Delhi']
      ]);

      const res = await agent
        .post(apiPath('/ca/import/preview'))
        .set(authHeader(token))
        .attach('file', csv, { filename: 'preview.csv', contentType: 'text/csv' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ total: 1, inserted: 1, updated: 0, skipped: 0 });
      expect(await db.models.CaSubmission.countDocuments()).toBe(0); // no writes on preview
    });

    // issues.md #12: preview used to always report inserted:0, updated:0
    // regardless of what would actually happen. Confirm it now forecasts
    // correctly for a row that matches an existing record.
    it('#12 - forecasts an update (not insert) for a row matching an existing mobile', async () => {
      await createCaSubmission({ name: 'Existing CA', mobile: '+919990002222' });
      const csv = csvBuffer([
        ['Name', 'Mobile', 'Email'],
        ['Existing CA Updated Name', '9990002222', 'updated@example.test']
      ]);

      const res = await agent
        .post(apiPath('/ca/import/preview'))
        .set(authHeader(token))
        .attach('file', csv, { filename: 'preview.csv', contentType: 'text/csv' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ inserted: 0, updated: 1 });
    });

    it('rejects a request with no file attached', async () => {
      const res = await agent
        .post(apiPath('/ca/import/preview'))
        .set(authHeader(token))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/No file uploaded/);
    });

    it('rejects a file with an unsupported type/extension', async () => {
      const res = await agent
        .post(apiPath('/ca/import/preview'))
        .set(authHeader(token))
        .attach('file', Buffer.from('not a spreadsheet'), {
          filename: 'notes.txt',
          contentType: 'application/json'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/unsupported type/i);
    });
  });

  describe('POST /ca/import (commit)', () => {
    it('commits new rows to the database', async () => {
      const csv = csvBuffer([
        ['Name', 'Mobile', 'Email', 'State', 'City'],
        ['Committed CA', '9990003333', 'committed@example.test', 'Karnataka', 'Bengaluru']
      ]);

      const res = await agent
        .post(apiPath('/ca/import'))
        .set(authHeader(token))
        .attach('file', csv, { filename: 'import.csv', contentType: 'text/csv' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ inserted: 1, updated: 0 });

      const stored = await db.models.CaSubmission.findOne({ mobile: '+919990003333' }).lean();
      expect(stored).not.toBeNull();
      expect(stored.name).toBe('Committed CA');
    });

    // issues.md #10: manual create/update and CSV import must normalize
    // mobile numbers the same way, and match existing records on the last 10
    // digits regardless of stored format - otherwise a re-import of an
    // existing person (whose number predates normalization) creates a
    // duplicate instead of updating them.
    it('#10 - matches an existing unnormalized mobile number and updates in place (no duplicate)', async () => {
      await createCaSubmission({ name: 'Pre-existing Unnormalized', mobile: '9990004444' });
      const csv = csvBuffer([
        ['Name', 'Mobile'],
        ['Pre-existing Unnormalized', '9990004444']
      ]);

      const res = await agent
        .post(apiPath('/ca/import'))
        .set(authHeader(token))
        .attach('file', csv, { filename: 'import.csv', contentType: 'text/csv' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ inserted: 0, updated: 1 });
      expect(await db.models.CaSubmission.countDocuments({ name: 'Pre-existing Unnormalized' })).toBe(1);
    });

    // issues.md #11: two rows in the same file resolving to the same match
    // key must not silently collapse - the second is skipped and reported.
    it('#11 - a second row with the same mobile as an earlier row in the file is skipped, not silently merged', async () => {
      const csv = csvBuffer([
        ['Name', 'Mobile'],
        ['First Row Wins', '9990005555'],
        ['Second Row Same Mobile', '9990005555']
      ]);

      const res = await agent
        .post(apiPath('/ca/import'))
        .set(authHeader(token))
        .attach('file', csv, { filename: 'import.csv', contentType: 'text/csv' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ inserted: 1, skipped: 1 });
      expect(res.body.data.errors[0].error).toMatch(/Duplicate of row 2/);

      const stored = await db.models.CaSubmission.findOne({ mobile: '+919990005555' }).lean();
      expect(stored.name).toBe('First Row Wins');
    });

    it('rejects an unauthenticated request with 401', async () => {
      const csv = csvBuffer([['Name'], ['No Auth']]);
      const res = await agent
        .post(apiPath('/ca/import'))
        .attach('file', csv, { filename: 'import.csv', contentType: 'text/csv' });

      expect(res.status).toBe(401);
    });
  });
});
