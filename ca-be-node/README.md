# ca-be-node

Standalone Node.js/Express port of the `CA-App-Be` Azure Function app, backed by
PostgreSQL. Fully independent copy — no shared code or imports with the parent
repo's `src/` (which is still the Azure Functions + MongoDB version).
See [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for what was deliberately
preserved as-is (including known bugs) versus what changed because of the
runtime and database swaps.

## Run it

Requires PostgreSQL 15+ (`UNIQUE NULLS NOT DISTINCT`).

```bash
brew install postgresql@17 && brew services start postgresql@17
npm install
cp .env.example .env    # then fill in DATABASE_URL, JWT_SECRET, etc.
npm run db:migrate      # applies db/migrations/*.sql
npm start               # or `npm run dev` for nodemon
```

Listens on `PORT` (default `3000`). Routes are served under `/api/v1/...`,
matching the real prefix the original Azure Functions host serves today
(confirmed by running it directly — not the `/v1` the code/`host.json`
otherwise suggest).

## Deployment

Served at `https://ca-app.ocvrs.in/api/v1` ([API reference](API.md)) from Render,
defined by the Blueprint in [`../render.yaml`](../render.yaml): a web service
`ca-app-be` and a PostgreSQL database `ca-app-db`, both on the free plan in
Singapore. `ca-app.ocvrs.in` is a Render custom domain; its Cloudflare DNS record
is a DNS-only CNAME to `ca-app-be-6hsh.onrender.com`.

Render reads the repo as a public URL (the Render GitHub app has no access to
Ocavior/CA-App-Be yet), so pushes don't deploy on their own: click **Manual
Deploy** on `ca-app-be`, or **Manual sync** on the `ca-app` Blueprint after
editing `render.yaml`. Once an Ocavior org owner grants the Render GitHub app
access to this repo, pushes to `main` that change `ca-be-node/` deploy. Migrations run at
start (`npm run db:migrate && npm start`), and a deploy that fails them or the
health check at `/api/v1/ca/health` leaves the previous version serving. Render
does not run the test suite; run it locally before merging (see `../test/README.md`).

Secrets (`JWT_SECRET`, `EMAIL_*`, `APP_CODE`) are set in the Render dashboard.
Email goes out through Gmail SMTP as `EMAIL_USER` with a Google App Password in
`EMAIL_PASSWORD` (Gmail allows about 500 recipients a day), and `/emailLogs`
reads the `email_logs` table. Setting `EMAIL_SERVICE_URL` and
`EMAIL_SERVICE_BASE_URL` switches back to the external email service.
On the free plan the service sleeps after 15 idle minutes (the next request takes
about a minute) and the database is deleted 30 days after creation unless it is
upgraded.

`ops/` holds the previous self-hosted setup (a Mac with launchd and a Cloudflare
Tunnel). It is no longer in use.

## Importing data from MongoDB

`npm run db:import -- --replace` copies the four CA collections from
`SOURCE_MONGODB_URI` (in the gitignored `.env.migration`) into `DATABASE_URL`,
then compares every field of every document on both sides. It only reads from
the source. `--replace` discards what is in the local tables, including anything
written through this server since the last import. It only writes to localhost
unless given `--target-host=<host>` naming the remote host, e.g. Render's external
database host (add `?sslmode=require` to its URL).

## Backups

```bash
pg_dump "$DATABASE_URL" -Fc -f ca_app_$(date +%F).dump   # back up
pg_restore --clean -d "$DATABASE_URL" ca_app_YYYY-MM-DD.dump   # restore
```

## Verifying against the original

The parent repo's `test/` suite runs against this server and a dedicated test
database — see `../test/README.md`. Never point it at the real database: it
creates and deletes records through the API.
