const TemplateService = require('../services/WhatsappTemplateService');

async function createTemplate(request, context) {
  try {
    const data = await TemplateService.createTemplate(request.body);

    return {
      status: 201,
      jsonBody: {
        success: true,
        data
      }
    };
  } catch (err) {
    context.error('Create template error:', err);

    return {
      status: 500,
      jsonBody: {
        success: false,
        message: err.message
      }
    };
  }
}

async function getTemplates(request, context) {
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('activeOnly') === 'true';

    const data = await TemplateService.getTemplates({ activeOnly });

    return {
      status: 200,
      jsonBody: {
        success: true,
        data
      }
    };
  } catch (err) {
    context.error('Get templates error:', err);
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to fetch templates' }
    };
  }
}

async function getTemplateById(request, context) {
  try {
    const { id } = request.params;
    const data = await TemplateService.getTemplateById(id);

    if (!data) {
      return {
        status: 404,
        jsonBody: { success: false, message: 'Template not found' }
      };
    }

    return {
      status: 200,
      jsonBody: { success: true, data }
    };
  } catch (err) {
    context.error('Get template error:', err);
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to fetch template' }
    };
  }
}

async function updateTemplate(request, context) {
  try {
    const { id } = request.params;
    const data = await TemplateService.updateTemplate(id, request.body);

    if (!data) {
      return {
        status: 404,
        jsonBody: { success: false, message: 'Template not found' }
      };
    }

    return {
      status: 200,
      jsonBody: { success: true, data }
    };
  } catch (err) {
    context.error('Update template error:', err);
    return {
      status: 500,
      jsonBody: { success: false, message: err.message }
    };
  }
}

async function deleteTemplate(request, context) {
  try {
    const { id } = request.params;
    const data = await TemplateService.deleteTemplate(id);

    if (!data) {
      return {
        status: 404,
        jsonBody: { success: false, message: 'Template not found' }
      };
    }

    return {
      status: 200,
      jsonBody: { success: true, message: 'Template deleted' }
    };
  } catch (err) {
    context.error('Delete template error:', err);
    return {
      status: 500,
      jsonBody: { success: false, message: err.message }
    };
  }
}

async function toggleTemplateStatus(request, context) {
  try {
    const { id } = request.params;
    const data = await TemplateService.toggleTemplateStatus(id);

    return {
      status: 200,
      jsonBody: { success: true, data }
    };
  } catch (err) {
    context.error('Toggle status error:', err);
    return {
      status: err.statusCode || 500,
      jsonBody: { success: false, message: err.message }
    };
  }
}

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  toggleTemplateStatus
};
