'use strict';

const {
    SlashCommandBuilder,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} = require('discord.js');
const afkHandler = require('../../handlers/afkManager');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, btn, sendV2, deferReply, deferUpdate, ACCENT } = require('../../UI');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Manage AFK statuses with advanced features.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set your AFK status with advanced options.')
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for going AFK.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Duration of AFK (e.g., 30m, 2h, 1d).')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('dm_notifications')
                        .setDescription('Receive DM notifications (default: true)')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('public_notifications')
                        .setDescription('Show public return notifications (default: true)')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('show_duration')
                        .setDescription('Show AFK duration to others (default: true)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove your AFK status.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Show AFK users in the server.')
                .addIntegerOption(option =>
                    option.setName('page')
                        .setDescription('Page number to view')
                        .setMinValue(1)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View AFK statistics for this server.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('auto-response')
                .setDescription('Set up auto-response messages when mentioned while AFK.')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Auto-response message (leave empty to disable)')
                        .setMaxLength(500)
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('cooldown')
                        .setDescription('Cooldown between responses in minutes (default: 5)')
                        .setMinValue(1)
                        .setMaxValue(60)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete your AFK status and all associated data.')),

    async execute(interaction) {
        if (!interaction.isCommand?.()) {
            await deferReply(interaction, true);
            const title = lang.afk.error.slashOnlyTitle.replace('{emoji}', getEmoji('utility'));
            const desc = lang.afk.error.slashOnlyDesc;
            return sendV2(interaction, cards.warning(title, desc));
        }

        const subcommand = interaction.options.getSubcommand();
        const isPublicList = subcommand === 'list' || subcommand === 'stats';

        await deferReply(interaction, !isPublicList);

        const {
            setAFK,
            removeAFK,
            getAFK,
            getAllAFKs,
            getGuildStats,
            parseDuration
        } = afkHandler(interaction.client);

        try {
            switch (subcommand) {
                case 'set':
                    await this.handleSetAFK(interaction, { setAFK, getAFK, parseDuration });
                    break;
                case 'remove':
                    await this.handleRemoveAFK(interaction, { removeAFK, getAFK });
                    break;
                case 'list':
                    await this.handleListAFK(interaction, { getAllAFKs });
                    break;
                case 'stats':
                    await this.handleStatsAFK(interaction, { getGuildStats });
                    break;
                case 'auto-response':
                    await this.handleAutoResponse(interaction, { getAFK });
                    break;
                case 'delete':
                    await this.handleDeleteAFK(interaction, { getAFK, removeAFK });
                    break;
            }
        } catch (error) {
            console.error('[AFK] Error executing AFK command:', error);

            const title = lang.afk.error.commandErrorTitle.replace('{emoji}', getEmoji('cross'));
            const desc = lang.afk.error.commandErrorDesc;
            await sendV2(interaction, cards.error(title, desc));
        }
    },

    async handleSetAFK(interaction, { setAFK, getAFK, parseDuration }) {
        const reason = interaction.options.getString('reason');
        const durationStr = interaction.options.getString('duration');
        const dmNotifications = interaction.options.getBoolean('dm_notifications') ?? true;
        const publicNotifications = interaction.options.getBoolean('public_notifications') ?? true;
        const showDuration = interaction.options.getBoolean('show_duration') ?? true;

        const existingAFK = await getAFK(interaction.user.id, interaction.guild.id);
        if (existingAFK) {
            const title = lang.afk.error.alreadyAfkTitle.replace('{emoji}', getEmoji('warning'));
            const desc = lang.afk.error.alreadyAfkDesc
                .replace('{reason}', existingAFK.reason || lang.none);
            return sendV2(interaction, cards.warning(title, desc));
        }

        let duration = null;
        if (durationStr) {
            duration = parseDuration(durationStr);
            if (!duration) {
                const title = lang.afk.error.invalidDurationTitle.replace('{emoji}', getEmoji('cross'));
                const desc = lang.afk.error.invalidDurationDesc;
                return sendV2(interaction, cards.error(title, desc));
            }

            if (duration > 30 * 24 * 60 * 60 * 1000) {
                const title = lang.afk.error.durationTooLongTitle.replace('{emoji}', getEmoji('time'));
                const desc = lang.afk.error.durationTooLongDesc;
                return sendV2(interaction, cards.error(title, desc));
            }
        }

        const options = {
            duration,
            dmNotifications,
            publicNotifications,
            showDuration
        };

        await setAFK(interaction.user.id, interaction.guild.id, reason, options);

        let durationText = lang.afk.set.indefinite;
        if (duration) {
            const expiresTimestamp = Math.floor((Date.now() + duration) / 1000);
            durationText = lang.afk.set.until.replace('{timestamp}', expiresTimestamp);
        }

        const btnRow = new ActionRowBuilder().addComponents(
            btn.secondary(`afk_setup_${interaction.user.id}`, lang.afk.buttons.setAutoResponse, 'settings'),
            btn.danger(`afk_remove_${interaction.user.id}`, lang.afk.buttons.removeAfk, 'delete')
        );

        const detailsText = lang.afk.set.details
            .replace('{reason}', reason)
            .replace('{duration}', durationText)
            .replace('{dm}', dmNotifications ? getEmoji('tick') : getEmoji('cross'))
            .replace('{pub}', publicNotifications ? getEmoji('tick') : getEmoji('cross'))
            .replace('{showDur}', showDuration ? (getEmoji('tick')) : (getEmoji('cross')));

        const titleText = lang.afk.set.title.replace('{emoji}', getEmoji('time'));

        const successContainer = buildCard({
            title: titleText,
            sections: [detailsText],
            rows: [btnRow],
            thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
            accentColor: ACCENT.success,
        });

        await sendV2(interaction, successContainer);

        if (dmNotifications) {
            try {
                const dmTitle = lang.afk.set.dmConfirmedTitle.replace('{emoji}', getEmoji('time'));
                const dmDesc = lang.afk.set.dmConfirmedDesc
                    .replace('{guildName}', interaction.guild.name)
                    .replace('{reason}', reason);

                const dmSections = [dmDesc];
                if (duration) {
                    const expiresTimestamp = Math.floor((Date.now() + duration) / 1000);
                    dmSections.push(lang.afk.set.dmReturns.replace('{timestamp}', expiresTimestamp));
                }

                const dmContainer = buildCard({
                    title: dmTitle,
                    sections: dmSections,
                    accentColor: ACCENT.success,
                    footer: lang.afk.set.dmFooter.replace('{time}', new Date().toLocaleTimeString()),
                });

                await interaction.user.send({
                    components: [dmContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (_) {}
        }
    },

    async handleRemoveAFK(interaction, { removeAFK, getAFK }) {
        const afk = await getAFK(interaction.user.id, interaction.guild.id);

        if (!afk) {
            const title = lang.afk.error.notAfkTitle.replace('{emoji}', getEmoji('warning'));
            const desc = lang.afk.error.notAfkDesc;
            return sendV2(interaction, cards.warning(title, desc));
        }

        await removeAFK(interaction.user.id, interaction.guild.id);

        const totalTime = Date.now() - (afk.setAt ? new Date(afk.setAt).getTime() : Date.now());
        const duration = this.formatDuration(totalTime);

        const titleText = lang.afk.remove.title.replace('{emoji}', getEmoji('tick'));
        const mainDesc = lang.afk.remove.desc;
        const detailsText = lang.afk.remove.details
            .replace('{reason}', afk.reason || lang.none)
            .replace('{duration}', duration)
            .replace('{mentions}', afk.mentions?.count ?? 0);

        const removedContainer = buildCard({
            title: titleText,
            sections: [`${mainDesc}\n\n${detailsText}`],
            thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
            accentColor: ACCENT.success,
            footer: lang.afk.remove.welcomeBack.replace('{time}', new Date().toLocaleTimeString()),
        });

        await sendV2(interaction, removedContainer);
    },

    async handleListAFK(interaction, { getAllAFKs }) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            const title = lang.afk.error.permissionTitle.replace('{emoji}', getEmoji('cross'));
            const desc = lang.afk.error.permissionDesc;
            return sendV2(interaction, cards.error(title, desc));
        }

        const page = interaction.options?.getInteger?.('page') || 1;
        const { afks, pagination } = await getAllAFKs(interaction.guild.id, { page, limit: 10 });

        if (!afks.length) {
            const title = lang.afk.error.noUsersTitle.replace('{emoji}', getEmoji('time'));
            const desc = lang.afk.error.noUsersDesc;
            return sendV2(interaction, buildCard({
                title,
                sections: [desc],
                accentColor: ACCENT.primary,
            }));
        }

        let description = '';
        for (const afk of afks) {
            try {
                const user = interaction.guild.members.cache.get(afk.userId) || await interaction.guild.members.fetch(afk.userId).catch(() => null);
                const userName = user ? user.displayName : lang.afk.list.unknownUser.replace('{userId}', afk.userId);
                const afkDuration = this.formatDuration(Date.now() - new Date(afk.setAt).getTime());

                description += `**${userName}**\n`;
                description += `└ *${afk.reason}*\n`;
                description += lang.afk.list.afkFor.replace('{duration}', afkDuration);

                if (afk.mentions?.count > 0) {
                    description += lang.afk.list.mentions.replace('{count}', afk.mentions.count);
                }

                if (afk.expiresAt) {
                    const expiresTimestamp = Math.floor(new Date(afk.expiresAt).getTime() / 1000);
                    description += lang.afk.list.until.replace('{timestamp}', expiresTimestamp);
                }

                description += '\n\n';
            } catch (error) {
                console.error('[AFK] Error processing AFK user:', error);
            }
        }

        const rows = [];
        if (pagination.total > 1) {
            const row = new ActionRowBuilder();
            if (pagination.hasPrev) {
                row.addComponents(btn.secondary(`afk_list_${page - 1}`, lang.afk.buttons.prev, 'arrleft'));
            }
            if (pagination.hasNext) {
                row.addComponents(btn.secondary(`afk_list_${page + 1}`, lang.afk.buttons.next, 'arrright'));
            }
            if (row.components.length > 0) rows.push(row);
        }

        const listContainer = buildCard({
            title: lang.afk.list.title.replace('{emoji}', getEmoji('time')),
            sections: [
                lang.afk.list.header.replace('{guildName}', interaction.guild.name),
                description.trim() || lang.afk.error.noUsersFound,
                lang.afk.list.pageInfo
                    .replace('{page}', pagination.current)
                    .replace('{total}', pagination.total)
                    .replace('{count}', afks.length),
            ],
            rows,
            accentColor: ACCENT.warning,
        });

        await sendV2(interaction, listContainer);
    },

    async handleStatsAFK(interaction, { getGuildStats }) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            const title = lang.afk.error.permissionTitle.replace('{emoji}', getEmoji('cross'));
            const desc = lang.afk.error.permissionDesc;
            return sendV2(interaction, cards.error(title, desc));
        }

        const stats = await getGuildStats(interaction.guild.id);
        const totalSessions = stats.active + stats.expired + stats.removed;
        const activeRate = Math.round((stats.active / Math.max(1, totalSessions)) * 100);

        const detailsText = lang.afk.stats.details
            .replace('{active}', stats.active)
            .replace('{expired}', stats.expired)
            .replace('{removed}', stats.removed)
            .replace('{mentions}', stats.totalMentions)
            .replace('{totalSessions}', totalSessions)
            .replace('{activeRate}', activeRate);

        const statsContainer = buildCard({
            title: lang.afk.stats.title
                .replace('{emoji}', getEmoji('analytics'))
                .replace('{guildName}', interaction.guild.name),
            sections: [detailsText],
            thumbnailURL: interaction.guild.iconURL({ dynamic: true }) || interaction.client.user.displayAvatarURL(),
            accentColor: ACCENT.primary,
            footer: lang.afk.stats.footer.replace('{time}', new Date().toLocaleTimeString()),
        });

        await sendV2(interaction, statsContainer);
    },

    async handleAutoResponse(interaction, { getAFK }) {
        const message = interaction.options?.getString?.('message');
        const cooldownMinutes = interaction.options?.getInteger?.('cooldown') || 5;

        const afk = await getAFK(interaction.user.id, interaction.guild.id);

        if (!afk) {
            const title = lang.afk.error.notAfkTitle.replace('{emoji}', getEmoji('warning'));
            const desc = lang.afk.error.notAfkAutoResponseDesc;
            return sendV2(interaction, cards.warning(title, desc));
        }

        if (!message) {
            afk.autoResponses = afk.autoResponses || {};
            afk.autoResponses.enabled = false;
            await afk.save();

            const { invalidateAFKStatus } = require('../../utils/cacheHelpers');
            invalidateAFKStatus(interaction.user.id, interaction.guild.id);

            const title = lang.afk.autoResponse.disabledTitle.replace('{emoji}', getEmoji('bot'));
            const desc = lang.afk.autoResponse.disabledDesc;
            return sendV2(interaction, buildCard({
                title,
                sections: [desc],
                accentColor: ACCENT.warning,
            }));
        }

        afk.autoResponses = afk.autoResponses || {};
        afk.autoResponses.enabled = true;
        afk.autoResponses.message = message;
        afk.autoResponses.cooldown = cooldownMinutes * 60000;
        await afk.save();

        const { invalidateAFKStatus } = require('../../utils/cacheHelpers');
        invalidateAFKStatus(interaction.user.id, interaction.guild.id);

        const detailsText = lang.afk.autoResponse.configuredDetails
            .replace('{message}', message)
            .replace('{cooldown}', cooldownMinutes);

        const enabledContainer = buildCard({
            title: lang.afk.autoResponse.configuredTitle.replace('{emoji}', getEmoji('bot')),
            sections: [detailsText],
            thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
            accentColor: ACCENT.primary,
            footer: lang.afk.autoResponse.configuredFooter.replace('{time}', new Date().toLocaleTimeString()),
        });

        await sendV2(interaction, enabledContainer);
    },

    async handleDeleteAFK(interaction, { getAFK, removeAFK }) {
        const afk = await getAFK(interaction.user.id, interaction.guild.id);

        if (!afk) {
            const title = lang.afk.error.notAfkTitle.replace('{emoji}', getEmoji('warning'));
            const desc = lang.afk.error.notAfkDesc;
            return sendV2(interaction, cards.warning(title, desc));
        }

        await removeAFK(interaction.user.id, interaction.guild.id);

        try {
            const AFK = require('../../models/afk/schema');
            await AFK.deleteOne({ userId: interaction.user.id, guildId: interaction.guild.id });

            const { invalidateAFKStatus } = require('../../utils/cacheHelpers');
            invalidateAFKStatus(interaction.user.id, interaction.guild.id);
        } catch (error) {
            console.error('[AFK] Error deleting AFK from database:', error);
        }

        const totalTime = Date.now() - (afk.setAt ? new Date(afk.setAt).getTime() : Date.now());
        const duration = this.formatDuration(totalTime);

        const detailsText = lang.afk.delete.details
            .replace('{reason}', afk.reason || lang.none)
            .replace('{duration}', duration)
            .replace('{mentions}', afk.mentions?.count ?? 0);

        const deletedContainer = buildCard({
            title: lang.afk.delete.title.replace('{emoji}', getEmoji('delete')),
            sections: [
                lang.afk.delete.desc,
                detailsText
            ],
            thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
            accentColor: ACCENT.danger,
            footer: lang.afk.delete.footer.replace('{time}', new Date().toLocaleTimeString()),
        });

        await sendV2(interaction, deletedContainer);
    },

    async handleComponent(interaction) {
        return require('../../handlers/afkHandler').execute(interaction);
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