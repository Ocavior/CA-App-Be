// Jest gives each test FILE a fresh module registry, so a plain in-module
// counter resets to 1, 2, 3... every file - fine for values scoped to one
// file, but every fixture here writes into a database SHARED across the
// whole run. A counter-only value (or one derived by slicing off the
// leading, most-significant digits of Date.now()+counter, which just
// discards the part that actually varies) collides across files on any
// uniquely-indexed field (Admin.phoneNumber, Admin.username/email,
// Service.alias, WhatsappTemplate.template_name). Date.now() (real wall-clock
// time, not reset per file) plus randomness avoids that.
let counter = 0;

function uniqueId() {
  counter += 1;
  return `${Date.now()}${counter}${Math.floor(Math.random() * 1000)}`;
}

/** N-digit numeric string, unique across files/processes sharing one DB. */
function uniqueDigits(length = 10) {
  const raw = uniqueId();
  return raw.slice(-length).padStart(length, '0');
}

module.exports = { uniqueId, uniqueDigits };
