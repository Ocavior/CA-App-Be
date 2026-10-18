// src/knowledge-base/index.js
/**
 * Knowledge Base Package for CA-App-Be
 * Contains Knowledge Base articles, task management, and audit logs.
 */

const KnowledgeBase = require('./models/KnowledgeBase');
const KnowledgeTask = require('./models/KnowledgeTask');
const KnowledgeLog = require('./models/KnowledgeLog');

const KnowledgeBaseService = require('./services/KnowledgeBaseService');
const KnowledgeTaskService = require('./services/KnowledgeTaskService');
const KnowledgeLogService = require('./services/KnowledgeLogService');

const KnowledgeBaseController = require('./controllers/KnowledgeBaseController');
const KnowledgeTaskController = require('./controllers/KnowledgeTaskController');
const KnowledgeLogController = require('./controllers/KnowledgeLogController');

const knowledgeBaseRoutes = require('./routes/knowledgeBaseRoutes');
const maintenanceTask = require('./tasks/maintenanceTask');
const knowledgeLogger = require('./logs/knowledgeLogger');

module.exports = {
  // Models
  models: {
    KnowledgeBase,
    KnowledgeTask,
    KnowledgeLog
  },
  KnowledgeBase,
  KnowledgeTask,
  KnowledgeLog,

  // Services
  services: {
    KnowledgeBaseService,
    KnowledgeTaskService,
    KnowledgeLogService
  },
  KnowledgeBaseService,
  KnowledgeTaskService,
  KnowledgeLogService,

  // Controllers
  controllers: {
    KnowledgeBaseController,
    KnowledgeTaskController,
    KnowledgeLogController
  },
  KnowledgeBaseController,
  KnowledgeTaskController,
  KnowledgeLogController,

  // Routes
  routes: knowledgeBaseRoutes,
  registerRoutes: (router) => knowledgeBaseRoutes.registerRoutes(router),

  // Tasks & Workers
  tasks: maintenanceTask,
  runMaintenance: maintenanceTask.runMaintenance,

  // Logging
  logger: knowledgeLogger,
  recordLog: knowledgeLogger.recordLog
};
