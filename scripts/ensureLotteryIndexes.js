'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config.js');
const { Economy, LotteryRound } = require('../models/economy/schema');

const mongoUri = (config.mongodbUri && config.mongodbUri.trim()) || process.env.MONGODB_URI;
if (!mongoUri) throw new Error('Set mongodbUri in config.js or MONGODB_URI before creating lottery indexes.');

async function main() {
    await mongoose.connect(mongoUri);
    try {
        const economy = Economy.collection;
        const rounds = LotteryRound.collection;

        await economy.createIndex(
            { guildId: 1, 'lotteryEntries.roundId': 1 }
        );
        await rounds.createIndex(
            { roundId: 1 },
            { unique: true }
        );
        await rounds.createIndex(
            { guildId: 1, status: 1 },
            { unique: true, partialFilterExpression: { status: 'open' } }
        );
        await rounds.createIndex(
            { status: 1, drawAt: 1 }
        );

        const [economyIndexes, roundIndexes] = await Promise.all([
            economy.listIndexes().toArray(),
            rounds.listIndexes().toArray()
        ]);
        const hasEntryIndex = economyIndexes.some(index => index.key.guildId === 1 && index.key['lotteryEntries.roundId'] === 1);
        const hasRoundIdIndex = roundIndexes.some(index => index.key.roundId === 1 && index.unique);
        const hasOpenRoundIndex = roundIndexes.some(index => index.key.guildId === 1 && index.key.status === 1 && index.unique && index.partialFilterExpression?.status === 'open');
        const hasDueRoundIndex = roundIndexes.some(index => index.key.status === 1 && index.key.drawAt === 1);
        if (!hasEntryIndex || !hasRoundIdIndex || !hasOpenRoundIndex || !hasDueRoundIndex) throw new Error('One or more lottery indexes were not created.');
        console.log('Verified economy lottery entry index and all three lottery round indexes.');
    } finally {
        await mongoose.disconnect();
    }
}

main().catch(error => {
    console.error('Lottery index setup failed:', error.message);
    process.exitCode = 1;
});
