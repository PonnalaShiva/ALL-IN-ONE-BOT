const { Economy, Heist } = require('./schema');
const { BUSINESS_TYPES, HEIST_TARGETS } = require('./constants/businessData');
const { STOCKS, MARKET_EVENTS } = require('./constants/stockData');
const { FISH_TYPES, RARITY_CHANCES, FISHING_RODS, BAIT_TYPES } = require('./constants/fishingData');
const { CROPS, FERTILIZERS, CROP_QUALITY } = require('./constants/farmingData');
const { CRIME_TYPES, HEAT_LEVELS } = require('./constants/crimeData');
const { ACHIEVEMENTS, LOTTERY_CONFIG, INSURANCE_TYPES, PRESTIGE_CONFIG } = require('./constants/systemData');

const MAX_TRANSACTION_HISTORY = 100;
function sliceTransactions(tx) {
    return {
        $each: [tx],
        $slice: -MAX_TRANSACTION_HISTORY
    };
}

class EconomyManager {
    
    static async getProfile(userId, guildId) {
        try {
            const profile = await Economy.findOneAndUpdate(
                { userId, guildId },
                {
                    $setOnInsert: {
                        userId,
                        guildId,
                        
                        wallet: 1000,
                        bank: 0,
                        bankLimit: 10000,
                        
                        familyVault: 0,
                        familyMembers: [],
                        familyBond: 0,
                        
                        cars: [],
                        activeCar: null,
                        
                        pets: [],
                        maxPets: 1,
                        
                        properties: [],
                        primaryResidence: null,
                        
                        businesses: [],
                        maxBusinesses: 1, 
                        businessSkill: 0,
                        
                        activeHeists: [],
                        completedHeists: 0,
                        failedHeists: 0,
                        heistSkill: 0,
                        heistEquipment: [], 
                        heatLevel: 0,
                        lastHeatDecay: new Date(), 
                        jailTime: null,
                        
                        purchasedRoles: [],
                        
                        activeEffects: [],
                        
                        level: 1,
                        experience: 0,
                        reputation: 0,
                        
                        racingStats: {
                            totalRaces: 0,
                            wins: 0,
                            losses: 0,
                            earnings: 0,
                            winStreak: 0
                        },
                        
                        lastRobbed: null,
                        robberyAttempts: 0,
                        successfulRobberies: 0,
                        
                        cooldowns: {
                            daily: null,
                            weekly: null,
                            work: null,
                            race: null,
                            trip: null,
                            petCare: null,
                            robbery: null,
                            beg: null,
                            gambling: null,
                            shop: null,
                            business: null,
                            heist: null
                        },
                        dailyStreak: 0,
                        transactions: [],
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                {
                    upsert: true,
                    returnDocument: 'after',
                    setDefaultsOnInsert: true
                }
            );
            
            
            if (!profile.maxBusinesses || profile.maxBusinesses < 1) {
                profile.maxBusinesses = this.calculateMaxBusinesses(profile.businessSkill || 0);
                await profile.save();
            } else {
                
                const calculatedMax = this.calculateMaxBusinesses(profile.businessSkill || 0);
                if (calculatedMax > profile.maxBusinesses) {
                    profile.maxBusinesses = calculatedMax;
                    await profile.save();
                }
            }

            
            if (Array.isArray(profile.transactions) && profile.transactions.length > MAX_TRANSACTION_HISTORY) {
                profile.transactions = profile.transactions.slice(-MAX_TRANSACTION_HISTORY);
                await profile.save();
            }
            
            profile.$locals.economyBalanceBaseline = {
                wallet: profile.wallet || 0,
                bank: profile.bank || 0
            };
            return profile;
            
        } catch (error) {
            
            if (error.code === 11000) {
                console.log(`Duplicate key handled for user ${userId} in guild ${guildId}, fetching existing profile`);
                const profile = await Economy.findOne({ userId, guildId });
                if (profile) {
                    
                    const calculatedMax = this.calculateMaxBusinesses(profile.businessSkill || 0);
                    if (calculatedMax > (profile.maxBusinesses || 1)) {
                        profile.maxBusinesses = calculatedMax;
                        await profile.save();
                    }
                    profile.$locals.economyBalanceBaseline = {
                        wallet: profile.wallet || 0,
                        bank: profile.bank || 0
                    };
                }
                return profile;
            }
            
            console.error('Error in getProfile:', error);
            throw error;
        }
    }

    
    static async updateWallet(userId, guildId, amount, referenceId = `legacy-wallet:${Date.now()}:${Math.random()}`) {
        if (!Number.isSafeInteger(amount)) throw new TypeError('Wallet changes must be safe integer currency amounts.');
        const result = await this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async profile => {
            const oldBalance = profile.wallet || 0;
            profile.wallet = Math.max(0, oldBalance + amount);
            const delta = profile.wallet - oldBalance;
            if (!delta) return { noLedger: true };
            profile.transactions.push({ type: delta > 0 ? 'income' : 'expense', amount: Math.abs(delta), description: 'Wallet balance adjustment', category: 'adjustment', timestamp: new Date() });
            return {};
        }});
        return result.profile;
    }

    static async mutateProfileAtomically({ userId, guildId, referenceId, mutate }) {
        if (!referenceId || typeof mutate !== 'function') throw new TypeError('An idempotency reference and mutation callback are required.');
        await this.getProfile(userId, guildId);
        const session = await Economy.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session);
                if (!profile) throw new Error('Economy profile is missing.');
                const prior = (profile.transactions || []).find(transaction => transaction.referenceId === referenceId);
                if (prior) {
                    result = { success: false, duplicate: true, profile };
                    return;
                }

                profile.$locals.economyBalanceBaseline = {
                    wallet: Number(profile.wallet) || 0,
                    bank: Number(profile.bank) || 0
                };
                const transactionCount = profile.transactions?.length || 0;
                const outcome = await mutate(profile, { session });
                if (outcome?.success === false) {
                    result = { ...outcome, profile };
                    return;
                }
                if (!Array.isArray(profile.transactions)) profile.transactions = [];
                if (profile.transactions.length <= transactionCount && !outcome?.noLedger) {
                    throw new Error('Atomic profile mutations must append a transaction record.');
                }
                if (profile.transactions.length > transactionCount) {
                    profile.transactions[profile.transactions.length - 1].referenceId = referenceId;
                }
                if (profile.transactions.length > MAX_TRANSACTION_HISTORY) {
                    profile.transactions = profile.transactions.slice(-MAX_TRANSACTION_HISTORY);
                }
                await profile.save({ session });
                result = { ...(outcome || {}), success: true, profile };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    
    static async updateBank(userId, guildId, amount, referenceId = `legacy-bank:${Date.now()}:${Math.random()}`) {
        if (!Number.isSafeInteger(amount)) throw new TypeError('Bank changes must be safe integer currency amounts.');
        const result = await this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async profile => {
            const oldBalance = profile.bank || 0;
            profile.bank = Math.max(0, oldBalance + amount);
            const delta = profile.bank - oldBalance;
            if (!delta) return { noLedger: true };
            profile.transactions.push({ type: 'transfer', amount: Math.abs(delta), description: 'Bank balance adjustment', category: 'banking', timestamp: new Date() });
            return {};
        }});
        return result.profile;
    }

    
    static async updateFamilyVault(userId, guildId, amount, referenceId = `legacy-vault:${Date.now()}:${Math.random()}`) {
        if (!Number.isSafeInteger(amount)) throw new TypeError('Family vault changes must be safe integer currency amounts.');
        const result = await this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async profile => {
            const oldBalance = profile.familyVault || 0;
            profile.familyVault = Math.max(0, oldBalance + amount);
            const delta = profile.familyVault - oldBalance;
            if (!delta) return { noLedger: true };
            profile.transactions.push({ type: 'transfer', amount: Math.abs(delta), description: 'Family vault balance adjustment', category: 'vault', timestamp: new Date() });
            return {};
        }});
        return result.profile;
    }

    
    static async transferWallet({ fromUserId, toUserId, guildId, amount, tax = 0, referenceId, donorXp = 0, recipientXp = 0, donorDescription, recipientDescription }) {
        if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(tax) || tax < 0 || tax >= amount) {
            throw new TypeError('Transfer amount and tax must be valid positive integer currency values.');
        }
        if (!referenceId || fromUserId === toUserId) {
            throw new TypeError('A unique transfer reference and distinct users are required.');
        }

        
        await Promise.all([
            this.getProfile(fromUserId, guildId),
            this.getProfile(toUserId, guildId)
        ]);

        const session = await Economy.startSession();
        let result;
        try {
            await session.withTransaction(async () => {
                const priorTransfer = await Economy.findOne({
                    userId: fromUserId,
                    guildId,
                    transactions: { $elemMatch: { referenceId } }
                }).session(session).select('wallet');
                if (priorTransfer) {
                    const recipient = await Economy.findOne({ userId: toUserId, guildId }).session(session).select('wallet');
                    result = {
                        duplicate: true,
                        donorWallet: priorTransfer.wallet,
                        recipientWallet: recipient?.wallet
                    };
                    return;
                }

                const timestamp = new Date();
                const debited = await Economy.findOneAndUpdate(
                    {
                        userId: fromUserId,
                        guildId,
                        wallet: { $gte: amount },
                        transactions: { $not: { $elemMatch: { referenceId } } }
                    },
                    {
                        $inc: { wallet: -amount, netWorth: -amount, experience: donorXp },
                        $push: {
                            transactions: {
                                type: 'expense', amount, description: donorDescription,
                                category: 'donation', timestamp, referenceId
                            }
                        }
                    },
                    { returnDocument: 'after', session, runValidators: true }
                ).select('wallet');

                if (!debited) {
                    const duplicate = await Economy.exists({
                        userId: fromUserId,
                        guildId,
                        transactions: { $elemMatch: { referenceId } }
                    }).session(session);
                    if (duplicate) {
                        const recipient = await Economy.findOne({ userId: toUserId, guildId }).session(session).select('wallet');
                        result = { duplicate: true, donorWallet: (await Economy.findOne({ userId: fromUserId, guildId }).session(session).select('wallet')).wallet, recipientWallet: recipient?.wallet };
                        return;
                    }
                    const currentSender = await Economy.findOne({ userId: fromUserId, guildId }).session(session).select('wallet');
                    result = { insufficientFunds: true, donorWallet: currentSender?.wallet ?? 0 };
                    return;
                }

                const credited = await Economy.findOneAndUpdate(
                    { userId: toUserId, guildId },
                    {
                        $inc: {
                            wallet: amount - tax,
                            netWorth: amount - tax,
                            lifetimeEarnings: amount - tax,
                            experience: recipientXp
                        },
                        $push: {
                            transactions: {
                                type: 'income', amount: amount - tax, description: recipientDescription,
                                category: 'donation', timestamp, referenceId
                            }
                        }
                    },
                    { returnDocument: 'after', session, runValidators: true }
                ).select('wallet');

                if (!credited) throw new Error('Transfer recipient profile disappeared during the transaction.');
                result = { donorWallet: debited.wallet, recipientWallet: credited.wallet };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    
    static async depositWalletToBank({ userId, guildId, maxAmount, bankLimit, referenceId, description }) {
        if (!Number.isSafeInteger(maxAmount) || maxAmount <= 0 || !Number.isSafeInteger(bankLimit) || bankLimit < 0 || !referenceId) {
            throw new TypeError('Deposit amount, bank limit, and reference must be valid.');
        }
        await this.getProfile(userId, guildId);
        const session = await Economy.startSession();
        let result;
        try {
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session).select('wallet bank');
                if (!profile) throw new Error('Bank deposit profile is missing.');

                const priorDeposit = await Economy.exists({
                    userId,
                    guildId,
                    transactions: { $elemMatch: { referenceId } }
                }).session(session);
                if (priorDeposit) {
                    result = { amount: 0, duplicate: true, wallet: profile.wallet, bank: profile.bank };
                    return;
                }

                const amount = Math.min(maxAmount, Math.max(0, profile.wallet || 0), Math.max(0, bankLimit - (profile.bank || 0)));
                if (!amount) {
                    result = { amount: 0, wallet: profile.wallet, bank: profile.bank };
                    return;
                }

                const updated = await Economy.findOneAndUpdate(
                    {
                        userId,
                        guildId,
                        wallet: { $gte: amount },
                        bank: { $lte: bankLimit - amount },
                        transactions: { $not: { $elemMatch: { referenceId } } }
                    },
                    {
                        $inc: { wallet: -amount, bank: amount },
                        $push: {
                            transactions: {
                                type: 'transfer', amount, description, category: 'bank', timestamp: new Date(), referenceId
                            }
                        }
                    },
                    { returnDocument: 'after', session, runValidators: true }
                ).select('wallet bank');
                result = updated
                    ? { amount, wallet: updated.wallet, bank: updated.bank }
                    : { amount: 0, wallet: profile.wallet, bank: profile.bank };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    static async transferVault({ userId, guildId, direction, amount, referenceId, description }) {
        if (!['deposit', 'withdraw'].includes(direction) || !referenceId || (amount !== 'all' && (!Number.isSafeInteger(amount) || amount <= 0))) {
            throw new TypeError('Vault transfer direction, amount, and reference must be valid.');
        }
        await this.getProfile(userId, guildId);
        const session = await Economy.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session);
                if (!profile) throw new Error('Vault profile is missing.');
                if (!profile.properties?.some(property => property.propertyId === profile.primaryResidence)) {
                    result = { success: false, reason: 'no_property', profile };
                    return;
                }
                const prior = await Economy.exists({ userId, guildId, transactions: { $elemMatch: { referenceId } } }).session(session);
                if (prior) {
                    result = { success: false, duplicate: true, reason: 'duplicate', profile };
                    return;
                }

                const capacity = this.getVaultCapacity(profile);
                const wallet = Number(profile.wallet) || 0;
                const vault = Number(profile.familyVault) || 0;
                const transferAmount = amount === 'all'
                    ? (direction === 'deposit' ? Math.min(wallet, Math.max(0, capacity - vault)) : vault)
                    : amount;
                if (transferAmount <= 0) {
                    result = { success: false, reason: direction === 'deposit' ? 'vault_full_or_empty' : 'vault_empty', profile };
                    return;
                }
                if (direction === 'deposit' && transferAmount > wallet) {
                    result = { success: false, reason: 'insufficient_wallet', profile };
                    return;
                }
                if (direction === 'deposit' && vault + transferAmount > capacity) {
                    result = { success: false, reason: 'vault_capacity', profile, capacity };
                    return;
                }
                if (direction === 'withdraw' && transferAmount > vault) {
                    result = { success: false, reason: 'insufficient_vault', profile };
                    return;
                }

                const delta = direction === 'deposit' ? transferAmount : -transferAmount;
                const updated = await Economy.findOneAndUpdate(
                    {
                        userId,
                        guildId,
                        ...(direction === 'deposit'
                            ? { wallet: { $gte: transferAmount }, familyVault: { $lte: capacity - transferAmount } }
                            : { familyVault: { $gte: transferAmount } }),
                        transactions: { $not: { $elemMatch: { referenceId } } }
                    },
                    {
                        $inc: { wallet: -delta, familyVault: delta },
                        $push: { transactions: sliceTransactions({
                            type: 'transfer', amount: transferAmount, description,
                            category: 'vault', timestamp: new Date(), referenceId
                        }) }
                    },
                    { session, returnDocument: 'after', runValidators: true }
                );
                result = updated
                    ? { success: true, amount: transferAmount, profile: updated }
                    : { success: false, reason: 'balance_changed', profile };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    static async transferBank({ userId, guildId, direction, amount, referenceId, description }) {
        if (!['deposit', 'withdraw'].includes(direction) || !referenceId || (amount !== 'all' && (!Number.isSafeInteger(amount) || amount <= 0))) {
            throw new TypeError('Bank transfer direction, amount, and reference must be valid.');
        }
        await this.getProfile(userId, guildId);
        const session = await Economy.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session);
                if (!profile) throw new Error('Bank profile is missing.');
                const prior = await Economy.exists({ userId, guildId, transactions: { $elemMatch: { referenceId } } }).session(session);
                if (prior) {
                    result = { success: false, reason: 'duplicate', profile };
                    return;
                }
                const bankLimit = this.getBankLimit(profile);
                const wallet = Number(profile.wallet) || 0;
                const bank = Number(profile.bank) || 0;
                const transferAmount = amount === 'all'
                    ? (direction === 'deposit' ? Math.min(wallet, Math.max(0, bankLimit - bank)) : bank)
                    : amount;
                if (transferAmount <= 0) {
                    result = { success: false, reason: direction === 'deposit' ? 'no_wallet_or_space' : 'no_bank_funds', profile, bankLimit };
                    return;
                }
                if (direction === 'deposit' && transferAmount > wallet) {
                    result = { success: false, reason: 'insufficient_wallet', profile, bankLimit };
                    return;
                }
                if (direction === 'deposit' && bank + transferAmount > bankLimit) {
                    result = { success: false, reason: 'bank_capacity', profile, bankLimit };
                    return;
                }
                if (direction === 'withdraw' && transferAmount > bank) {
                    result = { success: false, reason: 'insufficient_bank', profile, bankLimit };
                    return;
                }

                const delta = direction === 'deposit' ? transferAmount : -transferAmount;
                const updated = await Economy.findOneAndUpdate(
                    {
                        userId,
                        guildId,
                        ...(direction === 'deposit'
                            ? { wallet: { $gte: transferAmount }, bank: { $lte: bankLimit - transferAmount } }
                            : { bank: { $gte: transferAmount } }),
                        transactions: { $not: { $elemMatch: { referenceId } } }
                    },
                    {
                        $inc: { wallet: -delta, bank: delta },
                        $push: { transactions: sliceTransactions({
                            type: 'transfer', amount: transferAmount, description,
                            category: 'banking', timestamp: new Date(), referenceId
                        }) }
                    },
                    { session, returnDocument: 'after', runValidators: true }
                );
                result = updated
                    ? { success: true, amount: transferAmount, profile: updated, bankLimit }
                    : { success: false, reason: 'balance_changed', profile, bankLimit };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    
    static async commitRobbery({ robberId, victimId, guildId, referenceId, robberDescription, victimDescription, failureDescription }) {
        if (!referenceId || robberId === victimId) throw new TypeError('A unique robbery reference and distinct users are required.');
        await Promise.all([this.getProfile(robberId, guildId), this.getProfile(victimId, guildId)]);

        const session = await Economy.startSession();
        let result;
        try {
            await session.withTransaction(async () => {
                const robber = await Economy.findOne({ userId: robberId, guildId }).session(session);
                const victim = await Economy.findOne({ userId: victimId, guildId }).session(session);
                if (!robber || !victim) throw new Error('Robbery profile missing.');

                const referencePrefix = `rob:${referenceId}`;
                const previous = (robber.transactions || []).find(tx => tx.referenceId === referencePrefix);
                if (previous) {
                    const security = this.calculateSecurityLevel(victim);
                    const successChance = Math.max(5, 30 + Math.min((Number(robber.level) || 1) * 2, 20) - security * 0.5);
                    result = {
                        duplicate: true,
                        success: previous.type === 'income',
                        successChance,
                        security,
                        stolenAmount: previous.type === 'income' ? previous.amount : 0,
                        penalty: previous.type === 'expense' ? previous.amount : 0,
                        robberWallet: robber.wallet,
                        victimWallet: victim.wallet
                    };
                    return;
                }

                const now = new Date();
                const cooldownUntil = robber.cooldowns?.robbery
                    ? new Date(new Date(robber.cooldowns.robbery).getTime() + 30 * 60 * 1000)
                    : null;
                if (cooldownUntil && cooldownUntil > now) {
                    result = { onCooldown: true, timeLeft: cooldownUntil - now };
                    return;
                }
                if ((Number(victim.wallet) || 0) < 500) {
                    result = { targetPoor: true, victimWallet: victim.wallet };
                    return;
                }

                const security = this.calculateSecurityLevel(victim);
                const robberLevel = Number(robber.level) || 1;
                const successChance = Math.max(5, 30 + Math.min(robberLevel * 2, 20) - security * 0.5);
                const success = Math.random() * 100 < successChance;
                const robberUpdate = {
                    $set: { 'cooldowns.robbery': now, reputation: Math.max((robber.reputation || 0) - (success ? 10 : 5), -100) },
                    $inc: { robberyAttempts: 1 }
                };
                let stolenAmount = 0;
                let penalty = 0;
                if (success) {
                    const maxSteal = Math.min((Number(victim.wallet) || 0) * 0.3, 5000);
                    stolenAmount = Math.min(victim.wallet, Math.floor(Math.random() * maxSteal) + 100);
                    robberUpdate.$inc.wallet = stolenAmount;
                    robberUpdate.$inc.netWorth = stolenAmount;
                    robberUpdate.$inc.lifetimeEarnings = stolenAmount;
                    robberUpdate.$inc.experience = 20;
                    robberUpdate.$inc.successfulRobberies = 1;
                    robberUpdate.$push = { transactions: sliceTransactions({
                        type: 'income', amount: stolenAmount, description: robberDescription || `Robbery proceeds from ${victimId}`,
                        category: 'robbery', timestamp: now, referenceId: referencePrefix
                    }) };
                } else {
                    penalty = Math.min(Number(robber.wallet) || 0, Math.floor(Math.random() * 2000) + 500);
                    robberUpdate.$inc.wallet = -penalty;
                    robberUpdate.$inc.netWorth = -penalty;
                    robberUpdate.$push = { transactions: sliceTransactions({
                        type: 'expense', amount: penalty, description: failureDescription || 'Failed robbery fine',
                        category: 'robbery', timestamp: now, referenceId: referencePrefix
                    }) };
                }

                const robberFilter = {
                    userId: robberId,
                    guildId,
                    $or: [
                        { 'cooldowns.robbery': { $exists: false } },
                        { 'cooldowns.robbery': null },
                        { 'cooldowns.robbery': { $lte: new Date(now.getTime() - 30 * 60 * 1000) } }
                    ],
                    transactions: { $not: { $elemMatch: { referenceId: referencePrefix } } }
                };
                const updatedRobber = await Economy.findOneAndUpdate(robberFilter, robberUpdate, { session, returnDocument: 'after', runValidators: true }).select('wallet');
                if (!updatedRobber) throw new Error('Robbery cooldown or idempotency claim was lost.');

                let updatedVictim = victim;
                if (success) {
                    const pets = (victim.pets || []).map(pet => {
                        if (Math.random() >= 0.5) return pet;
                        pet.health = Math.max(10, (pet.health || 100) - Math.floor(Math.random() * 15));
                        pet.happiness = Math.max(0, (pet.happiness || 50) - Math.floor(Math.random() * 20));
                        return pet;
                    });
                    updatedVictim = await Economy.findOneAndUpdate(
                        { userId: victimId, guildId, wallet: { $gte: stolenAmount }, transactions: { $not: { $elemMatch: { referenceId: referencePrefix } } } },
                        {
                            $inc: { wallet: -stolenAmount, netWorth: -stolenAmount },
                            $set: { lastRobbed: now, pets },
                            $push: { transactions: sliceTransactions({
                                type: 'expense', amount: stolenAmount, description: victimDescription || `Robbed by ${robberId}`,
                                category: 'robbery', timestamp: now, referenceId: referencePrefix
                            }) }
                        },
                        { session, returnDocument: 'after', runValidators: true }
                    ).select('wallet');
                    if (!updatedVictim) throw new Error('Victim balance changed during robbery resolution.');
                }

                result = {
                    success, successChance, security, stolenAmount, penalty,
                    robberWallet: updatedRobber.wallet,
                    victimWallet: updatedVictim.wallet
                };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    
    static checkCooldown(profile, commandName) {
        const cooldownTimes = {
            daily: 24 * 60 * 60 * 1000, 
            weekly: 7 * 24 * 60 * 60 * 1000, 
            work: 60 * 60 * 1000, 
            hunt: 5 * 1000, 
            race: 5 * 60 * 1000, 
            trip: 24 * 60 * 60 * 1000, 
            petCare: 30 * 60 * 1000, 
            robbery: 30 * 60 * 1000, 
            beg: 10 * 60 * 1000, 
            gambling: 30 * 1000, 
            shop: 10 * 1000, 
            business: 24 * 60 * 60 * 1000, 
            heist: 60 * 60 * 1000, 
        };

        const lastUsed = profile.cooldowns[commandName];
        const cooldownTime = cooldownTimes[commandName];

        if (!lastUsed || !cooldownTime) return { onCooldown: false };

        const timeLeft = cooldownTime - (Date.now() - lastUsed.getTime());

        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

            return {
                onCooldown: true,
                timeLeft: { hours, minutes, seconds },
                totalMs: timeLeft
            };
        }

        return { onCooldown: false };
    }

    
    static calculateSecurityLevel(profile) {
        if (!profile || typeof profile !== 'object') return 0;
        let totalSecurity = 0;

        
        const primaryProperty = (profile.properties || []).find(p => p.propertyId === profile.primaryResidence);
        if (primaryProperty) {
            totalSecurity += (Number(primaryProperty.securityLevel) || 0) * 10;
        }

        
        (profile.pets || []).forEach(pet => {
            const petEfficiency = (
                (Number(pet.happiness) || 0) +
                (Number(pet.health) || 0) +
                (Number(pet.cleanliness) || 0)
            ) / 300;
            totalSecurity += (Number(pet.securityLevel) || 0) * petEfficiency;
        });

        
        (profile.purchasedRoles || []).forEach(role => {
            if (!role.expiryDate || role.expiryDate > new Date()) {
                totalSecurity += Number(role.benefits?.robberyProtection) || 0;
            }
        });

        
        (profile.activeEffects || []).forEach(effect => {
            if (effect.type === 'robbery_protection') {
                totalSecurity += (Number(effect.multiplier) || 0) * (Number(effect.stacks) || 1);
            }
        });

        return Number.isFinite(totalSecurity) ? Math.max(0, Math.min(100, totalSecurity)) : 0;
    }


static async calculateBusinessIncome(business, profile = null) {
    const businessType = BUSINESS_TYPES[business.type];
    const baseIncome = businessType.dailyIncome;

    const levelMultiplier = business.level * 0.5 + 0.5;
    
    const employeeBonus = business.employees * (300 + (business.level * 100)); 
    const efficiencyMultiplier = business.efficiency || 1.0;
    const reputationBonus = (business.reputation / 100) * (500 + business.level * 100);
    
    
    const skillBonus = profile ? ((profile.businessSkill || 0) * 10) : 0;

    
    let boostMultiplier = 1.0;
    if (profile && profile.activeEffects) {
        const businessBoosts = profile.activeEffects.filter(e => 
            e.type === 'business_boost' && 
            (!e.expiryTime || e.expiryTime > new Date())
        );
        businessBoosts.forEach(boost => {
            boostMultiplier *= boost.multiplier || 1.0;
        });
    }

    
    const baseRevenue = baseIncome[0] * levelMultiplier + employeeBonus + reputationBonus + skillBonus;
    const minIncome = Math.max(baseRevenue, employeeBonus * 0.5); 
    const maxIncome = Math.floor((baseIncome[1] * levelMultiplier + employeeBonus + reputationBonus + skillBonus) * efficiencyMultiplier * boostMultiplier);
    
    
    const adjustedMinIncome = Math.max(minIncome, maxIncome * 0.3);
    
    const randomIncome = Math.floor(Math.random() * (maxIncome - adjustedMinIncome + 1)) + adjustedMinIncome;
    const employeeCosts = business.employees * Math.floor(businessType.employeeCost * 0.6);

    let finalProfit = randomIncome - employeeCosts;
    if (finalProfit < 0) {
        
        finalProfit = Math.floor(randomIncome * 0.2); 
    }

    return {
        revenue: randomIncome,
        expenses: employeeCosts,
        profit: Math.max(0, finalProfit),
        boostMultiplier: boostMultiplier > 1.0 ? boostMultiplier : null
    };
}


static calculateMaxBusinesses(businessSkill) {

    return Math.min(6, 1 + Math.floor(businessSkill / 20));
}


static async giveBusinessExperience(profile, action, amount = 0) {
    let expGain = 0;
    let skillGain = 0;
    
    switch(action) {
        case 'collect':
            
            expGain = Math.max(5, Math.min(100, Math.floor(amount / 500))); 
            skillGain = Math.max(1, Math.min(10, Math.floor(amount / 2500))); 
            break;
        case 'upgrade':
            expGain = 50; 
            skillGain = 5; 
            break;
        case 'hire':
            expGain = 15 * amount; 
            skillGain = Math.min(3, amount); 
            break;
        case 'fire':
            expGain = 10; 
            skillGain = 0;
            break;
        case 'delete':
            expGain = 30; 
            skillGain = 3; 
            break;
    }
    
    profile.experience = (profile.experience || 0) + expGain;
    const oldSkill = profile.businessSkill || 0;
    profile.businessSkill = Math.min(100, oldSkill + skillGain);
    
    
    const oldMax = this.calculateMaxBusinesses(oldSkill);
    const newMax = this.calculateMaxBusinesses(profile.businessSkill);
    if (newMax > oldMax) {
        profile.maxBusinesses = newMax;
    }
    
    return { expGain, skillGain };
}


static async sellBusiness(profile, businessIndex) {
    const business = profile.businesses[businessIndex];
    const businessType = BUSINESS_TYPES[business.type];
    
    
    const baseValue = business.purchasePrice * 0.6;
    const levelBonus = business.purchasePrice * 0.02 * business.level; 
    const reputationBonus = business.purchasePrice * 0.002 * business.reputation; 
    
    const sellValue = Math.floor(baseValue + levelBonus + reputationBonus);
    
    
    profile.businesses.splice(businessIndex, 1);
    profile.wallet += sellValue;
    
    
    profile.transactions.push({
        type: 'income',
        amount: sellValue,
        description: `Sold business: ${business.name}`,
        category: 'business'
    });
    
    return sellValue;
}
static async collectBusinessIncome(userId, guildId, referenceId) {
    const ref = referenceId || `business-collection:${userId}:${guildId}:${Date.now()}`;
    return this.mutateProfileAtomically({
        userId, guildId, referenceId: ref,
        mutate: async profile => {
            let totalProfit = 0;
            const businessReport = [];
            const now = new Date();
            for (const business of profile.businesses || []) {
                const lastCollection = business.lastCollection ? new Date(business.lastCollection) : null;
                const hoursSinceCollection = lastCollection ? (now - lastCollection) / (1000 * 60 * 60) : 24;
                const daysToCollect = hoursSinceCollection >= 24 ? Math.min(Math.floor(hoursSinceCollection / 24), 7) : 0;
                if (!daysToCollect) continue;

                let revenue = 0;
                let expenses = 0;
                let profit = 0;
                for (let day = 0; day < daysToCollect; day++) {
                    const income = await this.calculateBusinessIncome(business, profile);
                    revenue += income.revenue;
                    expenses += income.expenses;
                    profit += income.profit;
                }
                business.revenue = (Number(business.revenue) || 0) + revenue;
                business.expenses = (Number(business.expenses) || 0) + expenses;
                business.profit = (Number(business.profit) || 0) + profit;
                business.lastCollection = now;
                totalProfit += profit;
                businessReport.push({ name: business.name, profit, revenue, expenses, daysCollected: daysToCollect });
            }

            if (!businessReport.length) return { success: false, noCollection: true, totalProfit: 0, businessReport };
            const rewards = totalProfit > 0 ? await this.giveBusinessExperience(profile, 'collect', totalProfit) : { expGain: 0, skillGain: 0 };
            if (totalProfit > 0) {
                profile.wallet = (Number(profile.wallet) || 0) + totalProfit;
                if (!Array.isArray(profile.transactions)) profile.transactions = [];
                profile.transactions.push({
                    type: 'income', amount: totalProfit, description: 'Business profits collected',
                    category: 'business', timestamp: now
                });
            }
            return { totalProfit, businessReport, rewards, noLedger: totalProfit <= 0 };
        }
    });
}

    static async calculateHeistSuccess(heist, memberProfiles) {
        const target = HEIST_TARGETS[heist.targetType];
        if (!target) throw new Error(`Unknown heist target: ${heist.targetType}`);
        let successChance = target.successChance;

        
        for (const member of heist.members) {
            const profile = memberProfiles.find(item => item.userId === member.userId);
            if (!profile) continue;
            const skillBonus = (Number(profile.heistSkill) || 0) * 0.5; 
            successChance += skillBonus / heist.members.length;
        }

        
        const requiredEquipment = target.equipment;
        const hasAllEquipment = requiredEquipment.every(item =>
            heist.members.some(member => (member.equipment || []).includes(item))
        );
        if (hasAllEquipment) successChance += 20;

        
        const heatPenalty = heist.heat_level * 0.3;
        successChance -= heatPenalty;

        
        if (heist.preparation_time >= target.planningTime) {
            successChance += 15;
        }

        return Math.max(5, Math.min(95, successChance)); 
    }

    static async claimHeist(heistId, guildId) {
        return Heist.findOneAndUpdate(
            { heistId, guildId, status: 'ready' },
            { $set: { status: 'in_progress', executionDate: new Date() } },
            { returnDocument: 'after', runValidators: true }
        );
    }

    static async executeHeist(heistId, customTxOptions = {}) {
        const session = await Economy.startSession();
        let result;
        try {
            await session.withTransaction(async () => {
                const heist = await Heist.findOne({ heistId, status: 'in_progress' }).session(session);
                if (!heist) {
                    result = { alreadyResolved: true };
                    return;
                }

                const target = HEIST_TARGETS[heist.targetType];
                if (!target || !heist.members.length) throw new Error(`Heist ${heistId} has invalid target or no members.`);
                const userIds = heist.members.map(member => member.userId);
                const memberProfiles = await Economy.find({ guildId: heist.guildId, userId: { $in: userIds } }).session(session);
                if (memberProfiles.length !== heist.members.length) throw new Error(`Heist ${heistId} has a missing member profile.`);

                const successChance = await this.calculateHeistSuccess(heist, memberProfiles);
                const success = Math.random() * 100 < successChance;
                const basePayout = success
                    ? Math.floor(Math.random() * (target.payout[1] - target.payout[0] + 1)) + target.payout[0]
                    : 0;
                const memberShare = success ? Math.floor(basePayout / heist.members.length) : 0;
                const now = new Date();
                const memberResults = [];

                for (const member of heist.members) {
                    const profile = memberProfiles.find(item => item.userId === member.userId);
                    const heatIncrease = target.difficulty * (success ? 10 : 15);
                    const update = {
                        $pull: { activeHeists: heistId }
                    };
                    if (success) {
                        const roleBonus = ({ mastermind: 1.5, hacker: 1.3, safecracker: 1.2 })[member.role] || 1.0;
                        const payout = Math.floor(memberShare * roleBonus);
                        memberResults.push({ userId: member.userId, payout, fine: 0 });
                        update.$inc = {
                            wallet: payout,
                            netWorth: payout,
                            lifetimeEarnings: payout,
                            completedHeists: 1,
                            experience: 100
                        };
                        update.$set = {
                            heistSkill: Math.min(100, (profile.heistSkill || 0) + 10),
                            heatLevel: Math.min(100, (profile.heatLevel || 0) + heatIncrease)
                        };
                        update.$push = { transactions: sliceTransactions({
                            type: 'income', amount: payout,
                            description: customTxOptions.txSuccess || `Heist: ${target.name}`,
                            category: 'heist', timestamp: now, referenceId: `heist:${heistId}`
                        }) };
                    } else {
                        const fine = Math.floor((profile.wallet || 0) * 0.2);
                        memberResults.push({ userId: member.userId, payout: 0, fine });
                        update.$inc = { wallet: -fine, netWorth: -fine, failedHeists: 1 };
                        update.$set = {
                            jailTime: new Date(now.getTime() + target.difficulty * 6 * 60 * 60 * 1000),
                            heatLevel: Math.min(100, (profile.heatLevel || 0) + heatIncrease)
                        };
                        update.$push = { transactions: sliceTransactions({
                            type: 'expense', amount: fine,
                            description: customTxOptions.txFailure || `Heist failure fine: ${target.name}`,
                            category: 'heist', timestamp: now, referenceId: `heist:${heistId}`
                        }) };
                    }

                    const updated = await Economy.findOneAndUpdate(
                        { userId: member.userId, guildId: heist.guildId },
                        update,
                        { session, returnDocument: 'after', runValidators: true }
                    );
                    if (!updated) throw new Error(`Could not update heist member ${member.userId}.`);
                }

                const updatedHeist = await Heist.findOneAndUpdate(
                    { heistId, status: 'in_progress' },
                    { $set: { status: success ? 'completed' : 'failed', actual_payout: basePayout, executionDate: now } },
                    { session, returnDocument: 'after', runValidators: true }
                );
                if (!updatedHeist) throw new Error(`Could not finalize heist ${heistId}.`);
                const updatedProfiles = await Economy.find({ guildId: heist.guildId, userId: { $in: userIds } }).session(session);
                result = { success, heist: updatedHeist, memberProfiles: updatedProfiles, memberResults };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    
    static calculateWorkMultiplier(profile) {
        let multiplier = 1.0;

        
        const hasProperty = (profile.properties || []).length > 0;
        if (hasProperty && (profile.familyMembers || []).length > 0) {
            const familyBonus = ((Number(profile.familyBond) || 0) / 100) * 0.5;
            multiplier += familyBonus;
        }

        
        (profile.purchasedRoles || []).forEach(role => {
            if (!role.expiryDate || role.expiryDate > new Date()) {
                multiplier += (Number(role.benefits?.workMultiplier) || 1) - 1;
            }
        });

        
        (profile.activeEffects || []).forEach(effect => {
            if (effect.type === 'work_boost') {
                multiplier += ((Number(effect.multiplier) || 1) - 1) * (Number(effect.stacks) || 1);
            }
        });

        return multiplier;
    }

    static async claimWorkReward(userId, guildId, description) {
        await this.getProfile(userId, guildId);
        const session = await Economy.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session);
                if (!profile) throw new Error('Work profile is missing.');
                const now = new Date();
                const cooldownMs = 60 * 60 * 1000;
                const lastWork = profile.cooldowns?.work ? new Date(profile.cooldowns.work) : null;
                if (lastWork && now.getTime() - lastWork.getTime() < cooldownMs) {
                    result = { success: false, nextWork: new Date(lastWork.getTime() + cooldownMs) };
                    return;
                }

                const baseEarnings = Math.floor(Math.random() * 500) + 200;
                const workMultiplier = this.calculateWorkMultiplier(profile);
                const hasProperty = (profile.properties || []).length > 0;
                const familyEarnings = hasProperty
                    ? (profile.familyMembers || []).reduce((sum, member) => sum +
                        ((Number(member.salary) || 100) * (Number(member.workEfficiency) || 1) * ((Number(member.bond) || 0) / 100)), 0)
                    : 0;
                const personalEarnings = Math.floor(baseEarnings * workMultiplier);
                const totalEarnings = personalEarnings + Math.floor(familyEarnings);
                const currentLevel = Number(profile.level) || 1;
                const currentExperience = Number(profile.experience) || 0;
                const requiredXP = currentLevel * 100;
                const newExperience = currentExperience + 25;
                const leveledUp = newExperience >= requiredXP;
                const level = leveledUp ? currentLevel + 1 : currentLevel;
                const experience = leveledUp ? 0 : newExperience;
                const referenceId = `work:${userId}:${guildId}:${now.getTime()}`;
                const updated = await Economy.findOneAndUpdate(
                    {
                        userId,
                        guildId,
                        $or: [
                            { 'cooldowns.work': { $exists: false } },
                            { 'cooldowns.work': null },
                            { 'cooldowns.work': { $lte: new Date(now.getTime() - cooldownMs) } }
                        ],
                        transactions: { $not: { $elemMatch: { referenceId } } }
                    },
                    {
                        $inc: { wallet: totalEarnings, netWorth: totalEarnings, lifetimeEarnings: totalEarnings },
                        $set: { 'cooldowns.work': now, level, experience },
                        $push: { transactions: sliceTransactions({
                            type: 'income', amount: totalEarnings, description,
                            category: 'work', timestamp: now, referenceId
                        }) }
                    },
                    { session, returnDocument: 'after', runValidators: true }
                );
                if (!updated) {
                    const fresh = await Economy.findOne({ userId, guildId }).session(session).select('cooldowns.work');
                    result = { success: false, nextWork: new Date(new Date(fresh?.cooldowns?.work || now).getTime() + cooldownMs) };
                    return;
                }
                result = {
                    success: true, profile: updated, personalEarnings, familyEarnings,
                    totalEarnings, workMultiplier, leveledUp, requiredXP, hasProperty
                };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    static async claimGamblingSession(userId, guildId, referenceId, durationMs = 65000) {
        if (!referenceId) throw new TypeError('Gambling session reference is required.');
        await this.getProfile(userId, guildId);
        const now = new Date();
        const activeUntil = new Date(now.getTime() + durationMs);
        const cooldownMs = 30 * 1000;
        return Economy.findOneAndUpdate(
            {
                userId,
                guildId,
                $and: [
                    { $or: [
                        { 'cooldowns.gambling': { $exists: false } },
                        { 'cooldowns.gambling': null },
                        { 'cooldowns.gambling': { $lte: new Date(now.getTime() - cooldownMs) } }
                    ] },
                    { $or: [
                        { activeGamblingSession: { $exists: false } },
                        { activeGamblingSession: null },
                        { activeGamblingSessionExpiresAt: { $lte: now } }
                    ] }
                ]
            },
            {
                $set: {
                    'cooldowns.gambling': now,
                    activeGamblingSession: referenceId,
                    activeGamblingSessionExpiresAt: activeUntil
                }
            },
            { returnDocument: 'after', runValidators: true }
        );
    }

    static async settleGamblingBet({ userId, guildId, betAmount, winnings, won, description, referenceId, push = false, sessionToken = null, bypassCooldown = false }) {
        if (!Number.isSafeInteger(betAmount) || betAmount <= 0 || !Number.isSafeInteger(winnings) || winnings < 0 || !referenceId) {
            throw new TypeError('Bet, payout, and reference must be valid integer values.');
        }
        await this.getProfile(userId, guildId);
        const session = await Economy.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session);
                if (!profile) throw new Error('Gambling profile is missing.');
                const prior = await Economy.exists({ userId, guildId, transactions: { $elemMatch: { referenceId } } }).session(session);
                if (prior) {
                    result = { success: false, duplicate: true, profile };
                    return;
                }
                const now = new Date();
                const cooldownMs = 30 * 1000;
                const lastBet = profile.cooldowns?.gambling ? new Date(profile.cooldowns.gambling) : null;
                if (!bypassCooldown && !sessionToken && lastBet && now.getTime() - lastBet.getTime() < cooldownMs) {
                    result = { success: false, cooldown: true, nextBet: new Date(lastBet.getTime() + cooldownMs), profile };
                    return;
                }
                if (sessionToken && profile.activeGamblingSession !== sessionToken) {
                    result = { success: false, staleSession: true, profile };
                    return;
                }
                if ((Number(profile.wallet) || 0) < betAmount) {
                    result = { success: false, insufficientFunds: true, profile };
                    return;
                }

                const net = push ? 0 : (won ? winnings - betAmount : -betAmount);
                const stats = profile.gamblingStats || {};
                const inc = {
                    wallet: net,
                    netWorth: net,
                    'gamblingStats.totalBets': 1,
                    'gamblingStats.totalWagered': betAmount
                };
                const set = { 'cooldowns.gambling': now };
                const max = {};
                if (net > 0) inc.lifetimeEarnings = net;
                if (push) {
                    
                } else if (won) {
                    inc['gamblingStats.totalWon'] = Math.max(0, net);
                    max['gamblingStats.biggestWin'] = Math.max(Number(stats.biggestWin) || 0, Math.max(0, net));
                } else {
                    inc['gamblingStats.totalLost'] = betAmount;
                    max['gamblingStats.biggestLoss'] = Math.max(Number(stats.biggestLoss) || 0, betAmount);
                }
                const update = {
                    $inc: inc,
                    $set: set,
                    $push: { transactions: sliceTransactions({
                        type: push ? 'transfer' : (won ? 'income' : 'expense'),
                        amount: Math.abs(net), description, category: 'gambling', timestamp: now, referenceId
                    }) }
                };
                if (Object.keys(max).length) update.$max = max;
                const cooldownFilter = {
                    $or: [
                        { 'cooldowns.gambling': { $exists: false } },
                        { 'cooldowns.gambling': null },
                        { 'cooldowns.gambling': { $lte: new Date(now.getTime() - cooldownMs) } }
                    ]
                };
                const sessionFilter = sessionToken
                    ? { activeGamblingSession: sessionToken }
                    : { $or: [
                        { activeGamblingSession: { $exists: false } },
                        { activeGamblingSession: null },
                        { activeGamblingSessionExpiresAt: { $lte: now } }
                    ] };
                if (sessionToken || bypassCooldown) delete cooldownFilter.$or;
                const settlementFilters = (sessionToken || bypassCooldown) ? [sessionFilter] : [cooldownFilter, sessionFilter];
                const updated = await Economy.findOneAndUpdate(
                    {
                        userId,
                        guildId,
                        wallet: { $gte: betAmount },
                        $and: settlementFilters,
                        transactions: { $not: { $elemMatch: { referenceId } } }
                    },
                    {
                        ...update,
                        ...(sessionToken ? { $unset: { activeGamblingSession: 1, activeGamblingSessionExpiresAt: 1 } } : {})
                    },
                    { session, returnDocument: 'after', runValidators: true }
                );
                if (!updated) {
                    const fresh = await Economy.findOne({ userId, guildId }).session(session);
                    const freshBet = fresh?.cooldowns?.gambling;
                    result = fresh && fresh.wallet < betAmount
                        ? { success: false, insufficientFunds: true, profile: fresh }
                        : { success: false, cooldown: true, nextBet: new Date(new Date(freshBet || now).getTime() + cooldownMs), profile: fresh };
                    return;
                }
                result = { success: true, profile: updated, net, winnings };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    
    static getGamblingLuck(profile) {
        let luckMultiplier = 1.0;

        profile.activeEffects.forEach(effect => {
            if (effect.type === 'gambling_luck') {
                luckMultiplier += (effect.multiplier - 1) * effect.stacks;
            }
        });

        return Math.min(2.5, luckMultiplier); 
    }

    
    static getVaultCapacity(profile) {
        const primaryProperty = profile.properties.find(p => p.propertyId === profile.primaryResidence);
        let baseCapacity = primaryProperty ? primaryProperty.vaultCapacity : 0;

        profile.activeEffects.forEach(effect => {
            if (effect.type === 'vault_boost') {
                baseCapacity *= effect.multiplier;
            }
        });

        return Math.floor(baseCapacity);
    }

    
    static getBankLimit(profile) {
        let baseLimit = profile.bankLimit;

        profile.activeEffects.forEach(effect => {
            if (effect.type === 'bank_boost') {
                baseLimit *= effect.multiplier;
            }
        });

        return Math.floor(baseLimit);
    }

    
    static async addActiveEffect(userId, guildId, effectType, multiplier, duration, stacks = 1, referenceId = `effect:${Date.now()}:${Math.random()}`) {
        if (!effectType || !Number.isFinite(multiplier) || !Number.isFinite(duration) || duration <= 0 || !Number.isSafeInteger(stacks) || stacks < 1) throw new TypeError('Effect parameters are invalid.');
        const result = await this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async profile => {
            const existingEffect = profile.activeEffects.find(e => e.type === effectType);
            if (existingEffect && effectType === 'gambling_luck') {
                existingEffect.stacks = Math.min(5, existingEffect.stacks + stacks);
                existingEffect.expiryTime = new Date(Date.now() + duration);
            } else {
                if (existingEffect) profile.activeEffects.splice(profile.activeEffects.indexOf(existingEffect), 1);
                profile.activeEffects.push({ effectId: `${effectType}_${Date.now()}`, name: effectType.replace('_', ' ').toUpperCase(), type: effectType, multiplier, stacks, expiryTime: new Date(Date.now() + duration) });
            }
            profile.transactions.push({ type: 'shop', amount: 0, description: `Applied ${effectType} effect`, category: 'effects', timestamp: new Date() });
            return {};
        }});
        return result.profile;
    }

    static getStockPrice(symbol) {
        const stock = STOCKS[symbol];
        if (!stock) return null;
        
        const seed = Date.now() / (1000 * 60 * 15); 
        const noise = Math.sin(seed * symbol.charCodeAt(0)) * stock.volatility;
        const trendNoise = Math.cos(seed / 4 * symbol.charCodeAt(1)) * (stock.volatility * 0.5);
        const currentPrice = Math.max(1, Math.floor(stock.basePrice * (1 + noise + trendNoise)));
        return currentPrice;
    }

    static getAllStockPrices() {
        const prices = {};
        for (const [symbol, stock] of Object.entries(STOCKS)) {
            prices[symbol] = {
                ...stock,
                currentPrice: this.getStockPrice(symbol)
            };
        }
        return prices;
    }

    static async buyStock(userId, guildId, symbol, shares, referenceId) {
        if (!Number.isSafeInteger(shares) || shares <= 0 || !referenceId) return { success: false, error: 'Share quantity and purchase reference must be valid.' };
        const price = this.getStockPrice(symbol);
        if (!price) return { success: false, error: 'Invalid stock symbol' };
        const totalCost = price * shares;
        if (!Number.isSafeInteger(totalCost)) return { success: false, error: 'Purchase total is too large.' };
        const mutation = await this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async profile => {
            if ((profile.wallet || 0) < totalCost) return { success: false, error: 'Insufficient funds' };
            profile.wallet -= totalCost;
            const existing = profile.stockPortfolio.find(position => position.symbol === symbol);
            if (existing) {
                const totalShares = existing.shares + shares;
                existing.avgBuyPrice = Math.floor(((existing.totalInvested || 0) + totalCost) / totalShares);
                existing.shares = totalShares;
                existing.totalInvested = (existing.totalInvested || 0) + totalCost;
            } else profile.stockPortfolio.push({ symbol, name: STOCKS[symbol].name, shares, avgBuyPrice: price, totalInvested: totalCost });
            if (!profile.stockStats) profile.stockStats = {};
            profile.stockStats.totalInvested = (profile.stockStats.totalInvested || 0) + totalCost;
            profile.stockStats.totalTrades = (profile.stockStats.totalTrades || 0) + 1;
            profile.transactions.push({ type: 'expense', amount: totalCost, description: `Bought ${shares}x ${symbol} @ $${price}`, category: 'stocks', timestamp: new Date() });
            return { price, totalCost, shares };
        } });
        return mutation?.success ? mutation : { success: false, error: mutation?.duplicate ? 'This purchase was already processed.' : mutation?.error || 'Purchase failed.' };
    }

    static async sellStock(userId, guildId, symbol, shares, referenceId) {
        if (!Number.isSafeInteger(shares) || shares <= 0 || !referenceId) return { success: false, error: 'Share quantity and sale reference must be valid.' };
        const price = this.getStockPrice(symbol);
        if (!price) return { success: false, error: 'Invalid stock symbol' };
        const totalRevenue = price * shares;
        if (!Number.isSafeInteger(totalRevenue)) return { success: false, error: 'Sale total is too large.' };
        const mutation = await this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async profile => {
            const position = profile.stockPortfolio.find(entry => entry.symbol === symbol);
            if (!position || position.shares < shares) return { success: false, error: 'Not enough shares' };
            const previousShares = position.shares;
            const previousInvestment = Number.isSafeInteger(position.totalInvested) ? position.totalInvested : (position.avgBuyPrice || 0) * previousShares;
            const costBasis = shares === previousShares ? previousInvestment : Math.floor(previousInvestment * shares / previousShares);
            const profit = totalRevenue - costBasis;
            profile.wallet = (profile.wallet || 0) + totalRevenue;
            position.shares -= shares;
            position.totalInvested = Math.max(0, previousInvestment - costBasis);
            if (position.shares > 0) position.avgBuyPrice = Math.floor(position.totalInvested / position.shares);
            if (position.shares === 0) profile.stockPortfolio = profile.stockPortfolio.filter(entry => entry.symbol !== symbol);
            if (!profile.stockStats) profile.stockStats = {};
            profile.stockStats.totalReturns = (profile.stockStats.totalReturns || 0) + totalRevenue;
            profile.stockStats.totalTrades = (profile.stockStats.totalTrades || 0) + 1;
            if (profit > 0) profile.stockStats.biggestProfit = Math.max(profile.stockStats.biggestProfit || 0, profit);
            profile.transactions.push({ type: 'income', amount: totalRevenue, description: `Sold ${shares}x ${symbol} @ $${price} (P/L: $${profit >= 0 ? '+' : ''}${profit})`, category: 'stocks', timestamp: new Date() });
            return { price, totalRevenue, profit, shares };
        } });
        return mutation?.success ? mutation : { success: false, error: mutation?.duplicate ? 'This sale was already processed.' : mutation?.error || 'Sale failed.' };
    }

    static async executeFishing(userId, guildId, referenceId) {
        if (!referenceId) return { success: false, error: 'A unique fishing cast reference is required.' };
        return this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async profile => {
            const now = new Date();
            if (!profile.cooldowns) profile.cooldowns = {};
            const lastCast = profile.cooldowns.fish ? new Date(profile.cooldowns.fish).getTime() : 0;
            if (now.getTime() - lastCast < 4000) return { success: false, error: 'Fishing is cooling down.', cooldownRemaining: 4000 - (now.getTime() - lastCast) };
            const rod = FISHING_RODS[profile.fishingRod || 'basic_rod'] || FISHING_RODS.basic_rod;
            const bait = profile.baitBox?.[0] || null;
            let rarityBoost = rod.rarityBoost + (bait ? (BAIT_TYPES[bait.id]?.rarityBoost || 0) : 0);
            rarityBoost += ((profile.prestigeMultiplier || 1) - 1) * 10;
            let roll = Math.max(0, Math.random() * 100 - rarityBoost);
            let selectedRarity = 'common';
            let cumulative = 0;
            for (const [rarity, chance] of Object.entries(RARITY_CHANCES)) { cumulative += chance; if (roll <= cumulative) { selectedRarity = rarity; break; } }
            const fishOfRarity = Object.entries(FISH_TYPES).filter(([, data]) => data.rarity === selectedRarity);
            if (!fishOfRarity.length) return { success: false, error: 'No fish are configured for this rarity.' };
            const [fishId, fish] = fishOfRarity[Math.floor(Math.random() * fishOfRarity.length)];
            const weight = +(fish.weight[0] + Math.random() * (fish.weight[1] - fish.weight[0])).toFixed(2);
            const catchBonus = rod.catchBonus * (bait ? (BAIT_TYPES[bait.id]?.catchBonus || 1) : 1);
            const value = Math.floor(fish.baseValue * catchBonus * (weight / fish.weight[0]));
            const xp = Math.floor(fish.xp * catchBonus);
            if (bait) { bait.quantity = (bait.quantity || 1) - 1; if (bait.quantity <= 0) profile.baitBox.shift(); }
            profile.fishCollection.push({ fishId, name: fish.name, rarity: fish.rarity, weight, value, caughtAt: now });
            if (!profile.fishingStats) profile.fishingStats = {};
            profile.fishingStats.totalCaught = (profile.fishingStats.totalCaught || 0) + 1;
            profile.fishingStats.totalEarned = (profile.fishingStats.totalEarned || 0) + value;
            if (weight > (profile.fishingStats.biggestCatch || 0)) profile.fishingStats.biggestCatch = weight;
            if (selectedRarity === 'legendary') profile.fishingStats.legendaryCaught = (profile.fishingStats.legendaryCaught || 0) + 1;
            if (['rare', 'epic', 'legendary'].includes(selectedRarity)) profile.fishingStats.rareCaught = (profile.fishingStats.rareCaught || 0) + 1;
            profile.wallet = (profile.wallet || 0) + value;
            profile.experience = (profile.experience || 0) + xp;
            profile.cooldowns.fish = now;
            profile.transactions.push({ type: 'income', amount: value, description: `Caught ${fish.name} (${weight}kg)`, category: 'fishing', timestamp: now });
            return { fish: { ...fish, id: fishId }, weight, value, xp, rarity: selectedRarity };
        } });
    }

    static async plantCrop(userId, guildId, cropId, plotIndex, referenceId) {
        const profile = await this.getProfile(userId, guildId);
        const crop = CROPS[cropId];
        if (!crop) return { success: false, error: 'Invalid crop' };
        if (!Number.isInteger(plotIndex) || plotIndex < 0) {
            return { success: false, error: 'Plot number must be a non-negative whole number' };
        }
        if (!referenceId) return { success: false, error: 'A unique planting reference is required.' };
        const mutation = await this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async current => {
            if (current.level < crop.level) return { success: false, error: `Requires level ${crop.level}` };
            if ((current.wallet || 0) < crop.seedPrice) return { success: false, error: 'Not enough money for seeds' };
            const maxPlots = current.maxPlots || 3;
            if (plotIndex >= maxPlots) return { success: false, error: `You only have ${maxPlots} plots` };
            const existingPlot = (current.farmPlots || []).find(plot => Number(plot.plotId) === plotIndex);
            if (existingPlot && existingPlot.status !== 'empty') return { success: false, error: 'Plot is already occupied' };
            const now = new Date();
            const harvestAt = new Date(now.getTime() + crop.growTime);
            current.wallet -= crop.seedPrice;
            if (existingPlot) Object.assign(existingPlot, { crop: cropId, plantedAt: now, harvestAt, fertilized: false, watered: false, lastWatered: null, quality: 'normal', status: 'growing' });
            else current.farmPlots.push({ plotId: plotIndex, crop: cropId, plantedAt: now, harvestAt, fertilized: false, watered: false, lastWatered: null, quality: 'normal', status: 'growing' });
            if (!current.cooldowns) current.cooldowns = {};
            current.cooldowns.farm = now;
            current.transactions.push({ type: 'expense', amount: crop.seedPrice, description: `Planted ${crop.name}`, category: 'farming', timestamp: now });
            return { crop, harvestAt, plotIndex };
        } });
        return mutation?.success ? mutation : mutation;
    }

    static async harvestCrop(userId, guildId, plotIndex, referenceId) {
        const profile = await this.getProfile(userId, guildId);
        if (!referenceId) return { success: false, error: 'A unique harvest reference is required.' };
        return this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async current => {
            const plot = (current.farmPlots || []).find(entry => Number(entry.plotId) === plotIndex);
            if (!plot || !['growing', 'ready'].includes(plot.status)) return { success: false, error: 'Nothing to harvest here' };
            if (new Date() < plot.harvestAt) return { success: false, error: 'Crop not ready yet', readyAt: plot.harvestAt };
            const crop = CROPS[plot.crop];
            if (!crop) return { success: false, error: 'Unknown crop' };
            const qualityData = CROP_QUALITY[plot.quality] || CROP_QUALITY.normal;
            const sellPrice = Math.floor(crop.sellPrice * qualityData.multiplier * (current.prestigeMultiplier || 1));
            const xp = Math.floor(crop.xp * qualityData.multiplier);
            current.wallet = (current.wallet || 0) + sellPrice;
            current.experience = (current.experience || 0) + xp;
            if (!current.farmingStats) current.farmingStats = {};
            current.farmingStats.totalHarvested = (current.farmingStats.totalHarvested || 0) + 1;
            current.farmingStats.totalFarmEarnings = (current.farmingStats.totalFarmEarnings || 0) + sellPrice;
            if (plot.quality === 'legendary') current.farmingStats.legendaryHarvests = (current.farmingStats.legendaryHarvests || 0) + 1;
            Object.assign(plot, { status: 'empty', crop: null, plantedAt: null, harvestAt: null, fertilized: false, watered: false, lastWatered: null });
            current.transactions.push({ type: 'income', amount: sellPrice, description: `Harvested ${crop.name} (${qualityData.name})`, category: 'farming', timestamp: new Date() });
            return { crop, quality: qualityData, sellPrice, xp };
        } });
    }

    static async waterCrop(userId, guildId, plotIndex, referenceId) {
        const profile = await this.getProfile(userId, guildId);
        if (!referenceId) return { success: false, error: 'A unique watering reference is required.' };
        return this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async current => {
            const plot = (current.farmPlots || []).find(entry => Number(entry.plotId) === plotIndex);
            if (!plot || plot.status !== 'growing') return { success: false, error: 'Nothing to water here' };
            if (plot.watered) return { success: false, error: 'Already watered' };
            plot.watered = true;
            const qualityRoll = Math.random();
            if (qualityRoll < 0.05) plot.quality = 'legendary';
            else if (qualityRoll < 0.15) plot.quality = 'excellent';
            else if (qualityRoll < 0.35) plot.quality = 'good';
            else plot.quality = 'normal';
            const now = new Date();
            plot.lastWatered = now;
            plot.harvestAt = new Date(now.getTime() + Math.max(0, plot.harvestAt.getTime() - now.getTime()) * 0.9);
            current.transactions.push({ type: 'shop', amount: 0, description: `Watered crop in plot ${plotIndex + 1}`, category: 'farming', timestamp: now });
            return { quality: plot.quality };
        } });
    }

    static async executeCrime(userId, guildId, crimeId, txOptions = {}) {
        const crime = CRIME_TYPES[crimeId];
        if (!crime) return { success: false, error: 'Invalid crime type' };
        if (!txOptions.referenceId) return { success: false, error: 'A unique crime attempt reference is required.' };
        const mutation = await this.mutateProfileAtomically({
            userId, guildId, referenceId: txOptions.referenceId,
            mutate: async profile => {
                if (profile.level < crime.level) return { success: false, error: `Requires level ${crime.level}` };
                const now = new Date();
                if (profile.jailTime && now < profile.jailTime) return { success: false, error: 'In jail', jailRemaining: profile.jailTime.getTime() - now.getTime() };
                if (!profile.cooldowns) profile.cooldowns = {};
                const lastCrime = profile.cooldowns.crime ? new Date(profile.cooldowns.crime).getTime() : 0;
                const remainingCooldown = crime.cooldown - (now.getTime() - lastCrime);
                if (remainingCooldown > 0) return { success: false, error: 'cooldown', cooldownRemaining: remainingCooldown };

                const heatLevel = HEAT_LEVELS.find(h => (profile.crimeStats?.heatLevel || 0) >= h.min && (profile.crimeStats?.heatLevel || 0) <= h.max) || HEAT_LEVELS[0];
                const successRate = Math.max(5, crime.successRate - heatLevel.penalty + (profile.level * 0.5));
                const success = Math.random() * 100 < successRate;
                if (!profile.crimeStats) profile.crimeStats = {};
                profile.cooldowns.crime = now;

                if (success) {
                    const reward = Math.floor(crime.minReward + Math.random() * (crime.maxReward - crime.minReward));
                    const finalReward = Math.floor(reward * (profile.prestigeMultiplier || 1));
                    profile.wallet = (profile.wallet || 0) + finalReward;
                    profile.crimeStats.crimesCommitted = (profile.crimeStats.crimesCommitted || 0) + 1;
                    profile.crimeStats.totalCrimeEarnings = (profile.crimeStats.totalCrimeEarnings || 0) + finalReward;
                    profile.crimeStats.heatLevel = Math.min(100, (profile.crimeStats.heatLevel || 0) + crime.heatGain);
                    profile.experience = (profile.experience || 0) + crime.xp;
                    profile.transactions.push({ type: 'income', amount: finalReward, description: txOptions.txSuccess || `Crime: ${crime.name} (Success)`, category: 'crime', timestamp: now });
                    return { crimeResult: { success: true, crime, reward: finalReward, xp: crime.xp, heatGained: crime.heatGain, heatLevel: profile.crimeStats.heatLevel } };
                }

                const fine = Math.floor(crime.minFine + Math.random() * (crime.maxFine - crime.minFine));
                let insuranceCoverage = 0;
                const crimeInsurance = profile.insurancePolicies?.find(p => p.type === 'crime' && p.expiryDate > now && p.claimsUsed < p.maxClaims);
                if (crimeInsurance) {
                    const insType = INSURANCE_TYPES[crimeInsurance.type];
                    insuranceCoverage = Math.floor(fine * insType.coverage);
                    crimeInsurance.claimsUsed += 1;
                }
                const actualFine = Math.min(Number(profile.wallet) || 0, Math.max(0, fine - insuranceCoverage));
                profile.wallet = (profile.wallet || 0) - actualFine;
                profile.jailTime = new Date(now.getTime() + crime.jailTime);
                profile.crimeStats.timesCaught = (profile.crimeStats.timesCaught || 0) + 1;
                profile.crimeStats.totalFinesPaid = (profile.crimeStats.totalFinesPaid || 0) + actualFine;
                profile.crimeStats.heatLevel = Math.min(100, (profile.crimeStats.heatLevel || 0) + Math.floor(crime.heatGain * 1.5));
                profile.transactions.push({ type: 'expense', amount: actualFine, description: txOptions.txFine || `Crime fine: ${crime.name} (Caught!)`, category: 'crime', timestamp: now });
                return { crimeResult: { success: false, crime, fine: actualFine, insuranceCoverage, jailTime: crime.jailTime, caught: true } };
            }
        });
        if (mutation?.duplicate) return { success: false, error: 'This crime attempt was already processed.' };
        return mutation?.success ? mutation.crimeResult : mutation;
    }

    static async prestige(userId, guildId, referenceId) {
        if (!referenceId) return { success: false, error: 'A unique prestige confirmation reference is required.' };
        return this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async profile => {
            if (profile.level < PRESTIGE_CONFIG.minLevel) return { success: false, error: `Need level ${PRESTIGE_CONFIG.minLevel} to prestige (current: ${profile.level})` };
            if ((profile.prestigeLevel || 0) >= PRESTIGE_CONFIG.maxPrestigeLevel) return { success: false, error: 'Max prestige reached!' };
            const newPrestigeLevel = (profile.prestigeLevel || 0) + 1;
            const newMultiplier = 1 + (newPrestigeLevel * PRESTIGE_CONFIG.multiplierPerLevel);
            const preStats = { level: profile.level, wallet: profile.wallet, bank: profile.bank, netWorth: profile.netWorth || 0 };
            profile.wallet = 1000;
            profile.bank = 0;
            profile.experience = 0;
            profile.level = 1;
            profile.businesses = [];
            profile.properties = [];
            profile.cars = [];
            profile.primaryResidence = null;
            profile.activeCar = null;
            profile.prestigeLevel = newPrestigeLevel;
            profile.prestigeMultiplier = newMultiplier;
            profile.totalPrestigeResets = (profile.totalPrestigeResets || 0) + 1;
            profile.transactions.push({ type: 'expense', amount: preStats.wallet + preStats.bank, description: `Prestige ${newPrestigeLevel} - Reset all progress`, category: 'prestige', timestamp: new Date() });
            return { prestigeLevel: newPrestigeLevel, multiplier: newMultiplier, preStats };
        }});
    }

    static async marry(userId, guildId, partnerId) {
        const marriageCost = 5000;
        await Promise.all([this.getProfile(userId, guildId), this.getProfile(partnerId, guildId)]);
        const session = await Economy.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session);
                const partnerProfile = await Economy.findOne({ userId: partnerId, guildId }).session(session);
                if (!profile || !partnerProfile) throw new Error('Marriage profile missing.');
                if (profile.marriedTo) { result = { success: false, error: 'Already married!' }; return; }
                if (partnerProfile.marriedTo) { result = { success: false, error: 'Partner is already married!' }; return; }
                if ((Number(profile.wallet) || 0) < marriageCost) {
                    result = { success: false, error: `Need $${marriageCost} for the wedding` };
                    return;
                }

                const now = new Date();
                const proposer = await Economy.findOneAndUpdate(
                    { userId, guildId, marriedTo: null, wallet: { $gte: marriageCost } },
                    {
                        $inc: { wallet: -marriageCost, netWorth: -marriageCost },
                        $set: { marriedTo: partnerId, marriageDate: now, marriageBonus: 1.10 },
                        $push: { transactions: sliceTransactions({ type: 'expense', amount: marriageCost, description: 'Wedding fee', category: 'marriage', timestamp: now, referenceId: `marriage:${guildId}:${userId}:${partnerId}` }) }
                    },
                    { session, returnDocument: 'after', runValidators: true }
                );
                if (!proposer) { result = { success: false, error: 'Already married or wallet changed.' }; return; }

                const partner = await Economy.findOneAndUpdate(
                    { userId: partnerId, guildId, marriedTo: null },
                    { $set: { marriedTo: userId, marriageDate: now, marriageBonus: 1.10 } },
                    { session, returnDocument: 'after', runValidators: true }
                );
                if (!partner) throw new Error('Partner became unavailable during marriage.');
                result = { success: true, cost: marriageCost };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    static async divorce(userId, guildId) {
        const session = await Economy.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session).select('marriedTo');
                if (!profile?.marriedTo) { result = { success: false, error: 'Not married!' }; return; }
                const partnerId = profile.marriedTo;
                await Economy.updateOne(
                    { userId, guildId, marriedTo: partnerId },
                    { $set: { marriedTo: null, marriageDate: null, marriageBonus: 1.0 } },
                    { session, runValidators: true }
                );
                await Economy.updateOne(
                    { userId: partnerId, guildId, marriedTo: userId },
                    { $set: { marriedTo: null, marriageDate: null, marriageBonus: 1.0 } },
                    { session, runValidators: true }
                );
                result = { success: true };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    static async claimInterest(userId, guildId) {
        await this.getProfile(userId, guildId);
        const session = await Economy.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session);
                if (!profile) throw new Error('Interest profile is missing.');
                const lastClaim = profile.lastInterestClaim || profile.createdAt;
                const nextClaim = new Date(new Date(lastClaim).getTime() + 24 * 60 * 60 * 1000);
                const now = new Date();
                if (now < nextClaim) {
                    result = { success: false, error: 'Interest accrues daily', nextClaim };
                    return;
                }

                const interestRate = Number(profile.bankInterestRate) || 0.01;
                const prestigeBoost = ((Number(profile.prestigeMultiplier) || 1) - 1) * 0.005;
                const effectiveRate = interestRate + prestigeBoost;
                const interest = Math.floor((Number(profile.bank) || 0) * effectiveRate);
                if (interest <= 0) {
                    result = { success: false, error: 'No bank balance to earn interest on' };
                    return;
                }

                const claimFilter = {
                    userId,
                    guildId,
                    lastInterestClaim: profile.lastInterestClaim == null ? null : profile.lastInterestClaim
                };
                const updated = await Economy.findOneAndUpdate(
                    claimFilter,
                    {
                        $inc: { bank: interest, netWorth: interest, lifetimeEarnings: interest },
                        $set: { lastInterestClaim: now },
                        $push: { transactions: sliceTransactions({
                            type: 'income', amount: interest,
                            description: `Bank interest (${(effectiveRate * 100).toFixed(2)}%)`,
                            category: 'interest', timestamp: now, referenceId: `interest:${userId}:${now.getTime()}`
                        }) }
                    },
                    { session, returnDocument: 'after', runValidators: true }
                ).select('bank');

                if (!updated) {
                    const fresh = await Economy.findOne({ userId, guildId }).session(session).select('lastInterestClaim createdAt');
                    const freshClaim = fresh?.lastInterestClaim || fresh?.createdAt || now;
                    result = {
                        success: false,
                        error: 'Interest claim already processed',
                        nextClaim: new Date(new Date(freshClaim).getTime() + 24 * 60 * 60 * 1000)
                    };
                    return;
                }
                result = { success: true, interest, rate: effectiveRate, newBalance: updated.bank };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    static async claimDailyReward(userId, guildId, description) {
        await this.getProfile(userId, guildId);
        const session = await Economy.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const profile = await Economy.findOne({ userId, guildId }).session(session);
                if (!profile) throw new Error('Daily reward profile is missing.');
                const now = new Date();
                const cooldownMs = 24 * 60 * 60 * 1000;
                const lastClaim = profile.cooldowns?.daily ? new Date(profile.cooldowns.daily) : null;
                if (lastClaim && now.getTime() - lastClaim.getTime() < cooldownMs) {
                    result = { success: false, nextClaim: new Date(lastClaim.getTime() + cooldownMs), streak: profile.dailyStreak || 0 };
                    return;
                }

                const dailyStreak = lastClaim && now.getTime() - lastClaim.getTime() < 2 * cooldownMs
                    ? (profile.dailyStreak || 0) + 1
                    : 1;
                const baseReward = 500;
                const streakBonus = Math.min(dailyStreak * 100, 2000);
                const prestigeMultiplier = 1 + ((Number(profile.prestigeLevel) || 0) * 0.1);
                const marriageMultiplier = profile.marriedTo ? 1.1 : 1.0;
                const roleBonus = (profile.purchasedRoles || [])
                    .filter(role => !role.expiryDate || new Date(role.expiryDate) > now)
                    .reduce((sum, role) => sum + ((role.benefits?.familyBonus || 0) * 100), 0);
                const totalReward = Math.floor((baseReward + streakBonus + roleBonus) * prestigeMultiplier * marriageMultiplier);
                const cooldownFilter = {
                    userId,
                    guildId,
                    $or: [
                        { 'cooldowns.daily': { $exists: false } },
                        { 'cooldowns.daily': null },
                        { 'cooldowns.daily': { $lte: new Date(now.getTime() - cooldownMs) } }
                    ],
                    transactions: { $not: { $elemMatch: { referenceId: `daily:${userId}:${guildId}:${now.toISOString().slice(0, 10)}` } } }
                };
                const updated = await Economy.findOneAndUpdate(
                    cooldownFilter,
                    {
                        $inc: { wallet: totalReward, netWorth: totalReward, lifetimeEarnings: totalReward, experience: 5 },
                        $set: { 'cooldowns.daily': now, dailyStreak },
                        $push: { transactions: sliceTransactions({
                            type: 'income', amount: totalReward,
                            description: typeof description === 'function' ? description(dailyStreak) : description,
                            category: 'daily', timestamp: now,
                            referenceId: `daily:${userId}:${guildId}:${now.toISOString().slice(0, 10)}`
                        }) }
                    },
                    { session, returnDocument: 'after', runValidators: true }
                );
                if (!updated) {
                    const fresh = await Economy.findOne({ userId, guildId }).session(session).select('cooldowns.daily dailyStreak');
                    const freshLastClaim = fresh?.cooldowns?.daily || now;
                    result = { success: false, nextClaim: new Date(new Date(freshLastClaim).getTime() + cooldownMs), streak: fresh?.dailyStreak || 0 };
                    return;
                }
                result = { success: true, profile: updated, baseReward, streakBonus, roleBonus, totalReward };
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    static async buyInsurance(userId, guildId, policyType, txDescription = null, referenceId) {
        const insuranceData = INSURANCE_TYPES[policyType];
        if (!insuranceData) return { success: false, error: 'Invalid insurance type' };
        if (!referenceId) return { success: false, error: 'A unique insurance purchase reference is required.' };
        return this.mutateProfileAtomically({ userId, guildId, referenceId, mutate: async profile => {
            if ((profile.wallet || 0) < insuranceData.premium) return { success: false, error: 'Not enough money' };
            if (profile.insurancePolicies?.some(p => p.type === policyType && p.expiryDate > new Date())) return { success: false, error: 'Already have this insurance' };
            profile.wallet -= insuranceData.premium;
            profile.insurancePolicies.push({ policyId: `ins_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: policyType, coverage: insuranceData.coverage, premium: insuranceData.premium, startDate: new Date(), expiryDate: new Date(Date.now() + insuranceData.duration), claimsUsed: 0, maxClaims: insuranceData.maxClaims });
            profile.transactions.push({ type: 'expense', amount: insuranceData.premium, description: txDescription || `Insurance: ${insuranceData.name}`, category: 'insurance', timestamp: new Date() });
            return { policy: insuranceData };
        }});
    }

    static async checkAchievements(profile) {
        if (!profile?.userId || !profile?.guildId) return [];
        const expectedCount = profile.achievements?.length || 0;
        const settlement = await this.mutateProfileAtomically({ userId: profile.userId, guildId: profile.guildId, referenceId: `achievement-check:${profile.userId}:${profile.guildId}:${expectedCount}`, mutate: async current => {
            const newAchievements = [];
            for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
                if (current.achievements?.some(a => a.achievementId === id)) continue;
                const { type, value } = achievement.condition;
                let currentValue = 0;
                if (type.includes('.')) {
                    currentValue = type.split('.').reduce((obj, part) => obj?.[part], current) || 0;
                } else if (type === 'marriedTo') {
                    currentValue = current.marriedTo ? 'exists' : null;
                } else if (type === 'businesses') {
                    currentValue = current.businesses?.length || 0;
                } else {
                    currentValue = current[type] || 0;
                }
                const meetsCondition = value === 'exists' ? currentValue === 'exists' : currentValue >= value;
                if (!meetsCondition) continue;
                current.achievements.push({ achievementId: id, name: achievement.name, description: achievement.description, category: achievement.category, unlockedAt: new Date(), reward: achievement.reward });
                current.achievementPoints = (current.achievementPoints || 0) + 1;
                if (achievement.reward > 0) current.wallet += achievement.reward;
                newAchievements.push(achievement);
            }
            if (!newAchievements.length) return { success: false, noLedger: true, newAchievements: [] };
            const totalReward = newAchievements.reduce((sum, item) => sum + (item.reward || 0), 0);
            current.transactions.push({ type: totalReward ? 'income' : 'shop', amount: totalReward, description: `Unlocked ${newAchievements.length} achievement(s)`, category: 'achievements', timestamp: new Date() });
            return { newAchievements };
        }});
        return settlement.success ? settlement.newAchievements : [];
    }

    static calculateNetWorth(profile) {
        if (!profile || typeof profile !== 'object') return 0;
        let netWorth = (profile.wallet || 0) + (profile.bank || 0) + (profile.familyVault || 0);

        
        if (Array.isArray(profile.properties)) {
            profile.properties.forEach(p => { netWorth += p.currentValue ?? p.purchasePrice ?? 0; });
        }
        
        if (Array.isArray(profile.cars)) {
            profile.cars.forEach(c => { netWorth += c.currentValue ?? c.purchasePrice ?? 0; });
        }
        
        if (Array.isArray(profile.businesses)) {
            profile.businesses.forEach(b => {
                netWorth += b.currentValue ?? b.purchasePrice ?? 0;
            });
        }
        
        if (Array.isArray(profile.stockPortfolio)) {
            profile.stockPortfolio.forEach(s => {
                const price = this.getStockPrice(s.symbol);
                if (price) netWorth += price * s.shares;
            });
        }

        return netWorth;
    }

    static async getTopHeistProfiles(guildId, limit = 5) {
        const safeLimit = Math.max(1, Math.min(25, Math.floor(Number(limit) || 5)));
        return Economy.find({
            guildId,
            $or: [
                { completedHeists: { $gt: 0 } },
                { failedHeists: { $gt: 0 } }
            ]
        })
            .select('userId completedHeists failedHeists heistSkill')
            .sort({ completedHeists: -1, heistSkill: -1 })
            .limit(safeLimit)
            .lean();
    }
}

module.exports = { Economy, Heist, EconomyManager };
