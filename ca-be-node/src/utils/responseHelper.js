class ResponseHelper {
    static sendSuccess(res, data, message = '', code = 1) {
        return res.status(200).json({
            success: true,
            code,
            message,
            data
        });
    }

    static sendError(res, status, message, error = null, code = 0) {
        console.error(`Error: ${message}`, error);
        return res.status(status).json({
            success: false,
            code,
            message,
            error: error?.message
        });
    }
}

module.exports = ResponseHelper;