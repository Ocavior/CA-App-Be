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
  
  // Service columns with details (numbered 1-23)
  // Handle typos in original CSV
  '1. Income Tax Consltancy': 'service_1',
  '1. Income Tax Consultancy': 'service_1',
  '2. GST Law Consultancy': 'service_2',
  '3. Company Law Consultancy': 'service_3',
  '4. INTERNATIONAL_TAX_CONSULTANCY': 'service_4',
  '5. Start‑Up Consultancy': 'service_5',
  '5. Start-Up Consultancy': 'service_5',
  '6. ACCOUNTING': 'service_6',
  '7. Investment & Succession Planning': 'service_7',
  '8. REGISTRATION SERVICES': 'service_8',
  '9. Audits': 'service_9',
  '10. FEMA, FCRA': 'service_10',
  '11. PMLA, Benami & Black Money Consultancy': 'service_11',
  '12. NBFC ASSISTANCE': 'service_12',
  '13. GEM PORTAL Support': 'service_13',
  '14. FORENSIC ANALYSIS/Audit/Investogation': 'service_14',
  '14. FORENSIC ANALYSIS/Audit/Investigation': 'service_14',
  '15. IBC CONSULTANCY': 'service_15',
  '16. VALUATION SERVICES': 'service_16',
  '17. IND-AS CONSULTANCY': 'service_17',
  '18. VIRTUAL CEOs/CFOs/Independent directors': 'service_18',
  '19. COMPETITION ACT CONSULTANCY': 'service_19',
  '20. IPO Consulting': 'service_20',
  '21. SEZ Consulting': 'service_21',
  '22. Foreign Accounting & Taxation': 'service_22',
  '23. Govt subsidies': 'service_23',
  '23. Govt Subsidies': 'service_23',
  
  // Additional service details
  'Which Country (writing)': 'foreignWhichCountry',
  'Which State (writing)': 'govtSubsidiesWhichState',
  'Which country (writing)': 'foreignWhichCountry',
  'Which state (writing)': 'govtSubsidiesWhichState',
  'Other Services': 'otherServices',
  
  // Additional information
  'Remarks': 'remarks',
  'If you have any project which you are unable to deliver on your own. Please give details. Our team will call you.': 'projectHelpDetails',
  'If you have any project which you are unable to deliver on your own, please give details. Our team will call you.': 'projectHelpDetails',
  'If you are in job, please write the name of the company in which you are working.': 'employer',
  'If you are in a job, please write the name of the company in which you are working.': 'employer',
  'Form Filed By': 'formFiledBy'
};

// Service flag mapping: maps service_N to the new schema field name
const SERVICE_KEY_MAP = {
  'service_1': 'incomeTax',
  'service_2': 'gstLaw',
  'service_3': 'companyLaw',
  'service_4': 'internationalTax',
  'service_5': 'startup',
  'service_6': 'accounting',
  'service_7': 'investmentSuccession',
  'service_8': 'registration',
  'service_9': 'audits',
  'service_10': 'femaFcra',
  'service_11': 'pmlaBenami',
  'service_12': 'nbfc',
  'service_13': 'gemPortal',
  'service_14': 'forensic',
  'service_15': 'ibc',
  'service_16': 'valuation',
  'service_17': 'indAs',
  'service_18': 'virtualCxo',
  'service_19': 'competitionAct',
  'service_20': 'ipo',
  'service_21': 'sez',
  'service_22': 'foreignAccounting',
  'service_23': 'govtSubsidies'
};

const ALLOWED_FIELDS = [
  'timestamp',
  'name',
  'mobile',
  'email',
  'newEmail',
  'whatsappNumber',
  'state',
  'city',
  'otherBranches',
  'top3Services',
  'services',
  'foreignWhichCountry',
  'govtSubsidiesWhichState',
  'otherServices',
  'remarks',
  'projectHelpDetails',
  'employer',
  'formFiledBy',
  'source'
];

/**
 * Aggressively clean header string to handle invisible characters
 * Removes: trailing/leading spaces, multiple spaces, zero-width chars, etc.
 */
function cleanHeaderString(str) {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .trim()                                    // Remove leading/trailing whitespace
    .replace(/\s+/g, ' ')                      // Normalize all whitespace to single space
    .replace(/[\u200B-\u200D\uFEFF]/g, '')     // Remove zero-width spaces
    .replace(/[\u00A0]/g, ' ')                 // Replace non-breaking space with normal space
    .replace(/^\s+|\s+$/g, '');                // Final trim
}

/**
 * Try to match a header to a service column using fuzzy logic
 * Detects pattern: NUMBER. SERVICE_NAME (with optional spaces/typos)
 */
function fuzzyMatchServiceColumn(header) {
  const cleaned = cleanHeaderString(header);
  
  // Pattern: starts with number followed by dot
  const match = cleaned.match(/^(\d+)\.\s*/);
  if (match) {
    const serviceNumber = parseInt(match[1]);
    if (serviceNumber >= 1 && serviceNumber <= 23) {
      return `service_${serviceNumber}`;
    }
  }
  
  return null;
}

/**
 * Smart header mapping with fallback strategies
 * 1. Clean the header
 * 2. Try exact match from HEADER_MAP
 * 3. Try fuzzy match for service columns
 * 4. Return original as fallback
 */
function mapHeader(originalHeader, debugMode = false) {
  // Strategy 1: Clean the header
  const cleaned = cleanHeaderString(originalHeader);
  
  if (!cleaned) return null;
  
  // Strategy 2: Try exact match (with cleaned version)
  if (HEADER_MAP[cleaned]) {
    if (debugMode) {
      console.log(`✓ Exact match: "${originalHeader}" → "${HEADER_MAP[cleaned]}"`);
    }
    return HEADER_MAP[cleaned];
  }
  
  // Strategy 3: Try fuzzy match for service columns
  const serviceMatch = fuzzyMatchServiceColumn(cleaned);
  if (serviceMatch) {
    if (debugMode) {
      console.log(`✓ Fuzzy match: "${originalHeader}" → "${serviceMatch}"`);
    }
    return serviceMatch;
  }
  
  // Strategy 4: Log unmapped headers in debug mode
  if (debugMode) {
    console.log(`⚠ Unmapped header: "${originalHeader}" (cleaned: "${cleaned}")`);
  }
  
  // Return null for unmapped headers
  return null;
}

/**
 * Build header row mapping from actual CSV headers
 */
function buildHeaderMapping(headerRow, debugMode = false) {
  const mapping = {};
  const unmapped = [];
  
  if (debugMode) {
    console.log('\n=== Building Header Mapping ===');
    console.log(`Total headers: ${headerRow.length}`);
  }
  
  headerRow.forEach((header, index) => {
    if (header === undefined || header === null || header === '') {
      return; // Skip empty headers
    }
    
    const originalHeader = String(header);
    const mappedKey = mapHeader(originalHeader, debugMode);
    
    if (mappedKey) {
      mapping[originalHeader] = mappedKey;
    } else {
      unmapped.push(originalHeader);
    }
  });
  
  if (debugMode) {
    console.log(`Mapped: ${Object.keys(mapping).length}`);
    console.log(`Unmapped: ${unmapped.length}`);
    
    if (unmapped.length > 0) {
      console.log('\nUnmapped headers:');
      unmapped.forEach(h => console.log(`  - "${h}"`));
    }
    
    // Verify all 23 services are mapped
    const serviceMapped = Object.values(mapping).filter(v => v.startsWith('service_'));
    console.log(`\nServices mapped: ${serviceMapped.length}/23`);
    
    const missingServices = [];
    for (let i = 1; i <= 23; i++) {
      if (!serviceMapped.includes(`service_${i}`)) {
        missingServices.push(`service_${i}`);
      }
    }
    
    if (missingServices.length > 0) {
      console.log('⚠ Missing services:', missingServices.join(', '));
    }
    
    console.log('=== End Header Mapping ===\n');
  }
  
  return mapping;
}

/**
 * Normalize headers using the header map
 */
function normalizeHeaders(row, headerRowMap) {
  const normalized = {};
  
  for (const [originalKey, value] of Object.entries(row)) {
    // Try to get mapped key
    const mappedKey = headerRowMap[originalKey];
    
    if (mappedKey) {
      normalized[mappedKey] = value;
    }
    // If not mapped, skip it (don't create random keys)
  }
  
  return normalized;
}

/**
 * Pick only allowed fields from data object
 */
function pickAllowedFields(data = {}) {
  const picked = {};
  ALLOWED_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(data, field) && data[field] !== undefined) {
      picked[field] = data[field];
    }
  });
  return picked;
}

/**
 * Read Excel workbook from buffer or file path
 */
function readWorkbook({ buffer, filePath }) {
  if (buffer) {
    return XLSX.read(buffer, { type: 'buffer', cellDates: true });
  }
  if (filePath) {
    return XLSX.readFile(filePath, { cellDates: true });
  }
  throw new Error('No buffer or filePath supplied');
}

/**
 * Parse date values from Excel
 */
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

/**
 * Clean and format phone numbers
 */
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

/**
 * Parse top 3 services from a delimited string
 */
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

/**
 * Parse other branches from a delimited string
 */
function parseOtherBranches(value) {
  if (!value) return [];
  
  const str = String(value).trim();
  
  // Split by common delimiters
  return str
    .split(/[,;\n\r]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Check if a value represents an offered service
 * In CSV, any non-empty text means they offer it
 */
function hasServiceOffered(value) {
  if (value === null || value === undefined || value === '') return false;
  
  const str = String(value).trim().toLowerCase();
  
  // Empty or 'nan' means not offered
  if (str === '' || str === 'nan' || str === 'null' || str === 'undefined') {
    return false;
  }
  
  // Any other text means they offer it
  return true;
}

/**
 * Get service details text
 */
function getServiceDetails(value) {
  if (!value) return '';
  
  const str = String(value).trim();
  
  // Don't store 'nan' or similar as details
  if (str.toLowerCase() === 'nan' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '';
  }
  
  return str;
}

/**
 * Map a normalized row to a document structure
 */
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
    const whatsapp = String(norm.whatsappNumber).trim().toLowerCase();
    // Handle "yes" meaning use the mobile number
    if (whatsapp === 'yes' && doc.mobile) {
      doc.whatsappNumber = doc.mobile;
    } else {
      doc.whatsappNumber = cleanPhoneNumber(norm.whatsappNumber);
    }
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
  
  // Services - NEW STRUCTURE
  // Each service has { offered: Boolean, details: String }
  const services = {};
  
  for (const [normKey, schemaKey] of Object.entries(SERVICE_KEY_MAP)) {
    if (norm[normKey] !== undefined) {
      services[schemaKey] = {
        offered: hasServiceOffered(norm[normKey]),
        details: getServiceDetails(norm[normKey])
      };
    }
  }
  
  if (Object.keys(services).length > 0) {
    doc.services = services;
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
  
  // Set source as CSV import
  doc.source = 'csv_import';
  
  // Store raw row for debugging
  if (norm.__raw) {
    doc.rawData = norm.__raw;
  }
  
  return doc;
}

/**
 * Import CA submissions from Excel file
 * @param {Object} options - Import options
 * @param {Buffer} options.buffer - Excel file buffer
 * @param {String} options.filePath - Path to Excel file
 * @param {Boolean} options.upsert - Whether to update existing records (default: true)
 * @param {Boolean} options.debug - Enable debug logging (default: false)
 * @returns {Object} Import results
 */
async function importFromExcel({ buffer = null, filePath = null, upsert = true, debug = false } = {}) {
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
    const headerRowMap = buildHeaderMapping(headerRow, debug);

    let inserted = 0, updated = 0, skipped = 0;
    const errors = [];

    if (debug) {
      console.log(`\n=== Processing ${rows.length} rows ===\n`);
    }

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      
      try {
        const norm = normalizeHeaders(raw, headerRowMap);
        norm.__raw = raw;

        // Skip rows without essential data (name is required)
        if (!(norm.name && String(norm.name).trim())) {
          skipped++;
          if (debug) {
            console.log(`Row ${i + 2}: Skipped (no name)`);
          }
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
            if (debug) {
              console.log(`Row ${i + 2}: Updated ${doc.name}`);
            }
          } else {
            inserted++;
            if (debug) {
              console.log(`Row ${i + 2}: Inserted ${doc.name}`);
            }
          }
        } else {
          // Insert only mode
          await CaSubmission.create(doc);
          inserted++;
          if (debug) {
            console.log(`Row ${i + 2}: Inserted ${doc.name}`);
          }
        }
      } catch (e) {
        skipped++;
        errors.push({
          row: i + 2, // +2 because Excel is 1-indexed and we skip header
          error: e.message,
          data: raw
        });
        if (debug) {
          console.log(`Row ${i + 2}: Error - ${e.message}`);
        }
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

    if (debug) {
      console.log(`\n=== Import Summary ===`);
      console.log(`Total: ${result.total}`);
      console.log(`Inserted: ${result.inserted}`);
      console.log(`Updated: ${result.updated}`);
      console.log(`Skipped: ${result.skipped}`);
      console.log(`Errors: ${errors.length}`);
      console.log(`=== End Import ===\n`);
    }

    return result;

  } catch (error) {
    throw new Error(`Excel processing failed: ${error.message}`);
  }
}

/**
 * Create a new CA submission manually
 * @param {Object} payload - CA submission data
 * @returns {Object} Created submission
 */
async function createCaSubmission(payload) {
  const data = pickAllowedFields(payload);
  
  // Set source as manual if not specified
  if (!data.source) {
    data.source = 'manual';
  }

  // Create the document
  const doc = await CaSubmission.create(data);
  const obj = doc.toObject();

  // Don't expose rawData in response
  if (obj.rawData !== undefined) {
    delete obj.rawData;
  }

  return obj;
}

/**
 * Update an existing CA submission by ID
 * @param {String} id - Submission ID
 * @param {Object} payload - Updated data
 * @returns {Object} Updated submission or null if not found
 */
async function updateCaSubmission(id, payload) {
  const data = pickAllowedFields(payload);

  const updated = await CaSubmission
    .findByIdAndUpdate(
      id,
      { $set: data },
      {
        new: true,
        runValidators: true
      }
    )
    .select('-rawData') // exclude rawData from response
    .lean();

  return updated; // may be null if not found
}

async function toggleCaActive(id, explicitValue = null) {
  const ca = await CaSubmission.findById(id);

  if (!ca) {
    const err = new Error('Not found');
    err.statusCode = 404;
    throw err;
  }

  if (typeof explicitValue === 'boolean') {
    ca.isActive = explicitValue;
  } else {
    ca.isActive = !ca.isActive; // toggle
  }

  await ca.save();
  return ca;
}

module.exports = {
  importFromExcel,
  createCaSubmission,
  updateCaSubmission,
  SERVICE_KEY_MAP,
  HEADER_MAP,
  toggleCaActive
};