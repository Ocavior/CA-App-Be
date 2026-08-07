// utils/aliasUtils.js
// Shared helpers for matching free-text service/sub-service names against
// known records, and generating stable camelCase aliases for new ones.

const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;

/**
 * Normalize a name for comparison: lowercase, strip punctuation/invisible
 * characters, collapse whitespace. Two names that normalize to the same
 * string are considered the same service/sub-service.
 */
function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .replace(ZERO_WIDTH_CHARS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Generate a camelCase alias from a display name, avoiding collisions with
 * existingAliases (case-insensitive). Not guaranteed to match any
 * historical hand-picked alias - only used when creating new entries.
 */
function toAlias(name, existingAliases = []) {
  const words = normalizeName(name).split(' ').filter(Boolean).slice(0, 6);
  let base = words
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');

  if (!base) base = 'service';
  if (base.length > 60) base = base.slice(0, 60);

  const existing = new Set(existingAliases.filter(Boolean).map(a => String(a).toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;

  let suffix = 2;
  let candidate = `${base}${suffix}`;
  while (existing.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

module.exports = { normalizeName, toAlias };
