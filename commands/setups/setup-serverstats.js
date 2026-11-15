const { 
  SlashCommandBuilder, 
  PermissionsBitField, 
  ChannelType, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  MessageFlags 
} = require('discord.js');
const ServerStats = require('../../models/serverstats/Schema');
const ServerStatsService = require('../../services/serverStatsService');
const checkPermissions = require('../../utils/checkPermissions');
const cmdIcons = require('../../UI/icons/commandicons');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, replyEphemeral } = require('../../UI');
const { invalidateServerStatsConfig } = require('../../utils/cacheHelpers');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');

const STAT_TYPES = ['members', 'bots', 'textChannels', 'voiceChannels', 'categories', 'roles', 'date', 'all'];

const STAT_DESCRIPTIONS = {
  members: 'Human members count',
  bots: 'Bot members count',
  textChannels: 'Text channels count',
  voiceChannels: 'Voice channels count',
  categories: 'Categories count',
  roles: 'Roles count (excluding @everyone)',
  date: 'Current date',
  all: 'Total members (humans + bots)'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-serverstats')
    .setDescription('Manage server statistics channels')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    
    .addSubcommand(sub => 
      sub.setName('setup')
        .setDescription('Setup server stats channels')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Select which stat to track')
            .setRequired(true)
            .addChoices(
              { name: 'All Stats', value: 'all_types' },
              ...STAT_TYPES.map(type => ({ 
                name: `${type.charAt(0).toUpperCase() + type.slice(1)} - ${STAT_DESCRIPTIONS[type]}`, 
                value: type 
              }))
            )
        )
        .addBooleanOption(option => 
          option.setName('active')
            .setDescription('Enable or disable this stat')
            .setRequired(true)
        )
        .addChannelOption(option => 
          option.setName('category')
            .setDescription('Category to place the stats channels in')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false)
        )
        .addStringOption(option => 
          option.setName('format')
            .setDescription('Custom name format (use {count} for the value)')
            .setRequired(false)
        )
    )

    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current server stats configuration')
    )

    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a specific server stat channel')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of stat to remove')
            .setRequired(true)
            .addChoices(...STAT_TYPES.map(type => ({ name: type, value: type })))
        )
    )

    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Remove all server stats channels')
    )

    .addSubcommand(sub =>
      sub.setName('update')
        .setDescription('Force update all server stats channels')
    )

    .addSubcommand(sub =>
      sub.setName('settings')
        .setDescription('Configure server stats settings')
        .addIntegerOption(option =>
          option.setName('interval')
            .setDescription('Update interval in minutes (1-60)')
            .setMinValue(1)
            .setMaxValue(60)
            .setRequired(false)
        )
        .addBooleanOption(option => 
          option.setName('autoupdate')
            .setDescription('Enable/disable automatic updates')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('timezone')
            .setDescription('Timezone for date formatting (e.g., America/New_York)')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const statsService = new ServerStatsService(interaction.client);
    
    if (!interaction.isChatInputCommand || !interaction.isChatInputCommand()) {
      return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.serverstats.useSlash));
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    if (!await checkPermissions(interaction)) return;

    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      const card = cards.error(lang.error, lang.setups.serverstats.permissionError);
      return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }

    try {
      switch (subcommand) {
        case 'setup':
          await handleSetupCommand(interaction, statsService);
          break;
        case 'view':
          await handleViewCommand(interaction, statsService);
          break;
        case 'remove':
          await handleRemoveCommand(interaction, statsService);
          break;
        case 'clear':
          await handleClearCommand(interaction, statsService);
          break;
        case 'update':
          await handleUpdateCommand(interaction, statsService);
          break;
        case 'settings':
          await handleSettingsCommand(interaction, statsService);
          break;
        default:
          {
            const card = cards.error(lang.error, lang.setups.serverstats.unknownSubcommand);
            await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
          }
      }
    } catch (error) {
      console.error(`[ServerStatsController] Error in ${subcommand}:`, error);
      const card = cards.error(lang.error, lang.setups.serverstats.execError.replace('{error}', error.message));
      await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(console.error);
    }
  }
};

async function handleSetupCommand(interaction, statsService) {
  const type = interaction.options.getString('type');
  const active = interaction.options.getBoolean('active');
  const category = interaction.options.getChannel('category');
  const customFormat = interaction.options.getString('format');

  const statsTypes = type === 'all_types' ? STAT_TYPES : [type];
  const customFormats = {};
  
  if (customFormat && type !== 'all_types') {
    customFormats[type] = customFormat;
  }

  try {
    const results = await statsService.setupStatsChannels(
      interaction.guild,
      statsTypes,
      {
        categoryId: category?.id,
        customFormats,
        active
      }
    );

    const typeLabel = type === 'all_types' ? lang.setups.serverstats.allStats : type;
    const statusLabel = active ? lang.setups.welcome.enabled : lang.setups.welcome.disabled;
    const sections = [
      lang.setups.serverstats.setupSuccess
        .replace('{type}', typeLabel)
        .replace('{status}', statusLabel)
        .replace('{guild}', interaction.guild.name)
    ];

    if (results.created.length > 0) {
      sections.push(lang.setups.serverstats.createdChannels.replace('{list}', results.created.map(t => `• ${t}`).join('\n')));
    }

    if (results.updated.length > 0) {
      sections.push(lang.setups.serverstats.updatedChannels.replace('{list}', results.updated.map(t => `• ${t}`).join('\n')));
    }

    if (results.errors.length > 0) {
      sections.push(lang.setups.serverstats.errorsHeader.replace('{list}', results.errors.map(e => `• ${e.type}: ${e.error}`).slice(0, 5).join('\n')));
    }

    if (category) {
      sections.push(lang.setups.serverstats.categoryHeader.replace('{category}', `<#${category.id}>`));
    }

    const card = buildCard({
      title: lang.setups.serverstats.title,
      sections
    });

    
    setTimeout(() => {
      statsService.updateGuildStats(interaction.guild);
    }, 2000);

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  } catch (error) {
    throw new Error(`Failed to setup stats channels: ${error.message}`);
  }
}

async function handleViewCommand(interaction, statsService) {
  try {
    const dashboardData = await statsService.getDashboardData(interaction.guild.id);
    
    if (!dashboardData || !dashboardData.statsChannels.length) {
      const card = cards.warning(lang.warning, lang.setups.serverstats.noConfigFound);
      return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }

    const lastUpdateStr = dashboardData.lastUpdate ? dashboardData.lastUpdate.toLocaleString() : lang.setups.serverstats.never;
    const sections = [
      lang.setups.serverstats.statsTrackingHeader
        .replace('{guild}', dashboardData.guild.name)
        .replace('{time}', lastUpdateStr)
    ];

    
    const activeChannels = dashboardData.statsChannels.filter(ch => ch.active);
    if (activeChannels.length > 0) {
      const channelsList = activeChannels.map((channel) => {
        const emoji = channel.nameFormat.match(/^(\p{Emoji})/u)?.[1] || getEmoji('analytics');
        return `${emoji} **${channel.type}**: <#${channel.channelId}>\n` +
               `   Format: \`${channel.nameFormat}\`\n` +
               `   Current: ${channel.currentValue}\n` +
               `   Updated: <t:${Math.floor(new Date(channel.lastUpdatedAt).getTime() / 1000)}:R>`;
      }).join('\n\n');

      sections.push(lang.setups.serverstats.activeStatsHeader.replace('{count}', activeChannels.length).replace('{list}', channelsList));
    }

    
    const inactiveChannels = dashboardData.statsChannels.filter(ch => !ch.active);
    if (inactiveChannels.length > 0) {
      sections.push(lang.setups.serverstats.inactiveStatsHeader.replace('{count}', inactiveChannels.length).replace('{list}', inactiveChannels.map(ch => `• ${ch.type}`).join('\n')));
    }

    
    sections.push(
      lang.setups.serverstats.settingsHeader
        .replace('{autoUpdate}', dashboardData.settings.autoUpdate ? getEmoji('tick') : getEmoji('cross'))
        .replace('{interval}', Math.floor(dashboardData.settings.updateInterval / 60000))
        .replace('{total}', dashboardData.statistics.totalUpdates)
        .replace('{failed}', dashboardData.statistics.failedUpdates)
    );

    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('stats_force_update')
          .setLabel(lang.setups.serverstats.btnForceUpdate)
          .setStyle(ButtonStyle.Primary)
          .setEmoji(getButtonEmoji('refresh')),
        new ButtonBuilder()
          .setCustomId('stats_settings')
          .setLabel(lang.setups.serverstats.btnSettings)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(getButtonEmoji('settings'))
      );

    const card = buildCard({
      title: lang.setups.serverstats.configTitle,
      sections,
      rows: [row]
    });

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  } catch (error) {
    throw new Error(`Failed to fetch stats configuration: ${error.message}`);
  }
}

async function handleRemoveCommand(interaction, statsService) {
  const type = interaction.options.getString('type');

  try {
    const serverStats = await ServerStats.findByGuildId(interaction.guild.id);
    if (!serverStats) {
      const card = cards.error(lang.error, lang.setups.serverstats.noConfigToRemove);
      return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }

    const channelToRemove = serverStats.statsChannels.find(ch => ch.type === type);
    if (!channelToRemove) {
      const card = cards.error(lang.error, lang.setups.serverstats.channelNotFound.replace('{type}', type));
      return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }

    
    const discordChannel = interaction.guild.channels.cache.get(channelToRemove.channelId);
    if (discordChannel) {
      await discordChannel.delete(`Server stats channel removed by ${interaction.user.tag}`);
    }

    
    await serverStats.removeStatsChannel(channelToRemove.channelId);

    const sections = [
      lang.setups.serverstats.removeSuccess.replace('{type}', type),
      lang.setups.serverstats.removeDetails
        .replace('{type}', type)
        .replace('{channel}', discordChannel ? `#${discordChannel.name}` : lang.setups.serverstats.alreadyDeleted)
    ];

    const card = buildCard({
      title: lang.setups.serverstats.removed,
      sections
    });

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  } catch (error) {
    throw new Error(`Failed to remove stats channel: ${error.message}`);
  }
}

async function handleClearCommand(interaction, statsService) {
  try {
    const serverStats = await ServerStats.findByGuildId(interaction.guild.id);
    if (!serverStats || !serverStats.statsChannels.length) {
      const card = cards.warning(lang.warning, lang.setups.serverstats.noConfigToRemove);
      return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }

    const sections = [
      lang.setups.serverstats.confirmClearDesc.replace('{count}', serverStats.statsChannels.length),
      lang.setups.serverstats.channelsToDeleteHeader.replace('{list}', serverStats.statsChannels.map(ch => `• ${ch.type} (<#${ch.channelId}>)`).join('\n'))
    ];

    const confirmRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_clear_stats')
          .setLabel(lang.setups.serverstats.btnYesDeleteAll)
          .setStyle(ButtonStyle.Danger)
          .setEmoji(getButtonEmoji('trash')),
        new ButtonBuilder()
          .setCustomId('cancel_clear_stats')
          .setLabel(lang.setups.serverstats.btnCancel)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(getButtonEmoji('cross'))
      );

    const confirmCard = buildCard({
      title: lang.setups.serverstats.confirmClear,
      sections,
      rows: [confirmRow]
    });

    const response = await interaction.editReply({ 
      components: [confirmCard], 
      flags: MessageFlags.IsComponentsV2 
    });

    
    const filter = (i) => i.user.id === interaction.user.id;
    const collector = response.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async (buttonInteraction) => {
      try {
        await buttonInteraction.deferUpdate();
        collector.stop('handled');

        if (buttonInteraction.customId === 'confirm_clear_stats') {
          let deletedCount = 0;
          let failedCount = 0;

          for (const statsChannel of serverStats.statsChannels) {
            try {
              const discordChannel = interaction.guild.channels.cache.get(statsChannel.channelId);
              if (discordChannel) {
                await discordChannel.delete(`All stats channels cleared by ${interaction.user.tag}`);
                deletedCount++;
              }
            } catch (error) {
              console.error(`Failed to delete channel ${statsChannel.channelId}:`, error);
              failedCount++;
            }
          }

          await ServerStats.findOneAndDelete({ guildId: interaction.guild.id });
          invalidateServerStatsConfig(interaction.guild.id);

          const resultSections = [
            lang.setups.serverstats.allRemoved,
            [
              lang.setups.serverstats.deletedSummary.replace('{count}', deletedCount),
              failedCount > 0 ? lang.setups.serverstats.failedSummary.replace('{count}', failedCount) : '',
              lang.setups.serverstats.clearedDbSummary
            ].filter(Boolean).join('\n')
          ];

          const resultCard = buildCard({
            title: lang.setups.serverstats.cleared,
            sections: resultSections
          });

          await interaction.editReply({ components: [resultCard], flags: MessageFlags.IsComponentsV2 });
        } else {
          const cancelCard = cards.warning(lang.warning, lang.setups.common.cancelled);
          await interaction.editReply({ components: [cancelCard], flags: MessageFlags.IsComponentsV2 });
        }
      } catch (error) {
        console.error('[ServerStats] Clear confirmation failed:', error);
        await buttonInteraction.followUp({
          content: lang.setups.serverstats.clearFailed || 'Could not clear the server stats panel. Please try again.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch (error) {
        
      }
    });

  } catch (error) {
    throw new Error(`Failed to clear stats channels: ${error.message}`);
  }
}

async function handleUpdateCommand(interaction, statsService) {
  try {
    const updatingCard = cards.info(lang.setups.serverstats.updatingTitle, lang.setups.serverstats.updatingDesc);
    await interaction.editReply({ components: [updatingCard], flags: MessageFlags.IsComponentsV2 });

    const results = await statsService.updateGuildStats(interaction.guild);

    const resultSections = [
      lang.setups.serverstats.updateCompleted,
      lang.setups.serverstats.updateSummary
        .replace('{updated}', results.updated)
        .replace('{failed}', results.failed)
        .replace('{total}', results.total),
      lang.setups.serverstats.rateLimitNotice
    ];

    const resultCard = buildCard({
      title: lang.setups.serverstats.forceUpdate,
      sections: resultSections
    });

    await interaction.editReply({ components: [resultCard], flags: MessageFlags.IsComponentsV2 });
  } catch (error) {
    throw new Error(`Failed to update stats: ${error.message}`);
  }
}

async function handleSettingsCommand(interaction, statsService) {
  const interval = interaction.options.getInteger('interval');
  const autoUpdate = interaction.options.getBoolean('autoupdate');
  const timezone = interaction.options.getString('timezone');

  try {
    let serverStats = await ServerStats.findByGuildId(interaction.guild.id);
    if (!serverStats) {
      serverStats = new ServerStats({
        guildId: interaction.guild.id,
        guildName: interaction.guild.name,
        statsChannels: []
      });
    }

    const changes = [];

    if (interval !== null) {
      serverStats.settings.updateInterval = interval * 60000;
      changes.push(lang.setups.serverstats.intervalMinutes.replace('{interval}', interval));
    }

    if (autoUpdate !== null) {
      serverStats.settings.autoUpdate = autoUpdate;
      changes.push(lang.setups.serverstats.autoUpdateStatus.replace('{status}', autoUpdate ? lang.setups.welcome.enabled : lang.setups.welcome.disabled));
    }

    if (timezone !== null) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        serverStats.settings.timezone = timezone;
        changes.push(lang.setups.serverstats.timezoneChange.replace('{timezone}', timezone));
      } catch (error) {
        const card = cards.error(lang.error, lang.setups.serverstats.invalidTimezone.replace('{timezone}', timezone));
        return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
      }
    }

    if (changes.length === 0) {
      const card = cards.warning(lang.warning, lang.setups.serverstats.noSettingsProvided);
      return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }

    await serverStats.save();
    invalidateServerStatsConfig(interaction.guild.id);

    const sections = [
      lang.setups.serverstats.settingsUpdatedDesc,
      lang.setups.serverstats.changesMadeHeader.replace('{list}', changes.map(change => `• ${change}`).join('\n')),
      lang.setups.serverstats.currentSettingsHeader
        .replace('{autoUpdate}', serverStats.settings.autoUpdate ? getEmoji('tick') : getEmoji('cross'))
        .replace('{interval}', Math.floor(serverStats.settings.updateInterval / 60000))
        .replace('{timezone}', serverStats.settings.timezone)
        .replace('{locale}', serverStats.settings.locale)
    ];

    const card = buildCard({
      title: lang.setups.serverstats.settingsUpdatedTitle,
      sections
    });

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  } catch (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }
}
