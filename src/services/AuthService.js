const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/admin');
const { logError } = require('../utils/logError');
const constants = require('../config/app.config');

class AuthService {

    /**
     * Generate JWT token for user
     */
    static async generateTokens(user) {
        try {
            const jwtAccessToken = jwt.sign(
                { 
                    userId: user._id, 
                    email: user.email,
                    username: user.username,
                    role: user.role 
                },
                constants.JWT_SECRET,
                { expiresIn: constants.JWT_EXPIRE }
            );
            return { jwtAccessToken };
        } catch (error) {
            throw logError('generateTokens', error, { userId: user._id });
        }
    }

    /**
     * Generate a 6-digit OTP
     */
    static generateOTP() {
        try {
            return Math.floor(100000 + Math.random() * 900000).toString();
        } catch (error) {
            throw logError('generateOTP', error);
        }
    }

    /**
     * Send password reset email (placeholder - implement with your email service)
     */
    static async sendPasswordResetEmail(email, otp) {
        try {
            console.log(`Sending password reset OTP to: ${email}`);
            console.log(`OTP: ${otp}`);
            
            // TODO: Implement actual email sending logic here
            // Example: await EmailService.sendEmail({ to: email, subject: 'Password Reset', body: `Your OTP is: ${otp}` });
            
            return { success: true };
        } catch (error) {
            throw logError('sendPasswordResetEmail', error, { email });
        }
    }

    /**
     * Register a new user
     */
    static async registerUser(userData) {
        try {
            const { username, email, password, phoneNumber, role = 'admin' } = userData;

            // Validate required fields
            if (!username || !password) {
                throw new Error('Username and password are required');
            }

            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [
                    { username: username.toLowerCase() },
                ]
            });

            if (existingUser) {
                if (existingUser.username === username.toLowerCase()) {
                    throw new Error('Username already taken');
                }
            }

            // Hash password
            const salt = await bcrypt.genSalt(parseInt(constants.SALT_ROUNDS || 10));
            const hashedPassword = await bcrypt.hash(password, salt);

            // Create user
            const user = await User.create({
                username: username.toLowerCase(),
                email: email.toLowerCase(),
                password: hashedPassword,
                phoneNumber,
                role
            });

            // Generate token
            const { jwtAccessToken } = await this.generateTokens(user);

            return {
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    role: user.role
                },
                token: jwtAccessToken
            };
        } catch (error) {
            throw logError('registerUser', error, { email: userData.email });
        }
    }

    /**
     * Login user with username/email and password
     */
    static async loginUser(credentials) {
        try {
            const { identifier, password } = credentials; // identifier can be username or email

            if (!identifier || !password) {
                throw new Error('Username/email and password are required');
            }

            // Find user by username or email
            const user = await User.findOne({
                $or: [
                    { email: identifier.toLowerCase() },
                    { username: identifier.toLowerCase() }
                ]
            });

            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Verify password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                throw new Error('Invalid credentials');
            }

            // Generate token
            const { jwtAccessToken } = await this.generateTokens(user);

            return {
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    role: user.role
                },
                token: jwtAccessToken
            };
        } catch (error) {
            throw logError('loginUser', error, { identifier: credentials.identifier });
        }
    }

    /**
     * Create operational user (admin only)
     */
    static async createOperationalUser(userData) {
        try {
            const { username, email, password, phoneNumber } = userData;

            // Validate required fields
            if (!username || !email || !password || !phoneNumber) {
                throw new Error('Username, email, password, and phone number are required');
            }

            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [
                    { email: email.toLowerCase() },
                    { username: username.toLowerCase() },
                    { phoneNumber }
                ]
            });

            if (existingUser) {
                if (existingUser.email === email.toLowerCase()) {
                    throw new Error('User already exists with this email');
                }
                if (existingUser.username === username.toLowerCase()) {
                    throw new Error('Username already taken');
                }
                if (existingUser.phoneNumber === phoneNumber) {
                    throw new Error('Phone number already registered');
                }
            }

            // Hash password
            const salt = await bcrypt.genSalt(parseInt(constants.SALT_ROUNDS || 10));
            const hashedPassword = await bcrypt.hash(password, salt);

            // Create operational user
            const user = await User.create({
                username: username.toLowerCase(),
                email: email.toLowerCase(),
                password: hashedPassword,
                phoneNumber,
                role: 'operational'
            });

            return {
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    role: user.role
                }
            };
        } catch (error) {
            throw logError('createOperationalUser', error, { email: userData.email });
        }
    }

    /**
     * Request password reset
     */
    static async resetPasswordRequest(email) {
        try {
            // Find user
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                throw new Error('User not found with this email');
            }

            // Generate OTP
            const otp = this.generateOTP();
            
            // Store OTP and expiry (1 hour)
            user.resetPasswordToken = otp;
            user.resetPasswordExpire = new Date(Date.now() + 3600000);
            await user.save();

            // Send email
            await this.sendPasswordResetEmail(email, otp);

            return {
                success: true,
                message: 'Password reset OTP sent to your email'
            };
        } catch (error) {
            throw logError('resetPasswordRequest', error, { email });
        }
    }

    /**
     * Verify reset token
     */
    static async verifyResetToken(email, token) {
        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            
            if (!user) {
                throw new Error('User not found');
            }

            if (!user.resetPasswordToken) {
                throw new Error('No reset token found for this user');
            }

            if (user.resetPasswordToken !== token) {
                throw new Error('Invalid reset token');
            }

            if (user.resetPasswordExpire < Date.now()) {
                throw new Error('Reset token has expired');
            }

            return true;
        } catch (error) {
            throw logError('verifyResetToken', error, { email });
        }
    }

    /**
     * Reset password
     */
    static async resetPassword(email, token, newPassword) {
        try {
            // Verify token first
            await this.verifyResetToken(email, token);

            const user = await User.findOne({ email: email.toLowerCase() });

            // Hash new password
            const salt = await bcrypt.genSalt(parseInt(constants.SALT_ROUNDS || 10));
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Update password and clear reset fields
            user.password = hashedPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();

            return {
                success: true,
                message: 'Password reset successful'
            };
        } catch (error) {
            throw logError('resetPassword', error, { email });
        }
    }

    /**
     * Handle Google OAuth callback
     */
    static async handleGoogleCallback(googleUserData) {
        try {
            const { user, credential, profile } = googleUserData;

            if (!profile || !profile.email) {
                throw new Error('Invalid Google profile data');
            }

            // Find existing user
            let existingUser = await User.findOne({ email: profile.email.toLowerCase() });

            if (!existingUser) {
                // Create new user from Google profile
                // Generate a random password (user won't use it for Google login)
                const randomPassword = crypto.randomBytes(32).toString('hex');
                const salt = await bcrypt.genSalt(parseInt(constants.SALT_ROUNDS || 10));
                const hashedPassword = await bcrypt.hash(randomPassword, salt);

                // Generate username from email
                const baseUsername = profile.email.split('@')[0].toLowerCase();
                let username = baseUsername;
                let counter = 1;
                
                // Ensure unique username
                while (await User.findOne({ username })) {
                    username = `${baseUsername}${counter}`;
                    counter++;
                }

                existingUser = await User.create({
                    username,
                    email: profile.email.toLowerCase(),
                    password: hashedPassword,
                    phoneNumber: '', // Will need to be updated later
                    role: 'operational'
                });
            }

            // Generate token
            const { jwtAccessToken } = await this.generateTokens(existingUser);

            return {
                user: {
                    _id: existingUser._id,
                    username: existingUser.username,
                    email: existingUser.email,
                    phoneNumber: existingUser.phoneNumber,
                    role: existingUser.role
                },
                token: jwtAccessToken
            };
        } catch (error) {
            throw logError('handleGoogleCallback', error, { email: googleUserData?.profile?.email });
        }
    }
}

module.exports = AuthService;