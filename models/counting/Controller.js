const CountingConfig = require('./Schema');

class CountingController {
    

    static async getCountingConfig(serverId) {
        try {
            return await CountingConfig.findByServerId(serverId);
        } catch (error) {
            console.error('[CountingController] Error fetching counting config:', error);
            return null;
        }
    }

    static async createOrUpdateConfig(serverId, configData) {
        try {
            return await CountingConfig.findOneAndUpdate(
                { serverId },
                { serverId, ...configData },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (error) {
            console.error('[CountingController] Error creating/updating counting config:', error);
            return null;
        }
    }

    static async deleteConfig(serverId) {
        try {
            const result = await CountingConfig.deleteOne({ serverId });
            return result.deletedCount > 0;
        } catch (error) {
            console.error('[CountingController] Error deleting counting config:', error);
            return false;
        }
    }

    static async getLeaderboard(serverId, limit = 10) {
        try {
            return await CountingConfig.getLeaderboard(serverId, limit);
        } catch (error) {
            console.error('[CountingController] Error fetching leaderboard:', error);
            return [];
        }
    }

    static async getUserStats(serverId, userId) {
        try {
            const config = await CountingConfig.findByServerId(serverId);
            if (!config) return null;

            const userEntry = config.leaderboard.find(entry => entry.userId === userId);
            if (!userEntry) return null;

            const userRank = config.leaderboard.findIndex(entry => entry.userId === userId) + 1;

            return {
                count: userEntry.count,
                rank: userRank,
                lastContribution: userEntry.lastContribution,
                totalUsers: config.leaderboard.length
            };
        } catch (error) {
            console.error('[CountingController] Error fetching user stats:', error);
            return null;
        }
    }

    static async getMilestones(serverId) {
        try {
            const config = await CountingConfig.findByServerId(serverId);
            return config ? config.milestones : [];
        } catch (error) {
            console.error('[CountingController] Error fetching milestones:', error);
            return [];
        }
    }

    static async processCount(serverId, channelId, userId, count, messageId = `controller-count:${Date.now()}:${Math.random().toString(36).slice(2)}`) {
        try {
            const result = await CountingConfig.applyCountMessage({ serverId, channelId, userId, count, messageId });
            if (result.error === 'disabled') return { ...result, error: 'Counting not enabled for this channel' };
            if (result.error === 'wrong_number') return { ...result, received: count };
            if (result.error === 'same_user_not_allowed') return { ...result, error: 'same_user_not_allowed' };
            return result;

        } catch (error) {
            console.error('[CountingController] Error processing count:', error);
            return { success: false, error: 'database_error' };
        }
    }

    static async resetCounting(serverId, userId) {
        try {
            const config = await CountingConfig.findByServerId(serverId);
            if (!config) return false;

            await config.resetCounting(userId);
            return true;
        } catch (error) {
            console.error('[CountingController] Error resetting count:', error);
            return false;
        }
    }

    static async updateCount(serverId, newCount) {
        try {
            if (!Number.isSafeInteger(newCount) || newCount < 0) return false;
            const config = await CountingConfig.findOneAndUpdate({ serverId }, {
                $set: { currentCount: newCount, lastUserId: null, updatedAt: new Date() },
                $inc: { revision: 1 }
            }, { returnDocument: 'after', runValidators: true });
            return Boolean(config);
        } catch (error) {
            console.error('[CountingController] Error updating count:', error);
            return false;
        }
    }

    static async getServerStats(serverId) {
        try {
            const config = await CountingConfig.findByServerId(serverId);
            if (!config) return null;

            return {
                currentCount: config.currentCount,
                highestCount: config.highestCount,
                totalMessages: config.totalMessages,
                resetCount: config.resetCount,
                totalUsers: config.leaderboard.length,
                milestonesAchieved: config.milestones.length,
                lastUpdated: config.updatedAt,
                channelId: config.channelId,
                status: config.status
            };
        } catch (error) {
            console.error('[CountingController] Error fetching server stats:', error);
            return null;
        }
    }

    static shouldCelebrateMilestone(count, existingMilestones = []) {
        const MILESTONE_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
        
        return MILESTONE_THRESHOLDS.includes(count) && 
               !existingMilestones.some(m => m.count === count);
    }

    static getNextMilestone(currentCount) {
        const MILESTONE_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
        
        return MILESTONE_THRESHOLDS.find(milestone => milestone > currentCount) || null;
    }

    static async getActiveServers() {
        try {
            return await CountingConfig.find({ status: true }).select('serverId channelId currentCount');
        } catch (error) {
            console.error('[CountingController] Error fetching active servers:', error);
            return [];
        }
    }

    static async backupServerData(serverId) {
        try {
            const config = await CountingConfig.findByServerId(serverId);
            if (!config) return null;

            return {
                serverId: config.serverId,
                currentCount: config.currentCount,
                highestCount: config.highestCount,
                totalMessages: config.totalMessages,
                resetCount: config.resetCount,
                leaderboard: config.leaderboard,
                milestones: config.milestones,
                settings: {
                    allowSameUser: config.allowSameUser,
                    deleteWrongMessages: config.deleteWrongMessages,
                    showErrorMessages: config.showErrorMessages,
                    errorMessageDuration: config.errorMessageDuration
                },
                createdAt: config.createdAt,
                updatedAt: config.updatedAt
            };
        } catch (error) {
            console.error('[CountingController] Error backing up server data:', error);
            return null;
        }
    }
}

module.exports = CountingController;
