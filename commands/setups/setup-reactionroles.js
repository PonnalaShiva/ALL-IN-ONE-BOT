


'use strict';

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonStyle 
} = require('discord.js');
const ReactionRole = require('../../models/reactionroles/schema');
const { v4: uuidv4 } = require('uuid');
const checkPermissions = require('../../utils/checkPermissions');
const { invalidateReactionRole } = require('../../utils/cacheHelpers');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, btn, createInterpolatableProxy } = require('../../UI');
const { getButtonEmoji } = require('../../UI/emojis/emoji');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        reactionroles: createInterpolatableProxy(rawLang.setups?.reactionroles),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-reactionroles')
        .setDescription('Manage reaction role systems')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new reaction role setup')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send the reaction role message')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all reaction role setups in this server')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a reaction role setup')
                .addStringOption(option =>
                    option.setName('setup_id')
                        .setDescription('The setup ID to delete')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.reactionroles.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'create':
                await this.handleCreate(interaction);
                break;
            case 'list':
                await this.handleList(interaction);
                break;
            case 'delete':
                await this.handleDelete(interaction);
                break;
        }
    },

    async handleCreate(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel || !channel.isTextBased()) {
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.reactionroles.selectChannel));
        }

        
        const setupId = uuidv4();
        const setup = new ReactionRole({
            setupId,
            guildId: interaction.guild.id,
            channelId: channel.id,
            messageId: '', 
            title: '',
            description: '',
            color: '#6366f1',
            type: '',
            menuConfig: {
                placeholder: 'Select your roles...',
                minValues: 1,
                maxValues: 1
            },
            roles: [],
            createdBy: interaction.user.id,
            updatedBy: interaction.user.id
        });

        
        const setupButtons = new ActionRowBuilder().addComponents(
            btn(ButtonStyle.Primary, lang.setups.reactionroles.btnTitleColor, {
                id: `rr_setup_title_${setupId}`,
                emoji: getButtonEmoji('edit')
            }),
            btn(ButtonStyle.Primary, lang.setups.reactionroles.btnDescription, {
                id: `rr_setup_description_${setupId}`,
                emoji: getButtonEmoji('info')
            }),
            btn(ButtonStyle.Primary, lang.setups.reactionroles.btnType, {
                id: `rr_setup_type_${setupId}`,
                emoji: getButtonEmoji('settings')
            }),
            btn(ButtonStyle.Success, lang.setups.reactionroles.btnAddRole, {
                id: `rr_setup_addrole_${setupId}`,
                emoji: getButtonEmoji('add')
            })
        );

        const actionButtons = new ActionRowBuilder().addComponents(
            btn(ButtonStyle.Success, lang.setups.reactionroles.btnFinish, {
                id: `rr_setup_finish_${setupId}`,
                emoji: getButtonEmoji('tick'),
                disabled: true
            }),
            btn(ButtonStyle.Danger, lang.setups.reactionroles.btnCancel, {
                id: `rr_setup_cancel_${setupId}`,
                emoji: getButtonEmoji('cross')
            })
        );

        const card = buildCard({ accent: ACCENT.primary })
            .addText(`**${lang.setups.reactionroles.title}**`)
            .addSeparator()
            .addText(lang.setups.reactionroles.stepInstructions({ setupId }))
            .addRow(setupButtons)
            .addRow(actionButtons);

        const message = await sendV2(channel, card);

        setup.messageId = message.id;
        await setup.save();

        invalidateReactionRole(interaction.guild.id);

        const startedMsg = lang.setups.reactionroles.started({
            channel: channel.toString(),
            setupId
        });

        return sendV2(interaction, cards.success(lang.success, startedMsg));
    },

    async handleList(interaction) {
        const setups = await ReactionRole.find({ guildId: interaction.guild.id });

        if (setups.length === 0) {
            return sendV2(interaction, cards.warning(lang.warning, lang.setups.reactionroles.noSetups));
        }

        const setupsList = setups.map(setup => {
            const channel = interaction.guild.channels.cache.get(setup.channelId);
            const channelText = channel ? `<#${channel.id}>` : lang.setups.reactionroles.unknownChannel;

            return `**${setup.title || lang.setups.reactionroles.untitledSetup}**\n` +
                   `ID: \`${setup.setupId}\`\n` +
                   `Channel: ${channelText}\n` +
                   `Roles: ${setup.roles.length}/5\n` +
                   `Type: ${setup.type || lang.setups.reactionroles.notSet}\n` +
                   `Stats: ${setup.stats?.totalInteractions || 0} interactions`;
        }).join('\n\n');

        const card = buildCard({ accent: ACCENT.info })
            .addText(`**${lang.setups.reactionroles.listTitle}**`)
            .addSeparator()
            .addText(setupsList);

        return sendV2(interaction, card);
    },

    async handleDelete(interaction) {
        const setupId = interaction.options.getString('setup_id');
        const setup = await ReactionRole.findOne({
            setupId,
            guildId: interaction.guild.id
        });

        if (!setup) {
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.reactionroles.notFound));
        }

        
        const channel = interaction.guild.channels.cache.get(setup.channelId);
        if (channel) {
            const message = await channel.messages.fetch(setup.messageId).catch(() => null);
            if (message) {
                await message.delete().catch(() => {});
            }
        }

        
        await ReactionRole.deleteOne({ _id: setup._id });
        invalidateReactionRole(interaction.guild.id);

        const deletedMsg = lang.setups.reactionroles.deleted({
            title: setup.title || lang.setups.reactionroles.untitledSetup
        });

        return sendV2(interaction, cards.success(lang.success, deletedMsg));
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const setups = await ReactionRole.find({
            guildId: interaction.guild.id
        }).limit(25);

        const filtered = setups.filter(setup =>
            (setup.title && setup.title.toLowerCase().includes(focusedValue.toLowerCase())) ||
            setup.setupId.toLowerCase().includes(focusedValue.toLowerCase())
        );

        await interaction.respond(
            filtered.map(setup => ({
                name: `${setup.title || 'Untitled'} (${setup.roles.length} roles)`,
                value: setup.setupId
            }))
        );
    }
};
