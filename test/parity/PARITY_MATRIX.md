# Parity Verification Matrix — Azure Functions vs. Node.js server

Purpose: this suite is designed to run, unmodified, against two different
processes serving the same routes — the current Azure Functions host
(`func start`) and the future standalone Node.js server. Passing on both is
the actual migration acceptance test. This document is the checklist for
verifying parity on anything the automated suite can't assert generically.

## How to use this matrix

1. Run the full suite against Azure Functions: `npm run test:azure`. Save the output.
2. Run the full suite against the Node.js server: `npm run test:node-server`. Save the output.
3. Both runs must have identical pass/fail results, test-by-test. Any
   divergence is a parity bug in the rewrite (or the test itself is
   under-specified — tighten it, don't skip it).
4. Walk this checklist for the things Jest assertions don't cover well:
   framework-level behavior, not endpoint business logic (that's what
   `test/modules/**` already covers per-route).

## Framework-level behavior checklist

| # | Behavior | How to check | Azure Functions | Node server | Notes |
|---|----------|--------------|:---:|:---:|---|
| 1 | Route prefix is identical | Hit `GET /api/v1/ca/health` on both | ☐ | ☑ (Azure, confirmed) | Confirmed by actually running `func start`: despite `host.json` setting `routePrefix: ""` (which should drop Azure's default `/api` prefix, leaving just `/v1`), the function only responds under `/api/v1/...` — `/v1/...` 404s. The startup log's `Detected mixed function app` warning points at `HttpTrigger1/function.json` (legacy binding file) coexisting with the v4 code-based `app.http()` registration as the likely cause. Decide deliberately whether the Node server should replicate `/api/v1` or whether this gets fixed as part of the migration — don't let it carry forward by accident. |
| 2 | Trailing-slash handling | `GET /v1/ca/submissions/` (trailing slash) vs without | ☐ | ☐ | `Router.normalizePath` strips trailing slashes server-side today; confirm the Node server does the same or a reverse proxy does it consistently. |
| 3 | Unknown route → 404 shape | `GET /v1/does-not-exist` | ☐ | ☐ | Today: `{status:404, jsonBody:{success:false, message:'Route not found'}}`. |
| 4 | CORS preflight (`OPTIONS`) | `OPTIONS /v1/ca/submissions` with `Origin` header | ☐ | ☐ | Handled specially in `src/index.js`, not by the `cors` package (that middleware never actually runs — see `src/middleware/index.js`). Confirm headers: `Access-Control-Allow-Origin`, `-Methods`, `-Headers`, `-Max-Age`. |
| 5 | CORS headers on every response | Any successful request | ☐ | ☐ | Currently appended manually per-response in `src/index.js`, not via `helmet`/`cors` middleware. |
| 6 | `Content-Type` on JSON responses | Any endpoint | ☐ | ☐ | Should be `application/json; charset=utf-8` (or equivalent) on both. |
| 7 | 500 error body shape for unhandled exceptions | Force an unexpected error (e.g. malformed JSON body) | ☐ | ☐ | Azure Functions' top-level handler returns `{success:false, error:'Internal server error', message: <detail in dev, generic in prod>}` gated on `NODE_ENV`. |
| 8 | Multipart file upload parsing | `POST /v1/ca/import` with a `.csv` attachment | ☐ | ☐ | Today parsed by a **hand-rolled** multipart parser in `src/routes/index.js` (not `busboy`/`multer`, despite `busboy` being a dependency). This is the highest-risk piece to silently regress in a rewrite — boundary parsing, field-vs-file detection, and the 10MB cap are all custom logic. |
| 9 | Request timeout ceiling | Long-running request (e.g. large bulk import) | ☐ | ☐ | `host.json` sets `functionTimeout: 00:05:00` (5 min) for Azure Functions. The Node server needs an equivalent explicit timeout or it may behave differently (hang vs. 504). |
| 10 | JWT verification failure modes | No token / malformed token / expired token / token for a deleted user | ☐ | ☐ | See `test/modules/ca-submissions/crud.test.js` for the 401 vs 403 distinction this app makes; confirm both processes preserve it. |
| 11 | Environment variable loading | Confirm `WHATSAPP_API_BASE_URL`, `EMAIL_SERVICE_URL`, `EMAIL_SERVICE_BASE_URL`, `MONGODB_URI`, `JWT_SECRET` all resolve the same way | ☐ | ☐ | Azure Functions reads `local.settings.json` → `process.env`; the Node server will read `.env` directly. Confirm no var is silently `undefined` on one side. |

## Endpoint-level parity (generated from the automated suite)

Every file under `test/modules/**/*.test.js` is designed to run against
either `BASE_URL` unmodified. Treat the two runs' pass/fail matrices as the
authoritative per-endpoint parity record — don't hand-duplicate that here.
All six functional modules identified in the app now have a full
`test/modules/<name>/` suite:

- **CA Submissions** - `/ca/submissions`, `/ca/search`, `/ca/stats`,
  `/ca/import`, `/ca/validate-contacts`
- **Auth/Admin** - `/auth/register`, `/auth/login`, `/auth/create`,
  `/auth/delete-user`, `DELETE /auth`, `/auth/update-user`, `/adminUsers`,
  `/auth/reset-password*`, `/auth/verify-reset-token`,
  `/auth/google/callback`, `/auth/social/google`
- **Services** - `/ca/services`, `/ca/services/:id`,
  `/ca/services/:id/active`, `/ca/services/:id/sub-services*`
- **WhatsApp Templates** - `/whatsapp/templates*`
- **Conversations** - `/conversations*` (a pure proxy to the WhatsApp
  backend - see `test/helpers/mockControl.js`)
- **Notifications** - `/messages/*`, `/notifications/*`, `/emailLogs`

That's every route this app registers except the CSV-adjacent
`GET /ca/master-services` (indirectly exercised inside
`test/modules/services/toggle-active.test.js`) and the plain
`GET /health-check`. Run `npm test` for the full picture; use this matrix
for the framework-level (non-endpoint-specific) checks below.

## Known pre-existing behavior that must NOT be "fixed" during migration

These are current, real behaviors of the Azure Functions implementation.
Reproducing them exactly in the Node.js server (bugs included) is the
correct migration outcome — fixing them is a separate, deliberate decision
with its own PR and its own updated test expectations. See
`test/modules/ca-submissions/known-issues.test.js` for the automated version
of these:

- `issues.md` #1 — `/ca/search` sub-service filter matches ANY listed
  sub-service, not ALL.
- `issues.md` #2 — `/ca/search` returns `totalCount`/`totalPages: null` on
  page 2+.
- `issues.md` #3 — `/ca/submissions` has no sub-service filter at all.
- `issues.md` #6 — `state`/`city` filters are exact-match on
  `/ca/submissions` but substring-match on `/ca/search`.
- `PATCH /ca/submissions/:id/active` has no authentication middleware wired
  up at all (see `src/routes/caSubmissionRoutes.js`), unlike every sibling
  route on the same resource.
- `GET /ca/submissions/:id` and `PUT /ca/submissions/:id` return `500` for a
  malformed Mongo ObjectId, while `PATCH .../active` and
  `POST /ca/validate-contacts` explicitly special-case that into `400`.
- `PUT /auth/change-password` is registered but `AuthController` never
  defines a `changePassword` method - the route resolves to a `404 "Route
  not found"`, not a 500 or any password-specific error. See
  `test/modules/auth/known-issues.test.js`.
- **Password reset is completely non-functional.** `src/models/admin.js`'s
  schema never declares `resetPasswordToken`/`resetPasswordExpire`, so
  `AuthService.resetPasswordRequest`'s `user.save()` silently drops both
  fields (Mongoose strict-mode default) even though it reports `200`
  success. Every subsequent verify/reset attempt fails with `"No reset
  token found for this user"`, regardless of the token supplied. Higher
  severity than the search/import issues above - this isn't an edge case,
  the feature does not work at all today. See
  `test/modules/auth/known-issues.test.js` and
  `test/modules/auth/password-reset.test.js` (which includes a skipped
  aspirational spec for the real intended flow, ready to un-skip once the
  schema is fixed).
- **Google Sign-In only works for the first person who ever uses it.**
  `AuthService.handleGoogleCallback` creates a new Admin with
  `phoneNumber: ''` for any Google profile that doesn't carry one (which is
  all of them - a Google profile has no phone number field). Since
  `Admin.phoneNumber` is `unique: true` without `sparse: true`, the second
  genuinely-new Google sign-in ever collides with the first one's empty
  string and fails with a raw Mongo `E11000` error surfaced as a `401`.
  Reproduced against a clean database, not a test-ordering artifact - see
  `test/modules/auth/known-issues.test.js`.
- Google OAuth sign-in (`/auth/google/callback`, `/auth/social/google`) does
  not verify the Google credential server-side at all (no
  `google-auth-library` or equivalent) - it trusts `profile.email` from the
  request body outright. Anyone who can call this endpoint can log in, or
  silently provision a new admin account, as any email address just by
  claiming it.
- Self-registration (`POST /auth/register`) defaults new accounts to the
  **admin** role (not a restricted one) when no role is specified, and
  accepts any caller-supplied role without an allow-list check - unlike
  `POST /auth/create`, which restricts the new user's role explicitly.
- A failed WhatsApp device-registration call during `POST /auth/register` or
  `POST /auth/login` (`device_id`/`device_token` provided) fails the whole
  response, but the Admin account was already committed to the database
  moments earlier - there's no rollback and no partial-failure indication in
  the response.
- `POST /ca/services/:id/sub-services` returns `409` for a sub-service alias
  that collides with an existing sibling, but `createService`'s inline
  sub-services (issues.md #9) and top-level service `alias` collisions (both
  create and update) return `400` or an unformatted `500` instead - the same
  conceptual "duplicate alias" error gets three different treatments
  depending on which code path it's caught through. See
  `test/modules/services/known-issues.test.js`.
- `PUT /ca/services/:id` and `POST /ca/services` have no pre-check against
  the `alias` unique index the way sub-service creation does - a collision
  surfaces as a raw, unformatted MongoDB `E11000` error via a generic `500`,
  not a clean `400`/`409`.
- `PATCH /ca/services/:id/sub-services/:subServiceId/active` (and the
  sibling `PUT .../sub-services/:subServiceId`) return `404 "Sub-service not
  found"` for a malformed (non-ObjectId) `subServiceId`, not `400` -
  Mongoose's `DocumentArray.id()` just fails to match rather than throwing a
  `CastError` the way top-level `findById` does elsewhere in this app.
- **CRITICAL - creating/updating a WhatsApp template via the API is
  completely broken.** `WhatsappTemplateConttroller.createTemplate` and
  `updateTemplate` read `request.body` directly instead of
  `await request.json()` (the correct Azure Functions v4 pattern every other
  controller uses) - `.body` is the raw, unconsumed `ReadableStream`, not a
  parsed object. Create always fails Mongoose's required-field validation
  (`500`); update silently no-ops with a `200 "success"` and changes nothing.
  See `test/modules/whatsapp-templates/known-issues.test.js`.
- `PATCH /whatsapp/templates/:id/toggle` ignores an explicit `{isActive:
  true/false}` in the request body and always just flips the current value -
  unlike the equivalent endpoints on CA Submissions and Services, both of
  which support forcing a specific value.
- **`GET /conversations/:userId/history` is unreachable when authenticated.**
  `src/routes/conversationRoutes.js` points it at
  `ConversationsController.getConversationHistory`, which
  `src/controllers/ConversationController.js` never defines. Because this
  route has `[authenticateToken]` middleware in front of it, the registered
  handler is an array (`[authenticateToken, undefined]`), not a single
  `undefined` reference - so a valid token passes auth and then the router
  literally calls `undefined(...)`, producing a `500 "Internal server
  error"`. This is a different failure mode than the structurally similar
  `PUT /auth/change-password` bug (which has no middleware and 404s
  instead) - see both known-issues files for the distinction.
