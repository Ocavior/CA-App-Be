// Direct DB access for seeding/cleaning fixtures. This is a SEPARATE
// connection from whatever the server-under-test holds (it runs in its own
// process) - it exists purely so tests can set up and tear down state fast
// and deterministically without going through the HTTP API for every fixture.
// Reuses the app's real Mongoose schemas (src/models/*) so fixtures get the
// same validation/hooks (e.g. mobile normalization, sparse email index) real
// requests would produce.
const mongoose = require('mongoose');
const env = require('../config/env');

const Admin = require('../../src/models/admin');
const CaSubmission = require('../../src/models/caData');
const Service = require('../../src/models/service');
const WhatsappTemplate = require('../../src/models/whatsappTemplate');

let connected = false;

async function connect() {
  if (connected) return;
  await mongoose.connect(env.TEST_MONGODB_URI);
  connected = true;
}

async function disconnect() {
  if (!connected) return;
  await mongoose.connection.close();
  connected = false;
}

const MODELS = { Admin, CaSubmission, Service, WhatsappTemplate };

/**
 * Deletes all documents from the given collections (default: every
 * collection this app owns). Does not drop the database.
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
