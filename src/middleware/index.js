const cors = require('cors');
const helmet = require('helmet');

function setupMiddleware(app) {
    // Security middleware
    if (typeof app.use === 'function') {
        app.use(helmet());
        app.use(cors({
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
    }
}

module.exports = { setupMiddleware };
