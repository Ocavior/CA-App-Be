// Real behaviors found while reading src/controllers/AuthController.js and
// src/services/AuthService.js, characterized here for migration parity (see
// test/modules/ca-submissions/known-issues.test.js for the philosophy: these
// assert what the app currently does, not that it's correct - a deliberate
// fix should update the matching test in the same change).
const { agent, apiPath } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const mockControl = require('../../helpers/mockControl');
const { registerAdmin } = require('../../helpers/auth');
const { uniqueId, uniqueDigits } = require('../../helpers/unique');

describe('Auth - known issues', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  // Higher severity than anything in issues.md: this is a completely
  // non-functional feature, not an edge-case bug. src/models/admin.js's
  // schema never declares resetPasswordToken or resetPasswordExpire.
  // AuthService.resetPasswordRequest sets both on the in-memory document and
  // calls user.save() - but Mongoose's default strict mode silently drops
  // any field not declared in the schema, so neither value is ever actually
  // persisted. The client still gets a plain 200 "OTP sent" response, with
  // no indication anything went wrong. See
  // test/modules/auth/password-reset.test.js for the full picture, including
  // a skipped spec for the real intended flow to un-skip once this is fixed.
  it('#no-schema-field - password reset silently never persists the OTP, so verification always fails afterward', async () => {
    const { credentials } = await registerAdmin();

    const requestRes = await agent
      .post(apiPath('/auth/reset-password-request'))
      .send({ email: credentials.email });
    expect(requestRes.status).toBe(200); // reports success...

    const stored = await db.models.Admin.findOne({ email: credentials.email.toLowerCase() }).lean();
    expect(stored.resetPasswordToken).toBeUndefined(); // ...but nothing was actually saved

    const verifyRes = await agent
      .post(apiPath('/auth/verify-reset-token'))
      .send({ email: credentials.email, token: '000000' });
    expect(verifyRes.status).toBe(400);
    expect(verifyRes.body).toEqual({ success: false, message: 'No reset token found for this user' });
  });

  // src/routes/adminAuth.js registers PUT /auth/change-password pointing at
  // `authController.changePassword` - but AuthController never defines that
  // method, so the handler reference is `undefined`. Router.addRoute() still
  // stores the route (the key exists in its Map), but Router.handle()'s
  // `if (!handler) return 404` check treats an undefined handler exactly
  // like a route that was never registered at all. Net effect: this endpoint
  // is unreachable and returns a generic "Route not found", not a 500 crash
  // and not any password-specific error - which makes the gap easy to miss
  // in manual testing (it doesn't look broken, it looks nonexistent).
  it('PUT /auth/change-password returns 404 "Route not found" - the handler is undefined, not implemented', async () => {
    const { token } = await registerAdmin();

    const res = await agent
      .put(apiPath('/auth/change-password'))
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'x', newPassword: 'y' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Route not found' });
  });

  // Security-relevant characterization, not a claim this is safe: there is
  // no `google-auth-library` (or any) dependency verifying the Google
  // credential server-side. handleGoogleCallback only checks that
  // `profile.email` is present in the REQUEST BODY and trusts it outright -
  // anyone who can call this endpoint can log in (or silently provision a
  // brand-new admin account) as any email address just by claiming it.
  it('#security - logs in as any claimed email with zero credential verification', async () => {
    await db.models.Admin.deleteMany({ phoneNumber: '' }); // see the next test - avoid tripping it here
    const claimedEmail = `claimed_${uniqueId()}@example.test`;

    const res = await agent
      .post(apiPath('/auth/google/callback'))
      .send({ profile: { email: claimedEmail } });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(claimedEmail.toLowerCase());
    expect(res.body.data.token).toEqual(expect.any(String));

    // It really did create a real, usable admin account for that claimed identity.
    const created = await db.models.Admin.findOne({ email: claimedEmail.toLowerCase() });
    expect(created).not.toBeNull();
    expect(created.role).toBe('operational');
  });

  // CRITICAL - reproduced against a clean DB, not a test-ordering artifact:
  // handleGoogleCallback creates a brand-new Admin with `phoneNumber: ''`
  // when the Google profile carries no phone number (there's no field for
  // one in a Google profile payload at all). Admin.phoneNumber is
  // `unique: true` with no `sparse: true`, so the FIRST person ever to sign
  // in via Google succeeds - but every subsequent genuinely-new Google user
  // collides with that same empty string and gets a raw Mongo E11000 error
  // surfaced as a 401. In practice: Google Sign-In only works for the first
  // person to ever use it; everyone after that is permanently locked out of
  // creating an account this way until an operator manually fixes the data.
  it('#critical - a second new Google user can never sign up: E11000 on phoneNumber ""', async () => {
    await db.models.Admin.deleteMany({ phoneNumber: '' }); // guarantee a clean slate for this scenario

    const first = await agent
      .post(apiPath('/auth/google/callback'))
      .send({ profile: { email: `google_first_${uniqueId()}@example.test` } });
    expect(first.status).toBe(200);

    const second = await agent
      .post(apiPath('/auth/google/callback'))
      .send({ profile: { email: `google_second_${uniqueId()}@example.test` } });

    expect(second.status).toBe(401);
    expect(second.body.success).toBe(false);
    expect(second.body.message).toMatch(/E11000 duplicate key error/);
    expect(second.body.message).toMatch(/phoneNumber/);
  });

  it('rejects a callback with no profile/email with 401', async () => {
    const res = await agent.post(apiPath('/auth/google/callback')).send({});

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid Google profile data' });
  });

  // registerUser calls User.create(...) BEFORE the device-registration
  // side-effect, and does not wrap that side-effect in its own try/catch -
  // so if the external WhatsApp "register device" call fails, the whole
  // request reports failure to the client even though the admin account was
  // already committed to the database a moment earlier. A Node.js rewrite
  // that "fixes" this (e.g. by not letting a device-registration failure
  // fail the whole signup) is a deliberate, separate decision - update this
  // test alongside that fix, don't let it drift silently.
  describe('device registration failure during register', () => {
    beforeEach(async () => {
      await mockControl.reset();
    });

    it('#no-rollback - a failed device registration fails the response, but the account is still created', async () => {
      await mockControl.configure('whatsapp:registerDevice', 502, { message: 'Simulated WhatsApp outage' });

      const suffix = uniqueId();
      const payload = {
        username: `qa_partial_${suffix}`,
        email: `qa_partial_${suffix}@example.test`,
        password: 'Str0ngPassw0rd!23',
        phoneNumber: uniqueDigits(10),
        device_id: 'device-fail-1',
        device_token: 'token-fail-1'
      };

      const res = await agent.post(apiPath('/auth/register')).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const created = await db.models.Admin.findOne({ username: payload.username.toLowerCase() });
      expect(created).not.toBeNull(); // account exists despite the 400 the client saw
    });
  });
});
