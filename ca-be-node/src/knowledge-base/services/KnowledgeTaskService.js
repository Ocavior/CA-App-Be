// src/knowledge-base/services/KnowledgeTaskService.js
const KnowledgeTask = require('../models/KnowledgeTask');
const KnowledgeBase = require('../models/KnowledgeBase');
const { recordLog } = require('../logs/knowledgeLogger');

class KnowledgeTaskService {
  static async createTask(payload, user = {}) {
    if (!payload.title) {
      const err = new Error('Task title is required');
      err.statusCode = 400;
      throw err;
    }

    if (payload.articleId) {
      const article = await KnowledgeBase.findById(payload.articleId);
      if (!article) {
        const err = new Error('Referenced knowledge base article does not exist');
        err.statusCode = 404;
        throw err;
      }
    }

    const task = new KnowledgeTask({
      title: payload.title.trim(),
      description: payload.description ? payload.description.trim() : '',
      articleId: payload.articleId || null,
      taskType: payload.taskType || 'review',
      status: payload.status || 'pending',
      priority: payload.priority || 'medium',
      assignedTo: payload.assignedTo || { name: '', email: '' },
      createdBy: {
        id: user.id || user._id || null,
        name: user.name || user.email || 'Admin',
        email: user.email || ''
      },
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      metadata: payload.metadata || {}
    });

    const saved = await task.save();

    await recordLog({
      action: 'task_created',
      entityType: 'task',
      entityId: saved._id,
      entityTitle: saved.title,
      performedBy: user,
      details: { taskType: saved.taskType, priority: saved.priority, articleId: saved.articleId }
    });

    return saved;
  }

  static async getAllTasks(params = {}) {
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    if (params.status) {
      query.status = params.status;
    }

    if (params.priority) {
      query.priority = params.priority;
    }

    if (params.taskType) {
      query.taskType = params.taskType;
    }

    if (params.articleId) {
      query.articleId = params.articleId;
    }

    if (params.q) {
      const escaped = params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ title: regex }, { description: regex }];
    }

    const [tasks, totalCount] = await Promise.all([
      KnowledgeTask.find(query)
        .populate('articleId', 'title slug category status')
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      KnowledgeTask.countDocuments(query)
    ]);

    return {
      tasks,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  static async getTaskById(id) {
    const task = await KnowledgeTask.findById(id)
      .populate('articleId', 'title slug category status')
      .lean();
    return task;
  }

  static async updateTask(id, payload, user = {}) {
    const task = await KnowledgeTask.findById(id);
    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }

    if (payload.title) task.title = payload.title.trim();
    if (payload.description !== undefined) task.description = payload.description.trim();
    if (payload.taskType) task.taskType = payload.taskType;
    if (payload.priority) task.priority = payload.priority;
    if (payload.assignedTo) task.assignedTo = payload.assignedTo;
    if (payload.dueDate !== undefined) task.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
    if (payload.resolutionNotes !== undefined) task.resolutionNotes = payload.resolutionNotes.trim();
    if (payload.metadata) task.metadata = { ...task.metadata, ...payload.metadata };

    const updated = await task.save();

    await recordLog({
      action: 'task_updated',
      entityType: 'task',
      entityId: updated._id,
      entityTitle: updated.title,
      performedBy: user,
      details: { changes: Object.keys(payload) }
    });

    return updated;
  }

  static async updateTaskStatus(id, status, resolutionNotes = '', user = {}) {
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      const err = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const task = await KnowledgeTask.findById(id);
    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }

    const oldStatus = task.status;
    task.status = status;
    if (resolutionNotes) task.resolutionNotes = resolutionNotes.trim();

    if (status === 'completed') {
      task.completedAt = new Date();
    } else if (oldStatus === 'completed' && status !== 'completed') {
      task.completedAt = null;
    }

    const updated = await task.save();

    const action = status === 'completed' ? 'task_completed' : status === 'cancelled' ? 'task_cancelled' : 'task_updated';
    await recordLog({
      action,
      entityType: 'task',
      entityId: updated._id,
      entityTitle: updated.title,
      performedBy: user,
      details: { from: oldStatus, to: status, resolutionNotes }
    });

    return updated;
  }

  static async deleteTask(id, user = {}) {
    const task = await KnowledgeTask.findById(id);
    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }

    await KnowledgeTask.findByIdAndDelete(id);

    await recordLog({
      action: 'delete',
      entityType: 'task',
      entityId: id,
      entityTitle: task.title,
      performedBy: user
    });

    return { id, title: task.title, deleted: true };
  }

  static async getTaskStats() {
    const [byStatus, byPriority] = await Promise.all([
      KnowledgeTask.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      KnowledgeTask.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);

    const stats = {
      total: 0,
      status: {},
      priority: {}
    };

    byStatus.forEach(item => {
      stats.status[item._id] = item.count;
      stats.total += item.count;
    });

    byPriority.forEach(item => {
      stats.priority[item._id] = item.count;
    });

    return stats;
  }
}

module.exports = KnowledgeTaskService;
