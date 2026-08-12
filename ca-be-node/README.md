# ca-be-node

Standalone Node.js/Express port of the `CA-App-Be` Azure Function app. Fully
independent copy — no shared code or imports with the parent repo's `src/`.
See [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for what was deliberately
preserved as-is (including known bugs) versus what changed because of the
runtime swap itself.

## Run it

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI, JWT_SECRET, etc.
npm start               # or `npm run dev` for nodemon
```

Listens on `PORT` (default `3000`). Routes are served under `/api/v1/...`,
matching the real prefix the original Azure Functions host serves today
(confirmed by running it directly — not the `/v1` the code/`host.json`
otherwise suggest).

## Verifying against the original

The parent repo's `test/` suite is written to run unmodified against either
this server or the Azure Functions host — see `../test/README.md`. Point it
at this server with:

```bash
npm run test:node-server   # from the repo root, BASE_URL=http://127.0.0.1:3000
```
