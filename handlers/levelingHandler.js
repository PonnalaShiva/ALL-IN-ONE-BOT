


'use strict';

const levelingController = require('../models/leveling/levelingController');
const GuildLevel = require('../models/leveling/guildLevelSchema');
const UserLevel = require('../models/leveling/userLevelSchema');
const VoiceSession = require('../models/leveling/voiceSessionSchema');
const { getLevelingConfig } = require('../utils/cacheHelpers');
const { getEmoji } = require('../UI/emojis/emoji');
const { ACCENT } = require('../UI');
const loadLanguage = require('../events/loadLanguage');
const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    MessageFlags
} = require('discord.js');

let handlerInstance = null;

class LevelingHandler {
    constructor(client) {
        if (handlerInstance) {
            return handlerInstance;
        }

        this.client = client;
        this.voiceStateListener = this.handleVoiceStateUpdate.bind(this);
        this.memberAddListener = this.handleMemberJoin.bind(this);
        this.memberRemoveListener = this.handleMemberLeave.bind(this);
        this.errorListener = this.handleError.bind(this);
        this.setupEventListeners();
        this.setupCleanupTasks();
        this.setupStatResets();
        handlerInstance = this;
    }

    setupEventListeners() {
        
        const messageMiddleware = require('../utils/messageMiddleware');
        this.unregisterMessageMiddleware = messageMiddleware.use(async (message, next) => {
            await this.handleMessage(message);
            await next();
            return false;
        }, 50);
        
        this.client.on('voiceStateUpdate', this.voiceStateListener);
        this.client.on('guildMemberAdd', this.memberAddListener);
        this.client.on('guildMemberRemove', this.memberRemoveListener);
        this.client.on('error', this.errorListener);
    }

    
    async handleMessage(message) {
        if (!message.guild || message.author.bot) return;

        try {
            const result = await levelingController.gainTextXP(
                message.author.id,
                message.guild.id,
                message,
                this.client
            );

            if (result?.leveledUp) {
                console.log(`[Leveling] ${message.author.tag} leveled up to Level ${result.newLevel} in ${message.guild.name}`);
            }

        } catch (error) {
            console.error('[LevelingHandler] Message handling error:', error);
        }
    }

    
    async handleVoiceStateUpdate(oldState, newState) {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        try {
            const guildConfig = await getLevelingConfig(member.guild.id);
            if (!guildConfig?.enabled || !guildConfig?.voiceSettings?.enabled) return;

            
            if (!oldState.channel && newState.channel) {
                await levelingController.handleVoiceJoin(member, newState.channel, guildConfig);
            }
            
            else if (oldState.channel && !newState.channel) {
                await levelingController.handleVoiceLeave(member, guildConfig);
            }
            
            else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
                await levelingController.handleVoiceLeave(member, guildConfig);
                await levelingController.handleVoiceJoin(member, newState.channel, guildConfig);
            }

        } catch (error) {
            console.error('[LevelingHandler] Voice state update error:', error);
        }
    }

    
    async handleMemberJoin(member) {
        if (member.user.bot) return;

        try {
            await levelingController.initializeUser(member.id, member.guild.id);

            const guildConfig = await getLevelingConfig(member.guild.id);
            if (guildConfig?.enabled && guildConfig.settings?.logChannel) {
                const logChannel = member.guild.channels.cache.get(guildConfig.settings.logChannel);
                if (logChannel) {
                    const lang = loadLanguage(member.guild.id).leveling;
                    const welcomeContainer = new ContainerBuilder()
                        .setAccentColor(ACCENT.success);

                    welcomeContainer.addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent([
                                    `# ${getEmoji('sparkles')} ${lang.welcomeTitle}`,
                                    '',
                                    lang.welcomeDesc.replace('{user}', `<@${member.id}>`),
                                    '',
                                    `• **${getEmoji('chat')} ${lang.textXpRate.replace('{min}', guildConfig.settings.xpRange?.min || 15).replace('{max}', guildConfig.settings.xpRange?.max || 25)}`,
                                    `• **${getEmoji('volume_high')} ${lang.voiceXpRate.replace('{rate}', guildConfig.voiceSettings?.xpPerMinute || 5)}`,
                                    `• **${getEmoji('time')} ${lang.xpCooldown.replace('{seconds}', (guildConfig.settings?.xpCooldown || 60000) / 1000)}`
                                ].join('\n'))
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(member.user.displayAvatarURL())
                            )
                    );

                    await logChannel.send({
                        components: [welcomeContainer],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }
            }

        } catch (error) {
            console.error('[LevelingHandler] Member join handling error:', error);
        }
    }

    async handleMemberLeave(member) {
        if (member.user.bot) return;

        try {
            const sessionId = `${member.id}_${member.guild.id}`;
            if (levelingController.voiceSessions.has(sessionId)) {
                const guildConfig = await getLevelingConfig(member.guild.id);
                await levelingController.handleVoiceLeave(member, guildConfig);
            }
        } catch (error) {
            console.error('[LevelingHandler] Member leave handling error:', error);
        }
    }

    
    setupCleanupTasks() {
        
        let isVoiceCleaning = false;
        this.voiceCleanupInterval = setInterval(async () => {
            if (isVoiceCleaning) return;
            isVoiceCleaning = true;
            try {
                const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
                const result = await VoiceSession.deleteMany({
                    createdAt: { $lt: threeDaysAgo },
                    duration: { $lt: 300000 }
                });

                if (result.deletedCount > 0) {
                    console.log(`[Leveling] Cleaned up ${result.deletedCount} old voice sessions`);
                }

            } catch (error) {
                console.error('[LevelingHandler] Voice session cleanup error:', error);
            } finally {
                isVoiceCleaning = false;
            }
        }, 3600000);
        if (this.voiceCleanupInterval.unref) this.voiceCleanupInterval.unref();

        
        this.cooldownCleanupInterval = setInterval(() => {
            levelingController.cleanupExpiredCooldowns();
        }, 900000);
        if (this.cooldownCleanupInterval.unref) this.cooldownCleanupInterval.unref();
        
        
        this.orphanedVoiceInterval = setInterval(() => {
            levelingController.cleanupOrphanedVoiceSessions();
        }, 1800000);
        if (this.orphanedVoiceInterval.unref) this.orphanedVoiceInterval.unref();

        
        let isDbOptimizing = false;
        this.dbOptimizationInterval = setInterval(async () => {
            if (isDbOptimizing) return;
            isDbOptimizing = true;
            try {
                const users = await UserLevel.find({
                    'voiceStats.sessionsCount': { $gt: 0 },
                    'voiceStats.averageSessionLength': { $eq: 0 }
                });

                let updated = 0;
                for (const user of users) {
                    if (user.voiceStats.sessionsCount > 0) {
                        user.voiceStats.averageSessionLength = Math.floor(
                            user.voiceStats.totalMinutes / user.voiceStats.sessionsCount
                        );
                        await user.save();
                        updated++;
                    }
                }

                if (updated > 0) {
                    console.log(`[Leveling] Updated average session lengths for ${updated} users`);
                }

            } catch (error) {
                console.error('[LevelingHandler] Database optimization error:', error);
            } finally {
                isDbOptimizing = false;
            }
        }, 21600000);
        if (this.dbOptimizationInterval.unref) this.dbOptimizationInterval.unref();
    }

    
    setupStatResets() {
        
        let isWeeklyResetting = false;
        this.weeklyResetInterval = setInterval(async () => {
            if (isWeeklyResetting) return;
            const now = new Date();
            
            if (now.getUTCDay() === 1 && now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
                isWeeklyResetting = true;
                try {
                    const result = await UserLevel.updateMany(
                        {},
                        { 
                            $set: { 
                                weeklyXp: 0,
                                'voiceStats.weeklyVoiceMinutes': 0
                            } 
                        }
                    );

                    console.log(`[Leveling] Weekly stats reset completed for ${result.modifiedCount} users`);

                    const guilds = await GuildLevel.find({ enabled: true, 'settings.logChannel': { $ne: null } });
                    
                    for (const guildConfig of guilds) {
                        try {
                            const guild = this.client.guilds.cache.get(guildConfig.guildId);
                            if (!guild) continue;
                            
                            const logChannel = guild.channels.cache.get(guildConfig.settings.logChannel);
                            if (!logChannel) continue;

                            const lang = loadLanguage(guildConfig.guildId).leveling;
                            const resetContainer = new ContainerBuilder()
                                .setAccentColor(ACCENT.warning);

                            resetContainer.addSectionComponents(
                                new SectionBuilder().addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent([
                                        `# ${getEmoji('crown')} ${lang.weeklyResetTitle}`,
                                        '',
                                        lang.weeklyResetDesc,
                                        '',
                                        `*${lang.resetExecutedAt.replace('{time}', Math.floor(Date.now() / 1000))}*`
                                    ].join('\n'))
                                )
                            );

                            await logChannel.send({
                                components: [resetContainer],
                                flags: MessageFlags.IsComponentsV2
                            }).catch(() => {});

                        } catch (error) {
                            
                        }
                    }

                } catch (error) {
                    console.error('[LevelingHandler] Weekly stats reset error:', error);
                } finally {
                    isWeeklyResetting = false;
                }
            }
        }, 60000);
        if (this.weeklyResetInterval.unref) this.weeklyResetInterval.unref();

        
        let isDailyResetting = false;
        this.dailyResetInterval = setInterval(async () => {
            if (isDailyResetting) return;
            const now = new Date();
            
            if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
                isDailyResetting = true;
                try {
                    const result = await UserLevel.updateMany(
                        {},
                        { $set: { dailyXp: 0 } }
                    );

                    console.log(`[Leveling] Daily XP reset completed for ${result.modifiedCount} users`);

                } catch (error) {
                    console.error('[LevelingHandler] Daily stats reset error:', error);
                } finally {
                    isDailyResetting = false;
                }
            }
        }, 60000);
        if (this.dailyResetInterval.unref) this.dailyResetInterval.unref();

        
        let isMonthlyResetting = false;
        this.monthlyResetInterval = setInterval(async () => {
            if (isMonthlyResetting) return;
            const now = new Date();
            
            if (now.getUTCDate() === 1 && now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
                isMonthlyResetting = true;
                try {
                    const result = await UserLevel.updateMany(
                        {},
                        { $set: { 'voiceStats.monthlyVoiceMinutes': 0 } }
                    );

                    console.log(`[Leveling] Monthly voice stats reset completed for ${result.modifiedCount} users`);

                } catch (error) {
                    console.error('[LevelingHandler] Monthly stats reset error:', error);
                } finally {
                    isMonthlyResetting = false;
                }
            }
        }, 60000);
        if (this.monthlyResetInterval.unref) this.monthlyResetInterval.unref();
    }

    
    handleError(error) {
        console.error('[LevelingHandler] Discord client error:', error);
    }

    
    async getSystemStats() {
        try {
            return {
                activeSessions: levelingController.voiceSessions.size,
                activeIntervals: levelingController.voiceXpIntervals.size,
                activeCooldowns: levelingController.cooldowns.size,
                totalUsers: await UserLevel.countDocuments({}),
                totalGuilds: await GuildLevel.countDocuments({ enabled: true })
            };
        } catch (error) {
            console.error('[LevelingHandler] Error getting system stats:', error);
            return null;
        }
    }

    async emergencyCleanup() {
        try {
            console.log('[Leveling] Starting emergency cleanup...');

            for (const [sessionId, interval] of levelingController.voiceXpIntervals.entries()) {
                clearInterval(interval);
            }
            levelingController.voiceXpIntervals.clear();
            levelingController.voiceSessions.clear();
            levelingController.cooldowns.clear();

            console.log('[Leveling] Emergency cleanup completed');

        } catch (error) {
            console.error('[LevelingHandler] Emergency cleanup error:', error);
        }
    }

    
    async shutdown() {
        console.log('[Leveling] Shutting down leveling handler...');
        for (const timerName of [
            'voiceCleanupInterval', 'cooldownCleanupInterval', 'orphanedVoiceInterval',
            'dbOptimizationInterval', 'weeklyResetInterval', 'dailyResetInterval', 'monthlyResetInterval'
        ]) {
            if (this[timerName]) clearInterval(this[timerName]);
            this[timerName] = null;
        }
        this.unregisterMessageMiddleware?.();
        this.unregisterMessageMiddleware = null;
        this.client.off('voiceStateUpdate', this.voiceStateListener);
        this.client.off('guildMemberAdd', this.memberAddListener);
        this.client.off('guildMemberRemove', this.memberRemoveListener);
        this.client.off('error', this.errorListener);
        
        try {
            for (const [sessionId, session] of levelingController.voiceSessions.entries()) {
                const [userId, guildId] = sessionId.split('_');
                const guild = this.client.guilds.cache.get(guildId);
                if (guild) {
                    const member = guild.members.cache.get(userId);
                    if (member) {
                        const guildConfig = await getLevelingConfig(guildId);
                        if (guildConfig) {
                            await levelingController.handleVoiceLeave(member, guildConfig);
                        }
                    }
                }
            }

            await levelingController.flushSaveQueue();
            await this.emergencyCleanup();
            if (handlerInstance === this) handlerInstance = null;
            console.log('[Leveling] Leveling handler shutdown completed');

        } catch (error) {
            console.error('[LevelingHandler] Shutdown error:', error);
        }
    }
}

module.exports = LevelingHandler;
