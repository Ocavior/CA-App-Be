const NotificationController = require('../controllers//NotificationController');
const { authenticateToken } = require('../middleware/auth');

const notificationRoutes = {
    // Route definitions with paths, methods, middleware, and handlers
    routes: [
        // Registration and User Creation
        {
            method: 'POST',
            path: '/messages/send',
            middleware: [authenticateToken],
            handler: NotificationController.sendWhatsappMessage,
            description: 'Send a single WhatsApp message (text, media, or template)'
        },
        {
            method: 'POST',
            path: '/notifications/whatsapp/bulk',
            middleware: [authenticateToken],
            handler: NotificationController.sendBulkWhatsapp,
            description: 'Send bulk WhatsApp messages via external service'
        },
        {
            method: 'POST',
            path: '/notifications/email/bulk',
            middleware: [authenticateToken],
            handler: NotificationController.sendBulkEmail,
            description: 'Send bulk emails using simple message template'
        },
        {
            method: 'GET',
            path: '/email-logs',
            middleware: [authenticateToken],
            handler: NotificationController.getEmailLogs,
            description: 'Send bulk WhatsApp messages via external service'
        },

    ],

    // Method to register all auth routes with the router
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

module.exports = notificationRoutes;
