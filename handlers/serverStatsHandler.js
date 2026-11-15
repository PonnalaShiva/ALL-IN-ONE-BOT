
const ServerStatsService = require('../services/serverStatsService');
const loadLanguage = require('../events/loadLanguage');
const { buildCard, cards } = require('../UI');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { registerInteractionHandler } = require('../utils/interactionRouter');
const checkPermissions = require('../utils/checkPermissions');

module.exports = (client) => {
  const statsService = new ServerStatsService(client);

  
  const updateQueue = new Map();
  const pendingTimers = new Set();
  const listeners = {};
  const DEBOUNCE_TIME = 10000; 

  function queueGuildUpdate(guild, reason = 'Event triggered') {
    if (!guild) return;

    const guildId = guild.id;

    
    if (updateQueue.has(guildId)) {
      clearTimeout(updateQueue.get(guildId).timeout);
    }

    
    const timeout = setTimeout(async () => {
      try {
        await statsService.updateGuildStats(guild);
        updateQueue.delete(guildId);
      } catch (error) {
        updateQueue.delete(guildId);
      }
    }, DEBOUNCE_TIME);

    if (timeout?.unref) timeout.unref();

    updateQueue.set(guildId, {
      timeout,
      reason,
      queuedAt: Date.now()
    });
  }

  
  listeners.guildMemberAdd = (member) => {
    queueGuildUpdate(member.guild, `Member joined: ${member.user?.tag || member.id}`);
  };
  client.on('guildMemberAdd', listeners.guildMemberAdd);

  listeners.guildMemberRemove = (member) => {
    queueGuildUpdate(member.guild, `Member left: ${member.user?.tag || member.id}`);
  };
  client.on('guildMemberRemove', listeners.guildMemberRemove);

  
  listeners.channelCreate = (channel) => {
    if (channel.guild) {
      queueGuildUpdate(channel.guild, `Channel created: ${channel.name}`);
    }
  };
  client.on('channelCreate', listeners.channelCreate);

  listeners.channelDelete = (channel) => {
    if (channel.guild) {
      queueGuildUpdate(channel.guild, `Channel deleted: ${channel.name}`);
    }
  };
  client.on('channelDelete', listeners.channelDelete);

  
  listeners.roleCreate = (role) => {
    queueGuildUpdate(role.guild, `Role created: ${role.name}`);
  };
  client.on('roleCreate', listeners.roleCreate);

  listeners.roleDelete = (role) => {
    queueGuildUpdate(role.guild, `Role deleted: ${role.name}`);
  };
  client.on('roleDelete', listeners.roleDelete);

  
  listeners.guildUpdate = (oldGuild, newGuild) => {
    queueGuildUpdate(newGuild, 'Guild updated');
  };
  client.on('guildUpdate', listeners.guildUpdate);

  
  listeners.guildCreate = async (guild) => {
    try {
      const timeout = setTimeout(async () => {
        pendingTimers.delete(timeout);
        await statsService.updateGuildStats(guild);
      }, 5000);
      if (timeout?.unref) timeout.unref();
      pendingTimers.add(timeout);
    } catch (error) {
      console.error(`[StatsEvents] Error handling new guild ${guild?.name}:`, error);
    }
  };
  client.on('guildCreate', listeners.guildCreate);

  
  listeners.guildDelete = async (guild) => {
    if (guild?.id && updateQueue.has(guild.id)) {
      clearTimeout(updateQueue.get(guild.id).timeout);
      updateQueue.delete(guild.id);
    }
  };
  client.on('guildDelete', listeners.guildDelete);

  
  const unregisterInteractionRoute = registerInteractionHandler(client, {
    name: 'server-stats-controls',
    prefixes: ['stats_force_update', 'stats_settings'],
    types: ['button'],
    handler: async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, guild } = interaction;
    if (!guild) return;
    if (customId !== 'stats_force_update' && customId !== 'stats_settings') return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!await checkPermissions(interaction)) return;

    if (customId === 'stats_force_update') {
      try {
        const results = await statsService.updateGuildStats(guild);
        const dashboardData = await statsService.getDashboardData(guild.id);
        const lang = loadLanguage(guild.id);
        const timestampSeconds = Math.floor(Date.now() / 1000);

        const updateNotice = lang.serverstats.handler.forceUpdatedNotice
            .replace('{time}', String(timestampSeconds))
            .replace('{updated}', String(results?.updated ?? 0))
            .replace('{total}', String(results?.total ?? 0));
        const sections = [
          `# ${getEmoji('refresh')} ${lang.serverstats.handler.updateSuccessTitle}\n\n> ${updateNotice}`
        ];

        if (dashboardData?.statsChannels?.length) {
          const activeChannels = dashboardData.statsChannels.filter(ch => ch.active);
          if (activeChannels.length > 0) {
            const list = activeChannels.map(channel => {
              const emoji = channel.nameFormat?.match(/^(\p{Emoji})/u)?.[1] || getEmoji('stats');
              return `${emoji} **${channel.type}**: <#${channel.channelId}> \`[${channel.currentValue}]\``;
            }).join('\n');
            sections.push(`### ${getEmoji('chart')} ${lang.serverstats.handler.activeChannelsHeader.replace('{count}', String(activeChannels.length))}\n${list}`);
          }
        }

        const buttonsRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('stats_force_update')
            .setLabel(lang.setups?.serverstats?.btnForceUpdate)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(getButtonEmoji('refresh')),
          new ButtonBuilder()
            .setCustomId('stats_settings')
            .setLabel(lang.setups?.serverstats?.btnSettings)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getButtonEmoji('settings'))
        );

        const card = buildCard({
          title: `${getEmoji('analytics')} ${guild.name} — ${lang.setups?.serverstats?.configTitle}`,
          sections,
          rows: [buttonsRow]
        });

        await interaction.message.edit({
          components: [card],
          flags: MessageFlags.IsComponentsV2
        });
        await interaction.editReply({ content: updateNotice });
      } catch (error) {
        console.error('[StatsEvents] Failed to force update stats:', error);
        const lang = loadLanguage(guild.id);
        const errCard = cards.error(
          lang.error,
          lang.serverstats.handler.updateError
        );
        await interaction.editReply({
          components: [errCard],
          flags: MessageFlags.IsComponentsV2
        }).catch(console.error);
      }
    }

    if (customId === 'stats_settings') {
      const lang = loadLanguage(guild.id);
      const sections = [
        `# ${getEmoji('settings')} ${lang.serverstats.handler.settingsTitle}\n\n` +
        `> ${lang.serverstats.handler.settingsDesc}`,
        `### ${getEmoji('list')} Available Settings\n${lang.serverstats.handler.availableSettings}`,
        `### ${getEmoji('sparkles')} Example Usage\n\`\`\`bash\n${lang.serverstats.handler.exampleUsage}\n\`\`\``
      ];

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('stats_force_update')
          .setLabel(lang.setups?.serverstats?.btnForceUpdate)
          .setStyle(ButtonStyle.Primary)
          .setEmoji(getButtonEmoji('refresh'))
      );

      const card = buildCard({
        title: `${getEmoji('settings')} ${guild.name} — ${lang.serverstats.handler.settingsTitle}`,
        sections,
        rows: [backRow]
      });

      await interaction.message.edit({
        components: [card],
        flags: MessageFlags.IsComponentsV2
      });
      await interaction.editReply({ content: lang.serverstats.handler.settingsDesc });
    }
    }
  });

  
  let lastDateCheck = new Date().toDateString();
  const dateCheckInterval = setInterval(() => {
    const currentDate = new Date().toDateString();
    if (currentDate !== lastDateCheck) {
      lastDateCheck = currentDate;
      client.guilds.cache.forEach(guild => {
        queueGuildUpdate(guild, 'Date changed');
      });
    }
  }, 60000);
  if (dateCheckInterval?.unref) dateCheckInterval.unref();

  
  const statusLogInterval = setInterval(() => {
    if (updateQueue.size > 0) {
      
    }
  }, 300000);
  if (statusLogInterval?.unref) statusLogInterval.unref();

  
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    for (const [eventName, listener] of Object.entries(listeners)) client.off(eventName, listener);
    client.off('clientReady', onClientReady);
    for (const [, data] of updateQueue) {
      if (data.timeout) clearTimeout(data.timeout);
    }
    updateQueue.clear();
    for (const timer of pendingTimers) clearTimeout(timer);
    pendingTimers.clear();
    if (dateCheckInterval) clearInterval(dateCheckInterval);
    if (statusLogInterval) clearInterval(statusLogInterval);
    if (statsService.stop) statsService.stop();
    unregisterInteractionRoute();
  };

  
  let cleanedUp = false;
  const onClientReady = () => statsService.startStatsUpdater();
  if (client.isReady()) {
    statsService.startStatsUpdater();
  } else {
    client.once('clientReady', onClientReady);
  }

  return {
    statsService,
    queueGuildUpdate,
    cleanup,
    stop: cleanup,
    getQueueStatus: () => ({
      pendingUpdates: updateQueue.size,
      guilds: Array.from(updateQueue.keys())
    })
  };
};
