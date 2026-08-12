const authController = require('../controllers/AuthController');
const { authenticateToken } = require('../middleware/auth');

const adminAuthRoutes = {
    // Route definitions with paths, methods, middleware, and handlers
    routes: [
        // Registration and User Creation
        {
            method: 'POST',
            path: '/auth/register',
            middleware: [],
            handler: authController.registerUser,
            description: 'Register a new user'
        },
        {
            method: 'POST',
            path: '/auth/create',
            middleware: [authenticateToken],
            handler: authController.createUser,
            description: 'Create a new user account'
        },

        // Authentication
        {
            method: 'POST',
            path: '/auth/login',
            middleware: [],
            handler: authController.loginUser,
            description: 'User login'
        },

        // User Management
        {
            method: 'DELETE',
            path: '/auth',
            middleware: [authenticateToken],
            handler: authController.deleteUser,
            description: 'Delete user account (self-deletion)'
        },
        {
            method: 'DELETE',
            path: '/auth/delete-user',
            middleware: [authenticateToken],
            handler: authController.deleteUserByAdmin,
            description: 'Delete users by admin'
        },
        {
            method: 'PUT',
            path: '/auth/update-user',
            middleware: [authenticateToken],
            handler: authController.updateUser,
            description: 'Update user by admin'
        },

        // Password Management
        {
            method: 'PUT',
            path: '/auth/change-password',
            middleware: [],
            handler: authController.changePassword,
            description: 'Change user password'
        },
        {
            method: 'POST',
            path: '/auth/reset-password-request',
            middleware: [],
            handler: authController.resetPasswordRequest,
            description: 'Request password reset'
        },
        {
            method: 'POST',
            path: '/auth/verify-reset-token',
            middleware: [],
            handler: authController.verifyResetToken,
            description: 'Verify password reset token'
        },
        {
            method: 'POST',
            path: '/auth/reset-password',
            middleware: [],
            handler: authController.resetPassword,
            description: 'Reset password'
        },

        // Social Authentication
        {
            method: 'POST',
            path: '/auth/google/callback',
            middleware: [],
            handler: authController.googleCallback,
            description: 'Google OAuth callback'
        },
        {
            method: 'POST',
            path: '/auth/social/google',
            middleware: [],
            handler: authController.googleCallback,
            description: 'Google social authentication'
        },
        {
            method: 'GET',
            path: '/adminUsers',
            middleware: [authenticateToken],
            handler: authController.adminUsers,
            description: 'Get all admin users with counts'
        }
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

module.exports = adminAuthRoutes;
