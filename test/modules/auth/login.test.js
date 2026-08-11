const { agent, apiPath } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const mockControl = require('../../helpers/mockControl');
const { registerAdmin } = require('../../helpers/auth');

describe('Auth - POST /auth/login', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('logs in with username', async () => {
    const { credentials } = await registerAdmin();

    const res = await agent
      .post(apiPath('/auth/login'))
      .send({ identifier: credentials.username, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.username).toBe(credentials.username.toLowerCase());
  });

  it('logs in with email', async () => {
    const { credentials } = await registerAdmin();

    const res = await agent
      .post(apiPath('/auth/login'))
      .send({ identifier: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(credentials.email.toLowerCase());
  });

  it('rejects the wrong password with 401', async () => {
    const { credentials } = await registerAdmin();

    const res = await agent
      .post(apiPath('/auth/login'))
      .send({ identifier: credentials.username, password: 'WrongPassword!23' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
  });

  it('rejects an unknown identifier with 401', async () => {
    const res = await agent
      .post(apiPath('/auth/login'))
      .send({ identifier: 'no-such-user@example.test', password: 'whatever123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
  });

  // Characterization: AuthService.loginUser throws a distinct "required
  // fields" message for a missing identifier/password, but AuthController's
  // catch block always returns 401 for any error from loginUser - so this
  // validation failure surfaces as 401, not 400, unlike most other
  // validation failures in this app.
  it('rejects missing credentials with 401, not 400', async () => {
    const res = await agent.post(apiPath('/auth/login')).send({});

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Username/email and password are required' });
  });

  describe('device registration side-effect', () => {
    beforeEach(async () => {
      await mockControl.reset();
    });

    it('registers the device with the WhatsApp backend when device_id/device_token are given', async () => {
      const { credentials } = await registerAdmin();

      const res = await agent.post(apiPath('/auth/login')).send({
        identifier: credentials.username,
        password: credentials.password,
        device_id: 'device-login-1',
        device_token: 'token-login-1'
      });

      expect(res.status).toBe(200);
      const calls = await mockControl.getCalls('whatsapp:registerDevice');
      expect(calls).toHaveLength(1);
    });
  });
});
