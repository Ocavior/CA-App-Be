// models/caData.js
// PostgreSQL model for CA submissions. The former Mongoose schema's casting,
// setters, defaults, validators and hooks live on here as explicit functions,
// because their results (and their error messages) reach API clients.
const util = require('util');
const { defineModel } = require('../db/model');
const { query } = require('../db/pool');
const { compileFilter } = require('../db/filter');
const { required, invalidEnum } = require('../db/errors');
const { last10Digits } = require('../utils/phoneUtils');

const SOURCES = ['manual', 'csv_import', 'api', 'web_form'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const base = defineModel({
  modelName: 'CaSubmission',
  table: 'ca_submissions',
  columns: {
    timestamp: { column: 'timestamp', type: 'date' },
    name: { column: 'name', type: 'text' },
    mobile: { column: 'mobile', type: 'text' },
    mobileLast10: { column: 'mobile_last10', type: 'text' },
    email: { column: 'email', type: 'text' },
    newEmail: { column: 'new_email', type: 'text' },
    whatsappNumber: { column: 'whatsapp_number', type: 'text' },
    state: { column: 'state', type: 'text' },
    city: { column: 'city', type: 'text' },
    otherBranches: { column: 'other_branches', type: 'text[]' },
    top3Services: { column: 'top3_services', type: 'text[]' },
    // { "<service alias>": { offered, details, subServices: { "<alias>": bool } } }
    // Service/sub-service master data lives in models/service.js.
    services: { column: 'services', type: 'json' },
    foreignWhichCountry: { column: 'foreign_which_country', type: 'text' },
    govtSubsidiesWhichState: { column: 'govt_subsidies_which_state', type: 'text' },
    otherServices: { column: 'other_services', type: 'text' },
    remarks: { column: 'remarks', type: 'text' },
    projectHelpDetails: { column: 'project_help_details', type: 'text' },
    employer: { column: 'employer', type: 'text' },
    formFiledBy: { column: 'form_filed_by', type: 'text' },
    source: { column: 'source', type: 'text' },
    importedAt: { column: 'imported_at', type: 'date' },
    isActive: { column: 'is_active', type: 'bool' },
    // Original CSV row, kept for debugging imports only.
    rawData: { column: 'raw_data', type: 'json' }
  }
});

const TRIMMED_FIELDS = new Set([
  'name', 'mobile', 'whatsappNumber', 'state', 'city', 'foreignWhichCountry',
  'govtSubsidiesWhichState', 'otherServices', 'remarks', 'projectHelpDetails',
  'employer', 'formFiledBy'
]);
const LOWERCASED_FIELDS = new Set(['email', 'newEmail']);
const STRING_FIELDS = new Set([...TRIMMED_FIELDS, ...LOWERCASED_FIELDS, 'mobileLast10', 'source']);
const DATE_FIELDS = new Set(['timestamp', 'importedAt', 'createdAt', 'updatedAt']);
const ARRAY_FIELDS = new Set(['otherBranches', 'top3Services']);

// These columns are NOT NULL, unlike the old schema, so an explicit null can't
// be stored: create() falls back to the default and updates leave them as is.
const NOT_NULL_FIELDS = new Set(['timestamp', 'importedAt', 'source', 'isActive', 'otherBranches', 'top3Services', 'services', 'name']);

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'Array';
  if (value instanceof Date) return 'date';
  return typeof value === 'object' ? (value.constructor?.name || 'Object') : typeof value;
}

function castFailure(kind, value, path) {
  const shown = typeof value === 'string' ? value : util.inspect(value);
  const reason = kind === 'Boolean' ? ' because of "CastError"' : '';
  const err = new Error(`Cast to ${kind} failed for value "${shown}" (type ${typeName(value)}) at path "${path}"${reason}`);
  err.name = 'CastError';
  err.path = path;
  return err;
}

function castString(value, path) {
  if (value === null || value === undefined) return value;
  if (typeof value._id === 'string') return value._id;
  if (value.toString && value.toString !== Object.prototype.toString && !Array.isArray(value)) {
    return value.toString();
  }
  throw castFailure('string', value, path);
}

function castDate(value, path) {
  if (value === null || value === undefined || value === '') return value === undefined ? undefined : null;
  let date;
  if (value instanceof Date) date = value;
  else if (typeof value === 'number') date = new Date(value);
  else if (typeof value === 'boolean') throw castFailure('date', value, path);
  else if (typeof value === 'string' && !Number.isNaN(Number(value)) && (Number(value) >= 275761 || Number(value) < -271820)) {
    date = new Date(Number(value));
  } else date = new Date(value.valueOf());
  if (Number.isNaN(date.getTime())) throw castFailure('date', value, path);
  return date;
}

function castBoolean(value, path) {
  if (value === null || value === undefined) return value;
  if ([true, 'true', 1, '1', 'yes'].includes(value)) return true;
  if ([false, 'false', 0, '0', 'no'].includes(value)) return false;
  throw castFailure('Boolean', value, path);
}

function castStringField(field, value, path = field) {
  let cast = castString(value, path);
  if (typeof cast !== 'string') return cast;
  if (TRIMMED_FIELDS.has(field) || LOWERCASED_FIELDS.has(field)) cast = cast.trim();
  if (LOWERCASED_FIELDS.has(field)) cast = cast.toLowerCase();
  return cast;
}

function castTrimmedArray(field, value) {
  if (value === null || value === undefined) return value;
  const items = Array.isArray(value) ? value : [value];
  return items.map((item, index) => {
    const cast = castString(item, `${field}.${index}`);
    return typeof cast === 'string' ? cast.trim() : cast;
  });
}

function assertPlainObject(value, path, kind) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw castFailure(kind, value, path);
  }
}

function assertMapKey(key) {
  if (key.includes('.')) {
    throw new Error(`Mongoose maps do not support keys that contain ".", got "${key}"`);
  }
  if (key.startsWith('$')) {
    throw new Error(`Mongoose maps do not support keys that start with "$", got "${key}"`);
  }
}

function castServiceEntry(alias, value) {
  const path = `services.${alias}`;
  if (value === null || value === undefined) return value;
  assertPlainObject(value, path, 'Embedded');

  const entry = { offered: false };
  if (value.offered !== undefined) entry.offered = castBoolean(value.offered, `${path}.offered`);
  if (value.details !== undefined) {
    const details = castString(value.details, `${path}.details`);
    entry.details = typeof details === 'string' ? details.trim() : details;
  }

  const subServices = {};
  if (value.subServices !== undefined && value.subServices !== null) {
    assertPlainObject(value.subServices, `${path}.subServices`, 'Map');
    for (const [key, flag] of Object.entries(value.subServices)) {
      assertMapKey(key);
      subServices[key] = castBoolean(flag, `${path}.subServices.${key}`);
    }
  }
  entry.subServices = value.subServices === null ? null : subServices;
  return entry;
}

function castServices(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value) && value.length === 0) return {};
  assertPlainObject(value, 'services', 'Map');
  const services = {};
  for (const [alias, entry] of Object.entries(value)) {
    assertMapKey(alias);
    services[alias] = castServiceEntry(alias, entry);
  }
  return services;
}

function castField(field, value) {
  if (STRING_FIELDS.has(field)) return castStringField(field, value);
  if (DATE_FIELDS.has(field)) return castDate(value, field);
  if (ARRAY_FIELDS.has(field)) return castTrimmedArray(field, value);
  if (field === 'isActive') return castBoolean(value, field);
  if (field === 'services') return castServices(value);
  return value; // _id, __v, rawData (untyped)
}

function validateFields(doc, fieldNames) {
  const problems = {};
  if (fieldNames.includes('name') && (doc.name === null || doc.name === undefined || doc.name === '')) {
    problems.name = required('name');
  }
  if (fieldNames.includes('source') && doc.source !== null && doc.source !== undefined && !SOURCES.includes(doc.source)) {
    problems.source = invalidEnum(doc.source, 'source');
  }
  return problems;
}

function failValidation(prefix, problems) {
  const summary = Object.entries(problems).map(([path, message]) => `${path}: ${message}`).join(', ');
  const err = new Error(`${prefix}: ${summary}`);
  err.name = 'ValidationError';
  err.errors = problems;
  throw err;
}

/**
 * What `new CaSubmission(data)` + validateSync() used to do: cast every known
 * field, fill defaults, validate. Unknown fields are dropped; hooks don't run.
 * Used directly by the CSV import, whose writes always bypassed the hooks.
 */
function castForInsert(data) {
  const now = new Date();
  const doc = {};
  const problems = {};

  for (const [field, value] of Object.entries(data)) {
    if (!base.fields[field] || value === undefined) continue;
    try {
      const cast = castField(field, value);
      if (cast !== null || !NOT_NULL_FIELDS.has(field)) doc[field] = cast;
    } catch (err) {
      problems[err.path || field] = err.message;
    }
  }

  if (doc.timestamp === undefined) doc.timestamp = now;
  if (doc.source === undefined) doc.source = 'manual';
  if (doc.importedAt === undefined) doc.importedAt = now;
  if (doc.isActive === undefined) doc.isActive = true;
  if (doc.otherBranches === undefined) doc.otherBranches = [];
  if (doc.top3Services === undefined) doc.top3Services = [];
  if (doc.services === undefined) doc.services = {};
  if (doc.__v === undefined) doc.__v = 0;

  const fieldProblems = validateFields(doc, ['name', 'source']);
  for (const [path, message] of Object.entries(fieldProblems)) {
    if (!problems[path]) problems[path] = message;
  }
  if (Object.keys(problems).length > 0) failValidation('CaSubmission validation failed', problems);

  return doc;
}

/** The old pre('save') hook, applied to a document in place. */
function applySaveHook(doc) {
  if (doc.mobile) {
    doc.mobile = doc.mobile.replace(/[^\d+]/g, '');
    doc.mobileLast10 = last10Digits(doc.mobile);
  }
  if (doc.email && !EMAIL_REGEX.test(doc.email)) {
    doc.email = undefined;
  }
  return doc;
}

/**
 * Casts a $set-style update (setters included, defaults not), for writes that
 * used to skip the pre-update hook and validators: the CSV import's updateOne.
 */
function castForUpdate(changes) {
  const set = {};
  for (const [field, value] of Object.entries(changes)) {
    if (!base.fields[field] || value === undefined) continue;
    const cast = castField(field, value);
    // See NOT_NULL_FIELDS. name stays in: its required validator rejects null.
    if (cast !== null || !NOT_NULL_FIELDS.has(field) || field === 'name') set[field] = cast;
  }
  return set;
}

/** Equivalent of `CaSubmission.create(data)`: cast, default, validate, then the save hook. */
async function create(data, options = {}) {
  const doc = applySaveHook(castForInsert(data));
  return base.insert(doc, options);
}

/**
 * Equivalent of findByIdAndUpdate(id, { $set }, { new: true, runValidators: true }):
 * id cast, pre-update hook, update cast and validators all happen before the
 * database is touched, so invalid input wins over a not-found id.
 */
async function updateValidated(id, changes, options = {}) {
  base.castId(id);

  const hooked = { ...changes };
  if (hooked.mobile !== undefined) {
    hooked.mobile = String(hooked.mobile).replace(/[^\d+]/g, '');
    hooked.mobileLast10 = last10Digits(hooked.mobile);
  }

  const set = castForUpdate(hooked);
  const problems = validateFields(set, Object.keys(set));
  if (Object.keys(problems).length > 0) failValidation('Validation failed', problems);

  return base.updateById(id, set, options);
}

/**
 * Equivalent of mutating a loaded document and calling .save(): the save hook
 * re-runs (it can rewrite mobile, or drop an invalid email), only what really
 * changed is written, and a save that changes nothing leaves updatedAt alone.
 */
async function saveChanges(doc, changes, options = {}) {
  const next = applySaveHook({ ...doc, ...changes });
  const set = {};
  for (const field of new Set([...Object.keys(changes), 'mobile', 'mobileLast10', 'email'])) {
    if (next[field] !== doc[field]) set[field] = next[field] === undefined ? null : next[field];
  }
  if (Object.keys(set).length === 0) return doc;
  return base.updateById(doc._id, set, options);
}

/** Path-bound SQL for a scored field: `name` or `services.<alias>.details`. */
function scoredFieldSql(fieldPath, params) {
  const field = base.fields[fieldPath];
  if (field) return field.sqlName;
  const [root, ...rest] = fieldPath.split('.');
  params.push(rest);
  return `(${base.fields[root].sqlName} #>> $${params.length}::text[])`;
}

/**
 * Relevance-ranked text search: each field scores 4 (whole word equals the
 * query), 3 (a word starts with it), 2 (appears anywhere) or 0; a row's primary
 * and secondary scores are the best across those field groups.
 */
async function searchScored({ filter, primaryFields, secondaryFields, exactWordRegex, wordStartRegex, anywhereRegex, skip, limit }) {
  const params = [];
  const where = compileFilter(filter, { modelName: base.modelName, fields: base.fields, params });

  params.push(exactWordRegex.source, wordStartRegex.source, anywhereRegex.source);
  const [exact, wordStart, anywhere] = [params.length - 2, params.length - 1, params.length].map(n => `$${n}`);

  const score = (fieldPath) => {
    const value = `COALESCE(${scoredFieldSql(fieldPath, params)}, '')`;
    return `CASE WHEN ${value} ~* ${exact} THEN 4 WHEN ${value} ~* ${wordStart} THEN 3 WHEN ${value} ~* ${anywhere} THEN 2 ELSE 0 END`;
  };
  const primary = `GREATEST(${primaryFields.map(score).join(', ')})`;
  const secondary = `GREATEST(${secondaryFields.map(score).join(', ')})`;

  const columns = Object.entries(base.fields)
    .filter(([name]) => name !== 'rawData')
    .map(([, field]) => field.sqlName)
    .join(', ');

  let sql = `SELECT ${columns}, ${primary} AS primary_score, ${secondary} AS secondary_score
    FROM ${base.table} WHERE ${where}
    ORDER BY primary_score DESC, secondary_score DESC, "timestamp" DESC, id ASC`;
  params.push(limit);
  sql += ` LIMIT $${params.length}`;
  if (skip) {
    params.push(skip);
    sql += ` OFFSET $${params.length}`;
  }

  const { rows } = await query(sql, params);
  return rows.map(row => ({
    ...base.toDoc(row),
    _primaryScore: row.primary_score,
    _secondaryScore: row.secondary_score
  }));
}

/**
 * Top 10 values of `state`/`city`, trimmed and lowercased. Missing values group
 * under "" and lowercasing is ASCII-only (COLLATE "C"), both as Mongo's
 * $toLower did. Equal counts are ordered by value so results are deterministic.
 */
async function countByLocationField(fieldName) {
  const column = base.fields[fieldName].sqlName;
  const { rows } = await query(`
    SELECT "_id", count FROM (
      SELECT COALESCE(LOWER(REGEXP_REPLACE(${column}, '^\\s+|\\s+$', '', 'g') COLLATE "C"), '') AS "_id", COUNT(*)::int AS count
      FROM ${base.table}
      GROUP BY 1
    ) AS grouped
    ORDER BY count DESC, "_id" COLLATE "C" ASC
    LIMIT 10`);
  return rows;
}

async function countBySource() {
  const { rows } = await query(`
    SELECT source AS "_id", COUNT(*)::int AS count
    FROM ${base.table}
    GROUP BY source
    ORDER BY count DESC, source COLLATE "C" ASC`);
  return rows;
}

/** CAs per offered service alias, plus an "other" row for free-text otherServices. */
async function countByOfferedService() {
  const { rows } = await query(`
    SELECT "_id", count FROM (
      SELECT entry.key AS "_id", COUNT(*)::int AS count
      FROM ${base.table}, JSON_EACH(services) AS entry
      WHERE entry.value ->> 'offered' = 'true'
      GROUP BY entry.key
      UNION ALL
      SELECT 'other', COUNT(*)::int
      FROM ${base.table}
      WHERE other_services ~ '\\S'
      HAVING COUNT(*) > 0
    ) AS merged
    ORDER BY count DESC, "_id" COLLATE "C" ASC`);
  return rows;
}

/** Returns null when there are no submissions at all, so callers use their zero fallback. */
async function offeredServiceCountStats() {
  const { rows } = await query(`
    SELECT AVG(offered_count)::float8 AS "avgServices", MAX(offered_count)::int AS "maxServices", MIN(offered_count)::int AS "minServices"
    FROM (
      SELECT (SELECT COUNT(*) FROM JSON_EACH(services) AS entry WHERE entry.value ->> 'offered' = 'true') AS offered_count
      FROM ${base.table}
    ) AS per_ca`);
  return rows[0].avgServices === null ? null : rows[0];
}

const CaSubmission = {
  ...base,
  create,
  updateValidated,
  saveChanges,
  castForInsert,
  castForUpdate,
  searchScored,
  countByLocationField,
  countBySource,
  countByOfferedService,
  offeredServiceCountStats
};

module.exports = CaSubmission;
