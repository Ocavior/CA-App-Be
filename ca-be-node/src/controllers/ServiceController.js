// controllers/ServiceController.js
const ServiceManagementService = require('../services/ServiceManagementService');

async function createService(request, context) {
  try {
    const payload = (await request.json()) || {};
    const data = await ServiceManagementService.createService(payload);

    return {
      status: 201,
      jsonBody: { success: true, message: 'Service created successfully', data }
    };
  } catch (err) {
    context.error('Create service error:', err);
    return {
      status: err.statusCode || 500,
      jsonBody: { success: false, message: err.message }
    };
  }
}

async function getServices(request, context) {
  try {
    const activeOnly = (request.query || {}).activeOnly === 'true';
    const data = await ServiceManagementService.getAllServices({ activeOnly });

    return {
      status: 200,
      jsonBody: { success: true, data }
    };
  } catch (err) {
    context.error('Get services error:', err);
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to fetch services' }
    };
  }
}

async function getServiceById(request, context) {
  try {
    const { id } = request.params;
    const data = await ServiceManagementService.getServiceById(id);

    if (!data) {
      return { status: 404, jsonBody: { success: false, message: 'Service not found' } };
    }

    return { status: 200, jsonBody: { success: true, data } };
  } catch (err) {
    context.error('Get service error:', err);
    return {
      status: err.name === 'CastError' ? 400 : 500,
      jsonBody: { success: false, message: err.name === 'CastError' ? 'Invalid service ID' : 'Failed to fetch service' }
    };
  }
}

async function updateService(request, context) {
  try {
    const { id } = request.params;
    const payload = (await request.json()) || {};
    const data = await ServiceManagementService.updateService(id, payload);

    return { status: 200, jsonBody: { success: true, message: 'Service updated successfully', data } };
  } catch (err) {
    context.error('Update service error:', err);
    return {
      status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
      jsonBody: { success: false, message: err.name === 'CastError' ? 'Invalid service ID' : err.message }
    };
  }
}

async function toggleServiceStatus(request, context) {
  try {
    const { id } = request.params;
    const payload = (await request.json().catch(() => ({}))) || {};
    const data = await ServiceManagementService.toggleServiceActive(
      id,
      typeof payload.isActive === 'boolean' ? payload.isActive : null
    );

    return {
      status: 200,
      jsonBody: { success: true, message: `Service is now ${data.isActive ? 'active' : 'inactive'}`, data }
    };
  } catch (err) {
    context.error('Toggle service status error:', err);
    return {
      status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
      jsonBody: { success: false, message: err.name === 'CastError' ? 'Invalid service ID' : err.message }
    };
  }
}

async function addSubService(request, context) {
  try {
    const { id } = request.params;
    const payload = (await request.json()) || {};
    const data = await ServiceManagementService.addSubService(id, payload);

    return { status: 201, jsonBody: { success: true, message: 'Sub-service added successfully', data } };
  } catch (err) {
    context.error('Add sub-service error:', err);
    return {
      status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
      jsonBody: { success: false, message: err.name === 'CastError' ? 'Invalid service ID' : err.message }
    };
  }
}

async function updateSubService(request, context) {
  try {
    const { id, subServiceId } = request.params;
    const payload = (await request.json()) || {};
    const data = await ServiceManagementService.updateSubService(id, subServiceId, payload);

    return { status: 200, jsonBody: { success: true, message: 'Sub-service updated successfully', data } };
  } catch (err) {
    context.error('Update sub-service error:', err);
    return {
      status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
      jsonBody: { success: false, message: err.name === 'CastError' ? 'Invalid ID' : err.message }
    };
  }
}

async function toggleSubServiceStatus(request, context) {
  try {
    const { id, subServiceId } = request.params;
    const payload = (await request.json().catch(() => ({}))) || {};
    const data = await ServiceManagementService.toggleSubServiceActive(
      id,
      subServiceId,
      typeof payload.isActive === 'boolean' ? payload.isActive : null
    );

    return { status: 200, jsonBody: { success: true, message: 'Sub-service status updated', data } };
  } catch (err) {
    context.error('Toggle sub-service status error:', err);
    return {
      status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
      jsonBody: { success: false, message: err.name === 'CastError' ? 'Invalid ID' : err.message }
    };
  }
}

module.exports = {
  createService,
  getServices,
  getServiceById,
  updateService,
  toggleServiceStatus,
  addSubService,
  updateSubService,
  toggleSubServiceStatus
};
