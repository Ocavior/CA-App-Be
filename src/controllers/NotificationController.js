// controllers/NotificationController.js
const axios = require('axios');
const { EmailApiService } = require('../services/EmailApiService');

const WHATSAPP_API_BASE = 'https://whatsapp-inbox.happyriver-1999a58f.southindia.azurecontainerapps.io/api';
const WHATSAPP_BULK_API = `${WHATSAPP_API_BASE}/bulk/send`;
const WHATSAPP_SEND_API = `${WHATSAPP_API_BASE}/messages/send`;

async function sendBulkWhatsapp(request, context) {
  try {
    const payload = (await request.json()) || {};
    const { message_template, contacts, delay = 1 } = payload;

    // -------- Validation --------
    if (!message_template || typeof message_template !== 'string') {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'message_template is required'
        }
      };
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'contacts must be a non-empty array'
        }
      };
    }

    // Basic contact validation
    const formattedContacts = contacts
      .filter(c => c.phone)
      .map(c => ({
        phone: String(c.phone),
        name: c.name || ''
      }));

    if (formattedContacts.length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'No valid contacts with phone numbers found'
        }
      };
    }

    // -------- External API Call --------
    let response;
    try {
      response = await axios.post(
        WHATSAPP_BULK_API,
        {
          message_template,
          contacts: formattedContacts,
          delay
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
    const {
      to,
      message,
      message_type = 'text',
      media_url,
      template_name,
      template_params
    } = payload;

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

    // Validate message_type
    const validMessageTypes = ['text', 'image', 'video', 'document', 'audio', 'template'];
    if (message_type && !validMessageTypes.includes(message_type)) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: `message_type must be one of: ${validMessageTypes.join(', ')}`
        }
      };
    }

    // Validate based on message type
    if (message_type === 'template') {
      if (!template_name) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: 'template_name is required when message_type is template'
          }
        };
      }
    } else if (message_type === 'text') {
      if (!message) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: 'message is required when message_type is text'
          }
        };
      }
    } else if (['image', 'video', 'document', 'audio'].includes(message_type)) {
      if (!media_url) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: `media_url is required when message_type is ${message_type}`
          }
        };
      }
    }

    // Build request body
    const requestBody = {
      to: String(to),
      message_type
    };

    if (message) requestBody.message = message;
    if (media_url) requestBody.media_url = media_url;
    if (template_name) requestBody.template_name = template_name;
    if (template_params) requestBody.template_params = template_params;

    // -------- External API Call --------
    let response;
    try {
      response = await axios.post(
        WHATSAPP_SEND_API,
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

module.exports = {
  sendBulkWhatsapp,
  sendWhatsappMessage,
  sendBulkEmail
};