// controllers/ConversationsController.js
const axios = require('axios');

const WHATSAPP_API_BASE = 'https://whatsapp-inbox.happyriver-1999a58f.southindia.azurecontainerapps.io/api';

async function getConversations(request, context) {
  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '50';
    const skip = url.searchParams.get('skip') || '0';
    const archived = url.searchParams.get('archived') || 'false';

    // -------- External API Call --------
    let response;
    try {
      response = await axios.get(`${WHATSAPP_API_BASE}/conversations`, {
        params: {
          limit,
          skip,
          archived
        },
        headers: {
          Accept: 'application/json'
        },
        timeout: 15000
      });
    } catch (apiError) {
      context.error(
        'WhatsApp conversations API failed:',
        apiError.response?.data || apiError.message
      );

      return {
        status: apiError.response?.status || 502,
        jsonBody: {
          success: false,
          message: 'Failed to fetch conversations',
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
    const limit = url.searchParams.get('limit') || 100;
    const skip = url.searchParams.get('skip') || 0;
    const days = url.searchParams.get('days');

    // -------- External API Call --------
    let response;
    try {
      response = await axios.get(
        `${WHATSAPP_API_BASE}/conversations/${userId}/messages`,
        {
          params: {
            limit,
            skip,
            days
          },
          headers: {
            Accept: 'application/json'
          },
          timeout: 15000
        }
      );
    } catch (apiError) {
      context.error(
        'WhatsApp messages API failed:',
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

async function getConversationHistory(request, context) {
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
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const limit = url.searchParams.get('limit') || '500';

    // Validate required date parameters
    if (!startDate || !endDate) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'start_date and end_date are required'
        }
      };
    }

    // -------- External API Call --------
    let response;
    try {
      response = await axios.get(
        `${WHATSAPP_API_BASE}/conversations/${userId}/history`,
        {
          params: {
            start_date: startDate,
            end_date: endDate,
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
        'WhatsApp history API failed:',
        apiError.response?.data || apiError.message
      );

      return {
        status: apiError.response?.status || 502,
        jsonBody: {
          success: false,
          message: 'Failed to fetch conversation history',
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
    context.error('Get conversation history error:', err);

    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to fetch conversation history'
      }
    };
  }
}

async function searchConversations(request, context) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const limit = url.searchParams.get('limit') || '50';

    // Validate query parameter
    if (!query) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'query parameter is required'
        }
      };
    }

    // -------- External API Call --------
    let response;
    try {
      response = await axios.get(`${WHATSAPP_API_BASE}/conversations/search`, {
        params: {
          query,
          limit
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
          message: 'Failed to search conversations',
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
  getConversationHistory,
  searchConversations
};