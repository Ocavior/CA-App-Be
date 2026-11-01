// Compiles the Mongo-style filters the controllers build into parameterized SQL,
// so that filter-building logic did not need re-transcribing in the migration.
// Field names always come from the model's whitelist and values are always bound
// parameters - nothing from a request is ever interpolated into the SQL text.
const { castId } = require('./objectId');
const { castError } = require('./errors');

const COMPARISONS = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' };

function castValue(value, field, ctx, path) {
  switch (field.type) {
    case 'id':
      return castId(value, ctx.modelName, path);
    case 'bool':
      if (value === true || value === 'true') return true;
      if (value === false || value === 'false') return false;
      throw castError(value, path, ctx.modelName, 'Boolean');
    case 'date': {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) throw castError(value, path, ctx.modelName, 'date');
      return date;
    }
    case 'int':
      return Number(value);
    default:
      return String(value);
  }
}

/**
 * Resolves a filter key to a SQL expression. A dotted key into a JSON column
 * (services.incomeTax.offered) reads that path as text, which is why JSON-path
 * values are compared as text below.
 */
function resolveField(key, ctx) {
  const field = ctx.fields[key];
  if (field) return { sql: field.sqlName, field };

  const [root, ...rest] = key.split('.');
  const parent = ctx.fields[root];
  if (parent && parent.type === 'json' && rest.length > 0) {
    ctx.params.push(rest);
    return { sql: `(${parent.sqlName} #>> $${ctx.params.length}::text[])`, field: { type: 'text' } };
  }
  throw new Error(`Unknown field "${key}" in ${ctx.modelName} filter`);
}

function regexCondition(sql, pattern, options, ctx) {
  ctx.params.push(pattern);
  return `${sql} ${options.includes('i') ? '~*' : '~'} $${ctx.params.length}`;
}

function equalsCondition(sql, value, field, ctx, path) {
  if (value === null || value === undefined) return `${sql} IS NULL`;
  // Mongoose turns equality against an array into $in; a repeated query
  // parameter (?source=a&source=b) reaches filters this way.
  if (Array.isArray(value)) {
    ctx.params.push(value.map(v => castValue(v, field, ctx, path)));
    return `${sql} = ANY($${ctx.params.length})`;
  }
  ctx.params.push(castValue(value, field, ctx, path));
  return `${sql} = $${ctx.params.length}`;
}

function fieldCondition(key, condition, ctx) {
  const { sql, field } = resolveField(key, ctx);

  if (condition instanceof RegExp) {
    return regexCondition(sql, condition.source, condition.flags, ctx);
  }

  const isOperatorObject = condition !== null && typeof condition === 'object'
    && !(condition instanceof Date) && !Array.isArray(condition);
  if (!isOperatorObject) return equalsCondition(sql, condition, field, ctx, key);

  const parts = [];
  for (const [op, value] of Object.entries(condition)) {
    if (op === '$options') continue;
    if (op === '$regex') {
      if (Array.isArray(value)) throw castError(value, key, ctx.modelName, 'string');
      const pattern = value instanceof RegExp ? value.source : String(value);
      const flags = value instanceof RegExp ? value.flags : (condition.$options || '');
      parts.push(regexCondition(sql, pattern, flags, ctx));
    } else if (op === '$exists') {
      parts.push(value ? `${sql} IS NOT NULL` : `${sql} IS NULL`);
    } else if (op === '$in') {
      ctx.params.push(value.map(v => castValue(v, field, ctx, key)));
      parts.push(`${sql} = ANY($${ctx.params.length})`);
    } else if (op === '$ne') {
      // Mongo's $ne also matches documents where the field is missing.
      ctx.params.push(castValue(value, field, ctx, key));
      parts.push(`${sql} IS DISTINCT FROM $${ctx.params.length}`);
    } else if (COMPARISONS[op]) {
      ctx.params.push(castValue(value, field, ctx, key));
      parts.push(`${sql} ${COMPARISONS[op]} $${ctx.params.length}`);
    } else {
      throw new Error(`Unsupported filter operator "${op}" on ${ctx.modelName}.${key}`);
    }
  }
  return parts.length ? `(${parts.join(' AND ')})` : 'TRUE';
}

function compileGroup(filter, ctx) {
  const parts = [];
  for (const [key, condition] of Object.entries(filter)) {
    if (key === '$and' || key === '$or') {
      const joiner = key === '$and' ? ' AND ' : ' OR ';
      const children = condition.map(child => compileGroup(child, ctx));
      parts.push(children.length ? `(${children.join(joiner)})` : 'TRUE');
    } else {
      parts.push(fieldCondition(key, condition, ctx));
    }
  }
  return parts.length ? `(${parts.join(' AND ')})` : 'TRUE';
}

/**
 * @param filter  Mongo-style filter object
 * @param ctx     { modelName, fields: { docField: { sqlName, type } }, params: [] }
 *                `params` is appended to, so it can be shared with the rest of the query.
 * @returns SQL boolean expression
 */
function compileFilter(filter = {}, ctx) {
  return compileGroup(filter, ctx);
}

module.exports = { compileFilter };
