const db = require('../helpers/db');
const { uniqueId } = require('../helpers/unique');

function buildWhatsappTemplate(overrides = {}) {
  const suffix = uniqueId();
  return {
    template_name: `test_template_${suffix}`,
    preview: 'Hello {{1}}, this is a test template.',
    bodyParams: [{ label: 'name', type: 'string' }],
    isActive: true,
    source: 'manual',
    ...overrides
  };
}

async function createWhatsappTemplate(overrides = {}) {
  return db.models.WhatsappTemplate.create(buildWhatsappTemplate(overrides));
}

module.exports = { buildWhatsappTemplate, createWhatsappTemplate };
