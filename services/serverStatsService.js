const { ChannelType, PermissionsBitField } = require('discord.js');
const ServerStats = require('../models/serverstats/Schema');
const { invalidateServerStatsConfig } = require('../utils/cacheHelpers'); 

class ServerStatsService {
  constructor(client) {
    this.client = client;
    this.updateQueue = new Map();
    this.rateLimitedChannels = new Set();
    this.isUpdating = false;
  }

  async fetchServerStatistics(guild) {
    try {
     
      const [members, channels, roles] = await Promise.all([
        guild.members.fetch({ force: false, cache: true }).catch(() => guild.members.cache),
        guild.channels.fetch({ force: false, cache: true }).catch(() => guild.channels.cache),
        guild.roles.fetch({ force: false, cache: true }).catch(() => guild.roles.cache)
      ]);

      const stats = {
        all: members.size,
        members: members.filter(m => !m.user.bot).size,
        bots: members.filter(m => m.user.bot).size,
        textChannels: channels.filter(ch => ch.type === ChannelType.GuildText).size,
        voiceChannels: channels.filter(ch => ch.type === ChannelType.GuildVoice).size,
        categories: channels.filter(ch => ch.type === ChannelType.GuildCategory).size,
        roles: roles.size - 1, 
        date: this.formatDate(guild.preferredLocale || 'en-US'),
        timestamp: Date.now()
      };

      return stats;
    } catch (error) {
      console.error(`[StatsService] Failed to fetch stats for guild ${guild.id}:`, error);
      return null;
    }
  }

  formatDate(locale = 'en-US') {
    const date = new Date();
    const day = date.getDate();
    
    const ordinal = (d) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    const month = date.toLocaleString(locale, { month: 'long' });
    const weekday = date.toLocaleString(locale, { weekday: 'short' });
    
    return `${day}${ordinal(day)} ${month} (${weekday})`;
  }

  async createStatsChannel(guild, options) {
    const {
      type,
      nameFormat,
      categoryId = null,
      initialValue = 0
    } = options;

    try {
      const channelName = nameFormat.replace('{count}', initialValue);
      
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
          }
        ],
        reason: `Server stats channel for ${type}`
      });

    
      await channel.setPosition(0).catch(console.warn);

      return channel;
    } catch (error) {
      console.error(`[StatsService] Failed to create channel for ${type}:`, error);
      throw error;
    }
  }

  async updateStatsChannel(guild, statsChannel, statsData) {
    try {
      const { channelId, type, nameFormat } = statsChannel;
      
      
      if (this.rateLimitedChannels.has(channelId)) {
        return false;
      }

      const currentValue = statsData[type];
      if (currentValue === undefined) {
        console.warn(`[StatsService] No data for stat type: ${type}`);
        return false;
      }

  
      if (statsChannel.lastValue === currentValue) {
        return true; 
      }

  
      let channel = guild.channels.cache.get(channelId);
      if (!channel) {
        try {
          channel = await guild.channels.fetch(channelId);
        } catch (error) {
          
          await this.removeStatsChannel(guild.id, channelId);
          return false;
        }
      }

     
      const botMember = guild.members.cache.get(this.client.user.id);
      if (!channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ManageChannels)) {
        
        return false;
      }

   
      const newName = nameFormat.replace('{count}', currentValue);
      if (channel.name !== newName) {
        await channel.setName(newName);
        
      }

      
      await this.updateChannelValue(guild.id, channelId, currentValue);
      
      return true;
    } catch (error) {
      if (error.code === 50013) {
        
      } else if (error.code === 30013 || error.message?.includes('rate limit')) {
       
        this.rateLimitedChannels.add(statsChannel.channelId);
       
        setTimeout(() => {
          this.rateLimitedChannels.delete(statsChannel.channelId);
        }, 10 * 60 * 1000);
      } else {
       
      }
      return false;
    }
  }

  async updateGuildStats(guild) {
    try {
      const serverStats = await ServerStats.findByGuildId(guild.id);
      if (!serverStats || !serverStats.activeStatsChannels.length) {
        return { success: true, updated: 0, message: 'No active stats channels' };
      }

      const statsData = await this.fetchServerStatistics(guild);
      if (!statsData) {
        return { success: false, error: 'Failed to fetch server statistics' };
      }

      let successCount = 0;
      let failCount = 0;

   
      for (const statsChannel of serverStats.activeStatsChannels) {
        const success = await this.updateStatsChannel(guild, statsChannel, statsData);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }

       
        if (serverStats.activeStatsChannels.length > 1) {
          await this.sleep(1000);
        }
      }

  
      serverStats.statistics.totalUpdates += successCount;
      serverStats.statistics.lastFullUpdate = new Date();
      if (failCount > 0) {
        serverStats.statistics.failedUpdates += failCount;
      }
      await serverStats.save();
      invalidateServerStatsConfig(guild.id);

      return {
        success: true,
        updated: successCount,
        failed: failCount,
        total: serverStats.activeStatsChannels.length
      };
    } catch (error) {
      console.error(`[StatsService] Failed to update guild stats for ${guild.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  async setupStatsChannels(guild, statsTypes, options = {}) {
    const {
      categoryId = null,
      customFormats = {},
      active = true
    } = options;

    const results = {
      created: [],
      updated: [],
      errors: [],
      channels: []
    };

    try {

      let serverStats = await ServerStats.findByGuildId(guild.id);
      if (!serverStats) {
        serverStats = new ServerStats({
          guildId: guild.id,
          guildName: guild.name,
          statsChannels: []
        });
      }

     
      const currentStats = await this.fetchServerStatistics(guild);
      
      for (const statType of statsTypes) {
        try {
          const defaultFormats = {
            members: "👥 Members: {count}",
            bots: "🤖 Bots: {count}",
            textChannels: "💬 Text Channels: {count}",
            voiceChannels: "🔊 Voice Channels: {count}",
            categories: "📁 Categories: {count}",
            roles: "🏷️ Roles: {count}",
            date: "📅 Date: {count}",
            all: "📊 Total Members: {count}"
          };

          const nameFormat = customFormats[statType] || defaultFormats[statType] || `${statType}: {count}`;
          const initialValue = currentStats?.[statType] || 0;

      
          const existingChannelIndex = serverStats.statsChannels.findIndex(
            ch => ch.type === statType
          );

          if (existingChannelIndex !== -1) {
        
            const existingChannel = serverStats.statsChannels[existingChannelIndex];
            
            if (active) {
           
              existingChannel.nameFormat = nameFormat;
              existingChannel.categoryId = categoryId;
              existingChannel.active = active;
              existingChannel.lastUpdatedAt = new Date();
              results.updated.push(statType);
            } else {
            
              const discordChannel = guild.channels.cache.get(existingChannel.channelId);
              if (discordChannel) {
                await discordChannel.delete();
              }
              serverStats.statsChannels.splice(existingChannelIndex, 1);
              results.updated.push(`${statType} (deleted)`);
            }
          } else if (active) {
         
            const channel = await this.createStatsChannel(guild, {
              type: statType,
              nameFormat,
              categoryId,
              initialValue
            });

            serverStats.statsChannels.push({
              type: statType,
              channelId: channel.id,
              channelName: channel.name,
              nameFormat,
              categoryId,
              active: true,
              lastValue: initialValue,
              createdAt: new Date()
            });

            results.created.push(statType);
            results.channels.push(channel);
          }
        } catch (error) {
          console.error(`[StatsService] Error setting up ${statType}:`, error);
          results.errors.push({ type: statType, error: error.message });
        }
      }

      await serverStats.save();
      invalidateServerStatsConfig(guild.id);
      return results;
    } catch (error) {
      
      throw error;
    }
  }

  async removeStatsChannel(guildId, channelId) {
    try {
      const serverStats = await ServerStats.findByGuildId(guildId);
      if (serverStats) {
        await serverStats.removeStatsChannel(channelId);
        invalidateServerStatsConfig(guildId);
      }
    } catch (error) {
     
    }
  }

  async updateChannelValue(guildId, channelId, value) {
    try {
      const serverStats = await ServerStats.findByGuildId(guildId);
      if (serverStats) {
        await serverStats.updateChannelValue(channelId, value);
        invalidateServerStatsConfig(guildId);
      }
    } catch (error) {
    
    }
  }

  startStatsUpdater() {
    if (this._updateInterval) return;
    this._initialTimeout = setTimeout(() => {
      this.runStatsUpdate();
    }, 10000);
    if (this._initialTimeout?.unref) this._initialTimeout.unref();

    this._updateInterval = setInterval(() => {
      this.runStatsUpdate();
    }, 10 * 60 * 1000);
    if (this._updateInterval?.unref) this._updateInterval.unref();
  }

  stop() {
    if (this._initialTimeout) {
      clearTimeout(this._initialTimeout);
      this._initialTimeout = null;
    }
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }

  async runStatsUpdate() {
    if (this.isUpdating) {
     
      return;
    }

    this.isUpdating = true;
   
    
    try {
      const activeGuilds = await ServerStats.findActiveGuilds();
      

      for (const serverStats of activeGuilds) {
        const guild = this.client.guilds.cache.get(serverStats.guildId);
        if (guild) {
          await this.updateGuildStats(guild);
          await this.sleep(2000); 
        }
      }

      
    } catch (error) {
     
    } finally {
      this.isUpdating = false;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getDashboardData(guildId) {
    try {
      const serverStats = await ServerStats.findByGuildId(guildId);
      const guild = this.client.guilds.cache.get(guildId);
      
      if (!serverStats || !guild) {
        return null;
      }

      const currentStats = await this.fetchServerStatistics(guild);
      
      return {
        guild: {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL(),
          memberCount: guild.memberCount
        },
        statsChannels: serverStats.statsChannels.map(channel => ({
          ...channel.toObject(),
          currentValue: currentStats?.[channel.type] || 0
        })),
        settings: serverStats.settings,
        statistics: serverStats.statistics,
        lastUpdate: serverStats.updatedAt
      };
    } catch (error) {
      console.error(`[StatsService] Failed to get dashboard data:`, error);
      return null;
    }
  }
}

module.exports = ServerStatsService;