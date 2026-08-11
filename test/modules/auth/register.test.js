const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const mockControl = require('../../helpers/mockControl');
const { uniqueId, uniqueDigits } = require('../../helpers/unique');

function registerPayload(overrides = {}) {
  const suffix = uniqueId();
  return {
    username: `qa_reg_${suffix}`,
    email: `qa_reg_${suffix}@example.test`,
    password: 'Str0ngPassw0rd!23',
    phoneNumber: uniqueDigits(10),
    ...overrides
  };
}

describe('Auth - POST /auth/register', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('creates a user and returns a usable token', async () => {
    const payload = registerPayload();

    const res = await agent.post(apiPath('/auth/register')).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      username: payload.username.toLowerCase(),
      email: payload.email.toLowerCase(),
      phoneNumber: payload.phoneNumber
    });
    expect(res.body.data.user.password).toBeUndefined();

    // Token actually works against a protected route.
    const protectedRes = await agent
      .get(apiPath('/adminUsers'))
      .set(authHeader(res.body.data.token));
    expect(protectedRes.status).toBe(200);
  });

  // Security-relevant characterization: self-registration has no invite/approval
  // step, and defaults to the *admin* role (not a restricted one) when the
  // caller doesn't specify a role at all - unlike POST /auth/create, which
  // restricts the new user's role to an allow-list. Confirm this is
  // intentional before the Node.js rewrite.
  it('defaults role to "admin" (not a restricted role) when none is given', async () => {
    const res = await agent.post(apiPath('/auth/register')).send(registerPayload());

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('admin');
  });

  // Also unlike POST /auth/create, the role here is NOT restricted to an
  // allow-list before being written - only the Mongoose schema enum
  // (['admin', 'operational']) gates it, at the DB layer, not the service layer.
  it('honors an explicit role in the request body', async () => {
    const res = await agent
      .post(apiPath('/auth/register'))
      .send(registerPayload({ role: 'operational' }));

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('operational');
  });

  it('rejects a role outside the schema enum with 400', async () => {
    const res = await agent
      .post(apiPath('/auth/register'))
      .send(registerPayload({ role: 'superadmin' }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects a missing username with 400', async () => {
    const payload = registerPayload();
    delete payload.username;

    const res = await agent.post(apiPath('/auth/register')).send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Username and password are required' });
  });

  it('rejects a missing password with 400', async () => {
    const payload = registerPayload();
    delete payload.password;

    const res = await agent.post(apiPath('/auth/register')).send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Username and password are required' });
  });

  // Characterization: email isn't in registerUser's own required-field check
  // (only username/password are), but the very next line unconditionally
  // calls email.toLowerCase() - so a missing email still fails, just via an
  // uncaught TypeError instead of a clean validation message.
  it('rejects a missing email with 400 (via an uncaught TypeError, not a clean validation message)', async () => {
    const payload = registerPayload();
    delete payload.email;

    const res = await agent.post(apiPath('/auth/register')).send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/toLowerCase/);
  });

  it('rejects a duplicate username (case-insensitive) with 400', async () => {
    const payload = registerPayload();
    await agent.post(apiPath('/auth/register')).send(payload);

    const res = await agent
      .post(apiPath('/auth/register'))
      .send(registerPayload({ username: payload.username.toUpperCase() }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Username already taken' });
  });

  describe('device registration side-effect', () => {
    beforeEach(async () => {
      await mockControl.reset();
    });

    it('registers the device with the WhatsApp backend when device_id/device_token are given', async () => {
      const payload = registerPayload({ device_id: 'device-abc', device_token: 'token-xyz', device_name: 'Test Phone' });

      const res = await agent.post(apiPath('/auth/register')).send(payload);
      expect(res.status).toBe(201);

      const calls = await mockControl.getCalls('whatsapp:registerDevice');
      expect(calls).toHaveLength(1);
      expect(calls[0].query).toMatchObject({ device_id: 'device-abc', device_token: 'token-xyz' });
    });
  });
});
