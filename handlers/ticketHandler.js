'use strict';

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    PermissionsBitField,
    ChannelType,
    MessageFlags
} = require('discord.js');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const lang = require('../events/loadLanguage');
const TicketConfig = require('../models/ticket/TicketConfig');
const TicketUserData = require('../models/ticket/TicketUserData');
const generateTranscript = require('../utils/generateTranscript');
const fs = require('fs').promises;
const path = require('path');
const setupBanners = require('../UI/banners/SetupBanners');
const { registerInteractionHandler } = require('../utils/interactionRouter');


const {
    getTicketConfig,
    getTicketUserData,
    invalidateTicketConfig,
    invalidateTicketUserData
} = require('../utils/cacheHelpers');
const cacheManager = require('../utils/cacheManager');

let initTimer = null;
let cleanupIntervalTimer = null;
let registeredClient = null;
let unregisterInteractionRoute = null;
const listeners = {};
const ticketCreationLocks = new Set();
const ticketClosingLocks = new Set();
const ticketPingLocks = new Set();

module.exports = (client) => {
    registeredClient = client;

    listeners.clientReady = async () => {
        initTimer = setTimeout(() => setupTicketChannels(client), 5000);
        if (initTimer?.unref) initTimer.unref();

        cleanupIntervalTimer = setInterval(() => cleanupStaleTickets(client), 15 * 60 * 1000);
        if (cleanupIntervalTimer?.unref) cleanupIntervalTimer.unref();
    };

    listeners.interactionCreate = async (interaction) => {
        
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
            await handleTicketCreation(interaction, client, interaction.values[0]);
        }
        
        else if (interaction.isButton() && interaction.customId.startsWith('create_ticket_')) {
            const ticketType = interaction.customId.replace('create_ticket_', '');
            await handleTicketCreation(interaction, client, ticketType);
        }
        
        else if (interaction.isButton() && interaction.customId.startsWith('close_ticket_')) {
            await handleTicketClose(interaction, client);
        }
        
        else if (interaction.isButton() && interaction.customId.startsWith('ping_staff_')) {
            await handleStaffPing(interaction, client);
        }
    };

    listeners.guildDelete = async (guild) => {
        try {
            await TicketConfig.deleteOne({ serverId: guild.id });
            await TicketUserData.deleteMany({ guildId: guild.id });
            invalidateTicketConfig(guild.id);
            console.log(`Cleaned up ticket data for deleted guild: ${guild.name} (${guild.id})`);
        } catch (err) {
            console.error(`Error cleaning up data for deleted guild ${guild.id}:`, err);
        }
    };

    if (client) {
        client.on('clientReady', listeners.clientReady);
        unregisterInteractionRoute = registerInteractionHandler(client, {
            name: 'tickets',
            prefixes: ['select_ticket_type', 'create_ticket_', 'close_ticket_', 'ping_staff_'],
            types: ['button', 'stringSelect'],
            handler: listeners.interactionCreate
        });
        client.on('guildDelete', listeners.guildDelete);
    }
};

async function setupTicketChannels(client) {
    const allConfigs = await TicketConfig.find({ status: true });

    for (const config of allConfigs) {
        if (config.status && config.ticketChannelId) {
            const guild = client.guilds.cache.get(config.serverId);
            if (!guild) continue;

            const ticketChannel = guild.channels.cache.get(config.ticketChannelId);
            if (!ticketChannel) continue;

            try {
                const messages = await ticketChannel.messages.fetch({ limit: 10 });
                const botMessages = messages.filter(m =>
                    m.author.bot &&
                    m.embeds.length > 0 &&
                    (m.embeds[0].data?.author?.name === lang.setups.ticket.welcomeTitle ||
                        m.components?.length > 0)
                );

                if (botMessages.size === 0) {
                    await sendTicketEmbed(ticketChannel, config);
                    console.log(`Initialized ticket embed in channel ${ticketChannel.name} (${ticketChannel.id})`);
                }
            } catch (err) {
                console.error(`Error checking for ticket embeds in guild ${config.serverId}:`, err);
            }
        }
    }
}

function buildTicketCard(config) {
    const customEmbed = config.customEmbed;

    if (customEmbed && (customEmbed.title || customEmbed.description || customEmbed.author?.name)) {
        const sections = [];
        if (customEmbed.description) sections.push(customEmbed.description);
        if (customEmbed.fields && customEmbed.fields.length > 0) {
            const fieldsText = customEmbed.fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n');
            if (fieldsText) sections.push(fieldsText);
        }

        let accentColor = ACCENT.primary;
        if (customEmbed.color) {
            try {
                accentColor = typeof customEmbed.color === 'string' && customEmbed.color.startsWith('#')
                    ? parseInt(customEmbed.color.replace('#', ''), 16)
                    : Number(customEmbed.color);
            } catch (e) {
                accentColor = ACCENT.primary;
            }
        }

        return buildCard({
            title: customEmbed.title || lang.setups.ticket.title,
            sections: sections.length ? sections : ['\u200b'],
            thumbnailURL: customEmbed.thumbnail?.url || null,
            bannerURL: customEmbed.image?.url || null,
            accentColor,
            _footer: customEmbed.footer?.text || null
        });
    }

    
    return buildCard({
        title: `${getEmoji('settings')} ${lang.setups.ticket.welcomeTitle}`,
        tone: 'setup',
        sections: [lang.setups.ticket.welcomeDesc],
        bannerURL: setupBanners.ticketBanner,
        _footer: lang.setups.ticket.welcomeFooter
    });
}

const buildTicketEmbed = buildTicketCard;

function buildTicketComponent(config) {
    const interactionType = config.interactionType || 'dropdown';
    const ticketOptions = config.ticketOptions && config.ticketOptions.length > 0
        ? config.ticketOptions
        : [
            { label: 'Support', value: 'support', description: 'Get help from our team', emoji: getButtonEmoji('help') },
            { label: 'Suggestion', value: 'suggestion', description: 'Share your ideas', emoji: getButtonEmoji('sfolder1') },
            { label: 'Feedback', value: 'feedback', description: 'Give us feedback', emoji: getButtonEmoji('heart') },
            { label: 'Report', value: 'report', description: 'Report an issue', emoji: getButtonEmoji('warning') }
        ];

    if (interactionType === 'button') {
        const firstOption = ticketOptions[0];
        const button = new ButtonBuilder()
            .setCustomId(`create_ticket_${firstOption.value}`)
            .setLabel(firstOption.label || lang.setups.ticket.ticketLabel)
            .setStyle(ButtonStyle.Primary);

        if (firstOption.emoji) {
            button.setEmoji(firstOption.emoji);
        }

        return new ActionRowBuilder().addComponents(button);
    }

    
    const selectOptions = ticketOptions.slice(0, 10).map(opt => {
        const option = {
            label: opt.label,
            value: opt.value
        };
        if (opt.description) option.description = opt.description;
        if (opt.emoji) option.emoji = opt.emoji;
        return option;
    });

    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_ticket_type')
        .setPlaceholder(lang.setups.ticket.chooseTypePlaceholder)
        .addOptions(selectOptions);

    return new ActionRowBuilder().addComponents(menu);
}

async function sendTicketEmbed(channel, config) {
    const card = buildTicketCard(config);
    const row = buildTicketComponent(config);
    card.addActionRowComponents(row);

    try {
        return await channel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
        console.error(`Error sending ticket card to channel ${channel.id}:`, err);
        return null;
    }
}

async function handleTicketCreation(interaction, client, ticketType) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const lockKey = `${interaction.guild?.id || 'unknown'}:${interaction.user.id}`;
    if (ticketCreationLocks.has(lockKey)) {
        const card = buildCard({ title: 'Ticket already being created', tone: 'warning', sections: ['A ticket is already being created for you. Please wait.'] });
        return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }
    ticketCreationLocks.add(lockKey);
    try {
        await processTicketCreation(interaction, client, ticketType);
    } finally {
        ticketCreationLocks.delete(lockKey);
    }
}

async function processTicketCreation(interaction, client, ticketType) {

    const { guild, user } = interaction;
    const config = await getTicketConfig(guild.id);

    if (!config || !config.status) {
        const disabledCard = buildCard({
            title: `${getEmoji('warning')} ${lang.setups.ticket.title}`,
            tone: 'warning',
            sections: [lang.setups.ticket.disabledNotice]
        });
        return interaction.editReply({ components: [disabledCard], flags: MessageFlags.IsComponentsV2 });
    }

    
    const existingTicket = await getTicketUserData(user.id, guild.id);

    if (existingTicket) {
        const existingChannel = guild.channels.cache.get(existingTicket.ticketChannelId);
        if (existingChannel) {
            const alreadyOpenCard = buildCard({
                title: `${getEmoji('cross')} ${lang.setups.ticket.ticketLabel}`,
                tone: 'danger',
                sections: [lang.setups.ticket.alreadyOpen.replace('{channel}', existingChannel.id)]
            });
            return interaction.editReply({ components: [alreadyOpenCard], flags: MessageFlags.IsComponentsV2 });
        } else {
            
            await TicketUserData.deleteOne({ _id: existingTicket._id });
            invalidateTicketUserData(user.id, guild.id);
        }
    }

    
    try {
        const ticketOptions = config.ticketOptions || [];
        const selectedOption = ticketOptions.find(opt => opt.value === ticketType);
        const ticketLabel = selectedOption?.label || ticketType.charAt(0).toUpperCase() + ticketType.slice(1);

        const permissionOverwrites = [
            {
                id: guild.roles.everyone,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: user.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                ]
            }
        ];

        if (config.adminRoleId && guild.roles.cache.has(config.adminRoleId)) {
            permissionOverwrites.push({
                id: config.adminRoleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                ]
            });
        }

        const ticketChannel = await guild.channels.create({
            name: `${user.username}-${ticketType}`,
            type: ChannelType.GuildText,
            parent: config.categoryId || null,
            permissionOverwrites
        });

        
        let newTicketData;
        try {
            newTicketData = await TicketUserData.create({
                userId: user.id,
                guildId: guild.id,
                ticketChannelId: ticketChannel.id
            });
        } catch (err) {
            
            
            await ticketChannel.delete().catch(() => {});
            if (err.code === 11000) {
                invalidateTicketUserData(user.id, guild.id);
                const existing = await getTicketUserData(user.id, guild.id);
                const existingChannel = existing && guild.channels.cache.get(existing.ticketChannelId);
                if (existingChannel) {
                    const alreadyOpenCard = buildCard({
                        title: `${getEmoji('cross')} ${lang.setups.ticket.ticketLabel}`,
                        tone: 'danger',
                        sections: [lang.setups.ticket.alreadyOpen.replace('{channel}', existingChannel.id)]
                    });
                    return interaction.editReply({ components: [alreadyOpenCard], flags: MessageFlags.IsComponentsV2 });
                }
            }
            throw err;
        }

        const key = `${user.id}_${guild.id}`;
        cacheManager.set('ticketUserData', key, newTicketData);

        
        const ticketId = `${user.id}-${ticketChannel.id}`;
        const ticketCard = buildCard({
            title: `${getEmoji('settings')} ${lang.setups.ticket.typeTicketTitle.replace('{type}', ticketLabel)}`,
            tone: 'setup',
            sections: [
                lang.setups.ticket.typeTicketDesc.replace('{user}', `${user}`).replace('{reason}', '')
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

        await ticketChannel.send({
            content: `${user}`
        });

        await ticketChannel.send({
            components: [ticketCard],
            flags: MessageFlags.IsComponentsV2
        });

        
        try {
            const confirmCard = buildCard({
                title: `${getEmoji('tick')} ${lang.setups.ticket.ticketCreatedTitle}`,
                tone: 'success',
                sections: [
                    `${lang.setups.ticket.ticketCreatedDesc.replace('{type}', ticketLabel)}\n**${lang.setups.ticket.ticketChannelLabel}:** ${ticketChannel.url}`
                ],
                _footer: lang.setups.ticket.ticketCreatedFooter
            });

            await user.send({ components: [confirmCard], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.log(`Could not send DM to user ${user.tag}`);
        }

        const createdSuccessCard = buildCard({
            title: `${getEmoji('tick')} ${lang.setups.ticket.ticketCreatedTitle}`,
            tone: 'success',
            sections: [
                lang.setups.ticket.createdSuccess.replace('{channel}', ticketChannel.id)
            ]
        });

        await interaction.editReply({
            components: [createdSuccessCard],
            flags: MessageFlags.IsComponentsV2
        });

    } catch (err) {
        console.error(`Error creating ticket for ${user.tag}:`, err);
        const createErrCard = buildCard({
            title: `${getEmoji('cross')} ${lang.setups.ticket.title}`,
            tone: 'danger',
            sections: [lang.setups.ticket.createError]
        });
        return interaction.editReply({
            components: [createErrCard],
            flags: MessageFlags.IsComponentsV2
        });
    }
}

async function handleTicketClose(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const lockKey = `${interaction.guild?.id || 'unknown'}:${interaction.channelId}`;
    if (ticketClosingLocks.has(lockKey)) {
        const card = buildCard({ title: 'Ticket already closing', tone: 'warning', sections: ['This ticket is already closing. Please wait.'] });
        return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }
    ticketClosingLocks.add(lockKey);
    let closingScheduled = false;
    try {
        closingScheduled = await processTicketClose(interaction, client, lockKey);
    } finally {
        if (!closingScheduled) ticketClosingLocks.delete(lockKey);
    }
}

async function processTicketClose(interaction, client, lockKey) {

    const ticketId = interaction.customId.replace('close_ticket_', '');
    const [userId, channelId] = ticketId.split('-');
    const { guild, user } = interaction;

    const config = await getTicketConfig(guild.id);

    if (!config) {
        const noConfigCard = buildCard({
            title: `${getEmoji('cross')} ${lang.setups.ticket.title}`,
            tone: 'danger',
            sections: [lang.setups.ticket.noConfig]
        });
        return interaction.editReply({ components: [noConfigCard], flags: MessageFlags.IsComponentsV2 });
    }

    const ticketData = await getTicketUserData(userId, guild.id);
    if (
        !userId || !channelId || interaction.channelId !== channelId ||
        ticketData?.ticketChannelId !== channelId
    ) {
        const invalidTicketCard = buildCard({
            title: `${getEmoji('warning')} ${lang.setups.ticket.title}`,
            tone: 'warning',
            sections: [lang.setups.ticket.noTicketFound]
        });
        return interaction.editReply({ components: [invalidTicketCard], flags: MessageFlags.IsComponentsV2 });
    }

    
    const isTicketOwner = userId === user.id;
    const isAdmin = interaction.member.roles.cache.has(config.adminRoleId) ||
        user.id === config.ownerId ||
        interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

    if (!isTicketOwner && !isAdmin) {
        const noPermCard = buildCard({
            title: `${getEmoji('cross')} ${lang.setups.ticket.closeNoPermissionTitle}`,
            tone: 'danger',
            sections: [lang.setups.ticket.closeNoPermission]
        });
        return interaction.editReply({ components: [noPermCard], flags: MessageFlags.IsComponentsV2 });
    }

    const closeClaimTime = new Date();
    const ticketCloseClaim = await TicketUserData.findOneAndUpdate(
        {
            userId,
            guildId: guild.id,
            ticketChannelId: channelId,
            $or: [
                { closingAt: null },
                { closingAt: { $lt: new Date(closeClaimTime.getTime() - 15 * 60 * 1000) } }
            ]
        },
        { $set: { closingAt: closeClaimTime } },
        { returnDocument: 'after' }
    );
    if (!ticketCloseClaim) {
        const alreadyClosingCard = buildCard({
            title: 'Ticket already closing',
            tone: 'warning',
            sections: ['This ticket is already closing. Please wait.']
        });
        return interaction.editReply({ components: [alreadyClosingCard], flags: MessageFlags.IsComponentsV2 });
    }

    
    try {
        const { attachment, fileName } = await generateTranscript(interaction.channel, client);

        
        const ticketOwner = client.users.cache.get(userId) || await client.users.fetch(userId).catch(() => null);
        if (ticketOwner) {
            const dmCard = buildCard({
                title: `${getEmoji('tick')} ${lang.setups.ticket.ticketClosedTitle}`,
                tone: 'info',
                sections: [
                    lang.setups.ticket.ticketClosedDesc.replace('{guild}', guild.name),
                    lang.setups.ticket.transcriptDmNotice
                ],
                _footer: lang.setups.ticket.closeFooter
            });

            try {
                const dmMessage = await ticketOwner.send({
                    components: [dmCard],
                    flags: MessageFlags.IsComponentsV2,
                    files: [attachment]
                });

                const fileUrl = dmMessage.attachments.first()?.url;
                if (fileUrl) {
                    await ticketOwner.send(lang.setups.ticket.viewTranscriptNotice.replace('{url}', fileUrl));
                }

            } catch (err) {
                console.warn(`Could not DM user ${ticketOwner.tag}:`, err.message);
            }
        }

        
        if (config.transcriptChannelId) {
            const logChannel = guild.channels.cache.get(config.transcriptChannelId);
            if (logChannel) {
                const logCard = buildCard({
                    title: `${getEmoji('settings')} ${lang.setups.ticket.ticketClosedTitle}`,
                    tone: 'info',
                    sections: [
                        lang.setups.ticket.logTranscriptNotice.replace('{name}', interaction.channel.name),
                        `**${lang.setups.ticket.ticketLabel}:** ${interaction.channel.name}\n**${lang.setups.ticket.closedByLabel}:** ${user.tag}\n**${lang.setups.ticket.originalOwnerLabel}:** ${ticketOwner?.tag || lang.setups.ticket.unknownUser}`
                    ]
                });

                const logMsg = await logChannel.send({
                    components: [logCard],
                    flags: MessageFlags.IsComponentsV2,
                    files: [attachment]
                });

                const fileUrl = logMsg.attachments.first()?.url;
                if (fileUrl) {
                    await logChannel.send(lang.setups.ticket.viewTranscriptNotice.replace('{url}', fileUrl));
                }
            }
        }

        const closingCard = buildCard({
            title: `${getEmoji('tick')} ${lang.setups.ticket.ticketClosedTitle}`,
            tone: 'info',
            sections: [lang.setups.ticket.closingNotice]
        });

        await interaction.editReply({
            components: [closingCard],
            flags: MessageFlags.IsComponentsV2
        });

        setTimeout(async () => {
            try {
                const channel = await guild.channels.fetch(channelId).catch(() => null);
                if (channel) {
                    await channel.delete();
                    console.log(`Deleted ticket channel: ${channel.id}`);
                } else {
                    console.warn(`Channel ${channelId} not found. Possibly already deleted.`);
                }

                await TicketUserData.deleteOne({ userId, guildId: guild.id });
                invalidateTicketUserData(userId, guild.id);

                if (fileName) {
                    try {
                        const transcriptPath = path.join(__dirname, '..', 'transcripts', fileName);
                        await fs.unlink(transcriptPath).catch(() => { });
                    } catch (err) {
                        
                    }
                }
            } catch (err) {
                console.error("Error while closing ticket:", err);
            } finally {
                ticketClosingLocks.delete(lockKey);
            }
        }, 5000);
        return true;

    } catch (err) {
        await TicketUserData.findOneAndUpdate(
            { userId, guildId: guild.id, ticketChannelId: channelId, closingAt: closeClaimTime },
            { $set: { closingAt: null } }
        ).catch(() => {});
        console.error("Error generating transcript:", err);
        const closeErrCard = buildCard({
            title: `${getEmoji('cross')} ${lang.setups.ticket.ticketClosedTitle}`,
            tone: 'danger',
            sections: [lang.setups.ticket.closeError]
        });
        return interaction.editReply({
            components: [closeErrCard],
            flags: MessageFlags.IsComponentsV2
        });
    }
}

async function handleStaffPing(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const lockKey = `${interaction.guild?.id || 'unknown'}:${interaction.user.id}`;
    if (ticketPingLocks.has(lockKey)) {
        const card = buildCard({ title: 'Staff notification already in progress', tone: 'warning', sections: ['A staff notification is already being sent. Please wait.'] });
        return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }
    ticketPingLocks.add(lockKey);
    try {
        return await processStaffPing(interaction, client);
    } finally {
        ticketPingLocks.delete(lockKey);
    }
}

async function processStaffPing(interaction, client) {

    const { guild, channel, member } = interaction;
    const configEntry = await getTicketConfig(guild.id);

    if (!configEntry || !configEntry.adminRoleId) {
        const card = buildCard({
            title: `${getEmoji('warning')} ${lang.setups.ticket.staffRoleNotConfiguredTitle}`,
            tone: 'warning',
            sections: [lang.setups.ticket.staffRoleNotConfiguredDesc]
        });
        return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }

    const userData = await getTicketUserData(member.id, guild.id);
    if (!userData || userData.ticketChannelId !== channel.id) {
        const notTicketCard = buildCard({
            title: `${getEmoji('warning')} ${lang.setups.ticket.title}`,
            tone: 'warning',
            sections: [lang.setups.ticket.noTicketFound]
        });
        return interaction.editReply({ components: [notTicketCard], flags: MessageFlags.IsComponentsV2 });
    }
    const now = new Date();

    if (userData?.lastPing && (now - userData.lastPing < 6 * 60 * 60 * 1000)) {
        const nextPing = new Date(userData.lastPing.getTime() + 6 * 60 * 60 * 1000);
        const card = buildCard({
            title: `${getEmoji('time')} ${lang.setups.ticket.cooldownActive}`,
            tone: 'warning',
            sections: [lang.setups.ticket.staffPingCooldown.replace('{time}', Math.floor(nextPing.getTime() / 1000))]
        });
        return interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }

    const staffPingCard = buildCard({
        title: `${getEmoji('warning')} ${lang.setups.ticket.staffPingTitle}`,
        tone: 'warning',
        sections: [lang.setups.ticket.staffPingDesc.replace('{member}', `${member}`)],
        _footer: lang.setups.ticket.staffPingFooter
    });

    
    const cooldownCutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const updatedData = await TicketUserData.findOneAndUpdate(
        {
            userId: member.id,
            guildId: guild.id,
            $or: [
                { lastPing: null },
                { lastPing: { $lte: cooldownCutoff } }
            ]
        },
        { $set: { lastPing: now } },
        { returnDocument: 'after' }
    );

    if (!updatedData) {
        const latestData = await TicketUserData.findOne({ userId: member.id, guildId: guild.id });
        const lastPing = latestData?.lastPing;
        const nextPing = lastPing ? new Date(lastPing.getTime() + 6 * 60 * 60 * 1000) : null;
        const cooldownCard = buildCard({
            title: `${getEmoji('time')} ${lang.setups.ticket.cooldownActive}`,
            tone: 'warning',
            sections: [nextPing
                ? lang.setups.ticket.staffPingCooldown.replace('{time}', Math.floor(nextPing.getTime() / 1000))
                : lang.setups.ticket.noTicketFound]
        });
        return interaction.editReply({ components: [cooldownCard], flags: MessageFlags.IsComponentsV2 });
    }

    try {
        await channel.send({
            content: `<@&${configEntry.adminRoleId}>`
        });
        await channel.send({
            components: [staffPingCard],
            flags: MessageFlags.IsComponentsV2
        });
    } catch (err) {
        await TicketUserData.findOneAndUpdate(
            { userId: member.id, guildId: guild.id, lastPing: now },
            { $set: { lastPing: null } }
        ).catch(() => {});
        invalidateTicketUserData(member.id, guild.id);
        throw err;
    }

    const key = `${member.id}_${guild.id}`;
    cacheManager.set('ticketUserData', key, updatedData);

    const confirmationCard = buildCard({
        title: `${getEmoji('tick')} ${lang.setups.ticket.staffNotifiedTitle}`,
        tone: 'success',
        sections: [lang.setups.ticket.staffNotifiedDesc]
    });

    await interaction.editReply({ components: [confirmationCard], flags: MessageFlags.IsComponentsV2 });
}

let isCleaningTickets = false;
async function cleanupStaleTickets(client) {
    if (isCleaningTickets) return;
    isCleaningTickets = true;
    try {
        const allTickets = await TicketUserData.find({});
        let cleanedCount = 0;

        for (const ticket of allTickets) {
            const guild = client.guilds.cache.get(ticket.guildId);
            if (!guild) {
                await TicketUserData.deleteOne({ _id: ticket._id });
                invalidateTicketUserData(ticket.userId, ticket.guildId);
                cleanedCount++;
                continue;
            }

            const channel = guild.channels.cache.get(ticket.ticketChannelId);
            if (!channel) {
                await TicketUserData.deleteOne({ _id: ticket._id });
                invalidateTicketUserData(ticket.userId, ticket.guildId);
                cleanedCount++;
                console.log(`Cleaned up stale ticket for user ${ticket.userId} in guild ${ticket.guildId}`);
            }
        }

        if (cleanedCount > 0) {
            console.log(`[Ticket Cleanup] Removed ${cleanedCount} stale ticket records`);
        }
    } catch (err) {
        console.error('[Ticket Cleanup] Error during cleanup:', err);
    } finally {
        isCleaningTickets = false;
    }
}

function clearTicketCache(guildId) {
    invalidateTicketConfig(guildId);
    try {
        const cache = cacheManager.caches.get('ticketUserData');
        if (cache && cache.data) {
            for (const [key] of cache.data.entries()) {
                if (key.endsWith(`_${guildId}`)) {
                    cacheManager.delete('ticketUserData', key);
                }
            }
        }
    } catch (err) {
        console.error('[Ticket Cache] Error clearing cache:', err);
    }
}

module.exports.reloadTicketConfig = async function (serverId, client) {
    console.log(`[TicketHandler] Reloading ticket config for server: ${serverId}`);
    invalidateTicketConfig(serverId);

    const updatedConfig = await getTicketConfig(serverId);
    if (!updatedConfig) {
        console.warn(`[TicketHandler] No config found for server ${serverId}`);
        return;
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) return;

    const ticketChannel = guild.channels.cache.get(updatedConfig.ticketChannelId);
    if (!ticketChannel) return;

    try {
        const messages = await ticketChannel.messages.fetch({ limit: 10 });

        const oldEmbeds = messages.filter(m =>
            m.author.bot &&
            (m.flags?.has(MessageFlags.IsComponentsV2) || m.components?.length > 0 || m.embeds?.length > 0)
        );

        for (const [, msg] of oldEmbeds) {
            try {
                await msg.delete();
            } catch (err) {
                console.warn(`Could not delete old embed: ${err.message}`);
            }
        }

        await sendTicketEmbed(ticketChannel, updatedConfig);
        console.log(`[TicketHandler] Ticket embed refreshed in channel ${ticketChannel.id}`);
    } catch (err) {
        console.error(`[TicketHandler] Error refreshing ticket embed for ${serverId}:`, err);
    }
};

function stop(clientInstance) {
    const targetClient = clientInstance || registeredClient;
    if (initTimer) {
        clearTimeout(initTimer);
        initTimer = null;
    }
    if (cleanupIntervalTimer) {
        clearInterval(cleanupIntervalTimer);
        cleanupIntervalTimer = null;
    }
    if (targetClient && listeners.clientReady) {
        targetClient.off('clientReady', listeners.clientReady);
        targetClient.off('guildDelete', listeners.guildDelete);
    }
    unregisterInteractionRoute?.();
    unregisterInteractionRoute = null;
}

module.exports.buildTicketCard = buildTicketCard;
module.exports.sendTicketEmbed = sendTicketEmbed;
module.exports.clearTicketCache = clearTicketCache;
module.exports.stop = stop;
