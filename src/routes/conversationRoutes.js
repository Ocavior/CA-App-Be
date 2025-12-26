// routes/conversationRoutes.js
const ConversationsController = require('../controllers/ConversationController');
const { authenticateToken } = require('../middleware/auth');

const conversationRoutes = {
    // Route definitions with paths, methods, middleware, and handlers
    routes: [
        {
            method: 'GET',
            path: '/conversations',
            middleware: [authenticateToken],
            handler: ConversationsController.getConversations,
            description: 'Get list of conversations with pagination and archive filter'
        },
        {
            method: 'GET',
            path: '/conversations/search',
            middleware: [authenticateToken],
            handler: ConversationsController.searchConversations,
            description: 'Search conversations by query (phone number, name, etc.)'
        },
        {
            method: 'GET',
            path: '/conversations/:userId/messages',
            middleware: [authenticateToken],
            handler: ConversationsController.getConversationMessages,
            description: 'Get messages for a specific conversation/user'
        },
        {
            method: 'GET',
            path: '/conversations/:userId/history',
            middleware: [authenticateToken],
            handler: ConversationsController.getConversationHistory,
            description: 'Get conversation message history with date range filter'
        }
    ],

    // Method to register all conversation routes with the router
    registerRoutes: function (router) {
        this.routes.forEach(route => {
            const { method, path, middleware, handler } = route;
            if (middleware && middleware.length > 0) {
                router.addRoute(method, path, [...middleware, handler]);
            } else {
                router.addRoute(method, path, handler);
            }
        });
    }
};

module.exports = conversationRoutes;