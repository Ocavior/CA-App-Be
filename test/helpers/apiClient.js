// Black-box HTTP client for the API under test. Supertest accepts a base URL
// string (not just an in-process Express app), so this talks purely over the
// wire - identical code works whether BASE_URL points at the Azure Functions
// host (func start) or, tomorrow, the standalone Node server. This is what
// makes the suite framework-agnostic: nothing here imports src/index.js or
// any Azure Functions type.
const supertest = require('supertest');
const env = require('../config/env');

const agent = supertest(env.BASE_URL);

/** Prepends the API_PREFIX (default "/v1") to a route path, e.g. path('/ca/health') -> '/v1/ca/health'. */
function apiPath(routePath) {
  return `${env.API_PREFIX}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { agent, apiPath, authHeader };
