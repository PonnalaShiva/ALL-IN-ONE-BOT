const { Economy } = require('../models/economy/economy');
const { CROPS } = require('../models/economy/constants/farmingData');
const { STOCKS } = require('../models/economy/constants/stockData');

class EconomyUtils {
    static async decayPetStats() {
        const BATCH_SIZE = 200;
        const now = new Date();
        const periodStart = new Date(Math.floor(now.getTime() / (6 * 60 * 60 * 1000)) * 6 * 60 * 60 * 1000);
        let lastId = null;
        let totalUpdated = 0;
        const { EconomyManager } = require('../models/economy/economy');

        console.log('🐕 Starting pet stat decay with optimized batch processing...');

        while (true) {
            const query = { 'pets.0': { $exists: true } };
            if (lastId) query._id = { $gt: lastId };
            const profiles = await Economy.find(query)
            .sort({ _id: 1 })
            .limit(BATCH_SIZE)
            .lean();

            if (!profiles.length) break;
            lastId = profiles[profiles.length - 1]._id;

            for (const profile of profiles) {
                try {
                    const result = await EconomyManager.mutateProfileAtomically({
                        userId: profile.userId,
                        guildId: profile.guildId,
                        referenceId: `pet-decay:${periodStart.toISOString()}`,
                        mutate: async current => {
                            if (current.lastPetDecayAt && new Date(current.lastPetDecayAt) >= periodStart) return { success: false, error: 'already_decayed' };
                            current.lastPetDecayAt = now;
                            let changed = false;
                            for (const pet of current.pets || []) {
                                const hoursSinceLastFed = pet.lastFed ? (now - new Date(pet.lastFed)) / 3600000 : 24;
                                const hoursSinceLastGroomed = pet.lastGroomed ? (now - new Date(pet.lastGroomed)) / 3600000 : 24;
                                const hoursSinceLastPlayed = pet.lastPlayed ? (now - new Date(pet.lastPlayed)) / 3600000 : 24;
                                if (hoursSinceLastFed > 12) {
                                    pet.hunger = Math.max(0, (pet.hunger ?? 100) - 5);
                                    pet.health = Math.max(0, (pet.health ?? 100) - 2);
                                    changed = true;
                                }
                                if (hoursSinceLastGroomed > 24) {
                                    pet.cleanliness = Math.max(0, (pet.cleanliness ?? 100) - 3);
                                    changed = true;
                                }
                                if (hoursSinceLastPlayed > 18) {
                                    pet.happiness = Math.max(0, (pet.happiness ?? 100) - 4);
                                    changed = true;
                                }
                            }
                            return { noLedger: true, changed };
                        }
                    });
                    if (result?.success && result.changed) totalUpdated++;
                } catch (error) {
                    console.error(`[EconomyUtils] Pet decay failed for ${profile.userId}/${profile.guildId}:`, error);
                }
            }
            if (profiles.length < BATCH_SIZE) break;
        }

        console.log(`🐕 Pet stat decay complete! Updated ${totalUpdated} profiles.`);
    }
    
    static async handleMonthlyBills() {
        const BATCH_SIZE = 200;
        const now = new Date();
        const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        let lastId = null;
        let totalProcessed = 0;
        let totalBilled = 0;
        const { EconomyManager } = require('../models/economy/economy');

        console.log('💰 Starting monthly bills processing with optimized batch processing...');

        while (true) {
            const query = { 'properties.0': { $exists: true }, primaryResidence: { $ne: null } };
            if (lastId) query._id = { $gt: lastId };
            const profiles = await Economy.find(query)
            .sort({ _id: 1 })
            .limit(BATCH_SIZE)
            .lean();

            if (!profiles.length) break;
            lastId = profiles[profiles.length - 1]._id;

            for (const profile of profiles) {
                try {
                    const result = await EconomyManager.mutateProfileAtomically({
                        userId: profile.userId,
                        guildId: profile.guildId,
                        referenceId: `monthly-bill:${period}`,
                        mutate: async current => {
                            if (current.lastMonthlyBillPeriod === period) return { success: false, error: 'already_billed' };
                            current.lastMonthlyBillPeriod = period;
                            const primaryProperty = (current.properties || []).find(property => String(property.propertyId) === String(current.primaryResidence));
                            if (!primaryProperty) return { noLedger: true, billed: 0 };
                            const rent = Math.max(0, Number(primaryProperty.monthlyRent) || 0);
                            const utilities = Math.max(0, Number(primaryProperty.utilities) || 0);
                            const totalBills = rent + utilities;
                            const walletBefore = Math.max(0, Number(current.wallet) || 0);
                            const vaultBefore = Math.max(0, Number(current.familyVault) || 0);
                            const available = walletBefore + vaultBefore;
                            const billPaid = Math.min(totalBills, available);
                            const fromWallet = Math.min(walletBefore, billPaid);
                            const fromVault = billPaid - fromWallet;
                            current.wallet = walletBefore - fromWallet;
                            current.familyVault = Math.max(0, vaultBefore - fromVault);
                            if (billPaid > 0) current.transactions.push({ type: 'expense', amount: billPaid, description: `Monthly bills for ${primaryProperty.name}`, category: 'property', timestamp: now });
                            return { ...(billPaid > 0 ? {} : { noLedger: true }), billed: billPaid };
                        }
                    });
                    if (result?.success && result.billed > 0) {
                        totalProcessed++;
                        totalBilled += result.billed;
                    }
                } catch (error) {
                    console.error(`[EconomyUtils] Monthly bill failed for ${profile.userId}/${profile.guildId}:`, error);
                }
            }
            if (profiles.length < BATCH_SIZE) break;
        }

        console.log(`💰 Monthly bills complete! Processed ${totalProcessed} profiles, total billed: $${totalBilled.toLocaleString()}`);
    }

    static async processCropGrowth() {
        const { EconomyManager } = require('../models/economy/economy');
        const BATCH_SIZE = 200;
        const now = new Date();
        let lastId = null;
        let totalUpdated = 0;

        while (true) {
            const query = { 'farmPlots.crop': { $ne: null } };
            if (lastId) query._id = { $gt: lastId };
            const profiles = await Economy.find(query)
            .sort({ _id: 1 })
            .limit(BATCH_SIZE);

            if (!profiles.length) break;
            lastId = profiles[profiles.length - 1]._id;

            for (const profile of profiles) {
                const result = await EconomyManager.mutateProfileAtomically({
                    userId: profile.userId,
                    guildId: profile.guildId,
                    referenceId: `crop-maturity:${Math.floor(now.getTime() / 3600000)}`,
                    mutate: async current => {
                        let changed = false;
                        for (const plot of current.farmPlots || []) {
                            if (plot.crop && plot.status === 'growing' && plot.harvestAt && now >= new Date(plot.harvestAt)) {
                                plot.status = 'ready';
                                changed = true;
                            }
                        }
                        return changed ? { noLedger: true, changed: true } : { success: false, error: 'unchanged' };
                    }
                });
                if (result?.success && result.changed) totalUpdated++;
            }

            if (profiles.length < BATCH_SIZE) break;
        }

        return totalUpdated;
    }

    static async processStockDividends() {
        const { EconomyManager } = require('../models/economy/economy');
        const BATCH_SIZE = 200;
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setUTCHours(0, 0, 0, 0);
        const daySinceMonday = (weekStart.getUTCDay() + 6) % 7;
        weekStart.setUTCDate(weekStart.getUTCDate() - daySinceMonday);
        const referenceId = `stock-dividends:${weekStart.toISOString().slice(0, 10)}`;
        let lastId = null;
        let totalDividends = 0;

        while (true) {
            const query = { 'stockPortfolio.0': { $exists: true } };
            if (lastId) query._id = { $gt: lastId };
            const profiles = await Economy.find(query)
            .sort({ _id: 1 })
            .limit(BATCH_SIZE);

            if (!profiles.length) break;
            lastId = profiles[profiles.length - 1]._id;

            for (const profile of profiles) {
                const prices = new Map();
                for (const holding of profile.stockPortfolio || []) {
                    const stockData = STOCKS[holding.symbol];
                    if (stockData?.dividendRate > 0 && !prices.has(holding.symbol)) {
                        prices.set(holding.symbol, await EconomyManager.getStockPrice(holding.symbol));
                    }
                }
                const result = await EconomyManager.mutateProfileAtomically({
                    userId: profile.userId,
                    guildId: profile.guildId,
                    referenceId,
                    mutate: async current => {
                        const totalDiv = (current.stockPortfolio || []).reduce((sum, holding) => {
                            const stockData = STOCKS[holding.symbol];
                            const price = prices.get(holding.symbol) || 0;
                            return stockData?.dividendRate > 0 ? sum + Math.floor(price * stockData.dividendRate * (Number(holding.shares) || 0)) : sum;
                        }, 0);
                        if (totalDiv <= 0) return { success: false, error: 'no_dividend' };
                        current.wallet = (current.wallet || 0) + totalDiv;
                        current.transactions.push({ type: 'income', amount: totalDiv, description: `Weekly stock dividends (${referenceId.slice(-10)})`, category: 'stocks', timestamp: now });
                        return { totalDiv };
                    }
                });
                if (result?.success) totalDividends += result.totalDiv;
            }

            if (profiles.length < BATCH_SIZE) break;
        }

        return totalDividends;
    }

    static async getGlobalStats(guildId) {
        const stats = await Economy.aggregate([
            { $match: { guildId } },
            {
                $group: {
                    _id: null,
                    totalWallets: { $sum: '$wallet' },
                    totalBanks: { $sum: '$bank' },
                    totalVaults: { $sum: '$vault.stored' },
                    totalUsers: { $sum: 1 },
                    avgLevel: { $avg: '$level' },
                    maxLevel: { $max: '$level' },
                    totalPrestige: { $sum: '$prestigeLevel' },
                    totalAchievements: { $sum: { $size: { $ifNull: ['$achievements', []] } } }
                }
            }
        ]);

        return stats[0] || {
            totalWallets: 0, totalBanks: 0, totalVaults: 0,
            totalUsers: 0, avgLevel: 0, maxLevel: 0,
            totalPrestige: 0, totalAchievements: 0
        };
    }

    static async cleanupStaleData() {
        const now = new Date();
        let cleaned = 0;

        
        const effectResult = await Economy.updateMany(
            { 'activeEffects.expiresAt': { $lte: now } },
            { $pull: { activeEffects: { expiresAt: { $lte: now } } } }
        );
        cleaned += effectResult.modifiedCount;

        
        const insResult = await Economy.updateMany(
            { 'insurancePolicies.expiryDate': { $lte: now } },
            { $pull: { insurancePolicies: { expiryDate: { $lte: now } } } }
        );
        cleaned += insResult.modifiedCount;

        return cleaned;
    }
}

module.exports = EconomyUtils;
