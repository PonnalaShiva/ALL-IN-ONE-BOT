'use strict';

const { randomInt, randomUUID } = require('crypto');
const { Economy, LotteryRound } = require('./schema');
const { EconomyManager } = require('./economy');
const { LOTTERY_CONFIG } = require('./constants/systemData');
let legacyMigrationComplete = false;
let legacyMigrationPromise = null;

const MATCH_COUNTS = {
    jackpot: total => total,
    second: total => Math.max(0, total - 1),
    third: total => Math.max(0, total - 2),
    consolation: total => Math.max(0, total - 3)
};

function getNumbersPerTicket() {
    const rangeSize = LOTTERY_CONFIG.numberRange.max - LOTTERY_CONFIG.numberRange.min + 1;
    return Math.min(LOTTERY_CONFIG.numbersPerTicket || 6, rangeSize);
}

function generateNumbers() {
    const { min, max } = LOTTERY_CONFIG.numberRange;
    const numbers = new Set();
    while (numbers.size < getNumbersPerTicket()) numbers.add(randomInt(min, max + 1));
    return [...numbers].sort((a, b) => a - b);
}

function nextScheduledDraw(now = new Date()) {
    const drawAt = new Date(now);
    drawAt.setHours(20, 0, 0, 0);
    if (drawAt <= now) drawAt.setDate(drawAt.getDate() + 1);
    return drawAt;
}

async function ensureOpenRound(guildId, now = new Date()) {
    const open = await LotteryRound.findOne({ guildId, status: 'open' });
    if (open) return open;
    const drawing = await LotteryRound.findOne({ guildId, status: 'drawing' });
    if (drawing) return drawing;

    const previous = await LotteryRound.findOne({ guildId, status: 'completed' }).sort({ drawAt: -1 });
    const round = new LotteryRound({
        guildId,
        roundId: `${guildId}:${randomUUID()}`,
        status: 'open',
        startedAt: now,
        drawAt: nextScheduledDraw(now),
        ticketCount: 0,
        prizePool: (LOTTERY_CONFIG.prizePool?.base || 0) + (previous?.carryover || 0)
    });
    try {
        return await round.save();
    } catch (error) {
        if (error.code === 11000) {
            return LotteryRound.findOne({ guildId, status: { $in: ['open', 'drawing'] } });
        }
        throw error;
    }
}

async function getCurrentRound(guildId) {
    return LotteryRound.findOne({ guildId, status: { $in: ['open', 'drawing'] } }).sort({ startedAt: -1 });
}

async function getRoundForDisplay(guildId) {
    const active = await getCurrentRound(guildId);
    if (active) return active;
    return LotteryRound.findOne({ guildId, status: 'completed' }).sort({ completedAt: -1 });
}

async function runWithConcurrency(items, limit, task) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            await task(items[index]);
        }
    });
    await Promise.all(workers);
}

async function buyLotteryTickets(profile, quantity, referenceId) {
    const maxTickets = LOTTERY_CONFIG.maxTicketsPerUser || LOTTERY_CONFIG.maxTickets || 50;
    const ticketPrice = LOTTERY_CONFIG.ticketPrice;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxTickets || !Number.isSafeInteger(ticketPrice) || ticketPrice < 1 || !referenceId) {
        return { success: false, error: 'invalid' };
    }

    await ensureOpenRound(profile.guildId);
    const totalCost = quantity * ticketPrice;
    const settlement = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId,
        guildId: profile.guildId,
        referenceId,
        mutate: async (current, { session }) => {
            const now = new Date();
            const round = await LotteryRound.findOne({ guildId: current.guildId, status: 'open' }).session(session);
            if (!round || round.drawAt <= now) return { success: false, error: 'draw_pending' };
            if ((current.wallet || 0) < totalCost) return { success: false, error: 'funds', wallet: current.wallet || 0 };

            if (!Array.isArray(current.lotteryEntries)) current.lotteryEntries = [];
            const entriesInRound = current.lotteryEntries.filter(entry => entry.roundId === round.roundId);
            const legacyTickets = Math.max(0, Math.floor(Number(current.lotteryTickets) || 0) - entriesInRound.length);
            const held = entriesInRound.length + legacyTickets;
            if (held + quantity > maxTickets) return { success: false, error: 'limit', held, maxTickets };

            const newEntries = [];
            for (let i = 0; i < legacyTickets + quantity; i++) {
                newEntries.push({ ticketId: randomUUID(), roundId: round.roundId, numbers: generateNumbers(), purchasedAt: now });
            }
            current.lotteryEntries.push(...newEntries);
            current.wallet -= totalCost;
            current.lotteryTickets = held + quantity;
            current.transactions.push({ type: 'expense', amount: totalCost, description: `Bought ${quantity} lottery ticket(s)`, category: 'lottery', timestamp: now });

            const addedCount = newEntries.length;
            round.ticketCount += addedCount;
            round.prizePool += addedCount * (LOTTERY_CONFIG.prizePool?.perTicket || 0);
            await round.save({ session });
            return { roundId: round.roundId, tickets: newEntries.slice(legacyTickets).map(entry => entry.numbers), currentTickets: held, totalTickets: held + quantity, drawAt: round.drawAt, prizePool: round.prizePool };
        }
    });
    if (!settlement.success) return settlement;
    return { ...settlement, profile: settlement.profile, totalCost, maxTickets };
}

function allocatePrizes(pool, matchCounts) {
    const totalNumbers = getNumbersPerTicket();
    let rollover = 0;
    let totalPaid = 0;
    let winnerTickets = 0;
    const payouts = new Map();
    for (const tier of [...(LOTTERY_CONFIG.prizes || [])].sort((a, b) => MATCH_COUNTS[b.match](totalNumbers) - MATCH_COUNTS[a.match](totalNumbers))) {
        const matches = MATCH_COUNTS[tier.match]?.(totalNumbers);
        if (!matches || matches < 1) continue;
        const count = matchCounts.get(matches) || 0;
        const budget = Math.floor(pool * tier.share) + rollover;
        if (!count) {
            rollover = budget;
            continue;
        }
        const perTicket = Math.floor(budget / count);
        payouts.set(matches, perTicket);
        totalPaid += perTicket * count;
        winnerTickets += count;
        rollover = budget - perTicket * count;
    }
    return { payouts, totalPaid, winnerTickets, carryover: Math.max(0, Math.floor(pool) - totalPaid) };
}

async function migrateLegacyTickets(round) {
    const query = {
        guildId: round.guildId,
        lotteryTickets: { $gt: 0 },
        lotteryEntries: { $not: { $elemMatch: { roundId: round.roundId } } }
    };
    let lastId = null;
    let hasMore = true;
    while (hasMore) {
        const pageQuery = lastId ? { ...query, _id: { $gt: lastId } } : query;
        const profiles = await Economy.find(pageQuery).sort({ _id: 1 }).limit(100).select('_id userId guildId lotteryTickets lotteryEntries').lean();
        if (!profiles.length) break;
        lastId = profiles[profiles.length - 1]._id;
        for (const legacy of profiles) {
            try {
                await EconomyManager.mutateProfileAtomically({ userId: legacy.userId, guildId: legacy.guildId, referenceId: `lottery-legacy:${round.roundId}`, mutate: async (current, { session }) => {
                    if (current.lotteryEntries?.some(entry => entry.roundId === round.roundId) || !(current.lotteryTickets > 0)) return { success: false, error: 'already_migrated' };
                    const oldEntries = current.lotteryEntries || [];
                    if (oldEntries.length) return { success: false, error: 'older_entries_pending' };
                    const count = Math.max(0, Math.min(Math.floor(Number(current.lotteryTickets) || 0), LOTTERY_CONFIG.maxTicketsPerUser || LOTTERY_CONFIG.maxTickets || 50));
                    const now = new Date();
                    current.lotteryEntries = Array.from({ length: count }, () => ({ ticketId: randomUUID(), roundId: round.roundId, numbers: generateNumbers(), purchasedAt: now }));
                    current.transactions.push({ type: 'shop', amount: 0, description: 'Migrated existing lottery entries to numbered tickets', category: 'lottery', timestamp: now });
                    await LotteryRound.updateOne({ roundId: round.roundId, status: 'open' }, { $inc: { ticketCount: count, prizePool: count * (LOTTERY_CONFIG.prizePool?.perTicket || 0) } }, { session });
                    return { migrated: count };
                }});
            } catch (error) {
                console.error(`[Lottery] Legacy ticket migration failed for ${legacy.userId}/${legacy.guildId}:`, error);
            }
        }
        hasMore = profiles.length === 100;
    }
}

async function beginDraw(round) {
    await migrateLegacyTickets(round);
    return LotteryRound.findOneAndUpdate(
        { roundId: round.roundId, status: 'open', drawAt: { $lte: new Date() } },
        { $set: { status: 'drawing', winningNumbers: generateNumbers(), drawStartedAt: new Date() } },
        { returnDocument: 'after' }
    );
}

async function createDueLegacyRounds() {
    const legacyGuilds = await Economy.distinct('guildId', {
        lotteryTickets: { $gt: 0 },
        $or: [{ lotteryEntries: { $exists: false } }, { lotteryEntries: { $size: 0 } }]
    });
    for (const guildId of legacyGuilds) {
        if (await LotteryRound.exists({ guildId, status: { $in: ['open', 'drawing'] } })) continue;
        const previous = await LotteryRound.findOne({ guildId, status: 'completed' }).sort({ drawAt: -1 });
        try {
            await LotteryRound.create({
                guildId,
                roundId: `${guildId}:${randomUUID()}`,
                status: 'open',
                startedAt: new Date(),
                drawAt: new Date(),
                prizePool: (LOTTERY_CONFIG.prizePool?.base || 0) + (previous?.carryover || 0)
            });
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
    }
}

async function settleRound(round) {
    const aggregation = await Economy.aggregate([
        { $match: { guildId: round.guildId, lotteryEntries: { $elemMatch: { roundId: round.roundId } } } },
        { $unwind: '$lotteryEntries' },
        { $match: { 'lotteryEntries.roundId': round.roundId } },
        { $project: { matches: { $size: { $setIntersection: ['$lotteryEntries.numbers', round.winningNumbers] } } } },
        { $group: { _id: '$matches', count: { $sum: 1 } } }
    ]);
    const matchCounts = new Map(aggregation.map(row => [row._id, row.count]));
    const allocation = allocatePrizes(round.prizePool, matchCounts);
    let lastId = null;
    let hasMore = true;
    while (hasMore) {
        const query = { guildId: round.guildId, lotteryEntries: { $elemMatch: { roundId: round.roundId } } };
        if (lastId) query._id = { $gt: lastId };
        const profiles = await Economy.find(query).sort({ _id: 1 }).limit(100).select('_id userId guildId').lean();
        if (!profiles.length) break;
        lastId = profiles[profiles.length - 1]._id;
        await runWithConcurrency(profiles, 10, async profile => {
            try {
                await EconomyManager.mutateProfileAtomically({ userId: profile.userId, guildId: profile.guildId, referenceId: `lottery-settle:${round.roundId}`, mutate: async (current, { session }) => {
                    const entries = current.lotteryEntries || [];
                    const roundEntries = entries.filter(entry => entry.roundId === round.roundId);
                    if (!roundEntries.length) return { success: false, error: 'already_settled' };
                    let amount = 0;
                    let ticketsWon = 0;
                    let bestMatch = 0;
                    for (const entry of roundEntries) {
                        const matches = entry.numbers.filter(number => round.winningNumbers.includes(number)).length;
                        const prize = allocation.payouts.get(matches) || 0;
                        amount += prize;
                        if (prize > 0) { ticketsWon++; bestMatch = Math.max(bestMatch, matches); }
                    }
                    current.lotteryEntries = entries.filter(entry => entry.roundId !== round.roundId);
                    current.lotteryTickets = current.lotteryEntries.length;
                    if (amount > 0) current.wallet += amount;
                    if (amount > 0) current.lotteryWins = (current.lotteryWins || 0) + 1;
                    current.transactions.push({ type: amount ? 'income' : 'shop', amount, description: amount ? `Lottery prize: ${bestMatch}/${getNumbersPerTicket()} matches (${ticketsWon} winning ticket(s))` : 'Lottery round settled', category: 'lottery', timestamp: new Date() });
                    if (amount || ticketsWon) await LotteryRound.updateOne({ roundId: round.roundId, status: 'drawing' }, { $inc: { paidAmount: amount, winnersCount: ticketsWon } }, { session });
                    return { amount, ticketsWon };
                }});
            } catch (error) {
                console.error(`[Lottery] Settlement failed for ${profile.userId}/${profile.guildId} in ${round.roundId}:`, error);
            }
        });
        hasMore = profiles.length === 100;
    }
    const pending = await Economy.exists({ guildId: round.guildId, lotteryEntries: { $elemMatch: { roundId: round.roundId } } });
    if (pending) return { roundId: round.roundId, guildId: round.guildId, status: 'drawing', winningNumbers: round.winningNumbers };
    const currentRound = await LotteryRound.findOne({ roundId: round.roundId });
    const paidAmount = currentRound?.paidAmount || 0;
    const winnersCount = currentRound?.winnersCount || 0;
    const ticketCount = [...matchCounts.values()].reduce((sum, count) => sum + count, 0);
    const carryover = ticketCount > 0 ? Math.max(0, Math.floor(round.prizePool) - paidAmount) : 0;
    await LotteryRound.updateOne({ roundId: round.roundId, status: 'drawing' }, { $set: { status: 'completed', carryover, completedAt: new Date() } });

    const winningProfiles = await Economy.find({ guildId: round.guildId, transactions: { $elemMatch: { referenceId: `lottery-settle:${round.roundId}`, amount: { $gt: 0 } } } }).select('userId transactions').lean();
    return {
        roundId: round.roundId,
        guildId: round.guildId,
        status: 'completed',
        winningNumbers: round.winningNumbers,
        winners: winningProfiles.map(profile => {
            const transaction = [...profile.transactions].reverse().find(tx => tx.referenceId === `lottery-settle:${round.roundId}` && tx.amount > 0);
            return transaction ? { userId: profile.userId, amount: transaction.amount, description: transaction.description } : null;
        }).filter(Boolean),
        winnersCount,
        paidAmount,
        carryover
    };
}

async function processDueLotteryDraws() {
    if (!legacyMigrationComplete) {
        if (!legacyMigrationPromise) {
            legacyMigrationPromise = createDueLegacyRounds()
                .then(() => { legacyMigrationComplete = true; })
                .finally(() => { legacyMigrationPromise = null; });
        }
        await legacyMigrationPromise;
    }
    const dueRounds = await LotteryRound.find({ status: 'open', drawAt: { $lte: new Date() } }).sort({ drawAt: 1 }).limit(100);
    const results = [];
    for (const due of dueRounds) {
        try {
            const claimed = await beginDraw(due);
            if (claimed) results.push(await settleRound(claimed));
        } catch (error) {
            console.error(`[Lottery] Draw failed for ${due.roundId}:`, error);
        }
    }
    const recovering = await LotteryRound.find({ status: 'drawing' }).sort({ drawAt: 1 }).limit(100);
    for (const round of recovering) {
        try { results.push(await settleRound(round)); }
        catch (error) { console.error(`[Lottery] Recovery failed for ${round.roundId}:`, error); }
    }
    return results;
}

module.exports = { buyLotteryTickets, ensureOpenRound, getCurrentRound, getRoundForDisplay, processDueLotteryDraws };
