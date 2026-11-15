const { SlashCommandBuilder, PermissionsBitField, ChannelType, MessageFlags } = require('discord.js');
const StickyMessage = require('../../models/stickymessage/Schema');
const cmdIcons = require('../../UI/icons/commandicons');
const checkPermissions = require('../../utils/checkPermissions');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, replyEphemeral } = require('../../UI');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-stickymessage')
        .setDescription('Advanced sticky message management system.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)

        
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a new sticky message with advanced customization.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel for the sticky message')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Message type')
                        .addChoices(
                            { name: 'Text Only', value: 'text' },
                            { name: 'Embed Only', value: 'embed' },
                            { name: 'Both Text & Embed', value: 'both' }
                        )
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('timer-mode')
                        .setDescription('How should the sticky message be triggered?')
                        .addChoices(
                            { name: 'After X Messages', value: 'message' },
                            { name: '⏰ Every X Minutes', value: 'time' }
                        )
                        .setRequired(true))
        )

        
        .addSubcommand(sub =>
            sub.setName('config-text')
                .setDescription('Configure text content for sticky message.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('content')
                        .setDescription('The text content of the sticky message')
                        .setRequired(true))
        )

        
        .addSubcommand(sub =>
            sub.setName('config-embed')
                .setDescription('Configure advanced embed customization.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Embed title')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Embed description')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Embed color (hex code like #ff0000)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('author-name')
                        .setDescription('Author name')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('author-icon')
                        .setDescription('Author icon URL')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('author-url')
                        .setDescription('Author clickable URL')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer-text')
                        .setDescription('Footer text')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer-icon')
                        .setDescription('Footer icon URL')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('Large image URL')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('thumbnail')
                        .setDescription('Thumbnail image URL')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('timestamp')
                        .setDescription('Show timestamp?')
                        .setRequired(false))
        )

        
        .addSubcommand(sub =>
            sub.setName('config-fields')
                .setDescription('Add/manage embed fields (up to 3 fields per command).')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .addChoices(
                            { name: 'Add Fields', value: 'add' },
                            { name: 'Clear All Fields', value: 'clear' }
                        )
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('field1-name')
                        .setDescription('Field 1 name')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('field1-value')
                        .setDescription('Field 1 value')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('field1-inline')
                        .setDescription('Field 1 inline?')
                        .setRequired(false))
        )

        
        .addSubcommand(sub =>
            sub.setName('config-timing')
                .setDescription('Configure smart timing settings.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('message-count')
                        .setDescription('Send sticky after X messages (1-50)')
                        .setMinValue(1)
                        .setMaxValue(50)
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('timer-minutes')
                        .setDescription('Send sticky every X minutes (1-1440)')
                        .setMinValue(1)
                        .setMaxValue(1440)
                        .setRequired(false))
        )

        
        .addSubcommand(sub =>
            sub.setName('preview')
                .setDescription('Preview how your sticky message will look.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel')
                        .setRequired(true))
        )

        
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable/disable sticky message.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('active')
                        .setDescription('Activate the sticky message?')
                        .setRequired(true))
        )

        
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View all sticky messages for this server.')
        )

        
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a sticky message.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel')
                        .setRequired(true))
        ),

   async execute(interaction) {
    if (!await checkPermissions(interaction)) return;

    const serverId = interaction.guild.id;
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');

    try {
        switch (subcommand) {
            case 'create':
                await handleCreate(interaction, serverId, channel);
                break;
            case 'config-text':
                await handleConfigText(interaction, serverId, channel);
                break;
            case 'config-embed':
                await handleConfigEmbed(interaction, serverId, channel);
                break;
            case 'config-fields':
                await handleConfigFields(interaction, serverId, channel);
                break;
            case 'config-timing':
                await handleConfigTiming(interaction, serverId, channel);
                break;
            case 'preview':
                await handlePreview(interaction, serverId, channel);
                break;
            case 'list':
                await handleList(interaction, serverId);
                break;
            case 'toggle':
                await handleToggle(interaction, serverId, channel);
                break;
            case 'delete':
                await handleDelete(interaction, serverId, channel);
                break;
            default:
                await replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.unknownSubcommand));
        }
    } catch (error) {
        console.error('Sticky message command error:', error);
        return replyEphemeral(interaction, cards.error(lang.error, lang.unknownError));
    }
}
};

async function handleCreate(interaction, serverId, channel) {
    const type = interaction.options.getString('type');
    const timerMode = interaction.options.getString('timer-mode');

    const existing = await StickyMessage.findOne({ serverId, channelId: channel.id });
    if (existing) {
        return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.alreadyExists.replace('{channel}', `<#${channel.id}>`)));
    }

    const stickyMessage = new StickyMessage({
        serverId,
        channelId: channel.id,
        messageType: type,
        timerMode,
        createdBy: interaction.user.id,
        active: false
    });

    await stickyMessage.save();

    const { invalidateStickyMessage } = require('../../utils/cacheHelpers');
    invalidateStickyMessage(serverId, channel.id);

    const sections = [
        lang.setups.stickymessage.createdSection
            .replace('{channel}', `<#${channel.id}>`)
            .replace('{type}', type)
            .replace('{timerMode}', timerMode)
    ];

    const card = buildCard({
        title: lang.setups.stickymessage.created,
        sections
    });

    return replyEphemeral(interaction, card);
}

async function handleList(interaction, serverId) {
    const stickyMessages = await StickyMessage.find({ serverId });

    if (stickyMessages.length === 0) {
        return replyEphemeral(interaction, cards.info(lang.info, lang.setups.stickymessage.listEmpty));
    }

    const sections = [
        stickyMessages.map((msg, index) => {
            const status = msg.active ? lang.setups.stickymessage.statusActive : lang.setups.stickymessage.statusInactive;
            const type = msg.messageType.toUpperCase();
            const timer = msg.timerMode === 'message' ? 
                lang.setups.stickymessage.timerAfterMsgs.replace('{count}', msg.messageCount) : 
                lang.setups.stickymessage.timerEveryMins.replace('{minutes}', Math.floor(msg.timerInterval / 60));
            
            return `**${index + 1}.** <#${msg.channelId}> - ${status}\n` +
                   `└ Type: ${type} | Timer: ${timer}`;
        }).join('\n\n')
    ];

    const card = buildCard({
        title: lang.setups.stickymessage.listTitle,
        sections
    });

    return replyEphemeral(interaction, card);
}

async function handleConfigText(interaction, serverId, channel) {
    const content = interaction.options.getString('content');

    const updated = await StickyMessage.findOneAndUpdate(
        { serverId, channelId: channel.id },
        { textContent: content },
        { returnDocument: 'after' }
    );

    if (updated) {
        const { invalidateStickyMessage } = require('../../utils/cacheHelpers');
        invalidateStickyMessage(serverId, channel.id);
    }

    if (!updated) {
        return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.notFound.replace('{channel}', `<#${channel.id}>`)));
    }

    const sections = [
        lang.setups.stickymessage.textUpdatedNotice.replace('{channel}', `<#${channel.id}>`),
        lang.setups.stickymessage.textUpdatedContentHeader + content.substring(0, 1000) + (content.length > 1000 ? '...' : '')
    ];

    const card = buildCard({
        title: lang.setups.stickymessage.updated,
        sections
    });

    return replyEphemeral(interaction, card);
}

async function handleConfigEmbed(interaction, serverId, channel) {
    const updates = {};
    
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const authorName = interaction.options.getString('author-name');
    const authorIcon = interaction.options.getString('author-icon');
    const authorUrl = interaction.options.getString('author-url');
    const footerText = interaction.options.getString('footer-text');
    const footerIcon = interaction.options.getString('footer-icon');
    const image = interaction.options.getString('image');
    const thumbnail = interaction.options.getString('thumbnail');
    const timestamp = interaction.options.getBoolean('timestamp');
    
    if (title !== null) updates['embed.title'] = title;
    if (description !== null) updates['embed.description'] = description;
    if (color !== null) {
        const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (hexRegex.test(color)) {
            updates['embed.color'] = color;
        } else {
            return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.embedInvalidColor));
        }
    }
    
    if (authorName !== null) updates['embed.author.name'] = authorName;
    if (authorIcon !== null) updates['embed.author.iconURL'] = authorIcon;
    if (authorUrl !== null) updates['embed.author.url'] = authorUrl;
    if (footerText !== null) updates['embed.footer.text'] = footerText;
    if (footerIcon !== null) updates['embed.footer.iconURL'] = footerIcon;
    if (image !== null) updates['embed.image'] = image;
    if (thumbnail !== null) updates['embed.thumbnail'] = thumbnail;
    if (timestamp !== null) updates['embed.timestamp'] = timestamp;
    
    const updated = await StickyMessage.findOneAndUpdate(
        { serverId, channelId: channel.id },
        { $set: updates },
        { returnDocument: 'after' }
    );

    if (updated) {
        const { invalidateStickyMessage } = require('../../utils/cacheHelpers');
        invalidateStickyMessage(serverId, channel.id);
    }
    
    if (!updated) {
        return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.notFound.replace('{channel}', `<#${channel.id}>`)));
    }
    
    const fieldsText = Object.entries(updates).slice(0, 5).map(([key, value]) => 
        `• **${key.replace('embed.', '').replace('.', ' ')}:** ${String(value).substring(0, 100)}`
    ).join('\n');

    const sections = [
        lang.setups.stickymessage.embedUpdatedNotice.replace('{channel}', `<#${channel.id}>`),
        fieldsText
    ];

    const card = buildCard({
        title: lang.setups.stickymessage.updated,
        sections
    });
    
    return replyEphemeral(interaction, card);
}

async function handleConfigFields(interaction, serverId, channel) {
    const action = interaction.options.getString('action');
    
    if (action === 'clear') {
        const updated = await StickyMessage.findOneAndUpdate(
            { serverId, channelId: channel.id },
            { $set: { 'embed.fields': [] } },
            { returnDocument: 'after' }
        );

        if (updated) {
            const { invalidateStickyMessage } = require('../../utils/cacheHelpers');
            invalidateStickyMessage(serverId, channel.id);
        }
        
        if (!updated) {
            return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.notFound.replace('{channel}', `<#${channel.id}>`)));
        }
        
        return replyEphemeral(interaction, cards.success(lang.success, lang.setups.stickymessage.embedFieldsCleared.replace('{channel}', `<#${channel.id}>`)));
    }
    
    const fields = [];
    const name = interaction.options.getString('field1-name');
    const value = interaction.options.getString('field1-value');
    const inline = interaction.options.getBoolean('field1-inline') || false;
    
    if (name && value) {
        fields.push({ name, value, inline });
    }
    
    if (fields.length === 0) {
        return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.embedFieldRequired));
    }
    
    const updated = await StickyMessage.findOneAndUpdate(
        { serverId, channelId: channel.id },
        { $push: { 'embed.fields': { $each: fields } } },
        { returnDocument: 'after' }
    );

    if (updated) {
        const { invalidateStickyMessage } = require('../../utils/cacheHelpers');
        invalidateStickyMessage(serverId, channel.id);
    }
    
    if (!updated) {
        return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.notFound.replace('{channel}', `<#${channel.id}>`)));
    }
    
    const sections = [
        lang.setups.stickymessage.fieldsAddedNotice
            .replace('{count}', fields.length)
            .replace('{channel}', `<#${channel.id}>`),
        fields.map(f => `• **${f.name}:** ${f.value}`).join('\n')
    ];

    const card = buildCard({
        title: lang.setups.stickymessage.fieldsAddedTitle,
        sections
    });
    
    return replyEphemeral(interaction, card);
}

async function handleConfigTiming(interaction, serverId, channel) {
    const messageCount = interaction.options.getInteger('message-count');
    const timerMinutes = interaction.options.getInteger('timer-minutes');
    
    const updates = {};
    
    if (messageCount !== null) {
        updates.messageCount = messageCount;
        updates.currentMessageCount = 0;
    }
    
    if (timerMinutes !== null) {
        updates.timerInterval = timerMinutes * 60;
        updates.lastSent = new Date();
    }
    
    if (Object.keys(updates).length === 0) {
        return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.stickymessage.timingSpecifyRequired));
    }
    
    const updated = await StickyMessage.findOneAndUpdate(
        { serverId, channelId: channel.id },
        { $set: updates },
        { returnDocument: 'after' }
    );

    if (updated) {
        const { invalidateStickyMessage } = require('../../utils/cacheHelpers');
        invalidateStickyMessage(serverId, channel.id);
    }
    
    if (!updated) {
        return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.notFound.replace('{channel}', `<#${channel.id}>`)));
    }
    
    const currentMode = updated.timerMode === 'message'
        ? lang.setups.stickymessage.timingMessageBased
        : lang.setups.stickymessage.timingTimeBased;
    const sections = [
        lang.setups.stickymessage.timingUpdatedNotice.replace('{channel}', `<#${channel.id}>`),
        lang.setups.stickymessage.timingDetails
            .replace('{mode}', currentMode)
            .replace('{count}', updated.messageCount)
            .replace('{interval}', Math.floor(updated.timerInterval / 60))
    ];

    const card = buildCard({
        title: lang.setups.stickymessage.timingUpdatedTitle,
        sections
    });
    
    return replyEphemeral(interaction, card);
}

async function handlePreview(interaction, serverId, channel) {
    const stickyMessage = await StickyMessage.findOne({ serverId, channelId: channel.id });
    
    if (!stickyMessage) {
        return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.notFound.replace('{channel}', `<#${channel.id}>`)));
    }
    
    const sections = [
        lang.setups.stickymessage.previewHeader.replace('{channel}', `<#${channel.id}>`)
    ];
    
    if ((stickyMessage.messageType === 'text' || stickyMessage.messageType === 'both') && stickyMessage.textContent) {
        sections.push(lang.setups.stickymessage.previewTextHeader + stickyMessage.textContent);
    }
    
    if (stickyMessage.messageType === 'embed' || stickyMessage.messageType === 'both') {
        const e = stickyMessage.embed || {};
        const lines = [];
        if (e.title) lines.push(lang.setups.stickymessage.previewTitleField.replace('{title}', e.title));
        if (e.description) lines.push(lang.setups.stickymessage.previewDescField.replace('{desc}', e.description));
        if (e.color) lines.push(lang.setups.stickymessage.previewColorField.replace('{color}', e.color));
        if (e.fields && e.fields.length > 0) {
            lines.push(lang.setups.stickymessage.previewFieldsHeader + e.fields.map(f => `• ${f.name}: ${f.value}`).join('\n'));
        }
        if (lines.length > 0) {
            sections.push(lang.setups.stickymessage.previewEmbedSettingsHeader + lines.join('\n'));
        }
    }
    
    const statusText = stickyMessage.active 
        ? lang.setups.stickymessage.statusActive 
        : lang.setups.stickymessage.statusInactive;
    const timerText = stickyMessage.timerMode === 'message'
        ? lang.setups.stickymessage.timerAfterMsgs.replace('{count}', stickyMessage.messageCount)
        : lang.setups.stickymessage.timerEveryMins.replace('{minutes}', Math.floor(stickyMessage.timerInterval / 60));

    sections.push(
        lang.setups.stickymessage.previewConfigHeader +
        lang.setups.stickymessage.previewConfigDetails
            .replace('{status}', statusText)
            .replace('{type}', stickyMessage.messageType.toUpperCase())
            .replace('{timer}', timerText)
    );
    
    const card = buildCard({
        title: lang.setups.stickymessage.previewTitle,
        sections
    });

    return replyEphemeral(interaction, card);
}

async function handleToggle(interaction, serverId, channel) {
    const active = interaction.options.getBoolean('active');
    
    const updated = await StickyMessage.findOneAndUpdate(
        { serverId, channelId: channel.id },
        { $set: { active } },
        { returnDocument: 'after' }
    );

    if (updated) {
        const { invalidateStickyMessage } = require('../../utils/cacheHelpers');
        invalidateStickyMessage(serverId, channel.id);
    }
    
    if (!updated) {
        return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.notFound.replace('{channel}', `<#${channel.id}>`)));
    }
    
    const statusWord = active 
        ? lang.setups.stickymessage.toggleActivated 
        : lang.setups.stickymessage.toggleDeactivated;
    const card = cards.success(
        lang.success, 
        lang.setups.stickymessage.toggleNotice
            .replace('{status}', statusWord)
            .replace('{channel}', `<#${channel.id}>`)
    );
    return replyEphemeral(interaction, card);
}

async function handleDelete(interaction, serverId, channel) {
    const deleted = await StickyMessage.findOneAndDelete({ serverId, channelId: channel.id });

    if (deleted) {
        const { invalidateStickyMessage } = require('../../utils/cacheHelpers');
        invalidateStickyMessage(serverId, channel.id);
    }
    
    if (!deleted) {
        return replyEphemeral(interaction, cards.error(lang.error, lang.setups.stickymessage.notFoundGeneral.replace('{channel}', `<#${channel.id}>`)));
    }
    
    if (deleted.lastMessageId) {
        try {
            const message = await channel.messages.fetch(deleted.lastMessageId);
            if (message) await message.delete();
        } catch (err) {
            console.warn('Could not delete last sticky message:', err.message);
        }
    }
    
    const card = cards.success(
        lang.success, 
        lang.setups.stickymessage.deleted.replace('{channel}', `<#${channel.id}>`)
    );
    return replyEphemeral(interaction, card);
}
