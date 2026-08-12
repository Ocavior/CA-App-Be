const controller = require('../controllers/WhatsappTemplateConttroller');
const { authenticateToken } = require('../middleware/auth');

const whatsappTemplateRoutes = {
  routes: [
    {
      method: 'POST',
      path: '/whatsapp/templates',
      middleware: [authenticateToken],
      handler: controller.createTemplate,
      description: 'Create WhatsApp template'
    },
    {
      method: 'GET',
      path: '/whatsapp/templates',
      middleware: [authenticateToken],
      handler: controller.getTemplates,
      description: 'Get all WhatsApp templates'
    },
    {
      method: 'GET',
      path: '/whatsapp/templates/:id',
      middleware: [authenticateToken],
      handler: controller.getTemplateById,
      description: 'Get template by ID'
    },
    {
      method: 'PUT',
      path: '/whatsapp/templates/:id',
      middleware: [authenticateToken],
      handler: controller.updateTemplate,
      description: 'Update WhatsApp template'
    },
    {
      method: 'DELETE',
      path: '/whatsapp/templates/:id',
      middleware: [authenticateToken],
      handler: controller.deleteTemplate,
      description: 'Delete WhatsApp template'
    },
    {
      method: 'PATCH',
      path: '/whatsapp/templates/:id/toggle',
      middleware: [authenticateToken],
      handler: controller.toggleTemplateStatus,
      description: 'Toggle template active status'
    }
  ],

  registerRoutes(router) {
    this.routes.forEach(route => {
      const { method, path, middleware, handler } = route;
      if (middleware && middleware.length) {
        router.addRoute(method, path, [...middleware, handler]);
      } else {
        router.addRoute(method, path, handler);
      }
    });
  }
};

module.exports = whatsappTemplateRoutes;
