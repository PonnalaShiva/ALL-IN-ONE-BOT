'use strict';

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionsBitField,
} = require('discord.js');
const afkHandler = require('./afkManager');
const AFK = require('../models/afk/schema');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const {
    buildCard,
    cards,
    btn,
    buttonRow,
    replyEphemeral,
    deferUpdate,
    ACCENT
} = require('../UI');
const lang = require('../events/loadLanguage');


const inFlightInteractions = new Set();

module.exports = {
    
    async execute(interaction) {
        if (!interaction.isButton() && !interaction.isModalSubmit()) return;
        if (!interaction.customId?.startsWith('afk_')) return;
        if (interaction.replied || interaction.deferred) return;
        if (inFlightInteractions.has(interaction.id)) return;

        inFlightInteractions.add(interaction.id);
        setTimeout(() => inFlightInteractions.delete(interaction.id), 5000);

        const customId = interaction.customId;
        const { getAFK, removeAFK, setAFK, getAllAFKs } = afkHandler(interaction.client);

        try {
            
            if (interaction.isModalSubmit()) {
                
                if (customId.startsWith('afk_modal_leave_msg_')) {
                    const targetUserId = customId.replace('afk_modal_leave_msg_', '');
                    return await module.exports.handleLeaveMsgModalSubmit(interaction, targetUserId);
                }

                
                if (customId.startsWith('afk_modal_setup_') || customId.startsWith('afk_autoresponse_')) {
                    return await module.exports.handleAutoResponseModalSubmit(interaction, { getAFK });
                }
            }

            
            if (interaction.isButton()) {
                
                if (customId.startsWith('afk_leave_msg_')) {
                    const targetUserId = customId.replace('afk_leave_msg_', '');
                    return await module.exports.handleLeaveMsgButton(interaction, targetUserId);
                }

                
                if (customId.startsWith('afk_remind_')) {
                    const targetUserId = customId.replace('afk_remind_', '');
                    return await module.exports.handleRemindButton(interaction, targetUserId);
                }

                
                if (customId.startsWith('afk_dismiss')) {
                    const ownerId = customId.startsWith('afk_dismiss_')
                        ? customId.slice('afk_dismiss_'.length)
                        : null;
                    return await module.exports.handleDismissButton(interaction, ownerId);
                }

                
                if (customId.startsWith('afk_reafk_')) {
                    const targetUserId = customId.replace('afk_reafk_', '');
                    return await module.exports.handleReAfkButton(interaction, targetUserId, { setAFK });
                }

                
                if (customId.startsWith('afk_mentions_')) {
                    const targetUserId = customId.replace('afk_mentions_', '');
                    return await module.exports.handleViewMentionsButton(interaction, targetUserId);
                }

                
                if (customId.startsWith('afk_remove_')) {
                    const targetUserId = customId.replace('afk_remove_', '');
                    return await module.exports.handleRemoveButton(interaction, targetUserId, { getAFK, removeAFK });
                }

                
                if (customId.startsWith('afk_setup_')) {
                    const targetUserId = customId.replace('afk_setup_', '');
                    return await module.exports.handleSetupButton(interaction, targetUserId);
                }

                
                if (customId.startsWith('afk_list_')) {
                    const page = parseInt(customId.replace('afk_list_', ''), 10) || 1;
                    return await module.exports.handleListNavigation(interaction, page, { getAllAFKs });
                }
            }

        } catch (error) {
            console.error('[AFKHandler] Error processing AFK interaction:', error);
            try {
                const errCard = cards.danger(
                    lang.afk.error.commandErrorTitle.replace('{emoji}', getEmoji('cross')),
                    lang.afk.error.commandErrorDesc
                );
                await replyEphemeral(interaction, errCard);
            } catch (replyErr) {
                console.error('[AFKHandler] Error sending error card:', replyErr);
            }
        }
    },

    async handleLeaveMsgButton(interaction, targetUserId) {
        if (interaction.user.id === targetUserId) {
            return replyEphemeral(interaction, cards.warning(
                lang.afk.notify.title.replace('{emoji}', getEmoji('warning')),
                lang.afk.notify.cannotNoteSelf.replace('{emoji}', getEmoji('warning'))
            ));
        }

        const modal = new ModalBuilder()
            .setCustomId(`afk_modal_leave_msg_${targetUserId}`)
            .setTitle(lang.afk.notify.leaveMsgModalTitle);

        const noteInput = new TextInputBuilder()
            .setCustomId('note_content')
            .setLabel(lang.afk.notify.leaveMsgLabel)
            .setPlaceholder(lang.afk.notify.leaveMsgPlaceholder)
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(250)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
        return await interaction.showModal(modal);
    },

    async handleLeaveMsgModalSubmit(interaction, targetUserId) {
        const note = interaction.fields.getTextInputValue('note_content')?.trim();
        if (!note) {
            return replyEphemeral(interaction, cards.warning(
                lang.afk.notify.title.replace('{emoji}', getEmoji('warning')),
                'Please enter a non-empty note.'
            ));
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const afk = await AFK.findOne({ userId: targetUserId, guildId: interaction.guild.id, status: 'active' });
        if (!afk) {
            return replyEphemeral(interaction, cards.warning(
                lang.afk.error.notAfkTitle.replace('{emoji}', getEmoji('warning')),
                lang.afk.error.notAfkDesc
            ));
        }

        if (typeof afk.addNoteForMentioner === 'function') {
            await afk.addNoteForMentioner(interaction.user.id, interaction.user.username, note);
        }

        const targetUser = interaction.client.users.cache.get(targetUserId) || await interaction.client.users.fetch(targetUserId).catch(() => null);
        const targetName = targetUser ? targetUser.username : `<@${targetUserId}>`;

        const successText = lang.afk.notify.leaveMsgSuccess
            .replace('{emoji}', getEmoji('tick'))
            .replace('{user}', targetName);

        const card = buildCard({
            title: lang.afk.notify.title.replace('{emoji}', getEmoji('tick')),
            sections: [
                successText,
                `**Saved Note:**\n> "${note}"`
            ],
            accentColor: ACCENT.success,
            footer: `Fluenosity AFK Hub • ${new Date().toLocaleTimeString()}`
        });

        return replyEphemeral(interaction, card);
    },

    async handleRemindButton(interaction, targetUserId) {
        if (interaction.user.id === targetUserId) {
            return replyEphemeral(interaction, cards.warning(
                lang.afk.notify.title.replace('{emoji}', getEmoji('warning')),
                lang.afk.notify.cannotRemindSelf.replace('{emoji}', getEmoji('warning'))
            ));
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const afk = await AFK.findOne({ userId: targetUserId, guildId: interaction.guild.id, status: 'active' });
        if (!afk) {
            return replyEphemeral(interaction, cards.warning(
                lang.afk.error.notAfkTitle.replace('{emoji}', getEmoji('warning')),
                lang.afk.error.notAfkDesc
            ));
        }

        const targetUser = interaction.client.users.cache.get(targetUserId) || await interaction.client.users.fetch(targetUserId).catch(() => null);
        const targetName = targetUser ? targetUser.username : `<@${targetUserId}>`;

        if (afk.metadata?.remindUsers?.includes(interaction.user.id)) {
            const alreadyMsg = lang.afk.notify.alreadySubscribed
                .replace('{emoji}', getEmoji('time'))
                .replace('{user}', targetName);
            return replyEphemeral(interaction, cards.info(
                lang.afk.notify.title.replace('{emoji}', getEmoji('time')),
                alreadyMsg
            ));
        }

        if (typeof afk.addRemindUser === 'function') {
            await afk.addRemindUser(interaction.user.id);
        }

        const successMsg = lang.afk.notify.remindSuccess
            .replace('{emoji}', getEmoji('tick'))
            .replace('{user}', targetName);

        const card = buildCard({
            title: lang.afk.notify.title.replace('{emoji}', getEmoji('tick')),
            sections: [
                successMsg,
                `You will receive a direct message notification as soon as **${targetName}** speaks again in this server.`
            ],
            accentColor: ACCENT.success,
            footer: `Fluenosity AFK Hub • ${new Date().toLocaleTimeString()}`
        });

        return replyEphemeral(interaction, card);
    },

    async handleDismissButton(interaction, ownerId = null) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const hasManagePerms = interaction.member?.permissions?.has(PermissionsBitField.Flags.ManageMessages);
        let isAuthor = Boolean(ownerId && ownerId === interaction.user.id) ||
            interaction.message.interaction?.user?.id === interaction.user.id ||
            interaction.message.interactionMetadata?.user?.id === interaction.user.id;

        if (!isAuthor && !ownerId && interaction.message.reference?.messageId && interaction.channel) {
            const sourceMessage = await interaction.channel.messages
                .fetch(interaction.message.reference.messageId)
                .catch(() => null);
            isAuthor = sourceMessage?.author?.id === interaction.user.id;
        }

        if (!hasManagePerms && !isAuthor) {
            return replyEphemeral(interaction, cards.danger(
                lang.afk.error.permissionTitle.replace('{emoji}', getEmoji('cross')),
                'Only the person who triggered this AFK notice or a moderator can dismiss it.'
            ));
        }

        try {
            await interaction.message.delete();
        } catch (e) {
            return replyEphemeral(interaction, `${getEmoji('cross')} Could not dismiss this AFK notice. Please try again.`);
        }
    },

    async handleReAfkButton(interaction, targetUserId, { setAFK }) {
        if (interaction.user.id !== targetUserId) {
            return replyEphemeral(interaction, cards.danger(
                lang.afk.error.permissionTitle.replace('{emoji}', getEmoji('cross')),
                lang.afk.return.reAfkNotAllowed.replace('{emoji}', getEmoji('cross'))
            ));
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        
        const lastAfk = await AFK.findOne({ userId: targetUserId, guildId: interaction.guild.id }).sort({ updatedAt: -1 });
        const reason = lastAfk?.metadata?.previousReason || lastAfk?.reason || 'AFK';

        await setAFK(interaction.user.id, interaction.guild.id, reason, {
            dmNotifications: lastAfk?.settings?.dmNotifications ?? true,
            publicNotifications: lastAfk?.settings?.publicNotifications ?? true,
            showDuration: lastAfk?.settings?.showDuration ?? true,
        });

        const successText = lang.afk.return.reAfkSuccess
            .replace('{emoji}', getEmoji('loop'))
            .replace('{reason}', reason);

        const card = buildCard({
            title: lang.afk.set.title.replace('{emoji}', getEmoji('loop')),
            sections: [
                successText,
                `**Reason:** ${reason}\n**Reactivated at:** <t:${Math.floor(Date.now() / 1000)}:R>`
            ],
            thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
            accentColor: ACCENT.primary,
            footer: `Fluenosity AFK Hub • ${new Date().toLocaleTimeString()}`
        });

        return replyEphemeral(interaction, card);
    },

    async handleViewMentionsButton(interaction, targetUserId) {
        if (interaction.user.id !== targetUserId) {
            return replyEphemeral(interaction, cards.danger(
                lang.afk.error.permissionTitle.replace('{emoji}', getEmoji('cross')),
                lang.afk.error.unauthorizedMentions
            ));
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const lastAfk = await AFK.findOne({ userId: targetUserId, guildId: interaction.guild.id }).sort({ updatedAt: -1 });
        const mentions = lastAfk?.mentions?.mentionedBy || [];

        if (mentions.length === 0) {
            return replyEphemeral(interaction, cards.info(
                lang.afk.return.mentionsHubTitle.replace('{emoji}', getEmoji('chat')),
                lang.afk.return.noMentions
            ));
        }

        const lines = mentions.slice(0, 10).map((m, idx) => {
            const timeStr = m.timestamp ? `<t:${Math.floor(new Date(m.timestamp).getTime() / 1000)}:R>` : '';
            const noteStr = m.note ? `\n   └ ${getEmoji('chat')} **Note:** "${m.note}"` : '';
            return `${idx + 1}. **${m.username}** ${timeStr}${noteStr}`;
        });

        const card = buildCard({
            title: lang.afk.return.mentionsHubTitle.replace('{emoji}', getEmoji('chat')),
            sections: [
                `Total mentions recorded: **${lastAfk.mentions?.count || mentions.length}**`,
                lines.join('\n\n')
            ],
            accentColor: ACCENT.info,
            footer: `Fluenosity AFK Hub • ${new Date().toLocaleTimeString()}`
        });

        return replyEphemeral(interaction, card);
    },

    async handleRemoveButton(interaction, targetUserId, { getAFK, removeAFK }) {
        if (interaction.user.id !== targetUserId) {
            return replyEphemeral(interaction, cards.danger(
                lang.afk.error.permissionTitle.replace('{emoji}', getEmoji('cross')),
                'You can only remove your own AFK status.'
            ));
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const afk = await getAFK(targetUserId, interaction.guild.id);
        if (!afk) {
            return replyEphemeral(interaction, cards.warning(
                lang.afk.error.notAfkTitle.replace('{emoji}', getEmoji('warning')),
                lang.afk.error.notAfkDesc
            ));
        }

        await removeAFK(targetUserId, interaction.guild.id);

        const totalTime = Date.now() - (afk.setAt ? new Date(afk.setAt).getTime() : Date.now());
        const duration = module.exports.formatDuration(totalTime);

        const card = buildCard({
            title: lang.afk.remove.title.replace('{emoji}', getEmoji('tick')),
            sections: [
                lang.afk.remove.desc,
                `**Previous Reason:** ${afk.reason}\n**AFK Duration:** ${duration}\n**Mentions Received:** ${afk.mentions?.count ?? 0}`
            ],
            thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
            accentColor: ACCENT.success,
            footer: lang.afk.remove.welcomeBack.replace('{time}', new Date().toLocaleTimeString())
        });

        return replyEphemeral(interaction, card);
    },

    async handleSetupButton(interaction, targetUserId) {
        if (!targetUserId || interaction.user.id !== targetUserId) {
            return replyEphemeral(interaction, cards.danger(
                lang.afk.error.permissionTitle.replace('{emoji}', getEmoji('cross')),
                lang.afk.error.onlyOwnAutoResponse
            ));
        }

        const modal = new ModalBuilder()
            .setCustomId(`afk_modal_setup_${targetUserId}`)
            .setTitle(lang.afk.modal.title);

        const messageInput = new TextInputBuilder()
            .setCustomId('auto_message')
            .setLabel(lang.afk.modal.messageLabel)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(lang.afk.modal.messagePlaceholder)
            .setMaxLength(500)
            .setRequired(false);

        const cooldownInput = new TextInputBuilder()
            .setCustomId('auto_cooldown')
            .setLabel(lang.afk.modal.cooldownLabel)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(lang.afk.modal.cooldownPlaceholder)
            .setValue('5')
            .setMaxLength(2)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(messageInput),
            new ActionRowBuilder().addComponents(cooldownInput)
        );

        return await interaction.showModal(modal);
    },

    async handleAutoResponseModalSubmit(interaction, { getAFK }) {
        const message = (
            interaction.fields.getTextInputValue('auto_message') ||
            interaction.fields.getTextInputValue('message')
        )?.trim();

        const cooldownStr = (
            interaction.fields.getTextInputValue('auto_cooldown') ||
            interaction.fields.getTextInputValue('cooldown')
        )?.trim() || '5';

        const cooldownMinutes = parseInt(cooldownStr, 10) || 5;

        if (cooldownMinutes < 1 || cooldownMinutes > 60) {
            return replyEphemeral(interaction, cards.warning(
                lang.afk.error.invalidDurationTitle.replace('{emoji}', getEmoji('warning')),
                'Cooldown must be between 1 and 60 minutes.'
            ));
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const afk = await getAFK(interaction.user.id, interaction.guild.id);
        if (!afk) {
            return replyEphemeral(interaction, cards.warning(
                lang.afk.error.notAfkTitle.replace('{emoji}', getEmoji('warning')),
                lang.afk.error.notAfkAutoResponseDesc
            ));
        }

        if (!message) {
            afk.autoResponses = afk.autoResponses || {};
            afk.autoResponses.enabled = false;
            await afk.save();

            const { invalidateAFKStatus } = require('../utils/cacheHelpers');
            invalidateAFKStatus(interaction.user.id, interaction.guild.id);

            const card = buildCard({
                title: lang.afk.autoResponse.disabledTitle.replace('{emoji}', getEmoji('bot')),
                sections: [lang.afk.autoResponse.disabledDesc],
                accentColor: ACCENT.warning,
                footer: `Updated at ${new Date().toLocaleTimeString()}`
            });
            return replyEphemeral(interaction, card);
        }

        afk.autoResponses = afk.autoResponses || {};
        afk.autoResponses.enabled = true;
        afk.autoResponses.message = message;
        afk.autoResponses.cooldown = cooldownMinutes * 60000;
        await afk.save();

        const { invalidateAFKStatus } = require('../utils/cacheHelpers');
        invalidateAFKStatus(interaction.user.id, interaction.guild.id);

        const detailsText = lang.afk.autoResponse.configuredDetails
            .replace('{message}', message)
            .replace('{cooldown}', cooldownMinutes);

        const card = buildCard({
            title: lang.afk.autoResponse.configuredTitle.replace('{emoji}', getEmoji('bot')),
            sections: [detailsText],
            thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
            accentColor: ACCENT.primary,
            footer: lang.afk.autoResponse.configuredFooter.replace('{time}', new Date().toLocaleTimeString())
        });

        return replyEphemeral(interaction, card);
    },

    async handleListNavigation(interaction, page, { getAllAFKs }) {
        await deferUpdate(interaction);
        const { afks, pagination } = await getAllAFKs(interaction.guild.id, { page, limit: 10 });

        if (!afks.length) {
            const emptyCard = buildCard({
                title: lang.afk.list.title.replace('{emoji}', getEmoji('time')),
                sections: [lang.afk.error.noUsersDesc],
                accentColor: ACCENT.info
            });
            return interaction.editReply({ components: [emptyCard], flags: MessageFlags.IsComponentsV2 });
        }

        let description = '';
        for (const afk of afks) {
            try {
                const user = await interaction.guild.members.fetch(afk.userId).catch(() => null);
                const userName = user ? user.displayName : `Unknown User (${afk.userId})`;
                const afkDuration = module.exports.formatDuration(Date.now() - new Date(afk.setAt).getTime());

                description += `**${userName}**\n`;
                description += `└ *${afk.reason}*\n`;
                description += `└ AFK for ${afkDuration}`;

                if (afk.mentions?.count > 0) {
                    description += ` • ${afk.mentions.count} mentions`;
                }

                if (afk.expiresAt) {
                    const expiresTimestamp = Math.floor(new Date(afk.expiresAt).getTime() / 1000);
                    description += ` • Until <t:${expiresTimestamp}:R>`;
                }

                description += '\n\n';
            } catch (err) {
                console.error('[AFKHandler] Error formatting AFK user:', err);
            }
        }

        const rows = [];
        if (pagination.total > 1) {
            const navButtons = [];
            if (pagination.hasPrev) {
                navButtons.push(btn.secondary(`afk_list_${page - 1}`, lang.afk.buttons.prev, 'previoussong'));
            }
            if (pagination.hasNext) {
                navButtons.push(btn.secondary(`afk_list_${page + 1}`, lang.afk.buttons.next, 'nextsong'));
            }
            if (navButtons.length > 0) {
                rows.push(buttonRow(...navButtons));
            }
        }

        const footerText = lang.afk.list.pageInfo
            .replace('{page}', pagination.current)
            .replace('{total}', pagination.total)
            .replace('{count}', afks.length);

        const card = buildCard({
            title: lang.afk.list.title.replace('{emoji}', getEmoji('time')),
            sections: [
                lang.afk.list.header.replace('{guildName}', interaction.guild.name),
                description.trim() || lang.afk.error.noUsersFound
            ],
            rows,
            accentColor: ACCENT.primary,
            footer: footerText
        });

        return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    },

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
};
