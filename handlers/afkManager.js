'use strict';

const {
  MessageFlags,
  ButtonStyle
} = require('discord.js');
const AFK = require('../models/afk/schema');
const { getAFKStatus, invalidateAFKStatus, invalidateGuildAFKStatuses } = require('../utils/cacheHelpers');
const { getEmoji } = require('../UI/emojis/emoji');
const { buildCard, btn, buttonRow, ACCENT } = require('../UI');
const lang = require('../events/loadLanguage');

class AFKManager {
  constructor(client) {
    this.client = client;
    this.processedMessages = new Map();
    this.mentionCooldowns = new Map();
    this.autoResponseCooldowns = new Map();

    
    this.MAX_PROCESSED_MESSAGES = 10000;
    this.MAX_MENTION_COOLDOWNS = 5000;
    this.MAX_AUTO_RESPONSE_COOLDOWNS = 3000;

    this.startCleanupTask();
    this.startMemoryCleanup();
  }

  async setAFK(userId, guildId, reason, options = {}) {
    try {
      const {
        duration = null,
        autoResponse = null,
        dmNotifications = true,
        publicNotifications = true,
        showDuration = true,
        timezone = null
      } = options;

      const expiresAt = duration ? new Date(Date.now() + duration) : null;

      const afkData = {
        userId,
        guildId,
        reason,
        setAt: new Date(),
        expiresAt,
        status: 'active',
        mentions: {
          count: 0,
          lastMentioned: null,
          mentionedBy: []
        },
        autoResponses: {
          enabled: Boolean(autoResponse?.message),
          message: autoResponse?.message || null,
          cooldown: autoResponse?.cooldown || 300000,
          lastSent: null
        },
        settings: {
          dmNotifications,
          publicNotifications,
          showDuration,
          allowMentionTracking: true
        },
        metadata: {
          timezone,
          lastActivity: new Date(),
          totalAfkTime: 0,
          remindUsers: [],
          previousReason: reason
        }
      };

      const afk = await AFK.findOneAndUpdate(
        { userId, guildId },
        { $set: afkData },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      
      invalidateAFKStatus(userId, guildId);

      return afk;
    } catch (error) {
      console.error('[AFKManager] Error setting AFK:', error);
      throw new Error('Failed to set AFK status');
    }
  }

  async removeAFK(userId, guildId, silent = false) {
    try {
      const afk = await AFK.findActiveAFK(userId, guildId);

      if (!afk) return null;

      
      await afk.calculateTotalAfkTime();

      
      afk.status = 'removed';
      afk.metadata.lastActivity = new Date();
      if (!afk.metadata.previousReason) {
        afk.metadata.previousReason = afk.reason;
      }
      await afk.save();

      
      invalidateAFKStatus(userId, guildId);

      return afk;
    } catch (error) {
      console.error('[AFKManager] Error removing AFK:', error);
      throw new Error('Failed to remove AFK status');
    }
  }

  async getAFK(userId, guildId) {
    try {
      
      const cached = await getAFKStatus(userId, guildId);
      if (cached !== null && cached !== undefined) {
        
        return cached || null;
      }

      
      return await AFK.findActiveAFK(userId, guildId);
    } catch (error) {
      console.error('[AFKManager] Error getting AFK:', error);
      return null;
    }
  }

  async getAllAFKs(guildId, options = {}) {
    try {
      const {
        page = 1,
        limit = 25,
        sortBy = 'setAt',
        sortOrder = -1,
        status = 'active'
      } = options;

      const skip = (page - 1) * limit;

      const query = { guildId, status };
      if (status === 'active') {
        query.$or = [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ];
      }

      const afks = await AFK.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await AFK.countDocuments(query);

      return {
        afks,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('[AFKManager] Error getting all AFKs:', error);
      return { afks: [], pagination: { current: 1, total: 0, hasNext: false, hasPrev: false } };
    }
  }

  async handleMentions(message) {
    if (
      !message ||
      message.author?.bot ||
      !message.mentions?.users?.size ||
      !message.guild ||
      this.processedMessages.has(message.id)
    ) return;

    
    if (this.processedMessages.size >= this.MAX_PROCESSED_MESSAGES) {
      const firstKey = this.processedMessages.keys().next().value;
      this.processedMessages.delete(firstKey);
    }
    this.processedMessages.set(message.id, Date.now());

    try {
      const mentionedAFKs = [];
      const autoResponses = [];

      for (const [userId] of message.mentions.users) {
        
        if (userId === message.author.id) continue;

        const afk = await this.getAFK(userId, message.guild.id);
        if (!afk) continue;

        
        const mentionedUser = this.client.users.cache.get(userId) || await this.client.users.fetch(userId).catch(() => null);
        if (mentionedUser && typeof afk.addMention === 'function') {
          afk.addMention(message.author).catch(err => {
            console.error('[AFKManager] Error adding mention:', err);
          });
        }

        
        const cooldownKey = `${message.author.id}-${userId}`;
        const lastMention = this.mentionCooldowns.get(cooldownKey);
        if (lastMention && Date.now() - lastMention < 60000) continue;

        if (this.mentionCooldowns.size >= this.MAX_MENTION_COOLDOWNS) {
          const firstKey = this.mentionCooldowns.keys().next().value;
          this.mentionCooldowns.delete(firstKey);
        }
        this.mentionCooldowns.set(cooldownKey, Date.now());
        mentionedAFKs.push({ userId, afk, user: mentionedUser });

        
        if (typeof afk.canSendAutoResponse === 'function' && afk.canSendAutoResponse()) {
          autoResponses.push({ afk, user: mentionedUser });
        }
      }

      
      if (mentionedAFKs.length > 0) {
        await this.sendMentionNotification(message, mentionedAFKs).catch(err => {
          if (err.code !== 10008 && err.code !== 50013) {
            console.error('[AFKManager] Error sending mention notification:', err);
          }
        });
      }

      
      for (const { afk, user } of autoResponses) {
        await this.sendAutoResponse(message, afk, user).catch(err => {
          if (err.code !== 50013) {
            console.error('[AFKManager] Error sending auto-response:', err);
          }
        });
      }

    } catch (error) {
      console.error('[AFKManager] Error handling mentions:', error);
    }
  }

  async sendMentionNotification(message, mentionedAFKs) {
    try {
      if (mentionedAFKs.length === 1) {
        const { userId, afk, user } = mentionedAFKs[0];
        const userDisplay = user ? user.tag : `<@${userId}>`;

        const sections = [
          lang.afk.notify.userIsAfk.replace('{user}', userDisplay),
          `> ${afk.reason}`
        ];

        const metaDetails = [];
        if (afk.expiresAt && afk.settings?.showDuration) {
          const expiresTimestamp = Math.floor(new Date(afk.expiresAt).getTime() / 1000);
          metaDetails.push(lang.afk.notify.expectedReturn.replace('{timestamp}', expiresTimestamp));
        }
        if (afk.mentions?.count > 0) {
          metaDetails.push(lang.afk.notify.mentionsLogged.replace('{count}', afk.mentions.count));
        }
        if (metaDetails.length > 0) {
          sections.push(metaDetails.join('\n'));
        }

        const rows = [
          buttonRow(
            btn.primary(`afk_leave_msg_${userId}`, lang.afk.notify.btnLeaveMsg, 'chat'),
            btn.secondary(`afk_remind_${userId}`, lang.afk.notify.btnRemind, 'bell'),
            btn.secondary(`afk_dismiss_${message.author.id}`, lang.afk.notify.btnDismiss, 'cross')
          )
        ];

        const card = buildCard({
          title: lang.afk.notify.title.replace('{emoji}', getEmoji('time')),
          sections,
          rows,
          thumbnailURL: user ? user.displayAvatarURL({ dynamic: true }) : null,
          accentColor: ACCENT.info,
          footer: lang.afk.notify.footer.replace('{time}', new Date().toLocaleTimeString())
        });

        await message.reply({
          components: [card],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        }).catch(err => {
          if (err.code !== 10008 && err.code !== 50013) {
            console.error('[AFKManager] Error replying with mention notification:', err);
          }
        });
      } else {
        const lines = [];
        for (const { userId, afk, user } of mentionedAFKs.slice(0, 5)) {
          const userTag = user ? user.tag : `<@${userId}>`;
          let returnPart = '';
          if (afk.expiresAt && afk.settings?.showDuration) {
            returnPart = ` • <t:${Math.floor(new Date(afk.expiresAt).getTime() / 1000)}:R>`;
          }
          lines.push(`• **${userTag}**: ${afk.reason}${returnPart}`);
        }

        if (mentionedAFKs.length > 5) {
          lines.push(`*...and ${mentionedAFKs.length - 5} more*`);
        }

        const rows = [
          buttonRow(
            btn.secondary(`afk_dismiss_${message.author.id}`, lang.afk.notify.btnDismiss, 'cross')
          )
        ];

        const card = buildCard({
          title: lang.afk.notify.multiTitle.replace('{emoji}', getEmoji('time')).replace('{count}', mentionedAFKs.length),
          sections: [lines.join('\n')],
          rows,
          accentColor: ACCENT.info,
          footer: lang.afk.notify.footer.replace('{time}', new Date().toLocaleTimeString())
        });

        await message.reply({
          components: [card],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        }).catch(err => {
          if (err.code !== 10008 && err.code !== 50013) {
            console.error('[AFKManager] Error replying with multi-mention notification:', err);
          }
        });
      }
    } catch (error) {
      console.error('[AFKManager] Error sending mention notification:', error);
    }
  }

  async sendAutoResponse(message, afk, user) {
    try {
      const cooldownKey = `${afk.userId}:${afk.guildId}`;
      const lastSent = this.autoResponseCooldowns.get(cooldownKey);

      if (lastSent && Date.now() - lastSent < afk.autoResponses.cooldown) {
        return;
      }

      const card = buildCard({
        title: lang.afk.autoResponse.configuredTitle.replace('{emoji}', getEmoji('bot')),
        sections: [
          `> ${afk.autoResponses.message}`,
          `*${getEmoji('bot')} Automated AFK Response*`
        ],
        thumbnailURL: user ? user.displayAvatarURL({ dynamic: true }) : this.client.user.displayAvatarURL(),
        accentColor: ACCENT.primary,
        footer: `Automated response • ${new Date().toLocaleTimeString()}`
      });

      await message.channel.send({
        components: [card],
        flags: MessageFlags.IsComponentsV2
      }).catch(err => {
        if (err.code !== 50013) {
          console.error('[AFKManager] Error sending auto-response message:', err);
        }
      });

      if (this.autoResponseCooldowns.size >= this.MAX_AUTO_RESPONSE_COOLDOWNS) {
        const firstKey = this.autoResponseCooldowns.keys().next().value;
        this.autoResponseCooldowns.delete(firstKey);
      }
      this.autoResponseCooldowns.set(cooldownKey, Date.now());

      if (typeof afk.markAutoResponseSent === 'function') {
        await afk.markAutoResponseSent().catch(err => {
          console.error('[AFKManager] Error marking auto-response sent:', err);
        });
      }
    } catch (error) {
      console.error('[AFKManager] Error sending auto-response:', error);
    }
  }

  async handleAFKRemoval(message) {
    if (!message?.guild || !message.author || message.author.bot) return;

    try {
      const existingAFK = await AFK.findOne({ userId: message.author.id, guildId: message.guild.id, status: 'active' });
      if (!existingAFK) return;

      const afk = await this.removeAFK(message.author.id, message.guild.id);
      if (!afk) return;

      const totalTime = afk.metadata?.totalAfkTime || 0;
      const afkDuration = this.formatDuration(totalTime);

      if (afk.settings?.publicNotifications) {
        const noteCount = (afk.mentions?.mentionedBy || []).filter(m => m.note).length;

        const sections = [
          lang.afk.return.publicWelcome.replace('{userId}', message.author.id),
          `${getEmoji('time')} ${lang.afk.return.awayDuration.replace('{duration}', afkDuration)}\n${getEmoji('chat')} ${lang.afk.return.mentionsLogged.replace('{mentions}', afk.mentions?.count || 0)}\n${getEmoji('help')} ${lang.afk.return.previousReason.replace('{reason}', afk.reason)}`
        ];

        if (noteCount > 0) {
          sections.push(`${getEmoji('bell')} ${lang.afk.return.notesReceived.replace('{count}', noteCount)}`);
        }

        const rows = [
          buttonRow(
            btn.success(`afk_reafk_${message.author.id}`, lang.afk.return.btnReAfk, 'loop'),
            btn.secondary(`afk_mentions_${message.author.id}`, lang.afk.return.btnViewMentions, 'list'),
            btn.secondary(`afk_dismiss_${message.author.id}`, lang.afk.notify.btnDismiss, 'cross')
          )
        ];

        const card = buildCard({
          title: lang.afk.return.title.replace('{emoji}', getEmoji('heart')),
          sections,
          rows,
          thumbnailURL: message.author.displayAvatarURL({ dynamic: true }),
          accentColor: ACCENT.success,
          footer: lang.afk.return.footer.replace('{time}', new Date().toLocaleTimeString())
        });

        await message.channel.send({
          components: [card],
          flags: MessageFlags.IsComponentsV2
        }).catch(err => {
          if (err.code !== 50013) {
            console.error('[AFKManager] Error sending welcome back message:', err);
          }
        });
      }

      
      if (afk.metadata?.remindUsers && afk.metadata.remindUsers.length > 0) {
        const remindList = [...new Set(afk.metadata.remindUsers)];
        for (const subscriberId of remindList) {
          if (subscriberId === message.author.id) continue;
          try {
            const subUser = this.client.users.cache.get(subscriberId) || await this.client.users.fetch(subscriberId).catch(() => null);
            if (subUser) {
              const subCard = buildCard({
                title: lang.afk.return.title.replace('{emoji}', getEmoji('time')),
                sections: [
                  lang.afk.return.remindAlertDM
                    .replace('{emoji}', getEmoji('bell'))
                    .replace('{userId}', message.author.id)
                    .replace('{guildName}', message.guild.name),
                  `${getEmoji('time')} **Duration Away:** ${afkDuration}`
                ],
                thumbnailURL: message.author.displayAvatarURL({ dynamic: true }),
                accentColor: ACCENT.info,
                footer: `AFK Return Notification • ${new Date().toLocaleTimeString()}`
              });

              await subUser.send({
                components: [subCard],
                flags: MessageFlags.IsComponentsV2
              }).catch(() => {});
            }
          } catch (e) {
            
          }
        }
      }

      if (afk.settings?.dmNotifications) {
        await this.sendWelcomeBackDM(message.author, afk, message.guild.name).catch(err => {
          if (err.code !== 50007) {
            console.error('[AFKManager] Error sending welcome back DM:', err);
          }
        });
      }

    } catch (error) {
      console.error('[AFKManager] Error handling AFK removal:', error);
    }
  }

  async sendWelcomeBackDM(user, afk, guildName = 'the server') {
    try {
      const totalTime = afk.metadata?.totalAfkTime || 0;
      const afkDuration = this.formatDuration(totalTime);

      const sections = [
        lang.afk.dm.summaryDesc.replace('{guildName}', guildName),
        `**Reason:** ${afk.reason}\n**Duration:** ${afkDuration}\n**Mentions:** ${afk.mentions?.count || 0}`
      ];

      if (afk.mentions?.mentionedBy && afk.mentions.mentionedBy.length > 0) {
        const recentMentions = afk.mentions.mentionedBy
          .slice(0, 5)
          .map(m => m.note ? `• **${m.username}**: "${m.note}"` : `• **${m.username}**`)
          .join('\n');
        sections.push(`**Recent Mentions & Notes:**\n${recentMentions}`);
      }

      const card = buildCard({
        title: lang.afk.dm.summaryTitle.replace('{emoji}', getEmoji('tick')),
        sections,
        thumbnailURL: user.displayAvatarURL({ dynamic: true }),
        accentColor: ACCENT.success,
        footer: `AFK session ended • ${new Date().toLocaleTimeString()}`
      });

      await user.send({
        components: [card],
        flags: MessageFlags.IsComponentsV2
      }).catch(() => {});
    } catch (error) {
      if (error.code !== 50007) {
        console.error('[AFKManager] Error sending welcome back DM:', error);
      }
    }
  }

  async removeExpiredAFKs() {
    try {
      const expiredAFKs = await AFK.findExpiredAFKs();

      for (const afk of expiredAFKs) {
        const user = this.client.users.cache.get(afk.userId);

        if (user && afk.settings?.dmNotifications) {
          const expiredCard = buildCard({
            title: lang.afk.dm.expiredTitle.replace('{emoji}', getEmoji('time')),
            sections: [
              lang.afk.dm.expiredDesc.replace('{guildName}', afk.guildId),
              `**Reason:** ${afk.reason}`
            ],
            accentColor: ACCENT.warning,
            footer: `AFK status expired • ${new Date().toLocaleTimeString()}`
          });

          await user.send({
            components: [expiredCard],
            flags: MessageFlags.IsComponentsV2
          }).catch(() => {});
        }

        await afk.calculateTotalAfkTime().catch(err => {
          console.error('[AFKManager] Error calculating total AFK time:', err);
        });

        afk.status = 'expired';
        await afk.save().catch(err => {
          console.error('[AFKManager] Error saving expired AFK:', err);
        });

        invalidateAFKStatus(afk.userId, afk.guildId);
      }
    } catch (error) {
      console.error('[AFKManager] Error cleaning up expired AFK statuses:', error);
    }
  }

  async getGuildStats(guildId) {
    try {
      const stats = await AFK.getGuildAFKStats(guildId);

      const result = {
        active: 0,
        expired: 0,
        removed: 0,
        totalMentions: 0
      };

      stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.totalMentions += stat.totalMentions;
      });

      return result;
    } catch (error) {
      console.error('[AFKManager] Error getting guild stats:', error);
      return { active: 0, expired: 0, removed: 0, totalMentions: 0 };
    }
  }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([smhd])$/i);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

    return value * multipliers[unit];
  }

  startCleanupTask() {
    let isCleaning = false;
    this.cleanupTimer = setInterval(async () => {
      if (isCleaning) return;
      isCleaning = true;
      try {
        await this.removeExpiredAFKs();
      } catch (error) {
        console.error('[AFKManager] Error in AFK cleanup task:', error);
      } finally {
        isCleaning = false;
      }
    }, 60000);
    this.cleanupTimer.unref?.();
  }

  startMemoryCleanup() {
    this.memoryTimer = setInterval(() => {
      const now = Date.now();
      const maxAge = 300000;

      for (const [messageId, timestamp] of this.processedMessages) {
        if (now - timestamp > maxAge) {
          this.processedMessages.delete(messageId);
        }
      }

      for (const [key, timestamp] of this.mentionCooldowns) {
        if (now - timestamp > 60000) {
          this.mentionCooldowns.delete(key);
        }
      }

      for (const [key, timestamp] of this.autoResponseCooldowns) {
        if (now - timestamp > 3600000) {
          this.autoResponseCooldowns.delete(key);
        }
      }

      if (this.processedMessages.size > this.MAX_PROCESSED_MESSAGES) {
        const entries = Array.from(this.processedMessages.entries())
          .sort((a, b) => a[1] - b[1])
          .slice(0, this.processedMessages.size - this.MAX_PROCESSED_MESSAGES);
        entries.forEach(([key]) => this.processedMessages.delete(key));
      }

      if (this.mentionCooldowns.size > this.MAX_MENTION_COOLDOWNS) {
        const entries = Array.from(this.mentionCooldowns.entries())
          .sort((a, b) => a[1] - b[1])
          .slice(0, this.mentionCooldowns.size - this.MAX_MENTION_COOLDOWNS);
        entries.forEach(([key]) => this.mentionCooldowns.delete(key));
      }

      if (this.autoResponseCooldowns.size > this.MAX_AUTO_RESPONSE_COOLDOWNS) {
        const entries = Array.from(this.autoResponseCooldowns.entries())
          .sort((a, b) => a[1] - b[1])
          .slice(0, this.autoResponseCooldowns.size - this.MAX_AUTO_RESPONSE_COOLDOWNS);
        entries.forEach(([key]) => this.autoResponseCooldowns.delete(key));
      }
    }, 300000);
    this.memoryTimer.unref?.();
  }

  stop() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.memoryTimer) clearInterval(this.memoryTimer);
    this.cleanupTimer = null;
    this.memoryTimer = null;
    this.processedMessages.clear();
    this.mentionCooldowns.clear();
    this.autoResponseCooldowns.clear();
  }
}


let managerInstance = null;

module.exports = (client) => {
  if (!managerInstance || (client && managerInstance.client !== client)) {
    managerInstance?.stop();
    managerInstance = new AFKManager(client);
  }

  const instance = managerInstance;

  return {
    setAFK: (...args) => instance.setAFK(...args),
    removeAFK: (...args) => instance.removeAFK(...args),
    getAFK: (...args) => instance.getAFK(...args),
    getAllAFKs: (...args) => instance.getAllAFKs(...args),
    handleAFKRemoval: (...args) => instance.handleAFKRemoval(...args),
    handleMentions: (...args) => instance.handleMentions(...args),
    getGuildStats: (...args) => instance.getGuildStats(...args),
    parseDuration: (...args) => instance.parseDuration(...args),
    getInstance: () => instance,
    stop: () => {
      instance.stop();
      if (managerInstance === instance) managerInstance = null;
    }
  };
};
