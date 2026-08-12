// utils/phoneUtils.js
// Shared phone-number handling so every entry point (manual create/update,
// CSV import) normalizes the same way - inconsistent normalization is what
// let CSV-imported "updates" silently become duplicate records instead.

/** Strip everything but digits/+, drop leading zeros, prefix bare 10-digit numbers with +91. */
function cleanPhoneNumber(phone) {
  if (!phone) return '';

  let cleaned = String(phone).replace(/[^\d+]/g, '').trim();
  cleaned = cleaned.replace(/^0+/, '');

  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    return '+91' + cleaned;
  }

  return cleaned;
}

/** Last 10 digits of a phone number, used to match records regardless of
 * how their mobile field happens to be formatted (with/without +91, etc). */
function last10Digits(phone) {
  if (!phone) return '';
  const digitsOnly = String(phone).replace(/\D/g, '');
  return digitsOnly.length >= 10 ? digitsOnly.slice(-10) : '';
}

module.exports = { cleanPhoneNumber, last10Digits };
