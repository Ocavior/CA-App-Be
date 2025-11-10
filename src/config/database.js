const mongoose = require('mongoose');
const logger = require('../utils/logger');
const constants = require('./app.config');

let isConnected = false;

async function connectDB() {
    if (isConnected) {
        return;
    }

    try {
        const connectionString = constants.mongodbUri;
    
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        isConnected = true;
        logger.info('MongoDB connected successfully');

        mongoose.connection.on('error', (error) => {
            logger.error('MongoDB connection error:', error);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
            isConnected = false;
        });

    } catch (error) {
        logger.error('MongoDB connection failed:', error);
        // Don't throw error to prevent function app from crashing
        // Consider implementing retry logic here
    }
}

module.exports = { connectDB };
