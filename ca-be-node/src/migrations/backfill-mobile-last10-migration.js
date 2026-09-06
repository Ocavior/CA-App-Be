// migrations/backfill-mobile-last10-migration.js
//
// One-off migration to backfill the new `mobileLast10` field on existing
// CaSubmission documents. Run manually, NOT wired into app startup.
//
//   node src/migrations/backfill-mobile-last10-migration.js --dry-run   (report only, no writes)
//   node src/migrations/backfill-mobile-last10-migration.js             (actually run it)
//
// Why this is needed: CSV-import duplicate matching used to query `mobile`
// with a suffix regex (`{ mobile: { $regex: last10 + '$' } }`), which can't
// use an index and forced a full collection scan on every row of every
// import. The fix stores `last10Digits(mobile)` in an indexed
// `mobileLast10` field and matches on that with an exact-equality query
// instead. New/updated documents get `mobileLast10` set automatically via
// the model's pre-save/pre-update hooks (see models/caData.js) - this
// script backfills it on documents that already existed before that change,
// so CSV import can still find and update them instead of treating them
// as new and creating duplicates.
//
// MUST be run before (or as part of) deploying the CaSubmissionImportService
// change that queries `mobileLast10` - run it against staging first.

require('dotenv').config();
const mongoose = require('mongoose');
const CaSubmission = require('../models/caData');
const { last10Digits } = require('../utils/phoneUtils');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB' + (DRY_RUN ? ' (DRY RUN - no writes will happen)' : ''));
}

async function backfillMobileLast10() {
  const report = { scanned: 0, updated: 0, skippedNoMobile: 0, skippedAlreadyCorrect: 0 };
  const cursor = CaSubmission.find({}).select('mobile mobileLast10').cursor();
  let batch = [];

  async function flushBatch() {
    if (!batch.length) return;
    if (!DRY_RUN) {
      await CaSubmission.bulkWrite(batch);
    }
    batch = [];
  }

  for await (const doc of cursor) {
    report.scanned++;

    if (!doc.mobile) {
      report.skippedNoMobile++;
      continue;
    }

    const correctLast10 = last10Digits(doc.mobile);

    if (doc.mobileLast10 === correctLast10) {
      report.skippedAlreadyCorrect++;
      continue;
    }

    report.updated++;

    if (!DRY_RUN) {
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { mobileLast10: correctLast10 } }
        }
      });
      if (batch.length >= BATCH_SIZE) await flushBatch();
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

  console.log('\n=== Backfill CaSubmission.mobileLast10 ===');
  const report = await backfillMobileLast10();
  console.log(`Submissions scanned: ${report.scanned}`);
  console.log(`Submissions updated: ${report.updated}`);
  console.log(`Skipped (no mobile): ${report.skippedNoMobile}`);
  console.log(`Skipped (already correct): ${report.skippedAlreadyCorrect}`);

  console.log(`\n=== Done${DRY_RUN ? ' (dry run - nothing was written)' : ''} ===`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
