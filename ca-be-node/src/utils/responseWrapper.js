class ResponseWrapper {
    success(data, message = 'Success', status = 200) {
        return {
            status,
            jsonBody: {
                success: true,
                message,
                data
            }
        };
    }

    created(data, message = 'Created successfully') {
        return this.success(data, message, 201);
    }

    error(message = 'Internal server error', status = 500) {
        return {
            status,
            jsonBody: {
                success: false,
                error: message
            }
        };
    }

    badRequest(message = 'Bad request') {
        return this.error(message, 400);
    }

    unauthorized(message = 'Unauthorized') {
        return this.error(message, 401);
    }

    forbidden(message = 'Forbidden') {
        return this.error(message, 403);
    }

    notFound(message = 'Not found') {
        return this.error(message, 404);
    }

    conflict(message = 'Conflict') {
        return this.error(message, 409);
    }

    validationError(errors) {
        return {
            status: 422,
            jsonBody: {
                success: false,
                error: 'Validation failed',
                details: errors
            }
        };
    }
}

module.exports = new ResponseWrapper();
