
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Database error') {
        super(message, 503);
    }
}

class AuthError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
    }
}

module.exports = {
    // Errors
    AppError,
    ValidationError,
    DatabaseError,
    AuthError,
};