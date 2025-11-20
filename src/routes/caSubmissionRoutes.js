// routes/caSubmission.routes.js
const CaSubmissionController = require('../controllers/CaSubmissionController');
const { authenticateToken } = require('../middleware/auth');

const caSubmissionRoutes = {
  routes: [
    // ==================== IMPORT ROUTES ====================
    {
      method: 'POST',
      path: '/ca/import',
      middleware: [],
      handler: CaSubmissionController.importExcel,
      description: 'Import CA submission data from Excel file'
    },
    
    // ==================== CRUD ROUTES ====================
    {
      method: 'POST',
      path: '/ca/submissions',
      middleware: [],
      handler: CaSubmissionController.createSubmission,
      description: 'Create a new CA submission manually'
    },
    
    {
      method: 'GET',
      path: '/ca/submissions',
      middleware: [authenticateToken],
      handler: CaSubmissionController.getSubmissions,
      description: 'Get all CA submissions with pagination and filtering'
    },
    
    {
      method: 'GET',
      path: '/ca/submissions/:id',
      middleware: [authenticateToken],
      handler: CaSubmissionController.getSubmissionById,
      description: 'Get a single CA submission by ID'
    },
    
    {
      method: 'PUT',
      path: '/ca/submissions/:id',
      middleware: [authenticateToken],
      handler: CaSubmissionController.updateSubmission,
      description: 'Update an existing CA submission by ID'
    },
    
    {
      method: 'DELETE',
      path: '/ca/submissions/:id',
      middleware: [authenticateToken],
      handler: CaSubmissionController.deleteSubmission,
      description: 'Delete a CA submission by ID'
    },
    
    {
      method: 'DELETE',
      path: '/ca/submissions/bulk',
      middleware: [authenticateToken],
      handler: CaSubmissionController.bulkDelete,
      description: 'Bulk delete multiple CA submissions'
    },
    
    // ==================== SEARCH ROUTES ====================
    {
      method: 'GET',
      path: '/ca/search',
      middleware: [authenticateToken],
      handler: CaSubmissionController.searchSubmissions,
      description: 'Search CA submissions using full-text search'
    },
    
    // ==================== STATISTICS ROUTES ====================
    {
      method: 'GET',
      path: '/ca/stats',
      middleware: [authenticateToken],
      handler: CaSubmissionController.getStats,
      description: 'Get aggregated statistics of CA submissions'
    },
    
    {
      method: 'GET',
      path: '/ca/stats/services',
      middleware: [authenticateToken],
      handler: CaSubmissionController.getServiceStats,
      description: 'Get detailed service statistics'
    },

    {
      method: 'PATCH',
      path: '/ca/submissions/:id/active',
      handler: CaSubmissionController.toggleActiveStatus,
      description: 'Toggle or set isActive status for a CA submission'
    },
    // ==================== SERVICE-SPECIFIC ROUTES ====================
    {
      method: 'GET',
      path: '/ca/by-service/:serviceKey',
      middleware: [authenticateToken],
      handler: CaSubmissionController.getByService,
      description: 'Get CAs offering a specific service'
    },
    
    // ==================== HEALTH CHECK ====================
    {
      method: 'GET',
      path: '/ca/health',
      middleware: [],
      handler: async (request, context) => {
        return {
          status: 200,
          jsonBody: {
            success: true,
            message: 'CA Submission API is running',
            timestamp: new Date().toISOString()
          }
        };
      },
      description: 'Health check endpoint (no authentication required)'
    },
    
  ],
  
  registerRoutes: function(router) {
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

module.exports = caSubmissionRoutes;