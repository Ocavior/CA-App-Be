// routes/caSubmission.routes.js
const CaSubmissionController = require('../controllers/CaSubmissionController');
const { authenticateToken } = require('../middleware/auth');
const caSubmissionRoutes = {
  routes: [
    // Import Excel file
    {
      method: 'POST',
      path: '/ca/import',
      middleware: [authenticateToken],
      handler: CaSubmissionController.importExcel,
      description: 'Import CA submission data from Excel file'
    },
    
    // Get all submissions with pagination and filtering
    {
      method: 'GET',
      path: '/ca/submissions',
      middleware: [authenticateToken],
      handler: CaSubmissionController.getSubmissions,
      description: 'Get all CA submissions with pagination and filtering'
    },
    
    // Get single submission by ID
    {
      method: 'GET',
      path: '/ca/submissions/:id',
      middleware: [authenticateToken],
      handler: CaSubmissionController.getSubmissionById,
      description: 'Get a single CA submission by ID'
    },
    
    // Search submissions
    {
      method: 'GET',
      path: '/ca/search',
      middleware: [authenticateToken],
      handler: CaSubmissionController.searchSubmissions,
      description: 'Search CA submissions using text search'
    },
    
    // Get statistics
    {
      method: 'GET',
      path: '/ca/stats',
      middleware: [authenticateToken],
      handler: CaSubmissionController.getStats,
      description: 'Get aggregated statistics of CA submissions'
    },
    
    // Delete submission
    {
      method: 'DELETE',
      path: '/ca/submissions/:id',
      middleware: [authenticateToken],
      handler: CaSubmissionController.deleteSubmission,
      description: 'Delete a CA submission by ID'
    }
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