const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const LeaveSettings = require('../../models/leave/LeaveSettings');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, sendV2, getEmoji } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-leave')
        .setDescription('Set or view leave message and DM settings for this server')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)

        .addSubcommand(sub =>
            sub.setName('setchannel')
                .setDescription('Enable/Disable leave messages in a channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the leave channel')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable channel leave messages')
                        .setRequired(true))
        )

        .addSubcommand(sub =>
            sub.setName('setdm')
                .setDescription('Enable/Disable leave DMs')
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable leave DMs')
                        .setRequired(true))
        )

        .addSubcommand(sub =>
            sub.setName('embed-channel')
                .setDescription('Setup custom embed for channel leave messages')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Embed title (use {membercount}, {member} placeholders)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Embed description (use placeholders: {member}, {membercount})')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Embed color (hex format: #ff4757)')
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
                .setDescription('Setup custom embed for DM leave messages')
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
                        .setDescription('Embed color (hex format: #ff4757)')
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
                .setDescription('Setup the 3 fields for channel leave embed')
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
                            { name: 'Leave Date', value: 'leavedate' },
                            { name: 'Join Date', value: 'joindate' },
                            { name: 'Time in Guild', value: 'timeinguild' },
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
                            { name: 'Leave Date', value: 'leavedate' },
                            { name: 'Join Date', value: 'joindate' },
                            { name: 'Time in Guild', value: 'timeinguild' },
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
                            { name: 'Leave Date', value: 'leavedate' },
                            { name: 'Join Date', value: 'joindate' },
                            { name: 'Time in Guild', value: 'timeinguild' },
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
                .setDescription('View current leave setup')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete all leave configuration for this server.')),

    async execute(interaction) {
        if (!(typeof interaction.isChatInputCommand === 'function' ? interaction.isChatInputCommand() : interaction.isCommand?.())) {
            return sendV2(interaction, buildCard({
                title: lang.warning,
                description: lang.setups.leave.useSlash,
                tone: 'warning'
            }), { ephemeral: true });
        }

        const guild = interaction.guild;
        const serverID = guild.id;
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'setchannel') {
                const channel = interaction.options.getChannel('channel');
                const status = interaction.options.getBoolean('status');

                await LeaveSettings.findOneAndUpdate(
                    { serverId: serverID },
                    {
                        serverId: serverID,
                        leaveChannelId: channel.id,
                        channelStatus: status,
                        ownerId: guild.ownerId
                    },
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        setDefaultsOnInsert: true
                    }
                );

                const statusText = status ? lang.setups.welcome.enabled : lang.setups.welcome.disabled;
                return sendV2(interaction, buildCard({
                    title: lang.setups.leave.title,
                    description: lang.setups.leave.channelStatusUpdated.replace('{status}', statusText).replace('{channel}', `<#${channel.id}>`),
                    fields: [
                        { name: lang.setups.leave.channelLabel, value: `${channel}`, inline: true },
                        { name: lang.setups.leave.channelStatusLabel, value: status ? `${getEmoji('tick')} ${lang.setups.welcome.enabled}` : `${getEmoji('cross')} ${lang.setups.welcome.disabled}`, inline: true }
                    ],
                    tone: status ? 'success' : 'warning'
                }), { ephemeral: true });

            } else if (subcommand === 'setdm') {
                const status = interaction.options.getBoolean('status');

                await LeaveSettings.findOneAndUpdate(
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

                const statusText = status ? lang.setups.welcome.enabled : lang.setups.welcome.disabled;
                return sendV2(interaction, buildCard({
                    title: lang.setups.leave.title,
                    description: lang.setups.leave.dmStatusUpdated.replace('{status}', statusText),
                    tone: status ? 'success' : 'warning'
                }), { ephemeral: true });

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

                await LeaveSettings.findOneAndUpdate(
                    { serverId: serverID },
                    updateData,
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        setDefaultsOnInsert: true
                    }
                );

                return sendV2(interaction, buildCard({
                    title: lang.setups.leave.title,
                    description: lang.setups.leave.channelEmbedUpdated,
                    tone: 'success'
                }), { ephemeral: true });

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

                await LeaveSettings.findOneAndUpdate(
                    { serverId: serverID },
                    updateData,
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        setDefaultsOnInsert: true
                    }
                );

                return sendV2(interaction, buildCard({
                    title: lang.setups.leave.title,
                    description: lang.setups.leave.dmEmbedUpdated,
                    tone: 'success'
                }), { ephemeral: true });

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

                await LeaveSettings.findOneAndUpdate(
                    { serverId: serverID },
                    updateData,
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        setDefaultsOnInsert: true
                    }
                );

                return sendV2(interaction, buildCard({
                    title: lang.setups.leave.title,
                    description: lang.setups.leave.fieldsUpdated,
                    tone: 'success'
                }), { ephemeral: true });

            } else if (subcommand === 'view') {
                const config = await LeaveSettings.findOne({ serverId: serverID });

                if (!config) {
                    return sendV2(interaction, buildCard({
                        title: lang.setups.leave.title,
                        description: lang.setups.leave.noConfigFound,
                        tone: 'info'
                    }), { ephemeral: true });
                }

                const fields = [
                    { name: lang.setups.leave.channelLabel, value: config.leaveChannelId ? `<#${config.leaveChannelId}>` : lang.setups.welcome.notSet, inline: true },
                    { name: lang.setups.leave.channelStatusLabel, value: config.channelStatus ? `${getEmoji('tick')} ${lang.setups.welcome.enabled}` : `${getEmoji('cross')} ${lang.setups.welcome.disabled}`, inline: true },
                    { name: lang.setups.leave.dmStatusLabel, value: config.dmStatus ? `${getEmoji('tick')} ${lang.setups.welcome.enabled}` : `${getEmoji('cross')} ${lang.setups.welcome.disabled}`, inline: true }
                ];

                return sendV2(interaction, buildCard({
                    title: lang.setups.leave.configTitle,
                    fields,
                    tone: 'info'
                }), { ephemeral: true });

            } else if (subcommand === 'delete') {
                const deleted = await LeaveSettings.deleteOne({ serverId: serverID });

                return sendV2(interaction, buildCard({
                    title: lang.setups.leave.title,
                    description: deleted.deletedCount > 0 
                        ? lang.setups.leave.configDeleted
                        : lang.setups.leave.noConfigToDelete,
                    tone: deleted.deletedCount > 0 ? 'success' : 'warning'
                }), { ephemeral: true });
            }

        } catch (error) {
            console.error('[Setup-Leave] Error in setup-leave command:', error);
            return sendV2(interaction, buildCard({
                title: lang.setups.leave.title,
                description: lang.setups.leave.updateError,
                tone: 'error'
            }), { ephemeral: true });
        }
    }
};