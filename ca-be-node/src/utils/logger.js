const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'azure-function' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Add file transport for production ONLY if not running in Azure Functions
if (process.env.NODE_ENV === 'production') {
    // This will only run in non-Azure production environments
    // const fs = require('fs');
    // const path = require('path');
    
    // // Create logs directory if it doesn't exist
    // const logsDir = 'logs';
    // if (!fs.existsSync(logsDir)) {
    //     fs.mkdirSync(logsDir, { recursive: true });
    // }
    
    // logger.add(new winston.transports.File({ 
    //     filename: path.join(logsDir, 'error.log'), 
    //     level: 'error' 
    // }));
    // logger.add(new winston.transports.File({ 
    //     filename: path.join(logsDir, 'combined.log') 
    // }));
    logger.info('Running in Azure Functions - file logging disabled, using console output');
}

module.exports = logger;