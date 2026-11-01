require('dotenv').config();

const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpire: process.env.JWT_EXPIRE,
    corsOrigin: process.env.CORS_ORIGIN,
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // Validate required environment variables
    validate() {
        const required = ['JWT_SECRET'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }
};

// Validate configuration on load
if (config.nodeEnv === 'production') {
    config.validate();
}

module.exports = config;
