// controllers/NotificationController.js
const axios = require('axios');

const WHATSAPP_BULK_API =
  'https://whatsapp-inbox.happyriver-1999a58f.southindia.azurecontainerapps.io/api/bulk/send';

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

module.exports = {
  sendBulkWhatsapp
};
