// See test/modules/auth/known-issues.test.js for the full characterization:
// src/models/admin.js's schema doesn't declare resetPasswordToken /
// resetPasswordExpire, so AuthService.resetPasswordRequest's `user.save()`
// silently drops both fields (Mongoose strict-mode default). The reset flow
// is completely non-functional today - only the parts unaffected by that
// (the unknown-email and no-token-requested-yet validation branches) are
// tested here as real, currently-passing tests. The rest is below as a
// skipped aspirational spec for the real intended flow.
const { agent, apiPath } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');

async function getOtpFor(email) {
  const admin = await db.models.Admin.findOne({ email: email.toLowerCase() });
  return admin.resetPasswordToken;
}

describe('Auth - password reset flow', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('rejects a reset request for an unknown email with 400', async () => {
    const res = await agent
      .post(apiPath('/auth/reset-password-request'))
      .send({ email: 'no-such-admin@example.test' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'User not found with this email' });
  });

  it('rejects reset-password when no reset was ever requested', async () => {
    const { credentials } = await registerAdmin();

    const res = await agent
      .post(apiPath('/auth/reset-password'))
      .send({ email: credentials.email, token: '123456', newPassword: 'Whatever123!' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'No reset token found for this user' });
  });

  // Un-skip this block (unmodified) once resetPasswordToken/resetPasswordExpire
  // are added to the Admin schema - it's the real intended flow, written
  // against the code as it "should" behave, not the code as it does today.
  describe.skip('once resetPasswordToken/resetPasswordExpire exist on the Admin schema', () => {
    it('completes request -> verify -> reset, and the new password works while the old one no longer does', async () => {
      const { credentials } = await registerAdmin();

      const requestRes = await agent
        .post(apiPath('/auth/reset-password-request'))
        .send({ email: credentials.email });
      expect(requestRes.status).toBe(200);

      const otp = await getOtpFor(credentials.email);
      expect(otp).toMatch(/^\d{6}$/);

      const verifyRes = await agent
        .post(apiPath('/auth/verify-reset-token'))
        .send({ email: credentials.email, token: otp });
      expect(verifyRes.status).toBe(200);

      const newPassword = 'BrandNewPassw0rd!45';
      const resetRes = await agent
        .post(apiPath('/auth/reset-password'))
        .send({ email: credentials.email, token: otp, newPassword });
      expect(resetRes.status).toBe(200);

      const oldLogin = await agent
        .post(apiPath('/auth/login'))
        .send({ identifier: credentials.email, password: credentials.password });
      expect(oldLogin.status).toBe(401);

      const newLogin = await agent
        .post(apiPath('/auth/login'))
        .send({ identifier: credentials.email, password: newPassword });
      expect(newLogin.status).toBe(200);
    });

    it('rejects an incorrect token with 400', async () => {
      const { credentials } = await registerAdmin();
      await agent.post(apiPath('/auth/reset-password-request')).send({ email: credentials.email });

      const res = await agent
        .post(apiPath('/auth/verify-reset-token'))
        .send({ email: credentials.email, token: '000000' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Invalid reset token' });
    });

    it('rejects an expired token with 400', async () => {
      const { credentials } = await registerAdmin();
      await agent.post(apiPath('/auth/reset-password-request')).send({ email: credentials.email });
      const otp = await getOtpFor(credentials.email);

      await db.models.Admin.updateOne(
        { email: credentials.email.toLowerCase() },
        { $set: { resetPasswordExpire: new Date(Date.now() - 1000) } }
      );

      const res = await agent
        .post(apiPath('/auth/verify-reset-token'))
        .send({ email: credentials.email, token: otp });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Reset token has expired' });
    });
  });
});
