// Real behaviors found while reading src/controllers/WhatsappTemplateConttroller.js
// (filename typo is in the actual source) and
// src/services/WhatsappTemplateService.js, characterized here for migration
// parity (see test/modules/ca-submissions/known-issues.test.js for the
// philosophy).
const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { createWhatsappTemplate } = require('../../fixtures/whatsappTemplateFactory');
const { uniqueId } = require('../../helpers/unique');

describe('WhatsApp Templates - known issues', () => {
  let token;

  beforeAll(async () => {
    await db.connect();
    ({ token } = await registerAdmin());
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.cleanDatabase(['WhatsappTemplate']);
  });

  // CRITICAL: every other controller in this app parses the request body via
  // `await request.json()` (the Azure Functions v4 HttpRequest API - `.body`
  // is the raw, unconsumed ReadableStream). createTemplate uses
  // `request.body` directly instead, so it never actually reads the payload
  // the client sent. Net effect: creating a template via this endpoint is
  // completely broken - it always fails Mongoose's required-field
  // validation regardless of what the client sends, because none of the
  // client's fields are ever seen.
  it('#critical - POST /whatsapp/templates ignores the real payload, always fails validation', async () => {
    const res = await agent
      .post(apiPath('/whatsapp/templates'))
      .set(authHeader(token))
      .send({ template_name: `real_payload_${uniqueId()}`, preview: 'Hello {{1}}' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/validation failed/i);

    // Confirm nothing was actually created with the name the client sent.
    const found = await db.models.WhatsappTemplate.findOne({});
    expect(found).toBeNull();
  });

  // Same root cause, worse failure mode: updateTemplate's `$set` ends up
  // empty/irrelevant (nothing on a ReadableStream matches a schema path), so
  // Mongoose has no required fields to fail on - findByIdAndUpdate just
  // returns the UNCHANGED existing document with a 200 "success". The
  // client is told the update worked; nothing changed.
  it('#critical - PUT /whatsapp/templates/:id silently no-ops: 200 success, nothing actually updated', async () => {
    const template = await createWhatsappTemplate({ template_name: `original_${uniqueId()}` });

    const res = await agent
      .put(apiPath(`/whatsapp/templates/${template._id}`))
      .set(authHeader(token))
      .send({ preview: 'A brand new preview that should have been saved' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stored = await db.models.WhatsappTemplate.findById(template._id).lean();
    expect(stored.preview).toBe(template.preview); // unchanged, despite the 200
  });

  // toggleTemplateStatus's service function accepts an explicitValue
  // parameter, but the controller never reads one from the request body and
  // never passes it through - so this endpoint can only flip the current
  // value, unlike the equivalent endpoints on CA Submissions and Services,
  // which both support `{ isActive: true }` to force a specific value.
  it('#inconsistent - toggle endpoint ignores an explicit isActive value and always just flips', async () => {
    const template = await createWhatsappTemplate({ isActive: true });

    const res = await agent
      .patch(apiPath(`/whatsapp/templates/${template._id}/toggle`))
      .set(authHeader(token))
      .send({ isActive: true }); // explicitly asking to stay/become true

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false); // flipped anyway, request body ignored
  });
});
