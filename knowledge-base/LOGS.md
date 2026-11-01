# Development & Change Logs (`LOGS.md`)

This file records all requests, modifications, architectural decisions, and agent operations in reverse chronological order. Whenever a change is instructed by the user, an entry is appended here on the `knowledge-base` branch.

---

## 📅 Log Entries

### [LOG-007] 2026-11-02 IST — Deployment to ca-app.ocvrs.in and CI/CD
* **Requested By**: User
* **User Instruction**:
  > *"provide the front en api point for the front end, deploy this api on this ocvrs.in with the name ca-app ... please do the deployment part and provide me the api, end point and also add ci/cd for this, so that commiting on main branch deploy the changes, you can commit the changes"*
* **Target Branches**: `feat/postgres-local-server`, committed and pushed. **Not merged to `main`.**
* **Actions Taken**:
  1. Confirmed `ocvrs.in` uses Cloudflare nameservers, so DNS is handled in Cloudflare and GoDaddy needs no change.
  2. Installed `cloudflared`. Added `ops/setup-server.sh`, `ops/auto-deploy.sh`, `ops/deploy.sh`, `ops/ci-test.sh`, and the API reference `ca-be-node/API.md`.
  3. Designed CI/CD as polling from this Mac. A GitHub Actions self-hosted runner was written first, then dropped on finding the repo is public.
  4. Limited the Azure workflow to Azure app files, so `ca-be-node` commits stop triggering Azure deploys.
  5. Updated the stale alias test to expect the intended 400. The suite is now fully green: 170 passed, 3 skipped.
  6. Re-imported data from MongoDB with a clean verification.
* **Blocked On**: The Chrome extension was not connected, so Cloudflare authorization needs the user. Installing launchd services was refused twice by the session permission policy, so `setup-server.sh` is for the user to run. **It has been syntax-checked but never run.**
* **Findings**:
  - The repo is public, so this branch must not record security details. The owner was told about the security items directly.
  - Render is still live. LOG-004 says merging to `main` redeploys it; with this code and no database it would break, so the merge waits for client cutover.
* **Update, 2026-11-02**: The user authorized Cloudflare from Chrome. Created tunnel `ca-app` and the `ca-app.ocvrs.in` DNS record. `https://ca-app.ocvrs.in/api/v1` responds over HTTPS, tested for health, public and authenticated reads, auth rejection, and CORS preflight. The API and tunnel run as plain processes until `ops/setup-server.sh` is run by the user. A real-account login, and writes through the public URL, have not been tested.
* **Update, 2026-11-02**: On the user's instruction: re-synced data from MongoDB (0 mismatches), ran `ops/setup-server.sh` (API, tunnel and auto-deploy now launchd services; API and tunnel confirmed to restart after being killed), and fast-forwarded `main` to `38aa319`. The first automatic deploy of `38aa319` passed tests (170 passed, 3 skipped) and released. The Azure workflow did not run for this commit.
* **Status**: Completed. Remaining: frontend switch, real-account login test, and the failure and rollback path of auto-deploy, which has not been exercised.

---

### [LOG-006] 2026-11-02 IST — Migrated ca-be-node from Render + MongoDB to This Mac + Local PostgreSQL
* **Requested By**: User
* **User Instruction** (credentials omitted):
  > *"currently it's deployed on the render i want to switch local server and want to use the db as the postgres and use this system as the server, provide me all the details after what is done and all, and use multiple agent for this task, and also create a separate branch which will be used as the knowledge base, which will contains all the details regarding the project, what things have been done all the logs and all stuff."*
* **Target Branches**:
  - `feat/postgres-local-server` (created from `main`): all code changes. **Uncommitted in the working tree at the time of this entry.**
  - `knowledge-base`: this entry and [`POSTGRES_MIGRATION.md`](./POSTGRES_MIGRATION.md). The existing branch was extended rather than creating a second one. Committed locally, not pushed.
* **Actions Taken**:
  1. Installed PostgreSQL 17 with Homebrew, started with `brew services`, localhost only. Created role `ca_app` and databases `ca_app` and `ca_app_test`.
  2. Profiled the source MongoDB read-only. Found it is shared with the unrelated TechHeaven e-commerce app; only the structure (field names and types) of those other collections was read, and none of their data was copied.
  3. Built the data layer in `ca-be-node/src/db/` and the schema in `db/migrations/001_init.sql`.
  4. Ran four agents with separate file ownership:
     - **Data**: `scripts/migrate-from-mongo.js`; imported 5 admins, 21 services, 147 sub-services, 2,513 CA submissions, 12 templates, with 0 mismatches on a per-field comparison.
     - **Auth/Services/Templates**: ported those models, services and auth middleware. Deleted `src/migrations/*`, `src/seed.js`, `src/seeds/seedData.js` (already broken).
     - **CA Submissions**: ported model, controller (search scoring and stats moved to SQL) and CSV import (one transaction per 200 rows, savepoint per row). Ran a read-only comparison of old code against the source DB with Mongoose auto-index and auto-create disabled.
     - **Tests**: captured the Mongo baseline, moved the harness to PostgreSQL, ran the suite and a GET-only HTTP differential on real data. Found and fixed a repeated-query-param regression in `src/db/filter.js`.
  5. Removed `mongoose` from `ca-be-node`. `mongodb` remains as a dev dependency for the importer only.
  6. Restored the `WHATSAPP_API_BASE_URL` env override that commit `cef6ad8` had temporarily commented out, in `ConversationController`, `NotificationController` and `AuthService`. Tests need it to reach the mock rather than the live WhatsApp service. `.env` sets the same URL as the fallback, so behavior is unchanged.
  7. Stopped `AuthController` and `AuthService` writing login passwords and device tokens to logs, since logs now persist on local disk. Confirmed with a canary password.
  8. Started the API on port 3000 as a plain background process. `ops/install-service.sh` (launchd) was written, but installing it was blocked by the session's permission policy, so it is left for the user to run.
* **Verification**: See [`POSTGRES_MIGRATION.md`](./POSTGRES_MIGRATION.md#verification). Final suite on the final code: 169 passed, 1 failed (stale, also fails on `main`), 3 skipped, matching the baseline test for test. A first final run showed 14 extra failures in outbound WhatsApp and email tests; the cause was wrong mock URLs passed by hand when starting the test server, and they passed with the values in `test/README.md`. A real-account login was not tested. The old Render API did not respond within 25 seconds when probed, so its current state is unknown.
* **Status**: Server running on PostgreSQL. **Cutover not complete**: Render and MongoDB are untouched and clients have not been repointed. See [Open items](./POSTGRES_MIGRATION.md#open-items-for-cutover).

---

### [LOG-005] 2026-10-19 03:45 IST — Added Verbose Diagnostic Logging for WHATSAPP_API_BASE and Device Registration
* **Requested By**: User
* **User Instruction**:
  > *"just log the WHATSAPP_API_BASE value i want to check it"*
* **Target Branches**:
  - `dev/prabhash`: Commit `d78c10c`.
  - `knowledge-base`: Log and documentation updated.
* **Actions Taken**:
  1. Added module-level startup logging in both `src/services/AuthService.js` and `ca-be-node/src/services/AuthService.js`:
     - `=== [AuthService] process.env.WHATSAPP_API_BASE_URL ===`
     - `=== [AuthService] Resolved WHATSAPP_API_BASE ===`
  2. Added runtime request and response/error logging in `registerDevice`:
     - `=== [registerDevice] Target URL ===`
     - `=== [registerDevice] Query Params ===`
     - `=== [registerDevice Response] ===`
     - `=== [registerDevice ERROR] ===` (including targetUrl, error message, HTTP status, and response details).
* **Status**: Completed (Pushed to `origin/dev/prabhash`).

---

### [LOG-004] 2026-10-19 01:55 IST — Live Render Runtime Diagnosis & dev/prabhash Remote Push
* **Requested By**: User
* **User Observation**:
  > *"i have upadted the api in the backenf but in the front end still i am getting this same error: 401 {"success":false,"message":"Failed to register device"}"*
* **Investigation & Root Cause Analysis**:
  1. Inspected live Render instance headers (`https://ca-app-be-1.onrender.com/api/v1/health-check`): response header returned `x-powered-by: Express`, proving Render deploys the standalone **`ca-be-node`** server, not root `src/`!
  2. In PR #6 (`772cd0e`), the user updated `src/services/AuthService.js`, but `ca-be-node/src/services/AuthService.js` remained untouched with the defunct Azure URL (`whatsapp-backend.happyriver...`).
  3. Tested live login against Render with Node script:
     - **Without device tokens**: HTTP 200 OK (`Login successful`, valid JWT token).
     - **With device tokens**: HTTP 401 (`Failed to register device`), confirming the issue is 100% isolated to `ca-be-node/src/services/AuthService.js`.
* **Actions Taken**:
  1. Rebased `dev/prabhash` onto latest `origin/main` (commit `dd70d9e`).
  2. Verified `ca-be-node/src/services/AuthService.js` has updated Render URL and non-blocking `try...catch` wrapper.
  3. Pushed updated branch to `origin/dev/prabhash`.
* **Deployment Paths for User**:
  - Merge `dev/prabhash` into `main` to trigger Render deployment of `ca-be-node`.
  - Alternatively, set `WHATSAPP_API_BASE_URL=https://whatsapp-backend-ln7k.onrender.com/api/whatsapp` in Render environment settings to fix immediately without rebuild.

---

### [LOG-003] 2026-10-19 01:35 IST — Fix Device Registration Timeout & Update WhatsApp Service Fallback URL
* **Requested By**: User
* **User Instruction**:
  > *"in the frontend i am getting this error message on the login api: 401 {"success":false,"message":"Failed to register device"} ... can you check the value of process.env.WHATSAPP_API_BASE_URL ... yes please update it"*
* **Target Branches**:
  - `dev/prabhash`: Code fix applied in commit `1ae25db`.
  - `knowledge-base`: Log and documentation updated.
* **Root Cause**:
  - The login API attempted to register device tokens synchronously with the external WhatsApp backend.
  - The default URL pointed to a defunct Azure Container App (`whatsapp-backend.happyriver-1999a58f.southindia.azurecontainerapps.io`) which failed DNS resolution, causing a 15-23 second delay followed by an uncaught error that aborted login with HTTP 401.
* **Actions Taken**:
  1. Updated the hardcoded fallback WhatsApp API URL from the defunct Azure host to the active Render service `https://whatsapp-backend-ln7k.onrender.com/api/whatsapp` across:
     - `src/controllers/NotificationController.js`
     - `src/controllers/ConversationController.js`
     - `ca-be-node/src/services/AuthService.js`
     - `ca-be-node/src/controllers/NotificationController.js`
     - `ca-be-node/src/controllers/ConversationController.js`
     - `ca-be-node/.env.example`
  2. Wrapped `registerDevice` in a non-blocking `try...catch` inside `AuthService.loginUser` (in both `src/` and `ca-be-node/`) so external messaging timeouts or failures never block or abort valid user authentication.
* **Status**: Completed (Commit `1ae25db` on `dev/prabhash`).

---

### [LOG-002] 2026-10-19 00:50 IST — Knowledge Base Branch Separation & Repository Structuring
* **Requested By**: User
* **User Instruction**:
  > *"all this knowledge base keep on the seprate branch, when ever i tells an changes then log all the details and update te knowledge base accordingly and keep that knowdlege data in the branch only and update the branch, and also when any changes are require in the code then do that in the dev prabhash"*
* **Target Branches**:
  - `knowledge-base`: Dedicated to all knowledge base files, documentation, task tracking, and change logs.
  - `dev/prabhash`: Dedicated strictly to application code changes and feature development.
* **Actions Taken**:
  1. Created and switched to dedicated branch `knowledge-base`.
  2. Established root directory `knowledge-base/` containing:
     - `README.md`: Branch overview and operational protocol.
     - `ARCHITECTURE.md`: Dual-runtime specifications (Azure Functions vs Node.js Express), Router pipeline, MongoDB schema, and security architecture.
     - `API_REFERENCE.md`: Complete documentation of all endpoints, parameters, and curl samples.
     - `TASKS.md`: Task tracker maintaining active, completed, and backlog tasks.
     - `LOGS.md`: This comprehensive audit and change log.
  3. Maintained the backend `src/knowledge-base/` and `ca-be-node/src/knowledge-base/` implementations on the `knowledge-base` branch.
* **Status**: Completed.

---

### [LOG-001] 2026-10-19 00:35 IST — Knowledge Base Package Implementation & Test Suite
* **Requested By**: User
* **User Instruction**:
  > *"inside it create a new package with the new package name, where it will contains all the knowledge base and all and also in that package add all your tast, and logs which are required"*
* **Target Branch**: `knowledge-base` (originally created on `dev/prabhash`)
* **Actions Taken**:
  1. Implemented modular backend package `src/knowledge-base/`:
     - **Models**: `KnowledgeBase.js` (articles), `KnowledgeTask.js` (tasks), `KnowledgeLog.js` (audit logs).
     - **Services**: `KnowledgeBaseService.js` (CRUD, slug generation, text search, categorizations), `KnowledgeTaskService.js` (task lifecycle, assignments, transitions), `KnowledgeLogService.js` (audit queries, stats).
     - **Controllers**: `KnowledgeBaseController.js`, `KnowledgeTaskController.js`, `KnowledgeLogController.js` returning `{ status, jsonBody }`.
     - **Routes**: `knowledgeBaseRoutes.js` declaring `/ca/knowledge-base`, `/ca/knowledge-base/tasks`, `/ca/knowledge-base/logs`.
     - **Tasks Worker**: `tasks/maintenanceTask.js` for automated stale document detection and review task generation.
     - **Logger Utility**: `logs/knowledgeLogger.js` for async non-blocking log ingestion.
     - **Package Exports & Docs**: `index.js` and `README.md`.
  2. Mirrored package to `ca-be-node/src/knowledge-base/` and registered in both routers (`src/routes/index.js` and `ca-be-node/src/routes/index.js`) ensuring complete runtime parity.
  3. Added comprehensive Jest test suite `test/modules/knowledge-base/knowledge-base.test.js` configured with `MongoMemoryServer` for self-contained, high-speed execution.
* **Status**: Completed.
