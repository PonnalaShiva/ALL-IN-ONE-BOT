


'use strict';

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const ModMailConfig = require('../../models/modmail/ModMailConfig');
const ModMailThread = require('../../models/modmail/ModMailThread');
const ModMailStats = require('../../models/modmail/ModMailStats');
const checkPermissions = require('../../utils/checkPermissions');
const { invalidateModMailConfig } = require('../../utils/cacheHelpers');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        modmail: createInterpolatableProxy(rawLang.setups?.modmail),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-modmail')
        .setDescription('Manage the advanced mod mail system configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('configure')
                .setDescription('Set up or update mod mail configuration')
                .addChannelOption(opt =>
                    opt.setName('log_channel')
                        .setDescription('Channel for modmail threads')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addRoleOption(opt =>
                    opt.setName('admin_role')
                        .setDescription('Role for managing modmail')
                        .setRequired(true))
                .addBooleanOption(opt =>
                    opt.setName('status')
                        .setDescription('Enable or disable modmail')
                        .setRequired(true))
                .addChannelOption(opt =>
                    opt.setName('category')
                        .setDescription('Category for modmail threads (optional)')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('settings')
                .setDescription('Configure advanced modmail settings')
                .addIntegerOption(opt =>
                    opt.setName('max_tickets')
                        .setDescription('Maximum open tickets per user (1-10)')
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false))
                .addIntegerOption(opt =>
                    opt.setName('cooldown')
                        .setDescription('Cooldown between tickets in minutes (1-60)')
                        .setMinValue(1)
                        .setMaxValue(60)
                        .setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('auto_response')
                        .setDescription('Send automatic welcome message')
                        .setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('allow_attachments')
                        .setDescription('Allow file attachments in modmail')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('welcome')
                .setDescription('Set custom welcome message')
                .addStringOption(opt =>
                    opt.setName('message')
                        .setDescription('Welcome message (max 1000 characters)')
                        .setMaxLength(1000)
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current modmail configuration')
        )
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('View modmail statistics')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete the entire modmail configuration for this server')
        ),

    async execute(interaction) {
        if (!interaction.isChatInputCommand || !interaction.isChatInputCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.modmail.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        try {
            switch (subcommand) {
                case 'configure':
                    return await handleConfigure(interaction, guildId);
                case 'settings':
                    return await handleSettings(interaction, guildId);
                case 'welcome':
                    return await handleWelcome(interaction, guildId);
                case 'view':
                    return await handleView(interaction, guildId);
                case 'stats':
                    return await handleStats(interaction, guildId);
                case 'delete':
                    return await handleDelete(interaction, guildId);
            }
        } catch (error) {
            console.error('[Setup-ModMail] Error:', error);
            return sendV2(interaction, cards.error(lang.setups.modmail.title, lang.setups.modmail.error));
        }
    },

    handleComponent: (interaction) => require('../../handlers/modMailHandler').handleComponent(interaction)
};

async function handleConfigure(interaction, guildId) {
    const logChannel = interaction.options.getChannel('log_channel');
    const adminRole = interaction.options.getRole('admin_role');
    const category = interaction.options.getChannel('category');
    const status = interaction.options.getBoolean('status');

    const botMember = interaction.guild.members.me;
    if (!logChannel.permissionsFor(botMember).has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.ManageThreads
    ])) {
        return sendV2(interaction, cards.error(lang.setups.modmail.title, lang.setups.modmail.insufficientPermissions));
    }

    await ModMailConfig.findOneAndUpdate(
        { guildId },
        {
            guildId,
            logChannelId: logChannel.id,
            adminRoleId: adminRole.id,
            categoryId: category?.id || null,
            status,
            ownerId: interaction.guild.ownerId,
            updatedAt: new Date()
        },
        { upsert: true, returnDocument: 'after' }
    );

    invalidateModMailConfig(guildId);

    const statusText = status ? lang.setups.modmail.enabled : lang.setups.modmail.disabled;
    const categoryText = category ? category.toString() : lang.setups.modmail.none;

    const card = buildCard({ accent: status ? ACCENT.success : ACCENT.warning })
        .addText(`**${lang.setups.modmail.title}**`)
        .addSeparator()
        .addText(lang.setups.modmail.configured({ status: statusText }))
        .addSeparator()
        .addText(
            `• **${lang.setups.modmail.logChannelLabel}:** ${logChannel}\n` +
            `• **${lang.setups.modmail.adminRoleLabel}:** ${adminRole}\n` +
            `• **${lang.setups.modmail.categoryLabel}:** ${categoryText}`
        );

    return sendV2(interaction, card);
}

async function handleSettings(interaction, guildId) {
    const updates = {};
    const maxTickets = interaction.options.getInteger('max_tickets');
    const cooldown = interaction.options.getInteger('cooldown');
    const autoResponse = interaction.options.getBoolean('auto_response');
    const allowAttachments = interaction.options.getBoolean('allow_attachments');

    if (maxTickets !== null) updates.maxOpenTickets = maxTickets;
    if (cooldown !== null) updates.cooldownTime = cooldown * 60000;
    if (autoResponse !== null) updates.autoResponse = autoResponse;
    if (allowAttachments !== null) updates.allowAttachments = allowAttachments;

    if (Object.keys(updates).length === 0) {
        return sendV2(interaction, cards.warning(lang.setups.modmail.title, lang.setups.modmail.provideAtLeastOne));
    }

    updates.updatedAt = new Date();
    await ModMailConfig.findOneAndUpdate({ guildId }, updates);
    invalidateModMailConfig(guildId);

    return sendV2(interaction, cards.success(lang.setups.modmail.title, lang.setups.modmail.settingsUpdated));
}

async function handleWelcome(interaction, guildId) {
    const message = interaction.options.getString('message');

    await ModMailConfig.findOneAndUpdate(
        { guildId },
        { welcomeMessage: message, updatedAt: new Date() }
    );

    invalidateModMailConfig(guildId);

    const card = buildCard({ accent: ACCENT.success })
        .addText(`**${lang.setups.modmail.title}**`)
        .addSeparator()
        .addText(lang.setups.modmail.welcomeUpdated)
        .addSeparator()
        .addText(`• **${lang.setups.modmail.welcomeMessageLabel}:**\n${message}`);

    return sendV2(interaction, card);
}

async function handleView(interaction, guildId) {
    const config = await ModMailConfig.findOne({ guildId });
    if (!config) {
        return sendV2(interaction, cards.info(lang.setups.modmail.title, lang.setups.modmail.noConfig));
    }

    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
    const adminRole = interaction.guild.roles.cache.get(config.adminRoleId);
    const category = config.categoryId ? interaction.guild.channels.cache.get(config.categoryId) : null;

    const statusText = config.status ? lang.setups.modmail.enabled : lang.setups.modmail.disabled;
    const logText = logChannel ? logChannel.toString() : lang.setups.modmail.notSet;
    const adminText = adminRole ? adminRole.toString() : lang.setups.modmail.notSet;
    const categoryText = category ? category.toString() : lang.setups.modmail.none;
    const cooldownMins = (config.cooldownTime || 0) / 60000;

    const card = buildCard({ accent: ACCENT.info })
        .addText(`**${lang.setups.modmail.title}**`)
        .addSeparator()
        .addText(
            `• **${lang.setups.modmail.statusLabel}:** ${statusText}\n` +
            `• **${lang.setups.modmail.logChannelLabel}:** ${logText}\n` +
            `• **${lang.setups.modmail.adminRoleLabel}:** ${adminText}\n` +
            `• **${lang.setups.modmail.categoryLabel}:** ${categoryText}\n` +
            `• **${lang.setups.modmail.maxTicketsLabel}:** ${config.maxOpenTickets || 1}\n` +
            `• **${lang.setups.modmail.cooldownLabel}:** ${lang.setups.modmail.mins({ count: cooldownMins })}\n` +
            `• **${lang.setups.modmail.autoResponseLabel}:** ${config.autoResponse ? lang.setups.modmail.yes : lang.setups.modmail.no}\n` +
            `• **${lang.setups.modmail.allowAttachmentsLabel}:** ${config.allowAttachments ? lang.setups.modmail.yes : lang.setups.modmail.no}`
        );

    return sendV2(interaction, card);
}

async function handleStats(interaction, guildId) {
    const stats = await ModMailStats.findOne({ guildId });
    const totalThreads = await ModMailThread.countDocuments({ guildId });
    const openThreads = await ModMailThread.countDocuments({ guildId, status: 'open' });
    const closedThreads = await ModMailThread.countDocuments({ guildId, status: 'closed' });

    const card = buildCard({ accent: ACCENT.info })
        .addText(`**${lang.setups.modmail.statsTitle}**`)
        .addSeparator()
        .addText(
            `• **${lang.setups.modmail.totalTicketsLabel}:** ${totalThreads}\n` +
            `• **${lang.setups.modmail.openTicketsLabel}:** ${openThreads}\n` +
            `• **${lang.setups.modmail.closedTicketsLabel}:** ${closedThreads}\n` +
            `• **${lang.setups.modmail.totalMessagesLabel}:** ${stats?.totalMessages || 0}`
        );

    return sendV2(interaction, card);
}

async function handleDelete(interaction, guildId) {
    try {
        await ModMailConfig.deleteOne({ guildId });
        await ModMailThread.deleteMany({ guildId });
        await ModMailStats.deleteOne({ guildId });

        invalidateModMailConfig(guildId);

        const card = buildCard({ accent: ACCENT.danger })
            .addText(`**${lang.setups.modmail.deletedTitle}**`)
            .addSeparator()
            .addText(lang.setups.modmail.deletedDesc)
            .addSeparator()
            .addText(`*${lang.setups.modmail.deleteFooter}*`);

        return sendV2(interaction, card);
    } catch (error) {
        console.error('[Setup-ModMail] Error deleting configuration:', error);
        return sendV2(interaction, cards.error(lang.setups.modmail.title, lang.setups.modmail.deleteError));
    }
}
