// models/CaSubmission.js
const mongoose = require('mongoose');

// Service list for reference
const SERVICES = [
  {
    id: 1,
    name: 'Income Tax Consultancy',
    key: 'incomeTax',
    subServices: ['Compliance', 'Litigation Assessment', 'Litigation CIT Appeal', 'Litigation ITAT', 'Tax Planning', 'Tax Audit', '12A / 80G registration support']
  },
  {
    id: 2,
    name: 'GST Law Consultancy',
    key: 'gstLaw',
    subServices: ['Compliance', 'Litigation Audit Assessment', 'Litigation - Appeals', 'High Court Litigation', 'Opinion', 'REGISTRATIONS']
  },
  {
    id: 3,
    name: 'Company Law Consultancy',
    key: 'companyLaw',
    subServices: ['company incorporation', 'Compliance', 'Litigation', 'Sale/purchase of company', 'Statutory Audit', 'ESI & PF compliance', 'ESI & PF Litigation', 'ESI & PF Registration']
  },
  {
    id: 4,
    name: 'International Tax Consultancy',
    key: 'internationalTax',
    subServices: ['Transaction advisory', 'Transaction structuring', 'CBC reporting', 'TP study', 'TP Audit', 'NRI Tax Advisory']
  },
  {
    id: 5,
    name: 'Start-Up Consultancy',
    key: 'startup',
    subServices: ['Counselling', 'Startup India Registration', 'Fundraising - Debt', 'Fundraising - Equity', 'preparation of financial model, pitch deck etc.']
  },
  {
    id: 6,
    name: 'Accounting',
    key: 'accounting',
    subServices: ['INDIAN ACCOUNTING', 'PREPARATION OF FS/FINALIZATION OF FS']
  },
  {
    id: 7,
    name: 'Investment & Succession Planning',
    key: 'investmentSuccession',
    subServices: ['Investment planning for individual', 'Investment planning for corporates', 'succession planning for businesses', 'project financing /Loan work']
  },
  {
    id: 8,
    name: 'Registration Services',
    key: 'registration',
    subServices: ['FSSAI REGISTRATIONS', 'Trademark, Patent, Copyright Registration', 'ISO REGISTRATIONS', 'legal METROLOGY REGISTRATIONS', 'TRADE LICENSE', 'shops n establishment license', 'RERA LICENSE', 'PSARA', 'TRUST REGISTRATIONS', 'SOCIETY REGISTRATIONS', 'APEDA', 'FACTORY LICENSE', 'Pollution NOC', 'FULL FLEDGED MONEY CHANGER LICENSE REGISTRATIONS (ffmc)', 'PROFESSIONAL TAX REGISTRATIONS', 'SAFTA', 'AGMARK', 'ISBN', 'EPR', 'ISI MARK', 'cdsco - drug license', 'bis certification', 'SOC (all service organisation certification)', 'Insurance Provider Registration (ISNP)']
  },
  {
    id: 9,
    name: 'Audits',
    key: 'audits',
    subServices: ['Bank Audits', 'Revenue Audit', 'Stock Audit', 'System Audit', 'IT Audit', 'Internal Audit or ICFR Audit', 'SOP Preparations (std operating procedure)', 'cyber security audit', 'ISO Audit', 'SOX Audit']
  },
  {
    id: 10,
    name: 'FEMA, FCRA',
    key: 'femaFcra',
    subServices: ['FEMA - Compliance', 'FEMA - Litigation', 'FCRA - Compliance', 'FCRA - Litigation']
  },
  {
    id: 11,
    name: 'PMLA, Benami & Black Money Consultancy',
    key: 'pmlaBenami',
    subServices: ['Preventive analysis', 'Reply To Notice', 'Representation']
  },
  {
    id: 12,
    name: 'NBFC Assistance',
    key: 'nbfc',
    subServices: ['REGISTRATION', 'COMPLIANCES', 'Litigation (no level)']
  },
  {
    id: 13,
    name: 'GEM Portal Support',
    key: 'gemPortal',
    subServices: ['GEM ID/Registration', 'Product Registration', 'Tender Support']
  },
  {
    id: 14,
    name: 'Forensic Analysis/Audit/Investigation',
    key: 'forensic',
    subServices: ['forensic audit under IBC', 'Forensic audit ordered by bank', 'Forensic audit ordered by company', 'INVESTIGATION AND DISPUTE ADVISORY']
  },
  {
    id: 15,
    name: 'IBC Consultancy',
    key: 'ibc',
    subServices: ['Yourself IRP or RP (interim resolution professional or resolution professional)', 'Ibc advisory', 'REPRESENTATION FOR PERSONAL GUARANTORS', 'Liquidation support']
  },
  {
    id: 16,
    name: 'Valuation Services',
    key: 'valuation',
    subServices: ['securities & financial instrument valuation', 'business valuation', 'valuation under IBC', 'valuation for due diligence', 'LAND & BUILDING VALUATIONS', 'Other asset valuation']
  },
  {
    id: 17,
    name: 'IND-AS Consultancy',
    key: 'indAs',
    subServices: ['FS (financial statements) preparation', 'FS conversion', 'Review or consulting on transactions', 'NFRA litigation']
  },
  {
    id: 18,
    name: 'Virtual CEOs/CFOs/Independent Directors',
    key: 'virtualCxo',
    subServices: ['yourself virtual cfo or ceo', 'identification of virtual ceo or cfo', 'yourself independent director', 'identification of independent director']
  },
  {
    id: 19,
    name: 'Competition Act Consultancy',
    key: 'competitionAct',
    subServices: ['preventive analysis', 'reply to notice', 'representation']
  },
  {
    id: 20,
    name: 'IPO Consulting',
    key: 'ipo',
    subServices: ['Sme ipo', 'Underwriting', 'Mainboard ipo', 'FPO', 'Social stock exchange support']
  },
  {
    id: 21,
    name: 'SEZ Consulting',
    key: 'sez',
    subServices: ['Notification', 'de-notification', 'compliances']
  },
  {
    id: 22,
    name: 'Foreign Accounting & Taxation',
    key: 'foreignAccounting',
    subServices: ['Foreign Accounting', 'Foreign Taxation', 'Foreign Audit']
  },
  {
    id: 23,
    name: 'Govt Subsidies',
    key: 'govtSubsidies',
    subServices: []
  }
];

// Individual service schema - stores both flag and details
const ServiceDetailSchema = new mongoose.Schema({
  offered: { type: Boolean, default: false },        // Whether they offer this service
  details: { type: String, trim: true }              // Descriptive text about the service
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

  // Detailed service offerings - Each service has both a flag and details
  services: {
    incomeTax: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    gstLaw: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    companyLaw: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    internationalTax: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    startup: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    accounting: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    investmentSuccession: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    registration: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    audits: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    femaFcra: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    pmlaBenami: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    nbfc: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    gemPortal: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    forensic: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    ibc: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    valuation: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    indAs: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    virtualCxo: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    competitionAct: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    ipo: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    sez: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    foreignAccounting: {
      type: ServiceDetailSchema,
      default: () => ({})
    },
    govtSubsidies: {
      type: ServiceDetailSchema,
      default: () => ({})
    }
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
CaSubmissionSchema.index({ email: 1 }, { sparse: true });
CaSubmissionSchema.index({ createdAt: -1 });
CaSubmissionSchema.index({ timestamp: -1 });
CaSubmissionSchema.index({ source: 1, createdAt: -1 });

// Service offering indexes for filtering
CaSubmissionSchema.index({ 'services.incomeTax.offered': 1 });
CaSubmissionSchema.index({ 'services.gstLaw.offered': 1 });
CaSubmissionSchema.index({ 'services.companyLaw.offered': 1 });

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
// Get list of all services offered (boolean true)
CaSubmissionSchema.virtual('offeredServices').get(function () {
  const offered = [];
  for (const [key, value] of Object.entries(this.services)) {
    if (value && value.offered) {
      const service = SERVICES.find(s => s.key === key);
      offered.push(service ? service.name : key);
    }
  }
  return offered;
});

// Get count of services offered
CaSubmissionSchema.virtual('serviceCount').get(function () {
  let count = 0;
  for (const value of Object.values(this.services)) {
    if (value && value.offered) count++;
  }
  return count;
});

// ==================== METHODS ====================
// Instance method to update a service
CaSubmissionSchema.methods.updateService = function (serviceKey, offered, details = null) {
  if (!this.services[serviceKey]) {
    throw new Error(`Invalid service key: ${serviceKey}`);
  }
  this.services[serviceKey].offered = offered;
  if (details !== null) {
    this.services[serviceKey].details = details;
  }
  return this;
};

// Instance method to get service details
CaSubmissionSchema.methods.getService = function (serviceKey) {
  return this.services[serviceKey];
};

// ==================== STATIC METHODS ====================
// Find CAs offering a specific service
CaSubmissionSchema.statics.findByService = function (serviceKey) {
  const query = {};
  query[`services.${serviceKey}.offered`] = true;
  return this.find(query);
};

// Find CAs by location
CaSubmissionSchema.statics.findByLocation = function (state, city = null) {
  const query = { state };
  if (city) query.city = city;
  return this.find(query);
};

// Find CAs offering multiple services
CaSubmissionSchema.statics.findByServices = function (serviceKeys) {
  const query = {
    $and: serviceKeys.map(key => ({
      [`services.${key}.offered`]: true
    }))
  };
  return this.find(query);
};

// Get service statistics
CaSubmissionSchema.statics.getServiceStats = async function () {
  const stats = {};
  for (const service of SERVICES) {
    const count = await this.countDocuments({
      [`services.${service.key}.offered`]: true
    });
    stats[service.name] = count;
  }
  return stats;
};

// ==================== VALIDATION ====================
// Pre-save validation
CaSubmissionSchema.pre('save', function (next) {
  // Clean up phone numbers
  if (this.mobile) {
    this.mobile = this.mobile.replace(/[^\d+]/g, '');
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

// ==================== EXPORT ====================
const CaSubmission = mongoose.model('CaSubmission', CaSubmissionSchema);

module.exports = CaSubmission;
module.exports.SERVICES = SERVICES;