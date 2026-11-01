// Small table gateway shared by src/models/*. Every method is async and deals in
// plain objects shaped like the old Mongoose `.lean()` documents: `_id`, `__v`,
// camelCase fields, and NULL columns left OUT of the object (a Mongo document
// simply did not have the field, and API clients see that difference).
const { query } = require('./pool');
const { compileFilter } = require('./filter');
const { castId, generateId } = require('./objectId');
const { mapPgError } = require('./errors');

function buildSelect(select, allFields) {
  const names = Object.keys(allFields);
  if (!select) return names;
  const tokens = select.trim().split(/\s+/);
  if (tokens[0].startsWith('-')) {
    const excluded = new Set(tokens.map(t => t.slice(1)));
    return names.filter(n => !excluded.has(n));
  }
  // Inclusion projections always carry _id, same as Mongo's.
  return names.filter(n => n === '_id' || tokens.includes(n));
}

/**
 * Sort keys not in the whitelist are ignored rather than rejected: sorting by a
 * field no document has was a harmless no-op in Mongo. Text sorts bytewise and
 * NULLs sort low, both to match Mongo's ordering.
 */
function buildOrderBy(sort, allFields) {
  const parts = [];
  for (const [name, direction] of Object.entries(sort || {})) {
    const field = allFields[name];
    if (!field) continue;
    const collate = field.type === 'text' ? ' COLLATE "C"' : '';
    parts.push(`${field.sqlName}${collate} ${direction === -1 ? 'DESC NULLS LAST' : 'ASC NULLS FIRST'}`);
  }
  return parts.length ? `ORDER BY ${parts.join(', ')}, ${allFields._id.sqlName} ASC` : '';
}

/**
 * @param modelName  used in cast/duplicate-key error messages
 * @param table      SQL table name
 * @param columns    { docField: { column, type } }, type one of
 *                   text | bool | date | int | json | text[]. `_id`, `createdAt`,
 *                   `updatedAt` and `__v` are added automatically.
 */
function defineModel({ modelName, table, columns }) {
  const fields = {
    _id: { column: 'id', type: 'id' },
    ...columns,
    createdAt: { column: 'created_at', type: 'date' },
    updatedAt: { column: 'updated_at', type: 'date' },
    __v: { column: 'version', type: 'int' }
  };
  for (const field of Object.values(fields)) {
    field.sqlName = `"${field.column}"`;
  }

  const toDoc = (row) => {
    const doc = {};
    for (const [name, field] of Object.entries(fields)) {
      const value = row[field.column];
      if (value !== null && value !== undefined) doc[name] = value;
    }
    return doc;
  };

  // node-postgres would send a JS array to a JSON column as a PG array literal.
  const toParam = (field, value) => (field.type === 'json' && value !== null ? JSON.stringify(value) : value);

  const selectList = (select) => buildSelect(select, fields).map(n => fields[n].sqlName).join(', ');

  const wrap = async (run) => {
    try {
      return await run();
    } catch (err) {
      throw mapPgError(err, table);
    }
  };

  const model = {
    modelName,
    table,
    fields,
    toDoc,

    castId: (id, path) => castId(id, modelName, path),

    /** options: { select, sort, skip, limit, client } */
    async find(filter = {}, options = {}) {
      const params = [];
      const where = compileFilter(filter, { modelName, fields, params });
      let sql = `SELECT ${selectList(options.select)} FROM ${table} WHERE ${where} ${buildOrderBy(options.sort, fields)}`;
      if (options.limit !== undefined) {
        params.push(options.limit);
        sql += ` LIMIT $${params.length}`;
      }
      if (options.skip) {
        params.push(options.skip);
        sql += ` OFFSET $${params.length}`;
      }
      const { rows } = await query(sql, params, options.client);
      return rows.map(toDoc);
    },

    async findOne(filter = {}, options = {}) {
      const [doc] = await model.find(filter, { ...options, limit: 1 });
      return doc || null;
    },

    async findById(id, options = {}) {
      return model.findOne({ _id: id }, options);
    },

    async countDocuments(filter = {}, options = {}) {
      const params = [];
      const where = compileFilter(filter, { modelName, fields, params });
      const { rows } = await query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${where}`, params, options.client);
      return rows[0].count;
    },

    /** Writes the doc as given; callers apply defaults, normalization and validation first. */
    async insert(doc, options = {}) {
      const now = new Date();
      const values = { _id: generateId(), createdAt: now, updatedAt: now, ...doc };
      const names = Object.keys(values).filter(n => fields[n] && values[n] !== undefined);
      const params = names.map(n => toParam(fields[n], values[n]));
      const placeholders = names.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${names.map(n => fields[n].sqlName).join(', ')}) VALUES (${placeholders}) RETURNING *`;
      return wrap(async () => toDoc((await query(sql, params, options.client)).rows[0]));
    },

    /**
     * Mongoose-style $set: undefined values are skipped, null clears the column,
     * and updatedAt is bumped even when `changes` is empty. Returns the updated
     * doc, or null if no row has that id. options: { select, client }
     */
    async updateById(id, changes, options = {}) {
      const params = [castId(id, modelName)];
      const assignments = [];
      const values = { updatedAt: new Date(), ...changes };
      for (const [name, value] of Object.entries(values)) {
        if (!fields[name] || value === undefined) continue;
        params.push(toParam(fields[name], value));
        assignments.push(`${fields[name].sqlName} = $${params.length}`);
      }
      const sql = `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = $1 RETURNING ${selectList(options.select)}`;
      return wrap(async () => {
        const { rows } = await query(sql, params, options.client);
        return rows[0] ? toDoc(rows[0]) : null;
      });
    },

    /** Returns the deleted doc, or null if no row has that id. */
    async deleteById(id, options = {}) {
      const { rows } = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [castId(id, modelName)], options.client);
      return rows[0] ? toDoc(rows[0]) : null;
    },

    async deleteMany(filter = {}, options = {}) {
      const params = [];
      const where = compileFilter(filter, { modelName, fields, params });
      const { rowCount } = await query(`DELETE FROM ${table} WHERE ${where}`, params, options.client);
      return { deletedCount: rowCount };
    }
  };

  return model;
}

module.exports = { defineModel };
