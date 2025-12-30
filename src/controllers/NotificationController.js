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

    // Return the API response directly (it already has success, message, data structure)
    return {
      status: 200,
      jsonBody: logs
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

module.exports = {
  sendBulkWhatsapp,
  sendWhatsappMessage,
  sendBulkEmail,
  getEmailLogs
};