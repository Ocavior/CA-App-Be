// The server-under-test and the mock external-services server are both
// processes this suite does not own (see test/README.md) - nothing to tear
// down here. Per-test-file DB connections are closed in each file's own
// afterAll via test/helpers/db.js.
module.exports = async function globalTeardown() {};
