// Direct DB access for seeding/cleaning fixtures. This is a SEPARATE
// connection from whatever the server-under-test holds (it runs in its own
// process) - it exists purely so tests can set up and tear down state fast
// and deterministically without going through the HTTP API for every fixture.
// Reuses the app's real models (ca-be-node/src/models/*) so fixtures get the
// same validation/normalization (e.g. mobile normalization) real requests
// would produce.
const env = require('../config/env');

// Must happen before the models load: the app's pool reads DATABASE_URL, and
// this is what guarantees fixtures only ever touch the guarded test database,
// whatever the surrounding shell or ca-be-node/.env says.
process.env.DATABASE_URL = env.TEST_DATABASE_URL;

const { query, closePool } = require('../../ca-be-node/src/db/pool');
const Admin = require('../../ca-be-node/src/models/admin');
const CaSubmission = require('../../ca-be-node/src/models/caData');
const Service = require('../../ca-be-node/src/models/service');
const WhatsappTemplate = require('../../ca-be-node/src/models/whatsappTemplate');

async function connect() {
  await query('SELECT 1');
}

async function disconnect() {
  await closePool();
}

const MODELS = { Admin, CaSubmission, Service, WhatsappTemplate };

/**
 * Deletes all rows from the given models' tables (default: every table this
 * app owns; sub-services go with their service via ON DELETE CASCADE).
 *
 * Pass an explicit subset - e.g. cleanDatabase(['CaSubmission']) - in a
 * per-test beforeEach when a fixture admin/token was registered once in
 * beforeAll and must survive across tests: wiping Admin would delete the
 * user behind that token, and authenticateToken's `Admin.findById(...)`
 * lookup would then 401 every subsequent "authenticated" request in the file.
 */
async function cleanDatabase(names = Object.keys(MODELS)) {
  await Promise.all(names.map(name => MODELS[name].deleteMany({})));
}

module.exports = {
  connect,
  disconnect,
  cleanDatabase,
  models: MODELS
};
