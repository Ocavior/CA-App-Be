module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: [
    '<rootDir>/test/modules/**/*.test.js',
    '<rootDir>/test/parity/**/*.test.js'
  ],
  globalSetup: '<rootDir>/test/config/globalSetup.js',
  globalTeardown: '<rootDir>/test/config/globalTeardown.js',
  setupFilesAfterEnv: ['<rootDir>/test/config/jest.setup.js'],
  testTimeout: 30000,
  // Tests share one live server-under-test process and one live test database
  // (see test/README.md) rather than an isolated instance per test file, so
  // suites must run serially — this is enforced via `--runInBand` in the npm
  // scripts, not here, to keep `jest --listTests` etc. working normally.
  verbose: true
};
