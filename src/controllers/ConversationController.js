// controllers/ConversationsController.js
const axios = require('axios');

const WHATSAPP_API_BASE = 'https://whatsapp-backend.happyriver-1999a58f.southindia.azurecontainerapps.io/api/whatsapp';

async function getConversations(request, context) {
  try {
    // -------- External API Call --------
    let response;
    try {
      response = await axios.get(`${WHATSAPP_API_BASE}/users`, {
        headers: {
          Accept: 'application/json'
        },
        timeout: 15000
      });
    } catch (apiError) {
      context.error(
        'WhatsApp users API failed:',
        apiError.response?.data || apiError.message
      );

      return {
        status: apiError.response?.status || 502,
        jsonBody: {
          success: false,
          message: 'Failed to fetch users',
          error: apiError.response?.data || 'External API error'
        }
      };
    }

    // -------- Success --------
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: response.data
      }
    };
  } catch (err) {
    context.error('Get conversations error:', err);

    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to fetch conversations'
      }
    };
  }
}

async function getConversationMessages(request, context) {
  try {
    const userId = request.params.userId;
    
    if (!userId) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'user_id is required'
        }
      };
    }

    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '50';

    // -------- External API Call --------
    let response;
    try {
      response = await axios.get(
        `${WHATSAPP_API_BASE}/chats/${userId}`,
        {
          params: {
            limit
          },
          headers: {
            Accept: 'application/json'
          },
          timeout: 15000
        }
      );
    } catch (apiError) {
      context.error(
        'WhatsApp chats API failed:',
        apiError.response?.data || apiError.message
      );

      return {
        status: apiError.response?.status || 502,
        jsonBody: {
          success: false,
          message: 'Failed to fetch messages',
          error: apiError.response?.data || 'External API error'
        }
      };
    }

    // -------- Success --------
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: response.data
      }
    };
  } catch (err) {
    context.error('Get conversation messages error:', err);

    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to fetch conversation messages'
      }
    };
  }
}

async function searchConversations(request, context) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    // Validate query parameter
    if (!query) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'q parameter is required'
        }
      };
    }

    // -------- External API Call --------
    let response;
    try {
      response = await axios.get(`${WHATSAPP_API_BASE}/users/search`, {
        params: {
          q: query
        },
        headers: {
          Accept: 'application/json'
        },
        timeout: 15000
      });
    } catch (apiError) {
      context.error(
        'WhatsApp search API failed:',
        apiError.response?.data || apiError.message
      );

      return {
        status: apiError.response?.status || 502,
        jsonBody: {
          success: false,
          message: 'Failed to search users',
          error: apiError.response?.data || 'External API error'
        }
      };
    }

    // -------- Success --------
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: response.data
      }
    };
  } catch (err) {
    context.error('Search conversations error:', err);

    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to search conversations'
      }
    };
  }
}

module.exports = {
  getConversations,
  getConversationMessages,
  searchConversations
};