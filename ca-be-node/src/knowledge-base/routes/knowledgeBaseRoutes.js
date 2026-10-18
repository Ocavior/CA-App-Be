// src/knowledge-base/routes/knowledgeBaseRoutes.js
const KnowledgeBaseController = require('../controllers/KnowledgeBaseController');
const KnowledgeTaskController = require('../controllers/KnowledgeTaskController');
const KnowledgeLogController = require('../controllers/KnowledgeLogController');
const { authenticateToken } = require('../../middleware/auth');

const knowledgeBaseRoutes = {
  routes: [
    // --- KNOWLEDGE BASE ARTICLES ---
    {
      method: 'POST',
      path: '/ca/knowledge-base',
      middleware: [authenticateToken],
      handler: KnowledgeBaseController.createArticle,
      description: 'Create a new knowledge base article'
    },
    {
      method: 'GET',
      path: '/ca/knowledge-base',
      handler: KnowledgeBaseController.getArticles,
      description: 'List knowledge base articles with search and filtering'
    },
    {
      method: 'GET',
      path: '/ca/knowledge-base/categories',
      handler: KnowledgeBaseController.getCategories,
      description: 'Get all categories with article counts'
    },
    {
      method: 'GET',
      path: '/ca/knowledge-base/:id',
      handler: KnowledgeBaseController.getArticleById,
      description: 'Get a single knowledge base article by ID or slug'
    },
    {
      method: 'PUT',
      path: '/ca/knowledge-base/:id',
      middleware: [authenticateToken],
      handler: KnowledgeBaseController.updateArticle,
      description: 'Update a knowledge base article'
    },
    {
      method: 'DELETE',
      path: '/ca/knowledge-base/:id',
      middleware: [authenticateToken],
      handler: KnowledgeBaseController.deleteArticle,
      description: 'Delete a knowledge base article'
    },
    {
      method: 'PATCH',
      path: '/ca/knowledge-base/:id/status',
      middleware: [authenticateToken],
      handler: KnowledgeBaseController.updateStatus,
      description: 'Update the status of a knowledge base article'
    },

    // --- KNOWLEDGE BASE TASKS ---
    {
      method: 'POST',
      path: '/ca/knowledge-base/tasks',
      middleware: [authenticateToken],
      handler: KnowledgeTaskController.createTask,
      description: 'Create a new knowledge base task'
    },
    {
      method: 'GET',
      path: '/ca/knowledge-base/tasks',
      middleware: [authenticateToken],
      handler: KnowledgeTaskController.getTasks,
      description: 'List knowledge base tasks'
    },
    {
      method: 'GET',
      path: '/ca/knowledge-base/tasks/stats',
      middleware: [authenticateToken],
      handler: KnowledgeTaskController.getTaskStats,
      description: 'Get task statistics by status and priority'
    },
    {
      method: 'POST',
      path: '/ca/knowledge-base/tasks/run-maintenance',
      middleware: [authenticateToken],
      handler: KnowledgeTaskController.runMaintenanceTask,
      description: 'Run automated maintenance to generate periodic review tasks and check overdue tasks'
    },
    {
      method: 'GET',
      path: '/ca/knowledge-base/tasks/:id',
      middleware: [authenticateToken],
      handler: KnowledgeTaskController.getTaskById,
      description: 'Get a single task by ID'
    },
    {
      method: 'PUT',
      path: '/ca/knowledge-base/tasks/:id',
      middleware: [authenticateToken],
      handler: KnowledgeTaskController.updateTask,
      description: 'Update a task'
    },
    {
      method: 'PATCH',
      path: '/ca/knowledge-base/tasks/:id/status',
      middleware: [authenticateToken],
      handler: KnowledgeTaskController.updateTaskStatus,
      description: 'Update task status and resolution notes'
    },
    {
      method: 'DELETE',
      path: '/ca/knowledge-base/tasks/:id',
      middleware: [authenticateToken],
      handler: KnowledgeTaskController.deleteTask,
      description: 'Delete a task'
    },

    // --- AUDIT & ACTIVITY LOGS ---
    {
      method: 'GET',
      path: '/ca/knowledge-base/logs',
      middleware: [authenticateToken],
      handler: KnowledgeLogController.getLogs,
      description: 'Query knowledge base activity and audit logs'
    },
    {
      method: 'GET',
      path: '/ca/knowledge-base/logs/stats',
      middleware: [authenticateToken],
      handler: KnowledgeLogController.getLogStats,
      description: 'Get knowledge base log statistics'
    },
    {
      method: 'POST',
      path: '/ca/knowledge-base/logs',
      middleware: [authenticateToken],
      handler: KnowledgeLogController.recordLog,
      description: 'Record a custom/external log entry'
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

module.exports = knowledgeBaseRoutes;
