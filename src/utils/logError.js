module.exports = {
    logError: (methodName, error, additionalInfo = {}) => {
        console.error(`[LoggerService ${methodName} Error]:`, {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            ...additionalInfo
        });
        return error;
    }
};