// Direct-DB Admin fixture for scenarios that need to control `role` or
// `isActive` at the database level. For the common case of "get me a
// working token", prefer test/helpers/auth.js's registerAdmin() - it goes
// through the real /auth/register endpoint instead of bypassing it.
const bcrypt = require('bcryptjs');
const db = require('../helpers/db');
const { uniqueId, uniqueDigits } = require('../helpers/unique');

async function buildAdmin(overrides = {}) {
  const suffix = uniqueId();
  const plainPassword = overrides.plainPassword || 'Str0ngPassw0rd!23';
  const hashed = await bcrypt.hash(plainPassword, 10);

  return {
    doc: {
      username: `qa_seed_admin_${suffix}`,
      email: `qa_seed_admin_${suffix}@example.test`,
      // unique-indexed on the Admin schema (no `sparse`) - must be distinct per call.
      phoneNumber: uniqueDigits(10),
      role: 'operational',
      isActive: true,
      ...overrides,
      password: hashed
    },
    plainPassword
  };
}

async function createAdmin(overrides = {}) {
  const { doc, plainPassword } = await buildAdmin(overrides);
  const admin = await db.models.Admin.create(doc);
  return { admin, plainPassword };
}

module.exports = { buildAdmin, createAdmin };
