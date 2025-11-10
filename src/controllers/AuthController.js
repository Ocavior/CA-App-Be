const AuthService = require('../services/AuthService');
const { logError } = require('../utils/logError');

class AuthController {

    registerUser = async (request, context) => {
        try {
            const responseData = await AuthService.registerUser(await request.json() || {});

            return {
                status: 201,
                jsonBody: {
                    success: true,
                    data: responseData,
                    message: 'User registered successfully'
                }
            };
        } catch (error) {
            const err = logError('registerUser', error);
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    message: err.message
                }
            };
        }
    }

    loginUser = async (request, context) => {
        try {
            const responseData = await AuthService.loginUser(await request.json() || {});

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: responseData,
                    message: 'Login successful'
                }
            };
        } catch (error) {
            const err = logError('loginUser', error);
            return {
                status: 401,
                jsonBody: {
                    success: false,
                    message: err.message
                }
            };
        }
    }

    createOperationalUser = async (request, context) => {
        try {
            const userId = context.user?._id;
            const userRole = context.user?.role;

            // Check if user is authenticated and is admin
            if (!userId) {
                return {
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'User not authenticated'
                    }
                };
            }

            if (userRole !== 'admin') {
                return {
                    status: 403,
                    jsonBody: {
                        success: false,
                        message: 'Only admins can create operational users'
                    }
                };
            }

            const responseData = await AuthService.createOperationalUser(await request.json() || {});

            return {
                status: 201,
                jsonBody: {
                    success: true,
                    data: responseData,
                    message: 'Operational user created successfully'
                }
            };
        } catch (error) {
            const err = logError('createOperationalUser', error);
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    message: err.message
                }
            };
        }
    }

    resetPasswordRequest = async (request, context) => {
        try {
            const { email } = await request.json() || {};
            
            if (!email) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Email is required'
                    }
                };
            }

            const result = await AuthService.resetPasswordRequest(email);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Password reset OTP sent to your email'
                }
            };
        } catch (error) {
            const err = logError('resetPasswordRequest', error);
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    message: err.message
                }
            };
        }
    }

    verifyResetToken = async (request, context) => {
        try {
            const { email, token } = await request.json() || {};
            
            if (!email || !token) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Email and token are required'
                    }
                };
            }

            await AuthService.verifyResetToken(email, token);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Reset token is valid'
                }
            };
        } catch (error) {
            const err = logError('verifyResetToken', error);
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    message: err.message
                }
            };
        }
    }

    resetPassword = async (request, context) => {
        try {
            const { email, token, newPassword } = await request.json() || {};
            
            if (!email || !token || !newPassword) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Email, token, and new password are required'
                    }
                };
            }

            await AuthService.resetPassword(email, token, newPassword);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Password reset successful'
                }
            };
        } catch (error) {
            const err = logError('resetPassword', error);
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    message: err.message
                }
            };
        }
    }

    googleCallback = async (request, context) => {
        try {
            const result = await AuthService.handleGoogleCallback(await request.json() || {});

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Google SignIn Successful',
                    data: result
                }
            };
        } catch (error) {
            const err = logError('googleCallback', error);
            return {
                status: 401,
                jsonBody: {
                    success: false,
                    message: err.message || 'Google sign-in failed'
                }
            };
        }
    }
}

module.exports = new AuthController();