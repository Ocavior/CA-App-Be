// src/knowledge-base/services/KnowledgeLogService.js
const KnowledgeLog = require('../models/KnowledgeLog');
const { recordLog } = require('../logs/knowledgeLogger');

class KnowledgeLogService {
  static async getAllLogs(params = {}) {
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    if (params.action) {
      query.action = params.action;
    }

    if (params.entityType) {
      query.entityType = params.entityType;
    }

    if (params.entityId) {
      query.entityId = params.entityId;
    }

    if (params.status) {
      query.status = params.status;
    }

    if (params.startDate || params.endDate) {
      query.createdAt = {};
      if (params.startDate) {
        query.createdAt.$gte = new Date(params.startDate);
      }
      if (params.endDate) {
        query.createdAt.$lte = new Date(params.endDate);
      }
    }

    const [logs, totalCount] = await Promise.all([
      KnowledgeLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      KnowledgeLog.countDocuments(query)
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  static async getLogStats() {
    const [byAction, byEntityType, byStatus] = await Promise.all([
      KnowledgeLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ]),
      KnowledgeLog.aggregate([
        { $group: { _id: '$entityType', count: { $sum: 1 } } }
      ]),
      KnowledgeLog.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const stats = {
      total: 0,
      actions: {},
      entities: {},
      status: {}
    };

    byAction.forEach(item => {
      stats.actions[item._id] = item.count;
      stats.total += item.count;
    });

    byEntityType.forEach(item => {
      stats.entities[item._id] = item.count;
    });

    byStatus.forEach(item => {
      stats.status[item._id] = item.count;
    });

    return stats;
  }

  static async recordManualLog(payload, user = {}) {
    return await recordLog({
      action: payload.action || 'system_event',
      entityType: payload.entityType || 'system',
      entityId: payload.entityId || null,
      entityTitle: payload.entityTitle || '',
      performedBy: user,
      details: payload.details || {},
      status: payload.status || 'success',
      ipAddress: payload.ipAddress || '',
      userAgent: payload.userAgent || ''
    });
  }
}

module.exports = KnowledgeLogService;
