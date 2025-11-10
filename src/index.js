const { app } = require('@azure/functions');
const router = require('./routes');
const { setupMiddleware } = require('./middleware');
const { connectDB } = require('./config/database');
const logger = require('./utils/logger');

// Initialize database connection
connectDB();

// Setup middleware
setupMiddleware(app);

// Main HTTP trigger handler
app.http('HttpTrigger1', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    route: 'v1/{*route}',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            logger.info(`${request.method} ${request.url}`);
            
            // Handle CORS preflight
            if (request.method === 'OPTIONS') {
                return {
                    status: 200,
                    headers: {
                        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                        'Access-Control-Max-Age': '86400'
                    }
                };
            }

            // Route the request
            const response = await router.handle(request, context);
            
            // Add CORS headers to all responses
            response.headers = {
                ...response.headers,
                'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            };
            
            return response;
            
        } catch (error) {
            logger.error('Unhandled error:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: 'Internal server error',
                    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
                }
            };
        }
    }
});
