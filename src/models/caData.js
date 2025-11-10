// models/CaSubmission.js
const mongoose = require('mongoose');

// Service list for validation
const SERVICES = [
  'Income Tax Consultancy',
  'GST Law Consultancy',
  'Company Law Consultancy',
  'INTERNATIONAL_TAX_CONSULTANCY',
  'Start-Up Consultancy',
  'ACCOUNTING',
  'Investment & Succession Planning',
  'REGISTRATION SERVICES',
  'Audits',
  'FEMA, FCRA',
  'PMLA, Benami & Black Money Consultancy',
  'NBFC ASSISTANCE',
  'GEM PORTAL Support',
  'FORENSIC ANALYSIS/Audit/Investigation',
  'IBC CONSULTANCY',
  'VALUATION SERVICES',
  'IND-AS CONSULTANCY',
  'VIRTUAL CEOs/CFOs/Independent directors',
  'COMPETITION ACT CONSULTANCY',
  'IPO Consulting',
  'SEZ Consulting',
  'Foreign Accounting & Taxation',
  'Govt subsidies'
];

// Service flags schema for 23 checkbox services
const ServiceFlagsSchema = new mongoose.Schema({
  incomeTaxConsultancy: { type: Boolean, default: false },          // 1
  gstLawConsultancy: { type: Boolean, default: false },              // 2
  companyLawConsultancy: { type: Boolean, default: false },          // 3
  internationalTaxConsultancy: { type: Boolean, default: false },    // 4
  startupConsultancy: { type: Boolean, default: false },             // 5
  accounting: { type: Boolean, default: false },                     // 6
  investmentSuccession: { type: Boolean, default: false },           // 7
  registrationServices: { type: Boolean, default: false },           // 8
  audits: { type: Boolean, default: false },                         // 9
  femaFcra: { type: Boolean, default: false },                       // 10
  pmlaBenamiBlackMoney: { type: Boolean, default: false },           // 11
  nbfcAssistance: { type: Boolean, default: false },                 // 12
  gemPortalSupport: { type: Boolean, default: false },               // 13
  forensicAnalysisAuditInvestigation: { type: Boolean, default: false }, // 14
  ibcConsultancy: { type: Boolean, default: false },                 // 15
  valuationServices: { type: Boolean, default: false },              // 16
  indAsConsultancy: { type: Boolean, default: false },               // 17
  virtualCXO: { type: Boolean, default: false },                     // 18
  competitionActConsultancy: { type: Boolean, default: false },      // 19
  ipoConsulting: { type: Boolean, default: false },                  // 20
  sezConsulting: { type: Boolean, default: false },                  // 21
  foreignAccountingTaxation: { type: Boolean, default: false },      // 22
  govtSubsidies: { type: Boolean, default: false }                   // 23
}, { _id: false });

const CaSubmissionSchema = new mongoose.Schema({
  // Basic Information
  timestamp: { type: Date, default: Date.now },    // "Timestamp"
  name: { type: String, required: true, trim: true, index: true }, // "Name"

  // Contact Information
  mobile: { type: String, trim: true, index: true },              // "Mobile"
  email: { type: String, trim: true, lowercase: true, index: true }, // "Email"
  newEmail: { type: String, trim: true, lowercase: true },        // "New Email"
  whatsappNumber: { type: String, trim: true },                   // "WhatsApp Number"

  // Location Information
  state: { type: String, trim: true, index: true },               // "State"
  city: { type: String, trim: true, index: true },                // "City"
  otherBranches: [{ type: String, trim: true }],                  // "Other Branches"

  // Services Information
  top3Services: [{
    type: String,
    trim: true
  }],                                                              // "Top 3 Services"
  
  serviceFlags: { 
    type: ServiceFlagsSchema, 
    default: () => ({}) 
  },                                                               // Service checkboxes (1-23)

  // Additional Service Details
  foreignWhichCountry: { type: String, trim: true },              // For service #22
  govtSubsidiesWhichState: { type: String, trim: true },          // For service #23
  otherServices: { type: String, trim: true },                    // "Other Services"

  // Additional Information
  remarks: { type: String, trim: true },                          // "Remarks"
  projectHelpDetails: { type: String, trim: true },               // "If you have any project..."
  employer: { type: String, trim: true },                         // "If you are in job..."
  formFiledBy: { type: String, trim: true },                      // "Form Filed By"

  // Metadata
  rawRow: { type: mongoose.Schema.Types.Mixed },                  // Store original row for debugging
  importedAt: { type: Date, default: Date.now }
}, {
  timestamps: true // adds createdAt, updatedAt
});

// Indexes for better query performance
CaSubmissionSchema.index({ name: 1, mobile: 1 });
CaSubmissionSchema.index({ email: 1 }, { sparse: true });
CaSubmissionSchema.index({ state: 1, city: 1 });
CaSubmissionSchema.index({ createdAt: -1 });
CaSubmissionSchema.index({ timestamp: -1 });

// Text index for search functionality
CaSubmissionSchema.index({
  name: 'text',
  city: 'text',
  state: 'text',
  remarks: 'text',
  otherServices: 'text',
  employer: 'text'
});

module.exports = mongoose.model('CaSubmission', CaSubmissionSchema);
module.exports.SERVICES = SERVICES;