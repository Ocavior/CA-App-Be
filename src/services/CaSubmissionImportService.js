// services/CaSubmissionImportService.js
const XLSX = require('xlsx');
const CaSubmission = require('../models/caData');

// Comprehensive header mapping configuration
const HEADER_MAP = {
  // Basic fields
  'Timestamp': 'timestamp',
  'Name': 'name',
  'Mobile': 'mobile',
  'Email': 'email',
  'Phone': 'mobile',
  'Phone Number': 'mobile',
  'Contact': 'mobile',
  'Mobile Number': 'mobile',
  
  // Contact fields
  'WhatsApp Number': 'whatsappNumber',
  'Whatsapp Number': 'whatsappNumber',
  'New Email': 'newEmail',
  
  // Location fields
  'State': 'state',
  'City': 'city',
  'Other Branches': 'otherBranches',
  
  // Service fields
  'Top 3 Services': 'top3Services',
  
  // Service checkboxes (numbered 1-23)
  '1. Income Tax Consultancy': 'service_1',
  '2. GST Law Consultancy': 'service_2',
  '3. Company Law Consultancy': 'service_3',
  '4. INTERNATIONAL_TAX_CONSULTANCY': 'service_4',
  '5. Start-Up Consultancy': 'service_5',
  '6. ACCOUNTING': 'service_6',
  '7. Investment & Succession Planning': 'service_7',
  '8. REGISTRATION SERVICES': 'service_8',
  '9. Audits': 'service_9',
  '10. FEMA, FCRA': 'service_10',
  '11. PMLA, Benami & Black Money Consultancy': 'service_11',
  '12. NBFC ASSISTANCE': 'service_12',
  '13. GEM PORTAL Support': 'service_13',
  '14. FORENSIC ANALYSIS/Audit/Investigation': 'service_14',
  '15. IBC CONSULTANCY': 'service_15',
  '16. VALUATION SERVICES': 'service_16',
  '17. IND-AS CONSULTANCY': 'service_17',
  '18. VIRTUAL CEOs/CFOs/Independent Directors': 'service_18',
  '19. COMPETITION ACT CONSULTANCY': 'service_19',
  '20. IPO Consulting': 'service_20',
  '21. SEZ Consulting': 'service_21',
  '22. Foreign Accounting & Taxation': 'service_22',
  '23. Govt Subsidies': 'service_23',
  
  // Additional service details
  'Which Country (writing)': 'foreignWhichCountry',
  'Which State (writing)': 'govtSubsidiesWhichState',
  'Other Services': 'otherServices',
  
  // Additional information
  'Remarks': 'remarks',
  'If you have any project which you are unable to deliver on your own, please give details. Our team will call you.': 'projectHelpDetails',
  'If you are in a job, please write the name of the company in which you are working.': 'employer',
  'Form Filed By': 'formFiledBy'
};

// Service flag mapping: maps service_N to the schema field name
const SERVICE_FLAG_MAP = {
  'service_1': 'incomeTaxConsultancy',
  'service_2': 'gstLawConsultancy',
  'service_3': 'companyLawConsultancy',
  'service_4': 'internationalTaxConsultancy',
  'service_5': 'startupConsultancy',
  'service_6': 'accounting',
  'service_7': 'investmentSuccession',
  'service_8': 'registrationServices',
  'service_9': 'audits',
  'service_10': 'femaFcra',
  'service_11': 'pmlaBenamiBlackMoney',
  'service_12': 'nbfcAssistance',
  'service_13': 'gemPortalSupport',
  'service_14': 'forensicAnalysisAuditInvestigation',
  'service_15': 'ibcConsultancy',
  'service_16': 'valuationServices',
  'service_17': 'indAsConsultancy',
  'service_18': 'virtualCXO',
  'service_19': 'competitionActConsultancy',
  'service_20': 'ipoConsulting',
  'service_21': 'sezConsulting',
  'service_22': 'foreignAccountingTaxation',
  'service_23': 'govtSubsidies'
};

function readWorkbook({ buffer, filePath }) {
  if (buffer) {
    return XLSX.read(buffer, { type: 'buffer', cellDates: true });
  }
  if (filePath) {
    return XLSX.readFile(filePath, { cellDates: true });
  }
  throw new Error('No buffer or filePath supplied');
}

function normalizeHeaders(row, headerRowMap) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    const mappedKey = headerRowMap[key] || key.toLowerCase().replace(/\s+/g, '_');
    normalized[mappedKey] = value;
  }
  return normalized;
}

function parseDate(value) {
  if (!value) return null;
  
  // If it's already a Date object
  if (value instanceof Date) {
    return value;
  }
  
  // Try to parse string dates
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  // Try Excel date number (days since 1900-01-01)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0);
    }
  }
  
  return null;
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  
  // Convert to string and remove all non-digit characters except +
  let cleaned = String(phone).replace(/[^\d+]/g, '').trim();
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // If it's just digits and 10 digits long, assume Indian number
  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    return '+91' + cleaned;
  }
  
  return cleaned;
}

function parseTop3Services(value) {
  if (!value) return [];
  
  const str = String(value).trim();
  
  // Split by common delimiters
  const services = str
    .split(/[,;\n\r]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return services.slice(0, 3); // Take only first 3
}

function parseOtherBranches(value) {
  if (!value) return [];
  
  const str = String(value).trim();
  
  // Split by common delimiters
  return str
    .split(/[,;\n\r]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function parseCheckbox(value) {
  if (value === null || value === undefined || value === '') return false;
  
  const str = String(value).toLowerCase().trim();
  
  // Common truthy values in Excel/Google Sheets
  return ['yes', 'y', 'true', '1', 'x', '✓', '✔'].includes(str);
}

function mapRowToDoc(norm) {
  const doc = {};
  
  // Basic fields
  if (norm.timestamp) {
    const parsed = parseDate(norm.timestamp);
    if (parsed) {
      doc.timestamp = parsed;
    }
  }
  
  if (norm.name) {
    doc.name = String(norm.name).trim();
  }
  
  // Contact fields
  if (norm.mobile) {
    doc.mobile = cleanPhoneNumber(norm.mobile);
  }
  
  if (norm.email) {
    const email = String(norm.email).trim().toLowerCase();
    if (email && email.includes('@')) {
      doc.email = email;
    }
  }
  
  if (norm.newEmail) {
    const newEmail = String(norm.newEmail).trim().toLowerCase();
    if (newEmail && newEmail.includes('@')) {
      doc.newEmail = newEmail;
    }
  }
  
  if (norm.whatsappNumber) {
    doc.whatsappNumber = cleanPhoneNumber(norm.whatsappNumber);
  }
  
  // Location fields
  if (norm.state) {
    doc.state = String(norm.state).trim();
  }
  
  if (norm.city) {
    doc.city = String(norm.city).trim();
  }
  
  if (norm.otherBranches) {
    doc.otherBranches = parseOtherBranches(norm.otherBranches);
  }
  
  // Top 3 Services
  if (norm.top3Services) {
    doc.top3Services = parseTop3Services(norm.top3Services);
  }
  
  // Service flags (checkboxes)
  const serviceFlags = {};
  for (const [normKey, schemaKey] of Object.entries(SERVICE_FLAG_MAP)) {
    if (norm[normKey] !== undefined) {
      serviceFlags[schemaKey] = parseCheckbox(norm[normKey]);
    }
  }
  
  if (Object.keys(serviceFlags).length > 0) {
    doc.serviceFlags = serviceFlags;
  }
  
  // Additional service details
  if (norm.foreignWhichCountry) {
    doc.foreignWhichCountry = String(norm.foreignWhichCountry).trim();
  }
  
  if (norm.govtSubsidiesWhichState) {
    doc.govtSubsidiesWhichState = String(norm.govtSubsidiesWhichState).trim();
  }
  
  if (norm.otherServices) {
    doc.otherServices = String(norm.otherServices).trim();
  }
  
  // Additional information
  if (norm.remarks) {
    doc.remarks = String(norm.remarks).trim();
  }
  
  if (norm.projectHelpDetails) {
    doc.projectHelpDetails = String(norm.projectHelpDetails).trim();
  }
  
  if (norm.employer) {
    doc.employer = String(norm.employer).trim();
  }
  
  if (norm.formFiledBy) {
    doc.formFiledBy = String(norm.formFiledBy).trim();
  }
  
  // Store raw row for debugging
  if (norm.__raw) {
    doc.rawRow = norm.__raw;
  }
  
  return doc;
}

async function importFromExcel({ buffer = null, filePath = null, upsert = true } = {}) {
  try {
    const wb = readWorkbook({ buffer, filePath });
    
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets');
    }

    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

    if (!rows.length) {
      return { 
        inserted: 0, 
        updated: 0, 
        skipped: 0, 
        total: 0,
        message: 'No data rows found in Excel file' 
      };
    }

    // Build header mapping from actual headers in the file
    const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
    const headerRowMap = {};
    
    headerRow.forEach(h => {
      const trimmed = (h === undefined || h === null) ? '' : String(h).trim();
      if (HEADER_MAP[trimmed]) {
        headerRowMap[trimmed] = HEADER_MAP[trimmed];
      }
    });

    let inserted = 0, updated = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      
      try {
        const norm = normalizeHeaders(raw, headerRowMap);
        norm.__raw = raw;

        // Skip rows without essential data (name OR mobile required)
        if (!((norm.name && String(norm.name).trim()) || 
              (norm.mobile && String(norm.mobile).trim()))) {
          skipped++;
          continue;
        }

        const doc = mapRowToDoc(norm);
        
        // Ensure we have at least name
        if (!doc.name || !doc.name.trim()) {
          skipped++;
          errors.push({
            row: i + 2,
            error: 'Name is required',
            data: raw
          });
          continue;
        }

        if (upsert) {
          // Build query to find existing record
          const query = {};
          
          // Try to match by mobile first (more unique)
          if (doc.mobile) {
            query.mobile = doc.mobile;
          } else if (doc.email) {
            query.email = doc.email;
          } else {
            // Fallback to name match
            query.name = doc.name;
          }

          // Check if document exists
          const existing = await CaSubmission.findOne(query).select('_id').lean();
          
          const result = await CaSubmission.findOneAndUpdate(
            query,
            { 
              $set: doc,
              $setOnInsert: { importedAt: new Date() }
            },
            { 
              new: true, 
              upsert: true, 
              setDefaultsOnInsert: true, 
              runValidators: true 
            }
          );
          
          if (existing) {
            updated++;
          } else {
            inserted++;
          }
        } else {
          // Insert only mode
          await CaSubmission.create(doc);
          inserted++;
        }
      } catch (e) {
        skipped++;
        errors.push({
          row: i + 2, // +2 because Excel is 1-indexed and we skip header
          error: e.message,
          data: raw
        });
      }
    }

    const result = { 
      inserted, 
      updated, 
      skipped, 
      total: rows.length,
      message: `Successfully processed ${inserted + updated} records (${inserted} new, ${updated} updated), ${skipped} skipped`
    };

    // Include first 10 errors for debugging
    if (errors.length > 0) {
      result.errors = errors.slice(0, 10);
      result.errorCount = errors.length;
    }

    return result;

  } catch (error) {
    throw new Error(`Excel processing failed: ${error.message}`);
  }
}

module.exports = {
  importFromExcel
};