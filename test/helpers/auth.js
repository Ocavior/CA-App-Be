// Registers admin fixtures through the REAL /auth/register endpoint (over
// HTTP, not seeded directly into the DB) so every other module's tests
// exercise the actual auth flow and get back a byte-for-byte real token.
//
// Two schema quirks this helper deliberately works around (see
// src/models/admin.js): `phoneNumber` is `unique: true` WITHOUT `sparse:
// true`, so a second admin created without a phoneNumber would collide on
// Mongo's null-indexing and fail with E11000 - every fixture here gets a
// unique one (via test/helpers/unique.js - see that file for why a plain
// per-file counter isn't enough). `AuthService.registerUser` also does
// `email.toLowerCase()` with no null check even though email isn't in its
// own required-field list, so omitting email throws - every fixture here
// supplies one too.
const { agent, apiPath, authHeader } = require('./apiClient');
const { uniqueId, uniqueDigits } = require('./unique');

async function registerAdmin(overrides = {}) {
  const suffix = uniqueId();
  const payload = {
    username: `qa_admin_${suffix}`,
    email: `qa_admin_${suffix}@example.test`,
    password: 'Str0ngPassw0rd!23',
    phoneNumber: uniqueDigits(10),
    ...overrides
  };

  const res = await agent.post(apiPath('/auth/register')).send(payload);

  if (res.status !== 201) {
    throw new Error(`registerAdmin fixture failed (${res.status}): ${JSON.stringify(res.body)}`);
  }

  return {
    token: res.body.data.token,
    user: res.body.data.user,
    credentials: payload
  };
}

async function authHeaderFor(overrides = {}) {
  const { token } = await registerAdmin(overrides);
  return authHeader(token);
}

module.exports = { registerAdmin, authHeaderFor };
