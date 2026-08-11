# Integration Test Suite — Execution Guide

This suite talks to a running server purely over HTTP (via Supertest bound to
a `BASE_URL` string, not an in-process app). That's what makes it
framework-agnostic: the same test files run unmodified against the current
Azure Functions host and, later, the standalone Node.js server — you only
change `BASE_URL`.

## Architecture in one paragraph

Three independent processes are involved, and all three must be running
before `npm test`: **(1)** a mock server standing in for the two real
external HTTP dependencies (WhatsApp backend, Email API), **(2)** the actual
server-under-test (Azure Functions host today, the Node server later), and
**(3)** a dedicated test MongoDB database that both the test process and the
server-under-test connect to directly. Process (2) must be started with its
env vars pointed at (1) and (3) — see the ordering below.

## One-time setup

```bash
npm install
cp .env.test.example .env.test
```

Edit `.env.test` — at minimum set `TEST_MONGODB_URI`. It's validated at
startup to contain "test" in the database name; the suite refuses to run
otherwise, on purpose (this app's real database is `ca_app_db`, and real
credentials for it were found committed to `local.settings.json` — this
guard exists so a misconfigured `.env.test` can never seed or delete
production data).

If you don't already have a MongoDB instance to point at, start a throwaway
local one:

```bash
npm run test:local-mongo
```

This prints a `TEST_MONGODB_URI` — use that same value in both `.env.test`
and the server-under-test's own config (see below). Leave it running in its
own terminal.

## Every test run, in order

**Terminal 1 — mock external services:**

```bash
npm run test:mocks
```

Starts on `http://127.0.0.1:4100` by default (`MOCK_SERVER_PORT` in
`.env.test`). Stands in for the WhatsApp backend and Email API microservices
this app calls out to — see `test/mocks/externalServicesServer.js`.

**Terminal 2 — the server under test.** Pick ONE:

<details>
<summary>Option A — Azure Functions host (today)</summary>

In `local.settings.json`, temporarily point these at your test resources
(do not use the production Mongo URI that's already in there):

```json
{
  "Values": {
    "MONGODB_URI": "<same value as TEST_MONGODB_URI>",
    "WHATSAPP_API_BASE_URL": "http://127.0.0.1:4100/api/whatsapp",
    "EMAIL_SERVICE_URL": "http://127.0.0.1:4100/email/send",
    "EMAIL_SERVICE_BASE_URL": "http://127.0.0.1:4100/email"
  }
}
```

Then:

```bash
func start
```

Listens on `http://127.0.0.1:7071` by default. Routes are under `/api/v1` in
practice — confirmed by actually running `func start` and curling both
prefixes. This is *not* what `host.json`'s `"routePrefix": ""` implies (that
should drop the default `/api` prefix entirely, leaving just `/v1`); the
function's own startup log even prints `http://localhost:7071/api/v1/{*route}`
and warns `Detected mixed function app`, which points at
`HttpTrigger1/function.json` (a legacy binding file) coexisting with the v4
code-based `app.http()` registration in `src/index.js` as the likely cause.
Worth resolving deliberately before/during the Node.js migration rather than
carried forward by accident — but until then, `API_PREFIX=/api/v1` in
`.env.test` is what actually works.

</details>

<details>
<summary>Option B — standalone Node.js server (once it exists)</summary>

Set the equivalent env vars in whatever config the Node server reads
(`.env`, etc.), then start it however that project documents. Its `BASE_URL`
here is whatever host/port it listens on (`.env.test.example` defaults to
`http://127.0.0.1:3000`).

</details>

**Terminal 3 — run the suite:**

```bash
npm test                  # uses BASE_URL from .env.test
npm run test:azure        # forces BASE_URL=http://127.0.0.1:7071
npm run test:node-server  # forces BASE_URL=http://127.0.0.1:3000
```

`globalSetup` (`test/config/globalSetup.js`) checks all three dependencies
are reachable before any test runs and fails fast with a specific message
naming whichever one isn't up.

Tests run with `--runInBand` (serially, one file at a time) deliberately —
every test file shares the same live server process and the same live test
database, so parallel workers would race on `beforeEach`
seed/clean. This isn't a per-test-isolated-process setup; it's closer to how
a human QA engineer would exercise a real running server.

## Running the parity check between both environments

```bash
npm run test:azure       > azure-results.txt
npm run test:node-server > node-results.txt
```

Diff the two. They should match test-for-test. Then walk
`test/parity/PARITY_MATRIX.md` for the framework-level checks (CORS,
multipart parsing, timeouts, etc.) that aren't naturally expressed as a
single Jest assertion.

## Directory layout

```
test/
  README.md                  - this file
  config/
    env.js                   - loads .env.test, validates TEST_MONGODB_URI
    globalSetup.js            - readiness checks (mock server, server-under-test, DB)
    globalTeardown.js
    jest.setup.js             - per-file setup (custom matchers, etc.)
  mocks/
    externalServicesServer.js - stand-in for WhatsApp backend + Email API
    startTestMongo.js         - optional local throwaway MongoDB
  helpers/
    apiClient.js              - supertest bound to BASE_URL + apiPath()/authHeader() helpers
    auth.js                   - registerAdmin() via the real /auth/register endpoint
    db.js                     - direct Mongoose connection for fixture seed/clean
    mockControl.js            - configure/inspect the mock external-services server from tests
  fixtures/
    adminFactory.js
    caSubmissionFactory.js
    serviceFactory.js
    whatsappTemplateFactory.js
  modules/
    ca-submissions/           - flagship, fully covered module (see below)
      crud.test.js
      search.test.js
      stats.test.js
      import.test.js
      validate-contacts.test.js
      known-issues.test.js    - issues.md encoded as parity/regression tests
    auth/                     - fully covered module
      register.test.js
      login.test.js
      admin-management.test.js  - create/update/delete users, /adminUsers
      password-reset.test.js    - see known-issues.test.js: currently broken
      known-issues.test.js      - see test/parity/PARITY_MATRIX.md for the summary
    services/                 - fully covered module
      crud.test.js
      toggle-active.test.js     - service + sub-service isActive toggling
      sub-services.test.js      - add/update sub-services
      known-issues.test.js
    whatsapp-templates/       - fully covered module
      crud.test.js
      known-issues.test.js      - create/update are currently broken, see below
    conversations/            - fully covered module (pure proxy, no local DB)
      proxy.test.js
      known-issues.test.js      - /history route is unreachable
    notifications/            - fully covered module
      whatsapp-messages.test.js
      email.test.js
  parity/
    PARITY_MATRIX.md          - framework-level Azure-vs-Node checklist
```

`jest.config.js` (repo root) only picks up `test/modules/**/*.test.js` and
`test/parity/**/*.test.js` — helpers and fixtures are plain modules, not
test files.

## Extending to a new module

All six functional modules this app currently has are fully covered (see
`test/parity/PARITY_MATRIX.md`). If a new module is added to the app later,
follow the same pattern:

1. New directory under `test/modules/<name>/`.
2. Reuse `test/helpers/apiClient.js` and `test/helpers/auth.js` as-is.
3. Add a fixture factory under `test/fixtures/` only if the module owns a
   collection not already covered (Admin, CaSubmission, Service, and
   WhatsappTemplate factories already exist — every Mongoose model in the
   app has one).
4. For anything that calls the WhatsApp backend or Email API, use
   `test/helpers/mockControl.js` to configure canned responses/failures and
   assert on what was actually sent — see the `routeKey` list in
   `test/mocks/externalServicesServer.js`, and extend that mock if the new
   code calls an endpoint it doesn't stand in for yet.
5. Add the module to `test/parity/PARITY_MATRIX.md`.

## CI

`.github/workflows/main_caapp.yml` already runs `npm run test --if-present`
before deploying — it was a silent no-op before this suite existed (no `test`
script, so `--if-present` skipped it). It will now actually run. Wiring up
CI to provision the three dependencies above (mock server, a test Mongo, and
a running `func start`/Node server) is a separate follow-up — this suite
assumes a developer machine or a CI job that already stands those up.

## Troubleshooting

- **`globalSetup` fails on the mock server** — start `npm run test:mocks`
  first, in its own terminal; it must already be listening before you start
  the server-under-test (which reads its URL from env vars at startup).
- **`globalSetup` fails on the server-under-test** — confirm `func start` (or
  the Node server) is actually up and check its logs for a Mongo connection
  error (most likely cause: `MONGODB_URI` on that process doesn't match
  `TEST_MONGODB_URI`, or a stale connection to the real `ca_app_db`).
- **`TEST_MONGODB_URI does not look like a test database`** — this is the
  intentional safety guard in `test/config/env.js`; point it at a database
  whose name contains "test".
- **Tests pass individually but fail together** — you likely ran without
  `--runInBand` (the `npm test` scripts already include it); shared DB state
  across parallel workers will produce flaky failures.
