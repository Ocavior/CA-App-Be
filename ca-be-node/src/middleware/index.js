const cors = require('cors');
const helmet = require('helmet');

// NOT CALLED from src/index.js in this app - intentional, not an oversight.
// The `typeof app.use === 'function'` guard below was always false against
// the original Azure Functions `app` object (from @azure/functions), so
// helmet/cors have never actually run in this app's history - the real CORS
// handling is the manual header-setting in src/index.js. Express DOES have
// a real `.use()`, so wiring this into the new server would silently start
// applying security headers for the first time ever, which is a genuine
// behavior change, not a neutral runtime swap. Per this migration's
// bug-for-bug fidelity requirement, that change is deliberately NOT made
// here - see MIGRATION_NOTES.md. This file is kept, unmodified, for
// completeness in case that decision is revisited later.
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
