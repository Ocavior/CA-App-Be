# PostgreSQL & Local Server Migration

Moves `ca-be-node` from Render + MongoDB to this Mac + local PostgreSQL. See LOG-006 in [`LOGS.md`](./LOGS.md) for the history.

**Secrets are never recorded in this branch.** They live in gitignored files on the server machine: `ca-be-node/.env`, `ca-be-node/.env.migration` and root `.env.test`.

---

## Update: public deployment

Target: `https://ca-app.ocvrs.in/api/v1`, by Cloudflare Tunnel, deployed from `main` by polling. See LOG-007 for status. Items 2 to 5 below are addressed by this work once `ops/setup-server.sh` has run. After that, production runs from `~/srv/ca-app/current`, with secrets in `~/srv/ca-app/shared/.env`.

---

## Current state

| Item | Value |
|---|---|
| Code branch | `feat/postgres-local-server`, created from `main` (see LOG-006 for commit status) |
| Runtime | Node, `ca-be-node/src/index.js`, port 3000, all interfaces |
| Base URL on this Mac | `http://127.0.0.1:3000/api/v1` |
| Database | PostgreSQL 17 (Homebrew), `127.0.0.1:5432`, database `ca_app`, role `ca_app` |
| Test database | `ca_app_test` |
| Logs | `ca-be-node/logs/server.log` (gitignored) |
| WhatsApp backend | Unchanged, still the separate `whatsapp-backend-ln7k.onrender.com` service |
| Azure app (root `src/`) | Unchanged, still MongoDB. Pushing to `main` still deploys it to Azure |

### Data imported from MongoDB

Source: the `prod` database on the `techheavendb` cluster, read-only.

| Collection | Table | Rows |
|---|---|---|
| `admins` | `admins` | 5 |
| `services` | `services` | 21 |
| `services[].subServices` | `sub_services` | 147 |
| `casubmissions` | `ca_submissions` | 2,513 |
| `whatsapptemplates` | `whatsapp_templates` | 12 |

**The source database is shared with an unrelated app.** It also holds TechHeaven e-commerce collections (`users`, `orders`, `carts`, `newproducts` and others). The importer reads only the four collections above and must stay that way. Never run Mongoose against that database: `autoIndex` could write indexes to it.

---

## Architecture

```
controllers / services          unchanged filter-building logic
        |
src/models/*                    casting, defaults, validation, hooks (formerly Mongoose schemas)
        |
src/db/model.js                 find / findOne / findById / countDocuments / insert / updateById / deleteById / deleteMany
src/db/filter.js                Mongo-style filter -> parameterized SQL (fields whitelisted, values always bound)
src/db/errors.js                CastError, ValidationError and E11000 shapes clients already see
src/db/objectId.js              24-hex id generation and validation
src/db/pool.js                  pg connection pool and transactions
        |
PostgreSQL                      db/migrations/*.sql, applied by scripts/db-migrate.js
```

### Decisions

| Decision | Why |
|---|---|
| Plain `pg`, no ORM | The repo's rule is bug-for-bug parity. Keeping the controllers' filters avoids re-transcribing them |
| Keep 24-hex ObjectId strings as primary keys | Existing URLs, frontend state and issued JWTs keep working |
| `JSON`, not `JSONB`, for `services`, `body_params`, `raw_data` | `JSONB` reorders keys, which would change API responses |
| `UNIQUE NULLS NOT DISTINCT` on `admins.phone_number` | Mongo's non-sparse unique index allows one missing value; plain `UNIQUE` allows many. Requires PostgreSQL 15+ |
| Sub-services in their own table, with `position` | Keeps the embedded array's order; `Service` docs still return them embedded |
| `COLLATE "C"`, NULLs low | Matches Mongo's sort order |
| Migrate `ca-be-node` only | It is the Render deployment (see LOG-004). Root `src/` is the Azure app |

---

## Verification

| Check | Result |
|---|---|
| Import, every field of every document compared on both sides | 0 mismatches |
| Jest suite on Mongo baseline (`main`) | 169 passed, 1 failed, 3 skipped of 173 |
| Jest suite on PostgreSQL | 169 passed, 1 failed, 3 skipped of 173; same status for every test |
| HTTP differential on real data, GET only, old vs new | 3,093 requests, 2,910 byte-identical, 183 different, 0 status differences, 0 content differences in documents returned by both |
| JS vs PostgreSQL regex engine on the app's search patterns | 1,596 comparisons, 0 mismatches |
| Live server: health, auth rejection, stats, list, search | Pass |
| Live login with a real account | **Not tested.** No real password was available; a wrong-password 401 was tested |

The one failing test (`services/known-issues`, "#no-precheck - updating alias to collide") is stale. It fails on `main` too: it expects a 500, but `ca-be-node` returns 400 because aliases are immutable.

Write routes were tested only by the Jest suite on synthetic data, not on the real data.

The differential was also what caught a regression the suite missed: repeated query params (`?name=a&name=b`) returned 200 instead of 500. Fixed in `src/db/filter.js`.

### Remaining differences

The full list is at the top of `ca-be-node/MIGRATION_NOTES.md`. The one users can see: records sharing a sort value (for example, a batch imported in the same instant) can appear in a different order or on a different page, because ties now break by `_id` rather than Mongo's natural order. Exact parity would need an insertion-sequence column and a re-import.

Known bugs from the original app are deliberately still present. See `MIGRATION_NOTES.md` and the `known-issues` tests.

---

## Open items for cutover

1. **Render and Mongo are still live.** Nothing on Render was changed. Writes made there after the import will not appear here. Before switching clients, stop writes and run `npm run db:import -- --replace`. This discards anything written to the local database since the last import.
2. **Clients still point at Render.** The frontend's API base URL must change.
3. **Not reachable from the internet.** The server is on the local network only. A frontend served over HTTPS will also be blocked from calling plain `http://` (mixed content). Remote clients need a tunnel or a reverse proxy with TLS, plus a decision on exposure.
4. **Does not survive a reboot or session end.** PostgreSQL starts at login through `brew services`. The API does not: it runs as a plain process. To make it permanent, run `ca-be-node/ops/install-service.sh`.
5. **Sleep.** The Mac must stay awake to serve requests. On power: `sudo pmset -c sleep 0`.
6. **No automatic backups.** The data now exists on one disk. See the commands below.
7. **Email is not configured.** `EMAIL_SERVICE_URL`, `EMAIL_SERVICE_BASE_URL`, `EMAIL_USER`, `EMAIL_PASSWORD` and `APP_CODE` were not supplied, so email routes will fail until they are added to `ca-be-node/.env`. Copy them from Render's settings.
8. **Review network exposure** of this machine before going live.
9. **Rotate credentials** used during the migration.
10. **Delete `ca-be-node/.env.migration`** once the final import is done.
11. **Knowledge-base backend package.** `src/knowledge-base/` on this branch is Mongoose-based. It is not on `main` and would need porting to `src/db/` before being merged into `ca-be-node`.

---

## Runbook

Run from `ca-be-node/`.

```bash
# Start the server
npm start >> logs/server.log 2>&1 &

# Make it permanent: start at login, restart on crash
ops/install-service.sh
launchctl kickstart -k gui/$(id -u)/com.ocavior.ca-app-be      # restart
launchctl bootout gui/$(id -u)/com.ocavior.ca-app-be           # stop and remove from this session

# Health
curl http://127.0.0.1:3000/api/v1/ca/health
brew services list | grep postgresql

# Schema changes: add db/migrations/NNN_name.sql, then
npm run db:migrate

# Re-import from MongoDB. DISCARDS local data
npm run db:import -- --replace

# Back up / restore. DATABASE_URL is in .env
pg_dump "$DATABASE_URL" -Fc -f ca_app_$(date +%F).dump
pg_restore --clean -d "$DATABASE_URL" ca_app_YYYY-MM-DD.dump

# Tests, from the repo root. Always use the test database and the mock server. See test/README.md
```

Never point the Jest suite at port 3000 or the `ca_app` database: it creates and deletes records through the API.
