'use strict';


const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    StringSelectMenuBuilder, 
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize
} = require('discord.js');

const ReactionRole = require('../models/reactionroles/schema');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const defaultLang = require('../languages/default');
const lang = defaultLang;
const { 
    getReactionRoleByMessage, 
    invalidateReactionRole 
} = require('../utils/cacheHelpers');
const { registerInteractionHandler } = require('../utils/interactionRouter');
const { findManageableReactionRoleSetup } = require('../utils/reactionRoleAuthorization');
const { canManageRole, isSafeSelfAssignableRole } = require('../utils/roleAuthorization');

function getLang(guildId) {
    try {
        const loadLanguage = require('../events/loadLanguage');
        const lang = loadLanguage(guildId);
        return lang.reactionroles || defaultLang.reactionroles;
    } catch {
        return defaultLang.reactionroles;
    }
}

function sendInteractionNotice(interaction, content) {
    const payload = { content, flags: MessageFlags.Ephemeral };
    if (interaction.deferred && interaction.ephemeral) return interaction.editReply({ content });
    if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
    return interaction.reply(payload);
}

const roleToggleLocks = new Set();

function getRoleSelectionPolicy(setup, memberRoleCache, targetRoleId) {
    const settings = setup.settings || {};
    const hasTargetRole = memberRoleCache.has(targetRoleId);
    const currentSetupRoles = setup.roles.filter(configuredRole => memberRoleCache.has(configuredRole.roleId));
    const exclusiveSelection = settings.allowMultipleRoles === false || settings.removeOtherRoles === true;
    const rolesToRemove = !hasTargetRole && exclusiveSelection
        ? currentSetupRoles.filter(configuredRole => configuredRole.roleId !== targetRoleId)
        : [];
    const maxRoles = Number(settings.maxRolesPerUser);

    return {
        hasTargetRole,
        missingRequiredRole: Boolean(settings.requireRole && !memberRoleCache.has(settings.requireRole)),
        rolesToRemove,
        maxReached: !hasTargetRole && Number.isFinite(maxRoles) && maxRoles > 0 &&
            currentSetupRoles.length - rolesToRemove.length >= maxRoles,
        maxRoles
    };
}

class ReactionRoleHandler {
    constructor(client) {
        this.client = client;
        this.unregisterInteractionRoute = null;
        this.eventListeners = [];
        this.setupEventListeners();
    }

    bindClientEvent(eventName, handler, once = false) {
        const listener = handler.bind(this);
        this.eventListeners.push({ eventName, listener });
        (once ? this.client.once : this.client.on).call(this.client, eventName, listener);
    }

    setupEventListeners() {
        this.unregisterInteractionRoute = registerInteractionHandler(this.client, {
            name: 'reaction-role-controls',
            prefixes: ['rr_role_', 'rr_setup_', 'rr_menu_', 'rr_select_', 'rr_modal_'],
            types: ['button', 'stringSelect', 'modal'],
            handler: this.handleInteraction.bind(this)
        });
        this.bindClientEvent('messageDelete', this.handleMessageDelete);
        this.bindClientEvent('channelDelete', this.handleChannelDelete);
        this.bindClientEvent('guildDelete', this.handleGuildDelete);
        this.bindClientEvent('roleDelete', this.handleRoleDelete);
        this.bindClientEvent('clientReady', this.rebuildReactionRoles, true);
    }

    async handleInteraction(interaction) {
        try {
            if (interaction.isButton()) {
                if (interaction.customId.startsWith('rr_role_')) {
                    await this.handleRoleButton(interaction);
                } else if (interaction.customId.startsWith('rr_setup_')) {
                    await this.handleSetupButtons(interaction);
                }
            } else if (interaction.isStringSelectMenu()) {
                if (interaction.customId.startsWith('rr_menu_')) {
                    await this.handleRoleMenu(interaction);
                } else if (interaction.customId.startsWith('rr_select_')) {
                    await this.handleSetupSelects(interaction);
                }
            } else if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
            }
        } catch (error) {
            console.error('[ReactionRoleHandler] Error handling interaction:', error);
            const lang = getLang(interaction.guild?.id);
            await sendInteractionNotice(interaction, `${getEmoji('cross')} ${lang.errorGeneric}`).catch(() => {});
        }
    }

    async handleSetupButtons(interaction) {
        const [, , action, setupId] = interaction.customId.split('_');
        
        switch (action) {
            case 'title':
                await this.showTitleModal(interaction, setupId);
                break;
            case 'description':
                await this.showDescriptionModal(interaction, setupId);
                break;
            case 'type':
                await this.showTypeSelect(interaction, setupId);
                break;
            case 'addrole':
                await this.showAddRoleModal(interaction, setupId);
                break;
            case 'finish':
                await this.finishSetup(interaction, setupId);
                break;
            case 'cancel':
                await this.cancelSetup(interaction, setupId);
                break;
        }
    }

    async handleModalSubmit(interaction) {
        if (interaction.customId.startsWith('rr_modal_')) {
            const [, , type, setupId] = interaction.customId.split('_');
            
            switch (type) {
                case 'title':
                    await this.handleTitleModal(interaction, setupId);
                    break;
                case 'description':
                    await this.handleDescriptionModal(interaction, setupId);
                    break;
                case 'addrole':
                    await this.handleAddRoleModal(interaction, setupId);
                    break;
            }
        }
    }

    async showTitleModal(interaction, setupId) {
        const modal = new ModalBuilder()
            .setCustomId(`rr_modal_title_${setupId}`)
            .setTitle(lang.reactionroles.modals.titleColorTitle);

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel(lang.reactionroles.modals.titleLabel)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(true)
            .setPlaceholder(lang.reactionroles.modals.titlePlaceholder)
            .setValue('Choose your roles!');

        const colorInput = new TextInputBuilder()
            .setCustomId('color')
            .setLabel(lang.reactionroles.modals.colorLabel)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(7)
            .setRequired(false)
            .setPlaceholder(lang.reactionroles.modals.colorPlaceholder)
            .setValue('#6366f1');

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(colorInput)
        );

        await interaction.showModal(modal);
    }

    async handleTitleModal(interaction, setupId) {
        const lang = getLang(interaction.guild?.id);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const access = await findManageableReactionRoleSetup(interaction, setupId);
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
            return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
        }
        const { setup } = access;

        const title = interaction.fields.getTextInputValue('title');
        const color = interaction.fields.getTextInputValue('color') || '#6366f1';

        setup.title = title;
        setup.color = color;
        await setup.save();

        await this.updateSetupMessage(setup);
        await interaction.editReply({ content: `${getEmoji('tick')} ${lang.titleColorUpdated}` });
    }

    async showDescriptionModal(interaction, setupId) {
        const modal = new ModalBuilder()
            .setCustomId(`rr_modal_description_${setupId}`)
            .setTitle(lang.reactionroles.modals.descTitle);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel(lang.reactionroles.modals.descLabel)
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(4000)
            .setRequired(true)
            .setPlaceholder(lang.reactionroles.modals.descPlaceholder)
            .setValue('Select the roles you want by clicking the buttons below.');

        modal.addComponents(
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        await interaction.showModal(modal);
    }

    async handleDescriptionModal(interaction, setupId) {
        const lang = getLang(interaction.guild?.id);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const access = await findManageableReactionRoleSetup(interaction, setupId);
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
            return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
        }
        const { setup } = access;

        const description = interaction.fields.getTextInputValue('description');
        setup.description = description;
        await setup.save();

        await this.updateSetupMessage(setup);
        await interaction.editReply({ content: `${getEmoji('tick')} ${lang.descriptionUpdated}` });
    }

    async showTypeSelect(interaction, setupId) {
        const lang = getLang(interaction.guild?.id);
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`rr_select_type_${setupId}`)
            .setPlaceholder(lang.chooseInteractionType)
            .addOptions([
                {
                    label: lang.typeButtonsLabel,
                    value: 'buttons',
                    description: lang.typeButtonsDesc,
                    emoji: getButtonEmoji('settings')
                },
                {
                    label: lang.typeMenuLabel,
                    value: 'menu',
                    description: lang.typeMenuDesc,
                    emoji: getButtonEmoji('list')
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: `**${lang.chooseInteractionType}**`,
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }

    async handleSetupSelects(interaction) {
        const [, , type, setupId] = interaction.customId.split('_');
        const lang = getLang(interaction.guild?.id);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        if (type === 'type') {
            const selectedType = interaction.values[0];
            if (!['buttons', 'menu'].includes(selectedType)) {
                return interaction.editReply({ content: `${getEmoji('cross')} Invalid reaction-role type.` });
            }

            const access = await findManageableReactionRoleSetup(interaction, setupId);
            if (access.status !== 'ok') {
                const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
                return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
            }
            const { setup } = access;

            setup.type = selectedType;
            if (selectedType === 'menu') {
                setup.menuConfig = {
                    placeholder: 'Select your roles...',
                    minValues: 1,
                    maxValues: 1
                };
            }
            await setup.save();

            await this.updateSetupMessage(setup);
            await interaction.editReply({ content: `${getEmoji('tick')} ${lang.typeUpdated}` });
        }
    }

    async showAddRoleModal(interaction, setupId) {
        const modal = new ModalBuilder()
            .setCustomId(`rr_modal_addrole_${setupId}`)
            .setTitle(lang.reactionroles.modals.addRoleTitle);

        const roleInput = new TextInputBuilder()
            .setCustomId('role')
            .setLabel(lang.reactionroles.modals.roleInputLabel)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder(lang.reactionroles.modals.roleInputPlaceholder);

        const labelInput = new TextInputBuilder()
            .setCustomId('label')
            .setLabel(lang.reactionroles.modals.labelInputLabel)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(80)
            .setRequired(true)
            .setPlaceholder(lang.reactionroles.modals.labelInputPlaceholder);

        const emojiInput = new TextInputBuilder()
            .setCustomId('emoji')
            .setLabel(lang.reactionroles.modals.emojiInputLabel)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder(lang.reactionroles.modals.emojiInputPlaceholder);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel(lang.reactionroles.modals.descInputLabel)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(false)
            .setPlaceholder(lang.reactionroles.modals.descInputPlaceholder);

        const styleInput = new TextInputBuilder()
            .setCustomId('style')
            .setLabel(lang.reactionroles.modals.styleInputLabel)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder(lang.reactionroles.modals.styleInputPlaceholder)
            .setValue('Secondary');

        modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(labelInput),
            new ActionRowBuilder().addComponents(emojiInput),
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(styleInput)
        );

        await interaction.showModal(modal);
    }

    async handleAddRoleModal(interaction, setupId) {
        const lang = getLang(interaction.guild?.id);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const access = await findManageableReactionRoleSetup(interaction, setupId);
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
            return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
        }
        const { setup } = access;

        if (setup.roles.length >= 5) {
            return interaction.editReply({ content: `${getEmoji('warning')} Maximum of 5 roles allowed per setup.` });
        }

        const roleInput = interaction.fields.getTextInputValue('role');
        const label = interaction.fields.getTextInputValue('label');
        const description = interaction.fields.getTextInputValue('description') || null;
        const emojiInput = interaction.fields.getTextInputValue('emoji') || null;
        const style = interaction.fields.getTextInputValue('style') || 'Secondary';

        let roleId = roleInput.replace(/[<@&>]/g, '');
        const role = interaction.guild.roles.cache.get(roleId) ||
            interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase());

        if (!role) {
            return interaction.editReply({ content: `${getEmoji('cross')} Role not found. Please provide a valid role ID or mention.` });
        }

        if (setup.roles.some(r => r.roleId === role.id)) {
            return interaction.editReply({ content: `${getEmoji('cross')} This role is already in the setup.` });
        }

        const botMember = interaction.guild.members.me;
        if (!isSafeSelfAssignableRole(role) ||
            !botMember?.permissions?.has(PermissionFlagsBits.ManageRoles) ||
            role.position >= botMember.roles.highest.position ||
            !canManageRole(interaction.member, role, interaction.guild)) {
            return interaction.editReply({ content: `${getEmoji('cross')} This role cannot be safely offered for self-assignment.` });
        }

        let emoji = null;
        if (emojiInput) {
            const customEmojiMatch = emojiInput.match(/<(?:a)?:([a-zA-Z0-9_]+):(\d+)>/);
            if (customEmojiMatch) {
                emoji = {
                    name: customEmojiMatch[1],
                    id: customEmojiMatch[2],
                    animated: emojiInput.startsWith('<a:'),
                    unicode: false
                };
            } else if (emojiInput.match(/^\d+$/)) {
                const guildEmoji = interaction.guild.emojis.cache.get(emojiInput);
                if (guildEmoji) {
                    emoji = {
                        name: guildEmoji.name,
                        id: guildEmoji.id,
                        animated: guildEmoji.animated,
                        unicode: false
                    };
                }
            } else {
                emoji = {
                    name: emojiInput,
                    unicode: true
                };
            }
        }

        const validStyles = ['Primary', 'Secondary', 'Success', 'Danger'];
        const finalStyle = validStyles.includes(style) ? style : 'Secondary';

        setup.roles.push({
            roleId: role.id,
            roleName: role.name,
            label,
            description,
            emoji,
            style: finalStyle
        });

        setup.updatedBy = interaction.user.id;
        await setup.save();

        await this.updateSetupMessage(setup);
        await interaction.editReply({ content: `${getEmoji('tick')} Added role **${role.name}** to the setup! (${setup.roles.length}/5)` });
    }

    async updateSetupMessage(setup) {
        const channel = this.client.channels.cache.get(setup.channelId) ||
            await this.client.channels.fetch(setup.channelId).catch(() => null);
        if (!channel) return;
        
        const message = await channel.messages.fetch(setup.messageId).catch(() => null);
        if (!message) return;

        const lang = getLang(setup.guildId);

        let accentColor = 0x6366f1;
        if (setup.color) {
            const hex = setup.color.replace('#', '');
            const parsed = parseInt(hex, 16);
            if (!isNaN(parsed)) accentColor = parsed;
        }

        const setupContainer = new ContainerBuilder()
            .setAccentColor(accentColor)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${getEmoji('settings')} ${setup.title || lang.setupManagementTitle}\n` +
                    `> ${setup.description || lang.setupInProgress}`
                )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

        if (setup.roles.length > 0) {
            const rolesText = setup.roles.map((role) => {
                const emojiText = role.emoji 
                    ? (role.emoji.unicode ? role.emoji.name : `<:${role.emoji.name}:${role.emoji.id}>`)
                    : '•';
                return `${emojiText} **${role.label}** - <@&${role.roleId}>`;
            }).join('\n');
            
            setupContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${getEmoji('list')} **${lang.configuredRolesHeader}**\n${rolesText}`
                )
            );
            setupContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }

        setupContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `*${getEmoji('sparkles')} Setup ID: \`${setup.setupId}\` • ${setup.roles.length}/5 roles • Type: ${setup.type || 'Not set'}*`
            )
        );

        const setupButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rr_setup_title_${setup.setupId}`)
                .setLabel(lang.btnTitleColor)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(getButtonEmoji('edit')),
            new ButtonBuilder()
                .setCustomId(`rr_setup_description_${setup.setupId}`)
                .setLabel(lang.btnDescription)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(getButtonEmoji('document')),
            new ButtonBuilder()
                .setCustomId(`rr_setup_type_${setup.setupId}`)
                .setLabel(lang.btnType)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(getButtonEmoji('settings')),
            new ButtonBuilder()
                .setCustomId(`rr_setup_addrole_${setup.setupId}`)
                .setLabel(lang.btnAddRole)
                .setStyle(ButtonStyle.Success)
                .setEmoji(getButtonEmoji('tick'))
                .setDisabled(setup.roles.length >= 5)
        );

        const actionButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rr_setup_finish_${setup.setupId}`)
                .setLabel(lang.btnFinishSetup)
                .setStyle(ButtonStyle.Success)
                .setEmoji(getButtonEmoji('tick'))
                .setDisabled(!setup.title || !setup.description || !setup.type || setup.roles.length === 0),
            new ButtonBuilder()
                .setCustomId(`rr_setup_cancel_${setup.setupId}`)
                .setLabel(lang.btnCancel)
                .setStyle(ButtonStyle.Danger)
                .setEmoji(getButtonEmoji('cross'))
        );

        setupContainer.addActionRowComponents(setupButtons);
        setupContainer.addActionRowComponents(actionButtons);

        await message.edit({
            components: [setupContainer],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[ReactionRoleHandler] Error updating setup message:', err);
        });

        invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);
    }

    async finishSetup(interaction, setupId) {
        const lang = getLang(interaction.guild?.id);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const access = await findManageableReactionRoleSetup(interaction, setupId);
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
            return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
        }
        const { setup } = access;

        if (!setup.title || !setup.description || !setup.type || setup.roles.length === 0) {
            return interaction.editReply({ content: `${getEmoji('warning')} ${lang.setupIncomplete}` });
        }

        const channel = interaction.guild.channels.cache.get(setup.channelId) ||
            await interaction.guild.channels.fetch(setup.channelId).catch(() => null);
        if (!channel) return interaction.editReply({ content: `${getEmoji('cross')} ${lang.setupNotFound}` });

        const message = await channel.messages.fetch(setup.messageId).catch(() => null);
        if (!message) return interaction.editReply({ content: `${getEmoji('cross')} ${lang.setupNotFound}` });

        let accentColor = 0x6366f1;
        if (setup.color) {
            const hex = setup.color.replace('#', '');
            const parsed = parseInt(hex, 16);
            if (!isNaN(parsed)) accentColor = parsed;
        }

        const finalContainer = new ContainerBuilder()
            .setAccentColor(accentColor)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${getEmoji('sparkles')} ${setup.title}\n` +
                    (setup.description ? `> ${setup.description}\n\n` : '') +
                    `*${getEmoji('sparkles')} ${(lang.footerPrompt).replace('{type}', setup.type)}*`
                )
            );

        const rows = this.buildFinalComponents(setup);
        for (const row of rows) {
            finalContainer.addActionRowComponents(row);
        }

        await message.edit({
            components: [finalContainer],
            flags: MessageFlags.IsComponentsV2
        });

        invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);

        await interaction.editReply({ content: `${getEmoji('tick')} ${lang.setupCompleted}` });
    }

    async cancelSetup(interaction, setupId) {
        const lang = getLang(interaction.guild?.id);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const access = await findManageableReactionRoleSetup(interaction, setupId);
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
            return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
        }
        const { setup } = access;
        invalidateReactionRole(setup.guildId, setup.messageId, setupId);
        await ReactionRole.deleteOne({ _id: setup._id, guildId: interaction.guild.id });
        await interaction.message.delete().catch(() => {});
        
        await interaction.editReply({ content: `${getEmoji('tick')} ${lang.setupCancelled}` });
    }

    buildFinalComponents(setup) {
        if (setup.type === 'buttons') {
            const rows = [];
            let currentRow = new ActionRowBuilder();
            let buttonsInRow = 0;

            for (const roleConfig of setup.roles) {
                if (buttonsInRow >= 5) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                    buttonsInRow = 0;
                }

                const button = new ButtonBuilder()
                    .setCustomId(`rr_role_${roleConfig.roleId}`)
                    .setLabel(roleConfig.label)
                    .setStyle(ButtonStyle[roleConfig.style] || ButtonStyle.Secondary);

                if (roleConfig.emoji) {
                    if (roleConfig.emoji.unicode) {
                        button.setEmoji(roleConfig.emoji.name);
                    } else if (roleConfig.emoji.id) {
                        button.setEmoji(roleConfig.emoji.id);
                    }
                }

                currentRow.addComponents(button);
                buttonsInRow++;
            }

            if (buttonsInRow > 0) {
                rows.push(currentRow);
            }

            return rows;
        } else {
            const options = setup.roles.slice(0, 25).map(roleConfig => {
                const option = {
                    label: roleConfig.label,
                    value: roleConfig.roleId,
                    description: roleConfig.description || `Toggle the ${roleConfig.roleName} role`
                };

                if (roleConfig.emoji) {
                    if (roleConfig.emoji.unicode) {
                        option.emoji = roleConfig.emoji.name;
                    } else if (roleConfig.emoji.id) {
                        option.emoji = {
                            id: roleConfig.emoji.id,
                            name: roleConfig.emoji.name
                        };
                    }
                }

                return option;
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`rr_menu_${setup.setupId}`)
                .setPlaceholder(setup.menuConfig?.placeholder || lang.reactionroles.modals.menuPlaceholderDefault)
                .setMinValues(setup.menuConfig?.minValues || 1)
                .setMaxValues(setup.menuConfig?.maxValues || 1)
                .addOptions(options);

            return [new ActionRowBuilder().addComponents(selectMenu)];
        }
    }

    async handleRoleButton(interaction) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
        const lang = getLang(interaction.guild?.id);
        const roleId = interaction.customId.replace('rr_role_', '');
        const setup = await getReactionRoleByMessage(interaction.message.id) ||
            await ReactionRole.findOne({ messageId: interaction.message.id });
        
        if (!setup) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} ${lang.setupExpired}`);
        }

        const roleConfig = setup.roles.find(r => r.roleId === roleId);
        if (!roleConfig) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} ${lang.roleUnavailable}`);
        }

        await this.toggleRole(interaction, setup, roleConfig);
    }

    async handleRoleMenu(interaction) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
        const lang = getLang(interaction.guild?.id);
        const selectedRoleId = interaction.values[0];
        const setup = await getReactionRoleByMessage(interaction.message.id) ||
            await ReactionRole.findOne({ messageId: interaction.message.id });
        
        if (!setup) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} ${lang.setupExpired}`);
        }

        const roleConfig = setup.roles.find(r => r.roleId === selectedRoleId);
        if (!roleConfig) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} ${lang.roleUnavailable}`);
        }

        await this.toggleRole(interaction, setup, roleConfig);
    }

    async toggleRole(interaction, setup, roleConfig) {
        const lang = getLang(interaction.guild?.id);
        const { guild, member } = interaction;
        if (!guild || !member || setup?.guildId !== guild.id || !roleConfig) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} This reaction-role setup is no longer available in this server.`);
        }

        const role = guild.roles.cache.get(roleConfig.roleId);

        if (!role) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} ${lang.roleNotExist}`);
        }

        const botMember = guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} ${lang.noPermissionManageRoles}`);
        }

        if (!isSafeSelfAssignableRole(role)) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} This role is unavailable for self-assignment because it grants staff permissions.`);
        }

        if (role.position >= botMember.roles.highest.position || !role.editable ||
            member.id === guild.ownerId || member.roles.highest.position >= botMember.roles.highest.position) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} ${(lang.roleHierarchyError).replace('{name}', role.name)}`);
        }

        const policy = getRoleSelectionPolicy(setup, member.roles.cache, role.id);
        const hasRole = policy.hasTargetRole;
        if (policy.missingRequiredRole) {
            return sendInteractionNotice(interaction, `${getEmoji('cross')} You need the required role before choosing roles here.`);
        }
        if (policy.maxReached) {
            return sendInteractionNotice(interaction, `${getEmoji('warning')} You have reached the maximum of ${policy.maxRoles} role${policy.maxRoles === 1 ? '' : 's'} for this setup.`);
        }

        const lockKey = `${guild.id}:${member.id}:${setup.setupId}`;
        if (roleToggleLocks.has(lockKey)) {
            return sendInteractionNotice(interaction, `${getEmoji('time')} That role change is already being processed.`);
        }
        roleToggleLocks.add(lockKey);
        try {
            if (hasRole) {
                await member.roles.remove(role);
                
                await ReactionRole.updateOne(
                    { _id: setup._id },
                    { 
                        $inc: { 
                            'stats.totalInteractions': 1,
                            'stats.rolesRemoved': 1
                        }
                    }
                );

                await sendInteractionNotice(interaction, `${getEmoji('cross')} ${(lang.roleRemoved).replace('{name}', role.name)}`);
            } else {
                await member.roles.add(role);

                for (const configuredRole of policy.rolesToRemove) {
                    const previousRole = guild.roles.cache.get(configuredRole.roleId);
                    if (previousRole) await member.roles.remove(previousRole);
                }
                
                await ReactionRole.updateOne(
                    { _id: setup._id },
                    { 
                        $inc: { 
                            'stats.totalInteractions': 1,
                            'stats.rolesGiven': 1,
                            'stats.rolesRemoved': policy.rolesToRemove.length
                        }
                    }
                );

                const replacementNotice = policy.rolesToRemove.length ? ' Previous roles from this setup were removed.' : '';
                await sendInteractionNotice(interaction, `${getEmoji('tick')} ${(lang.roleAddedSuccess).replace('{name}', role.name)}${replacementNotice}`);
            }
        } catch (error) {
            console.error('[ReactionRoleHandler] Error toggling role:', error);
            await sendInteractionNotice(interaction, `${getEmoji('cross')} ${(lang.toggleError).replace('{name}', role.name)}`);
        } finally {
            roleToggleLocks.delete(lockKey);
        }
    }

    
    async handleMessageDelete(message) {
        try {
            await ReactionRole.deleteMany({ messageId: message.id });
            invalidateReactionRole(message.guild?.id, message.id);
        } catch (error) {
            console.error('[ReactionRoleHandler] Error cleaning up deleted message:', error);
        }
    }

    async handleChannelDelete(channel) {
        try {
            await ReactionRole.deleteMany({ channelId: channel.id });
            invalidateReactionRole(channel.guild?.id);
        } catch (error) {
            console.error('[ReactionRoleHandler] Error cleaning up deleted channel:', error);
        }
    }

    async handleGuildDelete(guild) {
        try {
            await ReactionRole.deleteMany({ guildId: guild.id });
            invalidateReactionRole(guild.id);
        } catch (error) {
            console.error('[ReactionRoleHandler] Error cleaning up deleted guild:', error);
        }
    }

    async handleRoleDelete(role) {
        try {
            const setups = await ReactionRole.find({
                guildId: role.guild.id,
                'roles.roleId': role.id
            });

            for (const setup of setups) {
                setup.roles = setup.roles.filter(r => r.roleId !== role.id);
                
                if (setup.roles.length === 0) {
                    const guild = this.client.guilds.cache.get(setup.guildId);
                    const channel = guild?.channels.cache.get(setup.channelId);
                    const message = await channel?.messages.fetch(setup.messageId).catch(() => null);
                    
                    if (message) {
                        await message.delete().catch(() => {});
                    }
                    
                    await ReactionRole.deleteOne({ _id: setup._id });
                    invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);
                } else {
                    await setup.save();
                    
                    const guild = this.client.guilds.cache.get(setup.guildId);
                    const channel = guild?.channels.cache.get(setup.channelId);
                    const message = await channel?.messages.fetch(setup.messageId).catch(() => null);
                    
                    if (message) {
                        let accentColor = 0x6366f1;
                        if (setup.color) {
                            const hex = setup.color.replace('#', '');
                            const parsed = parseInt(hex, 16);
                            if (!isNaN(parsed)) accentColor = parsed;
                        }
                        const finalContainer = new ContainerBuilder()
                            .setAccentColor(accentColor)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `# ${getEmoji('sparkles')} ${setup.title}\n` +
                                    (setup.description ? `> ${setup.description}\n\n` : '') +
                                    `*${getEmoji('sparkles')} React with the ${setup.type} below to get your roles!*`
                                )
                            );
                        const components = this.buildFinalComponents(setup);
                        for (const row of components) {
                            finalContainer.addActionRowComponents(row);
                        }
                        await message.edit({
                            components: [finalContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                    }
                    invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);
                }
            }
        } catch (error) {
            console.error('[ReactionRoleHandler] Error handling deleted role:', error);
        }
    }

    stop() {
        this.unregisterInteractionRoute?.();
        this.unregisterInteractionRoute = null;
        for (const { eventName, listener } of this.eventListeners) {
            this.client.off(eventName, listener);
        }
        this.eventListeners = [];
    }

    async rebuildReactionRoles() {
        try {
            const setups = await ReactionRole.find({});
            
            for (const setup of setups) {
                try {
                    const guild = this.client.guilds.cache.get(setup.guildId);
                    if (!guild) {
                        await ReactionRole.deleteOne({ _id: setup._id });
                        invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);
                        continue;
                    }

                    const channel = guild.channels.cache.get(setup.channelId);
                    if (!channel) {
                        await ReactionRole.deleteOne({ _id: setup._id });
                        invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);
                        continue;
                    }

                    const message = await channel.messages.fetch(setup.messageId).catch(() => null);
                    if (!message) {
                        await ReactionRole.deleteOne({ _id: setup._id });
                        invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);
                        continue;
                    }

                    let accentColor = 0x6366f1;
                    if (setup.color) {
                        const hex = setup.color.replace('#', '');
                        const parsed = parseInt(hex, 16);
                        if (!isNaN(parsed)) accentColor = parsed;
                    }

                    const finalContainer = new ContainerBuilder()
                        .setAccentColor(accentColor)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `# ${getEmoji('sparkles')} ${setup.title}\n` +
                                (setup.description ? `> ${setup.description}\n\n` : '') +
                                `*${getEmoji('sparkles')} React with the ${setup.type} below to get your roles!*`
                            )
                        );

                    const components = this.buildFinalComponents(setup);
                    for (const row of components) {
                        finalContainer.addActionRowComponents(row);
                    }

                    await message.edit({
                        components: [finalContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                    
                    invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);
                } catch (error) {
                    console.error(`[ReactionRoleHandler] Error rebuilding setup ${setup.setupId}:`, error);
                }
            }
        } catch (error) {
            console.error('[ReactionRoleHandler] Error rebuilding reaction roles:', error);
        }
    }
}

module.exports = ReactionRoleHandler;
module.exports.getRoleSelectionPolicy = getRoleSelectionPolicy;
