const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const WelcomeSettings = require('../../models/welcome/WelcomeSettings');
const { invalidateWelcomeSettings } = require('../../utils/cacheHelpers');
const checkPermissions = require('../../utils/checkPermissions');
const cmdIcons = require('../../UI/icons/commandicons');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, replyEphemeral, getEmoji } = require('../../UI');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-welcome')
        .setDescription('Set or view welcome message and DM settings for this server')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)

        .addSubcommand(sub =>
            sub.setName('setchannel')
                .setDescription('Enable/Disable welcome messages in a channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the welcome channel')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable channel welcome messages')
                        .setRequired(true))
        )

        .addSubcommand(sub =>
            sub.setName('setdm')
                .setDescription('Enable/Disable welcome DMs')
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable welcome DMs')
                        .setRequired(true))
        )

        .addSubcommand(sub =>
            sub.setName('embed-channel')
                .setDescription('Setup custom embed for channel welcome messages')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Embed title (use {membercount}, {suffix}, {member} placeholders)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Embed description (use placeholders: {member}, {membercount}, {suffix})')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Embed color (hex format: #00e5ff)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('author_name')
                        .setDescription('Author name (use {username} placeholder)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('author_url')
                        .setDescription('Author URL')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer_text')
                        .setDescription('Footer text')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer_url')
                        .setDescription('Footer icon URL')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('thumbnail')
                        .setDescription('Thumbnail type')
                        .addChoices(
                            { name: 'User Avatar', value: 'userimage' },
                            { name: 'Server Icon', value: 'serverimage' },
                            { name: 'None', value: 'none' }
                        )
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('use_wcard')
                        .setDescription('Use Wcard generator for image (default: true)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('custom_image')
                        .setDescription('Custom image URL (only if use_wcard is false)')
                        .setRequired(false))
        )

        .addSubcommand(sub =>
            sub.setName('embed-dm')
                .setDescription('Setup custom embed for DM welcome messages')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Embed title (use {username}, {servername} placeholders)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Embed description (use placeholders: {username}, {servername})')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Embed color (hex format: #00e5ff)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer_text')
                        .setDescription('Footer text')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer_url')
                        .setDescription('Footer icon URL')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('thumbnail')
                        .setDescription('Thumbnail type')
                        .addChoices(
                            { name: 'User Avatar', value: 'userimage' },
                            { name: 'Server Icon', value: 'serverimage' },
                            { name: 'None', value: 'none' }
                        )
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('use_wcard')
                        .setDescription('Use Wcard generator for image (default: false for DM)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('custom_image')
                        .setDescription('Custom image URL (only if use_wcard is false)')
                        .setRequired(false))
        )

        .addSubcommand(sub =>
            sub.setName('fields')
                .setDescription('Setup the 3 fields for channel welcome embed')
                .addStringOption(option =>
                    option.setName('field1_name')
                        .setDescription('First field name')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('field1_value')
                        .setDescription('First field value type')
                        .addChoices(
                            { name: 'Username', value: 'username' },
                            { name: 'User ID', value: 'userid' },
                            { name: 'Join Date', value: 'joindate' },
                            { name: 'Account Created', value: 'accountcreated' },
                            { name: 'Member Count', value: 'membercount' },
                            { name: 'Server Name', value: 'servername' },
                            { name: 'None', value: 'none' }
                        )
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('field1_inline')
                        .setDescription('First field inline (default: true)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('field2_name')
                        .setDescription('Second field name')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('field2_value')
                        .setDescription('Second field value type')
                        .addChoices(
                            { name: 'Username', value: 'username' },
                            { name: 'User ID', value: 'userid' },
                            { name: 'Join Date', value: 'joindate' },
                            { name: 'Account Created', value: 'accountcreated' },
                            { name: 'Member Count', value: 'membercount' },
                            { name: 'Server Name', value: 'servername' },
                            { name: 'None', value: 'none' }
                        )
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('field2_inline')
                        .setDescription('Second field inline (default: true)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('field3_name')
                        .setDescription('Third field name')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('field3_value')
                        .setDescription('Third field value type')
                        .addChoices(
                            { name: 'Username', value: 'username' },
                            { name: 'User ID', value: 'userid' },
                            { name: 'Join Date', value: 'joindate' },
                            { name: 'Account Created', value: 'accountcreated' },
                            { name: 'Member Count', value: 'membercount' },
                            { name: 'Server Name', value: 'servername' },
                            { name: 'None', value: 'none' }
                        )
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('field3_inline')
                        .setDescription('Third field inline (default: true)')
                        .setRequired(false))
        )

        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current welcome setup')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete all welcome configuration for this server.')),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.welcome.useSlash));
        }

        const guild = interaction.guild;
        const serverID = guild.id;
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'setchannel') {
                const channel = interaction.options.getChannel('channel');
                const status = interaction.options.getBoolean('status');

                await WelcomeSettings.findOneAndUpdate(
                    { serverId: serverID },
                    {
                        serverId: serverID,
                        welcomeChannelId: channel.id,
                        channelStatus: status,
                        ownerId: guild.ownerId
                    },
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        setDefaultsOnInsert: true
                    }
                );

                invalidateWelcomeSettings(serverID);

                const statusText = status ? lang.setups.welcome.enabled : lang.setups.welcome.disabled;
                return replyEphemeral(interaction, cards.success(lang.success, lang.setups.welcome.channelStatusUpdated.replace('{status}', statusText).replace('{channel}', `<#${channel.id}>`)));

            } else if (subcommand === 'setdm') {
                const status = interaction.options.getBoolean('status');

                await WelcomeSettings.findOneAndUpdate(
                    { serverId: serverID },
                    {
                        serverId: serverID,
                        dmStatus: status,
                        ownerId: guild.ownerId
                    },
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        setDefaultsOnInsert: true
                    }
                );

                invalidateWelcomeSettings(serverID);

                const statusText = status ? lang.setups.welcome.enabled : lang.setups.welcome.disabled;
                return replyEphemeral(interaction, cards.success(lang.success, lang.setups.welcome.dmStatusUpdated.replace('{status}', statusText)));

            } else if (subcommand === 'embed-channel') {
                const updateData = { 
                    serverId: serverID, 
                    ownerId: guild.ownerId 
                };
                
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');
                const color = interaction.options.getString('color');
                const authorName = interaction.options.getString('author_name');
                const authorUrl = interaction.options.getString('author_url');
                const footerText = interaction.options.getString('footer_text');
                const footerUrl = interaction.options.getString('footer_url');
                const thumbnail = interaction.options.getString('thumbnail');
                const useWcard = interaction.options.getBoolean('use_wcard');
                const customImage = interaction.options.getString('custom_image');

                if (title) updateData['channelEmbed.title'] = title;
                if (description) updateData['channelEmbed.description'] = description;
                if (color) updateData['channelEmbed.color'] = color;
                if (authorName) updateData['channelEmbed.author.name'] = authorName;
                if (authorUrl) updateData['channelEmbed.author.url'] = authorUrl;
                if (footerText) updateData['channelEmbed.footer.text'] = footerText;
                if (footerUrl) updateData['channelEmbed.footer.iconURL'] = footerUrl;
                if (thumbnail) updateData['channelEmbed.thumbnail.type'] = thumbnail;
                if (useWcard !== null) updateData['channelEmbed.image.useWcard'] = useWcard;
                if (customImage) updateData['channelEmbed.image.customURL'] = customImage;

                await WelcomeSettings.findOneAndUpdate(
                    { serverId: serverID },
                    updateData,
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        setDefaultsOnInsert: true
                    }
                );

                invalidateWelcomeSettings(serverID);

                return replyEphemeral(interaction, cards.success(lang.success, lang.setups.welcome.channelEmbedUpdated));

            } else if (subcommand === 'embed-dm') {
                const updateData = { 
                    serverId: serverID, 
                    ownerId: guild.ownerId 
                };
                
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');
                const color = interaction.options.getString('color');
                const footerText = interaction.options.getString('footer_text');
                const footerUrl = interaction.options.getString('footer_url');
                const thumbnail = interaction.options.getString('thumbnail');
                const useWcard = interaction.options.getBoolean('use_wcard');
                const customImage = interaction.options.getString('custom_image');

                if (title) updateData['dmEmbed.title'] = title;
                if (description) updateData['dmEmbed.description'] = description;
                if (color) updateData['dmEmbed.color'] = color;
                if (footerText) updateData['dmEmbed.footer.text'] = footerText;
                if (footerUrl) updateData['dmEmbed.footer.iconURL'] = footerUrl;
                if (thumbnail) updateData['dmEmbed.thumbnail.type'] = thumbnail;
                if (useWcard !== null) updateData['dmEmbed.image.useWcard'] = useWcard;
                if (customImage) updateData['dmEmbed.image.customURL'] = customImage;

                await WelcomeSettings.findOneAndUpdate(
                    { serverId: serverID },
                    updateData,
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        setDefaultsOnInsert: true
                    }
                );

                invalidateWelcomeSettings(serverID);

                return replyEphemeral(interaction, cards.success(lang.success, lang.setups.welcome.dmEmbedUpdated));

            } else if (subcommand === 'fields') {
                const updateData = { 
                    serverId: serverID, 
                    ownerId: guild.ownerId 
                };
                
                const field1Name = interaction.options.getString('field1_name');
                const field1Value = interaction.options.getString('field1_value');
                const field1Inline = interaction.options.getBoolean('field1_inline');
                
                if (field1Name) updateData['channelEmbed.fields.0.name'] = field1Name;
                if (field1Value) updateData['channelEmbed.fields.0.value'] = field1Value;
                if (field1Inline !== null) updateData['channelEmbed.fields.0.inline'] = field1Inline;

                const field2Name = interaction.options.getString('field2_name');
                const field2Value = interaction.options.getString('field2_value');
                const field2Inline = interaction.options.getBoolean('field2_inline');
                
                if (field2Name) updateData['channelEmbed.fields.1.name'] = field2Name;
                if (field2Value) updateData['channelEmbed.fields.1.value'] = field2Value;
                if (field2Inline !== null) updateData['channelEmbed.fields.1.inline'] = field2Inline;

                const field3Name = interaction.options.getString('field3_name');
                const field3Value = interaction.options.getString('field3_value');
                const field3Inline = interaction.options.getBoolean('field3_inline');
                
                if (field3Name) updateData['channelEmbed.fields.2.name'] = field3Name;
                if (field3Value) updateData['channelEmbed.fields.2.value'] = field3Value;
                if (field3Inline !== null) updateData['channelEmbed.fields.2.inline'] = field3Inline;

                await WelcomeSettings.findOneAndUpdate(
                    { serverId: serverID },
                    updateData,
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        setDefaultsOnInsert: true
                    }
                );

                invalidateWelcomeSettings(serverID);

                return replyEphemeral(interaction, cards.success(lang.success, lang.setups.welcome.fieldsUpdated));

            } else if (subcommand === 'view') {
                const config = await WelcomeSettings.findOne({ serverId: serverID });

                if (!config) {
                    return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.welcome.noConfigFound));
                }

                const channelStatus = config.channelStatus ? getEmoji('tick') + ' ' + lang.setups.welcome.enabled : getEmoji('cross') + ' ' + lang.setups.welcome.disabled;
                const dmStatus = config.dmStatus ? getEmoji('tick') + ' ' + lang.setups.welcome.enabled : getEmoji('cross') + ' ' + lang.setups.welcome.disabled;

                const sections = [
                    `${lang.setups.welcome.serverIdLabel.replace('{id}', config.serverId)}\n` +
                    `${lang.setups.welcome.channelLabel.replace('{channel}', config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : lang.setups.welcome.notSet)}\n` +
                    `${lang.setups.welcome.channelStatusLabel.replace('{status}', channelStatus)}\n` +
                    `${lang.setups.welcome.dmStatusLabel.replace('{status}', dmStatus)}`
                ];

                if (config.channelEmbed) {
                    const channelEmbed = config.channelEmbed;
                    let ceText = `${lang.setups.welcome.fieldTitle.replace('{title}', channelEmbed.title || lang.setups.welcome.defaultVal)}\n` +
                                 `${lang.setups.welcome.fieldColor.replace('{color}', channelEmbed.color || lang.setups.welcome.defaultVal)}\n` +
                                 `${lang.setups.welcome.fieldThumbnail.replace('{type}', channelEmbed.thumbnail?.type || 'serverimage')}\n` +
                                 `${lang.setups.welcome.fieldUseWcard.replace('{status}', channelEmbed.image?.useWcard ? lang.setups.welcome.yes : lang.setups.welcome.no)}`;

                    if (channelEmbed.fields && channelEmbed.fields.length > 0) {
                        const fieldInfo = channelEmbed.fields.map((field, index) => 
                            lang.setups.welcome.fieldLine.replace('{index}', index + 1).replace('{name}', field.name || lang.setups.welcome.notSet).replace('{value}', field.value || 'none')
                        ).join('\n');
                        ceText += lang.setups.welcome.fieldsHeader + (fieldInfo || lang.setups.welcome.noFieldsConfigured);
                    }
                    sections.push(lang.setups.welcome.channelEmbedHeader + ceText);
                }

                if (config.dmEmbed) {
                    const dmEmbed = config.dmEmbed;
                    const deText = `${lang.setups.welcome.fieldTitle.replace('{title}', dmEmbed.title || lang.setups.welcome.defaultVal)}\n` +
                                   `${lang.setups.welcome.fieldColor.replace('{color}', dmEmbed.color || lang.setups.welcome.defaultVal)}\n` +
                                   `${lang.setups.welcome.fieldThumbnail.replace('{type}', dmEmbed.thumbnail?.type || 'userimage')}\n` +
                                   `${lang.setups.welcome.fieldUseWcard.replace('{status}', dmEmbed.image?.useWcard ? lang.setups.welcome.yes : lang.setups.welcome.no)}`;
                    sections.push(lang.setups.welcome.dmEmbedHeader + deText);
                }

                const card = buildCard({
                    title: lang.setups.welcome.welcomeTitle,
                    sections
                });

                return replyEphemeral(interaction, card);

            } else if (subcommand === 'delete') {
                const deleted = await WelcomeSettings.deleteOne({ serverId: serverID });

                invalidateWelcomeSettings(serverID);

                return replyEphemeral(interaction, deleted.deletedCount > 0 
                    ? cards.success(lang.success, lang.setups.welcome.configDeleted)
                    : cards.warning(lang.warning, lang.setups.welcome.noConfigToDelete));
            }

        } catch (error) {
            console.error('[Setup-Welcome] Error in setup-welcome command:', error);
            
            if (error.code === 11000) {
                return replyEphemeral(interaction, cards.error(lang.error, lang.setups.welcome.dbConflict));
            }
            
            return replyEphemeral(interaction, cards.error(lang.error, lang.setups.welcome.updateError));
        }
    }
};