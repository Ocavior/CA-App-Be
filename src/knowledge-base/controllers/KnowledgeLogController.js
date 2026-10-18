// src/knowledge-base/controllers/KnowledgeLogController.js
const KnowledgeLogService = require('../services/KnowledgeLogService');

class KnowledgeLogController {
  static async getLogs(request, context) {
    try {
      const query = request.query || {};
      const result = await KnowledgeLogService.getAllLogs(query);

      return {
        status: 200,
        jsonBody: { success: true, data: result.logs, pagination: result.pagination }
      };
    } catch (err) {
      if (context && context.error) context.error('Get KB logs error:', err);
      return {
        status: 500,
        jsonBody: { success: false, message: 'Failed to fetch logs' }
      };
    }
  }

  static async getLogStats(request, context) {
    try {
      const data = await KnowledgeLogService.getLogStats();
      return {
        status: 200,
        jsonBody: { success: true, data }
      };
    } catch (err) {
      if (context && context.error) context.error('Get KB log stats error:', err);
      return {
        status: 500,
        jsonBody: { success: false, message: 'Failed to fetch log statistics' }
      };
    }
  }

  static async recordLog(request, context) {
    try {
      const payload = (await request.json()) || {};
      const user = context.user || {};
      const data = await KnowledgeLogService.recordManualLog(payload, user);

      return {
        status: 201,
        jsonBody: { success: true, message: 'Log entry recorded', data }
      };
    } catch (err) {
      if (context && context.error) context.error('Record KB log error:', err);
      return {
        status: 500,
        jsonBody: { success: false, message: err.message || 'Failed to record log' }
      };
    }
  }
}

module.exports = KnowledgeLogController;
