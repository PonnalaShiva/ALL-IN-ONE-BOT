'use strict';

process.env.DOTENV_CONFIG_QUIET = 'true';
const dotenv = require('dotenv');
const logger = require('./logger');
const { performStartupHandshake } = require('./entitlementService');
dotenv.config();

const BOT_API = process.env.BOT_API;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;

async function initializeBot() {
    if (!BOT_API || !DISCORD_USER_ID) {
        logger.error('LICENSE', 'Missing BOT_API or DISCORD_USER_ID in .env file');
        process.exit(1);
    }

    const result = await performStartupHandshake({
        force: false,
        allowGrace: true,
        reason: 'startup',
        quiet: true
    });

    if (result.success) {
        const sourceLabel = result.graceMode ? 'grace mode' : (result.fromCache ? 'cache' : 'live check');
        const user = result.user?.username || DISCORD_USER_ID;
        logger.setStatus('license', `● Verified (${user} • ${sourceLabel})`);
        logger.success('LICENSE', `API Key verified for ${user} (${sourceLabel})`);
        return true;
    }

    logger.errorBox('LICENSE', 'Verification Failed', [
        result.message || 'Unknown verification error',
        'No valid account or key found for this bot.',
        'Visit https://fluenosity.com to register/login.'
    ]);
    process.exit(1);
}

module.exports = initializeBot;
