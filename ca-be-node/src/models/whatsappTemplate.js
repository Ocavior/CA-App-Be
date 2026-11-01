const { defineModel } = require('../db/model');
const { castDocument, castUpdate, duplicateKeyError } = require('./schemaSupport');

const base = defineModel({
  modelName: 'WhatsappTemplate',
  table: 'whatsapp_templates',
  columns: {
    template_name: { column: 'template_name', type: 'text' },
    preview: { column: 'preview', type: 'text' },
    bodyParams: { column: 'body_params', type: 'json' },
    isActive: { column: 'is_active', type: 'bool' },
    source: { column: 'source', type: 'text' }
  }
});

const bodyParamSchema = {
  label: { type: 'string', required: true, trim: true },
  type: { type: 'string', enum: ['string', 'number', 'boolean'], default: 'string' }
};

const schema = {
  template_name: { type: 'string', required: true, trim: true },
  preview: { type: 'string', required: true },
  bodyParams: { type: 'array', of: bodyParamSchema },
  isActive: { type: 'boolean', default: true },
  source: { type: 'string', enum: ['manual', 'import'], default: 'manual' }
};

const rethrow = (err) => { throw duplicateKeyError(err, 'whatsapptemplates', base.fields); };

module.exports = {
  ...base,

  create(input) {
    return base.insert(castDocument('WhatsappTemplate', schema, input)).catch(rethrow);
  },

  updateById(id, changes, options) {
    return base.updateById(id, castUpdate('WhatsappTemplate', schema, changes), options).catch(rethrow);
  }
};
