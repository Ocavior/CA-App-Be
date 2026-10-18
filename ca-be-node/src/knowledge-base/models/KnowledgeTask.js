// src/knowledge-base/models/KnowledgeTask.js
const mongoose = require('mongoose');

const KnowledgeTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgeBase',
    default: null
  },
  taskType: {
    type: String,
    enum: ['review', 'update', 'verification', 'create', 'audit', 'system_maintenance'],
    default: 'review',
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    name: { type: String, default: '' },
    email: { type: String, default: '' }
  },
  createdBy: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    name: { type: String, default: 'System' },
    email: { type: String, default: '' }
  },
  dueDate: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  resolutionNotes: {
    type: String,
    trim: true,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

KnowledgeTaskSchema.index({ status: 1, priority: 1, dueDate: 1 });

const KnowledgeTask = mongoose.model('KnowledgeTask', KnowledgeTaskSchema);

module.exports = KnowledgeTask;
