// Convenience script: spins up a REAL local mongod (via mongodb-memory-server)
// on a fixed port so the suite can run without Docker or a hand-installed
// MongoDB. Not used by the test process itself — this exists purely so both
// the test process (via TEST_MONGODB_URI) and the server-under-test (via its
// own MONGODB_URI) can point at the SAME database, which a per-test-file
// in-process memory server can't provide (see test/README.md).
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const port = parseInt(process.env.TEST_MONGO_PORT || '27117', 10);
  const dbName = 'ca_app_test';

  const mongod = await MongoMemoryServer.create({
    instance: { port, dbName }
  });
  const uri = mongod.getUri(dbName);

  console.log('Local test MongoDB is running.');
  console.log(`  TEST_MONGODB_URI=${uri}`);
  console.log('Use this same value for TEST_MONGODB_URI (.env.test) AND MONGODB_URI on the');
  console.log('server-under-test (local.settings.json for func, or .env for the Node server).');
  console.log('Leave this running; press Ctrl+C to stop it.');

  const shutdown = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Failed to start local test MongoDB:', err);
  process.exit(1);
});
