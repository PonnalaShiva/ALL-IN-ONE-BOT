process.env.DOTENV_CONFIG_QUIET = 'true';
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('./utils/logger');
require('dotenv').config();


let config = {};
try {
    config = require('./config.js');
} catch (_) { }
const uri = (config.mongodbUri && config.mongodbUri.trim()) || process.env.MONGODB_URI || '';

async function connectToDatabase() {
    if (!uri) {
        throw new Error('MongoDB URI is required. Set mongodbUri in config.js or MONGODB_URI in the environment.');
    }
    try {
        mongoose.connection.on('disconnected', () => logger.warn('DATABASE', 'Mongoose disconnected'));
        mongoose.connection.on('reconnected', () => logger.info('DATABASE', 'Mongoose reconnected'));
        mongoose.connection.on('error', e => logger.error('DATABASE', `Mongoose error: ${e.message}`));

        
        await mongoose.connect(uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 10000 });
        logger.setStatus('database', '● Connected (Mongoose Unified)');
    } catch (err) {
        console.error("❌ Error connecting to MongoDB via Mongoose", err);
        await mongoose.disconnect().catch(() => { });
        throw new Error(`Database startup failed: ${err.message}`);
    }
}

async function closeDatabase() {
    try {
        await mongoose.disconnect();
    } catch (err) {
        throw new Error(`Failed to close MongoDB connection: ${err.message}`);
    }
}


function getProxyCollection(name) {
    return new Proxy({}, {
        get(_target, prop) {
            const col = mongoose.connection.db ? mongoose.connection.db.collection(name) : mongoose.connection.collection(name);
            const val = col[prop];
            return typeof val === 'function' ? val.bind(col) : val;
        }
    });
}

const notificationsCollection = getProxyCollection("notifications");
const nicknameConfigs = getProxyCollection("nicknameConfig");
const playlistCollection = getProxyCollection('lavalinkplaylist');
const autoplayCollection = getProxyCollection('autoplaylavalink');
const botStatusCollection = getProxyCollection('bot_status');

module.exports = {
    connectToDatabase,
    closeDatabase,
    notificationsCollection,
    nicknameConfigs,
    playlistCollection,
    autoplayCollection,
    botStatusCollection,
};
