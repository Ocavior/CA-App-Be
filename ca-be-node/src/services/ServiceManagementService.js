// services/ServiceManagementService.js
const Service = require('../models/service');
const { normalizeName, toAlias } = require('../utils/aliasUtils');

function notFoundError(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

/**
 * Create a new service. Auto-generates an alias from the name if none is
 * supplied, avoiding collisions with existing service aliases.
 */
async function createService(payload = {}) {
  if (!payload.name || !String(payload.name).trim()) {
    const err = new Error('Service name is required');
    err.statusCode = 400;
    throw err;
  }

  let alias = payload.alias && String(payload.alias).trim();
  if (!alias) {
    const existing = await Service.find({}, 'alias').lean();
    alias = toAlias(payload.name, existing.map(s => s.alias));
  }

  const subServices = [];
  if (Array.isArray(payload.subServices)) {
    const usedSubAliases = [];

    for (const ss of payload.subServices) {
      if (!ss.name || !String(ss.name).trim()) {
        const err = new Error('Sub-service name is required');
        err.statusCode = 400;
        throw err;
      }

      let subAlias = ss.alias && String(ss.alias).trim();
      if (!subAlias) {
        // Collision-check against sub-services already processed in this
        // same request, not just against the DB - otherwise two inline
        // sub-services with the same/similar name would silently end up
        // with the same alias on this service.
        subAlias = toAlias(ss.name, usedSubAliases);
      } else if (usedSubAliases.some(a => a.toLowerCase() === subAlias.toLowerCase())) {
        const err = new Error(`Duplicate sub-service alias "${subAlias}" in request`);
        err.statusCode = 400;
        throw err;
      }

      usedSubAliases.push(subAlias);
      subServices.push({
        name: ss.name.trim(),
        alias: subAlias,
        isOfferedDefault: !!ss.isOfferedDefault,
        isActive: ss.isActive !== false,
        source: ss.source || 'manual'
      });
    }
  }

  const service = await Service.create({
    name: payload.name.trim(),
    alias,
    isActive: payload.isActive !== false,
    source: payload.source || 'manual',
    subServices
  });

  return service.toObject();
}

/**
 * Get all services. activeOnly also filters sub-services down to active ones.
 */
async function getAllServices({ activeOnly = false } = {}) {
  const query = activeOnly ? { isActive: true } : {};
  const services = await Service.find(query).sort({ name: 1 }).lean();

  if (!activeOnly) return services;

  return services.map(service => ({
    ...service,
    subServices: (service.subServices || []).filter(ss => ss.isActive)
  }));
}

async function getServiceById(id) {
  return Service.findById(id).lean();
}

async function updateService(id, payload = {}) {
  const allowed = ['name', 'alias', 'isActive'];
  const data = {};
  allowed.forEach(field => {
    if (payload[field] !== undefined) data[field] = payload[field];
  });

  const updated = await Service.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) throw notFoundError('Service not found');
  return updated;
}

async function toggleServiceActive(id, explicitValue = null) {
  const service = await Service.findById(id);
  if (!service) throw notFoundError('Service not found');

  service.isActive = typeof explicitValue === 'boolean' ? explicitValue : !service.isActive;
  await service.save();
  return service.toObject();
}

async function addSubService(serviceId, payload = {}) {
  if (!payload.name || !String(payload.name).trim()) {
    const err = new Error('Sub-service name is required');
    err.statusCode = 400;
    throw err;
  }

  const service = await Service.findById(serviceId);
  if (!service) throw notFoundError('Service not found');

  let alias = payload.alias && String(payload.alias).trim();
  if (!alias) {
    alias = toAlias(payload.name, service.subServices.map(ss => ss.alias));
  } else if (service.subServices.some(ss => ss.alias.toLowerCase() === alias.toLowerCase())) {
    const err = new Error(`Sub-service alias "${alias}" already exists on this service`);
    err.statusCode = 409;
    throw err;
  }

  service.subServices.push({
    name: payload.name.trim(),
    alias,
    isOfferedDefault: !!payload.isOfferedDefault,
    isActive: payload.isActive !== false,
    source: payload.source || 'manual'
  });

  await service.save();
  return service.toObject();
}

async function updateSubService(serviceId, subServiceId, payload = {}) {
  const service = await Service.findById(serviceId);
  if (!service) throw notFoundError('Service not found');

  const subService = service.subServices.id(subServiceId);
  if (!subService) throw notFoundError('Sub-service not found');

  const allowed = ['name', 'alias', 'isOfferedDefault', 'isActive'];
  allowed.forEach(field => {
    if (payload[field] !== undefined) subService[field] = payload[field];
  });

  await service.save();
  return service.toObject();
}

async function toggleSubServiceActive(serviceId, subServiceId, explicitValue = null) {
  const service = await Service.findById(serviceId);
  if (!service) throw notFoundError('Service not found');

  const subService = service.subServices.id(subServiceId);
  if (!subService) throw notFoundError('Sub-service not found');

  subService.isActive = typeof explicitValue === 'boolean' ? explicitValue : !subService.isActive;
  await service.save();
  return service.toObject();
}

/**
 * Load every service/sub-service (active and pending) for in-memory name
 * matching during CSV import. Callers should fetch this once per import run
 * rather than hitting the DB per row.
 */
async function getAllServicesForMatching() {
  return Service.find({}).lean();
}

/**
 * Create a new service flagged as pending review (inactive, source csv_import).
 * Used when an import encounters a service name that matches nothing known.
 */
async function createPendingService(name) {
  const existing = await Service.find({}, 'alias').lean();
  const alias = toAlias(name, existing.map(s => s.alias));

  const service = await Service.create({
    name: String(name).trim(),
    alias,
    isActive: false,
    source: 'csv_import',
    subServices: []
  });

  return service.toObject();
}

/**
 * Create a new sub-service under an existing service, flagged as pending
 * review (inactive, source csv_import).
 */
async function createPendingSubService(serviceId, name) {
  const service = await Service.findById(serviceId);
  if (!service) throw notFoundError('Service not found');

  const alias = toAlias(name, service.subServices.map(ss => ss.alias));

  service.subServices.push({
    name: String(name).trim(),
    alias,
    isOfferedDefault: false,
    isActive: false,
    source: 'csv_import'
  });

  await service.save();
  return service.subServices[service.subServices.length - 1].toObject();
}

module.exports = {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  toggleServiceActive,
  addSubService,
  updateSubService,
  toggleSubServiceActive,
  getAllServicesForMatching,
  createPendingService,
  createPendingSubService,
  normalizeName
};
