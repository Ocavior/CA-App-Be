// migrations/dynamic-services-migration.js
//
// One-off migration for the dynamic services rework. Run manually, NOT
// wired into app startup.
//
//   node src/migrations/dynamic-services-migration.js --dry-run   (report only, no writes)
//   node src/migrations/dynamic-services-migration.js             (actually run it)
//
// What it does:
//   1. Seeds the Service collection from the service list this app used to
//      hardcode (see history of models/caData.js). Uses the exact same
//      `key` values as `alias`, so services.<alias>.offered/.details on
//      already-existing CaSubmission documents keeps working unchanged -
//      the CaSubmission.services field was changed from a fixed set of
//      schema fields to a Map, but Maps and plain objects serialize
//      identically in MongoDB, so old documents are already readable under
//      the new schema without any structural conversion.
//   2. The one thing old documents never had is structured sub-service
//      flags (previously just free text in `details`). This script
//      best-effort backfills services.<alias>.subServices by matching that
//      free text against the newly-seeded sub-service names.
//
// Always run with --dry-run first and inspect the report before running
// for real, ideally against a staging copy of the data.

require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('../models/service');
const CaSubmission = require('../models/caData');
const { normalizeName, toAlias } = require('../utils/aliasUtils');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;

// Verbatim copy of the service list this app used to hardcode in
// models/caData.js before the dynamic-services rework. `key` becomes the
// Service.alias so existing CaSubmission.services.<key> data lines up.
const SEED_SERVICES = [
  { id: 1, name: 'Income Tax Consultancy', key: 'incomeTax', subServices: ['Compliance', 'Litigation Assessment', 'Litigation CIT Appeal', 'Litigation ITAT', 'Tax Planning', 'Tax Audit', '12A / 80G registration support'] },
  { id: 2, name: 'GST Law Consultancy', key: 'gstLaw', subServices: ['Compliance', 'Litigation Audit Assessment', 'Litigation - Appeals', 'High Court Litigation', 'Opinion', 'REGISTRATIONS'] },
  { id: 3, name: 'Company Law Consultancy', key: 'companyLaw', subServices: ['company incorporation', 'Compliance', 'Litigation', 'Sale/purchase of company', 'Statutory Audit', 'ESI & PF compliance', 'ESI & PF Litigation', 'ESI & PF Registration'] },
  { id: 4, name: 'International Tax Consultancy', key: 'internationalTax', subServices: ['Transaction advisory', 'Transaction structuring', 'CBC reporting', 'TP study', 'TP Audit', 'NRI Tax Advisory'] },
  { id: 5, name: 'Start-Up Consultancy', key: 'startup', subServices: ['Counselling', 'Startup India Registration', 'Fundraising - Debt', 'Fundraising - Equity', 'preparation of financial model, pitch deck etc.'] },
  { id: 6, name: 'Accounting', key: 'accounting', subServices: ['INDIAN ACCOUNTING', 'PREPARATION OF FS/FINALIZATION OF FS'] },
  { id: 7, name: 'Investment & Succession Planning', key: 'investmentSuccession', subServices: ['Investment planning for individual', 'Investment planning for corporates', 'succession planning for businesses', 'project financing /Loan work'] },
  { id: 8, name: 'Registration Services', key: 'registration', subServices: ['FSSAI REGISTRATIONS', 'Trademark, Patent, Copyright Registration', 'ISO REGISTRATIONS', 'legal METROLOGY REGISTRATIONS', 'TRADE LICENSE', 'shops n establishment license', 'RERA LICENSE', 'PSARA', 'TRUST REGISTRATIONS', 'SOCIETY REGISTRATIONS', 'APEDA', 'FACTORY LICENSE', 'Pollution NOC', 'FULL FLEDGED MONEY CHANGER LICENSE REGISTRATIONS (ffmc)', 'PROFESSIONAL TAX REGISTRATIONS', 'SAFTA', 'AGMARK', 'ISBN', 'EPR', 'ISI MARK', 'cdsco - drug license', 'bis certification', 'SOC (all service organisation certification)', 'Insurance Provider Registration (ISNP)'] },
  { id: 9, name: 'Audits', key: 'audits', subServices: ['Bank Audits', 'Revenue Audit', 'Stock Audit', 'System Audit', 'IT Audit', 'Internal Audit or ICFR Audit', 'SOP Preparations (std operating procedure)', 'cyber security audit', 'ISO Audit', 'SOX Audit'] },
  { id: 10, name: 'FEMA, FCRA', key: 'femaFcra', subServices: ['FEMA - Compliance', 'FEMA - Litigation', 'FCRA - Compliance', 'FCRA - Litigation'] },
  { id: 11, name: 'PMLA, Benami & Black Money Consultancy', key: 'pmlaBenami', subServices: ['Preventive analysis', 'Reply To Notice', 'Representation'] },
  { id: 12, name: 'NBFC Assistance', key: 'nbfc', subServices: ['REGISTRATION', 'COMPLIANCES', 'Litigation (no level)'] },
  { id: 13, name: 'GEM Portal Support', key: 'gemPortal', subServices: ['GEM ID/Registration', 'Product Registration', 'Tender Support'] },
  { id: 14, name: 'Forensic Analysis/Audit/Investigation', key: 'forensic', subServices: ['forensic audit under IBC', 'Forensic audit ordered by bank', 'Forensic audit ordered by company', 'INVESTIGATION AND DISPUTE ADVISORY'] },
  { id: 15, name: 'IBC Consultancy', key: 'ibc', subServices: ['Yourself IRP or RP (interim resolution professional or resolution professional)', 'Ibc advisory', 'REPRESENTATION FOR PERSONAL GUARANTORS', 'Liquidation support'] },
  { id: 16, name: 'Valuation Services', key: 'valuation', subServices: ['securities & financial instrument valuation', 'business valuation', 'valuation under IBC', 'valuation for due diligence', 'LAND & BUILDING VALUATIONS', 'Other asset valuation'] },
  { id: 17, name: 'IND-AS Consultancy', key: 'indAs', subServices: ['FS (financial statements) preparation', 'FS conversion', 'Review or consulting on transactions', 'NFRA litigation'] },
  { id: 18, name: 'Virtual CEOs/CFOs/Independent Directors', key: 'virtualCxo', subServices: ['yourself virtual cfo or ceo', 'identification of virtual ceo or cfo', 'yourself independent director', 'identification of independent director'] },
  { id: 19, name: 'Competition Act Consultancy', key: 'competitionAct', subServices: ['preventive analysis', 'reply to notice', 'representation'] },
  { id: 20, name: 'IPO Consulting', key: 'ipo', subServices: ['Sme ipo', 'Underwriting', 'Mainboard ipo', 'FPO', 'Social stock exchange support'] },
  { id: 21, name: 'SEZ Consulting', key: 'sez', subServices: ['Notification', 'de-notification', 'compliances'] },
  { id: 22, name: 'Foreign Accounting & Taxation', key: 'foreignAccounting', subServices: ['Foreign Accounting', 'Foreign Taxation', 'Foreign Audit'] },
  { id: 23, name: 'Govt Subsidies', key: 'govtSubsidies', subServices: ['State Subsidy', 'Central Subsidy'] },
  { id: 24, name: 'Other Services', key: 'other', subServices: [] }
];

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB' + (DRY_RUN ? ' (DRY RUN - no writes will happen)' : ''));
}

/** Step 1: seed the Service collection. Returns the alias -> seeded Service map. */
async function seedServices() {
  const report = { created: 0, alreadyExisted: 0 };
  const byAlias = new Map();

  for (const def of SEED_SERVICES) {
    const existing = await Service.findOne({ alias: def.key }).lean();

    if (existing) {
      report.alreadyExisted++;
      byAlias.set(def.key, existing);
      continue;
    }

    const subServices = def.subServices.map((name) => ({
      name,
      alias: toAlias(name, []),
      isOfferedDefault: false,
      isActive: true,
      source: 'seed'
    }));

    // avoid alias collisions between sub-services of the same service
    const seenAliases = [];
    subServices.forEach((ss) => {
      if (seenAliases.includes(ss.alias)) {
        ss.alias = toAlias(ss.name, seenAliases);
      }
      seenAliases.push(ss.alias);
    });

    report.created++;

    if (DRY_RUN) {
      console.log(`[dry-run] would create service "${def.name}" (alias: ${def.key}) with ${subServices.length} sub-service(s)`);
      byAlias.set(def.key, { name: def.name, alias: def.key, subServices });
      continue;
    }

    const created = await Service.create({
      name: def.name,
      alias: def.key,
      isActive: true,
      source: 'seed',
      subServices
    });
    byAlias.set(def.key, created.toObject());
  }

  return { report, byAlias };
}

/**
 * Step 2: best-effort backfill of services.<alias>.subServices on existing
 * CaSubmission documents, matching free-text `details` against the
 * newly-seeded sub-service names for that same service.
 */
async function backfillSubServices(byAlias) {
  const subByServiceAndName = new Map(); // alias -> Map(normalizedSubName -> subAlias)
  for (const [alias, service] of byAlias.entries()) {
    subByServiceAndName.set(
      alias,
      new Map((service.subServices || []).map(ss => [normalizeName(ss.name), ss.alias]))
    );
  }

  const report = { scanned: 0, updated: 0, subServiceMatches: 0 };
  const cursor = CaSubmission.find({}).cursor();
  let batch = [];

  async function flushBatch() {
    if (!batch.length) return;
    if (!DRY_RUN) {
      await CaSubmission.bulkWrite(batch);
    }
    report.updated += batch.length;
    batch = [];
  }

  for await (const doc of cursor) {
    report.scanned++;

    const rawServices = doc.services instanceof Map
      ? Object.fromEntries(doc.services)
      : (doc.services || {});

    const setOps = {};
    let touched = false;

    for (const [alias, entry] of Object.entries(rawServices)) {
      if (!entry || !entry.offered || !entry.details) continue;

      const subLookup = subByServiceAndName.get(alias);
      if (!subLookup) continue; // not one of the seeded services (shouldn't happen, but be safe)

      const existingSub = entry.subServices instanceof Map
        ? Object.fromEntries(entry.subServices)
        : (entry.subServices || {});

      if (Object.keys(existingSub).length > 0) continue; // already has structured data, leave it alone

      const fragments = String(entry.details)
        .split(/[,;\n\r]+/)
        .map(s => s.trim())
        .filter(Boolean);

      const matchedSubServices = {};
      for (const fragment of fragments) {
        const subAlias = subLookup.get(normalizeName(fragment));
        if (subAlias) {
          matchedSubServices[subAlias] = true;
          report.subServiceMatches++;
        }
      }

      if (Object.keys(matchedSubServices).length > 0) {
        setOps[`services.${alias}.subServices`] = matchedSubServices;
        touched = true;
      }
    }

    if (touched) {
      if (DRY_RUN) {
        report.updated++;
      } else {
        batch.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: setOps }
          }
        });
        if (batch.length >= BATCH_SIZE) await flushBatch();
      }
    }

    if (report.scanned % 500 === 0) {
      console.log(`... scanned ${report.scanned} submissions`);
    }
  }

  await flushBatch();
  return report;
}

async function run() {
  await connectDB();

  console.log('\n=== Step 1: Seed Service collection ===');
  const { report: seedReport, byAlias } = await seedServices();
  console.log(`Services created: ${seedReport.created}, already existed: ${seedReport.alreadyExisted}`);

  console.log('\n=== Step 2: Backfill CaSubmission sub-service flags ===');
  const backfillReport = await backfillSubServices(byAlias);
  console.log(`Submissions scanned: ${backfillReport.scanned}`);
  console.log(`Submissions updated: ${backfillReport.updated}`);
  console.log(`Sub-service matches applied: ${backfillReport.subServiceMatches}`);

  console.log(`\n=== Done${DRY_RUN ? ' (dry run - nothing was written)' : ''} ===`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
