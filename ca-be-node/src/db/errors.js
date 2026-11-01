// Errors shaped like the Mongoose/MongoDB ones the app used to get. Controllers
// branch on err.name === 'CastError' and surface err.message to API clients, so
// these names and messages are part of the API's observable behavior.
const util = require('util');

function castError(value, path, modelName, kind = 'ObjectId') {
  let type = value === null ? 'null' : typeof value;
  let shown = typeof value === 'string' ? `"${value}"` : String(value);
  if (value instanceof Date || Array.isArray(value)) {
    type = value instanceof Date ? 'Date' : 'Array';
    shown = `"${util.inspect(value)}"`;
  }
  const err = new Error(`Cast to ${kind} failed for value ${shown} (type ${type}) at path "${path}" for model "${modelName}"`);
  err.name = 'CastError';
  err.path = path;
  err.value = value;
  return err;
}

/** `problems` is { fieldPath: message }, in the order Mongoose would report them. */
function validationError(modelName, problems) {
  const summary = Object.entries(problems).map(([path, message]) => `${path}: ${message}`).join(', ');
  const err = new Error(`${modelName} validation failed: ${summary}`);
  err.name = 'ValidationError';
  err.errors = problems;
  return err;
}

const required = (path) => `Path \`${path}\` is required.`;
const invalidEnum = (value, path) => `\`${value}\` is not a valid enum value for path \`${path}\`.`;

/** Unique violations become the E11000 shape the app and its clients have always seen. */
function mapPgError(err, table) {
  if (err.code !== '23505') return err;
  const mapped = new Error(`E11000 duplicate key error collection: ${table} index: ${err.constraint} dup key: ${err.detail}`);
  mapped.code = 11000;
  mapped.constraint = err.constraint;
  return mapped;
}

module.exports = { castError, validationError, required, invalidEnum, mapPgError };
