// src/knowledge-base/models/KnowledgeLog.js
const mongoose = require('mongoose');

const KnowledgeLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      'create',
      'update',
      'delete',
      'view',
      'status_change',
      'task_created',
      'task_updated',
      'task_completed',
      'task_cancelled',
      'maintenance_run',
      'system_event'
    ],
    required: true,
    index: true
  },
  entityType: {
    type: String,
    enum: ['article', 'task', 'system'],
    required: true,
    index: true
  },
  entityId: {
    type: String,
    default: null,
    index: true
  },
  entityTitle: {
    type: String,
    default: ''
  },
  performedBy: {
    id: { type: String, default: 'system' },
    name: { type: String, default: 'System' },
    email: { type: String, default: '' },
    role: { type: String, default: 'system' }
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['success', 'warning', 'failure'],
    default: 'success'
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

KnowledgeLogSchema.index({ createdAt: -1 });
KnowledgeLogSchema.index({ action: 1, createdAt: -1 });

const KnowledgeLog = mongoose.model('KnowledgeLog', KnowledgeLogSchema);

module.exports = KnowledgeLog;
