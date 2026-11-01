const logger = require('../utils/logger');
const { query } = require('../db/pool');

async function connectDB() {
    try {
        await query('SELECT 1');
        logger.info('PostgreSQL connected successfully');
    } catch (error) {
        // Not fatal: the pool opens connections on demand, so routes recover on
        // their own once the database is reachable again.
        logger.error('PostgreSQL connection failed:', error);
    }
}

module.exports = { connectDB };
