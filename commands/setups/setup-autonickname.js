


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { nicknameConfigs } = require('../../mongodb');
const { invalidateNicknameConfig } = require('../../logHandlers/autoNicknameHandler');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        autonickname: createInterpolatableProxy(rawLang.setups?.autonickname),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-autonickname')
        .setDescription('Configure or view the auto nickname changer.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Set the auto nickname changer configuration.')
                .addStringOption(option =>
                    option.setName('prefix')
                        .setDescription('The prefix to add to nicknames.')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable the auto nickname changer.')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub
                .setName('view')
                .setDescription('View the current auto nickname changer configuration.')
        )
        .addSubcommand(sub =>
            sub
                .setName('delete')
                .setDescription('Delete auto nickname changer setup for this server.')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.autonickname.warningUseSlash));
        }

        await deferReply(interaction, true);
        const { guild } = interaction;
        const guildId = guild.id;

        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                return sendV2(interaction, cards.error(lang.setups.autonickname.title, lang.setups.autonickname.permissionDenied));
            }

            const prefix = interaction.options.getString('prefix');
            const status = interaction.options.getBoolean('status') ?? true;

            if (status && !guild.members.me?.permissions?.has(PermissionFlagsBits.ManageNicknames)) {
                return sendV2(interaction, cards.error(lang.setups.autonickname.title, lang.setups.autonickname.permissionDenied));
            }

            await nicknameConfigs.updateOne(
                { guildId },
                { $set: { nicknamePrefix: prefix, status } },
                { upsert: true }
            );

            invalidateNicknameConfig(guildId);

            const statusText = status ? lang.setups.autonickname.enabled : lang.setups.autonickname.disabled;
            const card = cards[status ? 'success' : 'warning'](
                lang.setups.autonickname.title,
                lang.setups.autonickname.configured({ status: statusText, prefix })
            );
            return sendV2(interaction, card);
        }

        if (subcommand === 'view') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                return sendV2(interaction, cards.error(lang.setups.autonickname.title, lang.setups.autonickname.permissionDenied));
            }

            const configData = await nicknameConfigs.findOne({ guildId });
            if (!configData) {
                return sendV2(interaction, cards.info(lang.setups.autonickname.title, lang.setups.autonickname.noConfig));
            }

            const statusText = configData.status ? lang.setups.autonickname.enabled : lang.setups.autonickname.disabled;
            const card = buildCard({ accent: configData.status ? ACCENT.success : ACCENT.warning })
                .addText(`**${lang.setups.autonickname.title}**`)
                .addSeparator()
                .addText(`**${lang.setups.autonickname.statusLabel}:** ${statusText}\n**${lang.setups.autonickname.prefixLabel}:** \`${configData.nicknamePrefix}\``);

            return sendV2(interaction, card);
        }

        if (subcommand === 'delete') {
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames) ||
                                  interaction.member.id === guild.ownerId;

            if (!hasPermission) {
                return sendV2(interaction, cards.error(lang.setups.autonickname.title, lang.setups.autonickname.permissionDenied));
            }

            const configData = await nicknameConfigs.findOne({ guildId });
            if (!configData) {
                return sendV2(interaction, cards.warning(lang.setups.autonickname.title, lang.setups.autonickname.noConfig));
            }

            try {
                await nicknameConfigs.deleteOne({ guildId });
                invalidateNicknameConfig(guildId);

                return sendV2(interaction, cards.success(lang.setups.autonickname.title, lang.setups.autonickname.deleted));
            } catch (error) {
                console.error('[Setup-AutoNickname] Error deleting setup:', error);
                return sendV2(interaction, cards.error(lang.setups.autonickname.title, lang.setups.autonickname.deleteError));
            }
        }
    }
};
