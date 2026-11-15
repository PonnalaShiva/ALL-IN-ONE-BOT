const fs = require('fs').promises;
const fsSync = require('fs'); 
const path = require('path');
const { categories } = require('../config.js');
const { isCommandCategoryEnabled } = require('../utils/commandAvailability');
const lang = require('./loadLanguage');
const { buildCard } = require('../UI');
const {
    dispatchComponentRoute,
    dispatchInteractionObservers,
    runWithinAcknowledgementWindow,
    acknowledgeUnroutedModal
} = require('../utils/interactionRouter');
const { hasLiveComponentCollector, getCollectorClaimStatus } = require('../utils/componentCollectorRegistry');
const { guardedInteractionHandler } = require('../utils/guardedInteractionHandler');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const {
    installInteractionAutoDefer,
    getRemainingAcknowledgementDelay
} = require('../utils/interactionAcknowledgement');
const { performance } = require('node:perf_hooks');
const { recordInteractionDuration } = require('../utils/runtimeMetrics');
const VerificationConfig = require('../models/gateVerification/verificationConfig');
const verificationCodes = new Map();

function verificationSessionKey(guildId, userId) {
    return `${guildId}:${userId}`;
}


const verificationCodeCleanupInterval = setInterval(() => {
    const now = Date.now();
    const MAX_AGE = 15 * 60 * 1000; 
    const MAX_SIZE = 5000; 

    
    for (const [sessionKey, data] of verificationCodes.entries()) {
        if (now - data.timestamp > MAX_AGE) {
            verificationCodes.delete(sessionKey);
        }
    }

    
    if (verificationCodes.size > MAX_SIZE) {
        const entries = Array.from(verificationCodes.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp); 
        const toRemove = entries.slice(0, verificationCodes.size - MAX_SIZE);
        for (const [sessionKey] of toRemove) {
            verificationCodes.delete(sessionKey);
        }
    }
}, 60 * 1000); 
verificationCodeCleanupInterval.unref?.();

function stop() {
    clearInterval(verificationCodeCleanupInterval);
    verificationCodes.clear();
}
const SuggestionVote = require('../models/suggestions/SuggestionVote');
const Suggestion = require('../models/suggestions/Suggestion');
const truths = require('../data/truthordare/truth.json');
const dares = require('../data/truthordare/dare.json');
const DisabledCommand = require('../models/commands/DisabledCommands');

module.exports = {
    name: 'interactionCreate',
    stop,
    async execute(interaction, client) {
        return guardedInteractionHandler(interaction, 'interactionCreate', () => module.exports._execute(interaction, client));
    },
    async _execute(interaction, client) {
        dispatchInteractionObservers(interaction, client);
        if (await dispatchComponentRoute(interaction, client)) return;

        if (interaction.isAutocomplete()) {
            const autoCmd = client.commands.get(interaction.commandName);
            if (typeof autoCmd?.autocomplete !== 'function') {
                return interaction.respond([]).catch(() => {});
            }
            try {
                await autoCmd.autocomplete(interaction, client);
            } catch (error) {
                if (error.code !== 10062) {
                    console.error(`[Autocomplete] /${interaction.commandName} failed:`, error);
                }
                if (!interaction.responded) await interaction.respond([]).catch(() => {});
            }
            return;
        }

        if (interaction.isButton()) {
            const { customId, user } = interaction;


            if (interaction.customId === 'verify_button') {
                if (!interaction.guildId || !interaction.guild) {
                    return interaction.reply({
                        content: `${getEmoji('cross')} Verification must be started inside a server.`,
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
                const verificationCode = Math.random().toString(36).slice(2, 8).toUpperCase();
                const sessionKey = verificationSessionKey(interaction.guild.id, interaction.user.id);
                verificationCodes.set(sessionKey, {
                    code: verificationCode,
                    timestamp: Date.now(),
                    guildId: interaction.guild.id,
                    channelId: interaction.channelId
                });

                const modal = new ModalBuilder()
                    .setCustomId('verify_modal')
                    .setTitle('Member Verification');

                const input = new TextInputBuilder()
                    .setCustomId('verify_input')
                    .setLabel(`Enter Security Code: ${verificationCode}`)
                    .setPlaceholder(`Type ${verificationCode} here`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(input);
                modal.addComponents(row);

                await interaction.showModal(modal);
                return;
            }
            if (customId.startsWith('tod_')) {
                try {
                    await interaction.deferUpdate();

                    const todLang = lang(interaction.guild?.id)?.setups?.truthordare || {};

                    
                    const { getTruthOrDareConfig } = require('../utils/cacheHelpers');
                    const config = await getTruthOrDareConfig(interaction.guild.id);

                    if (!config || config.channelId !== interaction.channel.id) {
                        return interaction.followUp({
                            content: `${getEmoji('cross')} ${todLang.notConfiguredChannel || 'Truth or Dare is not configured for this channel.'}`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    let result;

                    if (customId === 'tod_truth') {
                        result = `**${todLang.truthPrefix || 'Truth:'}** ${truths[Math.floor(Math.random() * truths.length)]}`;
                    } else if (customId === 'tod_dare') {
                        result = `**${todLang.darePrefix || 'Dare:'}** ${dares[Math.floor(Math.random() * dares.length)]}`;
                    } else if (customId === 'tod_random') {
                        const pool = Math.random() < 0.5 ? truths : dares;
                        const label = pool === truths ? `**${todLang.truthPrefix || 'Truth:'}**` : `**${todLang.darePrefix || 'Dare:'}**`;
                        result = `${label} ${pool[Math.floor(Math.random() * pool.length)]}`;
                    }

                    
                    const disabledButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('tod_truth_used')
                            .setLabel(todLang.truthLabel || 'Truth')
                            .setEmoji(getButtonEmoji('help'))
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('tod_dare_used')
                            .setLabel(todLang.dareLabel || 'Dare')
                            .setEmoji(getButtonEmoji('fire'))
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('tod_random_used')
                            .setLabel(todLang.randomLabel || 'Random')
                            .setEmoji(getButtonEmoji('games'))
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                    const oldMessage = interaction.message;
                    await interaction.editReply({ components: [disabledButtons] });

                    const newButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('tod_truth')
                            .setLabel(todLang.truthLabel || 'Truth')
                            .setEmoji(getButtonEmoji('help'))
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('tod_dare')
                            .setLabel(todLang.dareLabel || 'Dare')
                            .setEmoji(getButtonEmoji('fire'))
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('tod_random')
                            .setLabel(todLang.randomLabel || 'Random')
                            .setEmoji(getButtonEmoji('games'))
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const todCard = buildCard({
                        title: `${getEmoji('games')} ${todLang.cardTitle || 'Your Truth or Dare!'}`,
                        sections: [result],
                        _footer: (todLang.footerPicked || '{user} picked this').replace('{user}', user.username),
                        tone: 'info'
                    });
                    todCard.addActionRowComponents(newButtons);

                    
                    await interaction.channel.send({ components: [todCard], flags: MessageFlags.IsComponentsV2 });

                    
                    setTimeout(() => {
                        oldMessage.delete().catch(() => { });
                    }, 5000);

                    return;
                } catch (error) {
                    console.error('[InteractionCreate] Error handling truth or dare button:', error);
                    if (interaction.deferred || interaction.replied) {
                        return interaction.followUp({
                            content: `${getEmoji('cross')} ${lang(interaction.guild?.id)?.error || 'An error occurred while processing your request.'}`,
                            flags: MessageFlags.Ephemeral
                        });
                    } else {
                        return interaction.reply({
                            content: `${getEmoji('cross')} ${lang(interaction.guild?.id)?.error || 'An error occurred while processing your request.'}`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
            }
            if (['suggestion_yes', 'suggestion_no'].includes(customId)) {
                try {
                    await interaction.deferUpdate();

                    const messageId = interaction.message.id;
                    const voteType = customId === 'suggestion_yes' ? 'yes' : 'no';
                    const userId = interaction.user.id;

                    const suggestion = await Suggestion.findOne({ messageId });
                    if (!suggestion) {
                        const notFoundContainer = new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## ${getEmoji('cross')} **Suggestion Not Found**\n\nThis suggestion no longer exists in the database.`)
                            );
                        return interaction.followUp({ components: [notFoundContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
                    }

                    if (suggestion.status !== 'pending') {
                        const statusLabels = {
                            'approved': 'APPROVED',
                            'denied': 'DENIED',
                            'review': 'UNDER REVIEW',
                            'pending': 'PENDING'
                        };

                        const notPendingContainer = new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## ${getEmoji('cross')} **Voting Closed**\n\nYou cannot vote on a suggestion that is **${statusLabels[suggestion.status] || suggestion.status.toUpperCase()}**.`)
                            );

                        return interaction.followUp({ components: [notPendingContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
                    }

                    try {
                        await SuggestionVote.findOneAndUpdate(
                            { messageId, userId },
                            { $set: { vote: voteType, votedAt: new Date() } },
                            { upsert: true }
                        );
                    } catch (error) {
                        if (error.code !== 11000) throw error;
                        await SuggestionVote.updateOne(
                            { messageId, userId },
                            { $set: { vote: voteType, votedAt: new Date() } }
                        );
                    }

                    const allVotes = await SuggestionVote.find({ messageId });
                    const yesVotes = allVotes.filter(v => v.vote === 'yes').length;
                    const noVotes = allVotes.filter(v => v.vote === 'no').length;

                    const userObj = await interaction.client.users.fetch(suggestion.userId).catch(() => null);

                    const yesEmoji = getButtonEmoji('tick');
                    const noEmoji = getButtonEmoji('cross');

                    const btnRow = new ActionRowBuilder();

                    const yesBtn = new ButtonBuilder()
                        .setCustomId('suggestion_yes')
                        .setLabel(`Yes (${yesVotes})`)
                        .setStyle(ButtonStyle.Success);
                    if (yesEmoji) yesBtn.setEmoji(yesEmoji);

                    const noBtn = new ButtonBuilder()
                        .setCustomId('suggestion_no')
                        .setLabel(`No (${noVotes})`)
                        .setStyle(ButtonStyle.Danger);
                    if (noEmoji) noBtn.setEmoji(noEmoji);

                    btnRow.addComponents(yesBtn, noBtn);

                    const updatedCard = new ContainerBuilder()
                        .setAccentColor(0x00AAFF)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`## ${getEmoji('sparkles')} **${suggestion.title}**`)
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder()
                                        .setContent(`${suggestion.description}`)
                                )
                                .setThumbnailAccessory(
                                    new ThumbnailBuilder()
                                        .setURL(userObj ? userObj.displayAvatarURL({ dynamic: true }) : (interaction.guild ? interaction.guild.iconURL({ dynamic: true }) : null) || interaction.client.user.displayAvatarURL())
                                        .setDescription(`User avatar`)
                                )
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`**Submitted By:** <@${suggestion.userId}>\n**Status:** ${getEmoji('time')} **PENDING**\n**Votes:** ${getEmoji('tick')} **${yesVotes}** Yes • ${getEmoji('cross')} **${noVotes}** No`)
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                        .addActionRowComponents(btnRow);

                    await interaction.message.edit({ components: [updatedCard], flags: MessageFlags.IsComponentsV2 }).catch(err => {
                        console.error('[InteractionCreate] Error updating suggestion message:', err);
                    });

                    const confirmContainer = new ContainerBuilder()
                        .setAccentColor(0x00FF7F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`## ${getEmoji('tick')} **Vote Recorded**\n\nYour ${voteType === 'yes' ? 'Yes' : 'No'} vote has been recorded!`)
                        );

                    await interaction.followUp({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => { });

                } catch (err) {
                    console.error('[InteractionCreate] Error handling suggestion vote:', err);

                    const errContainer = new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## ${getEmoji('cross')} **Vote Error**\n\nCould not register your vote. Please try again later.`)
                        );

                    if (interaction.deferred || interaction.replied) {
                        await interaction.followUp({ components: [errContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => { });
                    } else {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => { });
                        await interaction.editReply({ components: [errContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
                    }
                }
            }
        }

        if (interaction.customId === 'verify_modal') {
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => { });
                }

                if (!interaction.guild) {
                    return interaction.editReply({ content: `${getEmoji('cross')} Verification must be completed inside a server.` });
                }

                const userId = interaction.user.id;
                const sessionKey = verificationSessionKey(interaction.guild.id, userId);
                const userInput = (interaction.fields.getTextInputValue('verify_input') || '').trim();
                const codeData = verificationCodes.get(sessionKey);
                const correctCode = codeData?.code;

                if (!correctCode) {
                    return interaction.editReply({ content: `${getEmoji('warning')} **Verification Expired!** Please click **Verify** again.` });
                }

                if (userInput !== correctCode) {
                    return interaction.editReply({ content: `${getEmoji('cross')} **Verification Failed!** Code did not match. Please click **Verify** to try again.` });
                }

                
                const { getVerificationConfig } = require('../utils/cacheHelpers');
                const config = await getVerificationConfig(interaction.guild.id);
                if (!config || !config.verificationEnabled) {
                    return interaction.editReply({ content: `${getEmoji('cross')} Verification is not enabled on this server.` });
                }

                if (codeData.guildId !== interaction.guild.id || codeData.channelId !== interaction.channelId ||
                    config.verificationChannelId !== interaction.channelId) {
                    return interaction.editReply({ content: `${getEmoji('cross')} Please complete verification from this server's verification channel.` });
                }

                const member = interaction.guild.members.cache.get(userId) || await interaction.guild.members.fetch(userId).catch(() => null);
                if (!member) {
                    return interaction.editReply({ content: `${getEmoji('cross')} Member not found in server.` });
                }

                const unverifiedRole = interaction.guild.roles.cache.get(config.unverifiedRoleId);
                const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRoleId);

                if (!verifiedRole || (unverifiedRole && verifiedRole.id === unverifiedRole.id)) {
                    return interaction.editReply({ content: `${getEmoji('warning')} Verified role not found. Please contact an administrator.` });
                }

                try {
                    await member.roles.add(verifiedRole);
                } catch (err) {
                    console.error('[InteractionCreate] Error adding verified role:', err);
                    return interaction.editReply({ content: `${getEmoji('cross')} Failed to assign verified role. Please contact an administrator.` });
                }

                if (unverifiedRole) {
                    try {
                        await member.roles.remove(unverifiedRole);
                    } catch (err) {
                        console.error('[InteractionCreate] Error removing unverified role:', err);
                        await member.roles.remove(verifiedRole).catch(rollbackError => {
                            console.error('[InteractionCreate] Could not roll back verified role:', rollbackError);
                        });
                        return interaction.editReply({ content: `${getEmoji('cross')} Verification could not be completed. Please contact an administrator.` });
                    }
                }

                verificationCodes.delete(sessionKey);

                await interaction.editReply({ content: `${getEmoji('tick')} **Verification Successful!** Welcome to **${interaction.guild.name}**. You now have full access.` });
                await member.send(`${getEmoji('sparkles')} You have been successfully verified in **${interaction.guild.name}**!`).catch(() => {
                    
                });
                return;
            } catch (error) {
                console.error('[InteractionCreate] Error handling verification modal:', error);
                const errPayload = { content: `${getEmoji('cross')} An error occurred during verification. Please try again.` };
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply(errPayload).catch(() => { });
                } else {
                    return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral }).catch(() => { });
                }
            }
        }

        if (!interaction.isCommand()) {
            if (interaction.isModalSubmit?.()) await acknowledgeUnroutedModal(interaction);

            const isComponent = interaction.isButton?.() ||
                interaction.isStringSelectMenu?.() ||
                interaction.isUserSelectMenu?.() ||
                interaction.isRoleSelectMenu?.() ||
                interaction.isChannelSelectMenu?.() ||
                interaction.isMentionableSelectMenu?.();
            if (isComponent || interaction.isModalSubmit?.()) {
                setTimeout(async () => {
                    try {
                        if (!interaction.deferred && !interaction.replied) {
                            const liveCollector = hasLiveComponentCollector(interaction.message?.id, interaction.channelId);
                            const collectorClaim = getCollectorClaimStatus(interaction);
                            if (liveCollector && collectorClaim !== 'rejected') {
                                
                                return await interaction.deferUpdate().catch(() => {});
                            }
                            if (liveCollector && collectorClaim === 'rejected') {
                                const { replyEphemeral } = require('../UI');
                                await replyEphemeral(interaction, 'You cannot use this control.');
                                return;
                            }
                            const cid = interaction.customId || '';
                            if (cid === 'close' || cid.endsWith('_close') || cid.startsWith('close_') || cid.includes('cancel')) {
                                const { closeAndAutoDelete } = require('../UI');
                                return await closeAndAutoDelete(interaction);
                            }
                            const { replyEphemeral } = require('../UI');
                            await replyEphemeral(interaction, 'This interactive session has expired or is no longer active. Please run the command again.').catch(async () => {
                                if (!interaction.deferred && !interaction.replied) {
                                    await interaction.deferUpdate().catch(() => {});
                                }
                            });
                        }
                    } catch (_) {
                        if (!interaction.deferred && !interaction.replied) {
                            await interaction.deferUpdate().catch(() => {});
                        }
                    }
                }, 800);
            }
            return;
        }

        const command = client.commands.get(interaction.commandName);
        if (!command) {
            return interaction.reply({
                content: 'This command is currently unavailable. Please try again later.',
                flags: MessageFlags.Ephemeral
            }).catch(() => { });
        }

        const { isCommandDisabled } = require('../utils/cacheHelpers');
        const subcommandName = interaction.options.getSubcommand(false);
        const guildId = interaction.guild?.id;
        let disabled = false;
        if (guildId) {
            let lookup;
            try {
                lookup = await runWithinAcknowledgementWindow(
                    interaction,
                    () => isCommandDisabled(
                        guildId,
                        interaction.commandName,
                        subcommandName || null
                    ),
                    'Server command settings are taking too long to load. Please try again shortly.',
                    1500
                );
            } catch (error) {
                console.error(`[InteractionCreate] Disabled-command policy lookup failed for /${interaction.commandName}:`, error);
                await interaction.reply({
                    content: 'Could not check this server’s command settings. Please try again shortly.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => { });
                return;
            }
            if (!lookup.completed) return;
            disabled = lookup.value;
        }

        if (disabled) {
            try {
                await interaction.reply({
                    content: `${getEmoji('cross')} ${(lang(interaction.guild?.id)?.commandDisabledInServer || 'This command is disabled in this server.').replace('{command}', subcommandName ? `${interaction.commandName} ${subcommandName}` : interaction.commandName)}`,
                    flags: MessageFlags.Ephemeral
                });
            } catch (replyError) {
                console.error('Error sending disabled command reply:', replyError);
            }
            return;
        }


        if (!isCommandCategoryEnabled(command, categories)) {
            const category = command.category || 'undefined';
            console.warn(`Command in category '${category}' is disabled.`);
            try {
                await interaction.reply({
                    content: `${getEmoji('cross')} ${lang(interaction.guild?.id)?.commandDisabled || 'This command is currently disabled.'}`,
                    flags: MessageFlags.Ephemeral
                });
            } catch (replyError) {
                console.error('Error when sending command disabled reply:', replyError);
            }
            return;
        }


        const autoDefer = installInteractionAutoDefer(interaction, {
            
            
            delayMs: getRemainingAcknowledgementDelay(interaction, 2000),
            onAutoDefer: () => console.log(`[Auto-Defer] Deferred /${interaction.commandName} automatically`),
            onError: error => {
                if (error.code !== 10062) {
                    console.error(`[InteractionCreate] Automatic defer failed for /${interaction.commandName}:`, error);
                }
            }
        });

        const commandStartedAt = performance.now();
        let commandFailed = false;
        try {
            
            await command.execute(interaction, client);

        } catch (error) {
            commandFailed = true;
            if (error.code === 10062) return;

            if (error.message?.includes('Interaction has already been acknowledged') ||
                error.message?.includes('Unknown Message')) {
                return; 
            }

            console.error(`[Command] /${interaction.commandName} failed in guild ${interaction.guildId || interaction.guild?.id || 'DM'}:`, error);

            const errText = `${getEmoji('cross')} ${lang(interaction.guild?.id)?.error || 'Something went wrong while running this command.'}`;
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: errText, flags: MessageFlags.Ephemeral });
                } else if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ content: errText });
                } else {
                    await interaction.followUp({ content: errText, flags: MessageFlags.Ephemeral });
                }
            } catch (replyError) {
                if (replyError.message?.includes('Interaction has already been acknowledged') ||
                    replyError.message?.includes('Unknown interaction')) return;

                console.error('Error when sending error reply:', replyError);
            }
        } finally {
            autoDefer.restore();
            recordInteractionDuration(command.data?.name || interaction.commandName, 'slash_command', performance.now() - commandStartedAt, commandFailed);
        }

    },
};

