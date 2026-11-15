
const {
    SlashCommandBuilder,
    PermissionsBitField,
    ChannelType,
    AttachmentBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const TicketConfig = require('../../models/ticket/TicketConfig');
const TicketUserData = require('../../models/ticket/TicketUserData');
const ticketIcons = require('../../UI/icons/ticketicons');
const generateTranscript = require('../../utils/generateTranscript');
const setupBanners = require('../../UI/banners/SetupBanners');
const checkPermissions = require('../../utils/checkPermissions');
const { getTicketConfig, getTicketUserData, invalidateTicketConfig, invalidateTicketUserData } = require('../../utils/cacheHelpers');
const { buildCard, sendV2 } = require('../../UI');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const { reloadTicketConfig } = require('../../handlers/ticketHandler');
const lang = require('../../events/loadLanguage');

const config = require('../../config.js');


const getConfigValue = (key) => {
    return config[key];
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-ticket')
        .setDescription('Manage the ticket system')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a new ticket manually')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of ticket to create')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Support', value: 'support' },
                            { name: 'Suggestion', value: 'suggestion' },
                            { name: 'Feedback', value: 'feedback' },
                            { name: 'Report', value: 'report' }
                        ))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to create the ticket for (mod only)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Initial reason for the ticket')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Close a ticket')
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for closing the ticket')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('refresh')
                .setDescription('Refresh the ticket creation message in the ticket channel')
        ),

    async execute(interaction, client) {
        if (interaction.isCommand && interaction.isCommand()) {
            if (!await checkPermissions(interaction)) return;
            const { options, guild, user, channel, member } = interaction;
            const subCommand = options.getSubcommand();

            const config = await getTicketConfig(guild.id);
            if (!config) {
                return sendV2(interaction, buildCard({
                    title: lang.setups.manage.ticketTitle,
                    description: `${getEmoji('cross')} Ticket system is not configured for this server. Use \`/setup-ticket\` first.`,
                    tone: 'error'
                }), { ephemeral: true });
            }

            if (!config.status) {
                return sendV2(interaction, buildCard({
                    title: lang.setups.manage.ticketTitle,
                    description: `${getEmoji('cross')} Ticket system is currently disabled in this server.`,
                    tone: 'error'
                }), { ephemeral: true });
            }

            if (subCommand === 'refresh') {
                const ownerId = getConfigValue('ownerId');
                const adminRoleId = getConfigValue('adminRoleId');
                
                const hasPermission = member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
                    (ownerId && user.id === ownerId) ||
                    (adminRoleId && member.roles.cache.has(adminRoleId));

                if (!hasPermission) {
                    return sendV2(interaction, buildCard({
                        title: lang.setups.manage.ticketTitle,
                        description: `${getEmoji('cross')} You do not have permission to refresh the ticket message.`,
                        tone: 'error'
                    }), { ephemeral: true });
                }

                const ticketChannelId = getConfigValue('ticketChannelId');
                const ticketChannel = guild.channels.cache.get(ticketChannelId);
                if (!ticketChannel) {
                    return sendV2(interaction, buildCard({
                        title: lang.setups.manage.ticketTitle,
                        description: `${getEmoji('cross')} Configured ticket channel not found. Please check settings.`,
                        tone: 'error'
                    }), { ephemeral: true });
                }

                await reloadTicketConfig(guild.id, client);

                return sendV2(interaction, buildCard({
                    title: lang.setups.manage.ticketTitle,
                    description: `${getEmoji('tick')} Ticket creation message has been refreshed.`,
                    tone: 'success'
                }), { ephemeral: true });
            }

            if (subCommand === 'create') {
                const ticketType = options.getString('type');
                const targetUser = options.getUser('user') || user;
                const reason = options.getString('reason');

                if (targetUser.id !== user.id) {
                    const ownerId = getConfigValue('ownerId');
                    const adminRoleId = getConfigValue('adminRoleId');
                    
                    const hasPermission = member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
                        (ownerId && user.id === ownerId) ||
                        (adminRoleId && member.roles.cache.has(adminRoleId));

                    if (!hasPermission) {
                        return sendV2(interaction, buildCard({
                            title: lang.setups.manage.ticketTitle,
                            description: `${getEmoji('cross')} You do not have permission to create tickets for other users.`,
                            tone: 'error'
                        }), { ephemeral: true });
                    }
                }

                const existingTicket = await getTicketUserData(targetUser.id, guild.id);

                if (existingTicket) {
                    const existingChannel = guild.channels.cache.get(existingTicket.ticketChannelId);
                    if (existingChannel) {
                        return sendV2(interaction, buildCard({
                            title: lang.setups.manage.ticketTitle,
                            description: `${getEmoji('cross')} ${targetUser} already has an open ticket: <#${existingChannel.id}>`,
                            tone: 'error'
                        }), { ephemeral: true });
                    } else {
                        await TicketUserData.deleteOne({
                            userId: targetUser.id,
                            guildId: guild.id
                        });
                        invalidateTicketUserData(targetUser.id, guild.id);
                    }
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const ticketChannel = await guild.channels.create({
                    name: `${targetUser.username}-${ticketType}`,
                    type: ChannelType.GuildText,
                    parent: config.categoryId || null,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: targetUser.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        },
                        {
                            id: config.adminRoleId,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        }
                    ]
                });

                const newTicketData = await TicketUserData.create({
                    userId: targetUser.id,
                    guildId: guild.id,
                    ticketChannelId: ticketChannel.id
                });

                const cacheManager = require('../../utils/cacheManager');
                const key = `${targetUser.id}_${guild.id}`;
                cacheManager.set('ticketUserData', key, newTicketData);

                await sendTicketWelcomeMessage(ticketChannel, targetUser, reason, ticketType);

                return sendV2(interaction, buildCard({
                    title: lang.setups.manage.ticketTitle,
                    description: `${getEmoji('tick')} Ticket created successfully in <#${ticketChannel.id}>`,
                    tone: 'success'
                }), { ephemeral: true });
            }

            if (subCommand === 'close') {
                const ticketData = await TicketUserData.findOne({
                    ticketChannelId: channel.id,
                    guildId: guild.id
                });

                if (!ticketData) {
                    return sendV2(interaction, buildCard({
                        title: lang.setups.manage.ticketTitle,
                        description: lang.setups.manage.noTicketFound,
                        tone: 'error'
                    }), { ephemeral: true });
                }

                if (ticketData.userId !== user.id) {
                    const ownerId = getConfigValue('ownerId');
                    const adminRoleId = getConfigValue('adminRoleId');
                    
                    const hasPermission = member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
                        (ownerId && user.id === ownerId) ||
                        (adminRoleId && member.roles.cache.has(adminRoleId));

                    if (!hasPermission) {
                        return sendV2(interaction, buildCard({
                            title: lang.setups.manage.ticketTitle,
                            description: `${getEmoji('cross')} ${lang.setups.ticket.closeNoPermission}`,
                            tone: 'error'
                        }), { ephemeral: true });
                    }
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const reason = options.getString('reason') || lang.setups.ticket.noReasonProvided;
                const ticketOwner = await client.users.fetch(ticketData.userId).catch(() => null);

                const transcriptResult = await generateTranscript(channel, client);
                const transcriptAttachment = transcriptResult?.attachment || transcriptResult;

                if (ticketOwner && transcriptAttachment) {
                    const closeCard = buildCard({
                        title: lang.setups.ticket.ticketClosedTitle,
                        description: lang.setups.ticket.ticketClosedDesc.replace('{guild}', guild.name),
                        sections: [lang.setups.ticket.transcriptDmNotice],
                        fields: [{ name: lang.setups.ticket.closeReasonLabel, value: reason }],
                        footer: lang.setups.ticket.closeFooter,
                        tone: 'error'
                    });

                    await ticketOwner.send({
                        components: [closeCard],
                        files: [transcriptAttachment],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(err => {
                        console.warn(`Could not DM user ${ticketOwner.tag}:`, err.message);
                    });
                }

                
                if (config.transcriptChannelId && transcriptAttachment) {
                    const logChannel = guild.channels.cache.get(config.transcriptChannelId);
                    if (logChannel) {
                        const logCard = buildCard({
                            title: lang.setups.ticket.ticketClosedTitle,
                            sections: [lang.setups.ticket.logTranscriptNotice.replace('{name}', channel.name)],
                            fields: [
                                { name: lang.setups.ticket.ticketLabel, value: channel.name, inline: true },
                                { name: lang.setups.ticket.closedByLabel, value: user.tag, inline: true },
                                { name: lang.setups.ticket.closeReasonLabel, value: reason }
                            ],
                            tone: 'accent'
                        });

                        await logChannel.send({
                            components: [logCard],
                            files: [transcriptAttachment],
                            flags: MessageFlags.IsComponentsV2
                        });
                    }
                }

                await sendV2(interaction, buildCard({
                    title: lang.setups.manage.ticketTitle,
                    description: `${getEmoji('tick')} ${lang.setups.ticket.closingNotice}`,
                    tone: 'success'
                }), { ephemeral: true });

                
                setTimeout(async () => {
                    try {
                        await channel.delete();
                        await TicketUserData.deleteOne({ _id: ticketData._id });
                        invalidateTicketUserData(ticketData.userId, guild.id);
                    } catch (err) {
                        console.error('Error deleting ticket channel:', err);
                    }
                }, 5000);
            }
        } else {
            await sendV2(interaction, buildCard({
                title: lang.warning,
                description: lang.setups.ticket.manageUseSlash,
                tone: 'warning'
            }), { ephemeral: true });
        }
    }
};

async function sendTicketWelcomeMessage(channel, user, reason, ticketType) {
    const ticketId = `${user.id}-${channel.id}`;
    const capitalizedType = ticketType.charAt(0).toUpperCase() + ticketType.slice(1);
    const reasonText = reason ? lang.setups.ticket.reasonPrefix.replace('{reason}', reason) : '';
    const ticketCard = buildCard({
        title: `${getEmoji('settings')} ${lang.setups.ticket.typeTicketTitle.replace('{type}', capitalizedType)}`,
        tone: 'setup',
        sections: [
            lang.setups.ticket.typeTicketDesc.replace('{user}', `${user}`).replace('{reason}', reasonText)
        ],
        _footer: lang.setups.ticket.typeTicketFooter
    });

    const closeButton = new ButtonBuilder()
        .setCustomId(`close_ticket_${ticketId}`)
        .setLabel(lang.setups.ticket.btnCloseTicket)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(getButtonEmoji('cross'));

    const pingButton = new ButtonBuilder()
        .setCustomId(`ping_staff_${ticketId}`)
        .setLabel(lang.setups.ticket.btnPingStaff)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(getButtonEmoji('time'));

    const actionRow = new ActionRowBuilder().addComponents(closeButton, pingButton);
    ticketCard.addActionRowComponents(actionRow);

    await channel.send({
        content: `${user}`
    });

    await channel.send({
        components: [ticketCard],
        flags: MessageFlags.IsComponentsV2
    });

    const confirmCard = buildCard({
        title: `${getEmoji('tick')} ${lang.setups.ticket.ticketCreatedTitle}`,
        tone: 'success',
        sections: [
            `${lang.setups.ticket.ticketCreatedDesc.replace('{type}', capitalizedType)}\n**${lang.setups.ticket.ticketChannelLabel}:** ${channel.url}`
        ],
        _footer: lang.setups.ticket.ticketCreatedFooter
    });

    try {
        await user.send({ components: [confirmCard], flags: MessageFlags.IsComponentsV2 });
    } catch (e) {
        console.log(`Could not send DM to user ${user.tag || user.id}`);
    }
}