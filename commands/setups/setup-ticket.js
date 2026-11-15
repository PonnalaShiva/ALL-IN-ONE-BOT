


'use strict';

const {
    SlashCommandBuilder,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const TicketConfig = require('../../models/ticket/TicketConfig');
const TicketUserData = require('../../models/ticket/TicketUserData');
const checkPermissions = require('../../utils/checkPermissions');
const { invalidateTicketConfig } = require('../../utils/cacheHelpers');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        ticket: createInterpolatableProxy(rawLang.setups?.ticket),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('Set or view the ticket channel configuration for the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the ticket and transcript channels')
                .addChannelOption(option =>
                    option.setName('ticket_channel')
                        .setDescription('Select the ticket creation channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('transcript_channel')
                        .setDescription('Channel to receive ticket transcripts')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('admin_role')
                        .setDescription('Role that can manage tickets')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable the ticket system')
                        .setRequired(true))        
                .addChannelOption(option =>
                    option.setName('ticket_category')
                        .setDescription('Ticket category for ticket channels')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the current ticket config')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete the ticket system configuration')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.ticket.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const { options, guild, user } = interaction;
        const sub = options.getSubcommand();
        const serverId = guild.id;

        if (sub === 'set') {
            const ticketChannel = options.getChannel('ticket_channel');
            const transcriptChannel = options.getChannel('transcript_channel');
            const adminRole = options.getRole('admin_role');
            const status = options.getBoolean('status');
            const category = options.getChannel('ticket_category');

            let categoryId = category?.id;

            if (!categoryId) {
                try {
                    const createdCategory = await guild.channels.create({
                        name: 'Tickets',
                        type: ChannelType.GuildCategory,
                        reason: 'Default ticket category created by bot'
                    });
                    categoryId = createdCategory.id;
                } catch (err) {
                    console.error('Failed to create default category:', err);
                    return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.ticket.categoryCreateError));
                }
            }

            await TicketConfig.findOneAndUpdate(
                { serverId },
                {
                    serverId,
                    guildId: serverId,
                    ticketChannelId: ticketChannel.id,
                    transcriptChannelId: transcriptChannel.id,
                    adminRoleId: adminRole.id,
                    status,
                    ownerId: guild.ownerId,
                    categoryId
                },
                { upsert: true, returnDocument: 'after' }
            );

            invalidateTicketConfig(serverId);

            if (status) {
                try {
                    const { reloadTicketConfig } = require('../../handlers/ticketHandler');
                    await reloadTicketConfig(serverId, interaction.client);
                } catch (err) {
                    console.error('Error sending ticket embed after setup:', err);
                }
            }

            const panelNotice = status ? lang.setups.ticket.panelSentNotice : '';
            const successMsg = lang.setups.ticket.updated({ guild: guild.name, panelNotice });
            return sendV2(interaction, cards.success(lang.setups.ticket.title, successMsg));
        }

        if (sub === 'view') {
            const config = await TicketConfig.findOne({ serverId });
            if (!config) {
                return sendV2(interaction, cards.warning(lang.setups.ticket.title, lang.setups.ticket.noConfig));
            }

            const statusDisplay = config.status ? lang.setups.ticket.statusEnabled : lang.setups.ticket.statusDisabled;
            const transcriptDisplay = config.transcriptChannelId ? `<#${config.transcriptChannelId}>` : lang.setups.ticket.notSet;
            const categoryDisplay = config.categoryId ? `<#${config.categoryId}>` : lang.setups.ticket.notSet;

            const card = buildCard({ accent: config.status ? ACCENT.success : ACCENT.warning })
                .addText(`**${lang.setups.ticket.title}**`)
                .addSeparator()
                .addText(
                    `• **${lang.setups.ticket.statusLabel}:** ${statusDisplay}\n` +
                    `• **${lang.setups.ticket.ticketChannelLabel}:** <#${config.ticketChannelId}>\n` +
                    `• **${lang.setups.ticket.transcriptChannelLabel}:** ${transcriptDisplay}\n` +
                    `• **${lang.setups.ticket.adminRoleLabel}:** <@&${config.adminRoleId}>\n` +
                    `• **${lang.setups.ticket.categoryLabel}:** ${categoryDisplay}`
                );

            return sendV2(interaction, card);
        }

        if (sub === 'delete') {
            const config = await TicketConfig.findOne({ serverId });
            if (!config) {
                return sendV2(interaction, cards.warning(lang.setups.ticket.title, lang.setups.ticket.noConfig));
            }

            const hasPermission = guild.ownerId === user.id || 
                                 interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

            if (!hasPermission) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.ticket.deletePermissionError));
            }

            const deletedTickets = await TicketUserData.deleteMany({ guildId: serverId });
            await TicketConfig.deleteOne({ serverId });
            invalidateTicketConfig(serverId);

            try {
                const ticketChannel = guild.channels.cache.get(config.ticketChannelId);
                if (ticketChannel) {
                    const messages = await ticketChannel.messages.fetch({ limit: 10 });
                    const botMessages = messages.filter(m => 
                        m.author.bot && 
                        m.embeds.length > 0 && 
                        m.embeds[0].data?.author?.name === "Welcome to Ticket Support"
                    );

                    if (botMessages.size > 0) {
                        await botMessages.first().delete().catch(() => {});
                    }
                }
            } catch (err) {
                console.error('Error deleting ticket embed:', err);
            }

            const card = buildCard({ accent: ACCENT.danger })
                .addText(`**${lang.setups.ticket.deletedTitle}**`)
                .addSeparator()
                .addText(lang.setups.ticket.deletedDesc({ count: deletedTickets.deletedCount }));

            return sendV2(interaction, card);
        }
    }
};
