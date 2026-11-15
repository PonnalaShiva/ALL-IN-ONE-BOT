
const UserLevel = require('./userLevelSchema');
const GuildLevel = require('./guildLevelSchema');
const VoiceSession = require('./voiceSessionSchema');
const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const { ACCENT } = require('../../UI');
const loadLanguage = require('../../events/loadLanguage');
const { getLevelingConfig } = require('../../utils/cacheHelpers');

class LevelingController {
    constructor() {
        this.cooldowns = new Map();
        this.voiceSessions = new Map();
        this.voiceXpIntervals = new Map();
        this.achievements = this.initializeAchievements();
        this.saveQueue = new Map(); 
        this.MAX_COOLDOWN_SIZE = 10000; 
        this.MAX_VOICE_SESSIONS = 5000; 
    }

    initializeAchievements() {
        return [
            { id: 'first_level', name: 'Getting Started', description: 'Reach level 5', requirement: 5, type: 'levels' },
            { id: 'chatter', name: 'Chatterbox', description: 'Send 100 messages', requirement: 100, type: 'messages' },
            { id: 'dedicated', name: 'Dedicated Member', description: 'Reach level 10', requirement: 10, type: 'levels' },
            { id: 'active_voice', name: 'Voice Champion', description: 'Spend 60 minutes in voice', requirement: 60, type: 'voice_minutes' },
            { id: 'streak_master', name: 'Streak Master', description: 'Maintain a 7-day streak', requirement: 7, type: 'streak' },
            { id: 'veteran', name: 'Server Veteran', description: 'Reach level 25', requirement: 25, type: 'levels' },
            { id: 'social_butterfly', name: 'Social Butterfly', description: 'Send 1000 messages', requirement: 1000, type: 'messages' },
            { id: 'voice_lover', name: 'Voice Enthusiast', description: 'Spend 300 minutes in voice', requirement: 300, type: 'voice_minutes' }
        ];
    }

    
    async initializeUser(userId, guildId) {
        try {
            const existing = await UserLevel.findOne({ userId, guildId });
            if (existing) return existing;

            const newUser = new UserLevel({
                userId,
                guildId,
                xp: 0,
                level: 1,
                totalXp: 0,
                weeklyXp: 0,
                dailyXp: 0,
                messageCount: 0,
                lastXpGain: new Date(),
                prestige: 0,
                rankCard: {
                    background: null,
                    color: '#1e3a8a',
                    theme: 'default',
                    badge: null
                },
                voiceStats: {
                    totalMinutes: 0,
                    sessionsCount: 0,
                    voiceXp: 0,
                    longestSession: 0,
                    averageSessionLength: 0,
                    weeklyVoiceMinutes: 0,
                    monthlyVoiceMinutes: 0
                },
                achievements: [],
                streaks: {
                    daily: 0,
                    weekly: 0,
                    lastActive: new Date()
                }
            });

            return await newUser.save();
        } catch (error) {
            console.error('[LevelingController] Error initializing user:', error);
            throw error;
        }
    }

    
    async gainTextXP(userId, guildId, message, client) {
        try {
            
            const guildConfig = await getLevelingConfig(guildId);
            if (!guildConfig?.enabled) return null;

            
            if (this.isRestricted(message, guildConfig)) return null;

            
            const cooldownKey = `${userId}_${guildId}`;
            if (this.cooldowns.has(cooldownKey)) {
                const remaining = this.cooldowns.get(cooldownKey) - Date.now();
                if (remaining > 0) return null;
                
                this.cooldowns.delete(cooldownKey);
            }
            
            
            if (this.cooldowns.size > this.MAX_COOLDOWN_SIZE) {
                const entries = Array.from(this.cooldowns.entries())
                    .sort((a, b) => a[1] - b[1]); 
                const toRemove = entries.slice(0, this.cooldowns.size - this.MAX_COOLDOWN_SIZE);
                for (const [key] of toRemove) {
                    this.cooldowns.delete(key);
                }
            }

            const user = await this.initializeUser(userId, guildId);
            
            
            const baseXP = this.calculateBaseTextXP(message, guildConfig);
            const multiplier = await this.calculateTextMultiplier(message, guildConfig, user);
            const finalXP = Math.floor(baseXP * multiplier);

            
            this.cooldowns.set(cooldownKey, Date.now() + guildConfig.settings.xpCooldown);
            setTimeout(() => this.cooldowns.delete(cooldownKey), guildConfig.settings.xpCooldown);

            
            const oldLevel = user.level;
            user.xp += finalXP;
            user.totalXp += finalXP;
            user.dailyXp += finalXP;
            user.weeklyXp += finalXP;
            user.messageCount += 1;
            user.lastXpGain = new Date();

            
            await this.updateStreaks(user);

            
            const newLevel = this.calculateLevel(user.totalXp);
            const leveledUp = newLevel > oldLevel;

            if (leveledUp) {
                user.level = newLevel;
                await this.handleLevelUp(user, message, guildConfig, client);
            }

            
            await this.checkAchievements(user, guildConfig);

            
            await this.debouncedSave(user);

            return {
                user,
                xpGained: finalXP,
                leveledUp,
                oldLevel,
                newLevel: user.level
            };

        } catch (error) {
            console.error('[LevelingController] Error gaining text XP:', error);
            return null;
        }
    }
    
    
    async debouncedSave(user) {
        const key = `${user.userId}_${user.guildId}`;
        
        
        if (this.saveQueue.has(key)) {
            clearTimeout(this.saveQueue.get(key));
        }
        
        
        const timeout = setTimeout(async () => {
            try {
                await user.save();
                this.saveQueue.delete(key);
            } catch (error) {
                console.error('[LevelingController] Error saving user:', error);
                this.saveQueue.delete(key);
            }
        }, 500);
        
        this.saveQueue.set(key, timeout);
    }

    calculateBaseTextXP(message, guildConfig) {
        const { min, max } = guildConfig.settings.xpRange;
        let baseXP = Math.floor(Math.random() * (max - min + 1)) + min;

        
        if (message.attachments.size > 0) {
            baseXP = Math.floor(baseXP * guildConfig.settings.multipliers.attachment);
        }

        
        if (/(https?:\/\/[^\s]+)/g.test(message.content)) {
            baseXP += Math.floor(baseXP * 0.2);
        }

        
        const messageLength = message.content.length;
        if (messageLength > 50) {
            const lengthBonus = Math.min(messageLength / 100, 0.5); 
            baseXP = Math.floor(baseXP * (1 + lengthBonus));
        }

        return Math.max(baseXP, 1);
    }

    async calculateTextMultiplier(message, guildConfig, user) {
        let multiplier = guildConfig.settings.multipliers.text;

        
        const now = new Date();
        if (now.getDay() === 0 || now.getDay() === 6) {
            multiplier *= guildConfig.settings.multipliers.weekend;
        }

        
        if (message.member?.premiumSince) {
            multiplier *= guildConfig.settings.multipliers.boost;
        }

        
        const memberRoles = message.member?.roles.cache;
        if (memberRoles) {
            for (const levelRole of guildConfig.levelRoles) {
                if (memberRoles.has(levelRole.roleId) && levelRole.rewards.xpBonus > 0) {
                    multiplier *= (1 + levelRole.rewards.xpBonus / 100);
                }
            }
        }

        
        if (user.streaks.daily >= 3) {
            const streakBonus = Math.min(user.streaks.daily * 0.05, 0.5);
            multiplier *= (1 + streakBonus);
        }

        return Math.min(multiplier, 5.0); 
    }

    
    async handleVoiceJoin(member, channel, guildConfig) {
        if (!guildConfig?.voiceSettings?.enabled) return;
        if (member.user.bot) return;

        const sessionId = `${member.id}_${member.guild.id}`;

        
        if (guildConfig.voiceSettings.ignoredChannels.includes(channel.id)) return;

        
        if (channel.id === member.guild.afkChannelId && !guildConfig.voiceSettings.afkChannelXp) return;

        
        if (this.voiceSessions.size > this.MAX_VOICE_SESSIONS) {
            const now = Date.now();
            for (const [key, sess] of this.voiceSessions.entries()) {
                
                if (now - sess.startTime.getTime() > 24 * 60 * 60 * 1000) {
                    this.voiceSessions.delete(key);
                    const interval = this.voiceXpIntervals.get(key);
                    if (interval) {
                        clearInterval(interval);
                        this.voiceXpIntervals.delete(key);
                    }
                }
            }
        }

        
        const session = {
            userId: member.id,
            guildId: member.guild.id,
            channelId: channel.id,
            startTime: new Date(),
            xpEarned: 0,
            participants: this.getChannelParticipants(channel)
        };

        this.voiceSessions.set(sessionId, session);

        
        const interval = setInterval(async () => {
            try {
                
                const currentMember = channel.guild.members.cache.get(member.id);
                if (!currentMember?.voice?.channel || currentMember.voice.channel.id !== channel.id) {
                    
                    return;
                }
                await this.awardVoiceXP(currentMember, channel, guildConfig, session);
            } catch (error) {
                console.error('[LevelingController] Error in voice XP interval:', error);
                
                this.voiceSessions.delete(sessionId);
                clearInterval(interval);
                this.voiceXpIntervals.delete(sessionId);
            }
        }, 60000); 

        if (interval.unref) interval.unref();
        this.voiceXpIntervals.set(sessionId, interval);
    }

    async handleVoiceLeave(member, guildConfig) {
        const sessionId = `${member.id}_${member.guild.id}`;
        const session = this.voiceSessions.get(sessionId);

        if (!session) return;

        try {
            
            const interval = this.voiceXpIntervals.get(sessionId);
            if (interval) {
                clearInterval(interval);
                this.voiceXpIntervals.delete(sessionId);
            }

            
            const endTime = new Date();
            const duration = endTime - session.startTime;

            
            if (guildConfig?.voiceSettings && duration >= guildConfig.voiceSettings.minSessionLength) {
                await this.saveVoiceSession(session, endTime, duration);
            }

            this.voiceSessions.delete(sessionId);
        } catch (error) {
            console.error('[LevelingController] Error handling voice leave:', error);
            
            this.voiceSessions.delete(sessionId);
            const interval = this.voiceXpIntervals.get(sessionId);
            if (interval) {
                clearInterval(interval);
                this.voiceXpIntervals.delete(sessionId);
            }
        }
    }

    async awardVoiceXP(member, channel, guildConfig, session) {
        try {
            if (!member.voice || !member.voice.channel) return;

            const user = await this.initializeUser(member.id, member.guild.id);
            const voiceState = member.voice;

            
            const isAFK = voiceState.selfDeaf || voiceState.serverDeaf;
            const isMuted = voiceState.selfMute || voiceState.serverMute;

            
            let xpGain = guildConfig.voiceSettings.xpPerMinute;

            
            const multipliers = guildConfig.voiceSettings.multipliers;

            
            if (voiceState.streaming) {
                xpGain *= multipliers.streaming;
            }
            if (voiceState.selfVideo) {
                xpGain *= multipliers.camera;
            }

            
            const activeMembers = channel.members.filter(m => 
                !m.user.bot && !m.voice.selfDeaf && !m.voice.serverDeaf
            );

            if (activeMembers.size >= 2) {
                xpGain *= multipliers.multipleUsers;
            } else if (!guildConfig.voiceSettings.soloChannelXp) {
                return; 
            }

            
            const bonusChannel = guildConfig.voiceSettings.bonusChannels.find(
                bc => bc.channelId === channel.id
            );
            if (bonusChannel) {
                xpGain *= bonusChannel.multiplier;
            }

            
            if (isAFK) xpGain *= 0.1; 
            if (isMuted) xpGain *= 0.7; 

            
            const now = new Date();
            if (now.getDay() === 0 || now.getDay() === 6) {
                xpGain *= guildConfig.settings.multipliers.weekend;
            }

            
            if (member.premiumSince) {
                xpGain *= guildConfig.settings.multipliers.boost;
            }

            xpGain = Math.floor(xpGain);
            if (xpGain <= 0) return;

            
            if (session.xpEarned + xpGain > guildConfig.voiceSettings.maxSessionXp) {
                xpGain = Math.max(0, guildConfig.voiceSettings.maxSessionXp - session.xpEarned);
            }

            if (xpGain <= 0) return;

            
            const oldLevel = user.level;
            user.xp += xpGain;
            user.totalXp += xpGain;
            user.voiceStats.voiceXp += xpGain;
            user.voiceStats.totalMinutes += 1;
            user.voiceStats.weeklyVoiceMinutes += 1;
            user.voiceStats.monthlyVoiceMinutes += 1;

            
            const newLevel = this.calculateLevel(user.totalXp);
            const leveledUp = newLevel > oldLevel;

            if (leveledUp) {
                user.level = newLevel;
                await this.handleLevelUp(user, {
                    guild: member.guild,
                    author: member.user,
                    channel: channel,
                    member: member
                }, guildConfig, member.client);
            }

            
            await this.checkAchievements(user, guildConfig);

            
            await this.debouncedSave(user);

            
            session.xpEarned += xpGain;
            session.wasAFK = isAFK;
            session.wasMuted = isMuted;
            session.wasDeafened = voiceState.serverDeaf;

        } catch (error) {
            console.error('[LevelingController] Voice XP error:', error);
        }
    }

    async saveVoiceSession(session, endTime, duration) {
        try {
            const voiceSession = new VoiceSession({
                ...session,
                endTime,
                duration
            });

            await voiceSession.save();

            
            const user = await UserLevel.findOne({
                userId: session.userId,
                guildId: session.guildId
            });

            if (user) {
                user.voiceStats.sessionsCount += 1;
                const sessionMinutes = Math.floor(duration / 1000 / 60);

                
                if (sessionMinutes > user.voiceStats.longestSession) {
                    user.voiceStats.longestSession = sessionMinutes;
                }

                
                if (user.voiceStats.sessionsCount > 0) {
                    user.voiceStats.averageSessionLength = Math.floor(
                        user.voiceStats.totalMinutes / user.voiceStats.sessionsCount
                    );
                }

                await user.save();
            }

        } catch (error) {
            console.error('[LevelingController] Error saving voice session:', error);
        }
    }

    
    calculateLevel(totalXp) {
        
        return Math.floor(Math.sqrt(totalXp / 100)) + 1;
    }

    calculateXPForLevel(level) {
        
        return Math.pow(level - 1, 2) * 100;
    }

    getXPForNextLevel(currentLevel) {
        return this.calculateXPForLevel(currentLevel + 1);
    }

    getCurrentLevelProgress(user) {
        const currentLevelXp = this.calculateXPForLevel(user.level);
        const nextLevelXp = this.calculateXPForLevel(user.level + 1);
        const progressXp = user.totalXp - currentLevelXp;
        const neededXp = nextLevelXp - currentLevelXp;

        return {
            currentXp: progressXp,
            requiredXp: neededXp,
            percentage: (progressXp / neededXp) * 100
        };
    }

    
    async handleLevelUp(user, messageContext, guildConfig, client) {
        try {
            
            await this.assignLevelRoles(user, messageContext, guildConfig);

            
            await this.sendLevelUpMessage(user, messageContext, guildConfig);

            
            await this.checkMilestoneRewards(user, guildConfig);

        } catch (error) {
            console.error('[LevelingController] Error handling level up:', error);
        }
    }

    async assignLevelRoles(user, messageContext, guildConfig) {
        try {
            if (!messageContext.member) return;

            const applicableRoles = guildConfig.levelRoles.filter(lr => lr.level === user.level);

            for (const levelRole of applicableRoles) {
                const role = messageContext.guild.roles.cache.get(levelRole.roleId);
                if (!role) continue;

                if (levelRole.action === 'replace') {
                    
                    const previousRoles = guildConfig.levelRoles
                        .filter(lr => lr.level < user.level && lr.action === 'replace')
                        .map(lr => lr.roleId);

                    for (const prevRoleId of previousRoles) {
                        if (messageContext.member.roles.cache.has(prevRoleId)) {
                            await messageContext.member.roles.remove(prevRoleId);
                        }
                    }
                }

                if (!messageContext.member.roles.cache.has(levelRole.roleId)) {
                    await messageContext.member.roles.add(role);
                }
            }
        } catch (error) {
            console.error('[LevelingController] Error assigning level roles:', error);
        }
    }

    async sendLevelUpMessage(user, messageContext, guildConfig) {
        try {
            const channel = guildConfig.settings.logChannel
                ? messageContext.guild.channels.cache.get(guildConfig.settings.logChannel)
                : messageContext.channel;

            if (!channel) return;

            const lang = loadLanguage(messageContext.guild.id).leveling;
            let levelUpMessage = guildConfig.settings.levelUpMessage
                .replace('{user}', `<@${user.userId}>`)
                .replace('{level}', user.level.toString())
                .replace('{xp}', user.totalXp.toLocaleString());

            const progress = this.getCurrentLevelProgress(user);
            const nextLevelXp = this.getXPForNextLevel(user.level);
            const authorAvatar = messageContext.author?.displayAvatarURL?.({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

            const container = new ContainerBuilder()
                .setAccentColor(ACCENT.success);

            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent([
                            `# ${getEmoji('sparkles')} ${lang.levelUpTitle || 'Level Up!'}`,
                            `### ${levelUpMessage}`,
                            `> Current Level: **Level ${user.level}** • Total XP: **${user.totalXp.toLocaleString()}**`
                        ].join('\n'))
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(authorAvatar)
                    )
            );

            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent([
                    `**${getEmoji('level')} ${lang.currentLevel || 'Current Level'}:** \`${user.level}\``,
                    `**${getEmoji('xp')} ${lang.totalXp || 'Total XP'}:** \`${user.totalXp.toLocaleString()}\``,
                    `**${getEmoji('trend')} ${lang.nextLevel || 'Next Level'}:** \`${(nextLevelXp - user.totalXp).toLocaleString()} XP\``,
                    `**${getEmoji('voice')} ${lang.voiceXp || 'Voice XP'}:** \`${user.voiceStats.voiceXp.toLocaleString()}\``,
                    `**${getEmoji('chat')} ${lang.messagesCount || 'Messages'}:** \`${user.messageCount.toLocaleString()}\``,
                    `**${getEmoji('fire')} ${lang.dailyStreak || 'Daily Streak'}:** \`${user.streaks.daily} days\``
                ].join('\n'))
            );

            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            }).catch(err => {
                console.error('[LevelingController] Error sending level up message:', err);
            });

        } catch (error) {
            console.error('[LevelingController] Error sending level up message:', error);
        }
    }

    
    async checkAchievements(user, guildConfig) {
        try {
            const newAchievements = [];

            for (const achievement of this.achievements) {
                
                if (user.achievements.some(ua => ua.id === achievement.id)) continue;

                let progress = 0;
                let unlocked = false;

                switch (achievement.type) {
                    case 'levels':
                        progress = user.level;
                        unlocked = user.level >= achievement.requirement;
                        break;
                    case 'messages':
                        progress = user.messageCount;
                        unlocked = user.messageCount >= achievement.requirement;
                        break;
                    case 'voice_minutes':
                        progress = user.voiceStats.totalMinutes;
                        unlocked = user.voiceStats.totalMinutes >= achievement.requirement;
                        break;
                    case 'streak':
                        progress = user.streaks.daily;
                        unlocked = user.streaks.daily >= achievement.requirement;
                        break;
                }

                if (unlocked) {
                    user.achievements.push({
                        id: achievement.id,
                        unlockedAt: new Date(),
                        progress: achievement.requirement
                    });
                    newAchievements.push(achievement);
                } else {
                    
                    const existingAchievement = user.achievements.find(ua => ua.id === achievement.id);
                    if (existingAchievement) {
                        existingAchievement.progress = progress;
                    }
                }
            }

            
            if (newAchievements.length > 0) {
                console.log(`[Leveling] User ${user.userId} unlocked ${newAchievements.length} achievements`);
            }

        } catch (error) {
            console.error('[LevelingController] Error checking achievements:', error);
        }
    }

    
    async updateStreaks(user) {
        const now = new Date();
        const lastActive = new Date(user.streaks.lastActive);
        const daysDiff = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
            
            return;
        } else if (daysDiff === 1) {
            
            user.streaks.daily += 1;
        } else {
            
            user.streaks.daily = 1;
        }

        user.streaks.lastActive = now;

        
        const weeksDiff = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24 * 7));
        if (weeksDiff >= 1) {
            user.streaks.weekly = user.streaks.daily >= 7 ? user.streaks.weekly + 1 : 0;
        }
    }

    
    isRestricted(message, guildConfig) {
        const restrictions = guildConfig.settings.restrictions;

        
        if (restrictions.ignoredChannels.includes(message.channel.id)) return true;

        
        if (restrictions.allowedChannels.length > 0 && 
            !restrictions.allowedChannels.includes(message.channel.id)) return true;

        
        if (message.member?.roles.cache.some(role => 
            restrictions.ignoredRoles.includes(role.id))) return true;

        
        if (message.author.bot && !restrictions.botMessages) return true;

        return false;
    }

    getChannelParticipants(channel) {
        return channel.members
            .filter(member => !member.user.bot)
            .map(member => member.id);
    }

    
    async getLeaderboard(guildId, type = 'xp', page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;
            let sortField, query = { guildId };

            switch (type) {
                case 'weekly':
                    sortField = { weeklyXp: -1, totalXp: -1 };
                    break;
                case 'voice_time':
                    sortField = { 'voiceStats.totalMinutes': -1 };
                    query['voiceStats.totalMinutes'] = { $gt: 0 };
                    break;
                case 'voice_xp':
                    sortField = { 'voiceStats.voiceXp': -1 };
                    query['voiceStats.voiceXp'] = { $gt: 0 };
                    break;
                case 'voice_sessions':
                    sortField = { 'voiceStats.sessionsCount': -1 };
                    query['voiceStats.sessionsCount'] = { $gt: 0 };
                    break;
                case 'messages':
                    sortField = { messageCount: -1 };
                    query.messageCount = { $gt: 0 };
                    break;
                case 'streak':
                    sortField = { 'streaks.daily': -1, totalXp: -1 };
                    query['streaks.daily'] = { $gt: 0 };
                    break;
                default: 
                    sortField = { totalXp: -1, level: -1 };
            }

            return await UserLevel.find(query)
                .sort(sortField)
                .skip(skip)
                .limit(limit)
                .lean();
        } catch (error) {
            console.error('[LevelingController] Error fetching leaderboard:', error);
            return [];
        }
    }

    async getUserRank(userId, guildId) {
        try {
            const user = await UserLevel.findOne({ userId, guildId });
            if (!user) return null;

            const rank = await UserLevel.countDocuments({
                guildId,
                totalXp: { $gt: user.totalXp }
            }) + 1;

            return { ...user.toObject(), rank };
        } catch (error) {
            console.error('[LevelingController] Error getting user rank:', error);
            return null;
        }
    }

    
    async setUserXP(userId, guildId, amount) {
        const user = await this.initializeUser(userId, guildId);
        user.totalXp = Math.max(0, amount);
        user.xp = user.totalXp;
        user.level = this.calculateLevel(user.totalXp);
        return await user.save();
    }

    async addUserXP(userId, guildId, amount) {
        const user = await this.initializeUser(userId, guildId);
        user.totalXp += amount;
        user.xp += amount;
        user.level = this.calculateLevel(user.totalXp);
        return await user.save();
    }

    async removeUserXP(userId, guildId, amount) {
        const user = await this.initializeUser(userId, guildId);
        user.totalXp = Math.max(0, user.totalXp - amount);
        user.xp = Math.max(0, user.xp - amount);
        user.level = this.calculateLevel(user.totalXp);
        return await user.save();
    }

    async setUserLevel(userId, guildId, level) {
        const user = await this.initializeUser(userId, guildId);
        const requiredXP = this.calculateXPForLevel(level);
        user.level = level;
        user.totalXp = requiredXP;
        user.xp = requiredXP;
        return await user.save();
    }

    async resetUserData(userId, guildId, type = 'all') {
        const user = await UserLevel.findOne({ userId, guildId });
        if (!user) return null;

        switch (type) {
            case 'all':
                return await UserLevel.deleteOne({ userId, guildId });
            case 'xp':
                user.xp = 0;
                user.totalXp = 0;
                user.level = 1;
                user.weeklyXp = 0;
                user.dailyXp = 0;
                break;
            case 'voice':
                user.voiceStats = {
                    totalMinutes: 0,
                    sessionsCount: 0,
                    voiceXp: 0,
                    longestSession: 0,
                    averageSessionLength: 0,
                    weeklyVoiceMinutes: 0,
                    monthlyVoiceMinutes: 0
                };
                break;
            case 'weekly':
                user.weeklyXp = 0;
                user.voiceStats.weeklyVoiceMinutes = 0;
                break;
        }

        return await user.save();
    }

    
    async resetWeeklyStats(guildId) {
        return await UserLevel.updateMany(
            { guildId },
            { $set: { weeklyXp: 0, 'voiceStats.weeklyVoiceMinutes': 0 } }
        );
    }

    async cleanupInactiveUsers(guildId, days = 90) {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return await UserLevel.deleteMany({
            guildId,
            lastXpGain: { $lt: cutoffDate },
            totalXp: { $lt: 100 }
        });
    }

    async checkMilestoneRewards(user, guildConfig) {
        
        try {
            const milestones = guildConfig.rewards?.milestones || [];
            for (const milestone of milestones) {
                if (milestone.level === user.level) {
                    console.log(`[Leveling] User ${user.userId} reached milestone level ${milestone.level}`);
                    
                }
            }
        } catch (error) {
            console.error('[LevelingController] Error checking milestone rewards:', error);
        }
    }
    
    
    cleanupExpiredCooldowns() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, timestamp] of this.cooldowns.entries()) {
            if (timestamp <= now) {
                this.cooldowns.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[LevelingController] Cleaned up ${cleaned} expired cooldowns`);
        }
    }
    
    cleanupOrphanedVoiceSessions() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [sessionId, session] of this.voiceSessions.entries()) {
            
            if (now - session.startTime.getTime() > 24 * 60 * 60 * 1000) {
                this.voiceSessions.delete(sessionId);
                const interval = this.voiceXpIntervals.get(sessionId);
                if (interval) {
                    clearInterval(interval);
                    this.voiceXpIntervals.delete(sessionId);
                }
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[LevelingController] Cleaned up ${cleaned} orphaned voice sessions`);
        }
    }
    
    
    async flushSaveQueue() {
        const promises = [];
        for (const [key, timeout] of this.saveQueue.entries()) {
            clearTimeout(timeout);
            
            const [userId, guildId] = key.split('_');
            try {
                const user = await UserLevel.findOne({ userId, guildId });
                if (user) {
                    promises.push(user.save());
                }
            } catch (error) {
                console.error(`[LevelingController] Error flushing save for ${key}:`, error);
            }
        }
        await Promise.allSettled(promises);
        this.saveQueue.clear();
    }
}

module.exports = new LevelingController();
