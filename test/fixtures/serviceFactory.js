const db = require('../helpers/db');
const { uniqueId } = require('../helpers/unique');

function buildService(overrides = {}) {
  const suffix = uniqueId();
  return {
    name: `Test Service ${suffix}`,
    alias: `testService${suffix}`,
    isActive: true,
    source: 'manual',
    subServices: [],
    ...overrides
  };
}

async function createService(overrides = {}) {
  return db.models.Service.create(buildService(overrides));
}

module.exports = { buildService, createService };
