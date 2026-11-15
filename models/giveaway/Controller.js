const Giveaway = require('./schema');
const { getGiveawayCache, invalidateGiveaway } = require('../../utils/cacheHelpers');
const { 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    MessageFlags
} = require('discord.js');
const ms = require('ms');
const { buildCard, btn, buttonRow, ACCENT } = require('../../UI');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');


const updateQueue = new Map();
const PROCESSING_GIVEAWAYS = new Set();

class GiveawayController {
  
  
  static async updateGiveawayMessage(client, giveaway, force = false) {
    const messageId = giveaway.messageId;
    
    
    if (PROCESSING_GIVEAWAYS.has(messageId) && !force) {
      return { success: true, skipped: true };
    }

    
    if (updateQueue.has(messageId) && !force) {
      clearTimeout(updateQueue.get(messageId));
    }

    return new Promise((resolve) => {
      const updateFn = async () => {
        PROCESSING_GIVEAWAYS.add(messageId);
        updateQueue.delete(messageId);

        try {
          
          const freshGiveaway = await Giveaway.findOne({ messageId });
          if (!freshGiveaway) {
            PROCESSING_GIVEAWAYS.delete(messageId);
            return resolve({ success: false, error: 'Giveaway not found' });
          }

          const channel = await client.channels.fetch(freshGiveaway.channelId).catch(() => null);
          if (!channel) {
            PROCESSING_GIVEAWAYS.delete(messageId);
            return resolve({ success: false, error: 'Channel not found' });
          }

          const message = await channel.messages.fetch(freshGiveaway.messageId).catch(() => null);
          if (!message) {
            PROCESSING_GIVEAWAYS.delete(messageId);
            return resolve({ success: false, error: 'Message not found' });
          }
          
          const buttons = this.createGiveawayButtons(freshGiveaway);
          const container = this.createGiveawayContainer(freshGiveaway, buttons);
          
          await message.edit({ 
            components: [container],
            flags: MessageFlags.IsComponentsV2 
          }).catch(err => {
            console.error('[GiveawayController] Error editing message:', err);
          });
          
          PROCESSING_GIVEAWAYS.delete(messageId);
          resolve({ success: true });
        } catch (error) {
          console.error('[GiveawayController] Error updating giveaway message:', error);
          PROCESSING_GIVEAWAYS.delete(messageId);
          resolve({ success: false, error: error.message });
        }
      };

      if (force) {
        updateFn();
      } else {
        
        const timeoutId = setTimeout(updateFn, 500);
        updateQueue.set(messageId, timeoutId);
      }
    });
  }

  
  static async createGiveaway(options) {
    try {
      const {
        messageId, guildId, channelId, hostId, title, description, 
        prize, duration, winners = 1, requirements = {}, settings = {}
      } = options;

      const endTime = new Date(Date.now() + ms(duration));
      
      const giveaway = new Giveaway({
        messageId,
        guildId,
        channelId,
        hostId,
        title,
        description,
        prize,
        endTime,
        winners,
        requirements,
        settings
      });

      await giveaway.save();
      return { success: true, giveaway };
    } catch (error) {
      console.error('Error creating giveaway:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async getGiveaway(messageId) {
    try {
      
      try {
        const cacheManager = require('../../utils/cacheManager');
        const cacheKey = `giveaway_${messageId}`;
        const cached = cacheManager.get('giveaway', cacheKey);
        if (cached) {
          return { success: true, giveaway: cached };
        }
      } catch (cacheError) {
        
      }

      const giveaway = await Giveaway.findOne({ messageId });
      if (giveaway) {
        
        try {
          const cacheManager = require('../../utils/cacheManager');
          const cacheKey = `giveaway_${messageId}`;
          cacheManager.set('giveaway', cacheKey, giveaway, 2 * 60 * 1000);
        } catch (cacheError) {
          
        }
      }
      return { success: true, giveaway };
    } catch (error) {
      console.error('[GiveawayController] Error fetching giveaway:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async updateGiveaway(messageId, updates, client) {
    try {
      
      if (updates.duration) {
        updates.endTime = new Date(Date.now() + ms(updates.duration));
        delete updates.duration;
      }
  
      
      const currentGiveaway = await Giveaway.findOne({ messageId });
      if (!currentGiveaway) {
        return { success: false, error: 'Giveaway not found' };
      }
  
      const giveaway = await Giveaway.findOneAndUpdate(
        { messageId },
        { 
          $set: { 
            ...updates,
            'metadata.lastUpdated': new Date(),
            'metadata.version': (currentGiveaway.metadata.version || 0) + 1
          }
        },
        { returnDocument: 'after', runValidators: true }
      );

      
      invalidateGiveaway(messageId);

      
      if (client) {
        await this.updateGiveawayMessage(client, giveaway);
      }

      return { success: true, giveaway };
    } catch (error) {
      console.error('[GiveawayController] Error updating giveaway:', error);
      return { success: false, error: error.message };
    }
  }
  
  
  static async deleteGiveaway(messageId) {
    try {
      const result = await Giveaway.deleteOne({ messageId });
      return { 
        success: result.deletedCount > 0, 
        message: result.deletedCount > 0 ? 'Giveaway deleted' : 'Giveaway not found' 
      };
    } catch (error) {
      console.error('Error deleting giveaway:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async addParticipant(messageId, userId, username, client) {
    const lockKey = `${messageId}_${userId}`;
    
    
    if (PROCESSING_GIVEAWAYS.has(lockKey)) {
      return { success: false, error: 'Processing entry, please wait...' };
    }

    PROCESSING_GIVEAWAYS.add(lockKey);

    try {
      
      const giveaway = await Giveaway.findOne({ messageId });
      if (!giveaway) {
        PROCESSING_GIVEAWAYS.delete(lockKey);
        return { success: false, error: 'Giveaway not found' };
      }

      if (giveaway.status !== 'active') {
        PROCESSING_GIVEAWAYS.delete(lockKey);
        return { success: false, error: 'Giveaway is not active' };
      }

      if (giveaway.endTime <= new Date()) {
        PROCESSING_GIVEAWAYS.delete(lockKey);
        return { success: false, error: 'Giveaway has ended' };
      }

      
      const existingEntry = giveaway.entries.find(entry => entry.userId === userId);
      if (existingEntry && !giveaway.settings.allowMultipleEntries) {
        PROCESSING_GIVEAWAYS.delete(lockKey);
        return { success: false, error: 'Already entered' };
      }

      
      const query = {
        messageId,
        status: 'active',
        endTime: { $gt: new Date() },
        ...(giveaway.settings.allowMultipleEntries ? {} : { 'entries.userId': { $ne: userId } })
      };

      const update = giveaway.settings.allowMultipleEntries
        ? {
            $push: { entries: { userId, username, joinedAt: new Date() } },
            $set: { 'metadata.lastUpdated': new Date() },
            $inc: { 'metadata.totalEntries': 1 }
          }
        : {
            $push: { entries: { userId, username, joinedAt: new Date() } },
            $set: { 'metadata.lastUpdated': new Date() },
            $inc: { 'metadata.totalEntries': 1 }
          };

      const updatedGiveaway = await Giveaway.findOneAndUpdate(
        query,
        update,
        { returnDocument: 'after' }
      );

      if (!updatedGiveaway) {
        PROCESSING_GIVEAWAYS.delete(lockKey);
        const latestGiveaway = await Giveaway.findOne({ messageId });
        if (!latestGiveaway) {
          return { success: false, error: 'Giveaway not found' };
        }
        if (latestGiveaway.status !== 'active' || latestGiveaway.endTime <= new Date()) {
          return { success: false, error: 'Giveaway has ended' };
        }
        if (!giveaway.settings.allowMultipleEntries && latestGiveaway.entries.some(entry => entry.userId === userId)) {
          return { success: false, error: 'Already entered' };
        }
        return { success: false, error: 'Failed to update giveaway' };
      }

      invalidateGiveaway(messageId);
      
      
      if (client) {
        await this.updateGiveawayMessage(client, updatedGiveaway);
      }

      PROCESSING_GIVEAWAYS.delete(lockKey);
      return { success: true, giveaway: updatedGiveaway };
    } catch (error) {
      console.error('[GiveawayController] Error adding participant:', error);
      PROCESSING_GIVEAWAYS.delete(lockKey);
      return { success: false, error: error.message };
    }
  }

  
  static async removeParticipant(messageId, userId, client) {
    try {
      const giveaway = await Giveaway.findOne({ messageId });
      if (!giveaway) {
        return { success: false, error: 'Giveaway not found' };
      }

      await giveaway.removeEntry(userId);
      
      
      invalidateGiveaway(messageId);
      
      
      if (client) {
        await this.updateGiveawayMessage(client, giveaway);
      }

      return { success: true, giveaway };
    } catch (error) {
      console.error('[GiveawayController] Error removing participant:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async endGiveaway(messageId, client) {
    try {
      
      
      const claimedGiveaway = await Giveaway.findOneAndUpdate(
        { messageId, status: { $in: ['active', 'paused'] } },
        {
          $set: { status: 'ended', 'metadata.lastUpdated': new Date() },
          $inc: { 'metadata.version': 1 }
        },
        { returnDocument: 'after' }
      );
      if (!claimedGiveaway) {
        return { success: false, error: 'Giveaway not found or already ended' };
      }

      const winners = claimedGiveaway.selectWinners();
      const giveaway = await Giveaway.findOneAndUpdate(
        { messageId, status: 'ended' },
        { $set: { winnersList: winners, 'metadata.lastUpdated': new Date() }, $inc: { 'metadata.version': 1 } },
        { returnDocument: 'after' }
      );
      if (!giveaway) return { success: false, error: 'Could not save giveaway winners' };

      
      invalidateGiveaway(messageId);

      
      if (client) {
        await this.updateGiveawayMessage(client, giveaway, true);
      }

      
      if (giveaway.settings.dmWinners && winners.length > 0) {
        await this.dmWinners(client, winners, giveaway).catch(err => {
          console.error('[GiveawayController] Error sending DMs:', err);
        });
      }

      return { success: true, giveaway, winners };
    } catch (error) {
      console.error('[GiveawayController] Error ending giveaway:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async rerollWinners(messageId, count, client) {
    try {
      const giveaway = await Giveaway.findOne({ messageId });
      if (!giveaway) {
        return { success: false, error: 'Giveaway not found' };
      }

      const winners = giveaway.selectWinners(count || giveaway.winners);
      await giveaway.save();

      
      invalidateGiveaway(messageId);

      
      if (client) {
        await this.updateGiveawayMessage(client, giveaway, true);
      }

      if (giveaway.settings.dmWinners && winners.length > 0) {
        await this.dmWinners(client, winners, giveaway).catch(err => {
          console.error('[GiveawayController] Error sending DMs:', err);
        });
      }

      return { success: true, winners, giveaway };
    } catch (error) {
      console.error('[GiveawayController] Error rerolling winners:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async getGuildGiveaways(guildId, status = null) {
    try {
      const query = { guildId };
      if (status) query.status = status;
      
      const giveaways = await Giveaway.find(query)
        .sort({ createdAt: -1 })
        .limit(50);
      
      return { success: true, giveaways };
    } catch (error) {
      console.error('Error fetching guild giveaways:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async getExpiredGiveaways() {
    try {
      const giveaways = await Giveaway.findExpiredGiveaways();
      return { success: true, giveaways };
    } catch (error) {
      console.error('Error fetching expired giveaways:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async clearParticipants(messageId, client) {
    try {
      const giveaway = await Giveaway.findOneAndUpdate(
        { messageId },
        { 
          $set: { 
            entries: [],
            'metadata.totalEntries': 0,
            'metadata.lastUpdated': new Date()
          }
        },
        { returnDocument: 'after' }
      );

      if (!giveaway) {
        return { success: false, error: 'Giveaway not found' };
      }

      
      invalidateGiveaway(messageId);

      
      if (client) {
        await this.updateGiveawayMessage(client, giveaway);
      }

      return { success: true, giveaway };
    } catch (error) {
      console.error('[GiveawayController] Error clearing participants:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async toggleGiveawayStatus(messageId, status, client) {
    try {
      const giveaway = await Giveaway.findOneAndUpdate(
        { messageId },
        { 
          $set: { 
            status,
            'metadata.lastUpdated': new Date()
          }
        },
        { returnDocument: 'after' }
      );

      if (!giveaway) {
        return { success: false, error: 'Giveaway not found' };
      }

      
      invalidateGiveaway(messageId);

      
      if (client) {
        await this.updateGiveawayMessage(client, giveaway);
      }

      return { success: true, giveaway };
    } catch (error) {
      console.error('[GiveawayController] Error toggling giveaway status:', error);
      return { success: false, error: error.message };
    }
  }

  
  static async validateRequirements(member, giveaway) {
    try {
      const { requirements } = giveaway;
      
      
      if (requirements.roles && requirements.roles.length > 0) {
        const hasRequiredRole = requirements.roles.some(roleId => 
          member.roles.cache.has(roleId)
        );
        if (!hasRequiredRole) {
          return { valid: false, reason: 'Missing required role' };
        }
      }

      
      if (requirements.blacklistedRoles && requirements.blacklistedRoles.length > 0) {
        const hasBlacklistedRole = requirements.blacklistedRoles.some(roleId => 
          member.roles.cache.has(roleId)
        );
        if (hasBlacklistedRole) {
          return { valid: false, reason: 'Has blacklisted role' };
        }
      }

      
      if (requirements.minAccountAge > 0) {
        const accountAge = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        if (accountAge < requirements.minAccountAge) {
          return { valid: false, reason: `Account must be at least ${requirements.minAccountAge} days old` };
        }
      }

      
      if (requirements.minServerAge > 0) {
        const serverAge = (Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24);
        if (serverAge < requirements.minServerAge) {
          return { valid: false, reason: `Must be in server for at least ${requirements.minServerAge} days` };
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating requirements:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  
  static async dmWinners(client, winners, giveaway) {
    for (const winner of winners) {
      try {
        const user = await client.users.fetch(winner.userId);
        
        const card = buildCard({
          title: lang.giveaway.announcement.dmWinnerTitle.replace('{emoji}', getEmoji('crown')),
          sections: [
            lang.giveaway.announcement.dmWinnerDesc.replace('{prize}', giveaway.prize).replace('{title}', giveaway.title),
            `${getEmoji('gift')} **Prize:** ${giveaway.prize}\n${getEmoji('sparkles')} **Giveaway:** ${giveaway.title}`
          ],
          accentColor: ACCENT.success,
          footer: lang.giveaway.announcement.dmWinnerFooter.replace('{time}', new Date().toLocaleTimeString())
        });

        await user.send({ 
          components: [card],
          flags: MessageFlags.IsComponentsV2 
        }).catch(() => {
          
        });
      } catch (error) {
        console.error(`[GiveawayController] Failed to DM winner ${winner.userId}:`, error);
      }
    }
  }

  
  static createGiveawayContainer(giveaway, buttons = null) {
    const statusAccents = {
      active: ACCENT.primary,
      ended: 0x4F545C,
      paused: ACCENT.warning,
      cancelled: ACCENT.danger
    };

    const sections = [
      giveaway.description || 'Enter below to participate!',
      `${getEmoji('gift')} **Prize:** ${giveaway.prize}\n${getEmoji('crown')} **Winners:** ${giveaway.winners}\n${getEmoji('groupusers')} **Entries:** ${giveaway.entries.length}\n${getEmoji('analytics')} **Status:** ${(giveaway.status || 'ACTIVE').toUpperCase()}`
    ];

    if (giveaway.status === 'active') {
      sections.push(`${getEmoji('time')} **Ends:** <t:${Math.floor(new Date(giveaway.endTime).getTime() / 1000)}:R>`);
    } else if (giveaway.status === 'ended' && giveaway.winnersList?.length > 0) {
      sections.push(`${getEmoji('crown')} **Winners:** ${giveaway.winnersList.map(w => `<@${w.userId}>`).join(', ')}`);
    } else if (giveaway.status === 'paused') {
      sections.push(`${getEmoji('warning')} **This giveaway is currently paused**`);
    }

    const rows = buttons ? [buttons] : [];

    return buildCard({
      title: `${getEmoji('gift')} **${giveaway.title}**`,
      sections,
      rows,
      accentColor: statusAccents[giveaway.status] || ACCENT.primary,
      footer: `Giveaway • ${new Date().toLocaleTimeString()}`
    });
  }

  
  static createGiveawayButtons(giveaway) {
    const buttons = [];

    if (giveaway.status === 'active') {
      buttons.push(
        btn.success(
          `giveaway_enter_${giveaway.messageId}`,
          lang.giveaway.buttons.enter.replace('{count}', giveaway.entries.length),
          'gift'
        )
      );
    } else if (giveaway.status === 'paused') {
      buttons.push(
        btn.secondary(
          `giveaway_enter_${giveaway.messageId}`,
          lang.giveaway.buttons.paused.replace('{count}', giveaway.entries.length),
          'pause',
          true
        )
      );
    } else if (giveaway.status === 'ended') {
      buttons.push(
        btn.secondary(
          `giveaway_enter_${giveaway.messageId}`,
          lang.giveaway.buttons.ended.replace('{count}', giveaway.entries.length),
          'stop',
          true
        )
      );
    }

    if (giveaway.settings?.showParticipants) {
      buttons.push(
        btn.secondary(
          `giveaway_participants_${giveaway.messageId}`,
          lang.giveaway.buttons.participants,
          'groupusers'
        )
      );
    }

    return buttons.length > 0 ? buttonRow(...buttons) : null;
  }
}

module.exports = GiveawayController;
