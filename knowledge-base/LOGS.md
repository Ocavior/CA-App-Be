# Development & Change Logs (`LOGS.md`)

This file records all requests, modifications, architectural decisions, and agent operations in reverse chronological order. Whenever a change is instructed by the user, an entry is appended here on the `knowledge-base` branch.

---

## 📅 Log Entries

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
