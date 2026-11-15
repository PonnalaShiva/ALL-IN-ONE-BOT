const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const Embed = require('../models/embed/embed');
const { registerInteractionHandler, runWithinAcknowledgementWindow } = require('../utils/interactionRouter');

function replyError(interaction, message) {
    const payload = {
        components: [buildCard({
            title: `${getEmoji('cross')} ${message}`,
            tone: 'danger'
        })],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    };
    if (interaction.deferred && !interaction.replied) return interaction.editReply(payload);
    if (interaction.replied) return interaction.followUp(payload);
    return interaction.reply(payload);
}

class EmbedBuilderModalHandler {
    constructor(client) {
        this.client = client;
        this.activeBuilders = new Map();
        this.listener = null;
        this.unregisterInteractionRoute = null;
        this.init();
    }

    init() {
        this.listener = async (interaction) => {
            try {
                if (interaction.isButton() && interaction.customId.startsWith('builder_')) {
                    await this.handleBuilderButton(interaction);
                } else if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_')) {
                    await this.handleModalSubmit(interaction);
                } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_')) {
                    await this.handleSelectMenu(interaction);
                }
            } catch (err) {
                console.error('[EmbedBuilderModals] Interaction error:', err);
            }
        };
        if (this.client) {
            this.unregisterInteractionRoute = registerInteractionHandler(this.client, {
                name: 'embed-builder',
                prefixes: ['builder_', 'modal_title_', 'modal_description_', 'modal_color_', 'modal_author_', 'modal_footer_', 'modal_images_', 'modal_advanced_', 'modal_editfield_', 'select_editfield_', 'select_removefield_'],
                types: ['button', 'modal', 'stringSelect'],
                handler: this.listener
            });
        }
    }

    stop() {
        this.unregisterInteractionRoute?.();
        this.unregisterInteractionRoute = null;
        this.listener = null;
        this.activeBuilders.clear();
    }

    async handleBuilderButton(interaction) {
        const [action, property, embedId] = interaction.customId.split('_');
        if (!embedId) return;
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const err = lang.embed?.error || {};

        try {
            const lookup = await runWithinAcknowledgementWindow(
                interaction,
                () => Embed.findOne({ embedId, guildId: interaction.guild.id }),
                'The embed is taking too long to load. Please try again shortly.'
            );
            if (!lookup.completed) return;
            const embed = lookup.value;
            if (!embed) {
                return replyError(interaction, err.notFound ? err.notFound.replace('{embedId}', embedId) : 'Embed not found.');
            }

            
            if (embed.createdBy !== interaction.user.id) {
                return replyError(interaction, lang.embed?.error?.notOwnerStrict);
            }

            if (property === 'save' || property === 'cancel') {
                await interaction.deferUpdate();
            }

            switch (property) {
                case 'title':
                    await this.showTitleModal(interaction, embed);
                    break;
                case 'description':
                    await this.showDescriptionModal(interaction, embed);
                    break;
                case 'color':
                    await this.showColorModal(interaction, embed);
                    break;
                case 'author':
                    await this.showAuthorModal(interaction, embed);
                    break;
                case 'footer':
                    await this.showFooterModal(interaction, embed);
                    break;
                case 'fields':
                    await this.showFieldsMenu(interaction, embed);
                    break;
                case 'images':
                    await this.showImagesModal(interaction, embed);
                    break;
                case 'advanced':
                    await this.showAdvancedModal(interaction, embed);
                    break;
                case 'save':
                    await this.saveEmbed(interaction, embed);
                    break;
                case 'cancel':
                    await this.cancelBuilder(interaction, embed);
                    break;
                case 'back':
                    await this.refreshBuilder(interaction, embed.embedId);
                    break;
                case 'addfield':
                    await this.showAddFieldModal(interaction, embed);
                    break;
                case 'editfield':
                    await this.showEditFieldModal(interaction, embed);
                    break;
                case 'removefield':
                    await this.showRemoveFieldMenu(interaction, embed);
                    break;
                default:
                    await replyError(interaction, m.unknownAction);
            }
        } catch (error) {
            console.error('Error handling builder button:', error);
            await replyError(interaction, m.errorProcessing);
        }
    }

    async showTitleModal(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const modal = new ModalBuilder()
            .setCustomId(`modal_title_${embed.embedId}`)
            .setTitle(m.titleModalTitle);

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel(m.titleLabel)
            .setStyle(TextInputStyle.Short)
            .setValue(embed.title || '')
            .setMaxLength(256)
            .setRequired(false);

        const urlInput = new TextInputBuilder()
            .setCustomId('url')
            .setLabel(m.urlLabel)
            .setStyle(TextInputStyle.Short)
            .setValue(embed.url || '')
            .setRequired(false)
            .setPlaceholder(m.urlPlaceholder);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(urlInput)
        );

        await interaction.showModal(modal);
    }

    async showDescriptionModal(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const modal = new ModalBuilder()
            .setCustomId(`modal_description_${embed.embedId}`)
            .setTitle(m.descModalTitle);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel(m.descLabel)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(embed.description || '')
            .setMaxLength(4000)
            .setRequired(false)
            .setPlaceholder(m.descPlaceholder);

        modal.addComponents(
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        await interaction.showModal(modal);
    }

    async showColorModal(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const modal = new ModalBuilder()
            .setCustomId(`modal_color_${embed.embedId}`)
            .setTitle(m.colorModalTitle);

        const colorInput = new TextInputBuilder()
            .setCustomId('color')
            .setLabel(m.colorLabel)
            .setStyle(TextInputStyle.Short)
            .setValue(embed.color || '#3498db')
            .setMaxLength(7)
            .setRequired(true)
            .setPlaceholder(m.colorPlaceholder);

        const timestampInput = new TextInputBuilder()
            .setCustomId('timestamp')
            .setLabel(m.timestampLabel)
            .setStyle(TextInputStyle.Short)
            .setValue(embed.timestamp ? 'yes' : 'no')
            .setMaxLength(3)
            .setRequired(false)
            .setPlaceholder(m.timestampPlaceholder);

        modal.addComponents(
            new ActionRowBuilder().addComponents(colorInput),
            new ActionRowBuilder().addComponents(timestampInput)
        );

        await interaction.showModal(modal);
    }

    async showAuthorModal(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const modal = new ModalBuilder()
            .setCustomId(`modal_author_${embed.embedId}`)
            .setTitle(m.authorModalTitle);

        const authorNameInput = new TextInputBuilder()
            .setCustomId('author_name')
            .setLabel(m.authorNameLabel)
            .setStyle(TextInputStyle.Short)
            .setValue(embed.author?.name || '')
            .setMaxLength(256)
            .setRequired(false)
            .setPlaceholder(m.authorNamePlaceholder);

        const authorUrlInput = new TextInputBuilder()
            .setCustomId('author_url')
            .setLabel(m.authorUrlLabel)
            .setStyle(TextInputStyle.Short)
            .setValue(embed.author?.url || '')
            .setRequired(false)
            .setPlaceholder('https://example.com');

        const authorIconInput = new TextInputBuilder()
            .setCustomId('author_icon')
            .setLabel(m.authorIconLabel)
            .setStyle(TextInputStyle.Short)
            .setValue(embed.author?.iconURL || '')
            .setRequired(false)
            .setPlaceholder(m.authorIconPlaceholder);

        modal.addComponents(
            new ActionRowBuilder().addComponents(authorNameInput),
            new ActionRowBuilder().addComponents(authorUrlInput),
            new ActionRowBuilder().addComponents(authorIconInput)
        );

        await interaction.showModal(modal);
    }

    async showFooterModal(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const modal = new ModalBuilder()
            .setCustomId(`modal_footer_${embed.embedId}`)
            .setTitle(m.footerModalTitle);

        const footerTextInput = new TextInputBuilder()
            .setCustomId('footer_text')
            .setLabel(m.footerTextLabel)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(embed.footer?.text || '')
            .setMaxLength(2048)
            .setRequired(false)
            .setPlaceholder(m.footerTextPlaceholder);

        const footerIconInput = new TextInputBuilder()
            .setCustomId('footer_icon')
            .setLabel(m.footerIconLabel)
            .setStyle(TextInputStyle.Short)
            .setValue(embed.footer?.iconURL || '')
            .setRequired(false)
            .setPlaceholder('https://example.com/icon.png');

        modal.addComponents(
            new ActionRowBuilder().addComponents(footerTextInput),
            new ActionRowBuilder().addComponents(footerIconInput)
        );

        await interaction.showModal(modal);
    }

    async showImagesModal(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const modal = new ModalBuilder()
            .setCustomId(`modal_images_${embed.embedId}`)
            .setTitle(m.imagesModalTitle);

        const thumbnailInput = new TextInputBuilder()
            .setCustomId('thumbnail')
            .setLabel(m.thumbnailLabel)
            .setStyle(TextInputStyle.Short)
            .setValue(embed.thumbnail || '')
            .setRequired(false)
            .setPlaceholder(m.thumbnailPlaceholder);

        const imageInput = new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Main Image URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(embed.image || '')
            .setRequired(false)
            .setPlaceholder(m.imagePlaceholder);

        modal.addComponents(
            new ActionRowBuilder().addComponents(thumbnailInput),
            new ActionRowBuilder().addComponents(imageInput)
        );

        await interaction.showModal(modal);
    }

    async showFieldsMenu(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const addButton = new ButtonBuilder()
            .setCustomId(`builder_addfield_${embed.embedId}`)
            .setLabel('Add Field')
            .setStyle(ButtonStyle.Success);
        const editButton = new ButtonBuilder()
            .setCustomId(`builder_editfield_${embed.embedId}`)
            .setLabel('Edit Field')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(embed.fields.length === 0);
        const removeButton = new ButtonBuilder()
            .setCustomId(`builder_removefield_${embed.embedId}`)
            .setLabel('Remove Field')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(embed.fields.length === 0);
        const backButton = new ButtonBuilder()
            .setCustomId(`builder_back_${embed.embedId}`)
            .setLabel('Back to Builder')
            .setStyle(ButtonStyle.Secondary);
        const card = buildCard({
            title: `${getEmoji('list')} Manage Fields`,
            tone: 'setup',
            sections: [`This embed has **${embed.fields.length}/25** fields.`, m.selectEditPrompt || 'Add, edit, or remove an embed field.']
        });
        card.addActionRowComponents(new ActionRowBuilder().addComponents(addButton, editButton, removeButton, backButton));
        return interaction.update({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }

    async showAddFieldModal(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        if (embed.fields.length >= 25) {
            return replyError(interaction, lang.embed?.error?.maxFieldsReached || 'This embed already has the maximum of 25 fields.');
        }
        const modal = new ModalBuilder()
            .setCustomId(`modal_addfield_${embed.embedId}`)
            .setTitle(m.addFieldModalTitle || 'Add Embed Field')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('field_name').setLabel(m.fieldNameLabel || 'Field Name').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('field_value').setLabel(m.fieldValueLabel || 'Field Value').setStyle(TextInputStyle.Paragraph).setMaxLength(1024).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('field_inline').setLabel(m.fieldInlineLabel || 'Display Inline? (yes/no)').setStyle(TextInputStyle.Short).setValue('no').setMaxLength(3).setRequired(false)
                )
            );
        return interaction.showModal(modal);
    }

    async showAdvancedModal(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const modal = new ModalBuilder()
            .setCustomId(`modal_advanced_${embed.embedId}`)
            .setTitle(m.advancedModalTitle || 'Advanced Embed Settings')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('category').setLabel('Category').setStyle(TextInputStyle.Short).setValue(embed.category || 'general').setMaxLength(100).setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('tags').setLabel('Tags (comma separated)').setStyle(TextInputStyle.Short).setValue((embed.tags || []).join(', ').slice(0, 1000)).setMaxLength(1000).setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('public').setLabel('Public? (yes/no)').setStyle(TextInputStyle.Short).setValue(embed.isPublic ? 'yes' : 'no').setMaxLength(3).setRequired(false)
                )
            );
        return interaction.showModal(modal);
    }

    async showEditFieldModal(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        if (embed.fields.length === 0) {
            return replyError(interaction, m.noFieldsToEdit);
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_editfield_${embed.embedId}`)
            .setPlaceholder(m.selectEditFieldPlaceholder)
            .addOptions(
                embed.fields.map((field, index) => ({
                    label: `Field ${index + 1}: ${field.name}`,
                    description: field.value.length > 50 ? field.value.substring(0, 50) + '...' : field.value,
                    value: index.toString()
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const card = buildCard({
            title: `${getEmoji('settings')} ${m.selectEditPrompt}`,
            tone: 'info'
        });
        card.addActionRowComponents(row);

        await interaction.update({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        });
    }

    async showRemoveFieldMenu(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        if (embed.fields.length === 0) {
            return replyError(interaction, m.noFieldsToRemove);
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_removefield_${embed.embedId}`)
            .setPlaceholder(m.selectRemoveFieldPlaceholder)
            .addOptions(
                embed.fields.map((field, index) => ({
                    label: `Field ${index + 1}: ${field.name}`,
                    description: field.value.length > 50 ? field.value.substring(0, 50) + '...' : field.value,
                    value: index.toString()
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const card = buildCard({
            title: `${getEmoji('alert')} ${m.selectRemovePrompt}`,
            tone: 'warning'
        });
        card.addActionRowComponents(row);

        await interaction.update({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        });
    }

    async handleModalSubmit(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        const [action, property, embedId] = interaction.customId.split('_');
        if (!embedId) return replyError(interaction, 'Invalid embed action.');
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        const err = lang.embed?.error || {};

        try {
            const embed = await Embed.findOne({ embedId, guildId: interaction.guild.id });
            if (!embed) {
                return replyError(interaction, err.notFound ? err.notFound.replace('{embedId}', embedId) : 'Embed not found.');
            }
            if (embed.createdBy !== interaction.user.id) {
                return replyError(interaction, err.notOwnerStrict || 'You cannot edit this embed.');
            }

            switch (property) {
                case 'title':
                    await this.handleTitleModal(interaction, embed);
                    break;
                case 'description':
                    await this.handleDescriptionModal(interaction, embed);
                    break;
                case 'color':
                    await this.handleColorModal(interaction, embed);
                    break;
                case 'author':
                    await this.handleAuthorModal(interaction, embed);
                    break;
                case 'footer':
                    await this.handleFooterModal(interaction, embed);
                    break;
                case 'images':
                    await this.handleImagesModal(interaction, embed);
                    break;
                case 'advanced':
                    await this.handleAdvancedModal(interaction, embed);
                    break;
                case 'addfield':
                    await this.handleAddFieldModal(interaction, embed);
                    break;
                case 'editfield':
                    await this.handleEditFieldModal(interaction, embed);
                    break;
                default:
                    await replyError(interaction, m.unknownModal);
            }
        } catch (error) {
            console.error('Error handling modal submit:', error);
            await replyError(interaction, m.errorProcessing);
        }
    }

    async handleTitleModal(interaction, embed) {
        const title = interaction.fields.getTextInputValue('title').trim();
        const url = interaction.fields.getTextInputValue('url').trim();

        const updates = {
            title: title || undefined,
            url: url || undefined,
            updatedBy: interaction.user.id,
            updatedAt: new Date()
        };

        await Embed.updateOne({ embedId: embed.embedId }, updates);
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${m.titleUpdated}`);
    }

    async handleDescriptionModal(interaction, embed) {
        const description = interaction.fields.getTextInputValue('description').trim();

        const updates = {
            description: description || undefined,
            updatedBy: interaction.user.id,
            updatedAt: new Date()
        };

        await Embed.updateOne({ embedId: embed.embedId }, updates);
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${m.descUpdated}`);
    }

    async handleColorModal(interaction, embed) {
        const color = interaction.fields.getTextInputValue('color').trim();
        const timestampInput = interaction.fields.getTextInputValue('timestamp').trim().toLowerCase();

        
        if (!/^#([0-9A-F]{6})$/i.test(color)) {
            const lang = loadLanguage(interaction.guild?.id);
            const m = lang.embed?.modals || {};
            return replyError(interaction, m.invalidHexColor || lang.embed?.error?.invalidHexColor || 'Enter a valid hex color such as #3498db.');
        }

        const timestamp = timestampInput === 'yes' || timestampInput === 'true';

        const updates = {
            color,
            timestamp,
            updatedBy: interaction.user.id,
            updatedAt: new Date()
        };

        await Embed.updateOne({ embedId: embed.embedId }, updates);
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${m.colorUpdated}`);
    }

    async handleAuthorModal(interaction, embed) {
        const authorName = interaction.fields.getTextInputValue('author_name').trim();
        const authorUrl = interaction.fields.getTextInputValue('author_url').trim();
        const authorIcon = interaction.fields.getTextInputValue('author_icon').trim();

        let author = null;
        if (authorName) {
            author = {
                name: authorName,
                url: authorUrl || undefined,
                iconURL: authorIcon || undefined
            };
        }

        const updates = {
            author,
            updatedBy: interaction.user.id,
            updatedAt: new Date()
        };

        await Embed.updateOne({ embedId: embed.embedId }, updates);
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${m.authorUpdated}`);
    }

    async handleFooterModal(interaction, embed) {
        const footerText = interaction.fields.getTextInputValue('footer_text').trim();
        const footerIcon = interaction.fields.getTextInputValue('footer_icon').trim();

        let footer = null;
        if (footerText) {
            footer = {
                text: footerText,
                iconURL: footerIcon || undefined
            };
        }

        const updates = {
            footer,
            updatedBy: interaction.user.id,
            updatedAt: new Date()
        };

        await Embed.updateOne({ embedId: embed.embedId }, updates);
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${m.footerUpdated}`);
    }

    async handleImagesModal(interaction, embed) {
        const thumbnail = interaction.fields.getTextInputValue('thumbnail').trim();
        const image = interaction.fields.getTextInputValue('image').trim();

        const updates = {
            thumbnail: thumbnail || undefined,
            image: image || undefined,
            updatedBy: interaction.user.id,
            updatedAt: new Date()
        };

        await Embed.updateOne({ embedId: embed.embedId }, updates);
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${m.imagesUpdated}`);
    }

    async handleAdvancedModal(interaction, embed) {
        const category = interaction.fields.getTextInputValue('category').trim();
        const tagsInput = interaction.fields.getTextInputValue('tags').trim();
        const publicInput = interaction.fields.getTextInputValue('public').trim().toLowerCase();

        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
        const isPublic = publicInput === 'yes' || publicInput === 'true';

        const updates = {
            category: category || 'general',
            tags,
            isPublic,
            updatedBy: interaction.user.id,
            updatedAt: new Date()
        };

        await Embed.updateOne({ embedId: embed.embedId }, updates);
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${m.advancedUpdated}`);
    }

    async handleAddFieldModal(interaction, embed) {
        const fieldName = interaction.fields.getTextInputValue('field_name').trim();
        const fieldValue = interaction.fields.getTextInputValue('field_value').trim();
        const fieldInlineInput = interaction.fields.getTextInputValue('field_inline').trim().toLowerCase();

        const fieldInline = fieldInlineInput === 'yes' || fieldInlineInput === 'true';

        if (embed.fields.length >= 25) {
            const lang = loadLanguage(interaction.guild?.id);
            return replyError(interaction, lang.embed?.error?.maxFieldsReached);
        }

        embed.fields.push({
            name: fieldName,
            value: fieldValue,
            inline: fieldInline
        });

        embed.updatedBy = interaction.user.id;
        embed.updatedAt = new Date();
        await embed.save();

        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${(m.fieldAddedSuccess).replace('{name}', fieldName)}`);
    }

    async handleEditFieldModal(interaction, embed) {
        
        const fieldName = interaction.fields.getTextInputValue('field_name').trim();
        const fieldValue = interaction.fields.getTextInputValue('field_value').trim();
        const fieldInlineInput = interaction.fields.getTextInputValue('field_inline').trim().toLowerCase();
        const fieldIndex = parseInt(interaction.fields.getTextInputValue('field_index'));

        const fieldInline = fieldInlineInput === 'yes' || fieldInlineInput === 'true';

        if (fieldIndex >= 0 && fieldIndex < embed.fields.length) {
            embed.fields[fieldIndex] = {
                name: fieldName,
                value: fieldValue,
                inline: fieldInline
            };

            embed.updatedBy = interaction.user.id;
            embed.updatedAt = new Date();
            await embed.save();

            const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${(m.fieldUpdatedSuccess).replace('{name}', fieldName)}`);
        } else {
            const lang = loadLanguage(interaction.guild?.id);
            const m = lang.embed?.modals || {};
            await replyError(interaction, m.invalidFieldIndex);
        }
    }

    async handleSelectMenu(interaction) {
        const [action, property, embedId] = interaction.customId.split('_');
        
        if (!embedId) return;

        const lookup = await runWithinAcknowledgementWindow(
            interaction,
            () => Embed.findOne({ embedId, guildId: interaction.guild.id }),
            'The embed is taking too long to load. Please try again shortly.'
        );
        if (!lookup.completed) return;
        const embed = lookup.value;
        if (!embed) return;

        const lang = loadLanguage(interaction.guild?.id);
        if (embed.createdBy !== interaction.user.id) {
            return replyError(interaction, lang.embed?.error?.notOwnerStrict);
        }

        const fieldIndex = Number(interaction.values[0]);

        if (property === 'editfield') {
            const field = embed.fields[fieldIndex];
            const m = lang.embed?.modals || {};
            if (!field) return replyError(interaction, m.invalidFieldIndex);
            const modal = new ModalBuilder()
                .setCustomId(`modal_editfield_${embed.embedId}_${fieldIndex}`)
                .setTitle(m.editFieldModalTitle);
            const nameInput = new TextInputBuilder()
                .setCustomId('field_name')
                .setLabel('Field Name (max 256 characters)')
                .setStyle(TextInputStyle.Short)
                .setValue(field.name)
                .setMaxLength(256)
                .setRequired(true);

            const valueInput = new TextInputBuilder()
                .setCustomId('field_value')
                .setLabel('Field Value (max 1024 characters)')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(field.value)
                .setMaxLength(1024)
                .setRequired(true);

            const inlineInput = new TextInputBuilder()
                .setCustomId('field_inline')
                .setLabel('Display Inline? (yes/no)')
                .setStyle(TextInputStyle.Short)
                .setValue(field.inline ? 'yes' : 'no')
                .setMaxLength(3)
                .setRequired(false);

            const indexInput = new TextInputBuilder()
                .setCustomId('field_index')
                .setLabel('Field Index (DO NOT CHANGE)')
                .setStyle(TextInputStyle.Short)
                .setValue(fieldIndex.toString())
                .setMaxLength(2)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(valueInput),
                new ActionRowBuilder().addComponents(inlineInput),
                new ActionRowBuilder().addComponents(indexInput)
            );

            await interaction.showModal(modal);

        } else if (property === 'removefield') {
            if (!Number.isInteger(fieldIndex) || fieldIndex < 0 || fieldIndex >= embed.fields.length) {
                return replyError(interaction, lang.embed?.error?.notFound || 'That field is no longer available.');
            }

            await interaction.deferUpdate();
            embed.fields.splice(fieldIndex, 1);
            embed.updatedBy = interaction.user.id;
            embed.updatedAt = new Date();
            await embed.save();

            const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await this.refreshBuilder(interaction, embed.embedId, `${getEmoji('tick')} ${(m.fieldRemovedSuccess)}`);
        }
    }

    async refreshBuilder(interaction, embedId, message = '') {
        const embed = await Embed.findOne({ embedId });
        if (!embed) return;
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};

        const previewCard = this.buildCardFromData(embed);

        const builderDesc = (m.builderDesc)
            .replace('{name}', embed.name)
            .replace('{embedId}', embedId);

        const builderSections = [
            message ? `${builderDesc}\n\n${message}` : builderDesc,
            `**${m.currentPropertiesLabel}:** ${this.getSetProperties(embed)}`
        ];

        const builderCard = buildCard({
            title: `${getEmoji('settings')} ${m.builderTitle}`,
            tone: 'setup',
            sections: builderSections
        });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`builder_title_${embedId}`)
                .setLabel(m.btnEditTitle)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(getButtonEmoji('document') || '📝'),
            new ButtonBuilder()
                .setCustomId(`builder_description_${embedId}`)
                .setLabel(m.btnEditDesc)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(getButtonEmoji('document') || '📝'),
            new ButtonBuilder()
                .setCustomId(`builder_color_${embedId}`)
                .setLabel(m.btnChangeColor)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(getButtonEmoji('sparkles') || '✨'),
            new ButtonBuilder()
                .setCustomId(`builder_author_${embedId}`)
                .setLabel(m.btnSetAuthor)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(getButtonEmoji('user') || '👤'),
            new ButtonBuilder()
                .setCustomId(`builder_footer_${embedId}`)
                .setLabel(m.btnSetFooter)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(getButtonEmoji('star') || '⭐')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`builder_fields_${embedId}`)
                .setLabel((m.btnManageFields).replace('{count}', String(embed.fields.length)))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(getButtonEmoji('list') || '📋'),
            new ButtonBuilder()
                .setCustomId(`builder_images_${embedId}`)
                .setLabel(m.btnSetImages)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(getButtonEmoji('sfolder1') || '🖼️'),
            new ButtonBuilder()
                .setCustomId(`builder_advanced_${embedId}`)
                .setLabel(m.btnAdvanced)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(getButtonEmoji('settings') || '⚙️'),
            new ButtonBuilder()
                .setCustomId(`builder_save_${embedId}`)
                .setLabel(m.btnSave)
                .setStyle(ButtonStyle.Success)
                .setEmoji(getButtonEmoji('tick') || '✅'),
            new ButtonBuilder()
                .setCustomId(`builder_cancel_${embedId}`)
                .setLabel(m.btnCancel)
                .setStyle(ButtonStyle.Danger)
                .setEmoji(getButtonEmoji('cross') || '❌')
        );

        builderCard.addActionRowComponents(row1);
        builderCard.addActionRowComponents(row2);

        const payload = {
            components: [previewCard, builderCard],
            flags: MessageFlags.IsComponentsV2
        };
        if (interaction.isModalSubmit?.()) {
            let originalUpdated = false;
            if (interaction.message?.edit) {
                originalUpdated = await interaction.message.edit(payload).then(() => true).catch(() => false);
            }
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply(originalUpdated ? { content: message || 'Embed updated.' } : payload);
            } else if (!interaction.replied) {
                await interaction.reply(originalUpdated ? { content: message || 'Embed updated.', flags: MessageFlags.Ephemeral } : payload);
            }
            return;
        }
        const updateMethod = interaction.replied || interaction.deferred ? 'editReply' : 'update';
        await interaction[updateMethod](payload);
    }

    async saveEmbed(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};

        if (!embed.title && !embed.description && embed.fields.length === 0) {
            return replyError(interaction, m.minContentRequired);
        }

        const successCard = buildCard({
            title: `${getEmoji('check')} ${m.savedTitle}`,
            tone: 'success',
            sections: [
                (m.savedDesc).replace('{name}', embed.name),
                `**${lang.embed?.labels?.embedId}:** \`${embed.embedId}\`\n**${m.currentPropertiesLabel}:** ${this.getSetProperties(embed)}\n\n*${m.savedNextSteps}*`
            ]
        });

        const updateMethod = interaction.deferred || interaction.replied ? 'editReply' : 'update';
        await interaction[updateMethod]({
            components: [this.buildCardFromData(embed), successCard],
            flags: MessageFlags.IsComponentsV2
        });
    }

    async cancelBuilder(interaction, embed) {
        const lang = loadLanguage(interaction.guild?.id);
        const m = lang.embed?.modals || {};
        await Embed.deleteOne({ embedId: embed.embedId, guildId: interaction.guild?.id });

        const cancelCard = buildCard({
            title: `${getEmoji('cross')} ${m.cancelled}`,
            tone: 'danger'
        });

        const updateMethod = interaction.deferred || interaction.replied ? 'editReply' : 'update';
        await interaction[updateMethod]({
            components: [cancelCard],
            flags: MessageFlags.IsComponentsV2
        });
    }

    getSetProperties(embed) {
        const properties = [];
        if (embed.title) properties.push('Title');
        if (embed.description) properties.push('Description');
        if (embed.url) properties.push('URL');
        if (embed.author?.name) properties.push('Author');
        if (embed.footer?.text) properties.push('Footer');
        if (embed.thumbnail) properties.push('Thumbnail');
        if (embed.image) properties.push('Image');
        if (embed.fields?.length > 0) properties.push(`Fields (${embed.fields.length})`);
        if (embed.timestamp) properties.push('Timestamp');
        if (embed.color !== '#3498db') properties.push('Color');
        return properties.length > 0 ? properties.join(', ') : 'None';
    }

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
    }

    buildEmbedFromData(embedData) {
        return this.buildCardFromData(embedData);
    }
}

module.exports = (client) => {
    return new EmbedBuilderModalHandler(client);
};
