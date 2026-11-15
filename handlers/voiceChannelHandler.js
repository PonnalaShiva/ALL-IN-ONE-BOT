const { Client, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { VoiceChannelModel, TemporaryChannelModel, CentralizedControlModel } = require('../models/autoVoice/schema');
const setupBanners = require('../UI/banners/SetupBanners');
const cacheManager = require('../utils/cacheManager');
const { registerInteractionHandler, runWithinAcknowledgementWindow } = require('../utils/interactionRouter');

async function getVoiceChannelConfig(guildId) {
  
  const cached = cacheManager.get('voiceChannelConfig', guildId);
  if (cached !== null) {
    return cached;
  }

  try {
    const config = await VoiceChannelModel.findOne({ serverId: guildId });

    
    const result = config ? {
      voiceChannelId: config.voiceChannelId,
      managerChannelId: config.managerChannelId,
      allowedRoleIds: config.allowedRoleIds || [],
      status: config.status
    } : false;

    cacheManager.set('voiceChannelConfig', guildId, result);
    return result;
  } catch (error) {
    console.error(`[VoiceChannel] Error loading config for ${guildId}:`, error);
    
    cacheManager.set('voiceChannelConfig', guildId, false);
    return false;
  }
}

function invalidateVoiceChannelConfig(guildId) {
  cacheManager.delete('voiceChannelConfig', guildId);
}


async function loadConfig() {
  
  
}

let cleanupInterval = null;
const channelDeletionTimers = new Set();

const VOICE_CONTROL_EMOJIS = Object.freeze({
  lock: 'lock',
  unlock: 'sparkles',
  ghost: 'security',
  reveal: 'world',
  edit: 'settings',
  increaseLimit: 'tick',
  decreaseLimit: 'cross',
  info: 'help',
  disconnect: 'stop',
  bitrate: 'volume_high',
  region: 'rocket',
  transfer: 'crown'
});

const voiceControlText = (key, label, description) =>
  `${getEmoji(VOICE_CONTROL_EMOJIS[key])} **${label}** — ${description}`;

function setupIntervals(client) {
  
  let isCleaningVoice = false;
  cleanupInterval = setInterval(async () => {
    if (isCleaningVoice) return;
    isCleaningVoice = true;
    try {
      const now = Date.now();
      
      
      const tempChannels = await TemporaryChannelModel.find({ isTemporary: true });

      for (const channelData of tempChannels) {
        const guild = client.guilds.cache.get(channelData.guildId);
        if (!guild) {
          
          await TemporaryChannelModel.deleteOne({ channelId: channelData.channelId });
          continue;
        }

        try {
          const channelObj = await guild.channels.fetch(channelData.channelId);
          
          if (!channelObj) {
            
            await TemporaryChannelModel.deleteOne({ channelId: channelData.channelId });
            continue;
          }

          
          const humanMembers = channelObj.members.filter(m => !m.user.bot);
          
          
          const isOutdated = channelData.createdAt && (now - channelData.createdAt.getTime() > 6 * 60 * 60 * 1000);
          
          
          if (humanMembers.size === 0 || isOutdated) {
            const reason = humanMembers.size === 0 ? 'Channel is empty' : 'Channel exceeded 6 hour limit';
            console.log(`[VoiceChannel] Cleanup: Deleting ${channelObj.name} (${channelObj.id}) - ${reason}`);
            await channelObj.delete(reason);
            await TemporaryChannelModel.deleteOne({ channelId: channelData.channelId });
          }
        } catch (fetchError) {
          
          if (fetchError.code === 10003 || fetchError.code === 50001) {
            
            await TemporaryChannelModel.deleteOne({ channelId: channelData.channelId });
            console.log(`[VoiceChannel] Cleanup: Removed database entry for non-existent channel ${channelData.channelId}`);
          }
        }
      }
    } catch (error) {
      console.error('[VoiceChannel] Error during periodic cleanup:', error);
    } finally {
      isCleaningVoice = false;
    }
  }, 2 * 60 * 1000); 
}

const deleteChannelAfterTimeout = (client, channelId, timeout) => {
  const timer = setTimeout(async () => {
    channelDeletionTimers.delete(timer);
    try {
      const channelData = await TemporaryChannelModel.findOne({ channelId });
      if (channelData) {
        const guild = client.guilds.cache.get(channelData.guildId);
        if (!guild) return;

        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          await channel.delete();
          await TemporaryChannelModel.deleteOne({ channelId });
        }
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
    }
  }, timeout);
  timer.unref?.();
  channelDeletionTimers.add(timer);
  return timer;
};

const sendOrUpdateCentralizedEmbed = async (client, guild) => {
  const guildConfig = await getVoiceChannelConfig(guild.id);
  if (!guildConfig || !guildConfig.status) return;

  const managerChannelId = guildConfig.managerChannelId;
  const managerChannel = guild.channels.cache.get(managerChannelId);

  if (!managerChannel) {
    console.log(`Manager channel not found for guild: ${guild.id}`);
    return;
  }

  try {
    const existingControl = await CentralizedControlModel.findOne({ guildId: guild.id });


    const lang = loadLanguage(guild.id);
    const h = lang.setups?.autovoice?.handler || {};
    const managerCard = buildCard({
      title: `${getEmoji('mic')} ${h.managerTitle}`,
      tone: 'setup',
      sections: [
        h.managerDesc,
        `${getEmoji('lock')} **Privacy Controls**\n` +
          [
            voiceControlText('lock', 'Lock', 'Prevent others from joining'),
            voiceControlText('unlock', 'Unlock', 'Allow others to join'),
            voiceControlText('ghost', 'Hide', 'Make the channel invisible to others'),
            voiceControlText('reveal', 'Show', 'Make the channel visible to everyone')
          ].join('\n'),
        `${getEmoji('settings')} **Channel Settings**\n` +
          [
            voiceControlText('edit', 'Rename', 'Change the channel name or description'),
            voiceControlText('transfer', 'Transfer', 'Give ownership to another user'),
            voiceControlText('increaseLimit', 'Increase limit', 'Raise the maximum member capacity'),
            voiceControlText('bitrate', 'Bitrate', 'Adjust audio quality')
          ].join('\n'),
        `${getEmoji('security')} **Moderation Tools**\n` +
          [
            voiceControlText('disconnect', 'Disconnect', 'Remove users from your channel'),
            voiceControlText('info', 'Info', 'View detailed channel statistics'),
            voiceControlText('region', 'Region', 'Change the voice server location')
          ].join('\n')
      ],
      bannerURL: setupBanners.autovcBanner,
      _footer: h.footerNotice
    });


    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('voice_control_lock_channel')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.lock))
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('voice_control_unlock_channel')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.unlock))
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('voice_control_ghost_channel')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.ghost))
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('voice_control_reveal_channel')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.reveal))
          .setStyle(ButtonStyle.Primary)
      );


    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('voice_control_edit_channel')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.edit))
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('voice_control_increase_limit')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.increaseLimit))
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('voice_control_decrease_limit')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.decreaseLimit))
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('voice_control_view_channel_info')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.info))
          .setStyle(ButtonStyle.Success)
      );


    const row3 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('voice_control_disconnect_member')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.disconnect))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('voice_control_change_bitrate')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.bitrate))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('voice_control_change_region')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.region))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('voice_control_transfer_ownership')
          .setEmoji(getButtonEmoji(VOICE_CONTROL_EMOJIS.transfer))
          .setStyle(ButtonStyle.Secondary)
      );

    managerCard.addActionRowComponents(row1);
    managerCard.addActionRowComponents(row2);
    managerCard.addActionRowComponents(row3);

    if (existingControl) {
      try {
        const message = await managerChannel.messages.fetch(existingControl.messageId);

        
        if (message.author.id === client.user.id) {
          await message.edit({ components: [managerCard], flags: MessageFlags.IsComponentsV2 });
          console.log(`[VoiceChannel] Updated manager panel for guild ${guild.id}`);
        } else {
          
          await message.delete().catch(() => {});
          const newMessage = await managerChannel.send({ components: [managerCard], flags: MessageFlags.IsComponentsV2 });
          await CentralizedControlModel.updateOne(
            { guildId: guild.id },
            { $set: { messageId: newMessage.id } }
          );
          console.log(`[VoiceChannel] Recreated manager panel for guild ${guild.id} (old message was not from bot)`);
        }
      } catch (fetchError) {
        
        if (fetchError.code === 10008) {
          console.log(`[VoiceChannel] Manager panel was deleted for guild ${guild.id}, recreating...`);
          await CentralizedControlModel.deleteOne({ guildId: guild.id });
          const newMessage = await managerChannel.send({ components: [managerCard], flags: MessageFlags.IsComponentsV2 });
          await CentralizedControlModel.create({
            guildId: guild.id,
            messageId: newMessage.id,
          });
          console.log(`[VoiceChannel] Recreated manager panel for guild ${guild.id}`);
        } else {
          console.error(`[VoiceChannel] Error fetching message for guild ${guild.id}:`, fetchError);
        }
      }
    } else {
      
      const newMessage = await managerChannel.send({ components: [managerCard], flags: MessageFlags.IsComponentsV2 });
      await CentralizedControlModel.create({
        guildId: guild.id,
        messageId: newMessage.id,
      });
      console.log(`[VoiceChannel] Created new manager panel for guild ${guild.id}`);
    }
  } catch (error) {
    console.error(`Error handling centralized embed for guild: ${guild.id}`, error);
  }
};

const checkOutdatedCentralizedControls = async (client) => {
  try {
    const records = await CentralizedControlModel.find({});
    for (const record of records) {
      const guild = client.guilds.cache.get(record.guildId);
      if (!guild) continue;

      const guildConfig = await getVoiceChannelConfig(record.guildId);
      if (!guildConfig) continue;

      const managerChannel = guild.channels.cache.get(guildConfig.managerChannelId);
      if (!managerChannel) {
        await CentralizedControlModel.deleteOne({ guildId: record.guildId });
        continue;
      }

      try {
        await managerChannel.messages.fetch(record.messageId);
      } catch (fetchError) {
        if (fetchError.code === 10008) {
          console.error(`Message not found for guild ${record.guildId}. Removing outdated record.`);
          await CentralizedControlModel.deleteOne({ guildId: record.guildId });
          continue;
        } else {
          console.error(`Error fetching message for guild ${record.guildId}:`, fetchError);
        }
      }
    }
  } catch (error) {
    console.error('Error checking outdated centralized controls:', error);
  }
};

const handleVoiceStateUpdate = async (client, oldState, newState) => {
  
  if (newState.member.user.bot) return;
  
  
  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    const oldChannel = oldState.channel;
    
    
    const voiceChannel = await TemporaryChannelModel.findOne({ 
      channelId: oldChannel.id, 
      isTemporary: true 
    });

    if (voiceChannel) {
      
      try {
        const freshChannel = await oldChannel.guild.channels.fetch(oldChannel.id);
        
        
        const humanMembers = freshChannel.members.filter(m => !m.user.bot);
        
        if (humanMembers.size === 0) {
          console.log(`[VoiceChannel] Deleting empty temporary channel: ${oldChannel.name} (${oldChannel.id})`);
          await freshChannel.delete('Channel is empty');
          await TemporaryChannelModel.deleteOne({ channelId: oldChannel.id });
        }
      } catch (error) {
        
        if (error.code === 10003 || error.code === 50001) {
          
          await TemporaryChannelModel.deleteOne({ channelId: oldChannel.id });
          console.log(`[VoiceChannel] Cleaned up database entry for deleted/inaccessible channel ${oldChannel.id}`);
        } else {
          console.error(`[VoiceChannel] Error deleting/checking channel ${oldChannel.id}:`, error);
        }
      }
    }
  }

  
  if (oldState.channelId === newState.channelId) return;

  const guildId = newState.guild.id;
  const settings = await getVoiceChannelConfig(guildId);
  if (!settings || !settings.status) return;

  const { voiceChannelId, allowedRoleIds } = settings;
  const member = newState.member;

  
  if (newState.channelId === voiceChannelId) {

    if (allowedRoleIds && allowedRoleIds.length > 0) {
      const hasAllowedRole = member.roles.cache.some(role => allowedRoleIds.includes(role.id));
      if (!hasAllowedRole) {

        if (oldState.channelId) {
          try {
            await member.voice.setChannel(oldState.channelId);
          } catch (error) {
            await member.voice.disconnect();
          }
        } else {
          await member.voice.disconnect();
        }
        try {
          await member.send('You do not have the required role to create a voice channel.');
        } catch (dmError) {

        }
        return;
      }
    }

    try {

      const newChannel = await newState.guild.channels.create({
        name: `${member.user.username}'s channel`,
        type: ChannelType.GuildVoice,
        parent: newState.channel.parentId,
        permissionOverwrites: [
          {
            id: member.user.id,
            allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
          },
          {
            id: newState.guild.roles.everyone,
            allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });


      await member.voice.setChannel(newChannel);


      await TemporaryChannelModel.create({
        channelId: newChannel.id,
        guildId,
        userId: member.user.id,
        createdAt: new Date(),
        isTemporary: true,
        name: `${member.user.username}'s channel`,
        description: ''
      });

      console.log(`[VoiceChannel] Created temporary channel for ${member.user.tag}: ${newChannel.name} (${newChannel.id})`);

      deleteChannelAfterTimeout(client, newChannel.id, 6 * 60 * 60 * 1000);
    } catch (error) {
      console.error('[VoiceChannel] Error creating voice channel:', error);
    }
  }
};

const handleButtonInteraction = async (interaction) => {
  if (!interaction.isButton()) return;

  const PREFIX = 'voice_control_';
  if (!interaction.customId.startsWith(PREFIX)) return;

  
  const action = interaction.customId.replace(PREFIX, '');
  if (action !== 'edit_channel') {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
      
    }
  }

  const guild = interaction.guild;
  const userId = interaction.user.id;
  const lang = loadLanguage(guild.id);
  const h = lang.setups?.autovoice?.handler || {};
  const member = guild.members.cache.get(userId);
  const currentVoiceChannel = member?.voice.channel;

  
  const respond = (opts) => interaction.deferred || interaction.replied
    ? interaction.followUp(opts)
    : interaction.reply(opts);

  if (!currentVoiceChannel) {
    return respond({ content: h.mustBeInVc, flags: MessageFlags.Ephemeral });
  }

  const channelId = currentVoiceChannel.id;
  let voiceChannel;
  if (action === 'edit_channel') {
    const lookup = await runWithinAcknowledgementWindow(
      interaction,
      () => TemporaryChannelModel.findOne({ channelId }),
      'Channel details are taking too long to load. Please try again shortly.'
    );
    if (!lookup.completed) return;
    voiceChannel = lookup.value;
  } else {
    voiceChannel = await TemporaryChannelModel.findOne({ channelId });
  }

  if (!voiceChannel) {
    return respond({ content: h.notManaged, flags: MessageFlags.Ephemeral });
  }

  if (voiceChannel.userId !== userId) {
    return respond({ content: h.noPermission, flags: MessageFlags.Ephemeral });
  }

  try {

    switch (action) {
      case 'lock_channel':
        await currentVoiceChannel.permissionOverwrites.edit(
          guild.roles.everyone,
          { Connect: false }
        );
        await interaction.followUp({ content: h.channelLocked, flags: MessageFlags.Ephemeral });
        break;

      case 'unlock_channel':
        await currentVoiceChannel.permissionOverwrites.edit(
          guild.roles.everyone,
          { Connect: true }
        );
        await interaction.followUp({ content: h.channelUnlocked, flags: MessageFlags.Ephemeral });
        break;

      case 'ghost_channel':
        await currentVoiceChannel.permissionOverwrites.edit(
          guild.roles.everyone,
          { ViewChannel: false }
        );
        await interaction.followUp({ content: h.channelGhosted, flags: MessageFlags.Ephemeral });
        break;

      case 'reveal_channel':
        await currentVoiceChannel.permissionOverwrites.edit(
          guild.roles.everyone,
          { ViewChannel: true }
        );
        await interaction.followUp({ content: h.channelRevealed, flags: MessageFlags.Ephemeral });
        break;

      case 'edit_channel':
        const modal = new ModalBuilder()
          .setCustomId(`edit_channel_modal_${channelId}`)
          .setTitle(h.editModalTitle);

        const nameInput = new TextInputBuilder()
          .setCustomId('channel_name')
          .setLabel(h.channelNameInputLabel)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(h.channelNamePlaceholder)
          .setValue(currentVoiceChannel.name)
          .setRequired(true)
          .setMaxLength(100);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('channel_description')
          .setLabel(h.channelDescInputLabel)
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder(h.channelDescPlaceholder)
          .setValue(voiceChannel.description || '')
          .setRequired(false)
          .setMaxLength(1000);

        const nameActionRow = new ActionRowBuilder().addComponents(nameInput);
        const descActionRow = new ActionRowBuilder().addComponents(descriptionInput);

        modal.addComponents(nameActionRow, descActionRow);
        await interaction.showModal(modal);
        break;

      case 'disconnect_member':
        if (currentVoiceChannel.members.size <= 1) {
          return interaction.followUp({ content: h.noOtherMembersDisconnect, flags: MessageFlags.Ephemeral });
        }

        const memberOptions = Array.from(currentVoiceChannel.members.values())
          .filter(m => m.id !== userId)
          .slice(0, 25)
          .map(m => ({
            label: m.user.username,
            value: m.id
          }));

        
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`disconnect_select_${channelId}`)
            .setPlaceholder(h.selectMemberDisconnectPlaceholder)
            .addOptions(memberOptions)
        );

        await interaction.followUp({
          content: h.selectMemberDisconnectPrompt,
          components: [row],
          flags: MessageFlags.Ephemeral
        });
        break;

      case 'view_channel_info':
        const langInfo = loadLanguage(guild.id);
        const hInfo = langInfo.setups?.autovoice?.handler || {};
        const creationTime = new Date(voiceChannel.createdAt).toLocaleString();
        const userLimit = currentVoiceChannel.userLimit === 0 ? (hInfo.noLimit) : currentVoiceChannel.userLimit;
        const memberCount = currentVoiceChannel.members.size;
        const owner = guild.members.cache.get(voiceChannel.userId)?.user.username || hInfo.unknownOwner;

        const infoCard = buildCard({
          title: `${getEmoji('analytics')} ${hInfo.infoTitle}`,
          tone: 'info',
          sections: [
            `**${hInfo.channelNameLabel}:** ${currentVoiceChannel.name}\n**${hInfo.channelIdLabel}:** \`${channelId}\`\n**${hInfo.ownerLabel}:** ${owner}`,
            `**${hInfo.createdAtLabel}:** ${creationTime}\n**${hInfo.memberCountLabel}:** ${memberCount}\n**${hInfo.userLimitLabel}:** ${userLimit}`,
            `**${hInfo.descriptionLabel}:** ${voiceChannel.description || (hInfo.noDesc)}`
          ]
        });

        await interaction.followUp({ components: [infoCard], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        break;

      case 'increase_limit':
        if (currentVoiceChannel.userLimit < 99) {
          const newLimit = currentVoiceChannel.userLimit === 0 ? 2 : currentVoiceChannel.userLimit + 1;
          await currentVoiceChannel.setUserLimit(newLimit);
          await interaction.followUp({ content: h.limitIncreased.replace('{limit}', newLimit), flags: MessageFlags.Ephemeral });
        } else {
          await interaction.followUp({ content: h.maxLimitReached, flags: MessageFlags.Ephemeral });
        }
        break;

      case 'decrease_limit':
        if (currentVoiceChannel.userLimit > 0) {
          const newLimit = currentVoiceChannel.userLimit - 1;
          await currentVoiceChannel.setUserLimit(newLimit);
          const limitMsg = newLimit === 0 ? 'removed (unlimited)' : `decreased to ${newLimit}`;
          await interaction.followUp({ content: `User limit ${limitMsg}.`, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.followUp({ content: h.limitUnlimited, flags: MessageFlags.Ephemeral });
        }
        break;

      case 'change_bitrate':
        const bitrateOptions = [
          { label: '8 kbps', value: '8000' },
          { label: '16 kbps', value: '16000' },
          { label: '32 kbps', value: '32000' },
          { label: '64 kbps', value: '64000' },
          { label: '96 kbps', value: '96000' },
          { label: '128 kbps', value: '128000' }
        ];

        const bitrateRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`set_bitrate_${channelId}`)
            .setPlaceholder(h.selectBitratePlaceholder)
            .addOptions(bitrateOptions)
        );

        await interaction.followUp({
          content: h.selectBitratePrompt,
          components: [bitrateRow],
          flags: MessageFlags.Ephemeral
        });
        break;

      case 'change_region':
        const regionOptions = [
          { label: 'Automatic', value: 'auto' },
          { label: 'Brazil', value: 'brazil' },
          { label: 'Europe', value: 'europe' },
          { label: 'Hong Kong', value: 'hongkong' },
          { label: 'India', value: 'india' },
          { label: 'Japan', value: 'japan' },
          { label: 'Russia', value: 'russia' },
          { label: 'Singapore', value: 'singapore' },
          { label: 'South Africa', value: 'southafrica' },
          { label: 'Sydney', value: 'sydney' },
          { label: 'US Central', value: 'us-central' },
          { label: 'US East', value: 'us-east' },
          { label: 'US South', value: 'us-south' },
          { label: 'US West', value: 'us-west' }
        ];

        const regionRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`set_region_${channelId}`)
            .setPlaceholder(h.selectRegionPlaceholder)
            .addOptions(regionOptions)
        );

        await interaction.followUp({
          content: h.selectRegionPrompt,
          components: [regionRow],
          flags: MessageFlags.Ephemeral
        });
        break;

      case 'transfer_ownership':
        if (currentVoiceChannel.members.size <= 1) {
          return interaction.followUp({ content: h.noOtherMembersTransfer, flags: MessageFlags.Ephemeral });
        }

        const ownerOptions = Array.from(currentVoiceChannel.members.values())
          .filter(m => m.id !== userId)
          .slice(0, 25)
          .map(m => ({
            label: m.user.username,
            value: m.id
          }));

        const ownerRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`transfer_to_${channelId}`)
            .setPlaceholder(h.selectOwnerPlaceholder)
            .addOptions(ownerOptions)
        );

        await interaction.followUp({
          content: h.selectOwnerPrompt,
          components: [ownerRow],
          flags: MessageFlags.Ephemeral
        });
        break;

      default:
      
    }
  } catch (error) {
    console.error('[VoiceChannel] Error handling button interaction:', error);
    try {
      await interaction.followUp({ content: h.processError, flags: MessageFlags.Ephemeral });
    } catch (err) {
      
    }
  }
};

async function resolveOwnedTemporaryChannel(interaction, channelId) {
  const guild = interaction.guild;
  if (!guild || !channelId) return { status: 'missing' };

  const [temporaryChannel, channel, member] = await Promise.all([
    TemporaryChannelModel.findOne({ channelId, guildId: guild.id, isTemporary: true }),
    guild.channels.cache.get(channelId) || guild.channels.fetch(channelId).catch(() => null),
    guild.members.cache.get(interaction.user.id) || guild.members.fetch(interaction.user.id).catch(() => null)
  ]);

  if (!temporaryChannel || !channel) return { status: 'missing' };
  if (temporaryChannel.userId !== interaction.user.id || member?.voice?.channelId !== channelId) {
    return { status: 'forbidden' };
  }

  return { status: 'ok', temporaryChannel, channel, member };
}

const handleModalSubmit = async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  const lang = loadLanguage(interaction.guild.id);
  const h = lang.setups?.autovoice?.handler || {};

  if (interaction.customId.startsWith('edit_channel_modal_')) {
    
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
      
    }

    const channelId = interaction.customId.replace('edit_channel_modal_', '');
    const newName = interaction.fields.getTextInputValue('channel_name');
    const newDescription = interaction.fields.getTextInputValue('channel_description');

    try {
      const owned = await resolveOwnedTemporaryChannel(interaction, channelId);
      if (owned.status === 'missing') {
        return interaction.editReply({ content: h.channelNotFound });
      }
      if (owned.status === 'forbidden') {
        return interaction.editReply({ content: h.noPermission });
      }

      await owned.channel.setName(newName);
      await TemporaryChannelModel.updateOne(
        { channelId, guildId: interaction.guild.id, userId: interaction.user.id },
        { $set: { name: newName, description: newDescription } }
      );

      await interaction.editReply({ content: h.updatedNameDesc });
    } catch (error) {
      console.error('[VoiceChannel] Error updating channel:', error);
      await interaction.editReply({ content: h.updateChannelError }).catch(() => {});
    }
  }
};


const handleSelectMenu = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  const lang = loadLanguage(interaction.guild.id);
  const h = lang.setups?.autovoice?.handler || {};

  const validPrefixes = ['disconnect_select_', 'set_bitrate_', 'set_region_', 'transfer_to_'];
  if (!validPrefixes.some(prefix => interaction.customId.startsWith(prefix))) return;

  
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (err) {
    
  }

  const matchedPrefix = validPrefixes.find(prefix => interaction.customId.startsWith(prefix));
  const channelId = interaction.customId.slice(matchedPrefix.length);
  const owned = await resolveOwnedTemporaryChannel(interaction, channelId).catch(error => {
    console.error('[VoiceChannel] Could not verify temporary channel ownership:', error);
    return { status: 'error' };
  });
  if (owned.status !== 'ok') {
    return interaction.editReply({ content: owned.status === 'missing' ? h.channelNotFound : h.noPermission });
  }

  if (interaction.customId.startsWith('disconnect_select_')) {
    const selectedUserId = interaction.values[0];

    try {
      const channel = owned.channel;

      const memberToDisconnect = channel.members.get(selectedUserId);
      if (!memberToDisconnect) {
        return interaction.editReply({ content: h.memberNotFound });
      }

      await memberToDisconnect.voice.disconnect();
      await interaction.editReply({ content: h.disconnectedMember.replace('{user}', memberToDisconnect.user.username) });
    } catch (error) {
      console.error('[VoiceChannel] Error disconnecting member:', error);
      await interaction.editReply({ content: h.memberDisconnectError }).catch(() => {});
    }
    return;
  }

  if (interaction.customId.startsWith('set_bitrate_')) {
    const channel = owned.channel;
    const bitrate = Number(interaction.values[0]);

    if (![8000, 16000, 32000, 64000, 96000, 128000].includes(bitrate)) {
      return interaction.editReply({ content: h.bitrateError });
    }

    try {
      await channel.setBitrate(bitrate);
      return interaction.editReply({ content: h.bitrateSet.replace('{bitrate}', bitrate / 1000) });
    } catch (error) {
      console.error('[VoiceChannel] Error setting bitrate:', error);
      return interaction.editReply({ content: h.bitrateError });
    }
  }

  if (interaction.customId.startsWith('set_region_')) {
    const channel = owned.channel;
    const region = interaction.values[0];
    const validRegions = ['auto', 'brazil', 'europe', 'hongkong', 'india', 'japan', 'russia', 'singapore', 'southafrica', 'sydney', 'us-central', 'us-east', 'us-south', 'us-west'];

    if (!validRegions.includes(region)) {
      return interaction.editReply({ content: h.regionError });
    }

    try {
      await channel.setRTCRegion(region === 'auto' ? null : region);
      return interaction.editReply({ content: h.regionSet.replace('{region}', region === 'auto' ? h.regionAutomatic : region) });
    } catch (error) {
      console.error('[VoiceChannel] Error setting region:', error);
      return interaction.editReply({ content: h.regionError });
    }
  }

  if (interaction.customId.startsWith('transfer_to_')) {
    const channelId = interaction.customId.slice('transfer_to_'.length);
    const newOwnerId = interaction.values[0];
    const channel = owned.channel;
    if (newOwnerId === interaction.user.id) {
      return interaction.editReply({ content: h.noOtherMembersTransfer });
    }

    const newOwner = channel.members.get(newOwnerId);
    if (!newOwner) {
      return interaction.editReply({ content: h.memberNotFound });
    }

    const ownershipChanged = await TemporaryChannelModel.findOneAndUpdate(
      { channelId, guildId: interaction.guild.id, userId: interaction.user.id, isTemporary: true },
      { $set: { userId: newOwnerId } },
      { returnDocument: 'after' }
    );
    if (!ownershipChanged) {
      return interaction.editReply({ content: h.noPermission });
    }

    try {
      await channel.permissionOverwrites.edit(
        interaction.user.id,
        { ManageChannels: false }
      );

      await channel.permissionOverwrites.edit(
        newOwnerId,
        { ManageChannels: true, Connect: true, Speak: true }
      );

      return interaction.editReply({ content: `Channel ownership transferred to ${newOwner.user.username}.` });
    } catch (error) {
      console.error('[VoiceChannel] Error transferring ownership:', error);
      await channel.permissionOverwrites.edit(
        interaction.user.id,
        { ManageChannels: true, Connect: true, Speak: true }
      ).catch(rollbackError => console.error('[VoiceChannel] Failed to restore channel owner permissions:', rollbackError));
      await channel.permissionOverwrites.edit(newOwnerId, { ManageChannels: false }).catch(() => {});
      await TemporaryChannelModel.updateOne(
        { channelId, guildId: interaction.guild.id, userId: newOwnerId, isTemporary: true },
        { $set: { userId: interaction.user.id } }
      ).catch(rollbackError => console.error('[VoiceChannel] Failed to restore temporary channel ownership:', rollbackError));
      return interaction.editReply({ content: 'An error occurred while transferring ownership.' });
    }
  }
};


module.exports = (client) => {
  let stopped = false;
  const readyListener = async () => {
    if (stopped) return;
    try {
      await checkOutdatedCentralizedControls(client);
      
      const guilds = client.guilds.cache;
      for (const guild of guilds.values()) {
        const config = await getVoiceChannelConfig(guild.id);
        if (config && config.status) {
          await sendOrUpdateCentralizedEmbed(client, guild).catch(err => {
            console.error(`[VoiceChannel] Error sending embed for ${guild.id}:`, err);
          });
        }
      }
      console.log('[VoiceChannel] Voice channel handler initialized');
    } catch (error) {
      console.error('[VoiceChannel] Error during ready event:', error);
    }
  };
  const voiceStateListener = (oldState, newState) => {
    if (stopped) return;
    handleVoiceStateUpdate(client, oldState, newState).catch(err => {
      console.error('[VoiceChannel] Error in voiceStateUpdate:', err);
    });
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    unregisterInteractionRoute?.();
    client.off('clientReady', readyListener);
    client.off('voiceStateUpdate', voiceStateListener);
    client.off('shardDisconnect', shardDisconnectListener);
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    for (const timer of channelDeletionTimers) clearTimeout(timer);
    channelDeletionTimers.clear();
  };

  const shardDisconnectListener = () => stop();

  setupIntervals(client);

  client.once('clientReady', readyListener);
  client.on('voiceStateUpdate', voiceStateListener);

  const unregisterInteractionRoute = registerInteractionHandler(client, {
    name: 'temporary-voice-controls',
    prefixes: ['voice_control_', 'edit_channel_modal_', 'disconnect_select_', 'set_bitrate_', 'set_region_', 'transfer_to_'],
    types: ['button', 'modal', 'stringSelect'],
    handler: async (interaction) => {
      if (interaction.isButton()) await handleButtonInteraction(interaction);
      else if (interaction.isModalSubmit()) await handleModalSubmit(interaction);
      else if (interaction.isStringSelectMenu()) await handleSelectMenu(interaction);
    }
  });

  
  client.once('shardDisconnect', shardDisconnectListener);

  return { stop };
};

module.exports.loadConfig = loadConfig; 
module.exports.sendOrUpdateCentralizedEmbed = sendOrUpdateCentralizedEmbed;
module.exports.getVoiceChannelConfig = getVoiceChannelConfig;
module.exports.invalidateVoiceChannelConfig = invalidateVoiceChannelConfig;
