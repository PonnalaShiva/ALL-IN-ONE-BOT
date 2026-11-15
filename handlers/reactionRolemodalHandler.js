'use strict';


const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const ReactionRole = require('../models/reactionroles/schema');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const defaultLang = require('../languages/default');
const lang = defaultLang;
const { invalidateReactionRole } = require('../utils/cacheHelpers');
const { registerInteractionHandler, runWithinAcknowledgementWindow } = require('../utils/interactionRouter');
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

class ModalHandler {
    constructor(client) {
        this.client = client;
        this.unregisterInteractionRoute = null;
        this.setupListeners();
    }

    setupListeners() {
        this.unregisterInteractionRoute = registerInteractionHandler(this.client, {
            name: 'reaction-role-setup-modals',
            prefixes: ['rr_add_role_modal_', 'rr_edit_info_modal_', 'rr_add_role_', 'rr_remove_role_', 'rr_edit_info_', 'rr_finish_setup_', 'rr_cancel_setup_'],
            types: ['button', 'stringSelect', 'modal'],
            handler: async (interaction) => {
            if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
            } else if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await this.handleSelectInteraction(interaction);
            }
            }
        });
    }

    async handleModalSubmit(interaction) {
        try {
            if (interaction.customId.startsWith('rr_add_role_modal_')) {
                await this.handleAddRoleModal(interaction);
            } else if (interaction.customId.startsWith('rr_edit_info_modal_')) {
                await this.handleEditInfoModal(interaction);
            }
        } catch (error) {
            console.error('[ReactionRoleModalHandler] Error handling modal submission:', error);
            const lang = getLang(interaction.guild?.id);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: `${getEmoji('cross')} ${lang.errorGeneric}`
                }).catch(() => {});
            } else {
                await interaction.reply({
                    content: `${getEmoji('cross')} ${lang.errorGeneric}`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }

    async handleButtonInteraction(interaction) {
        try {
            if (interaction.customId.startsWith('rr_add_role_')) {
                await this.showAddRoleModal(interaction);
            } else if (interaction.customId.startsWith('rr_remove_role_')) {
                await this.showRemoveRoleMenu(interaction);
            } else if (interaction.customId.startsWith('rr_edit_info_')) {
                await this.showEditInfoModal(interaction);
            } else if (interaction.customId.startsWith('rr_finish_setup_')) {
                await this.finishSetup(interaction);
            } else if (interaction.customId.startsWith('rr_cancel_setup_')) {
                await this.cancelSetup(interaction);
            }
        } catch (error) {
            console.error('[ReactionRoleModalHandler] Error handling button interaction:', error);
            const lang = getLang(interaction.guild?.id);
            if (interaction.deferred) {
                await interaction.editReply({ content: `${getEmoji('cross')} ${lang.errorGeneric}` }).catch(() => {});
            } else if (!interaction.replied) {
                await interaction.reply({
                    content: `${getEmoji('cross')} ${lang.errorGeneric}`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            } else {
                await interaction.followUp({
                    content: `${getEmoji('cross')} ${lang.errorGeneric}`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }

    async handleSelectInteraction(interaction) {
        if (!interaction.customId.startsWith('rr_remove_role_select_')) return;

        const lang = getLang(interaction.guild?.id);
        const setupId = interaction.customId.replace('rr_remove_role_select_', '');
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const access = await findManageableReactionRoleSetup(interaction, setupId);
            if (access.status !== 'ok') {
                const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
                return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
            }
            const { setup } = access;

            const roleId = interaction.values[0];
            const roleIndex = setup.roles.findIndex(role => role.roleId === roleId);
            if (roleIndex === -1) {
                return interaction.editReply({ content: `${getEmoji('cross')} That role is no longer in this setup. Refresh the setup and try again.` });
            }

            const [removedRole] = setup.roles.splice(roleIndex, 1);
            setup.updatedBy = interaction.user.id;
            await setup.save();
            await this.updateSetupMessage(setup);
            await interaction.editReply({ content: `${getEmoji('tick')} Removed **${removedRole.roleName}** from the setup.` });
        } catch (error) {
            console.error('[ReactionRoleModalHandler] Failed to remove a setup role:', error);
            const message = `${getEmoji('cross')} ${lang.errorGeneric}`;
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: message }).catch(() => {});
            } else {
                await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }

    async showAddRoleModal(interaction) {
        const lang = getLang(interaction.guild?.id);
        const setupId = interaction.customId.replace('rr_add_role_', '');
        const lookup = await runWithinAcknowledgementWindow(
            interaction,
            () => findManageableReactionRoleSetup(interaction, setupId),
            'Reaction role setup is taking too long to load. Please try again shortly.'
        );
        if (!lookup.completed) return;
        const access = lookup.value;
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
            return interaction.reply({ content: `${getEmoji('cross')} ${message}`, flags: MessageFlags.Ephemeral });
        }
        const { setup } = access;

        if (!setup) {
            return interaction.reply({
                content: `${getEmoji('cross')} ${lang.setupNotFound}`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (setup.roles.length >= 5) {
            return interaction.reply({
                content: `${getEmoji('warning')} Maximum of 5 roles allowed per setup.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`rr_add_role_modal_${setupId}`)
            .setTitle(lang.reactionroles.modals.addRoleTitle);

        const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
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

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel(lang.reactionroles.modals.descInputLabel)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(false)
            .setPlaceholder(lang.reactionroles.modals.descInputPlaceholder);

        const emojiInput = new TextInputBuilder()
            .setCustomId('emoji')
            .setLabel(lang.reactionroles.modals.emojiInputLabel)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder(lang.reactionroles.modals.emojiInputPlaceholder);

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
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(emojiInput),
            new ActionRowBuilder().addComponents(styleInput)
        );

        await interaction.showModal(modal);
    }

    async handleAddRoleModal(interaction) {
        const lang = getLang(interaction.guild?.id);
        const setupId = interaction.customId.replace('rr_add_role_modal_', '');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const access = await findManageableReactionRoleSetup(interaction, setupId);
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
            return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
        }
        const { setup } = access;

        const roleInput = interaction.fields.getTextInputValue('role_id');
        const label = interaction.fields.getTextInputValue('label');
        const description = interaction.fields.getTextInputValue('description') || null;
        const emojiInput = interaction.fields.getTextInputValue('emoji') || null;
        const style = interaction.fields.getTextInputValue('style') || 'Secondary';

        let roleId = roleInput.replace(/[<@&>]/g, '');
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {
            return interaction.editReply({
                content: `${getEmoji('cross')} Role not found. Please provide a valid role ID or mention.`,
            });
        }

        if (setup.roles.some(r => r.roleId === role.id)) {
            return interaction.editReply({
                content: `${getEmoji('cross')} This role is already in the setup.`,
            });
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
        await interaction.editReply({ content: `${getEmoji('tick')} Added role **${role.name}** to the setup!` });
    }

    async showRemoveRoleMenu(interaction) {
        const lang = getLang(interaction.guild?.id);
        const setupId = interaction.customId.replace('rr_remove_role_', '');
        const lookup = await runWithinAcknowledgementWindow(
            interaction,
            () => findManageableReactionRoleSetup(interaction, setupId),
            'Reaction role setup is taking too long to load. Please try again shortly.'
        );
        if (!lookup.completed) return;
        const access = lookup.value;
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
            return interaction.reply({ content: `${getEmoji('cross')} ${message}`, flags: MessageFlags.Ephemeral });
        }
        const { setup } = access;

        if (!setup) {
            return interaction.reply({
                content: `${getEmoji('cross')} ${lang.setupNotFound}`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (setup.roles.length === 0) {
            return interaction.reply({
                content: `${getEmoji('warning')} No roles to remove.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const options = setup.roles.slice(0, 25).map(role => ({
            label: role.label,
            value: role.roleId,
            description: `Remove ${role.roleName}`
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`rr_remove_role_select_${setupId}`)
            .setPlaceholder(lang.reactionroles.modals.removeRoleSelectPlaceholder)
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: lang.reactionroles.modals.removeRoleSelectPrompt,
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }

    async showEditInfoModal(interaction) {
        const lang = getLang(interaction.guild?.id);
        const setupId = interaction.customId.replace('rr_edit_info_', '');
        const lookup = await runWithinAcknowledgementWindow(
            interaction,
            () => findManageableReactionRoleSetup(interaction, setupId),
            'Reaction role setup is taking too long to load. Please try again shortly.'
        );
        if (!lookup.completed) return;
        const access = lookup.value;
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? 'Setup not found.' : 'You are not allowed to manage this reaction-role setup.';
            return interaction.reply({ content: `${getEmoji('cross')} ${message}`, flags: MessageFlags.Ephemeral });
        }
        const { setup } = access;

        if (!setup) {
            return interaction.reply({
                content: `${getEmoji('cross')} Setup not found.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`rr_edit_info_modal_${setupId}`)
            .setTitle(lang.reactionroles.modals.titleColorTitle);

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel(lang.reactionroles.modals.titleLabel)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(true)
            .setValue(setup.title || lang.chooseRolesTitle);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel(lang.reactionroles.modals.descLabel)
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(4000)
            .setRequired(true)
            .setValue(setup.description || lang.selectRolesBelow);

        const colorInput = new TextInputBuilder()
            .setCustomId('color')
            .setLabel(lang.reactionroles.modals.colorLabel)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(7)
            .setRequired(false)
            .setValue(setup.color || '#6366f1');

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(colorInput)
        );

        await interaction.showModal(modal);
    }

    async handleEditInfoModal(interaction) {
        const setupId = interaction.customId.replace('rr_edit_info_modal_', '');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const access = await findManageableReactionRoleSetup(interaction, setupId);

        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? 'Setup not found.' : 'You are not allowed to manage this reaction-role setup.';
            return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
        }
        const { setup } = access;

        setup.title = interaction.fields.getTextInputValue('title');
        setup.description = interaction.fields.getTextInputValue('description');
        setup.color = interaction.fields.getTextInputValue('color') || '#6366f1';
        setup.updatedBy = interaction.user.id;
        await setup.save();

        await this.updateSetupMessage(setup);
        await interaction.editReply({ content: `${getEmoji('tick')} Title and description updated!` });
    }

    async finishSetup(interaction) {
        const lang = getLang(interaction.guild?.id);
        const setupId = interaction.customId.replace('rr_finish_setup_', '');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const access = await findManageableReactionRoleSetup(interaction, setupId);

        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? lang.setupNotFound : 'You are not allowed to manage this reaction-role setup.';
            return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
        }
        const { setup } = access;

        if (setup.roles.length === 0) {
            return interaction.editReply({ content: `${getEmoji('warning')} Please add at least one role before finishing the setup.` });
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

        const components = this.buildFinalComponents(setup);
        for (const row of components) {
            finalContainer.addActionRowComponents(row);
        }

        await message.edit({
            components: [finalContainer],
            flags: MessageFlags.IsComponentsV2
        });

        invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);

        await interaction.editReply({ content: `${getEmoji('tick')} Reaction role setup completed! The message has been updated with active ${setup.type}.` });
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
            const rolesText = setup.roles.map(role => 
                `• **${role.label}** - <@&${role.roleId}>`
            ).join('\n');
            
            setupContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${getEmoji('list')} **Configured Roles**\n${rolesText}`
                )
            );
            setupContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }

        const managementRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rr_add_role_${setup.setupId}`)
                .setLabel(lang.reactionroles.btnAddRole)
                .setStyle(ButtonStyle.Success)
                .setEmoji(getButtonEmoji('tick'))
                .setDisabled(setup.roles.length >= 5),
            new ButtonBuilder()
                .setCustomId(`rr_remove_role_${setup.setupId}`)
                .setLabel(lang.reactionroles.modals.btnRemoveRole)
                .setStyle(ButtonStyle.Danger)
                .setEmoji(getButtonEmoji('cross'))
                .setDisabled(setup.roles.length === 0),
            new ButtonBuilder()
                .setCustomId(`rr_finish_setup_${setup.setupId}`)
                .setLabel(lang.reactionroles.btnFinishSetup)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(getButtonEmoji('tick'))
                .setDisabled(setup.roles.length === 0),
            new ButtonBuilder()
                .setCustomId(`rr_cancel_setup_${setup.setupId}`)
                .setLabel(lang.reactionroles.btnCancel)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(getButtonEmoji('cross'))
        );

        setupContainer.addActionRowComponents(managementRow);

        await message.edit({
            components: [setupContainer],
            flags: MessageFlags.IsComponentsV2
        });

        invalidateReactionRole(setup.guildId, setup.messageId, setup.setupId);
    }

    async cancelSetup(interaction) {
        const setupId = interaction.customId.replace('rr_cancel_setup_', '');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const access = await findManageableReactionRoleSetup(interaction, setupId);
        if (access.status !== 'ok') {
            const message = access.status === 'missing' ? 'Setup not found.' : 'You are not allowed to manage this reaction-role setup.';
            return interaction.editReply({ content: `${getEmoji('cross')} ${message}` });
        }
        const { setup } = access;
        invalidateReactionRole(setup.guildId, setup.messageId, setupId);
        await ReactionRole.deleteOne({ _id: setup._id, guildId: interaction.guild.id });
        await interaction.message.delete().catch(() => {});
        
        await interaction.editReply({ content: `${getEmoji('tick')} Setup cancelled and message deleted.` });
    }

    stop() {
        this.unregisterInteractionRoute?.();
        this.unregisterInteractionRoute = null;
    }
}

module.exports = ModalHandler;
