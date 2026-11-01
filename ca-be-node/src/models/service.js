// models/service.js
//
// A service document still carries its sub-services embedded under `subServices`,
// exactly as API clients and CaSubmissionImportService expect, even though they
// are stored in their own table. Sub-service writes go through the methods below
// so they bump the parent's updatedAt/__v the way saving the embedded array did.
const { defineModel } = require('../db/model');
const { query, withTransaction } = require('../db/pool');
const { generateId } = require('../db/objectId');
const { castDocument, castInto, raiseProblems, duplicateKeyError } = require('./schemaSupport');

const base = defineModel({
  modelName: 'Service',
  table: 'services',
  columns: {
    name: { column: 'name', type: 'text' },
    alias: { column: 'alias', type: 'text' },
    isActive: { column: 'is_active', type: 'bool' },
    source: { column: 'source', type: 'text' }
  }
});

const SOURCES = ['seed', 'manual', 'csv_import'];

const subServiceSchema = {
  name: { type: 'string', required: true, trim: true },
  alias: { type: 'string', required: true, trim: true },
  isOfferedDefault: { type: 'boolean', default: false },
  isActive: { type: 'boolean', default: true },
  source: { type: 'string', enum: SOURCES, default: 'manual' }
};

const schema = {
  name: { type: 'string', required: true, trim: true },
  alias: { type: 'string', required: true, trim: true },
  isActive: { type: 'boolean', default: true },
  source: { type: 'string', enum: SOURCES, default: 'manual' },
  subServices: { type: 'array', of: subServiceSchema }
};

const rethrow = (err) => { throw duplicateKeyError(err, 'services', base.fields); };

const toSubService = (row) => ({
  name: row.name,
  alias: row.alias,
  isOfferedDefault: row.is_offered_default,
  isActive: row.is_active,
  source: row.source,
  _id: row.id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

function withSubServices(doc, subServices) {
  const { _id, name, alias, isActive, source, createdAt, updatedAt, __v } = doc;
  return { _id, name, alias, isActive, source, subServices, createdAt, updatedAt, __v };
}

async function loadSubServices(serviceIds, client) {
  const { rows } = await query(
    'SELECT * FROM sub_services WHERE service_id = ANY($1) ORDER BY position ASC',
    [serviceIds],
    client
  );
  const byService = new Map(serviceIds.map(id => [id, []]));
  rows.forEach(row => byService.get(row.service_id).push(toSubService(row)));
  return byService;
}

async function attachAll(docs, client) {
  const byService = await loadSubServices(docs.map(d => d._id), client);
  return docs.map(doc => withSubServices(doc, byService.get(doc._id)));
}

async function insertSubService(client, serviceId, position, sub, now) {
  const { rows } = await client.query(
    `INSERT INTO sub_services (id, service_id, position, name, alias, is_offered_default, is_active, source, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING *`,
    [generateId(), serviceId, position, sub.name, sub.alias, sub.isOfferedDefault, sub.isActive, sub.source, now]
  );
  return toSubService(rows[0]);
}

/** Bumps the parent row, which also serializes concurrent sub-service writes to it. */
async function touchParent(client, serviceId, now, versionIncrement) {
  const { rows } = await client.query(
    'UPDATE services SET updated_at = $2, version = version + $3 WHERE id = $1 RETURNING *',
    [serviceId, now, versionIncrement]
  );
  if (!rows[0]) throw new Error(`No document found for query "{ _id: '${serviceId}' }" on model "Service"`);
  return base.toDoc(rows[0]);
}

async function reload(client, parentDoc) {
  const [service] = await attachAll([parentDoc], client);
  return service;
}

function validateSubService(input, index, options) {
  const problems = {};
  const sub = castInto(subServiceSchema, input, { ...options, prefix: `subServices.${index}.`, problems });
  raiseProblems('Service', problems);
  return sub;
}

const Service = {
  ...base,

  /** Pass a `select` to read only service columns, without loading sub-services. */
  async find(filter = {}, options = {}) {
    const docs = await base.find(filter, options);
    return options.select ? docs : attachAll(docs, options.client);
  },

  async findOne(filter = {}, options = {}) {
    const [doc] = await Service.find(filter, { ...options, limit: 1 });
    return doc || null;
  },

  async findById(id, options = {}) {
    return Service.findOne({ _id: id }, options);
  },

  /** Keys come back in new-document order (`_id` after the schema fields), as Mongoose's did. */
  async create(input) {
    const { subServices, ...fields } = castDocument('Service', schema, input);
    const now = new Date();
    return withTransaction(async (client) => {
      const doc = await base.insert({ ...fields, createdAt: now, updatedAt: now }, { client });
      const subs = [];
      for (const [position, sub] of subServices.entries()) {
        subs.push(await insertSubService(client, doc._id, position, sub, now));
      }
      const { _id, createdAt, updatedAt, __v, name, alias, isActive, source } = doc;
      return { name, alias, isActive, source, subServices: subs, _id, createdAt, updatedAt, __v };
    }).catch(rethrow);
  },

  /** Like assigning fields and saving: no write and no timestamp bump if nothing really changed. */
  async updateFields(service, changes) {
    const cast = castDocument('Service', { name: schema.name, isActive: schema.isActive }, changes, { partial: true });
    const modified = Object.fromEntries(Object.entries(cast).filter(([k, v]) => v !== service[k]));
    if (Object.keys(modified).length === 0) return service;
    const updated = await base.updateById(service._id, modified).catch(rethrow);
    return withSubServices(updated, service.subServices);
  },

  /** Malformed ids simply don't match, like Mongoose's DocumentArray.id(). */
  findSubService(service, subServiceId) {
    const wanted = String(subServiceId).toLowerCase();
    return service.subServices.find(ss => ss._id === wanted) || null;
  },

  /** Returns { service, subService }. Growing the array increments __v. */
  async addSubService(service, input) {
    const sub = validateSubService(input, service.subServices.length);
    const now = new Date();
    return withTransaction(async (client) => {
      const parent = await touchParent(client, service._id, now, 1);
      const { rows } = await client.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM sub_services WHERE service_id = $1',
        [service._id]
      );
      const subService = await insertSubService(client, service._id, rows[0].next, sub, now);
      return { service: await reload(client, parent), subService };
    });
  },

  /** Editing an element doesn't touch __v; no write at all if nothing really changed. */
  async updateSubService(service, subService, changes) {
    const index = service.subServices.indexOf(subService);
    const cast = validateSubService(changes, index, { partial: true });
    const modified = Object.entries(cast).filter(([k, v]) => v !== subService[k]);
    if (modified.length === 0) return service;

    const now = new Date();
    const sub = { ...subService, ...cast };
    return withTransaction(async (client) => {
      const parent = await touchParent(client, service._id, now, 0);
      await client.query(
        'UPDATE sub_services SET name = $2, is_offered_default = $3, is_active = $4, updated_at = $5 WHERE id = $1',
        [subService._id, sub.name, sub.isOfferedDefault, sub.isActive, now]
      );
      return reload(client, parent);
    });
  },

  /** Removing from the array increments __v. */
  async removeSubService(service, subService) {
    return withTransaction(async (client) => {
      const parent = await touchParent(client, service._id, new Date(), 1);
      await client.query('DELETE FROM sub_services WHERE id = $1', [subService._id]);
      return reload(client, parent);
    });
  }
};

module.exports = Service;
