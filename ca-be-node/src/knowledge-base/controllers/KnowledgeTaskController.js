// src/knowledge-base/controllers/KnowledgeTaskController.js
const KnowledgeTaskService = require('../services/KnowledgeTaskService');
const { runMaintenance } = require('../tasks/maintenanceTask');

class KnowledgeTaskController {
  static async createTask(request, context) {
    try {
      const payload = (await request.json()) || {};
      const user = context.user || {};
      const data = await KnowledgeTaskService.createTask(payload, user);

      return {
        status: 201,
        jsonBody: { success: true, message: 'Knowledge task created successfully', data }
      };
    } catch (err) {
      if (context && context.error) context.error('Create task error:', err);
      return {
        status: err.statusCode || 500,
        jsonBody: { success: false, message: err.message || 'Failed to create task' }
      };
    }
  }

  static async getTasks(request, context) {
    try {
      const query = request.query || {};
      const result = await KnowledgeTaskService.getAllTasks(query);

      return {
        status: 200,
        jsonBody: { success: true, data: result.tasks, pagination: result.pagination }
      };
    } catch (err) {
      if (context && context.error) context.error('Get tasks error:', err);
      return {
        status: 500,
        jsonBody: { success: false, message: 'Failed to fetch tasks' }
      };
    }
  }

  static async getTaskById(request, context) {
    try {
      const { id } = request.params || {};
      const data = await KnowledgeTaskService.getTaskById(id);

      if (!data) {
        return {
          status: 404,
          jsonBody: { success: false, message: 'Task not found' }
        };
      }

      return {
        status: 200,
        jsonBody: { success: true, data }
      };
    } catch (err) {
      if (context && context.error) context.error('Get task error:', err);
      return {
        status: err.name === 'CastError' ? 400 : 500,
        jsonBody: { success: false, message: err.name === 'CastError' ? 'Invalid task ID' : 'Failed to fetch task' }
      };
    }
  }

  static async updateTask(request, context) {
    try {
      const { id } = request.params || {};
      const payload = (await request.json()) || {};
      const user = context.user || {};

      const data = await KnowledgeTaskService.updateTask(id, payload, user);

      return {
        status: 200,
        jsonBody: { success: true, message: 'Task updated successfully', data }
      };
    } catch (err) {
      if (context && context.error) context.error('Update task error:', err);
      return {
        status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
        jsonBody: { success: false, message: err.message || 'Failed to update task' }
      };
    }
  }

  static async updateTaskStatus(request, context) {
    try {
      const { id } = request.params || {};
      const payload = (await request.json()) || {};
      const user = context.user || {};

      if (!payload.status) {
        return {
          status: 400,
          jsonBody: { success: false, message: 'Status is required' }
        };
      }

      const data = await KnowledgeTaskService.updateTaskStatus(
        id,
        payload.status,
        payload.resolutionNotes || '',
        user
      );

      return {
        status: 200,
        jsonBody: { success: true, message: `Task status updated to ${payload.status}`, data }
      };
    } catch (err) {
      if (context && context.error) context.error('Update task status error:', err);
      return {
        status: err.statusCode || 500,
        jsonBody: { success: false, message: err.message || 'Failed to update task status' }
      };
    }
  }

  static async deleteTask(request, context) {
    try {
      const { id } = request.params || {};
      const user = context.user || {};
      const data = await KnowledgeTaskService.deleteTask(id, user);

      return {
        status: 200,
        jsonBody: { success: true, message: 'Task deleted successfully', data }
      };
    } catch (err) {
      if (context && context.error) context.error('Delete task error:', err);
      return {
        status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
        jsonBody: { success: false, message: err.message || 'Failed to delete task' }
      };
    }
  }

  static async getTaskStats(request, context) {
    try {
      const data = await KnowledgeTaskService.getTaskStats();
      return {
        status: 200,
        jsonBody: { success: true, data }
      };
    } catch (err) {
      if (context && context.error) context.error('Get task stats error:', err);
      return {
        status: 500,
        jsonBody: { success: false, message: 'Failed to fetch task statistics' }
      };
    }
  }

  static async runMaintenanceTask(request, context) {
    try {
      const payload = (await request.json()) || {};
      const user = context.user || {};
      const staleThresholdDays = payload.staleThresholdDays ? parseInt(payload.staleThresholdDays, 10) : 90;

      const data = await runMaintenance({ staleThresholdDays, user });

      return {
        status: 200,
        jsonBody: { success: true, message: 'Maintenance run completed', data }
      };
    } catch (err) {
      if (context && context.error) context.error('Run maintenance error:', err);
      return {
        status: 500,
        jsonBody: { success: false, message: err.message || 'Failed to execute maintenance run' }
      };
    }
  }
}

module.exports = KnowledgeTaskController;
