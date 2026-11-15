


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const InviteSettings = require('../../models/inviteTracker/inviteSettings');
const { invalidateInviteSettings } = require('../../logHandlers/memberJoinHandler');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        invitetracker: createInterpolatableProxy(rawLang.setups?.invitetracker),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-invitetracker')
        .setDescription('Configure or view invite tracking logs.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the invite tracking log channel and status.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for invite logs')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable invite logging')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the current invite tracker configuration.')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete invite tracker setup for this server.')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.invitetracker.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;
        if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.common?.adminRequired || 'Administrator permission is required.'));
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'set') {
            const channel = interaction.options.getChannel('channel');
            const status = interaction.options.getBoolean('status');

            await InviteSettings.findOneAndUpdate(
                { guildId },
                {
                    inviteLogChannelId: channel.id,
                    status
                },
                { upsert: true }
            );

            invalidateInviteSettings(guildId);

            const statusText = status ? lang.setups.invitetracker.enabled : lang.setups.invitetracker.disabled;
            const card = buildCard({ accent: status ? ACCENT.success : ACCENT.warning })
                .addText(`**${lang.setups.invitetracker.title}**`)
                .addSeparator()
                .addText(lang.setups.invitetracker.configured({ status: statusText, channel }))
                .addSeparator()
                .addText(`**${lang.setups.invitetracker.logChannelLabel}:** ${channel}\n**${lang.setups.invitetracker.statusLabel}:** ${statusText}`);

            return sendV2(interaction, card);
        }

        if (subcommand === 'view') {
            const config = await InviteSettings.findOne({ guildId });

            if (!config) {
                const card = cards.info(lang.setups.invitetracker.title, lang.setups.invitetracker.noConfig);
                return sendV2(interaction, card);
            }

            const channel = interaction.guild.channels.cache.get(config.inviteLogChannelId);
            const statusText = config.status ? lang.setups.invitetracker.enabled : lang.setups.invitetracker.disabled;

            const card = buildCard({ accent: ACCENT.info })
                .addText(`**${lang.setups.invitetracker.title}**`)
                .addSeparator()
                .addText(`**${lang.setups.invitetracker.statusLabel}:** ${statusText}\n**${lang.setups.invitetracker.logChannelLabel}:** ${channel ? channel.toString() : lang.setups.invitetracker.notSet}`);

            return sendV2(interaction, card);
        }

        if (subcommand === 'delete') {
            const config = await InviteSettings.findOne({ guildId });
            if (!config) {
                const card = cards.warning(lang.setups.invitetracker.title, lang.setups.invitetracker.noConfig);
                return sendV2(interaction, card);
            }

            await InviteSettings.deleteOne({ guildId });
            invalidateInviteSettings(guildId);

            const card = cards.success(lang.setups.invitetracker.title, lang.setups.invitetracker.deleted);
            return sendV2(interaction, card);
        }
    }
};
