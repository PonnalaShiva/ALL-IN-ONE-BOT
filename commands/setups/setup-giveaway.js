const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChannelType,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags
} = require('discord.js');
const GiveawayController = require('../../models/giveaway/Controller');
const ms = require('ms');
const checkPermissions = require('../../utils/checkPermissions');
const loadLanguage = require('../../events/loadLanguage');
const { cards, buildCard, getEmoji } = require('../../UI');
module.exports = {
data: new SlashCommandBuilder()
  .setName('setup-giveaway')
  .setDescription('Advanced giveaway management system')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('Start a new giveaway')
      .addStringOption(option => 
        option.setName('title')
          .setDescription('Giveaway title')
          .setRequired(true)
          .setMaxLength(256)
      )
      .addStringOption(option => 
        option.setName('description')
          .setDescription('Giveaway description')
          .setRequired(true)
          .setMaxLength(1024)
      )
      .addStringOption(option => 
        option.setName('prize')
          .setDescription('Prize description')
          .setRequired(true)
          .setMaxLength(512)
      )
      .addStringOption(option => 
        option.setName('duration')
          .setDescription('Duration (e.g., 1h, 2d, 1w)')
          .setRequired(true)
      )
      .addIntegerOption(option => 
        option.setName('winners')
          .setDescription('Number of winners (1-100)')
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addChannelOption(option => 
        option.setName('channel')
          .setDescription('Channel to post giveaway')
          .addChannelTypes(ChannelType.GuildText)
      )
      .addRoleOption(option => 
        option.setName('required_role')
          .setDescription('Required role to enter')
      )
      .addIntegerOption(option => 
        option.setName('min_account_age')
          .setDescription('Minimum account age in days')
          .setMinValue(0)
          .setMaxValue(365)
      )
      .addIntegerOption(option => 
        option.setName('min_server_age')
          .setDescription('Minimum server member age in days')
          .setMinValue(0)
          .setMaxValue(365)
      )
      .addBooleanOption(option => 
        option.setName('dm_winners')
          .setDescription('DM winners when they win')
      )
  )
  
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing giveaway')
      .addStringOption(option => 
        option.setName('message_id')
          .setDescription('Giveaway message ID')
          .setRequired(true)
      )
      .addStringOption(option => 
        option.setName('title')
          .setDescription('New title')
          .setMaxLength(256)
      )
      .addStringOption(option => 
        option.setName('description')
          .setDescription('New description')
          .setMaxLength(1024)
      )
      .addStringOption(option => 
        option.setName('prize')
          .setDescription('New prize')
          .setMaxLength(512)
      )
      .addStringOption(option => 
        option.setName('duration')
          .setDescription('New duration (e.g., 1h, 2d, 1w)')
      )
      .addIntegerOption(option => 
        option.setName('winners')
          .setDescription('New number of winners')
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addRoleOption(option => 
        option.setName('required_role')
          .setDescription('New required role')
      )
  )
  
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('end')
      .setDescription('End a giveaway early')
      .addStringOption(option => 
        option.setName('message_id')
          .setDescription('Giveaway message ID')
          .setRequired(true)
      )
  )
  
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('reroll')
      .setDescription('Reroll winners')
      .addStringOption(option => 
        option.setName('message_id')
          .setDescription('Giveaway message ID')
          .setRequired(true)
      )
      .addIntegerOption(option => 
        option.setName('winners')
          .setDescription('Number of winners to reroll')
          .setMinValue(1)
          .setMaxValue(100)
      )
  )
  
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all giveaways')
      .addStringOption(option => 
        option.setName('status')
          .setDescription('Filter by status')
          .addChoices(
            { name: 'Active', value: 'active' },
            { name: 'Ended', value: 'ended' },
            { name: 'Cancelled', value: 'cancelled' },
            { name: 'Paused', value: 'paused' }
          )
      )
  )
  
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a giveaway')
      .addStringOption(option => 
        option.setName('message_id')
          .setDescription('Giveaway message ID')
          .setRequired(true)
      )
  )
  
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('pause')
      .setDescription('Pause a giveaway')
      .addStringOption(option => 
        option.setName('message_id')
          .setDescription('Giveaway message ID')
          .setRequired(true)
      )
  )
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('resume')
      .setDescription('Resume a paused giveaway')
      .addStringOption(option => 
        option.setName('message_id')
          .setDescription('Giveaway message ID')
          .setRequired(true)
      )
  )
  
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('add-participant')
      .setDescription('Add a participant to giveaway')
      .addStringOption(option => 
        option.setName('message_id')
          .setDescription('Giveaway message ID')
          .setRequired(true)
      )
      .addUserOption(option => 
        option.setName('user')
          .setDescription('User to add')
          .setRequired(true)
      )
  )
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove-participant')
      .setDescription('Remove a participant from giveaway')
      .addStringOption(option => 
        option.setName('message_id')
          .setDescription('Giveaway message ID')
          .setRequired(true)
      )
      .addUserOption(option => 
        option.setName('user')
          .setDescription('User to remove')
          .setRequired(true)
      )
  )
  
  .addSubcommand(subcommand =>
    subcommand
      .setName('clear-participants')
      .setDescription('Clear all participants from giveaway')
      .addStringOption(option => 
        option.setName('message_id')
          .setDescription('Giveaway message ID')
          .setRequired(true)
      )
  ),

async execute(interaction) {
  await interaction.deferReply();
  if (!await checkPermissions(interaction)) return;
  const lang = await loadLanguage(interaction.guildId);
  const langData = lang;
  const l = lang.setups?.giveaway || {};
  const subcommand = interaction.options.getSubcommand();

  const targetMessageId = interaction.options.getString('message_id', false);
  if (targetMessageId) {
    const lookup = await GiveawayController.getGiveaway(targetMessageId);
    if (!lookup.success || !lookup.giveaway || lookup.giveaway.guildId !== interaction.guildId) {
      const unavailable = cards.error(
        'Giveaway Unavailable',
        'That giveaway does not exist in this server or is no longer available.'
      );
      return interaction.editReply({ components: [unavailable], flags: MessageFlags.IsComponentsV2 });
    }
  }
  
  try {
    switch (subcommand) {
      case 'start':
        await this.handleStart(interaction, langData);
        break;
      case 'edit':
        await this.handleEdit(interaction, langData);
        break;
      case 'end':
        await this.handleEnd(interaction, langData);
        break;
      case 'reroll':
        await this.handleReroll(interaction, langData);
        break;
      case 'list':
        await this.handleList(interaction, langData);
        break;
      case 'delete':
        await this.handleDelete(interaction, langData);
        break;
      case 'pause':
        await this.handlePause(interaction, langData);
        break;
      case 'resume':
        await this.handleResume(interaction, langData);
        break;
      case 'add-participant':
        await this.handleAddParticipant(interaction, langData);
        break;
      case 'remove-participant':
        await this.handleRemoveParticipant(interaction, langData);
        break;
      case 'clear-participants':
        await this.handleClearParticipants(interaction, langData);
        break;
      default:
        const unknownContainer = cards.error(
          langData.errorTitle || 'Unknown Command',
          l.unknownCommand || 'Unknown subcommand specified!'
        );
        await interaction.editReply({ 
          components: [unknownContainer],
          flags: MessageFlags.IsComponentsV2 
        });
    }
  } catch (error) {
    console.error('[Setup-Giveaway] Error executing giveaway command:', error);
    
    const errorContainer = cards.error(
      langData.errorTitle || 'Command Error',
      l.commandError || 'An error occurred while processing your request.'
    );

    await interaction.editReply({ 
      components: [errorContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }
},

async handleStart(interaction) {
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const prize = interaction.options.getString('prize');
  const duration = interaction.options.getString('duration');
  const winners = interaction.options.getInteger('winners') || 1;
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const requiredRole = interaction.options.getRole('required_role');
  const minAccountAge = interaction.options.getInteger('min_account_age') || 0;
  const minServerAge = interaction.options.getInteger('min_server_age') || 0;
  const dmWinners = interaction.options.getBoolean('dm_winners') ?? true;

  
  const durationMs = ms(duration);
  if (!durationMs || durationMs < 60000) { 
    const invalidDurationContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Invalid Duration\nInvalid duration! Minimum duration is 1 minute.`)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`*Examples: 30m, 1h, 2d, 1w • ${new Date().toLocaleString()}*`)
      );

    return interaction.editReply({ 
      components: [invalidDurationContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const giveawayData = {
    guildId: interaction.guild.id,
    channelId: channel.id,
    hostId: interaction.user.id,
    title,
    description,
    prize,
    duration,
    winners,
    requirements: {
      roles: requiredRole ? [requiredRole.id] : [],
      minAccountAge,
      minServerAge
    },
    settings: {
      dmWinners,
      showParticipants: true
    }
  };

  
  const tempContainer = GiveawayController.createGiveawayContainer({
    ...giveawayData,
    entries: [],
    status: 'active',
    endTime: new Date(Date.now() + durationMs)
  });

  const message = await channel.send({ 
    components: [tempContainer],
    flags: MessageFlags.IsComponentsV2
  });

  
  giveawayData.messageId = message.id;
  const result = await GiveawayController.createGiveaway(giveawayData);

  if (!result.success) {
    await message.delete();
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Creation Failed\nFailed to create giveaway: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  
  await GiveawayController.updateGiveawayMessage(interaction.client, result.giveaway);

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x00FF00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${getEmoji('tick')} Giveaway Created\nGiveaway created successfully in ${channel}!`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**${getEmoji('gift')} Prize:** ${prize}\n**${getEmoji('time')} Duration:** ${duration}\n**${getEmoji('users')} Winners:** ${winners}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*Giveaway ID: ${message.id} • ${new Date().toLocaleString()}*`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handleEdit(interaction) {
  const messageId = interaction.options.getString('message_id');
  const updates = {};
  
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const prize = interaction.options.getString('prize');
  const duration = interaction.options.getString('duration');
  const winners = interaction.options.getInteger('winners');
  const requiredRole = interaction.options.getRole('required_role');

  if (title) updates.title = title;
  if (description) updates.description = description;
  if (prize) updates.prize = prize;
  if (duration) updates.duration = duration;
  if (winners) updates.winners = winners;
  if (requiredRole) updates['requirements.roles'] = [requiredRole.id];

  
  const result = await GiveawayController.updateGiveaway(messageId, updates, interaction.client);
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Update Failed\nFailed to update giveaway: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x00FF00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${getEmoji('tick')} Giveaway Updated\nGiveaway updated and message refreshed automatically!`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*Auto-updated • ${new Date().toLocaleString()}*`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handleEnd(interaction) {
  const messageId = interaction.options.getString('message_id');
  
  const result = await GiveawayController.endGiveaway(messageId, interaction.client);
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} End Failed\nFailed to end giveaway: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  
  try {
    const channel = await interaction.client.channels.fetch(result.giveaway.channelId);

    const winnerText = result.winners.length > 0 
      ? result.winners.map(w => `<@${w.userId}>`).join(', ')
      : 'No valid entries';

    const winnerContainer = new ContainerBuilder()
      .setAccentColor(0x00FF00)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('sparkles')} Giveaway Ended!\n**${result.giveaway.title}**`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`**${getEmoji('gift')} Prize:** ${result.giveaway.prize}\n**${getEmoji('crown')} Winners:** ${winnerText}`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`*Giveaway concluded • ${new Date().toLocaleString()}*`)
      );

    
    const recentMessages = await channel.messages.fetch({ limit: 5 }).catch(() => new Map());
    const hasRecentAnnouncement = Array.from(recentMessages.values()).some(msg => 
      msg.author.id === interaction.client.user.id && 
      msg.content?.includes('Giveaway Ended') &&
      Date.now() - msg.createdTimestamp < 5000
    );

    if (!hasRecentAnnouncement) {
      await channel.send({
        components: [winnerContainer],
        flags: MessageFlags.IsComponentsV2
      }).catch(err => {
        console.error('[Setup-Giveaway] Error sending winner announcement:', err);
      });
    }
  } catch (error) {
    console.error('[Setup-Giveaway] Error sending winner announcement:', error);
  }

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x00FF00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${getEmoji('tick')} Giveaway Ended\nGiveaway ended and message updated automatically!`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handleReroll(interaction) {
  const messageId = interaction.options.getString('message_id');
  const winnerCount = interaction.options.getInteger('winners');
  
  const result = await GiveawayController.rerollWinners(
    messageId, 
    winnerCount, 
    interaction.client
  );
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Reroll Failed\nFailed to reroll winners: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const winnerText = result.winners.length > 0 
    ? result.winners.map(w => `<@${w.userId}>`).join(', ')
    : 'No valid entries';

  try {
    const channel = await interaction.client.channels.fetch(result.giveaway.channelId);
    
    const rerollContainer = new ContainerBuilder()
      .setAccentColor(0xFFFF00)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('games')} Giveaway Rerolled!\n**${result.giveaway.title}**`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`**${getEmoji('gift')} Prize:** ${result.giveaway.prize}\n**${getEmoji('crown')} New Winners:** ${winnerText}`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`*Winners rerolled • ${new Date().toLocaleString()}*`)
      );

    
    const recentMessages = await channel.messages.fetch({ limit: 5 }).catch(() => new Map());
    const hasRecentAnnouncement = Array.from(recentMessages.values()).some(msg => 
      msg.author.id === interaction.client.user.id && 
      msg.content?.includes('Giveaway Rerolled') &&
      Date.now() - msg.createdTimestamp < 5000
    );

    if (!hasRecentAnnouncement) {
      await channel.send({
        components: [rerollContainer],
        flags: MessageFlags.IsComponentsV2
      }).catch(err => {
        console.error('[Setup-Giveaway] Error sending reroll announcement:', err);
      });
    }
  } catch (error) {
    console.error('[Setup-Giveaway] Error sending reroll announcement:', error);
  }

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x00FF00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${getEmoji('tick')} Winners Rerolled\nWinners rerolled and message updated automatically!`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handleList(interaction) {
  const status = interaction.options.getString('status');
  
  const result = await GiveawayController.getGuildGiveaways(
    interaction.guild.id, 
    status
  );
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Fetch Failed\nFailed to fetch giveaways: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  if (result.giveaways.length === 0) {
    const noGiveawaysContainer = new ContainerBuilder()
      .setAccentColor(0xFFAA00)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('list')} No Giveaways\nNo giveaways found for this server.`)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`*Use /setup-giveaway start to create one • ${new Date().toLocaleString()}*`)
      );

    return interaction.editReply({ 
      components: [noGiveawaysContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const giveawayList = result.giveaways.map((g, i) => 
    `**${i + 1}.** ${g.title}\n` +
    `└ Prize: ${g.prize}\n` +
    `└ Status: ${g.status} | Entries: ${g.entries.length}\n` +
    `└ ID: \`${g.messageId}\``
  ).join('\n\n');

  const listContainer = new ContainerBuilder()
    .setAccentColor(0x7289DA)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${getEmoji('list')} Giveaways ${status ? `(${status})` : ''}\nServer giveaway overview`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(giveawayList)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*${result.giveaways.length} giveaways found • ${new Date().toLocaleString()}*`)
    );

  await interaction.editReply({ 
    components: [listContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handleDelete(interaction) {
  const messageId = interaction.options.getString('message_id');
  
  const result = await GiveawayController.deleteGiveaway(messageId);
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Delete Failed\nFailed to delete giveaway: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x00FF00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${getEmoji('tick')} Giveaway Deleted\nGiveaway deleted successfully!`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*Deleted • ${new Date().toLocaleString()}*`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handlePause(interaction) {
  const messageId = interaction.options.getString('message_id');
  
  
  const result = await GiveawayController.toggleGiveawayStatus(messageId, 'paused', interaction.client);
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Pause Failed\nFailed to pause giveaway: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const successContainer = new ContainerBuilder()
    .setAccentColor(0xFFAA00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ⏸️ Giveaway Paused\nGiveaway paused and message updated automatically!')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*Button is now disabled • ${new Date().toLocaleString()}*`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handleResume(interaction) {
  const messageId = interaction.options.getString('message_id');
  
  
  const result = await GiveawayController.toggleGiveawayStatus(messageId, 'active', interaction.client);
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Resume Failed\nFailed to resume giveaway: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x00FF00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ▶️ Giveaway Resumed\nGiveaway resumed and message updated automatically!')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*Button is now active • ${new Date().toLocaleString()}*`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handleAddParticipant(interaction) {
  const messageId = interaction.options.getString('message_id');
  const user = interaction.options.getUser('user');
  
  
  const result = await GiveawayController.addParticipant(
    messageId, 
    user.id, 
    user.username,
    interaction.client
  );
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Add Failed\nFailed to add participant: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x00FF00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${getEmoji('tick')} Participant Added\nAdded ${user.username} to the giveaway!`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**${getEmoji('analytics')} Updated Counter:** (${result.giveaway.entries.length})\n**${getEmoji('loop')} Auto-Updated:** Message refreshed automatically`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*Participant added • ${new Date().toLocaleString()}*`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handleRemoveParticipant(interaction) {
  const messageId = interaction.options.getString('message_id');
  const user = interaction.options.getUser('user');
  
  
  const result = await GiveawayController.removeParticipant(messageId, user.id, interaction.client);
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Remove Failed\nFailed to remove participant: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x00FF00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${getEmoji('tick')} Participant Removed\nRemoved ${user.username} from the giveaway!`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**${getEmoji('analytics')} Updated Counter:** (${result.giveaway.entries.length})\n**${getEmoji('loop')} Auto-Updated:** Message refreshed automatically`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*Participant removed • ${new Date().toLocaleString()}*`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

async handleClearParticipants(interaction) {
  const messageId = interaction.options.getString('message_id');
  
  
  const result = await GiveawayController.clearParticipants(messageId, interaction.client);
  
  if (!result.success) {
    const failedContainer = new ContainerBuilder()
      .setAccentColor(0xFF0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`# ${getEmoji('cross')} Clear Failed\nFailed to clear participants: ${result.error}`)
      );

    return interaction.editReply({ 
      components: [failedContainer],
      flags: MessageFlags.IsComponentsV2 
    });
  }

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x00FF00)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${getEmoji('tick')} Participants Cleared\nAll participants cleared from the giveaway!`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**${getEmoji('analytics')} Reset Counter:** (0)\n**${getEmoji('loop')} Auto-Updated:** Message refreshed automatically`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*All participants cleared • ${new Date().toLocaleString()}*`)
    );

  await interaction.editReply({ 
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2 
  });
},

handleComponent(interaction) {
  return require('../../handlers/giveawayHandler').handleComponent(interaction);
}
};
