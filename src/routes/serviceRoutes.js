// routes/serviceRoutes.js
const ServiceController = require('../controllers/ServiceController');
const { authenticateToken } = require('../middleware/auth');

const serviceRoutes = {
  routes: [
    {
      method: 'POST',
      path: '/ca/services',
      middleware: [authenticateToken],
      handler: ServiceController.createService,
      description: 'Create a new service'
    },
    {
      method: 'GET',
      path: '/ca/services',
      middleware: [authenticateToken],
      handler: ServiceController.getServices,
      description: 'List all services (including inactive/pending) - admin management view'
    },
    {
      method: 'GET',
      path: '/ca/services/:id',
      middleware: [authenticateToken],
      handler: ServiceController.getServiceById,
      description: 'Get a single service by ID'
    },
    {
      method: 'PUT',
      path: '/ca/services/:id',
      middleware: [authenticateToken],
      handler: ServiceController.updateService,
      description: 'Update a service'
    },
    {
      method: 'PATCH',
      path: '/ca/services/:id/active',
      middleware: [authenticateToken],
      handler: ServiceController.toggleServiceStatus,
      description: 'Toggle or set isActive status for a service (soft delete / restore / approve pending)'
    },
    {
      method: 'POST',
      path: '/ca/services/:id/sub-services',
      middleware: [authenticateToken],
      handler: ServiceController.addSubService,
      description: 'Add a sub-service to a service'
    },
    {
      method: 'PUT',
      path: '/ca/services/:id/sub-services/:subServiceId',
      middleware: [authenticateToken],
      handler: ServiceController.updateSubService,
      description: 'Update a sub-service'
    },
    {
      method: 'PATCH',
      path: '/ca/services/:id/sub-services/:subServiceId/active',
      middleware: [authenticateToken],
      handler: ServiceController.toggleSubServiceStatus,
      description: 'Toggle or set isActive status for a sub-service (soft delete / restore / approve pending)'
    }
  ],

  registerRoutes: function (router) {
    this.routes.forEach(route => {
      const { method, path, middleware, handler } = route;
      if (middleware && middleware.length > 0) {
        router.addRoute(method, path, [...middleware, handler]);
      } else {
        router.addRoute(method, path, handler);
      }
    });
  }
};

module.exports = serviceRoutes;
