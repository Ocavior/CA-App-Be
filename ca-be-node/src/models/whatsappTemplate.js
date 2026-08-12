const mongoose = require('mongoose');

const BodyParamSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['string', 'number', 'boolean'],
      default: 'string'
    }
  },
  { _id: false }
);

const WhatsappTemplateSchema = new mongoose.Schema(
  {
    template_name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    preview: {
      type: String,
      required: true
    },

    bodyParams: {
      type: [BodyParamSchema],
      default: []
    },

    isActive: {
      type: Boolean,
      default: true
    },

    source: {
      type: String,
      enum: ['manual', 'import'],
      default: 'manual'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('WhatsappTemplate', WhatsappTemplateSchema);
