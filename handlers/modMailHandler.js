


'use strict';

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    PermissionsBitField,
    ChannelType,
    AttachmentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');

const ModMailConfig = require('../models/modmail/ModMailConfig');
const ModMailThread = require('../models/modmail/ModMailThread');
const ModMailMessage = require('../models/modmail/ModMailMessage');
const ModMailStats = require('../models/modmail/ModMailStats');
const { getModMailConfig, invalidateModMailConfig } = require('../utils/cacheHelpers');
const { parseStaffAction } = require('../utils/modMailAuthorization');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const { buildCard, cards, sendV2, replyEphemeral, ACCENT } = require('../UI');
const loadLanguage = require('../events/loadLanguage');
const lang = new Proxy({}, {
    get(_, prop) {
        return loadLanguage().modmail?.[prop];
    }
});
const fs = require('fs').promises;
const path = require('path');

const inFlightInteractions = new Set();
const threadCreationLocks = new Set();
let handlerInstance = null;

class ModMailHandler {
    constructor(client) {
        if (handlerInstance) {
            return handlerInstance;
        }

        this.client = client;
        this.guildDeleteListener = guild => this.handleGuildDelete(guild);
        this.setupEventListeners();
        this.startCleanupInterval();
        handlerInstance = this;
    }

    setupEventListeners() {
        
        const messageMiddleware = require('../utils/messageMiddleware');
        this.unregisterMessageMiddleware = messageMiddleware.use(async (message, next) => {
            
            if (message.channel.type === ChannelType.DM && !message.author.bot) {
                await this.handleDMMessage(message);
                return true; 
            }
            
            
            if (message.channel.isThread() && !message.author.bot) {
                await this.handleThreadReply(message);
                return false; 
            }
            
            await next();
            return false;
        }, 5);
        
        this.client.on('guildDelete', this.guildDeleteListener);
    }

    startCleanupInterval() {
        
        let isClosingInactive = false;
        this.inactiveInterval = setInterval(async () => {
            if (isClosingInactive) return;
            isClosingInactive = true;
            try {
                const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
                const inactiveThreads = await ModMailThread.find({
                    status: 'open',
                    lastActivity: { $lt: sixHoursAgo }
                });

                for (const thread of inactiveThreads) {
                    await this.closeInactiveThread(thread);
                }
            } catch (error) {
                console.error('[ModMailHandler] Error in auto-close inactive threads:', error);
            } finally {
                isClosingInactive = false;
            }
        }, 30 * 60 * 1000);

        if (this.inactiveInterval.unref) {
            this.inactiveInterval.unref();
        }

        
        let isCleaningStale = false;
        this.staleInterval = setInterval(async () => {
            if (isCleaningStale) return;
            isCleaningStale = true;
            try {
                await this.cleanupStaleThreads();
            } finally {
                isCleaningStale = false;
            }
        }, 60 * 60 * 1000);
        if (this.staleInterval.unref) {
            this.staleInterval.unref();
        }
    }

    async getConfig(guildId) {
        try {
            const config = await getModMailConfig(guildId);
            return config && config.status ? config : null;
        } catch (error) {
            console.error('[ModMailHandler] Error getting config:', error);
            return null;
        }
    }

    stop() {
        if (this.inactiveInterval) clearInterval(this.inactiveInterval);
        if (this.staleInterval) clearInterval(this.staleInterval);
        this.inactiveInterval = null;
        this.staleInterval = null;
        this.unregisterMessageMiddleware?.();
        this.unregisterMessageMiddleware = null;
        this.client.off('guildDelete', this.guildDeleteListener);
        if (handlerInstance === this) handlerInstance = null;
    }

    async fetchGuildAdvanced(guildId) {
        const cleanGuildId = Array.isArray(guildId) ? guildId[0] : guildId;
        if (!cleanGuildId) return null;

        let guild = this.client.guilds.cache.get(cleanGuildId);
        if (guild) return guild;

        guild = this.client.guilds.cache.find(g => g.id === cleanGuildId || g.id.toString() === cleanGuildId.toString());
        if (guild) return guild;

        try {
            guild = await this.client.guilds.fetch(cleanGuildId).catch(() => null);
            if (guild) return guild;
        } catch (error) {
            
        }

        return null;
    }

    async fetchChannelAdvanced(guild, channelId) {
        if (!guild || !channelId) return null;

        const cleanChannelId = Array.isArray(channelId) ? channelId[0] : channelId;

        let channel = guild.channels.cache.get(cleanChannelId);
        if (channel) return channel;

        channel = guild.channels.cache.find(c => c.id === cleanChannelId || c.id.toString() === cleanChannelId.toString());
        if (channel) return channel;

        try {
            channel = await guild.channels.fetch(cleanChannelId).catch(() => null);
            if (channel) return channel;
        } catch (error) {
            
        }

        return null;
    }

    async handleDMMessage(message) {
        const user = message.author;
        const lang = loadLanguage().modmail;

        
        if (message.content.toLowerCase() === 'close') {
            const openThreads = await ModMailThread.find({ userId: user.id, status: 'open' });
            if (openThreads.length === 0) {
                const card = cards.error(lang.noOpenThreadsTitle, lang.noOpenThreadsDesc);
                return message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            }

            let closedCount = 0;
            for (const thread of openThreads) {
                if (await this.closeModMailThread(thread, user, 'Closed by user')) closedCount++;
            }

            if (closedCount === 0) {
                const card = cards.warning(lang.noOpenThreadsTitle, lang.noOpenThreadsDesc);
                return message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            }

            const card = cards.success(
                lang.threadsClosedTitle,
                (lang.threadsClosedDesc).replace('{count}', closedCount)
            );
            return message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

        
        const existingThreads = await ModMailThread.find({
            userId: user.id,
            status: 'open'
        });

        
        if (existingThreads.length > 0) {
            let forwardedCount = 0;
            for (const thread of existingThreads) {
                const guild = await this.fetchGuildAdvanced(thread.guildId);
                const channel = guild && await this.fetchChannelAdvanced(guild, thread.threadChannelId);
                if (channel) {
                    await this.forwardToStaff(message, channel, thread._id);
                    forwardedCount++;
                } else if (!thread.closingAt) {
                    await ModMailThread.deleteOne({ _id: thread._id, status: 'open', closingAt: null });
                }
            }

            if (forwardedCount > 0) {
                const closeBtn = new ButtonBuilder()
                    .setCustomId(`user_close_all_${user.id}_${Date.now()}`)
                    .setLabel(lang.buttons.closeAll)
                    .setStyle(ButtonStyle.Danger);
                const lockEmoji = getButtonEmoji('lock');
                if (lockEmoji) closeBtn.setEmoji(lockEmoji);

                const container = new ContainerBuilder()
                    .setAccentColor(ACCENT.success);

                container.addSectionComponents(
                    new SectionBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent([
                            `# ${getEmoji('tick')} ${lang.messageForwardedTitle}`,
                            '',
                            lang.messageForwardedDesc,
                            '',
                            `*Type \`close\` or click the button below to close all open threads.*`
                        ].join('\n'))
                    )
                );
                container.addActionRowComponents(new ActionRowBuilder().addComponents(closeBtn));

                return message.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }
        }

        
        const validGuilds = await this.getValidGuilds(user.id);
        if (validGuilds.length === 0) {
            const card = cards.error(
                lang.noAvailableServersTitle,
                lang.noAvailableServersDesc
            );
            return message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

        
        if (validGuilds.length > 0) {
            return this.showServerSelection(message, validGuilds);
        }
    }

    async getValidGuilds(userId) {
        const validGuilds = [];

        for (const [guildId, guild] of this.client.guilds.cache) {
            try {
                let member = guild.members.cache.get(userId);
                if (!member) {
                    try {
                        member = await guild.members.fetch(userId).catch(() => null);
                    } catch (error) {
                        continue;
                    }
                }

                if (!member) continue;

                const config = await this.getConfig(guildId);
                if (!config) continue;

                const openTickets = await ModMailThread.countDocuments({
                    userId,
                    guildId,
                    status: 'open'
                });

                if (openTickets >= (config.maxOpenTickets || 3)) {
                    continue;
                }

                validGuilds.push({
                    guildId,
                    name: guild.name,
                    icon: guild.iconURL(),
                    memberCount: guild.memberCount
                });
            } catch (error) {
                
            }
        }

        return validGuilds;
    }

    async showServerSelection(message, validGuilds) {
        const lang = loadLanguage().modmail;

        const container = new ContainerBuilder()
            .setAccentColor(ACCENT.info);

        const serverDescriptions = validGuilds.map(guild => 
            `• **${guild.name}** (${guild.memberCount.toLocaleString()} members)`
        ).join('\n');

        container.addSectionComponents(
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent([
                    `# ${getEmoji('modmail')} ${lang.selectServerTitle}`,
                    '',
                    lang.selectServerDesc,
                    '',
                    serverDescriptions,
                    '',
                    `*Your message will be delivered immediately upon selection.*`
                ].join('\n'))
            )
        );

        const options = validGuilds.slice(0, 25).map(guild => ({
            label: guild.name.substring(0, 100),
            description: `Contact staff in ${guild.name}`.substring(0, 100),
            value: guild.guildId
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`modmail_server_select_${message.author.id}_${message.id}`)
            .setPlaceholder(lang.selectServerPlaceholder)
            .addOptions(options);

        container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }

    async createModMailThread(message, guildId, category = 'general', priority = 'medium') {
        const cleanGuildId = Array.isArray(guildId) ? guildId[0] : guildId;
        const creationLockKey = `${message.author.id}:${cleanGuildId}`;
        if (threadCreationLocks.has(creationLockKey)) {
            const card = cards.warning('Support Request In Progress', 'Your support request is already opening. Please send your message again in a moment.');
            await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return null;
        }
        threadCreationLocks.add(creationLockKey);
        try {
            const lang = loadLanguage(cleanGuildId).modmail;

            const guild = await this.fetchGuildAdvanced(cleanGuildId);
            if (!guild) {
                throw new Error(`Guild ${cleanGuildId} not found`);
            }

            const config = await this.getConfig(cleanGuildId);
            if (!config) {
                throw new Error(`Config not found for guild ${cleanGuildId}`);
            }

            const existingThread = await ModMailThread.findOne({ userId: message.author.id, guildId: cleanGuildId.toString(), status: 'open' });
            if (existingThread) {
                const existingChannel = await this.fetchChannelAdvanced(guild, existingThread.threadChannelId);
                if (existingChannel) {
                    await this.forwardToStaff(message, existingChannel, existingThread._id);
                    return existingThread;
                }
                await ModMailThread.deleteOne({ _id: existingThread._id, status: 'open' });
            }

            const logChannel = await this.fetchChannelAdvanced(guild, config.logChannelId);
            if (!logChannel) {
                throw new Error(`Log channel not found`);
            }

            const threadName = `modmail-${message.author.username}-${Date.now().toString().slice(-6)}`;
            let threadChannel;

            if (config.categoryId && config.categoryId.trim() !== '') {
                const categoryChannel = await this.fetchChannelAdvanced(guild, config.categoryId);

                if (categoryChannel && categoryChannel.type === ChannelType.GuildCategory) {
                    try {
                        threadChannel = await guild.channels.create({
                            name: threadName,
                            type: ChannelType.GuildText,
                            parent: categoryChannel.id,
                            topic: `ModMail thread for ${message.author.tag} (${message.author.id})`,
                            permissionOverwrites: [
                                {
                                    id: guild.id,
                                    deny: [PermissionsBitField.Flags.ViewChannel]
                                },
                                {
                                    id: config.adminRoleId,
                                    allow: [
                                        PermissionsBitField.Flags.ViewChannel,
                                        PermissionsBitField.Flags.SendMessages,
                                        PermissionsBitField.Flags.ManageMessages,
                                        PermissionsBitField.Flags.EmbedLinks,
                                        PermissionsBitField.Flags.AttachFiles
                                    ]
                                }
                            ]
                        });
                    } catch (channelCreateError) {
                        threadChannel = await logChannel.threads.create({
                            name: threadName,
                            autoArchiveDuration: 4320,
                            reason: `ModMail from ${message.author.tag}`
                        });
                    }
                } else {
                    threadChannel = await logChannel.threads.create({
                        name: threadName,
                        autoArchiveDuration: 4320,
                        reason: `ModMail from ${message.author.tag}`
                    });
                }
            } else {
                threadChannel = await logChannel.threads.create({
                    name: threadName,
                    autoArchiveDuration: 4320,
                    reason: `ModMail from ${message.author.tag}`
                });
            }

            const thread = new ModMailThread({
                userId: message.author.id,
                guildId: cleanGuildId.toString(),
                threadChannelId: threadChannel.id,
                category,
                priority,
                openedBy: message.author.id,
                openedAt: new Date(),
                lastActivity: new Date()
            });

            try {
                await thread.save();
            } catch (error) {
                if (error.code === 11000) {
                    await threadChannel.delete().catch(() => {});
                    const winnerThread = await ModMailThread.findOne({ userId: message.author.id, guildId: cleanGuildId.toString(), status: 'open' });
                    const winnerChannel = winnerThread && await this.fetchChannelAdvanced(guild, winnerThread.threadChannelId);
                    if (winnerThread && winnerChannel) {
                        await this.forwardToStaff(message, winnerChannel, winnerThread._id);
                        return winnerThread;
                    }
                }
                throw error;
            }

            
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            const staffContainer = new ContainerBuilder()
                .setAccentColor(ACCENT.info);

            staffContainer.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent([
                            `# ${getEmoji('modmail')} New ModMail — **${category.toUpperCase()}**`,
                            `### User Support Thread`,
                            `> Thread Type: **${threadChannel.isThread() ? 'Forum / Thread' : 'Text Channel'}** • Priority: **${priority.toUpperCase()}**`
                        ].join('\n'))
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder()
                            .setURL(message.author.displayAvatarURL())
                            .setDescription(`${message.author.username} avatar`)
                    )
            );

            staffContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

            const staffFields = [
                `**User:** <@${message.author.id}> (\`${message.author.tag || message.author.username}\`)`,
                `**Account Created:** <t:${Math.floor(message.author.createdTimestamp / 1000)}:R>`,
                `**Server Priority:** \`${priority.toUpperCase()}\``
            ];

            if (member) {
                staffFields.push(`**Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`);
                const rolesText = member.roles.cache.size > 1 ?
                    member.roles.cache.filter(r => r.id !== guild.id)
                        .sort((a, b) => b.position - a.position)
                        .map(r => `<@&${r.id}>`)
                        .slice(0, 8)
                        .join(', ') : 'None';
                staffFields.push(`**Roles:** ${rolesText}`);
            }

            staffContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(staffFields.join('\n')));

            
            const replyBtn = new ButtonBuilder()
                .setCustomId(`reply_modmail_${thread._id}_${message.author.id}`)
                .setLabel(lang.buttons.reply)
                .setStyle(ButtonStyle.Primary);
            const replyEmoji = getButtonEmoji('reply');
            if (replyEmoji) replyBtn.setEmoji(replyEmoji);

            const anonBtn = new ButtonBuilder()
                .setCustomId(`anon_reply_${thread._id}_${message.author.id}`)
                .setLabel(lang.buttons.anonReply)
                .setStyle(ButtonStyle.Secondary);
            const anonEmoji = getButtonEmoji('anon');
            if (anonEmoji) anonBtn.setEmoji(anonEmoji);

            const priorityBtn = new ButtonBuilder()
                .setCustomId(`priority_modmail_${thread._id}_${cleanGuildId}`)
                .setLabel(lang.buttons.priority)
                .setStyle(ButtonStyle.Secondary);
            const priorityEmoji = getButtonEmoji('priority');
            if (priorityEmoji) priorityBtn.setEmoji(priorityEmoji);

            const noteBtn = new ButtonBuilder()
                .setCustomId(`add_modmail_note_${thread._id}_${cleanGuildId}`)
                .setLabel(lang.buttons.note)
                .setStyle(ButtonStyle.Secondary);
            const noteEmoji = getButtonEmoji('note');
            if (noteEmoji) noteBtn.setEmoji(noteEmoji);

            const closeBtn = new ButtonBuilder()
                .setCustomId(`close_modmail_${thread._id}_${cleanGuildId}`)
                .setLabel(lang.buttons.close)
                .setStyle(ButtonStyle.Danger);
            const closeEmoji = getButtonEmoji('lock');
            if (closeEmoji) closeBtn.setEmoji(closeEmoji);

            staffContainer.addActionRowComponents(
                new ActionRowBuilder().addComponents(replyBtn, anonBtn, priorityBtn, noteBtn, closeBtn)
            );

            if (config.adminRoleId) {
                await threadChannel.send({
                    content: `<@&${config.adminRoleId}>`
                }).catch(() => {});
            }

            const controlMessage = await threadChannel.send({
                components: [staffContainer],
                flags: MessageFlags.IsComponentsV2
            });

            await ModMailThread.findByIdAndUpdate(thread._id, {
                controlMessageId: controlMessage.id
            });

            
            await this.forwardToStaff(message, threadChannel, thread._id);

            
            if (config.autoResponse) {
                const userCloseBtn = new ButtonBuilder()
                    .setCustomId(`user_close_${message.author.id}_${thread._id}`)
                    .setLabel(lang.buttons.userClose)
                    .setStyle(ButtonStyle.Danger);
                const userLockEmoji = getButtonEmoji('lock');
                if (userLockEmoji) userCloseBtn.setEmoji(userLockEmoji);

                const userConfirmContainer = new ContainerBuilder()
                    .setAccentColor(ACCENT.success);

                userConfirmContainer.addSectionComponents(
                    new SectionBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent([
                            `# ${getEmoji('tick')} ModMail Created`,
                            `### Server: **${guild.name}**`,
                            '',
                            config.welcomeMessage || lang.welcomeMessageFallback,
                            '',
                            `**Ticket ID:** \`${thread._id.toString().slice(-8)}\``,
                            `**Priority:** \`${priority.toUpperCase()}\``,
                            '',
                            `*Reply directly to continue • Click below to close this thread.*`
                        ].join('\n'))
                    )
                );

                userConfirmContainer.addActionRowComponents(new ActionRowBuilder().addComponents(userCloseBtn));

                await message.reply({
                    components: [userConfirmContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            await this.updateStats(cleanGuildId, 'new_thread');
            return thread;

        } catch (error) {
            console.error('[ModMailHandler] Error creating modmail thread:', error);
            const card = cards.error(
                'Error',
                'Failed to create your modmail ticket. Please try again later or contact server staff directly.'
            );
            await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        } finally {
            threadCreationLocks.delete(creationLockKey);
        }
    }

    async forwardToStaff(message, threadChannel, threadId) {
        const existingMessage = await ModMailMessage.findOne({ threadId, messageId: message.id });
        if (existingMessage) return false;

        const cleanContent = message.content || (message.attachments.size > 0 ? '*Message with attachments only*' : '*No message content*');

        const container = new ContainerBuilder()
            .setAccentColor(0x36393f);

        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent([
                        `### ${getEmoji('user')} **${message.author.tag}** (\`${message.author.id}\`)`,
                        `> ${cleanContent}`
                    ].join('\n'))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(message.author.displayAvatarURL())
                )
        );

        const files = Array.from(message.attachments.values()).map(att => att.url);

        const modmailMessage = new ModMailMessage({
            threadId,
            messageId: message.id,
            authorId: message.author.id,
            content: cleanContent,
            attachments: Array.from(message.attachments.values()).map(att => ({
                name: att.name,
                url: att.url,
                size: att.size
            })),
            isStaff: false
        });

        let sent;
        try {
            sent = await threadChannel.send({
                components: [container],
                files: files.length > 0 ? files : undefined,
                flags: MessageFlags.IsComponentsV2
            });
            await modmailMessage.save();
        } catch (error) {
            if (error.code === 11000) {
                if (sent) await sent.delete().catch(() => {});
                return false;
            }
            throw error;
        }

        await ModMailThread.findByIdAndUpdate(threadId, {
            lastActivity: new Date(),
            $inc: { messageCount: 1 }
        });
        return true;
    }

    async handleThreadReply(message) {
        if (message.author.bot) return;

        const thread = await ModMailThread.findOne({
            threadChannelId: message.channel.id,
            status: 'open'
        });

        if (!thread) return;

        const guild = await this.fetchGuildAdvanced(thread.guildId);
        if (!guild) return;

        const config = await this.getConfig(guild.id);
        if (!config) return;

        const member = message.member;
        if (!member) return;

        const isStaff = member.roles.cache.has(config.adminRoleId) ||
            message.author.id === guild.ownerId ||
            member.permissions.has(PermissionsBitField.Flags.ManageGuild);

        if (!isStaff) {
            return message.delete().catch(() => {});
        }

        try {
            const user = await this.client.users.fetch(thread.userId);
            const cleanContent = message.content || (message.attachments.size > 0 ? '*Message with attachments only*' : '*No message content*');

            const dmContainer = new ContainerBuilder()
                .setAccentColor(ACCENT.success);

            dmContainer.addSectionComponents(
                new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent([
                        `# ${getEmoji('staff')} Staff Reply — **${guild.name}**`,
                        `### From: **${member.displayName}**`,
                        '',
                        `> ${cleanContent}`
                    ].join('\n'))
                )
            );

            const files = Array.from(message.attachments.values()).map(att => att.url);

            try {
                await user.send({
                    components: [dmContainer],
                    files: files.length > 0 ? files : undefined,
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (dmError) {
                if (dmError.code === 50007) {
                    const card = cards.warning(lang.deliveryFailedTitle, lang.deliveryFailedDesc);
                    await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                    return;
                }
                throw dmError;
            }

            const modmailMessage = new ModMailMessage({
                threadId: thread._id,
                messageId: message.id,
                authorId: message.author.id,
                content: cleanContent,
                attachments: Array.from(message.attachments.values()).map(att => ({
                    name: att.name,
                    url: att.url,
                    size: att.size
                })),
                isStaff: true
            });

            await modmailMessage.save();

            await ModMailThread.findByIdAndUpdate(thread._id, {
                lastActivity: new Date(),
                staffResponded: true,
                $inc: { messageCount: 1 }
            });

            const tickMatch = getEmoji('tick').match(/:(\d+)>/); if (tickMatch) await message.react(tickMatch[1]).catch(() => {});

        } catch (error) {
            console.error('[ModMailHandler] Error forwarding staff reply:', error);
            const crossMatch = getEmoji('cross').match(/:(\d+)>/); if (crossMatch) await message.react(crossMatch[1]).catch(() => {});
            const card = cards.error('Delivery Failed', 'Failed to deliver your message to the user.');
            await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
    }

    async handleInteraction(interaction) {
        const lockKey = `${interaction.user.id}:${interaction.customId}`;
        if (inFlightInteractions.has(lockKey)) {
            return;
        }
        inFlightInteractions.add(lockKey);

        try {
            const staffAction = parseStaffAction(interaction.customId);
            const opensStaffModal = interaction.isButton() && [
                'reply_modmail_', 'anon_reply_', 'close_modmail_', 'add_modmail_note_'
            ].some(prefix => interaction.customId.startsWith(prefix));

            if (staffAction && !opensStaffModal) {
                if (interaction.isModalSubmit() && !interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                } else if (interaction.isStringSelectMenu() && !interaction.deferred && !interaction.replied) {
                    await interaction.deferUpdate();
                } else if (interaction.isButton() && interaction.customId.startsWith('priority_modmail_') && !interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                }

                if (!await this.authorizeStaffAction(interaction, staffAction)) {
                    return await replyEphemeral(interaction, cards.error('Permission Denied', 'This action is only available to staff for this support thread.'));
                }
            }

            if (interaction.isStringSelectMenu()) {
                if (interaction.customId.startsWith('modmail_server_select_')) {
                    await this.handleServerSelection(interaction);
                } else if (interaction.customId.startsWith('priority_select_')) {
                    await this.handlePrioritySelection(interaction);
                }
            } else if (interaction.isButton()) {
                const customId = interaction.customId;

                if (customId.startsWith('reply_modmail_')) {
                    await this.handleNormalReply(interaction);
                } else if (customId.startsWith('anon_reply_')) {
                    await this.handleAnonymousReply(interaction);
                } else if (customId.startsWith('close_modmail_')) {
                    await this.handleCloseButton(interaction);
                } else if (customId.startsWith('priority_modmail_')) {
                    await this.handlePriorityButton(interaction);
                } else if (customId.startsWith('add_modmail_note_')) {
                    await this.handleAddNote(interaction);
                } else if (customId.startsWith('user_close_')) {
                    await this.handleUserClose(interaction);
                }
            } else if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('reply_modal_')) {
                    await this.handleReplyModal(interaction);
                } else if (interaction.customId.startsWith('anon_modal_')) {
                    await this.handleAnonymousModal(interaction);
                } else if (interaction.customId.startsWith('note_modal_')) {
                    await this.handleNoteModal(interaction);
                } else if (interaction.customId.startsWith('close_modal_')) {
                    await this.handleCloseModal(interaction);
                }
            }
        } catch (error) {
            console.error('[ModMailHandler] Interaction error:', error);
            const card = cards.error('Error', 'An error occurred while processing your request.');

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ components: [card], flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ components: [card], flags: MessageFlags.Ephemeral });
                }
            } catch (err) {
                
            }
        } finally {
            inFlightInteractions.delete(lockKey);
        }
    }

    async authorizeStaffAction(interaction, { threadId, actorId }) {
        if (actorId && actorId !== interaction.user.id) return false;

        const thread = await ModMailThread.findById(threadId);
        if (!thread || thread.status !== 'open' || interaction.guildId !== thread.guildId) return false;

        const guild = interaction.guild?.id === thread.guildId
            ? interaction.guild
            : await this.fetchGuildAdvanced(thread.guildId);
        if (!guild) return false;

        const interactionMember = interaction.member;
        const member = interactionMember?.permissions?.has
            ? interactionMember
            : await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) return false;
        const config = await this.getConfig(thread.guildId);
        const hasConfiguredAdminRole = config?.adminRoleId && (
            member.roles?.cache?.has(config.adminRoleId) ||
            (Array.isArray(member.roles) && member.roles.includes(config.adminRoleId))
        );
        return Boolean(
            member.id === guild.ownerId ||
            member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
            hasConfiguredAdminRole
        );
    }

    async handleServerSelection(interaction) {
        const parts = interaction.customId.split('_');
        const userId = parts[3];
        const sourceMessageId = parts[4];

        const guildIdRaw = interaction.values;
        const guildId = Array.isArray(guildIdRaw) ? guildIdRaw[0] : String(guildIdRaw);

        if (interaction.user.id !== userId) {
            const card = cards.error('Permission Denied', 'This selection menu is not for you.');
            return await replyEphemeral(interaction, card);
        }

        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();

        const validGuilds = await this.getValidGuilds(interaction.user.id);
        if (!validGuilds.some(guild => guild.guildId === guildId)) {
            const card = cards.warning('Server Unavailable', 'This server is no longer available for a support request. Please send a new message and choose an available server.');
            return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

        const dmChannel = await interaction.user.createDM();
        const originalMessage = await dmChannel.messages.fetch(sourceMessageId).catch(() => null);
        if (!originalMessage || originalMessage.author.id !== interaction.user.id) {
            const card = cards.warning('Message Unavailable', 'I could not find the message that started this support request. Please send it again.');
            return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

        const createdThread = await this.createModMailThread(originalMessage, guildId);
        if (!createdThread) {
            const card = cards.error('Could Not Start Support', 'Your support request could not be opened. Please try again.');
            return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

        const guild = await this.fetchGuildAdvanced(guildId);
        const card = cards.success(
            'Server Selected',
            `Your modmail thread has been initiated in **${guild?.name || lang.selectedServer}**.`
        );

        await interaction.editReply({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        });
    }

    async handleNormalReply(interaction) {
        const threadId = interaction.customId.split('_')[2];

        const modal = new ModalBuilder()
            .setCustomId(`reply_modal_${threadId}_${interaction.user.id}`)
            .setTitle(lang.replyModalTitle)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reply_message')
                        .setLabel(lang.replyMessageLabel)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(lang.replyMessagePlaceholder)
                        .setRequired(false)
                        .setMaxLength(3900)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('attachment_urls')
                        .setLabel(lang.attachmentUrlsLabel)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(lang.attachmentUrlsPlaceholder)
                        .setRequired(false)
                        .setMaxLength(1000)
                )
            );

        await interaction.showModal(modal);
    }

    async handleReplyModal(interaction) {
        const threadId = interaction.customId.split('_')[2];
        const messageContent = interaction.fields.getTextInputValue('reply_message');
        const attachmentUrls = interaction.fields.getTextInputValue('attachment_urls');

        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!messageContent.trim() && !attachmentUrls.trim()) {
            const card = cards.warning(lang.emptyContentTitle, lang.emptyContentDesc);
            return await sendV2(interaction, card);
        }

        const thread = await ModMailThread.findById(threadId);
        if (!thread) {
            const card = cards.error('Not Found', 'Thread not found.');
            return await sendV2(interaction, card);
        }

        const guild = await this.fetchGuildAdvanced(thread.guildId);
        const user = await this.client.users.fetch(thread.userId).catch(() => null);

        if (!guild || !user) {
            const card = cards.error('Error', 'Target user or guild could not be resolved.');
            return await sendV2(interaction, card);
        }

        const member = guild.members.cache.get(interaction.user.id) ||
            await guild.members.fetch(interaction.user.id).catch(() => null);

        const files = [];
        if (attachmentUrls && attachmentUrls.trim()) {
            const urls = attachmentUrls.split('\n').map(u => u.trim()).filter(Boolean);
            for (const url of urls) {
                if (this.isValidUrl(url)) files.push(url);
            }
        }

        const cleanContent = messageContent || (files.length > 0 ? '*Message with attachments only*' : '*No content*');

        const dmContainer = new ContainerBuilder()
            .setAccentColor(ACCENT.success);

        dmContainer.addSectionComponents(
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent([
                    `# ${getEmoji('staff')} Staff Reply — **${guild.name}**`,
                    `### From: **${member?.displayName || interaction.user.username}**`,
                    '',
                    `> ${cleanContent}`
                ].join('\n'))
            )
        );

        try {
            await user.send({
                components: [dmContainer],
                files: files.length > 0 ? files : undefined,
                flags: MessageFlags.IsComponentsV2
            });
        } catch (dmError) {
            if (dmError.code === 50007) {
                const card = cards.warning(lang.deliveryFailedTitle, lang.deliveryFailedDesc);
                return await sendV2(interaction, card);
            }
            throw dmError;
        }

        const threadChannel = await this.fetchChannelAdvanced(guild, thread.threadChannelId);
        if (threadChannel) {
            const logContainer = new ContainerBuilder().setAccentColor(0x36393f);
            logContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent([
                    `### ${getEmoji('reply')} Reply sent by <@${interaction.user.id}> (\`${interaction.user.tag}\`)`,
                    `> ${cleanContent}`
                ].join('\n'))
            );

            await threadChannel.send({
                components: [logContainer],
                files: files.length > 0 ? files : undefined,
                flags: MessageFlags.IsComponentsV2
            });
        }

        const modMailMsg = new ModMailMessage({
            threadId: thread._id,
            messageId: 'staff_reply_' + Date.now(),
            authorId: interaction.user.id,
            content: cleanContent,
            attachments: files.map(url => ({ name: 'Attachment', url, size: 0 })),
            isStaff: true
        });
        await modMailMsg.save();

        await ModMailThread.findByIdAndUpdate(thread._id, {
            lastActivity: new Date(),
            staffResponded: true,
            $inc: { messageCount: 1 }
        });

        const successCard = cards.success(
            'Reply Sent',
            files.length > 0 ? `Reply delivered to user with ${files.length} attachment(s).` : 'Reply delivered to user.'
        );
        return await sendV2(interaction, successCard);
    }

    async handleAnonymousReply(interaction) {
        const threadId = interaction.customId.split('_')[2];

        const modal = new ModalBuilder()
            .setCustomId(`anon_modal_${threadId}_${interaction.user.id}`)
            .setTitle(lang.anonReplyModalTitle)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('anon_message')
                        .setLabel(lang.anonReplyMessageLabel)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(lang.anonReplyMessagePlaceholder)
                        .setRequired(false)
                        .setMaxLength(3900)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('anon_attachment_urls')
                        .setLabel(lang.attachmentUrlsLabel)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(lang.attachmentUrlsPlaceholder)
                        .setRequired(false)
                        .setMaxLength(1000)
                )
            );

        await interaction.showModal(modal);
    }

    async handleAnonymousModal(interaction) {
        const threadId = interaction.customId.split('_')[2];
        const message = interaction.fields.getTextInputValue('anon_message');
        const attachmentUrls = interaction.fields.getTextInputValue('anon_attachment_urls');

        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!message.trim() && !attachmentUrls.trim()) {
            const card = cards.warning(lang.emptyContentTitle, lang.emptyContentDesc);
            return await sendV2(interaction, card);
        }

        const thread = await ModMailThread.findById(threadId);
        if (!thread) {
            const card = cards.error('Not Found', 'Thread not found.');
            return await sendV2(interaction, card);
        }

        const user = await this.client.users.fetch(thread.userId).catch(() => null);
        const guild = await this.fetchGuildAdvanced(thread.guildId);

        if (!user || !guild) {
            const card = cards.error('Error', 'User or guild not found.');
            return await sendV2(interaction, card);
        }

        const files = [];
        if (attachmentUrls && attachmentUrls.trim()) {
            const urls = attachmentUrls.split('\n').map(u => u.trim()).filter(Boolean);
            for (const url of urls) {
                if (this.isValidUrl(url)) files.push(url);
            }
        }

        const cleanContent = message || (files.length > 0 ? '*Message with attachments only*' : '*No content*');

        const anonContainer = new ContainerBuilder()
            .setAccentColor(0x36393f);

        anonContainer.addSectionComponents(
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent([
                    `# ${getEmoji('user')} Server Staff — **${guild.name}**`,
                    `### Anonymous Support Reply`,
                    '',
                    `> ${cleanContent}`
                ].join('\n'))
            )
        );

        try {
            await user.send({
                components: [anonContainer],
                files: files.length > 0 ? files : undefined,
                flags: MessageFlags.IsComponentsV2
            });
        } catch (dmError) {
            if (dmError.code === 50007) {
                const card = cards.warning(lang.deliveryFailedTitle, lang.deliveryFailedDesc);
                return await sendV2(interaction, card);
            }
            throw dmError;
        }

        const threadChannel = await this.fetchChannelAdvanced(guild, thread.threadChannelId);
        if (threadChannel) {
            const logContainer = new ContainerBuilder().setAccentColor(0x36393f);
            logContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent([
                    `### ${getEmoji('anon')} Anonymous Reply sent by <@${interaction.user.id}>`,
                    `> ${cleanContent}`
                ].join('\n'))
            );

            await threadChannel.send({
                components: [logContainer],
                files: files.length > 0 ? files : undefined,
                flags: MessageFlags.IsComponentsV2
            });
        }

        const modmailMessage = new ModMailMessage({
            threadId: thread._id,
            messageId: 'anonymous_' + Date.now(),
            authorId: interaction.user.id,
            content: cleanContent,
            attachments: files.map(url => ({ name: 'Attachment', url, size: 0 })),
            isStaff: true,
            isAnonymous: true
        });
        await modmailMessage.save();

        await ModMailThread.findByIdAndUpdate(thread._id, {
            lastActivity: new Date(),
            staffResponded: true,
            $inc: { messageCount: 1 }
        });

        const successCard = cards.success(
            'Anonymous Reply Sent',
            files.length > 0 ? `Anonymous reply delivered with ${files.length} attachment(s).` : 'Anonymous reply delivered.'
        );
        return await sendV2(interaction, successCard);
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    async handleUserClose(interaction) {
        const parts = interaction.customId.split('_');
        const closeAll = parts[2] === 'all';
        const userId = closeAll ? parts[3] : parts[2];
        const threadId = closeAll ? null : parts[3];

        if (!userId || (!closeAll && !threadId)) {
            const card = cards.error('Invalid Button', 'This close control is no longer valid.');
            return await replyEphemeral(interaction, card);
        }

        if (interaction.user.id !== userId) {
            const card = cards.error('Permission Denied', 'This button is not for you.');
            return await replyEphemeral(interaction, card);
        }

        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const openThreads = await ModMailThread.find({
            userId,
            status: 'open',
            ...(!closeAll && threadId ? { _id: threadId } : {})
        });

        if (openThreads.length === 0) {
            const card = cards.warning(lang.noOpenThreadsTitle, lang.noOpenThreadsDesc);
            return await sendV2(interaction, card);
        }

        let closedCount = 0;
        for (const thread of openThreads) {
            if (await this.closeModMailThread(thread, interaction.user, 'Closed by user')) closedCount++;
        }

        if (closedCount === 0) {
            const card = cards.warning(lang.noOpenThreadsTitle, lang.noOpenThreadsDesc);
            return await sendV2(interaction, card);
        }
        const card = cards.success(lang.threadsClosedTitle, lang.threadsClosedDesc.replace('{count}', closedCount));
        return await sendV2(interaction, card);
    }

    async closeInactiveThread(thread) {
        try {
            const user = await this.client.users.fetch(thread.userId).catch(() => null);
            const guild = await this.fetchGuildAdvanced(thread.guildId);

            if (user) {
                const inactiveContainer = new ContainerBuilder()
                    .setAccentColor(ACCENT.warning);

                inactiveContainer.addSectionComponents(
                    new SectionBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent([
                            `# ${getEmoji('time')} ModMail Auto-Closed`,
                            `### Server: **${guild?.name || lang.server}**`,
                            '',
                            `Your modmail thread has been automatically closed due to 6 hours of inactivity.`,
                            '',
                            `**Opened:** <t:${Math.floor(thread.openedAt.getTime() / 1000)}:R>`,
                            `**Last Activity:** <t:${Math.floor(thread.lastActivity.getTime() / 1000)}:R>`,
                            '',
                            `*Need more help? Send a new direct message to start a fresh thread.*`
                        ].join('\n'))
                    )
                );

                await user.send({
                    components: [inactiveContainer],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }

            await this.closeModMailThread(thread, this.client.user, 'Auto-closed due to inactivity (6 hours)');

        } catch (error) {
            console.error('[ModMailHandler] Error closing inactive thread:', error);
        }
    }

    async handleCloseButton(interaction) {
        const threadId = interaction.customId.split('_')[2];

        const modal = new ModalBuilder()
            .setCustomId(`close_modal_${threadId}_${interaction.user.id}`)
            .setTitle(lang.closeModalTitle)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('close_reason')
                        .setLabel(lang.closeReasonLabel)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(lang.closeReasonPlaceholder)
                        .setRequired(false)
                        .setMaxLength(500)
                )
            );

        await interaction.showModal(modal);
    }

    async handlePriorityButton(interaction) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const threadId = interaction.customId.split('_')[2];

        const priorityMenu = new StringSelectMenuBuilder()
            .setCustomId(`priority_select_${threadId}_${interaction.user.id}`)
            .setPlaceholder(lang.selectPriorityPlaceholder)
            .addOptions([
                {
                    label: 'Low Priority',
                    description: 'Non-urgent matter',
                    value: 'low'
                },
                {
                    label: 'Medium Priority',
                    description: 'Standard priority',
                    value: 'medium'
                },
                {
                    label: 'High Priority',
                    description: 'Important matter',
                    value: 'high'
                },
                {
                    label: 'Urgent Priority',
                    description: 'Requires immediate attention',
                    value: 'urgent'
                }
            ]);

        const container = new ContainerBuilder()
            .setAccentColor(ACCENT.info);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent([
                `### ${getEmoji('priority')} Update Thread Priority`,
                `Select the new priority level for this support case:`
            ].join('\n'))
        );
        container.addActionRowComponents(new ActionRowBuilder().addComponents(priorityMenu));

        return await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }

    async handleAddNote(interaction) {
        const threadId = interaction.customId.slice('add_modmail_note_'.length).split('_')[0];

        const modal = new ModalBuilder()
            .setCustomId(`note_modal_${threadId}_${interaction.user.id}`)
            .setTitle(lang.noteModalTitle)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('note_content')
                        .setLabel(lang.noteLabel)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(lang.notePlaceholder)
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(1000)
                )
            );

        await interaction.showModal(modal);
    }

    async handleNoteModal(interaction) {
        const threadId = interaction.customId.split('_')[2];
        const noteContent = interaction.fields.getTextInputValue('note_content');

        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const thread = await ModMailThread.findOneAndUpdate(
            { _id: threadId, status: 'open' },
            {
                notes: noteContent,
                lastActivity: new Date()
            },
            { returnDocument: 'after' }
        );

        if (!thread) {
            const card = cards.error('Not Found', 'Thread not found.');
            return await sendV2(interaction, card);
        }

        const guild = await this.fetchGuildAdvanced(thread.guildId);
        const threadChannel = await this.fetchChannelAdvanced(guild, thread.threadChannelId);

        if (threadChannel) {
            const noteContainer = new ContainerBuilder()
                .setAccentColor(ACCENT.warning);

            noteContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent([
                    `### ${getEmoji('note')} Internal Note by <@${interaction.user.id}>`,
                    `> ${noteContent}`,
                    '',
                    `*Internal Staff Note — Not visible to user.*`
                ].join('\n'))
            );

            await threadChannel.send({
                components: [noteContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const card = cards.success(lang.noteAddedTitle, lang.noteAddedDesc);
        return await sendV2(interaction, card);
    }

    async handlePrioritySelection(interaction) {
        const threadId = interaction.customId.split('_')[2];
        const rawValues = interaction.values;
        const newPriority = String(Array.isArray(rawValues) ? rawValues[0] : rawValues);

        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        if (!validPriorities.includes(newPriority)) {
            const card = cards.error('Invalid Priority', 'Invalid priority value selected.');
            return await replyEphemeral(interaction, card);
        }

        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();

        const thread = await ModMailThread.findOneAndUpdate(
            { _id: threadId, status: 'open' },
            { priority: newPriority, lastActivity: new Date() },
            { returnDocument: 'after' }
        );

        if (!thread) {
            const card = cards.error('Not Found', 'Thread not found.');
            return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

        const guild = await this.fetchGuildAdvanced(thread.guildId);
        const threadChannel = await this.fetchChannelAdvanced(guild, thread.threadChannelId);

        const card = cards.success(
            'Priority Updated',
            `Thread priority changed to **${newPriority.toUpperCase()}** by <@${interaction.user.id}>.`
        );

        return await interaction.editReply({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        });
    }

    async handleCloseModal(interaction) {
        const threadId = interaction.customId.split('_')[2];
        const reason = interaction.fields.getTextInputValue('close_reason') || lang.noReasonProvided;

        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const thread = await ModMailThread.findById(threadId);
        if (!thread) {
            const card = cards.error('Not Found', 'Thread not found.');
            return await sendV2(interaction, card);
        }

        const guild = await this.fetchGuildAdvanced(thread.guildId);
        const config = await this.getConfig(guild.id);

        const member = interaction.member;
        const isStaff = member.roles.cache.has(config.adminRoleId) ||
            member.id === guild.ownerId ||
            member.permissions.has(PermissionsBitField.Flags.ManageGuild);

        if (!isStaff) {
            const card = cards.error('Permission Denied', 'You do not have permission to close this modmail.');
            return await sendV2(interaction, card);
        }

        const closed = await this.closeModMailThread(thread, interaction.user, reason);

        const card = closed
            ? cards.success(lang.threadClosedCaseTitle, lang.threadClosedCaseDesc)
            : cards.warning('Already Closed', 'This support thread is already closed or currently being closed.');
        return await sendV2(interaction, card);
    }

    async closeModMailThread(thread, closedBy, reason = 'No reason provided') {
        const claimTime = new Date();
        try {
            const claim = await ModMailThread.findOneAndUpdate(
                {
                    _id: thread._id,
                    status: 'open',
                    $or: [
                        { closingAt: null },
                        { closingAt: { $lt: new Date(claimTime.getTime() - 15 * 60 * 1000) } }
                    ]
                },
                { $set: { closingAt: claimTime } },
                { returnDocument: 'after' }
            );
            if (!claim) return false;

            const guild = await this.fetchGuildAdvanced(thread.guildId);
            const threadChannel = await this.fetchChannelAdvanced(guild, thread.threadChannelId);

            
            if (threadChannel && thread.controlMessageId) {
                try {
                    const controlMessage = await threadChannel.messages.fetch(thread.controlMessageId).catch(() => null);

                    if (controlMessage) {
                        const disabledRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('disabled_closed')
                                .setLabel(lang.buttons.closed)
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );
                        const lockEmoji = getButtonEmoji('lock');
                        if (lockEmoji) disabledRow.components[0].setEmoji(lockEmoji);

                        const closedStaffCard = new ContainerBuilder()
                            .setAccentColor(ACCENT.danger);

                        closedStaffCard.addSectionComponents(
                            new SectionBuilder().addTextDisplayComponents(
                                new TextDisplayBuilder().setContent([
                                    `# ${getEmoji('lock')} ModMail Case Closed`,
                                    `### Case Reference: \`${thread._id.toString().slice(-8)}\``,
                                    '',
                                    `**Closed By:** <@${closedBy.id}> (\`${closedBy.tag || closedBy.username}\`)`,
                                    `**Reason:** ${reason}`,
                                    `**Closed At:** <t:${Math.floor(Date.now() / 1000)}:F>`
                                ].join('\n'))
                            )
                        );
                        closedStaffCard.addActionRowComponents(disabledRow);

                        await controlMessage.edit({
                            components: [closedStaffCard],
                            flags: MessageFlags.IsComponentsV2
                        }).catch(() => {});
                    }
                } catch (error) {
                    
                }
            }

            
            const messages = await ModMailMessage.find({ threadId: thread._id }).sort({ createdAt: 1 });
            const transcript = messages.map(msg =>
                `[${msg.createdAt.toISOString()}] ${msg.isStaff ? 'Staff' : 'User'}: ${msg.content}`
            ).join('\n');

            const transcriptPath = path.join(__dirname, '..', 'temp', `modmail-${thread._id}-${Date.now()}.txt`);
            await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
            await fs.writeFile(transcriptPath, transcript);

            const transcriptAttachment = new AttachmentBuilder()
                .setFile(transcriptPath)
                .setName(`modmail-transcript-${thread._id.toString().slice(-8)}.txt`);

            
            try {
                const user = await this.client.users.fetch(thread.userId).catch(() => null);
                if (user) {
                    const userCloseContainer = new ContainerBuilder()
                        .setAccentColor(ACCENT.danger);

                    userCloseContainer.addSectionComponents(
                        new SectionBuilder().addTextDisplayComponents(
                            new TextDisplayBuilder().setContent([
                                `# ${getEmoji('lock')} ModMail Closed`,
                                `### Server: **${guild.name}**`,
                                '',
                                `Your modmail support session has been closed.`,
                                '',
                                `**Closed By:** \`${closedBy.tag || closedBy.username}\``,
                                `**Reason:** ${reason}`,
                                '',
                                `*A transcript of this conversation is attached above.*`
                            ].join('\n'))
                        )
                    );

                    await user.send({
                        components: [userCloseContainer],
                        files: [transcriptAttachment],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }
            } catch (error) {
                
            }

            await ModMailThread.findOneAndUpdate(
                { _id: thread._id, status: 'open', closingAt: claimTime },
                { $set: { status: 'closed', closedBy: closedBy.id, closedAt: new Date(), closingAt: null } }
            );

            const responseTime = thread.staffResponded ?
                Math.round((Date.now() - thread.openedAt.getTime()) / (1000 * 60)) : 0;
            await this.updateStats(thread.guildId, 'close_thread', { responseTime });

            if (threadChannel) {
                const channelLog = new ContainerBuilder().setAccentColor(ACCENT.danger);
                channelLog.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent([
                        `# ${getEmoji('lock')} Thread Closed`,
                        `**Closed By:** <@${closedBy.id}> (\`${closedBy.tag || closedBy.username}\`)`,
                        `**Reason:** ${reason}`,
                        `**Session Duration:** <t:${Math.floor(thread.openedAt.getTime() / 1000)}:R>`
                    ].join('\n'))
                );

                await threadChannel.send({
                    components: [channelLog],
                    files: [transcriptAttachment],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});

                if (threadChannel.isThread()) {
                    await threadChannel.setArchived(true, `Closed by ${closedBy.tag}: ${reason}`).catch(() => {});
                }
            }

            setTimeout(async () => {
                try {
                    await fs.unlink(transcriptPath);
                } catch (err) {
                    
                }
            }, 5000);
            return true;

        } catch (error) {
            await ModMailThread.findOneAndUpdate(
                { _id: thread._id, status: 'open', closingAt: claimTime },
                { $set: { closingAt: null } }
            ).catch(() => {});
            console.error('[ModMailHandler] Error closing modmail thread:', error);
            throw error;
        }
    }

    async handleGuildDelete(guild) {
        try {
            await ModMailConfig.deleteOne({ guildId: guild.id });
            await ModMailThread.deleteMany({ guildId: guild.id });
            await ModMailStats.deleteOne({ guildId: guild.id });

            invalidateModMailConfig(guild.id);
            console.log(`[ModMailHandler] Cleaned up modmail data for deleted guild: ${guild.name} (${guild.id})`);
        } catch (error) {
            console.error(`[ModMailHandler] Error cleaning up data for deleted guild ${guild.id}:`, error);
        }
    }

    async cleanupStaleThreads() {
        try {
            const staleThreads = await ModMailThread.find({
                status: 'open',
                lastActivity: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            });

            for (const thread of staleThreads) {
                const guild = await this.fetchGuildAdvanced(thread.guildId);
                if (!guild) {
                    await ModMailThread.deleteOne({ _id: thread._id });
                    continue;
                }

                const channel = await this.fetchChannelAdvanced(guild, thread.threadChannelId);
                if (!channel) {
                    await ModMailThread.deleteOne({ _id: thread._id });
                }
            }
        } catch (error) {
            console.error('[ModMailHandler] Error cleaning up stale threads:', error);
        }
    }

    getPriorityEmoji(priority) {
        return getEmoji('priority');
    }

    async updateStats(guildId, action, data = {}) {
        try {
            let stats = await ModMailStats.findOne({ guildId });
            if (!stats) {
                stats = new ModMailStats({ guildId });
            }

            switch (action) {
                case 'new_thread':
                    stats.totalThreads++;
                    stats.openThreads++;
                    break;
                case 'close_thread':
                    stats.openThreads = Math.max(0, stats.openThreads - 1);
                    stats.closedThreads++;
                    if (data.responseTime) {
                        stats.averageResponseTime = Math.round(
                            (stats.averageResponseTime * (stats.closedThreads - 1) + data.responseTime) / stats.closedThreads
                        );
                    }
                    break;
                case 'new_message':
                    stats.totalMessages++;
                    break;
            }

            stats.lastUpdated = new Date();
            await stats.save();
        } catch (error) {
            console.error('[ModMailHandler] Error updating stats:', error);
        }
    }
}

ModMailHandler.handleComponent = async function(interaction) {
    if (!handlerInstance && interaction.client) {
        new ModMailHandler(interaction.client);
    }
    if (handlerInstance) {
        return await handlerInstance.handleInteraction(interaction);
    }
};

module.exports = ModMailHandler;
