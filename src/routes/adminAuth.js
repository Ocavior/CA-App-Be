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
            middleware: [],
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
            method: 'POST',
            path: '/auth/social/apple',
            middleware: [],
            handler: authController.appleCallback,
            description: 'Apple social authentication'
        },
        {
            method: 'POST',
            path: '/auth/social/meta',
            middleware: [],
            handler: authController.metaCallback,
            description: 'Meta (Facebook) social authentication'
        },

        // Token Management
        {
            method: 'GET',
            path: '/auth/verify',
            middleware: [],
            handler: authController.verifyToken,
            description: 'Verify authentication token'
        },

        // Email and Phone Verification
        {
            method: 'GET',
            path: '/auth/verify-email/:token',
            middleware: [],
            handler: authController.verifyEmail,
            description: 'Verify email with token'
        },
        {
            method: 'POST',
            path: '/auth/verify-phone',
            middleware: [],
            handler: authController.verifyPhone,
            description: 'Verify phone number'
        },
        {
            method: 'GET',
            path: '/auth/resend-verification',
            middleware: [authenticateToken],
            handler: authController.resendVerification,
            description: 'Resend verification email/SMS'
        },
        {
            method: 'POST',
            path: '/auth/updatePhoneVerify',
            middleware: [authenticateToken],
            handler: authController.updatePhoneVerify,
            description: 'Update and verify phone number'
        },

        // OTP Login
        {
            method: 'POST',
            path: '/auth/send-login-otp',
            middleware: [],
            handler: authController.sendLoginOTP,
            description: 'Send OTP for login'
        },
        {
            method: 'POST',
            path: '/auth/verify-login-otp',
            middleware: [],
            handler: authController.verifyLoginOTP,
            description: 'Verify login OTP'
        },

        // Account Deletion
        {
            method: 'POST',
            path: '/auth/request-deletion',
            middleware: [authenticateToken],
            handler: authController.requestAccountDeletion,
            description: 'Request account deletion'
        },

        // Verification Status Checks
        {
            method: 'GET',
            path: '/auth/verify/email',
            middleware: [authenticateToken],
            handler: authController.checkEmailVerification,
            description: 'Check email verification status'
        },
        {
            method: 'GET',
            path: '/auth/verify/email-and-phone',
            middleware: [authenticateToken],
            handler: authController.checkBothVerification,
            description: 'Check both email and phone verification status'
        }
    ],

    // Method to register all auth routes with the router
    registerRoutes: function(router) {
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
