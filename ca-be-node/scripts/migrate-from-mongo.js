// One-way import of the CA app's data from MongoDB into the local PostgreSQL.
// Usage: npm run db:import -- [--replace]
//
// The source database is shared with another application, so this only ever
// calls find() on the four collections listed in SPECS. It uses the bare driver
// (not Mongoose, whose autoIndex would write to the source). Output is limited
// to counts, field names and _ids - never personal values.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

const TIMESTAMP_COLUMNS = [
  ['createdAt', 'created_at', 'date'],
  ['updatedAt', 'updated_at', 'date']
];

const SPECS = [
  {
    collection: 'admins',
    table: 'admins',
    columns: [
      ['username', 'username', 'text'],
      ['password', 'password', 'text'],
      ['email', 'email', 'text'],
      ['phoneNumber', 'phone_number', 'text'],
      ['applicationCode', 'application_code', 'text'],
      ['isActive', 'is_active', 'bool'],
      ['role', 'role', 'text'],
      ...TIMESTAMP_COLUMNS,
      ['__v', 'version', 'int']
    ]
  },
  {
    collection: 'services',
    table: 'services',
    columns: [
      ['name', 'name', 'text'],
      ['alias', 'alias', 'text'],
      ['isActive', 'is_active', 'bool'],
      ['source', 'source', 'text'],
      ...TIMESTAMP_COLUMNS,
      ['__v', 'version', 'int']
    ],
    // Stored in sub_services; see SUB_SERVICE_COLUMNS.
    embedded: ['subServices']
  },
  {
    collection: 'casubmissions',
    table: 'ca_submissions',
    columns: [
      ['timestamp', 'timestamp', 'date'],
      ['name', 'name', 'text'],
      ['mobile', 'mobile', 'text'],
      ['mobileLast10', 'mobile_last10', 'text'],
      ['email', 'email', 'text'],
      ['newEmail', 'new_email', 'text'],
      ['whatsappNumber', 'whatsapp_number', 'text'],
      ['state', 'state', 'text'],
      ['city', 'city', 'text'],
      ['otherBranches', 'other_branches', 'text[]'],
      ['top3Services', 'top3_services', 'text[]'],
      ['services', 'services', 'json'],
      ['foreignWhichCountry', 'foreign_which_country', 'text'],
      ['govtSubsidiesWhichState', 'govt_subsidies_which_state', 'text'],
      ['otherServices', 'other_services', 'text'],
      ['remarks', 'remarks', 'text'],
      ['projectHelpDetails', 'project_help_details', 'text'],
      ['employer', 'employer', 'text'],
      ['formFiledBy', 'form_filed_by', 'text'],
      ['source', 'source', 'text'],
      ['importedAt', 'imported_at', 'date'],
      ['isActive', 'is_active', 'bool'],
      ['rawData', 'raw_data', 'json'],
      ...TIMESTAMP_COLUMNS,
      ['__v', 'version', 'int']
    ]
  },
  {
    collection: 'whatsapptemplates',
    table: 'whatsapp_templates',
    columns: [
      ['template_name', 'template_name', 'text'],
      ['preview', 'preview', 'text'],
      ['bodyParams', 'body_params', 'json'],
      ['isActive', 'is_active', 'bool'],
      ['source', 'source', 'text'],
      ...TIMESTAMP_COLUMNS,
      ['__v', 'version', 'int']
    ]
  }
];

const SUB_SERVICE_COLUMNS = [
  ['name', 'name', 'text'],
  ['alias', 'alias', 'text'],
  ['isOfferedDefault', 'is_offered_default', 'bool'],
  ['isActive', 'is_active', 'bool'],
  ['source', 'source', 'text'],
  ...TIMESTAMP_COLUMNS
];

function redact(message) {
  return String(message).replace(/\/\/[^/@\s]*@/g, '//<redacted>@');
}

function readEnvValue(filename, key) {
  const file = path.join(ROOT, filename);
  const value = dotenv.parse(fs.readFileSync(file))[key];
  if (!value) throw new Error(`${key} is not set in ${filename}`);
  return value;
}

function hexId(doc, where) {
  if (!doc._id || doc._id._bsontype !== 'ObjectId') {
    throw new Error(`${where}: _id is not an ObjectId`);
  }
  return doc._id.toHexString();
}

function assertPlainJson(value, where) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${where}: non-finite number in JSON value`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => assertPlainJson(item, where));
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) assertPlainJson(item, `${where}.${key}`);
    return;
  }
  throw new Error(`${where}: value in JSON field would not survive JSON.stringify`);
}

// Rejects any value that a column would silently coerce. Messages name the
// field and _id only, so they are safe to print.
function assertType(value, type, where) {
  const ok = {
    text: () => typeof value === 'string',
    bool: () => typeof value === 'boolean',
    int: () => Number.isInteger(value),
    date: () => value instanceof Date && !Number.isNaN(value.getTime()),
    'text[]': () => Array.isArray(value) && value.every(item => typeof item === 'string'),
    json: () => {
      assertPlainJson(value, where);
      return true;
    }
  }[type]();
  if (!ok) throw new Error(`${where}: expected ${type}, got an incompatible value`);
}

/** Canonical comparable form of a source value: both sides of verify reduce to this. */
function fromMongo(value, type, where) {
  if (value === undefined || value === null) return null;
  assertType(value, type, where);
  if (type === 'date') return value.getTime();
  if (type === 'json' || type === 'text[]') return JSON.stringify(value);
  return value;
}

/** Same form for a Postgres value. JSON columns are selected as ::text, keeping exact key order. */
function fromPostgres(value, type) {
  if (value === null || value === undefined) return null;
  if (type === 'date') return value.getTime();
  if (type === 'text[]') return JSON.stringify(value);
  return value;
}

function assertAllFieldsMapped(doc, columns, embedded, where) {
  const known = new Set(['_id', ...columns.map(c => c[0]), ...embedded]);
  const unknown = Object.keys(doc).filter(field => !known.has(field));
  if (unknown.length) throw new Error(`${where}: fields with no destination: ${unknown.join(', ')}`);
}

function selectList(columns) {
  return ['id', ...columns.map(([, column, type]) => (
    type === 'json' ? `"${column}"::text AS "${column}"` : `"${column}"`
  ))].join(', ');
}

async function readSource(uri) {
  const client = new MongoClient(uri, { readPreference: 'secondaryPreferred', serverSelectionTimeoutMS: 20000 });
  await client.connect();
  try {
    const db = client.db();
    const source = {};
    for (const spec of SPECS) {
      source[spec.collection] = await db.collection(spec.collection).find({}).toArray();
    }
    return source;
  } finally {
    await client.close();
  }
}

/** Validates every document before anything is written, and returns the rows to insert. */
function buildRows(source) {
  const rows = {};
  let nullFields = 0;
  for (const spec of SPECS) {
    rows[spec.table] = source[spec.collection].map((doc) => {
      const id = hexId(doc, spec.collection);
      const where = `${spec.collection}/${id}`;
      assertAllFieldsMapped(doc, spec.columns, spec.embedded || [], where);
      const values = spec.columns.map(([field, , type]) => {
        if (doc[field] === null) nullFields++;
        if (doc[field] === undefined || doc[field] === null) return null;
        assertType(doc[field], type, `${where}.${field}`);
        return type === 'json' ? JSON.stringify(doc[field]) : doc[field];
      });
      return [id, ...values];
    });
  }

  rows.sub_services = [];
  for (const service of source.services) {
    const serviceId = hexId(service, 'services');
    if (!Array.isArray(service.subServices)) {
      throw new Error(`services/${serviceId}.subServices is not an array`);
    }
    service.subServices.forEach((sub, position) => {
      const id = hexId(sub, `services/${serviceId}.subServices`);
      const where = `services/${serviceId}.subServices/${id}`;
      assertAllFieldsMapped(sub, SUB_SERVICE_COLUMNS, [], where);
      const values = SUB_SERVICE_COLUMNS.map(([field, , type]) => {
        if (sub[field] === undefined || sub[field] === null) return null;
        assertType(sub[field], type, `${where}.${field}`);
        return sub[field];
      });
      rows.sub_services.push([id, serviceId, position, ...values]);
    });
  }
  return { rows, nullFields };
}

async function insertRows(client, table, columnNames, rows) {
  const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${table} (${columnNames.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
  for (const row of rows) {
    await client.query(sql, row);
  }
}

const ALL_TABLES = ['sub_services', ...SPECS.map(s => s.table)];

async function writeTarget(databaseUrl, rows, replace) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    if (replace) {
      await client.query(`TRUNCATE ${ALL_TABLES.join(', ')}`);
    } else {
      for (const table of ALL_TABLES) {
        const { rows: [{ count }] } = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
        if (count > 0) throw new Error(`Target table ${table} is not empty. Pass --replace to clear the target tables.`);
      }
    }
    for (const spec of SPECS) {
      await insertRows(client, spec.table, ['id', ...spec.columns.map(c => c[1])], rows[spec.table]);
    }
    await insertRows(
      client,
      'sub_services',
      ['id', 'service_id', 'position', ...SUB_SERVICE_COLUMNS.map(c => c[1])],
      rows.sub_services
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

function compareDoc(doc, row, columns, where, mismatches) {
  for (const [field, column, type] of columns) {
    let matches;
    try {
      matches = fromMongo(doc[field], type, where) === fromPostgres(row[column], type);
    } catch (err) {
      matches = false;
    }
    if (!matches) mismatches.push(`${where}: field ${field} differs`);
  }
}

/** Re-reads both sides over new connections, so nothing from the write path is trusted. */
async function verify(mongoUri, databaseUrl) {
  const source = await readSource(mongoUri);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const mismatches = [];
  const counts = [];
  try {
    for (const spec of SPECS) {
      const { rows } = await client.query(`SELECT ${selectList(spec.columns)} FROM ${spec.table}`);
      const byId = new Map(rows.map(r => [r.id, r]));
      const docs = source[spec.collection];
      counts.push({ name: spec.collection, mongo: docs.length, postgres: rows.length });

      const seen = new Set();
      for (const doc of docs) {
        const id = hexId(doc, spec.collection);
        seen.add(id);
        const row = byId.get(id);
        if (!row) {
          mismatches.push(`${spec.collection}/${id}: missing from ${spec.table}`);
          continue;
        }
        compareDoc(doc, row, spec.columns, `${spec.collection}/${id}`, mismatches);
      }
      for (const id of byId.keys()) {
        if (!seen.has(id)) mismatches.push(`${spec.table}/${id}: not in ${spec.collection}`);
      }
    }

    const { rows: subRows } = await client.query(
      `SELECT service_id, position, ${selectList(SUB_SERVICE_COLUMNS)} FROM sub_services ORDER BY service_id, position`
    );
    const subsByService = new Map();
    for (const row of subRows) {
      if (!subsByService.has(row.service_id)) subsByService.set(row.service_id, []);
      subsByService.get(row.service_id).push(row);
    }
    let mongoSubs = 0;
    for (const service of source.services) {
      const serviceId = hexId(service, 'services');
      const actual = subsByService.get(serviceId) || [];
      mongoSubs += service.subServices.length;
      if (actual.length !== service.subServices.length) {
        mismatches.push(`services/${serviceId}: sub-service count differs`);
      }
      service.subServices.forEach((sub, position) => {
        const id = hexId(sub, `services/${serviceId}.subServices`);
        const row = actual[position];
        const where = `services/${serviceId}.subServices/${id}`;
        if (!row || row.id !== id || row.position !== position) {
          mismatches.push(`${where}: missing or at wrong position`);
          return;
        }
        compareDoc(sub, row, SUB_SERVICE_COLUMNS, where, mismatches);
      });
    }
    counts.push({ name: 'subServices', mongo: mongoSubs, postgres: subRows.length });
    for (const serviceId of subsByService.keys()) {
      if (!source.services.some(s => hexId(s, 'services') === serviceId)) {
        mismatches.push(`sub_services: rows for unknown service ${serviceId}`);
      }
    }
  } finally {
    await client.end();
  }
  for (const { name, mongo, postgres } of counts) {
    if (mongo !== postgres) mismatches.push(`${name}: count differs`);
  }
  return { counts, mismatches };
}

async function main() {
  const replace = process.argv.includes('--replace');
  const mongoUri = readEnvValue('.env.migration', 'SOURCE_MONGODB_URI');
  const databaseUrl = readEnvValue('.env', 'DATABASE_URL');

  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error('Refusing to run: DATABASE_URL does not point at 127.0.0.1 or localhost');
  }

  console.log('Reading source collections...');
  const source = await readSource(mongoUri);
  const { rows, nullFields } = buildRows(source);
  if (nullFields) console.log(`Note: ${nullFields} source field(s) held an explicit null; stored as NULL.`);

  console.log(`Writing to local PostgreSQL (${replace ? 'replacing' : 'empty target required'})...`);
  await writeTarget(databaseUrl, rows, replace);

  console.log('Verifying by re-reading both sides...');
  const { counts, mismatches } = await verify(mongoUri, databaseUrl);
  for (const { name, mongo, postgres } of counts) {
    console.log(`  ${name}: mongo=${mongo} postgres=${postgres}`);
  }
  if (mismatches.length) {
    mismatches.slice(0, 100).forEach(m => console.error(`  MISMATCH ${m}`));
    throw new Error(`Verification failed with ${mismatches.length} mismatch(es)`);
  }
  console.log('Verification passed: every document and field matches.');
}

main().catch((err) => {
  console.error(`Import failed: ${redact(err.message)}`);
  process.exitCode = 1;
});
