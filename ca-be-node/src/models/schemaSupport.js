// What Mongoose schemas used to do on write: cast, trim/lowercase, defaults,
// required/enum validation, and dropping undeclared fields. Error messages are
// returned to API clients, so they match Mongoose's wording and ordering.
const util = require('util');
const { validationError, required, invalidEnum } = require('../db/errors');

const TRUE_VALUES = [true, 'true', 1, '1', 'yes'];
const FALSE_VALUES = [false, 'false', 0, '0', 'no'];

function describeCastFailure(kind, value, path, suffix = '') {
  const shown = typeof value === 'string' ? `"${value}"` : `"${util.inspect(value)}"`;
  const type = value !== null && typeof value === 'object' ? value.constructor.name : typeof value;
  return `Cast to ${kind} failed for value ${shown} (type ${type}) at path "${path}"${suffix}`;
}

function castField(def, value, path, problems) {
  if (value === null) return null;
  if (def.type === 'boolean') {
    if (TRUE_VALUES.includes(value)) return true;
    if (FALSE_VALUES.includes(value)) return false;
    problems[path] = describeCastFailure('Boolean', value, path.split('.').pop(), ' because of "CastError"');
    return undefined;
  }
  if (typeof value === 'object') {
    problems[path] = describeCastFailure('string', value, path.split('.').pop());
    return undefined;
  }
  let text = String(value);
  if (def.trim) text = text.trim();
  if (def.lowercase) text = text.toLowerCase();
  return text;
}

function checkField(def, value, path, problems) {
  if (def.required && (value === undefined || value === null || value === '')) {
    problems[path] = required(path.split('.').pop());
  } else if (def.enum && value !== undefined && value !== null && !def.enum.includes(value)) {
    problems[path] = invalidEnum(value, path.split('.').pop());
  }
}

/**
 * Casts `input` against `schema` ({ field: { type, trim, lowercase, required,
 * enum, default, of } }), collecting problems under `prefix`. `partial` handles
 * an update: only fields present in the input are touched or validated, and no
 * defaults apply. Only own enumerable properties count, so a non-plain object
 * (the WhatsApp controller passes a raw stream) contributes nothing.
 */
function castInto(schema, input, { partial = false, prefix = '', problems }) {
  const doc = {};
  const given = input !== null && typeof input === 'object' ? input : {};
  for (const [field, def] of Object.entries(schema)) {
    const path = `${prefix}${field}`;
    const present = Object.prototype.hasOwnProperty.call(given, field) && given[field] !== undefined;
    if (partial && !present) continue;

    if (def.type === 'array') {
      const items = present ? [].concat(given[field]) : (def.default ? def.default() : []);
      doc[field] = items.map((item, i) => castInto(def.of, item, { prefix: `${path}.${i}.`, problems }));
      continue;
    }

    let value = present ? castField(def, given[field], path, problems) : undefined;
    if (value === undefined && !present && def.default !== undefined) value = def.default;
    if (!problems[path]) checkField(def, value, path, problems);
    if (value !== undefined) doc[field] = value;
  }
  return doc;
}

function raiseProblems(modelName, problems, label) {
  if (Object.keys(problems).length === 0) return;
  // Mongoose reports paths in sorted order.
  const sorted = Object.fromEntries(Object.entries(problems).sort(([a], [b]) => (a < b ? -1 : 1)));
  const err = validationError(modelName, sorted);
  // findByIdAndUpdate's validators use a bare prefix, unlike document validation.
  if (label) err.message = err.message.replace(`${modelName} validation failed`, label);
  throw err;
}

/** Document validation, as on create() and save(). */
function castDocument(modelName, schema, input, { partial = false } = {}) {
  const problems = {};
  const doc = castInto(schema, input, { partial, problems });
  raiseProblems(modelName, problems);
  return doc;
}

/** Update-validator behavior, as on findByIdAndUpdate(..., { runValidators: true }). */
function castUpdate(modelName, schema, input) {
  const problems = {};
  const doc = castInto(schema, input, { partial: true, problems });
  raiseProblems(modelName, problems, 'Validation failed');
  return doc;
}

/** Rewrites a mapped unique violation to name the document field, as Mongo's message does. */
function duplicateKeyError(err, collection, fields) {
  if (err.code !== 11000) return err;
  const match = err.message.match(/Key \((.+?)\)=\((.*)\) already exists/);
  if (!match) return err;
  const [, column, value] = match;
  const name = Object.keys(fields).find(n => fields[n].column === column) || column;
  const shown = value === 'null' ? 'null' : `"${value}"`;
  err.message = `E11000 duplicate key error collection: ${collection} index: ${name}_1 dup key: { ${name}: ${shown} }`;
  return err;
}

module.exports = { castDocument, castUpdate, castInto, raiseProblems, duplicateKeyError };
