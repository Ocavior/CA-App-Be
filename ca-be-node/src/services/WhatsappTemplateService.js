const WhatsappTemplate = require('../models/whatsappTemplate');

/**
 * Create template
 */
async function createTemplate(payload) {
  return WhatsappTemplate.create(payload);
}

/**
 * Get all templates
 */
async function getTemplates({ activeOnly = false } = {}) {
  const query = activeOnly ? { isActive: true } : {};
  return WhatsappTemplate.find(query, { sort: { createdAt: -1 } });
}

/**
 * Get template by ID
 */
async function getTemplateById(id) {
  return WhatsappTemplate.findById(id);
}

/**
 * Update template
 */
async function updateTemplate(id, payload) {
  return WhatsappTemplate.updateById(id, payload);
}

/**
 * Delete template
 */
async function deleteTemplate(id) {
  return WhatsappTemplate.deleteById(id);
}

/**
 * Toggle active/inactive
 */
async function toggleTemplateStatus(id, explicitValue = null) {
  const template = await WhatsappTemplate.findById(id);
  if (!template) {
    const err = new Error('Template not found');
    err.statusCode = 404;
    throw err;
  }

  const isActive =
    typeof explicitValue === 'boolean'
      ? explicitValue
      : !template.isActive;

  // Setting the same value was not a modification under save(), so no updatedAt bump.
  if (isActive === template.isActive) return template;
  return WhatsappTemplate.updateById(id, { isActive });
}

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  toggleTemplateStatus
};
