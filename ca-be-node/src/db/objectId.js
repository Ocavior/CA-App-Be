const crypto = require('crypto');
const { castError } = require('./errors');

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const processUnique = crypto.randomBytes(5).toString('hex');
let counter = crypto.randomBytes(3).readUIntBE(0, 3);

/** Same layout as a BSON ObjectId: 4-byte seconds, 5-byte process id, 3-byte counter. */
function generateId() {
  counter = (counter + 1) % 0x1000000;
  const seconds = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  return seconds + processUnique + counter.toString(16).padStart(6, '0');
}

function isValidId(value) {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value);
}

/** Lowercased id, or a CastError for anything Mongoose would have refused. */
function castId(value, modelName, path = '_id') {
  if (!isValidId(value)) throw castError(value, path, modelName);
  return value.toLowerCase();
}

module.exports = { generateId, isValidId, castId };
