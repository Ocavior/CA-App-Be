// models/service.js
const mongoose = require('mongoose');

const SubServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  alias: {
    type: String,
    required: true,
    trim: true
  },
  isOfferedDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    enum: ['seed', 'manual', 'csv_import'],
    default: 'manual'
  }
}, {
  timestamps: true
});

const ServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  alias: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    enum: ['seed', 'manual', 'csv_import'],
    default: 'manual'
  },
  subServices: {
    type: [SubServiceSchema],
    default: []
  }
}, {
  timestamps: true
});

const Service = mongoose.model('Service', ServiceSchema);

module.exports = Service;
