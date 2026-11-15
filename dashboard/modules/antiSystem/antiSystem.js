


const AntiConfig = require('../../../models/antiSystem/AntiConfig');
const ThreatScore = require('../../../models/antiSystem/ThreatScore');
const UserViolation = require('../../../models/antiSystem/UserViolation');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main');

async function getAntiConfig(guildId, socket) {
    try {
        let config = await AntiConfig.findOne({ guildId });
        
        if (!config) {
            
            config = {
                guildId,
                systemMode: { mode: 'active', reason: null },
                antiSpam: { enabled: false },
                antiLink: { enabled: false },
                antiRaid: { enabled: false },
                antiNuke: { enabled: false },
                whitelist: { owners: [], admins: [], customMembers: [], customRoles: [], customChannels: [] },
                logging: { enabled: false }
            };
        }

        const guild = client.guilds.cache.get(guildId);
        
        
        const resolvedConfig = {
            ...config.toObject ? config.toObject() : config,
            _resolved: {
                whitelistedRoles: resolveRoles(guild, config.whitelist?.customRoles || []),
                whitelistedChannels: resolveChannels(guild, config.whitelist?.customChannels || []),
                whitelistedMembers: await resolveMembers(guild, config.whitelist?.customMembers || []),
                logChannel: config.logging?.channelId ? resolveChannel(guild, config.logging.channelId) : null,
                staffChannel: config.logging?.staffChannelId ? resolveChannel(guild, config.logging.staffChannelId) : null,
                alertChannel: config.logging?.alertChannelId ? resolveChannel(guild, config.logging.alertChannelId) : null,
                quarantineRole: config.antiRaid?.quarantineRoleId ? resolveRole(guild, config.antiRaid.quarantineRoleId) : null
            }
        };

        socket.emit('bot_data_update', {
            type: 'anti_config',
            payload: {
                guildId,
                config: resolvedConfig
            }
        });

        console.log(`${colors.green}✅ Sent anti-config for ${guildId}${colors.reset}`);
        return resolvedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting anti-config:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'get_anti_config' }
        });
        throw error;
    }
}

async function toggleAntiSpam(guildId, enabled, socket) {
    try {
        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $set: { 'antiSpam.enabled': enabled } },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'anti_spam_toggled',
            payload: { guildId, enabled }
        });

        console.log(`${colors.cyan}🔄 Anti-Spam ${enabled ? 'ENABLED' : 'DISABLED'} for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling anti-spam:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'toggle_anti_spam' }
        });
        throw error;
    }
}

async function toggleAntiLink(guildId, enabled, socket) {
    try {
        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $set: { 'antiLink.enabled': enabled } },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'anti_link_toggled',
            payload: { guildId, enabled }
        });

        console.log(`${colors.cyan}🔄 Anti-Link ${enabled ? 'ENABLED' : 'DISABLED'} for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling anti-link:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'toggle_anti_link' }
        });
        throw error;
    }
}

async function toggleAntiRaid(guildId, enabled, socket) {
    try {
        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $set: { 'antiRaid.enabled': enabled } },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'anti_raid_toggled',
            payload: { guildId, enabled }
        });

        console.log(`${colors.cyan}🔄 Anti-Raid ${enabled ? 'ENABLED' : 'DISABLED'} for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling anti-raid:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'toggle_anti_raid' }
        });
        throw error;
    }
}

async function toggleAntiNuke(guildId, enabled, socket) {
    try {
        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $set: { 'antiNuke.enabled': enabled } },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'anti_nuke_toggled',
            payload: { guildId, enabled }
        });

        console.log(`${colors.cyan}🔄 Anti-Nuke ${enabled ? 'ENABLED' : 'DISABLED'} for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling anti-nuke:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'toggle_anti_nuke' }
        });
        throw error;
    }
}

async function updateAntiSpamSettings(guildId, settings, socket) {
    try {
        const updateObj = {};
        
        
        if (settings.messageLimit !== undefined) updateObj['antiSpam.messageLimit'] = settings.messageLimit;
        if (settings.timeWindow !== undefined) updateObj['antiSpam.timeWindow'] = settings.timeWindow;
        if (settings.duplicateThreshold !== undefined) updateObj['antiSpam.duplicateThreshold'] = settings.duplicateThreshold;
        if (settings.mentionLimit !== undefined) updateObj['antiSpam.mentionLimit'] = settings.mentionLimit;
        if (settings.mentionLimitPerMessage !== undefined) updateObj['antiSpam.mentionLimitPerMessage'] = settings.mentionLimitPerMessage;
        if (settings.emojiLimit !== undefined) updateObj['antiSpam.emojiLimit'] = settings.emojiLimit;
        if (settings.blockedWords !== undefined) updateObj['antiSpam.blockedWords'] = settings.blockedWords;
        if (settings.blockedPatterns !== undefined) updateObj['antiSpam.blockedPatterns'] = settings.blockedPatterns;
        if (settings.whitelistedChannels !== undefined) updateObj['antiSpam.whitelistedChannels'] = settings.whitelistedChannels;
        if (settings.whitelistedRoles !== undefined) updateObj['antiSpam.whitelistedRoles'] = settings.whitelistedRoles;
        
        
        if (settings.capsDetection) {
            if (settings.capsDetection.enabled !== undefined) updateObj['antiSpam.capsDetection.enabled'] = settings.capsDetection.enabled;
            if (settings.capsDetection.percentage !== undefined) updateObj['antiSpam.capsDetection.percentage'] = settings.capsDetection.percentage;
            if (settings.capsDetection.minLength !== undefined) updateObj['antiSpam.capsDetection.minLength'] = settings.capsDetection.minLength;
        }
        
        
        if (settings.punishment) {
            if (settings.punishment.defaultAction !== undefined) updateObj['antiSpam.punishment.defaultAction'] = settings.punishment.defaultAction;
            if (settings.punishment.warningExpiry !== undefined) updateObj['antiSpam.punishment.warningExpiry'] = settings.punishment.warningExpiry;
            if (settings.punishment.actions !== undefined) updateObj['antiSpam.punishment.actions'] = settings.punishment.actions;
        }

        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $set: updateObj },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'anti_spam_updated',
            payload: { guildId, settings }
        });

        console.log(`${colors.green}✅ Updated anti-spam settings for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating anti-spam:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'update_anti_spam' }
        });
        throw error;
    }
}

async function updateAntiLinkSettings(guildId, settings, socket) {
    try {
        const updateObj = {};
        
        if (settings.mode !== undefined) updateObj['antiLink.mode'] = settings.mode;
        if (settings.allowedDomains !== undefined) updateObj['antiLink.allowedDomains'] = settings.allowedDomains;
        if (settings.blockedDomains !== undefined) updateObj['antiLink.blockedDomains'] = settings.blockedDomains;
        if (settings.shortenerProtection !== undefined) updateObj['antiLink.shortenerProtection'] = settings.shortenerProtection;
        if (settings.ipLinkProtection !== undefined) updateObj['antiLink.ipLinkProtection'] = settings.ipLinkProtection;
        if (settings.whitelistedChannels !== undefined) updateObj['antiLink.whitelistedChannels'] = settings.whitelistedChannels;
        if (settings.whitelistedRoles !== undefined) updateObj['antiLink.whitelistedRoles'] = settings.whitelistedRoles;
        
        
        if (settings.phishingProtection) {
            if (settings.phishingProtection.enabled !== undefined) updateObj['antiLink.phishingProtection.enabled'] = settings.phishingProtection.enabled;
        }
        
        
        if (settings.inviteHandling) {
            if (settings.inviteHandling.blockAllInvites !== undefined) updateObj['antiLink.inviteHandling.blockAllInvites'] = settings.inviteHandling.blockAllInvites;
            if (settings.inviteHandling.allowPartnerInvites !== undefined) updateObj['antiLink.inviteHandling.allowPartnerInvites'] = settings.inviteHandling.allowPartnerInvites;
            if (settings.inviteHandling.partnerServers !== undefined) updateObj['antiLink.inviteHandling.partnerServers'] = settings.inviteHandling.partnerServers;
        }
        
        
        if (settings.punishment) {
            if (settings.punishment.defaultAction !== undefined) updateObj['antiLink.punishment.defaultAction'] = settings.punishment.defaultAction;
            if (settings.punishment.actions !== undefined) updateObj['antiLink.punishment.actions'] = settings.punishment.actions;
        }

        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $set: updateObj },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'anti_link_updated',
            payload: { guildId, settings }
        });

        console.log(`${colors.green}✅ Updated anti-link settings for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating anti-link:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'update_anti_link' }
        });
        throw error;
    }
}

async function updateAntiRaidSettings(guildId, settings, socket) {
    try {
        const updateObj = {};
        
        if (settings.joinThreshold !== undefined) updateObj['antiRaid.joinThreshold'] = settings.joinThreshold;
        if (settings.joinTimeWindow !== undefined) updateObj['antiRaid.joinTimeWindow'] = settings.joinTimeWindow;
        if (settings.minAccountAge !== undefined) updateObj['antiRaid.minAccountAge'] = settings.minAccountAge;
        if (settings.lockdownDuration !== undefined) updateObj['antiRaid.lockdownDuration'] = settings.lockdownDuration;
        if (settings.quarantineRoleId !== undefined) updateObj['antiRaid.quarantineRoleId'] = settings.quarantineRoleId;
        if (settings.autoLockdown !== undefined) updateObj['antiRaid.autoLockdown'] = settings.autoLockdown;
        if (settings.suspiciousPatterns !== undefined) updateObj['antiRaid.suspiciousPatterns'] = settings.suspiciousPatterns;
        
        
        if (settings.actions) {
            if (settings.actions.onRaidDetected !== undefined) updateObj['antiRaid.actions.onRaidDetected'] = settings.actions.onRaidDetected;
            if (settings.actions.onSuspiciousJoin !== undefined) updateObj['antiRaid.actions.onSuspiciousJoin'] = settings.actions.onSuspiciousJoin;
        }

        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $set: updateObj },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'anti_raid_updated',
            payload: { guildId, settings }
        });

        console.log(`${colors.green}✅ Updated anti-raid settings for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating anti-raid:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'update_anti_raid' }
        });
        throw error;
    }
}

async function updateAntiNukeSettings(guildId, settings, socket) {
    try {
        const updateObj = {};
        
        
        if (settings.protectChannels !== undefined) updateObj['antiNuke.protectChannels'] = settings.protectChannels;
        if (settings.protectRoles !== undefined) updateObj['antiNuke.protectRoles'] = settings.protectRoles;
        if (settings.protectBans !== undefined) updateObj['antiNuke.protectBans'] = settings.protectBans;
        if (settings.protectKicks !== undefined) updateObj['antiNuke.protectKicks'] = settings.protectKicks;
        if (settings.protectWebhooks !== undefined) updateObj['antiNuke.protectWebhooks'] = settings.protectWebhooks;
        if (settings.protectEmojis !== undefined) updateObj['antiNuke.protectEmojis'] = settings.protectEmojis;
        if (settings.protectBotAdds !== undefined) updateObj['antiNuke.protectBotAdds'] = settings.protectBotAdds;
        
        
        if (settings.thresholds) {
            if (settings.thresholds.channelDelete !== undefined) updateObj['antiNuke.thresholds.channelDelete'] = settings.thresholds.channelDelete;
            if (settings.thresholds.channelCreate !== undefined) updateObj['antiNuke.thresholds.channelCreate'] = settings.thresholds.channelCreate;
            if (settings.thresholds.roleDelete !== undefined) updateObj['antiNuke.thresholds.roleDelete'] = settings.thresholds.roleDelete;
            if (settings.thresholds.roleCreate !== undefined) updateObj['antiNuke.thresholds.roleCreate'] = settings.thresholds.roleCreate;
            if (settings.thresholds.banAdd !== undefined) updateObj['antiNuke.thresholds.banAdd'] = settings.thresholds.banAdd;
            if (settings.thresholds.kickAdd !== undefined) updateObj['antiNuke.thresholds.kickAdd'] = settings.thresholds.kickAdd;
            if (settings.thresholds.webhookCreate !== undefined) updateObj['antiNuke.thresholds.webhookCreate'] = settings.thresholds.webhookCreate;
            if (settings.thresholds.timeWindow !== undefined) updateObj['antiNuke.thresholds.timeWindow'] = settings.thresholds.timeWindow;
        }
        
        
        if (settings.punishment !== undefined) updateObj['antiNuke.punishment'] = settings.punishment;

        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $set: updateObj },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'anti_nuke_updated',
            payload: { guildId, settings }
        });

        console.log(`${colors.green}✅ Updated anti-nuke settings for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating anti-nuke:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'update_anti_nuke' }
        });
        throw error;
    }
}

async function addToWhitelist(guildId, type, id, socket) {
    try {
        const fieldMap = {
            member: 'whitelist.customMembers',
            role: 'whitelist.customRoles',
            channel: 'whitelist.customChannels'
        };
        
        const field = fieldMap[type];
        if (!field) throw new Error(`Invalid whitelist type: ${type}`);
        
        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $addToSet: { [field]: id } },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'whitelist_updated',
            payload: { guildId, action: 'add', type, id }
        });

        console.log(`${colors.green}✅ Added ${type} ${id} to whitelist for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error adding to whitelist:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'add_whitelist' }
        });
        throw error;
    }
}

async function removeFromWhitelist(guildId, type, id, socket) {
    try {
        const fieldMap = {
            member: 'whitelist.customMembers',
            role: 'whitelist.customRoles',
            channel: 'whitelist.customChannels'
        };
        
        const field = fieldMap[type];
        if (!field) throw new Error(`Invalid whitelist type: ${type}`);
        
        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $pull: { [field]: id } },
            { returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'whitelist_updated',
            payload: { guildId, action: 'remove', type, id }
        });

        console.log(`${colors.yellow}🗑️ Removed ${type} ${id} from whitelist for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error removing from whitelist:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'remove_whitelist' }
        });
        throw error;
    }
}

async function updateLoggingSettings(guildId, settings, socket) {
    try {
        const updateObj = {};
        
        if (settings.enabled !== undefined) updateObj['logging.enabled'] = settings.enabled;
        if (settings.channelId !== undefined) updateObj['logging.channelId'] = settings.channelId;
        if (settings.staffChannelId !== undefined) updateObj['logging.staffChannelId'] = settings.staffChannelId;
        if (settings.alertChannelId !== undefined) updateObj['logging.alertChannelId'] = settings.alertChannelId;
        if (settings.embedColor !== undefined) updateObj['logging.embedColor'] = settings.embedColor;
        if (settings.logLevel !== undefined) updateObj['logging.logLevel'] = settings.logLevel;
        if (settings.includeStacktrace !== undefined) updateObj['logging.includeStacktrace'] = settings.includeStacktrace;

        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { $set: updateObj },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'logging_updated',
            payload: { guildId, settings }
        });

        console.log(`${colors.green}✅ Updated logging settings for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating logging:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'update_logging' }
        });
        throw error;
    }
}

async function getThreatScores(guildId, options, socket) {
    try {
        const { limit = 20, sortBy = 'currentScore', minScore = 0 } = options || {};
        
        const scores = await ThreatScore.find({
            guildId,
            currentScore: { $gte: minScore }
        })
            .sort({ [sortBy]: -1 })
            .limit(limit)
            .lean();

        const guild = client.guilds.cache.get(guildId);
        
        
        const resolvedScores = await Promise.all(scores.map(async (score) => {
            const member = guild?.members.cache.get(score.userId);
            return {
                ...score,
                _resolved: {
                    username: member?.user?.tag || 'Unknown User',
                    displayName: member?.displayName || 'Unknown',
                    avatar: member?.user?.displayAvatarURL() || null,
                    isInServer: !!member
                }
            };
        }));

        socket.emit('bot_data_update', {
            type: 'threat_scores',
            payload: { guildId, scores: resolvedScores }
        });

        console.log(`${colors.green}✅ Sent ${scores.length} threat scores for ${guildId}${colors.reset}`);
        return resolvedScores;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting threat scores:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'get_threat_scores' }
        });
        throw error;
    }
}

async function getUserThreatScore(guildId, userId, socket) {
    try {
        let score = await ThreatScore.findOne({ guildId, $or: [{ userId }, { oderId: userId }] });
        
        if (!score) {
            score = { userId, guildId, currentScore: 0, riskLevel: 'low', violations: [], actions: [] };
        }

        const guild = client.guilds.cache.get(guildId);
        const member = guild?.members.cache.get(userId);

        const resolvedScore = {
            ...score.toObject ? score.toObject() : score,
            _resolved: {
                username: member?.user?.tag || 'Unknown User',
                displayName: member?.displayName || 'Unknown',
                avatar: member?.user?.displayAvatarURL() || null,
                isInServer: !!member
            }
        };

        socket.emit('bot_data_update', {
            type: 'user_threat_score',
            payload: { guildId, userId, score: resolvedScore }
        });

        return resolvedScore;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting user threat score:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'get_user_threat_score' }
        });
        throw error;
    }
}

async function resetUserThreatScore(guildId, userId, socket) {
    try {
        await ThreatScore.findOneAndUpdate(
            { guildId, userId },
            { 
                $set: { 
                    currentScore: 0, 
                    riskLevel: 'low',
                    'violationCounts.total': 0,
                    'violationCounts.last24Hours': 0,
                    'violationCounts.lastWeek': 0
                } 
            }
        );

        socket.emit('bot_data_update', {
            type: 'threat_score_reset',
            payload: { guildId, userId }
        });

        console.log(`${colors.yellow}🔄 Reset threat score for user ${userId} in ${guildId}${colors.reset}`);
        return true;
    } catch (error) {
        console.error(`${colors.red}❌ Error resetting threat score:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'reset_threat_score' }
        });
        throw error;
    }
}

async function getViolations(guildId, options, socket) {
    try {
        const { limit = 50, userId, violationType, severity, startDate, endDate } = options || {};
        
        const query = { guildId };
        if (userId) query.userId = userId;
        if (violationType) query.violationType = violationType;
        if (severity) query.severity = severity;
        if (startDate || endDate) {
            query.violatedAt = {};
            if (startDate) query.violatedAt.$gte = new Date(startDate);
            if (endDate) query.violatedAt.$lte = new Date(endDate);
        }

        const violations = await UserViolation.find(query)
            .sort({ violatedAt: -1 })
            .limit(limit)
            .lean();

        const guild = client.guilds.cache.get(guildId);
        
        
        const resolvedViolations = violations.map(v => {
            const member = guild?.members.cache.get(v.userId);
            const channel = guild?.channels.cache.get(v.channelId);
            return {
                ...v,
                _resolved: {
                    username: member?.user?.tag || 'Unknown User',
                    channelName: channel?.name || 'Unknown Channel'
                }
            };
        });

        socket.emit('bot_data_update', {
            type: 'violations',
            payload: { guildId, violations: resolvedViolations }
        });

        console.log(`${colors.green}✅ Sent ${violations.length} violations for ${guildId}${colors.reset}`);
        return resolvedViolations;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting violations:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'get_violations' }
        });
        throw error;
    }
}

async function getViolationStats(guildId, socket) {
    try {
        const now = new Date();
        const last24h = new Date(now - 24 * 60 * 60 * 1000);
        const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const [
            total,
            last24hCount,
            last7dCount,
            last30dCount,
            byType,
            bySeverity,
            topOffenders
        ] = await Promise.all([
            UserViolation.countDocuments({ guildId }),
            UserViolation.countDocuments({ guildId, violatedAt: { $gte: last24h } }),
            UserViolation.countDocuments({ guildId, violatedAt: { $gte: last7d } }),
            UserViolation.countDocuments({ guildId, violatedAt: { $gte: last30d } }),
            UserViolation.aggregate([
                { $match: { guildId } },
                { $group: { _id: '$violationType', count: { $sum: 1 } } }
            ]),
            UserViolation.aggregate([
                { $match: { guildId } },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]),
            UserViolation.aggregate([
                { $match: { guildId, violatedAt: { $gte: last7d } } },
                { $group: { _id: '$userId', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        const stats = {
            total,
            last24h: last24hCount,
            last7d: last7dCount,
            last30d: last30dCount,
            byType: byType.reduce((acc, { _id, count }) => ({ ...acc, [_id]: count }), {}),
            bySeverity: bySeverity.reduce((acc, { _id, count }) => ({ ...acc, [_id]: count }), {}),
            topOffenders
        };

        socket.emit('bot_data_update', {
            type: 'violation_stats',
            payload: { guildId, stats }
        });

        console.log(`${colors.green}✅ Sent violation stats for ${guildId}${colors.reset}`);
        return stats;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting violation stats:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'get_violation_stats' }
        });
        throw error;
    }
}

async function setSystemMode(guildId, mode, reason, socket) {
    try {
        const validModes = ['active', 'lockdown', 'dry-run', 'log-only', 'disabled'];
        if (!validModes.includes(mode)) throw new Error(`Invalid mode: ${mode}`);
        
        const config = await AntiConfig.findOneAndUpdate(
            { guildId },
            { 
                $set: { 
                    'systemMode.mode': mode,
                    'systemMode.reason': reason || null,
                    'systemMode.setAt': new Date(),
                    'systemMode.autoRevertAt': mode === 'lockdown' ? new Date(Date.now() + 3600000) : null
                } 
            },
            { upsert: true, returnDocument: 'after' }
        );

        socket.emit('bot_data_update', {
            type: 'system_mode_changed',
            payload: { guildId, mode, reason }
        });

        console.log(`${colors.magenta}🔧 System mode set to ${mode} for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting system mode:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'set_system_mode' }
        });
        throw error;
    }
}

async function resetAntiConfig(guildId, socket) {
    try {
        await AntiConfig.findOneAndDelete({ guildId });
        
        socket.emit('bot_data_update', {
            type: 'anti_config_reset',
            payload: { guildId }
        });

        console.log(`${colors.yellow}🔄 Reset anti-config for ${guildId}${colors.reset}`);
        await getAntiConfig(guildId, socket);
        return true;
    } catch (error) {
        console.error(`${colors.red}❌ Error resetting anti-config:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'reset_anti_config' }
        });
        throw error;
    }
}

async function clearViolationHistory(guildId, options, socket) {
    try {
        const { userId, olderThan } = options || {};
        
        const query = { guildId };
        if (userId) query.userId = userId;
        if (olderThan) query.violatedAt = { $lt: new Date(olderThan) };

        const result = await UserViolation.deleteMany(query);

        socket.emit('bot_data_update', {
            type: 'violations_cleared',
            payload: { guildId, deletedCount: result.deletedCount }
        });

        console.log(`${colors.yellow}🗑️ Cleared ${result.deletedCount} violations for ${guildId}${colors.reset}`);
        return result.deletedCount;
    } catch (error) {
        console.error(`${colors.red}❌ Error clearing violations:${colors.reset}`, error);
        socket.emit('bot_data_update', {
            type: 'anti_system_error',
            payload: { guildId, error: error.message, action: 'clear_violations' }
        });
        throw error;
    }
}

async function sendAllAntiSystemData(socket) {
    try {
        const configs = await AntiConfig.find({});
        
        for (const config of configs) {
            try {
                await getAntiConfig(config.guildId, socket);
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (err) {
                console.error(`Error sending anti-system data for ${config.guildId}:`, err);
            }
        }

        console.log(`${colors.green}📊 Sent anti-system data for ${configs.length} guilds${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all anti-system data:${colors.reset}`, error);
    }
}

function resolveRoles(guild, roleIds) {
    if (!guild || !roleIds) return [];
    return roleIds.map(id => {
        const role = guild.roles.cache.get(id);
        return role ? { id, name: role.name, color: role.hexColor } : { id, name: 'Unknown Role', color: '#000000' };
    });
}

function resolveRole(guild, roleId) {
    if (!guild || !roleId) return null;
    const role = guild.roles.cache.get(roleId);
    return role ? { id: roleId, name: role.name, color: role.hexColor } : null;
}

function resolveChannels(guild, channelIds) {
    if (!guild || !channelIds) return [];
    return channelIds.map(id => {
        const channel = guild.channels.cache.get(id);
        return channel ? { id, name: channel.name, type: channel.type } : { id, name: 'Unknown Channel', type: 0 };
    });
}

function resolveChannel(guild, channelId) {
    if (!guild || !channelId) return null;
    const channel = guild.channels.cache.get(channelId);
    return channel ? { id: channelId, name: channel.name, type: channel.type } : null;
}

async function resolveMembers(guild, memberIds) {
    if (!guild || !memberIds) return [];
    return Promise.all(memberIds.map(async (id) => {
        try {
            const member = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
            return member ? { 
                id, 
                username: member.user.tag, 
                displayName: member.displayName,
                avatar: member.user.displayAvatarURL()
            } : { id, username: 'Unknown User', displayName: 'Unknown', avatar: null };
        } catch {
            return { id, username: 'Unknown User', displayName: 'Unknown', avatar: null };
        }
    }));
}

module.exports = {
    
    getAntiConfig,
    resetAntiConfig,
    
    
    toggleAntiSpam,
    toggleAntiLink,
    toggleAntiRaid,
    toggleAntiNuke,
    
    
    updateAntiSpamSettings,
    updateAntiLinkSettings,
    updateAntiRaidSettings,
    updateAntiNukeSettings,
    updateLoggingSettings,
    
    
    addToWhitelist,
    removeFromWhitelist,
    
    
    getThreatScores,
    getUserThreatScore,
    resetUserThreatScore,
    
    
    getViolations,
    getViolationStats,
    clearViolationHistory,
    
    
    setSystemMode,
    
    
    sendAllAntiSystemData
};
