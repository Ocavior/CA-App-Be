// services/CaSubmissionImportService.js
const XLSX = require('xlsx');
const CaSubmission = require('../models/caData');
const ServiceManagementService = require('../services/ServiceManagementService');
const { normalizeName } = require('../utils/aliasUtils');
const { cleanPhoneNumber, last10Digits } = require('../utils/phoneUtils');

// Core (fixed) field header mapping - these are genuine, unchanging CA
// fields, unlike services which are now dynamic (see Service model) and
// matched separately below.
const HEADER_MAP = {
  'Timestamp': 'timestamp',
  'Name': 'name',
  'Mobile': 'mobile',
  'Email': 'email',
  'Phone': 'mobile',
  'Phone Number': 'mobile',
  'Contact': 'mobile',
  'Mobile Number': 'mobile',

  'WhatsApp Number': 'whatsappNumber',
  'Whatsapp Number': 'whatsappNumber',
  'New Email': 'newEmail',

  'State': 'state',
  'City': 'city',
  'Other Branches': 'otherBranches',

  'Top 3 Services': 'top3Services',

  'Which Country (writing)': 'foreignWhichCountry',
  'Which State (writing)': 'govtSubsidiesWhichState',
  'Which country (writing)': 'foreignWhichCountry',
  'Which state (writing)': 'govtSubsidiesWhichState',
  'Other Services': 'otherServices',

  'Remarks': 'remarks',
  'If you have any project which you are unable to deliver on your own. Please give details. Our team will call you.': 'projectHelpDetails',
  'If you have any project which you are unable to deliver on your own, please give details. Our team will call you.': 'projectHelpDetails',
  'If you are in job, please write the name of the company in which you are working.': 'employer',
  'If you are in a job, please write the name of the company in which you are working.': 'employer',
  'Form Filed By': 'formFiledBy'
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

// Free-text answers that mean "yes I offer this" but aren't themselves a
// sub-service name - shouldn't spawn a pending sub-service.
const GENERIC_AFFIRMATIVE = new Set(['yes', 'y', 'true', '1', 'offered', 'available']);

class FileValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FileValidationError';
    this.statusCode = 400;
  }
}

/**
 * Aggressively clean header string to handle invisible characters
 */
function cleanHeaderString(str) {
  if (!str || typeof str !== 'string') return '';

  return str
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u00A0]/g, ' ')
    .replace(/^\s+|\s+$/g, '');
}

/** Strip a leading "N. " numbering convention some source files use */
function stripLeadingNumbering(header) {
  return header.replace(/^\s*\d+\.\s*/, '');
}

/**
 * Build header -> { type: 'core', field } | { type: 'service', rawHeader }
 * mapping from the actual headers found in the uploaded file. Anything not
 * recognised as a core field is treated as a candidate service column.
 */
function buildHeaderMapping(headerRow) {
  const mapping = {};

  headerRow.forEach((header) => {
    if (header === undefined || header === null || header === '') return;

    const originalHeader = String(header);
    const cleaned = cleanHeaderString(originalHeader);
    if (!cleaned) return;

    if (HEADER_MAP[cleaned]) {
      mapping[originalHeader] = { type: 'core', field: HEADER_MAP[cleaned] };
    } else {
      mapping[originalHeader] = { type: 'service', rawHeader: stripLeadingNumbering(cleaned) };
    }
  });

  return mapping;
}

function pickAllowedFields(data = {}) {
  const picked = {};
  ALLOWED_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(data, field) && data[field] !== undefined) {
      picked[field] = data[field];
    }
  });
  return picked;
}

function readWorkbook({ buffer, filePath }) {
  if (buffer) {
    return XLSX.read(buffer, { type: 'buffer', cellDates: true });
  }
  if (filePath) {
    return XLSX.readFile(filePath, { cellDates: true });
  }
  throw new Error('No buffer or filePath supplied');
}

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0);
    }
  }

  return null;
}

function parseTop3Services(value) {
  if (!value) return [];
  return String(value).trim()
    .split(/[,;\n\r]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, 3);
}

function parseOtherBranches(value) {
  if (!value) return [];
  return String(value).trim()
    .split(/[,;\n\r]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/** Same delimiter rules as parseOtherBranches - used to split a service cell
 * into individual sub-service name fragments. */
function splitServiceCellText(value) {
  return parseOtherBranches(value);
}

function hasServiceOffered(value) {
  if (value === null || value === undefined || value === '') return false;
  const str = String(value).trim().toLowerCase();
  if (str === '' || str === 'nan' || str === 'null' || str === 'undefined') return false;
  return true;
}

function getServiceDetails(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (str.toLowerCase() === 'nan' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return '';
  return str;
}

function isGenericAffirmative(text) {
  return GENERIC_AFFIRMATIVE.has(String(text).trim().toLowerCase());
}

/**
 * Loads the current service/sub-service list once per import run and tracks
 * new services/sub-services discovered while processing rows. In commit
 * mode, unmatched names are actually created (inactive, pending review);
 * in preview mode nothing is written - candidates are only recorded.
 */
async function buildMatchContext({ commit }) {
  const services = await ServiceManagementService.getAllServicesForMatching();
  const byName = new Map();

  services.forEach(service => {
    byName.set(normalizeName(service.name), service);
    service._subByName = new Map(
      (service.subServices || []).map(ss => [normalizeName(ss.name), ss])
    );
  });

  return {
    commit,
    byName,
    newServicesDetected: [],
    newSubServicesDetected: []
  };
}

async function resolveService(ctx, rawHeader) {
  const key = normalizeName(rawHeader);
  const existing = ctx.byName.get(key);
  if (existing) return { service: existing, alias: existing.alias, isNew: false };

  const displayName = rawHeader;

  if (!ctx.commit) {
    if (!ctx.newServicesDetected.some(s => s.name === displayName)) {
      ctx.newServicesDetected.push({ name: displayName });
    }
    return { service: null, alias: null, isNew: true, pendingName: displayName };
  }

  const created = await ServiceManagementService.createPendingService(displayName);
  created._subByName = new Map();
  ctx.byName.set(normalizeName(created.name), created);
  ctx.newServicesDetected.push({ name: created.name, alias: created.alias });
  return { service: created, alias: created.alias, isNew: true };
}

async function resolveSubService(ctx, service, fragmentText) {
  if (!service) {
    // The parent service itself is only a pending candidate (preview mode) -
    // nothing real to attach a sub-service to yet.
    return { alias: null, isNew: true, pendingName: fragmentText };
  }

  const norm = normalizeName(fragmentText);
  const existing = service._subByName.get(norm);
  if (existing) return { alias: existing.alias, isNew: false };

  if (!ctx.commit) {
    const dedupeKey = `${service.name}::${fragmentText}`;
    if (!ctx.newSubServicesDetected.some(s => s._dedupeKey === dedupeKey)) {
      ctx.newSubServicesDetected.push({ _dedupeKey: dedupeKey, service: service.name, name: fragmentText });
    }
    return { alias: null, isNew: true, pendingName: fragmentText };
  }

  const createdSub = await ServiceManagementService.createPendingSubService(service._id, fragmentText);
  service._subByName.set(normalizeName(createdSub.name), createdSub);
  ctx.newSubServicesDetected.push({ service: service.name, name: createdSub.name, alias: createdSub.alias });
  return { alias: createdSub.alias, isNew: true };
}

/**
 * Map one Excel/CSV row into a CaSubmission-shaped document, resolving
 * service/sub-service columns against (and, in commit mode, creating into)
 * the dynamic Service collection via matchCtx.
 */
async function mapRowToDoc(raw, headerRowMap, matchCtx) {
  const doc = {};
  const services = {};

  for (const [originalHeader, cellValue] of Object.entries(raw)) {
    const mapped = headerRowMap[originalHeader];
    if (!mapped) continue;

    if (mapped.type === 'core') {
      switch (mapped.field) {
        case 'timestamp': {
          const parsed = parseDate(cellValue);
          if (parsed) doc.timestamp = parsed;
          break;
        }
        case 'name':
          if (cellValue) doc.name = String(cellValue).trim();
          break;
        case 'mobile':
          if (cellValue) doc.mobile = cleanPhoneNumber(cellValue);
          break;
        case 'email': {
          if (cellValue) {
            const email = String(cellValue).trim().toLowerCase();
            if (email.includes('@')) doc.email = email;
          }
          break;
        }
        case 'newEmail': {
          if (cellValue) {
            const newEmail = String(cellValue).trim().toLowerCase();
            if (newEmail.includes('@')) doc.newEmail = newEmail;
          }
          break;
        }
        case 'whatsappNumber': {
          if (cellValue) {
            const whatsapp = String(cellValue).trim().toLowerCase();
            if (whatsapp === 'yes' && doc.mobile) {
              doc.whatsappNumber = doc.mobile;
            } else {
              doc.whatsappNumber = cleanPhoneNumber(cellValue);
            }
          }
          break;
        }
        case 'state':
          if (cellValue) doc.state = String(cellValue).trim();
          break;
        case 'city':
          if (cellValue) doc.city = String(cellValue).trim();
          break;
        case 'otherBranches':
          if (cellValue) doc.otherBranches = parseOtherBranches(cellValue);
          break;
        case 'top3Services':
          if (cellValue) doc.top3Services = parseTop3Services(cellValue);
          break;
        case 'foreignWhichCountry':
          if (cellValue) doc.foreignWhichCountry = String(cellValue).trim();
          break;
        case 'govtSubsidiesWhichState':
          if (cellValue) doc.govtSubsidiesWhichState = String(cellValue).trim();
          break;
        case 'otherServices':
          if (cellValue) doc.otherServices = String(cellValue).trim();
          break;
        case 'remarks':
          if (cellValue) doc.remarks = String(cellValue).trim();
          break;
        case 'projectHelpDetails':
          if (cellValue) doc.projectHelpDetails = String(cellValue).trim();
          break;
        case 'employer':
          if (cellValue) doc.employer = String(cellValue).trim();
          break;
        case 'formFiledBy':
          if (cellValue) doc.formFiledBy = String(cellValue).trim();
          break;
      }
      continue;
    }

    // ---- Service column ----
    if (!hasServiceOffered(cellValue)) continue;

    const { service, alias, pendingName } = await resolveService(matchCtx, mapped.rawHeader);
    const detailsText = getServiceDetails(cellValue);
    const fragments = splitServiceCellText(cellValue);

    const subServices = {};
    const meaningfulFragments = fragments.filter(f => !isGenericAffirmative(f));

    for (const fragment of meaningfulFragments) {
      const subResult = await resolveSubService(matchCtx, service, fragment);
      if (subResult.alias) {
        subServices[subResult.alias] = true;
      }
      // Unmatched/unresolved fragments stay captured in `details` below -
      // nothing is silently dropped.
    }

    const targetKey = alias || `__pending__:${pendingName}`;
    services[targetKey] = {
      offered: true,
      details: detailsText,
      subServices
    };
  }

  if (Object.keys(services).length > 0) doc.services = services;

  doc.source = 'csv_import';
  doc.rawData = raw;

  return doc;
}

/**
 * Build the query used to find an existing CaSubmission matching this row,
 * plus a stable string key for detecting duplicate rows within the same
 * import batch. Matches on the last 10 digits of the phone number rather
 * than an exact string, so it finds existing records regardless of whether
 * their mobile field happens to be stored with or without a +91 prefix
 * (manual creation and CSV import didn't always normalize the same way).
 */
function buildMatchQuery(doc) {
  if (doc.mobile) {
    const last10 = last10Digits(doc.mobile);
    if (last10) {
      return { query: { mobile: { $regex: last10 + '$' } }, key: `mobile:${last10}` };
    }
    return { query: { mobile: doc.mobile }, key: `mobile:${doc.mobile}` };
  }
  if (doc.email) {
    return { query: { email: doc.email }, key: `email:${doc.email}` };
  }
  return { query: { name: doc.name }, key: `name:${doc.name}` };
}

/**
 * Shared parse -> validate -> (optionally) commit pipeline for both preview
 * and real import. commit=false performs no database writes at all.
 */
async function processExcel({ buffer = null, filePath = null, commit, upsert = true, debug = false } = {}) {
  const wb = readWorkbook({ buffer, filePath });

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new FileValidationError('Excel file has no sheets');
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];

  if (!headerRow.length) {
    throw new FileValidationError('The uploaded file has no header row.');
  }

  const headerRowMap = buildHeaderMapping(headerRow);
  const hasNameColumn = Object.values(headerRowMap).some(m => m.type === 'core' && m.field === 'name');

  if (!hasNameColumn) {
    throw new FileValidationError(
      'No "Name" column could be found in the file. Expected a column header like "Name".'
    );
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

  if (!rows.length) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      total: 0,
      newServicesDetected: [],
      newSubServicesDetected: [],
      errors: [],
      message: 'No data rows found in Excel file'
    };
  }

  const matchCtx = await buildMatchContext({ commit });

  let inserted = 0, updated = 0, skipped = 0;
  const errors = [];
  const sampleRows = [];
  // Tracks which row first claimed each match key, so a later row in the
  // same file that resolves to the same person doesn't silently overwrite
  // the earlier row's data with no explanation.
  const seenKeys = new Map();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];

    try {
      const doc = await mapRowToDoc(raw, headerRowMap, matchCtx);

      if (!doc.name) {
        skipped++;
        errors.push({ row: i + 2, error: 'Name is required', data: raw });
        continue;
      }

      const { query, key } = buildMatchQuery(doc);

      const firstRow = seenKeys.get(key);
      if (firstRow) {
        skipped++;
        errors.push({
          row: i + 2,
          error: `Duplicate of row ${firstRow} within this file (same ${key.split(':')[0]}) - skipped so it doesn't overwrite row ${firstRow}'s data`,
          data: raw
        });
        continue;
      }
      seenKeys.set(key, i + 2);

      if (!commit && sampleRows.length < 10) {
        sampleRows.push({ row: i + 2, mapped: doc });
      }

      if (!commit) {
        // Preview: forecast insert vs update with a read-only lookup, write nothing.
        const existing = upsert ? await CaSubmission.findOne(query).select('_id').lean() : null;
        if (existing) updated++;
        else inserted++;
        continue;
      }

      if (upsert) {
        const existing = await CaSubmission.findOne(query).select('_id').lean();

        await CaSubmission.findOneAndUpdate(
          query,
          { $set: doc, $setOnInsert: { importedAt: new Date() } },
          { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
        );

        if (existing) updated++;
        else inserted++;
      } else {
        await CaSubmission.create(doc);
        inserted++;
      }
    } catch (e) {
      skipped++;
      errors.push({ row: i + 2, error: e.message, data: raw });
      if (debug) console.log(`Row ${i + 2}: Error - ${e.message}`);
    }
  }

  const result = {
    inserted,
    updated,
    skipped,
    total: rows.length,
    newServicesDetected: matchCtx.newServicesDetected,
    newSubServicesDetected: matchCtx.newSubServicesDetected,
    errors,
    errorCount: errors.length,
    message: commit
      ? `Successfully processed ${inserted + updated} records (${inserted} new, ${updated} updated), ${skipped} skipped`
      : `Preview parsed ${rows.length} row(s): ${inserted} would be new, ${updated} would be updated, ${skipped} would be skipped`
  };

  if (!commit) {
    result.sampleRows = sampleRows;
  }

  return result;
}

/** Real import - parses and commits to the database. */
async function importFromExcel(options = {}) {
  try {
    return await processExcel({ ...options, commit: true });
  } catch (error) {
    if (error instanceof FileValidationError) throw error;
    throw new Error(`Excel processing failed: ${error.message}`);
  }
}

/** Dry-run - parses, validates and detects new services/sub-services, writes nothing. */
async function previewExcel(options = {}) {
  try {
    return await processExcel({ ...options, commit: false });
  } catch (error) {
    if (error instanceof FileValidationError) throw error;
    throw new Error(`Excel processing failed: ${error.message}`);
  }
}

/**
 * Create a new CA submission manually
 */
async function createCaSubmission(payload) {
  const data = pickAllowedFields(payload);

  if (!data.source) {
    data.source = 'manual';
  }

  // Normalize the same way CSV import does, so a manually-created record's
  // mobile format doesn't drift from what import matching expects.
  if (data.mobile) {
    data.mobile = cleanPhoneNumber(data.mobile);
  }

  const doc = await CaSubmission.create(data);
  // flattenMaps: without it, Map-typed fields (services) serialize to `{}`
  // when the response is JSON-stringified - the save itself is correct,
  // but the echoed-back document would look like it lost the data.
  const obj = doc.toObject({ flattenMaps: true });

  if (obj.rawData !== undefined) {
    delete obj.rawData;
  }

  return obj;
}

/**
 * Update an existing CA submission by ID
 */
async function updateCaSubmission(id, payload) {
  const data = pickAllowedFields(payload);

  if (data.mobile) {
    data.mobile = cleanPhoneNumber(data.mobile);
  }

  const updated = await CaSubmission
    .findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    )
    .select('-rawData')
    .lean();

  return updated;
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
    ca.isActive = !ca.isActive;
  }

  await ca.save();
  return ca;
}

module.exports = {
  importFromExcel,
  previewExcel,
  createCaSubmission,
  updateCaSubmission,
  HEADER_MAP,
  toggleCaActive,
  FileValidationError
};
