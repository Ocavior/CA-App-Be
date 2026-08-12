const WhatsappTemplate = require('../models/whatsappTemplate');

/**
 * Create template
 */
async function createTemplate(payload) {
  const template = await WhatsappTemplate.create(payload);
  return template.toObject();
}

/**
 * Get all templates
 */
async function getTemplates({ activeOnly = false } = {}) {
  const query = activeOnly ? { isActive: true } : {};
  return WhatsappTemplate.find(query).sort({ createdAt: -1 }).lean();
}

/**
 * Get template by ID
 */
async function getTemplateById(id) {
  return WhatsappTemplate.findById(id).lean();
}

/**
 * Update template
 */
async function updateTemplate(id, payload) {
  return WhatsappTemplate.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean();
}

/**
 * Delete template
 */
async function deleteTemplate(id) {
  return WhatsappTemplate.findByIdAndDelete(id).lean();
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

  template.isActive =
    typeof explicitValue === 'boolean'
      ? explicitValue
      : !template.isActive;

  await template.save();
  return template.toObject();
}

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  toggleTemplateStatus
};
