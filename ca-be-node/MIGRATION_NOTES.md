# Migration notes

`ca-be-node` is a deliberate bug-for-bug port of the Azure Functions app in
the parent repo's `src/`, not a cleanup pass. This file catalogs every place
where "verbatim" isn't quite as simple as copy-paste — either because a real,
pre-existing bug is being knowingly preserved, or because swapping runtimes
(Azure Functions v4 → Express) would otherwise silently change behavior on
its own. Everything below is intentional. If you're here because something
looks wrong, it probably already looked wrong in the original app too -
check the referenced regression test before "fixing" it.

## Architecture

Rather than rewriting every controller to idiomatic Express `(req, res,
next)`, `src/index.js` is a thin adapter: it builds a `request`/`context`
object shaped exactly like what the original Azure Functions handlers
already expect, then calls the **unmodified, copied-verbatim** `Router`
class from `src/routes/index.js`. Every controller, service, model, and
utility file was copied byte-for-byte from the parent repo's `src/` - only
`src/index.js` (and this file) are genuinely new. This minimizes the risk of
subtly changing behavior during transcription.

## Pre-existing bugs, preserved exactly

These were all found and verified during the original app's test-suite
build (`../test/modules/**/known-issues.test.js`), and are preserved here on
purpose:

- **Password reset is non-functional.** `src/models/admin.js` never
  declares `resetPasswordToken`/`resetPasswordExpire`, so
  `AuthService.resetPasswordRequest`'s `user.save()` silently drops both
  fields (Mongoose strict-mode default) despite reporting `200` success.
  See `../test/modules/auth/known-issues.test.js`.
- **Google Sign-In only works for the first person who ever uses it.**
  `AuthService.handleGoogleCallback` creates new admins with
  `phoneNumber: ''`; `Admin.phoneNumber` is `unique: true` without
  `sparse: true`, so the second new Google user collides and gets a raw
  Mongo `E11000` surfaced as `401`. See the same file.
- **`PUT /auth/change-password` 404s.** `AuthController` never defines a
  `changePassword` method; the route resolves to `"Route not found"`.
- **Creating/updating a WhatsApp template via the API is broken.**
  `WhatsappTemplateConttroller.createTemplate`/`updateTemplate` read
  `request.body` directly instead of `await request.json()` (the pattern
  every other controller uses correctly) - `.body` is the raw, unconsumed
  stream, never the parsed payload. Create always fails validation (`500`);
  update silently no-ops with a `200` and changes nothing. See
  `../test/modules/whatsapp-templates/known-issues.test.js`.
  **This one required real work to reproduce faithfully, not just a
  verbatim copy**: the first version of `src/index.js`'s adapter set
  `request.body` to a plain Node `Buffer`. Create behaved identically either
  way (Mongoose's document hydration ignores a Buffer's indexed properties
  the same way it ignores a stream's absence of any), but update did not -
  passing a `Buffer` into `$set` throws `"Invalid atomic update value for
  $set"` (MongoDB's driver gives `Buffer`s special BSON treatment), which is
  a *different* bug (a hard `500`) than the real one (a silent no-op `200`).
  Fixed by wrapping the body bytes in a genuine `ReadableStream` for `.body`
  instead (see `bufferToReadableStream` in `src/index.js`) - a stream has no
  enumerable own properties, so it reproduces the actual silent-no-op
  behavior. The ported Router's multipart parser still gets a real `Buffer`
  via `request.rawBody`, which it already falls back to when `.body` isn't
  one (`src/routes/index.js`'s own `handleFileUploads`) - this was found by
  actually running the parity suite against a live server, not by
  inspection, which is exactly why that verification step exists.
- **`GET /conversations/:userId/history` 500s for authenticated callers.**
  `conversationRoutes.js` points it at `ConversationsController
  .getConversationHistory`, which is never defined. See
  `../test/modules/conversations/known-issues.test.js`.
- **`PATCH /ca/submissions/:id/active` has no auth middleware at all**,
  unlike every sibling route on the same resource.
- Several inconsistent status codes for conceptually identical errors
  (duplicate alias handling, malformed-ObjectId handling) across CA
  Submissions and Services - full list in `../test/parity/PARITY_MATRIX.md`.

## Behavior that changed only because the runtime changed - deliberately neutralized

- **`setupMiddleware` (helmet/cors) stays a no-op.** The original guard
  (`typeof app.use === 'function'`) was always false against the Azure
  Functions `app` object, so helmet/cors have never actually run in this
  app's history - the real CORS handling is the manual header-setting now
  ported into `src/index.js`. Express *does* have a real `.use()`, so
  `src/index.js` deliberately does **not** call `setupMiddleware(app)` -
  see the comment block in `src/middleware/index.js` itself. Calling it
  would silently start applying security headers for the first time ever,
  which is a real behavior change, not a neutral swap.
- **Request-body buffering - a near-miss, corrected after live verification.**
  `express.raw({ type: () => true })` only produces a real `Buffer` when the
  request actually carries a body - for a bodyless request (e.g. a plain
  `DELETE`), `req.body` falls back to `{}`. `src/index.js` normalizes this
  explicitly (`Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)`)
  before deriving `request.rawBody` and `request.json()`. The FIRST version
  of this adapter also special-cased an empty buffer in `request.json()` to
  return `null` instead of parsing - reasoning (wrongly) that this matched
  Azure's real behavior. Running the parity suite against a live Azure
  Functions host disproved that: `request.json()` on a genuinely empty body
  actually **throws** on the real platform (confirmed by the
  `.catch(() => ({}))` pattern several controllers already use defensively
  around their own `request.json()` calls, e.g.
  `ServiceController.toggleServiceStatus` - and directly, by observing that
  a bodyless `DELETE /ca/submissions/bulk` 500s on the real host with
  `"error":"Unexpected end of JSON input"`, not the clean `400` the `null`
  special-case would have produced, because `bulkDelete` has no such catch).
  Fixed by removing the special-case entirely - `JSON.parse('')` throws
  naturally, which reproduces the real behavior exactly. See the regression
  test in `../test/modules/ca-submissions/crud.test.js`.
- **Malformed URL handling - a real gap was fixed; a deeper one was found and
  is NOT fixable at the application-code level.** Two separate things were
  going on here, and it took live verification against both platforms to
  tell them apart:
  1. If the catch-all route were registered with a path *pattern* (e.g.
     `app.all('/api/v1/*', ...)`), Express's own route-matching would decode
     the wildcard capture to test it - throwing on a malformed segment like
     `%zz` *before* any handler runs, producing Express's default HTML error
     page. This part is real, closable, and is fixed: `src/index.js` mounts
     its handler with `app.use(handler)` (no path pattern at all), so
     Express performs zero path decoding/matching of its own - the copied
     `Router` remains the sole authority on path parsing, exactly as in the
     original app.
  2. Even with that fixed, curling the same malformed path directly at a
     live `func start` instance returns `403` (the route matched fine; a
     dummy auth token was rejected) - not the `500` the ported `Router`'s
     own `decodeURIComponent` throw would produce, and does produce on
     `ca-be-node`. The only explanation: Azure Functions' own front-end HTTP
     infrastructure normalizes something about the malformed sequence
     *before the request ever reaches app code* - there is no line of
     application code, on either platform, responsible for that
     normalization. This is a platform-boundary difference, not an
     application bug, and isn't something a Node/Express process can
     faithfully reproduce without reverse-engineering Azure's private
     front-end request normalization. Not fixed, and not fixable here -
     documented instead of papered over with a test that would just be
     pinning one platform's arbitrary behavior. (An earlier version of this
     file, and a corresponding automated test, assumed Azure would also
     500 here without actually checking - both were wrong and have been
     corrected.)
- **Requests outside `/api/v1/*` never reach app code on either platform**,
  but the two platforms' own outer 404 pages differ (Azure Functions' host
  runtime vs. Express's default 404 HTML). This is unavoidable and out of
  the app's control on both sides - nothing in this app or its test suite
  depends on that outer boundary's exact response shape.

## Operational difference worth knowing (not a code change)

`connectDB()` (`src/config/database.js`) swallows connection errors by
design ("Don't throw error to prevent function app from crashing" - a
comment carried over verbatim from the original). Under Azure Functions,
a bad cold start self-heals via instance recycling. A long-running Express
process has no such recycling: if Mongo is briefly unreachable at boot, the
server comes up "healthy" (listening) but every DB-backed route stays
broken until the process is manually restarted. Not being changed here -
just worth knowing operationally.

## Config surface

`Node` version pinned to `>=20` in `package.json` (`engines`) as a
best-effort match to the environment this was built and verified against.
If exact parity with the Azure Function App's actual configured Node
version matters, confirm and adjust.

`.env.example` includes every env var read anywhere in the ported config
files, including several (`AZURE_*`, `gcp_*`) that are vestigial in the
original app too - nothing currently reads them meaningfully. Kept for
config-surface fidelity, not because they do anything.
