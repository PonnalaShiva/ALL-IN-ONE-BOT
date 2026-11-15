'use strict';

const GiveawayController = require('../models/giveaway/Controller');
const { MessageFlags } = require('discord.js');
const { buildCard, cards, ACCENT, deferReply } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const lang = require('../events/loadLanguage');


const inFlightInteractions = new Set();

async function handleComponent(interaction) {
  if (!interaction.isButton()) return;

  const [action, type, messageId] = interaction.customId.split('_');
  if (action !== 'giveaway') return;

  if (interaction.replied || interaction.deferred) return;
  if (inFlightInteractions.has(interaction.id)) return;

  inFlightInteractions.add(interaction.id);
  setTimeout(() => inFlightInteractions.delete(interaction.id), 5000);

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    switch (type) {
      case 'enter':
        await handleEnterGiveaway(interaction, messageId);
        break;
      case 'participants':
        await handleViewParticipants(interaction, messageId);
        break;
    }
  } catch (error) {
    console.error('[GiveawayHandler] Error handling giveaway interaction:', error);

    try {
      const errCard = cards.danger(
        lang.giveaway?.entry?.failedTitle || 'Error',
        lang.giveaway.entry.processError
      );

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          components: [errCard],
          flags: MessageFlags.IsComponentsV2
        });
      } else {
        await interaction.reply({
          components: [errCard],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      console.error('[GiveawayHandler] Error sending error card:', replyError);
    }
  }
}

async function handleEnterGiveaway(interaction, messageId) {
  const { success, giveaway } = await GiveawayController.getGiveaway(messageId);

  if (!success || !giveaway) {
    const card = cards.danger(
      lang.giveaway.entry.notFoundTitle.replace('{emoji}', getEmoji('cross')),
      lang.giveaway.entry.notFoundDesc
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  if (!interaction.guildId || giveaway.guildId !== interaction.guildId) {
    const card = cards.danger(
      lang.giveaway.entry.notFoundTitle.replace('{emoji}', getEmoji('cross')),
      lang.giveaway.entry.notFoundDesc
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  if (giveaway.status !== 'active') {
    const card = cards.warning(
      lang.giveaway.entry.pausedTitle.replace('{emoji}', getEmoji('warning')),
      lang.giveaway.entry.pausedDesc
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  if (new Date() >= new Date(giveaway.endTime)) {
    const card = cards.info(
      lang.giveaway.entry.endedTitle.replace('{emoji}', getEmoji('time')),
      lang.giveaway.entry.endedDesc
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  
  const existingEntry = giveaway.entries.find(entry => entry.userId === interaction.user.id);
  if (existingEntry && !giveaway.settings.allowMultipleEntries) {
    const card = cards.info(
      lang.giveaway.entry.alreadyEnteredTitle.replace('{emoji}', getEmoji('tick')),
      lang.giveaway.entry.alreadyEnteredDesc
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    const card = cards.danger(
      lang.giveaway.entry.notMetTitle.replace('{emoji}', getEmoji('cross')),
      lang.giveaway.entry.memberVerifyFailed
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  const validation = await GiveawayController.validateRequirements(member, giveaway);
  if (!validation.valid) {
    const card = cards.danger(
      lang.giveaway.entry.notMetTitle.replace('{emoji}', getEmoji('cross')),
      lang.giveaway.entry.notMetDesc.replace('{reason}', validation.reason || lang.giveaway.entry.requirementsNotMet)
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  
  const addResult = await GiveawayController.addParticipant(
    messageId,
    interaction.user.id,
    interaction.user.username,
    interaction.client
  );

  if (!addResult.success) {
    const card = cards.danger(
      lang.giveaway.entry.failedTitle.replace('{emoji}', getEmoji('cross')),
      lang.giveaway.entry.failedDesc.replace('{error}', addResult.error || lang.giveaway.entry.failedDesc)
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  const successCard = buildCard({
    title: lang.giveaway.entry.successTitle.replace('{emoji}', getEmoji('gift')),
    sections: [
      lang.giveaway.entry.successDesc.replace('{prize}', addResult.giveaway.prize),
      `${getEmoji('gift')} **Prize:** ${addResult.giveaway.prize}\n${getEmoji('groupusers')} **Total Entries:** ${addResult.giveaway.entries.length}\n${getEmoji('sparkles')} **Status:** Entry registered successfully!`
    ],
    accentColor: ACCENT.success,
    footer: `Good luck! • ${new Date().toLocaleTimeString()}`
  });

  await interaction.editReply({
    components: [successCard],
    flags: MessageFlags.IsComponentsV2
  });
}

async function handleViewParticipants(interaction, messageId) {
  const { success, giveaway } = await GiveawayController.getGiveaway(messageId);

  if (!success || !giveaway) {
    const card = cards.danger(
      lang.giveaway.entry.notFoundTitle.replace('{emoji}', getEmoji('cross')),
      lang.giveaway.entry.notFoundDesc
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  if (!interaction.guildId || giveaway.guildId !== interaction.guildId) {
    const card = cards.danger(
      lang.giveaway.entry.notFoundTitle.replace('{emoji}', getEmoji('cross')),
      lang.giveaway.entry.notFoundDesc
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  if (!giveaway.settings.showParticipants) {
    const card = cards.warning(
      lang.giveaway.participants.title.replace('{emoji}', getEmoji('lock')).replace('{title}', giveaway.title),
      lang.giveaway.participants.hidden
    );
    return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  }

  let participantsList = lang.giveaway.participants.empty;

  if (giveaway.entries.length > 0) {
    const maxDisplay = 20;
    const participants = giveaway.entries
      .slice(0, maxDisplay)
      .map((entry, index) => `${index + 1}. <@${entry.userId}>`)
      .join('\n');

    participantsList = participants;

    if (giveaway.entries.length > maxDisplay) {
      participantsList += `\n\n${lang.giveaway.participants.more.replace('{count}', giveaway.entries.length - maxDisplay)}`;
    }
  }

  const card = buildCard({
    title: lang.giveaway.participants.title.replace('{emoji}', getEmoji('groupusers')).replace('{title}', giveaway.title),
    sections: [
      lang.giveaway.participants.header,
      participantsList,
      lang.giveaway.participants.summary
        .replace('{entries}', giveaway.entries.length)
        .replace('{winners}', giveaway.winners)
        .replace('{status}', (giveaway.status || 'ACTIVE').toUpperCase())
    ],
    accentColor: ACCENT.info,
    footer: `Giveaway ID: ${messageId} • ${new Date().toLocaleTimeString()}`
  });

  await interaction.editReply({
    components: [card],
    flags: MessageFlags.IsComponentsV2
  });
}

async function checkExpiredGiveaways(client) {
  try {
    const { success, giveaways } = await GiveawayController.getExpiredGiveaways();
    if (!success || !giveaways.length) return;

    for (const giveaway of giveaways) {
      try {
        const result = await GiveawayController.endGiveaway(giveaway.messageId, client);

        if (result.success) {
          const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
          if (!channel) continue;

          const winnerText = result.winners.length > 0
            ? result.winners.map(w => `<@${w.userId}>`).join(', ')
            : lang.giveaway.announcement.noWinners;

          const winnerCard = buildCard({
            title: lang.giveaway.announcement.endedTitle.replace('{emoji}', getEmoji('crown')),
            sections: [
              `**${result.giveaway.title}**`,
              `${getEmoji('gift')} ${lang.giveaway.announcement.prizeText.replace('{prize}', result.giveaway.prize)}\n${getEmoji('crown')} ${lang.giveaway.announcement.winnerText.replace('{winners}', winnerText)}`
            ],
            accentColor: ACCENT.success,
            footer: `Giveaway Concluded • ${new Date().toLocaleTimeString()}`
          });

          
          const recentMessages = await channel.messages.fetch({ limit: 5 }).catch(() => new Map());
          const hasRecentAnnouncement = Array.from(recentMessages.values()).some(msg =>
            msg.author.id === client.user.id &&
            msg.createdTimestamp > Date.now() - 5000
          );

          if (!hasRecentAnnouncement) {
            await channel.send({
              components: [winnerCard],
              flags: MessageFlags.IsComponentsV2
            }).catch(err => {
              if (err.code !== 50013) {
                console.error('[GiveawayHandler] Error sending winner announcement:', err);
              }
            });
          }
        }
      } catch (error) {
        if (error.code === 10003 || error.code === 50001 || error.code === 10008) {
          await GiveawayController.deleteGiveaway(giveaway.messageId).catch(() => {});
        } else {
          console.error(`[GiveawayHandler] Error ending giveaway ${giveaway.messageId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[GiveawayHandler] Error checking expired giveaways:', error);
  }
}

async function cleanupOldGiveaways() {
  try {
    const Giveaway = require('../models/giveaway/schema');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await Giveaway.deleteMany({
      status: 'ended',
      endTime: { $lt: thirtyDaysAgo }
    });

    if (result.deletedCount > 0) {
      console.log(`[GiveawayHandler] Cleaned up ${result.deletedCount} old ended giveaways`);
    }
  } catch (error) {
    console.error('[GiveawayHandler] Error cleaning up old giveaways:', error);
  }
}

module.exports = (client) => {
  
  let checkTimer = null;
  let cleanupTimer = null;
  let started = false;
  let isChecking = false;
  let isCleaning = false;
  const onReady = () => {
    if (started) return;
    started = true;
    checkTimer = setInterval(async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        await checkExpiredGiveaways(client);
      } finally {
        isChecking = false;
      }
    }, 10000);
    checkTimer.unref?.();

    cleanupTimer = setInterval(async () => {
      if (isCleaning) return;
      isCleaning = true;
      try {
        await cleanupOldGiveaways();
      } finally {
        isCleaning = false;
      }
    }, 3600000);
    cleanupTimer.unref?.();
  };

  const readyListener = () => onReady();
  if (client.isReady()) {
    onReady();
  } else {
    client.once('clientReady', readyListener);
  }

  return {
    stop() {
      client.off('clientReady', readyListener);
      if (checkTimer) clearInterval(checkTimer);
      if (cleanupTimer) clearInterval(cleanupTimer);
      checkTimer = null;
      cleanupTimer = null;
      started = false;
    }
  };
};


module.exports.handleComponent = handleComponent;
module.exports.checkExpiredGiveaways = checkExpiredGiveaways;
module.exports.cleanupOldGiveaways = cleanupOldGiveaways;
