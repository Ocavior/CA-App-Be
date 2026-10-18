// src/knowledge-base/models/KnowledgeBase.js
const mongoose = require('mongoose');

const KnowledgeBaseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true,
    default: 'general'
  },
  tags: {
    type: [String],
    default: [],
    index: true
  },
  summary: {
    type: String,
    trim: true,
    default: ''
  },
  content: {
    type: String,
    required: true
  },
  author: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    name: { type: String, default: 'Admin' },
    email: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  priority: {
    type: Number,
    default: 0
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  viewsCount: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastReviewedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound/text indices
KnowledgeBaseSchema.index({ title: 'text', content: 'text', tags: 'text', summary: 'text' });
KnowledgeBaseSchema.index({ status: 1, category: 1, isPinned: -1, createdAt: -1 });

const KnowledgeBase = mongoose.model('KnowledgeBase', KnowledgeBaseSchema);

module.exports = KnowledgeBase;
