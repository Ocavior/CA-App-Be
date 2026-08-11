const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');
const { uniqueId, uniqueDigits } = require('../../helpers/unique');

describe('Auth - admin user management', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('POST /auth/create', () => {
    it('creates a new user when called by an admin', async () => {
      const { token } = await registerAdmin({ role: 'admin' });
      const suffix = uniqueId();

      const res = await agent
        .post(apiPath('/auth/create'))
        .set(authHeader(token))
        .query({ role: 'operational' })
        .send({
          username: `qa_created_${suffix}`,
          email: `qa_created_${suffix}@example.test`,
          password: 'Str0ngPassw0rd!23',
          phoneNumber: uniqueDigits(10)
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('operational');
    });

    it('rejects a non-admin caller with 403', async () => {
      const { token } = await registerAdmin({ role: 'operational' });

      const res = await agent
        .post(apiPath('/auth/create'))
        .set(authHeader(token))
        .send({
          username: `qa_denied_${uniqueId()}`,
          email: `qa_denied_${uniqueId()}@example.test`,
          password: 'Str0ngPassw0rd!23',
          phoneNumber: uniqueDigits(10)
        });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ success: false, message: 'Only admins can create users' });
    });

    it('rejects an unauthenticated caller with 401', async () => {
      const res = await agent.post(apiPath('/auth/create')).send({});
      expect(res.status).toBe(401);
    });

    it('rejects a duplicate email with 400', async () => {
      const { token } = await registerAdmin({ role: 'admin' });
      const { credentials: existing } = await registerAdmin();

      const res = await agent
        .post(apiPath('/auth/create'))
        .set(authHeader(token))
        .send({
          username: `qa_dup_${uniqueId()}`,
          email: existing.email,
          password: 'Str0ngPassw0rd!23',
          phoneNumber: uniqueDigits(10)
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'User already exists with this email' });
    });
  });

  describe('DELETE /auth (self-delete)', () => {
    it('deletes the caller\'s own account, invalidating their token', async () => {
      const { token } = await registerAdmin();

      const deleteRes = await agent.delete(apiPath('/auth')).set(authHeader(token));
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toEqual({ success: true, message: 'User account deleted successfully' });

      // Same (structurally valid, well-signed) token, now orphaned - the
      // account behind it no longer exists.
      const reuseRes = await agent.get(apiPath('/adminUsers')).set(authHeader(token));
      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body).toEqual({ success: false, message: 'No Account Found.' });
    });
  });

  describe('DELETE /auth/delete-user', () => {
    it('lets an admin delete another user', async () => {
      const { token } = await registerAdmin({ role: 'admin' });
      const { user: target } = await registerAdmin();

      const res = await agent
        .delete(apiPath('/auth/delete-user'))
        .set(authHeader(token))
        .send({ targetUserId: target._id });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'User deleted successfully' });
      expect(await db.models.Admin.findById(target._id)).toBeNull();
    });

    it('blocks deleting yourself through this endpoint', async () => {
      const { token, user } = await registerAdmin({ role: 'admin' });

      const res = await agent
        .delete(apiPath('/auth/delete-user'))
        .set(authHeader(token))
        .send({ targetUserId: user._id });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Use /auth endpoint to delete your own account' });
    });

    it('rejects a non-admin caller with 403', async () => {
      const { token } = await registerAdmin({ role: 'operational' });
      const { user: target } = await registerAdmin();

      const res = await agent
        .delete(apiPath('/auth/delete-user'))
        .set(authHeader(token))
        .send({ targetUserId: target._id });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ success: false, message: 'Only admins can delete users' });
    });
  });

  describe('PUT /auth/update-user', () => {
    it('lets an admin update another user', async () => {
      const { token } = await registerAdmin({ role: 'admin' });
      const { user: target } = await registerAdmin();

      const res = await agent
        .put(apiPath('/auth/update-user'))
        .set(authHeader(token))
        .send({ targetUserId: target._id, role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('admin');
    });

    it('rejects a duplicate username with 400', async () => {
      const { token } = await registerAdmin({ role: 'admin' });
      const { credentials: other } = await registerAdmin();
      const { user: target } = await registerAdmin();

      const res = await agent
        .put(apiPath('/auth/update-user'))
        .set(authHeader(token))
        .send({ targetUserId: target._id, username: other.username });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Username already taken' });
    });

    it('rejects a non-admin caller with 403', async () => {
      const { token } = await registerAdmin({ role: 'operational' });
      const { user: target } = await registerAdmin();

      const res = await agent
        .put(apiPath('/auth/update-user'))
        .set(authHeader(token))
        .send({ targetUserId: target._id, role: 'admin' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /adminUsers', () => {
    it('returns users and role counts', async () => {
      const { token } = await registerAdmin({ role: 'admin' });
      await registerAdmin({ role: 'operational' });

      const res = await agent.get(apiPath('/adminUsers')).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.users).toEqual(expect.any(Array));
      expect(res.body.data.counts).toEqual(
        expect.objectContaining({ admin: expect.any(Number), operational: expect.any(Number) })
      );
      // Passwords must never leave this endpoint.
      res.body.data.users.forEach(u => expect(u.password).toBeUndefined());
    });

    it('filters by role', async () => {
      const { token } = await registerAdmin({ role: 'admin' });
      await registerAdmin({ role: 'operational' });

      const res = await agent
        .get(apiPath('/adminUsers'))
        .query({ role: 'operational' })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      res.body.data.users.forEach(u => expect(u.role).toBe('operational'));
    });

    it('rejects an invalid role filter with 400', async () => {
      const { token } = await registerAdmin({ role: 'admin' });

      const res = await agent
        .get(apiPath('/adminUsers'))
        .query({ role: 'superadmin' })
        .set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Invalid role provided' });
    });
  });
});
