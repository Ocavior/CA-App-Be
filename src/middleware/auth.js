// middleware/auth.js
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");
const constants = require('../config/app.config');
const logger = require('../utils/logger');

const auth = {
  // Verify JWT token
  authenticateToken: async (request, context) => {
    try {
      console.log("=== AUTH MIDDLEWARE START ===");

      // Extract token from headers
      const authHeader = request.headers.get('authorization');
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        console.log("No token found");
        return {
          status: 401,
          jsonBody: {
            success: false,
            message: "Access token is required",
          }
        };
      }

      // Verify the token
      const decoded = jwt.verify(token, constants.JWT_SECRET);
      console.log("decoded token:", decoded);

      // Fetch user details from the database
      const user = await Admin.findById(decoded.userId).select("-password");

      if (!user) {
        console.log("No User found");
        return {
          status: 401,
          jsonBody: {
            success: false,
            message: "No Account Found.",
          }
        };
      }
      const currentUser = {
        _id: user._id.toString(),
        email: user.email,
        applicationCode: user.applicationCode,
        isActive: user.isActive,
        role: user.role
      }

      // Store in context (this persists)
      context.user = currentUser;

      return { status: 200 }; // Continue to next middleware/handler


    } catch (error) {
      console.log("Auth middleware error:", error);
      logger.error('JWT Verification Error:', error);
      return {
        status: 403,
        jsonBody: {
          success: false,
          message: "Invalid or expired token",
        }
      };
    }
  },

  // Check if user is verified
  isVerified: async (request, context) => {
    try {
      console.log("=== ISVERIFIED MIDDLEWARE ===");
      console.log("context.user in isVerified:", context.user);

      const user = context.user || request.user;

      if (!user) {
        return {
          status: 401,
          jsonBody: {
            success: false,
            message: "Authentication required",
          }
        };
      }

      if (!user.isVerified) {
        return {
          status: 403,
          jsonBody: {
            success: false,
            message: "Please verify your email and phone first",
          }
        };
      }

      return { status: 200 }; // Continue to next middleware/handler

    } catch (error) {
      logger.error('Verification error:', error);
      return {
        status: 403,
        jsonBody: {
          success: false,
          message: "Access denied",
        }
      };
    }
  },

  // Authorize based on user roles/permissions
  authorize: (roles = []) => {
    return async (request, context) => {
      try {
        const user = context.user || request.user;

        if (!user) {
          return {
            status: 401,
            jsonBody: {
              success: false,
              message: "Authentication required",
            }
          };
        }

        if (roles.length > 0 && !roles.includes(user.role)) {
          return {
            status: 403,
            jsonBody: {
              success: false,
              message: "Insufficient permissions",
            }
          };
        }

        return { status: 200 }; // Continue to next middleware/handler

      } catch (error) {
        logger.error('Authorization error:', error);
        return {
          status: 403,
          jsonBody: {
            success: false,
            message: "Access denied",
          }
        };
      }
    };
  }
}

module.exports = auth;