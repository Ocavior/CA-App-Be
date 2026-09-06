// models/CaSubmission.js
const mongoose = require('mongoose');
const { last10Digits } = require('../utils/phoneUtils');

// Sub-service offering: alias -> whether the CA offers it
// Individual service schema - stores offered flag, free-text overflow, and
// structured sub-service flags. Service/sub-service master data (names,
// aliases, the list of what exists) now lives in the Service collection
// (models/service.js) instead of being hardcoded here.
const ServiceDetailSchema = new mongoose.Schema({
  offered: { type: Boolean, default: false },        // Whether they offer this service
  details: { type: String, trim: true },              // Free-text overflow: raw/unmatched text from import, or manual notes
  subServices: {
    type: Map,
    of: Boolean,                                       // sub-service alias -> offered
    default: () => new Map()
  }
}, { _id: false });

const CaSubmissionSchema = new mongoose.Schema({
  // ==================== BASIC INFORMATION ====================
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // ==================== CONTACT INFORMATION ====================
  mobile: {
    type: String,
    trim: true,
    index: true
  },

  // Last 10 digits of `mobile`, kept in sync via the pre-save/pre-update
  // hooks below. Lets duplicate-matching do an indexed exact-match lookup
  // instead of a suffix regex on `mobile` (which can't use a B-tree index
  // and forces a full collection scan on every match attempt).
  mobileLast10: {
    type: String,
    index: true
  },

  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: true,
    sparse: true
  },

  newEmail: {
    type: String,
    trim: true,
    lowercase: true
  },

  whatsappNumber: {
    type: String,
    trim: true
  },

  // ==================== LOCATION INFORMATION ====================
  state: {
    type: String,
    trim: true,
    index: true
  },

  city: {
    type: String,
    trim: true,
    index: true
  },

  otherBranches: [{
    type: String,
    trim: true
  }],

  // ==================== SERVICES INFORMATION ====================
  // Top 3 priority services
  top3Services: [{
    type: String,
    trim: true
  }],

  // Detailed service offerings - keyed by Service.alias (dynamic, not a
  // fixed field list). Each entry: { offered, details, subServices }.
  // Stored as a Map so it serializes to a plain object on .lean()/.toJSON()
  // (e.g. services.incomeTax.offered) exactly like the old fixed-field shape.
  services: {
    type: Map,
    of: ServiceDetailSchema,
    default: () => new Map()
  },

  // Additional service-specific details
  foreignWhichCountry: {
    type: String,
    trim: true
  },

  govtSubsidiesWhichState: {
    type: String,
    trim: true
  },

  otherServices: {
    type: String,
    trim: true
  },

  // ==================== ADDITIONAL INFORMATION ====================
  remarks: {
    type: String,
    trim: true
  },

  projectHelpDetails: {
    type: String,
    trim: true
  },

  employer: {
    type: String,
    trim: true
  },

  formFiledBy: {
    type: String,
    trim: true
  },

  // ==================== METADATA ====================
  source: {
    type: String,
    enum: ['manual', 'csv_import', 'api', 'web_form'],
    default: 'manual'
  },

  importedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Store original CSV row for debugging (only for imports)
  rawData: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// ==================== INDEXES ====================
// Compound indexes for common queries
CaSubmissionSchema.index({ name: 1, mobile: 1 });
CaSubmissionSchema.index({ state: 1, city: 1 });
CaSubmissionSchema.index({ createdAt: -1 });
CaSubmissionSchema.index({ timestamp: -1 });
CaSubmissionSchema.index({ source: 1, createdAt: -1 });

// Text index for full-text search
CaSubmissionSchema.index({
  name: 'text',
  city: 'text',
  state: 'text',
  remarks: 'text',
  otherServices: 'text',
  employer: 'text'
});

// ==================== VIRTUALS ====================
// Get list of service aliases offered (boolean true).
// NOTE: this returns aliases, not display names - resolving display names
// now requires a DB lookup against the Service collection (see
// ServiceManagementService.getAllServices), which a synchronous virtual
// can't do.
CaSubmissionSchema.virtual('offeredServiceAliases').get(function () {
  const offered = [];
  const entries = this.services instanceof Map
    ? this.services.entries()
    : Object.entries(this.services || {});
  for (const [alias, value] of entries) {
    if (value && value.offered) offered.push(alias);
  }
  return offered;
});

// Get count of services offered
CaSubmissionSchema.virtual('serviceCount').get(function () {
  let count = 0;
  const values = this.services instanceof Map
    ? this.services.values()
    : Object.values(this.services || {});
  for (const value of values) {
    if (value && value.offered) count++;
  }
  return count;
});

// ==================== METHODS ====================
// Instance method to update a service (creates the entry if it doesn't exist yet)
CaSubmissionSchema.methods.updateService = function (serviceAlias, offered, details = null) {
  const current = this.services.get(serviceAlias) || {};
  this.services.set(serviceAlias, {
    ...current,
    offered,
    ...(details !== null ? { details } : {})
  });
  return this;
};

// Instance method to get service details
CaSubmissionSchema.methods.getService = function (serviceAlias) {
  return this.services.get(serviceAlias);
};

// ==================== STATIC METHODS ====================
// Find CAs offering a specific service
CaSubmissionSchema.statics.findByService = function (serviceAlias) {
  const query = {};
  query[`services.${serviceAlias}.offered`] = true;
  return this.find(query);
};

// Find CAs by location
CaSubmissionSchema.statics.findByLocation = function (state, city = null) {
  const query = { state };
  if (city) query.city = city;
  return this.find(query);
};

// Find CAs offering multiple services
CaSubmissionSchema.statics.findByServices = function (serviceAliases) {
  const query = {
    $and: serviceAliases.map(alias => ({
      [`services.${alias}.offered`]: true
    }))
  };
  return this.find(query);
};

// ==================== VALIDATION ====================
// Pre-save validation
CaSubmissionSchema.pre('save', function (next) {
  // Clean up phone numbers
  if (this.mobile) {
    this.mobile = this.mobile.replace(/[^\d+]/g, '');
    this.mobileLast10 = last10Digits(this.mobile);
  }

  // Validate email format
  if (this.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.email = undefined;
    }
  }

  next();
});

// Keep mobileLast10 in sync for update-style writes too (findByIdAndUpdate,
// findOneAndUpdate, the CSV-import upsert) - these bypass pre('save').
CaSubmissionSchema.pre(['findOneAndUpdate', 'updateOne'], function (next) {
  const update = this.getUpdate() || {};
  const target = update.$set || update;
  const mobile = target.mobile;

  if (mobile !== undefined) {
    if (!update.$set) update.$set = {};
    update.$set.mobile = String(mobile).replace(/[^\d+]/g, '');
    update.$set.mobileLast10 = last10Digits(update.$set.mobile);
  }

  next();
});

// ==================== EXPORT ====================
const CaSubmission = mongoose.model('CaSubmission', CaSubmissionSchema);

module.exports = CaSubmission;
