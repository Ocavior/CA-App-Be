# Search & Filter Issues — Found During Live Testing

Tested against the real production dataset (`ca_app_db`, 1602 `CaSubmission` records,
24 seeded services) via a local host on an unused port, comparing API responses against
direct MongoDB ground-truth queries. All test data created during testing was cleaned up
afterward — no residual changes to the database.

None of these have been fixed yet. Each needs confirmation on whether it's actually a bug
(vs. intentional/acceptable) before any code changes are made.

Status legend: `[ ]` unconfirmed · `[x]` confirmed bug · `[-]` not a bug / won't fix

---

## Critical — directly affects search/filter requirements

### 1. Sub-service filter uses OR, not AND
- [ ] Confirmed?

`GET /ca/search?services=incomeTax:Compliance|Tax Planning` returns **806** results.

Ground truth (direct MongoDB count):
- CAs with **both** `Compliance` AND `Tax Planning` under Income Tax = **758**
- CAs with **either one** (OR) = **806**

The API returns the OR count, not the AND count — the opposite of "data should be shown
only when it has all the selected service and subservice."

**Root cause:** the filter still runs a regex match against the old free-text
`services.<alias>.details` field, with sub-service names joined by `|` (match-if-any). It
was never switched over to query the new structured `services.<alias>.subServices.<subAlias>: true`
map introduced in the dynamic-services rework, so this isn't just wrong logic — it's
filtering on the wrong field entirely.

Location: `searchSubmissions` in `src/controllers/CaSubmissionController.js`
("SERVICES + SUBSERVICES (FIXED)" block).

---

### 2. `/ca/search` pagination breaks on page 2+
- [ ] Confirmed?

Page 1 of a query: `{"totalCount": 827, "totalPages": 83}`
Page 2 of the *same* query: `{"totalCount": null, "totalPages": null}`

This is specific to `searchSubmissions` — `GET /ca/submissions` (`getSubmissions`)
correctly returns `totalCount`/`totalPages` on every page. Any "jump to page N" or
"showing X of Y results" UI wired to `/ca/search` loses that information past page 1.

Location: `searchSubmissions` in `src/controllers/CaSubmissionController.js` — the
`else` branches (`skip !== 0`) explicitly set `totalCount = null` instead of running
`countDocuments` alongside the page query.

---

### 3. `/ca/submissions` has no sub-service filtering at all
- [ ] Confirmed?

`GET /ca/submissions` only supports `services.<alias>.offered` (service-level, AND'd
across multiple services). There is no query param or logic for filtering by
sub-service at all on this endpoint.

If the filter UI (scenario 1/2) ends up calling `/ca/submissions` instead of
`/ca/search`, sub-service checkboxes would have nothing to hook into.

Location: `getSubmissions` in `src/controllers/CaSubmissionController.js`.

---

## Moderate — search ranking quality

### 4. An exact full-name match doesn't outrank a partial one
- [ ] Confirmed?

Searching `q=NAMAN`: the person literally named **"NAMAN"** (nothing else) ranked
**6th of 7** results, behind 5 different people whose name merely *contains* "Naman" as
one word (e.g. "NAMAN GUPTA", "Naman Kaushik", "Naman Singla", "Naman Bansal", "Naman Porwal").

Full ranked order returned:
1. NAMAN GUPTA
2. Naman Kaushik
3. Naman Singla
4. Naman Bansal
5. Naman Porwal
6. **NAMAN** (exact match)
7. VEENA MANGLA (fuzzy/character-gap match only)

**Root cause:** the relevance scorer only checks "does this field contain the query as
a complete word" (score 4) vs. "the whole field equals the query" — both "NAMAN" and
"NAMAN GUPTA" score identically (4) because the query is a complete word in both. Ties
are broken purely by submission recency, not by how fully the field matches the query.

Location: `searchSubmissions` scoring pipeline (`scoreField`, `exactWordRegex`) in
`src/controllers/CaSubmissionController.js`.


## Minor — inconsistencies

### 6. `state`/`city` filtering differs between the two list endpoints
- [ ] Confirmed?

- `GET /ca/submissions?state=Del` → **0** results (anchored exact match: `^Del$`)
- `GET /ca/search?state=Del` → **471** results (substring match, correctly finds "Delhi")
- Both return **471** when given the full exact value `state=Delhi`.

Same param name, different match semantics depending on which endpoint is called.

Location: `getSubmissions` uses `{ $regex: `^${state}$`, $options: 'i' }`;
`searchSubmissions` uses `new RegExp(escapeRegex(state), 'i')` (no anchors).

---

## Confirmed & fixed

### 9. Inline sub-service aliases could collide when creating a service
- [x] Confirmed — fixed

`POST /ca/services` lets you create a service with `subServices` inline in the same
call. If two of those sub-services had the same (or similarly-normalized) name and
neither supplied an explicit `alias`, both ended up with the identical
auto-generated alias — e.g. two sub-services both named "Compliance" would both
silently become `alias: "compliance"` on the same service. Auto-generation only
checked for collisions against the top-level service alias (against the whole DB),
never against sibling sub-services in the same request.

Reproduced before the fix, then verified after:
- Two inline sub-services named `"Compliance"` with no alias given now correctly get
  distinct aliases: `compliance` and `compliance2`.
- Two inline sub-services given the same explicit `alias` are now rejected with
  `400 Duplicate sub-service alias "..." in request` instead of being silently created.
- A sub-service with no `name` is now rejected with `400 Sub-service name is required`
  (this validation already existed on the "add sub-service to an existing service"
  endpoint, just not on the inline-create path).

Fixed in `createService`, `src/services/ServiceManagementService.js`.

---

### 10. Mobile number format mismatch turned "update" into a duplicate insert
- [x] Confirmed — fixed

`POST /ca/submissions` (manual create) didn't normalize phone numbers while CSV import
did (adds a `+91` prefix to bare 10-digit numbers via `cleanPhoneNumber`). The upsert
that decides insert-vs-update matched on `mobile` as a plain string, so a CSV row for
someone who already existed with a differently-formatted number didn't match them — it
inserted a duplicate profile instead of updating the real one. Checking the real dataset
at the time, 7 pre-existing production records had a mobile number outside the
normalized form, at risk of this on their next CSV update.

**Fix:**
- `createCaSubmission`/`updateCaSubmission` (manual paths) now normalize `mobile` through
  the same `cleanPhoneNumber` used by import (moved to a shared `src/utils/phoneUtils.js`
  so both paths use one implementation), so new inconsistencies stop being introduced.
- The insert-vs-update match query (`buildMatchQuery` in
  `src/services/CaSubmissionImportService.js`) now matches on the **last 10 digits** of
  the phone number instead of an exact string, so it finds existing records regardless of
  stored format — and self-heals them, since the matched document's `mobile` gets
  overwritten with the normalized value on update.

Verified: pre-created a record with a deliberately unnormalized `mobile: "9990001111"`
(bypassing the create endpoint, to simulate old bad data), then imported a CSV row for
the same number. Before the fix this created a duplicate; after the fix it correctly
matched and updated the existing record in place, whose `mobile` is now normalized to
`+919990001111` in the same operation.

---

### 11. Two rows in the same file sharing a match key silently collapsed, no feedback
- [x] Confirmed — fixed

If two rows in one uploaded file resolved to the same match key (mobile, or email/name
fallback), the second row silently overwrote the first within the same import run, with
nothing in the response indicating a collision happened.

**Fix:** `processExcel` now tracks which row first claims each match key
(`seenKeys` map, using the same `buildMatchQuery` key as the DB lookup). A later row
that resolves to the same key is skipped (first row wins) and reported in `errors` with
a specific reason, e.g. `"Duplicate of row 5 within this file (same mobile) - skipped so
it doesn't overwrite row 5's data"`. Applies in both preview and confirm.

Verified: two rows with the same mobile number, different names — row 2 now shows up in
`errors` with that message and is skipped; only row 1's data was written, matching what
the response reported.

---

### 12. Preview never reported an insert-vs-update breakdown
- [x] Confirmed — fixed

`POST /ca/import/preview` always returned `inserted: 0, updated: 0` regardless of what
would actually happen on commit, undermining the point of previewing before a real
import.

**Fix:** preview now runs the same read-only existing-record lookup as commit (via the
shared `buildMatchQuery`) for each row, so `inserted`/`updated` are accurate forecasts,
not always zero. The preview `message` was also updated to state the breakdown directly
(`"N would be new, M would be updated, K would be skipped"`).

Verified: a preview run with one genuinely new row and one row matching an existing
record now correctly reports `inserted: 1, updated: 1` (previously `0, 0`), matching
what the subsequent confirm actually did.

---

### 13. `POST /ca/submissions` echoed back `services: {}` even though it saved correctly
- [x] Confirmed — fixed

Found while checking whether a newly-created service/sub-service behaves like an
existing one through the whole flow. Created a new service, then created a CA
submission referencing it via `POST /ca/submissions` — the HTTP response showed
`services: {}`, which looked like the save had silently dropped the data.

Isolated the cause directly against Mongoose: the document **was** saved correctly
(reloading it via `.lean()` showed the full, correct `services` data) - this was a
response-serialization bug, not a data-loss bug. `createCaSubmission` built its response
with `doc.toObject()` on the freshly-created in-memory document; without
`flattenMaps: true`, Mongoose's default `toObject()` leaves `Map`-typed fields
(`services`, and the nested `subServices` map inside each service) as real `Map`
instances rather than plain objects. `Map` instances have no own enumerable
properties, so once the response gets `JSON.stringify`'d, they serialize to `{}`.
Every read endpoint (`getSubmissions`, `searchSubmissions`, `updateCaSubmission`, etc.)
uses `.lean()`, which returns plain objects straight from MongoDB and was never
affected - this was isolated to the one create-response path.

**Fix:** `doc.toObject({ flattenMaps: true })` in `createCaSubmission`,
`src/services/CaSubmissionImportService.js`.

Verified: re-created the same CA submission through the real endpoint after the fix -
response now correctly echoes back the full `services` object including the nested
`subServices` map. Also grepped the codebase for other `.toObject()` calls on documents
with Map-typed schema fields - none found (the `Service`/`WhatsappTemplate` models don't
use `Map` fields, so this was isolated to `CaSubmission`).

---

## Verified working — new services/sub-services behave like existing ones

Ran a new service (with sub-services) through the full flow end-to-end: created via
`POST /ca/services`, appeared immediately in `GET /ca/master-services`, attached to a
new CA submission, found correctly by `/ca/search` (text search on both service name and
sub-service text, and the `services=` filter), `GET /ca/submissions?services=`,
`GET /ca/by-service/:key`, and `GET /ca/stats/services` (with a correct count). A CSV
column header matching the new service's exact name correctly mapped to it during
import (no duplicate pending service created), and a cell value matching an existing
sub-service name correctly matched it. Toggling the service inactive removed it from
the public `master-services` list and from `stats/services`, while leaving the CA
record's own data completely untouched and still reachable via `by-service` (soft-delete
behaves as designed - hidden from curated/aggregate views, not erased). All test data
cleaned up afterward.

The one real defect found in this pass was #13 above (now fixed). Everything else
checked out - a newly-created service/sub-service is functionally indistinguishable
from one of the original 24 once created.
