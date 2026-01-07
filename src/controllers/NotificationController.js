// controllers/NotificationController.js
const axios = require('axios');
const { EmailApiService } = require('../services/EmailApiService');

const WHATSAPP_API_BASE = 'https://whatsapp-backend.happyriver-1999a58f.southindia.azurecontainerapps.io/api/whatsapp';
const WHATSAPP_BULK_API = `${WHATSAPP_API_BASE}/send/bulk`;
const WHATSAPP_SEND_TEXT_API = `${WHATSAPP_API_BASE}/send/text`;

async function sendBulkWhatsapp(request, context) {
  try {
    const payload = (await request.json()) || {};
    const { text, recipients, delay_seconds = 1 } = payload;

    // -------- Validation --------
    if (!text || typeof text !== 'string') {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'text is required'
        }
      };
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'recipients must be a non-empty array'
        }
      };
    }

    // Format recipients as strings
    const formattedRecipients = recipients
      .filter(r => r)
      .map(r => String(r));

    if (formattedRecipients.length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'No valid recipients found'
        }
      };
    }

    // -------- External API Call --------
    let response;
    try {
      response = await axios.post(
        WHATSAPP_BULK_API,
        {
          recipients: formattedRecipients,
          text,
          delay_seconds
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
    } catch (apiError) {
      context.error(
        'WhatsApp bulk API failed:',
        apiError.response?.data || apiError.message
      );

      return {
        status: apiError.response?.status || 502,
        jsonBody: {
          success: false,
          message: 'WhatsApp bulk send failed',
          error: apiError.response?.data || 'External API error'
        }
      };
    }

    // -------- Success --------
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'WhatsApp messages sent successfully',
        data: response.data
      }
    };
  } catch (err) {
    context.error('Send bulk WhatsApp error:', err);

    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to send WhatsApp messages'
      }
    };
  }
}

async function sendWhatsappMessage(request, context) {
  try {
    const payload = (await request.json()) || {};
    const { to, text, user_name } = payload;

    // -------- Validation --------
    if (!to) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'to (phone number) is required'
        }
      };
    }

    if (!text) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'text is required'
        }
      };
    }

    // Build request body
    const requestBody = {
      to: String(to),
      text,
      user_name: user_name || ''
    };

    // -------- External API Call --------
    let response;
    try {
      response = await axios.post(
        WHATSAPP_SEND_TEXT_API,
        requestBody,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
    } catch (apiError) {
      context.error(
        'WhatsApp send API failed:',
        apiError.response?.data || apiError.message
      );

      return {
        status: apiError.response?.status || 502,
        jsonBody: {
          success: false,
          message: 'WhatsApp message send failed',
          error: apiError.response?.data || 'External API error'
        }
      };
    }

    // -------- Success --------
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'WhatsApp message sent successfully',
        data: response.data
      }
    };
  } catch (err) {
    context.error('Send WhatsApp message error:', err);

    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to send WhatsApp message'
      }
    };
  }
}

async function sendBulkEmail(request, context) {
  try {
    const payload = (await request.json()) || {};
    const { emails, subject, message, from } = payload;

    const result = await EmailApiService.sendBulkSimpleEmails({
      emails,
      subject,
      message,
      from
    });

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Bulk email process completed',
        data: result
      }
    };
  } catch (err) {
    context.error('Bulk email error:', err);

    return {
      status: 400,
      jsonBody: {
        success: false,
        message: err.message || 'Failed to send bulk emails'
      }
    };
  }
}

async function getEmailLogs(request, context) {
  try {
    // Get query parameters if any filters are passed
    const url = new URL(request.url);
    const filters = {};
    
    // Extract any additional query parameters as filters
    url.searchParams.forEach((value, key) => {
      if (key !== 'appCode') { // appCode is already handled in the service
        filters[key] = value;
      }
    });

    const logs = await EmailApiService.getEmailLogs(filters);

    // Format response to include only specific fields
    const formattedItems = logs.data.items.map(item => ({
      _id: item._id,
      appCode: item.appCode,
      emailMessage: item.emailMessage,
      recipients: item.recipients,
      subject: item.subject,
      status: item.status,
      emailDetails: item.emailDetails,
      createdAt: item.createdAt
    }));

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Email logs retrieved successfully',
        data: {
          items: formattedItems,
          page: logs.data.page,
          limit: logs.data.limit,
          total: logs.data.total,
          hasMore: logs.data.hasMore
        }
      }
    };
  } catch (err) {
    context.error('Get email logs error:', err);

    return {
      status: 400,
      jsonBody: {
        success: false,
        message: err.message || 'Failed to retrieve email logs'
      }
    };
  }
}

async function sendWhatsappTemplate(request, context) {
  try {
    const payload = (await request.json()) || {};
    const { to, name, language = 'en_US', bodyParams, user_name } = payload;

    // -------- Validation --------
    if (!to) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'to (phone number) is required'
        }
      };
    }

    if (!name) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'name (template name) is required'
        }
      };
    }

    if (bodyParams && !Array.isArray(bodyParams)) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'bodyParams must be an array'
        }
      };
    }

    // Build request body
    const requestBody = {
      to: String(to),
      name,
      language,
      bodyParams: bodyParams || [],
      user_name: user_name || ''
    };

    // -------- External API Call --------
    let response;
    try {
      response = await axios.post(
        WHATSAPP_SEND_TEMPLATE_API,
        requestBody,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
    } catch (apiError) {
      context.error(
        'WhatsApp template API failed:',
        apiError.response?.data || apiError.message
      );

      return {
        status: apiError.response?.status || 502,
        jsonBody: {
          success: false,
          message: 'WhatsApp template send failed',
          error: apiError.response?.data || 'External API error'
        }
      };
    }

    // -------- Success --------
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'WhatsApp template message sent successfully',
        data: response.data
      }
    };
  } catch (err) {
    context.error('Send WhatsApp template error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to send WhatsApp template message'
      }
    };
  }
}

async function sendBulkWhatsappTemplate(request, context) {
  try {
    const payload = (await request.json()) || {};
    const { recipients, name, language = 'en_US', delay_seconds = 1 } = payload;

    // -------- Validation --------
    if (!name || typeof name !== 'string') {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'name (template name) is required'
        }
      };
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'recipients must be a non-empty array'
        }
      };
    }

    // Validate and format recipients
    const formattedRecipients = recipients
      .filter(r => r && r.phone)
      .map(r => ({
        phone: String(r.phone),
        user_name: r.user_name || '',
        bodyParams: Array.isArray(r.bodyParams) ? r.bodyParams : []
      }));

    if (formattedRecipients.length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'No valid recipients found (each recipient must have a phone number)'
        }
      };
    }

    // Build request body
    const requestBody = {
      recipients: formattedRecipients,
      name,
      language,
      delay_seconds
    };

    // -------- External API Call --------
    let response;
    try {
      response = await axios.post(
        WHATSAPP_BULK_TEMPLATE_API,
        requestBody,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 30000 // Increased timeout for bulk operations
        }
      );
    } catch (apiError) {
      context.error(
        'WhatsApp bulk template API failed:',
        apiError.response?.data || apiError.message
      );

      return {
        status: apiError.response?.status || 502,
        jsonBody: {
          success: false,
          message: 'WhatsApp bulk template send failed',
          error: apiError.response?.data || 'External API error'
        }
      };
    }

    // -------- Success --------
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'WhatsApp template messages sent successfully',
        data: response.data
      }
    };
  } catch (err) {
    context.error('Send bulk WhatsApp template error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to send bulk WhatsApp template messages'
      }
    };
  }
}

module.exports = {
  sendBulkWhatsapp,
  sendWhatsappMessage,
  sendBulkEmail,
  getEmailLogs,
  sendWhatsappTemplate,
  sendBulkWhatsappTemplate
};