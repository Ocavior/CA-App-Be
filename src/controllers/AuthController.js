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

    createUser = async (request, context) => {
        try {
            const currentUser = context.user;
            const userId = currentUser?._id;

            // Check if user is authenticated
            if (!userId) {
                return {
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'User not authenticated'
                    }
                };
            }
            console.log(currentUser);
            // Only admins can create users (both admin & operational)
            if (currentUser.role !== 'admin') {
                return {
                    status: 403,
                    jsonBody: {
                        success: false,
                        message: 'Only admins can create users'
                    }
                };
            }

            // Role of the *new* user can come from query or body (query > body > default)
            const queryRole = request.query?.role;

            const body = (await request.json()) || {};
            const requestedRole = queryRole;

            const responseData = await AuthService.createUser({
                ...body,
                role: requestedRole     // let service validate/finalize role
            });

            return {
                status: 201,
                jsonBody: {
                    success: true,
                    data: responseData,
                    message: 'User created successfully'
                }
            };
        } catch (error) {
            const err = logError('createUser', error);
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

    adminUsers = async (request, context) => {
        try {
            // Azure Functions HTTP v4 query extraction
            const role = request.query?.get ? request.query.get('role') : request.query?.role;

            const { users, counts } = await AuthService.getAdminUsers({ role });

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Admin users fetched successfully',
                    data: {
                        users,
                        counts
                    }
                }
            };
        } catch (error) {
            context.error('adminUsers error:', error);
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    message: error.message || 'Failed to fetch admin users'
                }
            };
        }
    };

    // Add these methods to the AuthController class

    deleteUser = async (request, context) => {
        try {
            const currentUser = context.user;
            const userId = currentUser?._id;

            // Check if user is authenticated
            if (!userId) {
                return {
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'User not authenticated'
                    }
                };
            }

            await AuthService.deleteUser(userId);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'User account deleted successfully'
                }
            };
        } catch (error) {
            const err = logError('deleteUser', error);
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    message: err.message
                }
            };
        }
    }

    deleteUserByAdmin = async (request, context) => {
        try {
            const currentUser = context.user;
            const userId = currentUser?._id;

            // Check if user is authenticated
            if (!userId) {
                return {
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'User not authenticated'
                    }
                };
            }

            // Only admins can delete other users
            if (currentUser.role !== 'admin') {
                return {
                    status: 403,
                    jsonBody: {
                        success: false,
                        message: 'Only admins can delete users'
                    }
                };
            }

            const body = (await request.json()) || {};
            const { targetUserId } = body;

            if (!targetUserId) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Target user ID is required'
                    }
                };
            }

            // Prevent admin from deleting themselves using this endpoint
            if (targetUserId === userId.toString()) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Use /auth endpoint to delete your own account'
                    }
                };
            }

            await AuthService.deleteUserByAdmin(targetUserId);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'User deleted successfully'
                }
            };
        } catch (error) {
            const err = logError('deleteUserByAdmin', error);
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    message: err.message
                }
            };
        }
    }

    updateUser = async (request, context) => {
        try {
            const currentUser = context.user;
            const userId = currentUser?._id;

            // Check if user is authenticated
            if (!userId) {
                return {
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'User not authenticated'
                    }
                };
            }

            // Only admins can update users
            if (currentUser.role !== 'admin') {
                return {
                    status: 403,
                    jsonBody: {
                        success: false,
                        message: 'Only admins can update users'
                    }
                };
            }

            const body = (await request.json()) || {};
            const { targetUserId, ...updateData } = body;

            if (!targetUserId) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Target user ID is required'
                    }
                };
            }

            const responseData = await AuthService.updateUser(targetUserId, updateData);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: responseData,
                    message: 'User updated successfully'
                }
            };
        } catch (error) {
            const err = logError('updateUser', error);
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    message: err.message
                }
            };
        }
    }

}

module.exports = new AuthController();