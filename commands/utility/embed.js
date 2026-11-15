
const { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const Embed = require('../../models/embed/embed');
const EmbedSchedule = require('../../models/embed/schedule');
const checkPermissions = require('../../utils/checkPermissions');
const lang = require('../../events/loadLanguage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Advanced embed creation and management system.')


        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create and save a new embed with all properties.')
                .addStringOption(option => option.setName('name').setDescription('Unique embed name').setRequired(true))
                .addStringOption(option => option.setName('title').setDescription('Embed title (max 256 chars)').setRequired(false))
                .addStringOption(option => option.setName('description').setDescription('Embed description (max 4096 chars)').setRequired(false))
                .addStringOption(option => option.setName('color').setDescription('Hex color (e.g., #ff5733)').setRequired(false))
                .addStringOption(option => option.setName('url').setDescription('Embed URL').setRequired(false))
                .addStringOption(option => option.setName('author').setDescription('Author JSON: {"name":"Name","url":"URL","iconURL":"Icon"}').setRequired(false))
                .addStringOption(option => option.setName('footer').setDescription('Footer JSON: {"text":"Text","iconURL":"Icon"}').setRequired(false))
                .addStringOption(option => option.setName('thumbnail').setDescription('Thumbnail image URL').setRequired(false))
                .addStringOption(option => option.setName('image').setDescription('Main image URL').setRequired(false))
                .addStringOption(option => option.setName('fields').setDescription('Fields JSON: [{"name":"Name","value":"Value","inline":true}] (max 25)').setRequired(false))
                .addBooleanOption(option => option.setName('timestamp').setDescription('Add current timestamp').setRequired(false))
                .addStringOption(option => option.setName('category').setDescription('Embed category').setRequired(false)
                    .addChoices(
                        { name: 'Announcements', value: 'announcements' },
                        { name: 'Events', value: 'events' },
                        { name: 'Information', value: 'information' },
                        { name: 'Rules', value: 'rules' },
                        { name: 'Welcome', value: 'welcome' },
                        { name: 'General', value: 'general' }
                    ))
                .addBooleanOption(option => option.setName('public').setDescription('Make embed public for all server members').setRequired(false)))


        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit specific embed properties.')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('Embed ID to edit')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(option => option.setName('title').setDescription('New title (max 256 chars)').setRequired(false))
                .addStringOption(option => option.setName('description').setDescription('New description (max 4096 chars)').setRequired(false))
                .addStringOption(option => option.setName('color').setDescription('New hex color').setRequired(false))
                .addStringOption(option => option.setName('url').setDescription('New embed URL').setRequired(false))
                .addStringOption(option => option.setName('author').setDescription('Author JSON: {"name":"Name","url":"URL","iconURL":"Icon"}').setRequired(false))
                .addStringOption(option => option.setName('footer').setDescription('Footer JSON: {"text":"Text","iconURL":"Icon"}').setRequired(false))
                .addStringOption(option => option.setName('thumbnail').setDescription('New thumbnail URL').setRequired(false))
                .addStringOption(option => option.setName('image').setDescription('New image URL').setRequired(false))
                .addStringOption(option => option.setName('fields').setDescription('Fields JSON: [{"name":"Name","value":"Value","inline":true}]').setRequired(false))
                .addBooleanOption(option => option.setName('timestamp').setDescription('Add/remove timestamp').setRequired(false)))


        .addSubcommand(subcommand =>
            subcommand
                .setName('addfield')
                .setDescription('Add a field to an embed.')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('Embed ID')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(option => option.setName('name').setDescription('Field name (max 256 chars)').setRequired(true))
                .addStringOption(option => option.setName('value').setDescription('Field value (max 1024 chars)').setRequired(true))
                .addBooleanOption(option => option.setName('inline').setDescription('Display field inline').setRequired(false)))


        .addSubcommand(subcommand =>
            subcommand
                .setName('removefield')
                .setDescription('Remove a field from an embed.')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('Embed ID')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addIntegerOption(option => option.setName('index').setDescription('Field index (1-based)').setRequired(true).setMinValue(1).setMaxValue(25)))


        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear specific embed properties.')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('Embed ID')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(option => option.setName('property').setDescription('Property to clear').setRequired(true)
                    .addChoices(
                        { name: 'Title', value: 'title' },
                        { name: 'Description', value: 'description' },
                        { name: 'URL', value: 'url' },
                        { name: 'Author', value: 'author' },
                        { name: 'Footer', value: 'footer' },
                        { name: 'Thumbnail', value: 'thumbnail' },
                        { name: 'Image', value: 'image' },
                        { name: 'All Fields', value: 'fields' },
                        { name: 'Timestamp', value: 'timestamp' }
                    )))


        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View saved embeds.')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('Specific embed ID to view')
                        .setRequired(false)
                        .setAutocomplete(true))
                .addStringOption(option => option.setName('category').setDescription('Filter by category').setRequired(false)
                    .addChoices(
                        { name: 'Announcements', value: 'announcements' },
                        { name: 'Events', value: 'events' },
                        { name: 'Information', value: 'information' },
                        { name: 'Rules', value: 'rules' },
                        { name: 'Welcome', value: 'welcome' },
                        { name: 'General', value: 'general' }
                    )))


        .addSubcommand(subcommand =>
            subcommand
                .setName('clone')
                .setDescription('Clone an existing embed.')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('Embed ID to clone')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(option => option.setName('new_name').setDescription('Name for the cloned embed').setRequired(true)))


        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a saved embed.')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('Embed ID to delete')
                        .setRequired(true)
                        .setAutocomplete(true)))


        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Send an embed to a channel.')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('Embed ID to send')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addChannelOption(option => option.setName('channel').setDescription('Channel to send to').setRequired(true))
                .addRoleOption(option => option.setName('mention_role').setDescription('Role to mention').setRequired(false))
                .addStringOption(option => option.setName('message').setDescription('Additional message content').setRequired(false))
                .addIntegerOption(option => option.setName('delay').setDescription('Delay in seconds').setRequired(false)
                    .setMinValue(0).setMaxValue(3600)))


        .addSubcommand(subcommand =>
            subcommand
                .setName('schedule')
                .setDescription('Schedule recurring embed announcements.')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('Embed ID to schedule')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addChannelOption(option => option.setName('channel').setDescription('Channel to send to').setRequired(true))
                .addStringOption(option => option.setName('frequency').setDescription('Schedule frequency').setRequired(true)
                    .addChoices(
                        { name: 'Every Hour', value: 'hourly' },
                        { name: 'Daily', value: 'daily' },
                        { name: 'Weekly - Monday', value: 'weekly_monday' },
                        { name: 'Weekly - Tuesday', value: 'weekly_tuesday' },
                        { name: 'Weekly - Wednesday', value: 'weekly_wednesday' },
                        { name: 'Weekly - Thursday', value: 'weekly_thursday' },
                        { name: 'Weekly - Friday', value: 'weekly_friday' },
                        { name: 'Weekly - Saturday', value: 'weekly_saturday' },
                        { name: 'Weekly - Sunday', value: 'weekly_sunday' },
                        { name: 'Monthly', value: 'monthly' }
                    ))
                .addStringOption(option => option.setName('time').setDescription('Time to send (HH:MM format)').setRequired(true))
                .addStringOption(option => option.setName('name').setDescription('Schedule name').setRequired(false))
                .addRoleOption(option => option.setName('mention_role').setDescription('Role to mention').setRequired(false))
                .addStringOption(option => option.setName('message').setDescription('Additional message content').setRequired(false))
                .addIntegerOption(option => option.setName('max_runs').setDescription('Maximum number of runs (optional)').setRequired(false)))


        .addSubcommand(subcommand =>
            subcommand
                .setName('schedules')
                .setDescription('Manage scheduled embeds.')
                .addStringOption(option => option.setName('action').setDescription('Action to perform').setRequired(true)
                    .addChoices(
                        { name: 'List All', value: 'list' },
                        { name: 'View Details', value: 'view' },
                        { name: 'Toggle Status', value: 'toggle' },
                        { name: 'Delete', value: 'delete' }
                    ))
                .addStringOption(option =>
                    option.setName('schedule_id')
                        .setDescription('Schedule ID (required for view/toggle/delete)')
                        .setRequired(false)
                        .setAutocomplete(true)))


        .addSubcommand(subcommand =>
            subcommand
                .setName('builder')
                .setDescription('Interactive embed builder with live preview.')
                .addStringOption(option => option.setName('name').setDescription('Embed name').setRequired(true))),

    async autocomplete(interaction) {
        if (!await checkPermissions(interaction)) return;

        const focusedOption = interaction.options.getFocused(true);
        let choices = [];

        if (focusedOption.name === 'embed_id') {
            const embeds = await Embed.find({
                guildId: interaction.guild.id
            }, {
                embedId: 1,
                name: 1,
                category: 1
            }).limit(25);

            choices = embeds.map(embed => ({
                name: `${embed.name} (${embed.embedId}) - ${embed.category}`,
                value: embed.embedId
            }));
        }
        else if (focusedOption.name === 'schedule_id') {
            const schedules = await EmbedSchedule.find({
                guildId: interaction.guild.id
            }, {
                scheduleId: 1,
                name: 1,
                isActive: 1
            }).limit(25);

            choices = schedules.map(schedule => ({
                name: `${schedule.name} (${schedule.scheduleId}) - ${schedule.isActive ? lang.embed.labels.active : lang.embed.labels.inactive}`,
                value: schedule.scheduleId
            }));
        }

        const filtered = choices.filter(choice =>
            choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
        );

        await interaction.respond(filtered.slice(0, 25));
    },

    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({
                content: lang.embed.error.permission,
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'create':
                    await this.handleCreate(interaction);
                    break;
                case 'edit':
                    await this.handleEdit(interaction);
                    break;
                case 'addfield':
                    await this.handleAddField(interaction);
                    break;
                case 'removefield':
                    await this.handleRemoveField(interaction);
                    break;
                case 'clear':
                    await this.handleClear(interaction);
                    break;
                case 'view':
                    await this.handleView(interaction);
                    break;
                case 'clone':
                    await this.handleClone(interaction);
                    break;
                case 'delete':
                    await this.handleDelete(interaction);
                    break;
                case 'send':
                    await this.handleSend(interaction);
                    break;
                case 'schedule':
                    await this.handleSchedule(interaction, client);
                    break;
                case 'schedules':
                    await this.handleSchedules(interaction, client);
                    break;
                case 'builder':
                    await this.handleBuilder(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: lang.embed.error.unknownSubcommand,
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            console.error(`Error executing embed ${subcommand}:`, error);

            const errorReply = {
                content: lang.embed.error.commandError.replace('{subcommand}', subcommand),
                flags: MessageFlags.Ephemeral
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorReply);
            } else {
                await interaction.reply(errorReply);
            }
        }
    },


    async handleCreate(interaction) {
        const name = interaction.options.getString('name');
        const guildId = interaction.guild.id;


        const existingEmbed = await Embed.findOne({ name: name.toLowerCase(), guildId });
        if (existingEmbed) {
            return interaction.reply({
                content: lang.embed.error.alreadyExists.replace('{name}', name).replace('{embedId}', existingEmbed.embedId),
                flags: MessageFlags.Ephemeral
            });
        }


        let embedId;
        do {
            embedId = Embed.generateEmbedId();
        } while (await Embed.findOne({ embedId }));


        const author = this.parseJSON(interaction.options.getString('author'));
        const footer = this.parseJSON(interaction.options.getString('footer'));
        const fields = this.parseJSON(interaction.options.getString('fields'));


        if (fields && (!Array.isArray(fields) || fields.length > 25)) {
            return interaction.reply({
                content: lang.embed.error.fieldsMax,
                flags: MessageFlags.Ephemeral
            });
        }


        if (fields) {
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                if (!field.name || !field.value) {
                    return interaction.reply({
                        content: lang.embed.error.fieldMissingProp.replace('{index}', i + 1),
                        flags: MessageFlags.Ephemeral
                    });
                }
                if (field.name.length > 256) {
                    return interaction.reply({
                        content: lang.embed.error.fieldNameLength.replace('{index}', i + 1),
                        flags: MessageFlags.Ephemeral
                    });
                }
                if (field.value.length > 1024) {
                    return interaction.reply({
                        content: lang.embed.error.fieldValueLength.replace('{index}', i + 1),
                        flags: MessageFlags.Ephemeral
                    });
                }
            }
        }


        const embedData = {
            embedId,
            name: name.toLowerCase(),
            guildId,
            title: interaction.options.getString('title'),
            description: interaction.options.getString('description'),
            color: interaction.options.getString('color') || '#3498db',
            url: interaction.options.getString('url'),
            thumbnail: interaction.options.getString('thumbnail'),
            image: interaction.options.getString('image'),
            timestamp: interaction.options.getBoolean('timestamp') || false,
            category: interaction.options.getString('category') || 'general',
            isPublic: interaction.options.getBoolean('public') || false,
            createdBy: interaction.user.id,
            author,
            footer,
            fields: fields || []
        };


        if (!embedData.title && !embedData.description && (!embedData.fields || embedData.fields.length === 0)) {
            return interaction.reply({
                content: lang.embed.error.missingContent,
                flags: MessageFlags.Ephemeral
            });
        }


        if (embedData.title && embedData.title.length > 256) {
            return interaction.reply({
                content: lang.embed.error.titleLength,
                flags: MessageFlags.Ephemeral
            });
        }

        if (embedData.description && embedData.description.length > 4096) {
            return interaction.reply({
                content: lang.embed.error.descLength,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const embed = new Embed(embedData);
            await embed.save();

            const previewCard = this.buildCardFromData(embed);

            const infoCard = buildCard({
                title: lang.embed.success.createdTitle,
                accentColor: ACCENT.success,
                sections: [
                    lang.embed.success.createdDesc.replace('{name}', name),
                    `**${lang.embed.labels.embedId}:** \`${embedId}\`\n**${lang.embed.labels.category}:** ${embedData.category}\n**${lang.embed.labels.fieldsCount}:** ${embedData.fields.length}/25\n**${lang.embed.labels.propertiesSet}:** ${this.getSetProperties(embedData)}`
                ]
            });

            await interaction.reply({
                components: [previewCard, infoCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error creating embed:', error);

            if (error.name === 'ValidationError') {
                const errorMessages = Object.values(error.errors).map(err => err.message);
                return interaction.reply({
                    content: lang.embed.error.validation.replace('{errors}', errorMessages.join('\n')),
                    flags: MessageFlags.Ephemeral
                });
            }

            return interaction.reply({
                content: lang.embed.error.createFailed,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleEdit(interaction) {
        const embedId = interaction.options.getString('embed_id');
        const embed = await Embed.findOne({ embedId, guildId: interaction.guild.id });

        if (!embed) {
            return interaction.reply({
                content: lang.embed.error.notFound.replace('{embedId}', embedId),
                flags: MessageFlags.Ephemeral
            });
        }


        if (embed.createdBy !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: lang.embed.error.notOwner,
                flags: MessageFlags.Ephemeral
            });
        }

        const updates = {};
        let hasUpdates = false;


        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const color = interaction.options.getString('color');
        const url = interaction.options.getString('url');
        const thumbnail = interaction.options.getString('thumbnail');
        const image = interaction.options.getString('image');
        const timestamp = interaction.options.getBoolean('timestamp');
        const authorJSON = interaction.options.getString('author');
        const footerJSON = interaction.options.getString('footer');
        const fieldsJSON = interaction.options.getString('fields');


        if (title !== null) {
            if (title.length > 256) {
                return interaction.reply({
                    content: lang.embed.error.titleLength,
                    flags: MessageFlags.Ephemeral
                });
            }
            updates.title = title;
            hasUpdates = true;
        }

        if (description !== null) {
            if (description.length > 4096) {
                return interaction.reply({
                    content: lang.embed.error.descLength,
                    flags: MessageFlags.Ephemeral
                });
            }
            updates.description = description;
            hasUpdates = true;
        }

        if (color !== null) {
            updates.color = color;
            hasUpdates = true;
        }

        if (url !== null) {
            updates.url = url;
            hasUpdates = true;
        }

        if (thumbnail !== null) {
            updates.thumbnail = thumbnail;
            hasUpdates = true;
        }

        if (image !== null) {
            updates.image = image;
            hasUpdates = true;
        }

        if (timestamp !== null) {
            updates.timestamp = timestamp;
            hasUpdates = true;
        }


        if (authorJSON !== null) {
            const author = this.parseJSON(authorJSON);
            if (author === null && authorJSON.trim() !== '') {
                return interaction.reply({
                    content: lang.embed.error.invalidAuthorJson,
                    flags: MessageFlags.Ephemeral
                });
            }
            updates.author = author;
            hasUpdates = true;
        }

        if (footerJSON !== null) {
            const footer = this.parseJSON(footerJSON);
            if (footer === null && footerJSON.trim() !== '') {
                return interaction.reply({
                    content: lang.embed.error.invalidFooterJson,
                    flags: MessageFlags.Ephemeral
                });
            }
            updates.footer = footer;
            hasUpdates = true;
        }

        if (fieldsJSON !== null) {
            const fields = this.parseJSON(fieldsJSON);
            if (fields === null && fieldsJSON.trim() !== '') {
                return interaction.reply({
                    content: lang.embed.error.invalidFieldsJson,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (fields && (!Array.isArray(fields) || fields.length > 25)) {
                return interaction.reply({
                    content: lang.embed.error.fieldsMax,
                    flags: MessageFlags.Ephemeral
                });
            }


            if (fields) {
                for (let i = 0; i < fields.length; i++) {
                    const field = fields[i];
                    if (!field.name || !field.value) {
                        return interaction.reply({
                            content: lang.embed.error.fieldMissingProp.replace('{index}', i + 1),
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
            }

            updates.fields = fields || [];
            hasUpdates = true;
        }

        if (!hasUpdates) {
            return interaction.reply({
                content: lang.embed.error.noPropertiesSpecified,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            updates.updatedBy = interaction.user.id;
            updates.updatedAt = new Date();

            await Embed.updateOne({ embedId }, updates);

            const updatedEmbed = await Embed.findOne({ embedId });
            const previewCard = this.buildCardFromData(updatedEmbed);

            const changesCard = buildCard({
                title: lang.embed.success.updatedTitle,
                accentColor: ACCENT.success,
                sections: [
                    lang.embed.success.updatedDesc.replace('{name}', embed.name).replace('{embedId}', embedId),
                    `**${lang.embed.labels.updatedProperties}:** ${Object.keys(updates).filter(key => key !== 'updatedBy' && key !== 'updatedAt').join(', ') || lang.embed.labels.none}`
                ]
            });

            await interaction.reply({
                components: [previewCard, changesCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error updating embed:', error);
            return interaction.reply({
                content: lang.embed.error.updateFailed,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleAddField(interaction) {
        const embedId = interaction.options.getString('embed_id');
        const name = interaction.options.getString('name');
        const value = interaction.options.getString('value');
        const inline = interaction.options.getBoolean('inline') || false;

        const embed = await Embed.findOne({ embedId, guildId: interaction.guild.id });

        if (!embed) {
            return interaction.reply({
                content: lang.embed.error.notFound.replace('{embedId}', embedId),
                flags: MessageFlags.Ephemeral
            });
        }

        if (embed.createdBy !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: lang.embed.error.notOwnerStrict,
                flags: MessageFlags.Ephemeral
            });
        }

        if (embed.fields.length >= 25) {
            return interaction.reply({
                content: lang.embed.error.maxFieldsReached,
                flags: MessageFlags.Ephemeral
            });
        }

        if (name.length > 256) {
            return interaction.reply({
                content: lang.embed.error.fieldSingleNameLength,
                flags: MessageFlags.Ephemeral
            });
        }

        if (value.length > 1024) {
            return interaction.reply({
                content: lang.embed.error.fieldSingleValueLength,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            embed.fields.push({ name, value, inline });
            embed.updatedBy = interaction.user.id;
            embed.updatedAt = new Date();
            await embed.save();

            const previewCard = this.buildCardFromData(embed);

            const successCard = buildCard({
                title: lang.embed.success.fieldAddedTitle,
                accentColor: ACCENT.success,
                sections: [
                    lang.embed.success.fieldAddedDesc.replace('{name}', embed.name).replace('{embedId}', embedId),
                    `**${lang.embed.labels.fieldName}:** ${name}\n**${lang.embed.labels.fieldValue}:** ${value.length > 100 ? value.substring(0, 100) + '...' : value}\n**${lang.embed.labels.inline}:** ${inline.toString()}\n**${lang.embed.labels.totalFields}:** ${embed.fields.length}/25`
                ]
            });

            await interaction.reply({
                components: [previewCard, successCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error adding field:', error);
            return interaction.reply({
                content: lang.embed.error.addFieldFailed,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleRemoveField(interaction) {
        const embedId = interaction.options.getString('embed_id');
        const index = interaction.options.getInteger('index') - 1;

        const embed = await Embed.findOne({ embedId, guildId: interaction.guild.id });

        if (!embed) {
            return interaction.reply({
                content: lang.embed.error.notFound.replace('{embedId}', embedId),
                flags: MessageFlags.Ephemeral
            });
        }

        if (embed.createdBy !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: lang.embed.error.notOwnerStrict,
                flags: MessageFlags.Ephemeral
            });
        }

        if (embed.fields.length === 0) {
            return interaction.reply({
                content: lang.embed.error.noFieldsToRemove,
                flags: MessageFlags.Ephemeral
            });
        }

        if (index < 0 || index >= embed.fields.length) {
            return interaction.reply({
                content: lang.embed.error.invalidFieldIndex.replace('{count}', embed.fields.length),
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const removedField = embed.fields[index];
            embed.fields.splice(index, 1);
            embed.updatedBy = interaction.user.id;
            embed.updatedAt = new Date();
            await embed.save();

            const previewCard = this.buildCardFromData(embed);

            const successCard = buildCard({
                title: lang.embed.success.fieldRemovedTitle,
                accentColor: ACCENT.success,
                sections: [
                    lang.embed.success.fieldRemovedDesc.replace('{name}', embed.name).replace('{embedId}', embedId),
                    `**${lang.embed.labels.removedFieldName}:** ${removedField.name}\n**${lang.embed.labels.totalFields}:** ${embed.fields.length}/25`
                ]
            });

            await interaction.reply({
                components: [previewCard, successCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error removing field:', error);
            return interaction.reply({
                content: lang.embed.error.removeFieldFailed,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleClear(interaction) {
        const embedId = interaction.options.getString('embed_id');
        const property = interaction.options.getString('property');

        const embed = await Embed.findOne({ embedId, guildId: interaction.guild.id });
        if (!embed) {
            return interaction.reply({
                content: lang.embed.error.notFound.replace('{embedId}', embedId),
                flags: MessageFlags.Ephemeral
            });
        }

        const updates = {
            updatedBy: interaction.user.id,
            updatedAt: new Date()
        };

        switch (property) {
            case 'title':
                updates.title = null;
                break;
            case 'description':
                updates.description = null;
                break;
            case 'color':
                updates.color = '#3498db';
                break;
            case 'url':
                updates.url = null;
                break;
            case 'author':
                updates.author = null;
                break;
            case 'footer':
                updates.footer = null;
                break;
            case 'thumbnail':
                updates.thumbnail = null;
                break;
            case 'image':
                updates.image = null;
                break;
            case 'fields':
                updates.fields = [];
                break;
            case 'timestamp':
                updates.timestamp = false;
                break;
            default:
                return interaction.reply({
                    content: lang.embed.error.invalidProperty.replace('{property}', property),
                    flags: MessageFlags.Ephemeral
                });
        }

        try {
            await Embed.updateOne({ embedId }, updates);
            const updatedEmbed = await Embed.findOne({ embedId });
            const previewCard = this.buildCardFromData(updatedEmbed);

            const successCard = buildCard({
                title: lang.embed.success.propertyClearedTitle,
                description: lang.embed.success.propertyClearedDesc.replace('{property}', property.charAt(0).toUpperCase() + property.slice(1)).replace('{name}', embed.name).replace('{embedId}', embedId),
                accentColor: ACCENT.warning
            });

            await interaction.reply({
                components: [previewCard, successCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error clearing property:', error);
            return interaction.reply({
                content: lang.embed.error.clearPropertyFailed,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleView(interaction) {
        const embedId = interaction.options.getString('embed_id');
        const category = interaction.options.getString('category');

        if (!embedId) {
            
            const query = { guildId: interaction.guild.id };
            if (category) query.category = category;

            const embeds = await Embed.find(query).sort({ createdAt: -1 }).limit(25);
            if (embeds.length === 0) {
                return interaction.reply({
                    content: lang.embed.error.noEmbedsFound,
                    flags: MessageFlags.Ephemeral
                });
            }

            const listCard = buildCard({
                title: category ? lang.embed.success.listTitleCategory.replace('{category}', category.charAt(0).toUpperCase() + category.slice(1)) : lang.embed.success.listTitle,
                description: lang.embed.success.listDesc.replace('{count}', embeds.length),
                accentColor: ACCENT.primary,
                sections: embeds.map((embed, index) => {
                    return `**${index + 1}. ${embed.name}**\n` +
                        lang.embed.success.listFieldDesc
                            .replace('{embedId}', embed.embedId)
                            .replace('{category}', embed.category)
                            .replace('{type}', embed.type)
                            .replace('{usage}', embed.usageCount)
                            .replace('{isPublic}', embed.isPublic ? lang.embed.labels.yes : lang.embed.labels.no);
                })
            });

            return interaction.reply({
                components: [listCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const embed = await Embed.findOne({ embedId, guildId: interaction.guild.id });
        if (!embed) {
            return interaction.reply({
                content: lang.embed.error.notFound.replace('{embedId}', embedId),
                flags: MessageFlags.Ephemeral
            });
        }

        const previewCard = this.buildCardFromData(embed);
        const detailsCard = buildCard({
            title: lang.embed.success.detailsTitle,
            description: lang.embed.success.detailsDesc.replace('{name}', embed.name),
            accentColor: ACCENT.primary,
            sections: [
                `**${lang.embed.labels.embedId}:** \`${embed.embedId}\`\n**${lang.embed.labels.category}:** ${embed.category}\n**${lang.embed.labels.type}:** ${embed.type}\n**${lang.embed.labels.createdBy}:** <@${embed.createdBy}>\n**${lang.embed.labels.created}:** <t:${Math.floor(embed.createdAt.getTime() / 1000)}:R>\n**${lang.embed.labels.usageCount}:** ${embed.usageCount.toString()}\n**${lang.embed.labels.propertiesSet}:** ${this.getSetProperties(embed)}\n**${lang.embed.labels.fields}:** ${embed.fields.length}/25\n**${lang.embed.labels.public}:** ${embed.isPublic ? lang.embed.labels.yes : lang.embed.labels.no}\n**${lang.embed.labels.lastUsed}:** ${embed.lastUsed ? `<t:${Math.floor(embed.lastUsed.getTime() / 1000)}:R>` : lang.embed.labels.never}`
            ]
        });

        await interaction.reply({
            components: [previewCard, detailsCard],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    },

    async handleClone(interaction) {
        const embedId = interaction.options.getString('embed_id');
        const newName = interaction.options.getString('new_name');

        const originalEmbed = await Embed.findOne({ embedId, guildId: interaction.guild.id });
        if (!originalEmbed) {
            return interaction.reply({
                content: lang.embed.error.notFound.replace('{embedId}', embedId),
                flags: MessageFlags.Ephemeral
            });
        }

        const existingNew = await Embed.findOne({ name: newName.toLowerCase(), guildId: interaction.guild.id });
        if (existingNew) {
            return interaction.reply({
                content: lang.embed.error.alreadyExists.replace('{name}', newName).replace('{embedId}', existingNew.embedId),
                flags: MessageFlags.Ephemeral
            });
        }

        let newEmbedId;
        do {
            newEmbedId = Embed.generateEmbedId();
        } while (await Embed.findOne({ embedId: newEmbedId }));

        try {
            const clonedData = originalEmbed.toObject();
            delete clonedData._id;
            clonedData.embedId = newEmbedId;
            clonedData.name = newName.toLowerCase();
            clonedData.createdBy = interaction.user.id;
            clonedData.createdAt = new Date();
            clonedData.updatedBy = interaction.user.id;
            clonedData.updatedAt = new Date();
            clonedData.usageCount = 0;
            clonedData.lastUsed = null;

            const clonedEmbed = new Embed(clonedData);
            await clonedEmbed.save();

            const previewCard = this.buildCardFromData(clonedEmbed);
            const successCard = buildCard({
                title: lang.embed.success.clonedTitle,
                description: lang.embed.success.clonedDesc.replace('{originalName}', originalEmbed.name).replace('{name}', newName),
                accentColor: ACCENT.success,
                sections: [
                    `**${lang.embed.labels.originalId}:** \`${embedId}\`\n**${lang.embed.labels.newId}:** \`${newEmbedId}\`\n**${lang.embed.labels.propertiesCopied}:** ${this.getSetProperties(clonedEmbed)}`
                ]
            });

            await interaction.reply({
                components: [previewCard, successCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error cloning embed:', error);
            return interaction.reply({
                content: lang.embed.error.cloneFailed,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleDelete(interaction) {
        const embedId = interaction.options.getString('embed_id');

        const embed = await Embed.findOne({ embedId, guildId: interaction.guild.id });
        if (!embed) {
            return interaction.reply({
                content: lang.embed.error.notFound.replace('{embedId}', embedId),
                flags: MessageFlags.Ephemeral
            });
        }

        const scheduleCount = await EmbedSchedule.countDocuments({ embedId, guildId: interaction.guild.id });

        const confirmCard = buildCard({
            title: lang.embed.success.confirmDeletionTitle,
            description: lang.embed.success.confirmDeletionDesc.replace('{name}', embed.name).replace('{embedId}', embedId),
            accentColor: ACCENT.warning,
            sections: [
                `**${lang.embed.labels.usageCount}:** ${embed.usageCount.toString()}\n**${lang.embed.labels.activeSchedules}:** ${scheduleCount.toString()}` +
                (scheduleCount > 0 ? `\n\n**${lang.embed.warning.warningField}:** ${lang.embed.warning.schedulesAffected.replace('{count}', scheduleCount)}` : '')
            ]
        });

        const confirmButton = new ButtonBuilder()
            .setCustomId(`delete_embed_${embedId}`)
            .setLabel(lang.embed.buttons.delete)
            .setStyle(ButtonStyle.Danger)
            .setEmoji(getButtonEmoji('delete') || '🗑️');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel(lang.embed.buttons.cancel)
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
        confirmCard.addActionRowComponents(row);

        await interaction.reply({
            components: [confirmCard],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
        const response = await interaction.fetchReply();

        const filter = i => (i.customId === `delete_embed_${embedId}` || i.customId === 'cancel_delete') && i.user.id === interaction.user.id;
        let confirmation;
        try {
            confirmation = await response.awaitMessageComponent({ filter, time: 30000 });
        } catch (error) {
            if (error.code !== 'InteractionCollectorError') {
                console.error('[Embed] Delete confirmation collector failed:', error);
            }
            await interaction.editReply({
                content: lang.embed.error.deletionTimeout,
                components: []
            }).catch(() => { });
            return;
        }

        try {
            await confirmation.deferUpdate();
            if (confirmation.customId === `delete_embed_${embedId}`) {
                await Embed.deleteOne({ embedId });

                if (scheduleCount > 0) {
                    await EmbedSchedule.updateMany(
                        { embedId, guildId: interaction.guild.id },
                        { isActive: false, lastError: 'Embed was deleted' }
                    );
                }

                const successCard = buildCard({
                    title: lang.embed.success.deletedTitle,
                    description: lang.embed.success.deletedDesc.replace('{name}', embed.name).replace('{embedId}', embedId),
                    accentColor: ACCENT.danger,
                    sections: scheduleCount > 0 ? [
                        `**${lang.embed.success.schedulesUpdated}:** ${lang.embed.success.schedulesDisabled.replace('{count}', scheduleCount)}`
                    ] : []
                });

                await confirmation.editReply({
                    components: [successCard],
                    flags: MessageFlags.IsComponentsV2
                });

            } else {
                await confirmation.editReply({
                    content: lang.embed.error.deletionCancelled,
                    components: []
                });
            }

        } catch (error) {
            console.error('[Embed] Delete confirmation action failed:', error);
            await confirmation.editReply({
                content: lang.embed.error.deletionFailed || lang.embed.error.deletionTimeout,
                components: []
            }).catch(() => { });
        }
    },

    async handleSend(interaction) {
        const embedId = interaction.options.getString('embed_id');
        const channel = interaction.options.getChannel('channel');
        const mentionRole = interaction.options.getRole('mention_role');
        const message = interaction.options.getString('message');
        const delay = interaction.options.getInteger('delay') || 0;

        const embed = await Embed.findOne({ embedId, guildId: interaction.guild.id });

        if (!embed) {
            return interaction.reply({
                content: lang.embed.error.notFound.replace('{embedId}', embedId),
                flags: MessageFlags.Ephemeral
            });
        }

        if (!embed.isPublic && embed.createdBy !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: lang.embed.error.notOwnerSend,
                flags: MessageFlags.Ephemeral
            });
        }

        if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.SendMessages)) {
            return interaction.reply({
                content: lang.embed.error.noSendPermission.replace('{channel}', channel.toString()),
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const discordCard = this.buildCardFromData(embed);

            let content = message || '';
            if (mentionRole) {
                content = `${mentionRole.toString()} ${content}`.trim();
            }

            const sendMessage = async () => {
                if (content) {
                    await channel.send({ content });
                }
                await channel.send({
                    components: [discordCard],
                    flags: MessageFlags.IsComponentsV2
                });


                await Embed.updateOne(
                    { embedId },
                    {
                        $inc: { usageCount: 1 },
                        $set: { lastUsed: new Date() }
                    }
                );
            };

            if (delay > 0) {
                await interaction.reply({
                    content: lang.embed.success.delayedSend.replace('{name}', embed.name).replace('{channel}', channel.toString()).replace('{delay}', delay),
                    flags: MessageFlags.Ephemeral
                });

                setTimeout(sendMessage, delay * 1000);
            } else {
                await sendMessage();
                await interaction.reply({
                    content: lang.embed.success.sent.replace('{name}', embed.name).replace('{channel}', channel.toString()),
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (error) {
            console.error('Error sending embed:', error);
            return interaction.reply({
                content: lang.embed.error.sendFailed,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleSchedule(interaction, client) {
        const embedId = interaction.options.getString('embed_id');
        const channel = interaction.options.getChannel('channel');
        const frequency = interaction.options.getString('frequency');
        const time = interaction.options.getString('time');
        const scheduleName = interaction.options.getString('name');
        const mentionRole = interaction.options.getRole('mention_role');
        const message = interaction.options.getString('message');
        const maxRuns = interaction.options.getInteger('max_runs');


        if (!/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(time)) {
            return interaction.reply({
                content: lang.embed.error.invalidTimeFormat,
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = await Embed.findOne({ embedId, guildId: interaction.guild.id });

        if (!embed) {
            return interaction.reply({
                content: lang.embed.error.notFound.replace('{embedId}', embedId),
                flags: MessageFlags.Ephemeral
            });
        }

        if (!embed.isPublic && embed.createdBy !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: lang.embed.error.notOwnerSchedule,
                flags: MessageFlags.Ephemeral
            });
        }

        if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.SendMessages)) {
            return interaction.reply({
                content: lang.embed.error.noSendPermission.replace('{channel}', channel.toString()),
                flags: MessageFlags.Ephemeral
            });
        }


        let scheduleId;
        do {
            scheduleId = EmbedSchedule.generateScheduleId();
        } while (await EmbedSchedule.findOne({ scheduleId }));

        try {
            const scheduleData = {
                scheduleId,
                name: scheduleName || `${embed.name}_schedule`,
                guildId: interaction.guild.id,
                embedId,
                channelId: channel.id,
                frequency,
                time,
                mentionRoleId: mentionRole?.id,
                messageContent: message,
                maxRuns,
                createdBy: interaction.user.id
            };

            const schedule = new EmbedSchedule(scheduleData);
            await schedule.save();


            if (client.embedScheduler) {
                const result = await client.embedScheduler.addSchedule(scheduleData);
                if (!result.success) {
                    await EmbedSchedule.deleteOne({ scheduleId });
                    return interaction.reply({
                        content: lang.embed.error.scheduleCreateFailed.replace('{error}', result.error),
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            const successCard = buildCard({
                title: lang.embed.success.scheduledTitle,
                description: lang.embed.success.scheduledDesc.replace('{name}', embed.name),
                accentColor: ACCENT.success,
                sections: [
                    `**${lang.embed.labels.scheduleId}:** \`${scheduleId}\`\n**${lang.embed.labels.channel}:** ${channel.toString()}\n**${lang.embed.labels.frequency}:** ${frequency.replace('_', ' ')}\n**${lang.embed.labels.time}:** ${time}\n**${lang.embed.labels.maxRuns}:** ${maxRuns ? maxRuns.toString() : lang.embed.labels.unlimited}\n**${lang.embed.labels.mentionRole}:** ${mentionRole ? mentionRole.toString() : lang.embed.labels.none}`
                ]
            });

            await interaction.reply({
                components: [successCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error creating schedule:', error);
            return interaction.reply({
                content: lang.embed.error.scheduleFailed,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleSchedules(interaction, client) {
        const action = interaction.options.getString('action');
        const scheduleId = interaction.options.getString('schedule_id');

        if (action === 'list') {
            const schedules = await EmbedSchedule.find({ guildId: interaction.guild.id })
                .populate('embedId', 'name')
                .sort({ createdAt: -1 })
                .limit(10);

            if (schedules.length === 0) {
                return interaction.reply({
                    content: lang.embed.error.noSchedulesFound,
                    flags: MessageFlags.Ephemeral
                });
            }

            const scheduleSections = schedules.map((schedule, index) => {
                const embedName = schedule.embedId?.name || lang.embed.labels.unknown;
                const status = schedule.isActive ? `${getEmoji('tick')} ${lang.embed.labels.active}` : `${getEmoji('cross')} ${lang.embed.labels.inactive}`;
                const nextRun = schedule.nextRun ? `<t:${Math.floor(schedule.nextRun.getTime() / 1000)}:R>` : lang.embed.labels.notScheduled;

                return `**${index + 1}. ${schedule.name}**\n` +
                    lang.embed.success.schedulesListField
                        .replace('{scheduleId}', schedule.scheduleId)
                        .replace('{embedName}', embedName)
                        .replace('{status}', status)
                        .replace('{frequency}', schedule.frequency)
                        .replace('{nextRun}', nextRun);
            });

            const listCard = buildCard({
                title: lang.embed.success.schedulesListTitle,
                description: lang.embed.success.schedulesListDesc.replace('{count}', schedules.length),
                accentColor: ACCENT.primary,
                sections: scheduleSections
            });

            return interaction.reply({
                components: [listCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } else {
            if (!scheduleId) {
                return interaction.reply({
                    content: lang.embed.error.scheduleIdRequired,
                    flags: MessageFlags.Ephemeral
                });
            }

            const schedule = await EmbedSchedule.findOne({
                scheduleId,
                guildId: interaction.guild.id
            });

            if (!schedule) {
                return interaction.reply({
                    content: lang.embed.error.scheduleNotFound.replace('{scheduleId}', scheduleId),
                    flags: MessageFlags.Ephemeral
                });
            }

            if (schedule.createdBy !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({
                    content: lang.embed.error.notOwnerManageSchedule,
                    flags: MessageFlags.Ephemeral
                });
            }

            switch (action) {
                case 'view':
                    const embed = await Embed.findOne({ embedId: schedule.embedId });
                    const channel = interaction.guild.channels.cache.get(schedule.channelId);
                    const role = schedule.mentionRoleId ? interaction.guild.roles.cache.get(schedule.mentionRoleId) : null;

                    const statusText = schedule.isActive ? `${getEmoji('tick')} ${lang.embed.labels.active}` : `${getEmoji('cross')} ${lang.embed.labels.inactive}`;
                    const detailsCard = buildCard({
                        title: lang.embed.success.scheduleDetailsTitle.replace('{name}', schedule.name),
                        accentColor: ACCENT.primary,
                        sections: [
                            `**${lang.embed.labels.scheduleId}:** \`${schedule.scheduleId}\`\n**${lang.embed.labels.embed}:** ${embed ? embed.name : lang.embed.labels.unknown} (\`${schedule.embedId}\`)\n**${lang.embed.labels.channel}:** ${channel ? channel.toString() : lang.embed.labels.unknown}\n**${lang.embed.labels.status}:** ${statusText}\n**${lang.embed.labels.frequency}:** ${schedule.frequency.replace('_', ' ')}\n**${lang.embed.labels.time}:** ${schedule.time}\n**${lang.embed.labels.mentionRole}:** ${role?.toString() || lang.embed.labels.none}\n**${lang.embed.labels.runCount}:** ${schedule.runCount.toString()}\n**${lang.embed.labels.maxRuns}:** ${schedule.maxRuns?.toString() || lang.embed.labels.unlimited}\n**${lang.embed.labels.created}:** <t:${Math.floor(schedule.createdAt.getTime() / 1000)}:R>\n**${lang.embed.labels.lastRun}:** ${schedule.lastRun ? `<t:${Math.floor(schedule.lastRun.getTime() / 1000)}:R>` : lang.embed.labels.never}\n**${lang.embed.labels.nextRun}:** ${schedule.nextRun ? `<t:${Math.floor(schedule.nextRun.getTime() / 1000)}:R>` : lang.embed.labels.notScheduled}` +
                            (schedule.lastError ? `\n\n**${lang.embed.labels.lastError}:** ${schedule.lastError}` : '')
                        ]
                    });

                    return interaction.reply({
                        components: [detailsCard],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                    });

                case 'toggle':
                    try {
                        const newStatus = !schedule.isActive;
                        await EmbedSchedule.updateOne(
                            { scheduleId },
                            { isActive: newStatus }
                        );

                        if (client.embedScheduler) {
                            if (newStatus) {
                                await client.embedScheduler.addSchedule(schedule);
                            } else {
                                client.embedScheduler.removeJob(scheduleId);
                            }
                        }

                        const statusCard = buildCard({
                            title: lang.embed.success.scheduleToggledTitle.replace('{status}', newStatus ? lang.embed.labels.enabled : lang.embed.labels.disabled),
                            description: lang.embed.success.scheduleToggledDesc.replace('{name}', schedule.name).replace('{scheduleId}', scheduleId).replace('{status}', newStatus ? lang.embed.labels.active.toLowerCase() : lang.embed.labels.inactive.toLowerCase()),
                            accentColor: newStatus ? ACCENT.success : ACCENT.warning
                        });

                        return interaction.reply({
                            components: [statusCard],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });

                    } catch (error) {
                        console.error('Error toggling schedule:', error);
                        return interaction.reply({
                            content: lang.embed.error.scheduleToggleFailed,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                case 'delete':
                    try {
                        await EmbedSchedule.deleteOne({ scheduleId });

                        if (client.embedScheduler) {
                            client.embedScheduler.removeJob(scheduleId);
                        }

                        const deleteCard = buildCard({
                            title: lang.embed.success.scheduleDeletedTitle,
                            description: lang.embed.success.scheduleDeletedDesc.replace('{name}', schedule.name).replace('{scheduleId}', scheduleId),
                            accentColor: ACCENT.danger
                        });

                        return interaction.reply({
                            components: [deleteCard],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });

                    } catch (error) {
                        console.error('Error deleting schedule:', error);
                        return interaction.reply({
                            content: lang.embed.error.scheduleDeleteFailed,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                default:
                    return interaction.reply({
                        content: lang.embed.error.invalidAction,
                        flags: MessageFlags.Ephemeral
                    });
            }
        }
    },

    async handleBuilder(interaction) {
        const name = interaction.options.getString('name');


        const existingEmbed = await Embed.findOne({
            name: name.toLowerCase(),
            guildId: interaction.guild.id
        });

        if (existingEmbed) {
            return interaction.reply({
                content: lang.embed.error.builderNameExists.replace('{name}', name),
                flags: MessageFlags.Ephemeral
            });
        }


        let embedId;
        do {
            embedId = Embed.generateEmbedId();
        } while (await Embed.findOne({ embedId }));

        const embedData = {
            embedId,
            name: name.toLowerCase(),
            guildId: interaction.guild.id,
            title: lang.embed.builder.defaultNewTitle.replace('{name}', name),
            description: lang.embed.builder.defaultNewDesc,
            color: '#3498db',
            category: 'general',
            type: 'normal',
            createdBy: interaction.user.id,
            fields: []
        };

        try {
            const embed = new Embed(embedData);
            await embed.save();

            const previewCard = this.buildCardFromData(embed);

            const builderCard = buildCard({
                title: lang.embed.builder.title,
                description: lang.embed.builder.description.replace('{name}', name).replace('{embedId}', embedId),
                accentColor: 0x9b59b6,
                sections: [
                    `**${lang.embed.builder.currentProperties}:**\n${this.getSetProperties(embed)}`
                ]
            });

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`builder_title_${embedId}`)
                    .setLabel(lang.embed.buttons.editTitle)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(getButtonEmoji('document') || '📝'),
                new ButtonBuilder()
                    .setCustomId(`builder_description_${embedId}`)
                    .setLabel(lang.embed.buttons.editDescription)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(getButtonEmoji('document') || '📝'),
                new ButtonBuilder()
                    .setCustomId(`builder_color_${embedId}`)
                    .setLabel(lang.embed.buttons.changeColor)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(getButtonEmoji('paint') || '🎨'),
                new ButtonBuilder()
                    .setCustomId(`builder_author_${embedId}`)
                    .setLabel(lang.embed.buttons.setAuthor)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(getButtonEmoji('user') || '👤'),
                new ButtonBuilder()
                    .setCustomId(`builder_footer_${embedId}`)
                    .setLabel(lang.embed.buttons.setFooter)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(getButtonEmoji('tag') || '🏷️')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`builder_fields_${embedId}`)
                    .setLabel(lang.embed.buttons.manageFields)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(getButtonEmoji('list') || '📋'),
                new ButtonBuilder()
                    .setCustomId(`builder_images_${embedId}`)
                    .setLabel(lang.embed.buttons.setImages)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(getButtonEmoji('media') || '🖼️'),
                new ButtonBuilder()
                    .setCustomId(`builder_advanced_${embedId}`)
                    .setLabel(lang.embed.buttons.advanced)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(getButtonEmoji('settings') || '⚙️'),
                new ButtonBuilder()
                    .setCustomId(`builder_save_${embedId}`)
                    .setLabel(lang.embed.buttons.saveFinish)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(getButtonEmoji('tick') || '✅'),
                new ButtonBuilder()
                    .setCustomId(`builder_cancel_${embedId}`)
                    .setLabel(lang.embed.buttons.cancel)
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(getButtonEmoji('cross') || '❌')
            );

            builderCard.addActionRowComponents(row1);
            builderCard.addActionRowComponents(row2);

            await interaction.reply({
                components: [previewCard, builderCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error starting builder:', error);
            return interaction.reply({
                content: lang.embed.error.builderFailed,
                flags: MessageFlags.Ephemeral
            });
        }
    },


    parseJSON(jsonString) {
        if (!jsonString || jsonString.trim() === '') return null;
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            return null;
        }
    },

    getSetProperties(embed) {
        const properties = [];
        if (embed.title) properties.push(lang.embed.labels.title);
        if (embed.description) properties.push(lang.embed.labels.description);
        if (embed.url) properties.push(lang.embed.labels.url);
        if (embed.author?.name) properties.push(lang.embed.labels.author);
        if (embed.footer?.text) properties.push(lang.embed.labels.footer);
        if (embed.thumbnail) properties.push(lang.embed.labels.thumbnail);
        if (embed.image) properties.push(lang.embed.labels.image);
        if (embed.fields?.length > 0) properties.push(`${lang.embed.labels.fields} (${embed.fields.length})`);
        if (embed.timestamp) properties.push(lang.embed.labels.timestamp);
        if (embed.color !== '#3498db') properties.push(lang.embed.labels.color);

        return properties.length > 0 ? properties.join(', ') : lang.embed.labels.none;
    },

    buildCardFromData(embedData) {
        const sections = [];
        if (embedData.description) {
            sections.push(embedData.description);
        }
        if (embedData.fields?.length) {
            const fieldsText = embedData.fields
                .map(f => `**${f.name}**\n${f.value}`)
                .join('\n\n');
            if (fieldsText) sections.push(fieldsText);
        }

        let accentColor = ACCENT.primary;
        if (embedData.color) {
            try {
                accentColor = typeof embedData.color === 'string' && embedData.color.startsWith('#')
                    ? parseInt(embedData.color.replace('#', ''), 16)
                    : Number(embedData.color);
            } catch (e) {
                accentColor = ACCENT.primary;
            }
        }

        return buildCard({
            title: embedData.title || null,
            sections: sections.length ? sections : ['\u200b'],
            thumbnailURL: embedData.thumbnail || null,
            bannerURL: embedData.image || null,
            accentColor,
            _footer: embedData.footer?.text || null
        });
    },

    buildEmbedFromData(embedData) {
        return this.buildCardFromData(embedData);
    }
};


