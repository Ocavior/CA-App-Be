const db = require('../helpers/db');
const { uniqueId, uniqueDigits } = require('../helpers/unique');

/** Plain-object defaults matching src/models/caData.js. Pass overrides to customize any field, including `services`. */
function buildCaSubmission(overrides = {}) {
  const suffix = uniqueId();
  return {
    name: `Test CA ${suffix}`,
    mobile: `+91${uniqueDigits(10)}`,
    email: `ca_${suffix}@example.test`,
    state: 'Delhi',
    city: 'New Delhi',
    source: 'manual',
    isActive: true,
    services: {},
    ...overrides
  };
}

/** Inserts a CaSubmission directly (bypassing the API) via the real Mongoose model/schema. */
async function createCaSubmission(overrides = {}) {
  return db.models.CaSubmission.create(buildCaSubmission(overrides));
}

async function createManyCaSubmissions(count, overridesFn = () => ({})) {
  const docs = [];
  for (let i = 0; i < count; i += 1) {
    docs.push(buildCaSubmission(overridesFn(i)));
  }
  return db.models.CaSubmission.insertMany(docs);
}

module.exports = { buildCaSubmission, createCaSubmission, createManyCaSubmissions };
