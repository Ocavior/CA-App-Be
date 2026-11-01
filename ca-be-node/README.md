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

## Run it as a service on this machine

```bash
ops/install-service.sh                                        # start at login, restart on crash
launchctl kickstart -k gui/$(id -u)/com.ocavior.ca-app-be     # restart
launchctl bootout gui/$(id -u)/com.ocavior.ca-app-be          # stop
tail -f ~/Library/Logs/ca-app-be/server.log                   # logs
```

## Importing data from MongoDB

`npm run db:import -- --replace` copies the four CA collections from
`SOURCE_MONGODB_URI` (in the gitignored `.env.migration`) into the local database,
then compares every field of every document on both sides. It only reads from
the source. `--replace` discards what is in the local tables, including anything
written through this server since the last import.

## Backups

```bash
pg_dump "$DATABASE_URL" -Fc -f ca_app_$(date +%F).dump   # back up
pg_restore --clean -d "$DATABASE_URL" ca_app_YYYY-MM-DD.dump   # restore
```

## Verifying against the original

The parent repo's `test/` suite runs against this server and a dedicated test
database — see `../test/README.md`. Never point it at the real database: it
creates and deletes records through the API.
