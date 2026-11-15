


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const {
    enableVerificationSystem,
    disableVerificationSystem,
    deleteVerificationConfig,
    getVerificationConfig,
    setClient
} = require('../../dashboard/modules/gateVerification/gateVerification');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        verification: createInterpolatableProxy(rawLang.setups?.verification),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verification')
        .setDescription('Setup or manage the verification system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Enable the verification system.')
                .addRoleOption(opt =>
                    opt.setName('unverified_role')
                        .setDescription('Use an existing unverified role')
                        .setRequired(false))
                .addRoleOption(opt =>
                    opt.setName('verified_role')
                        .setDescription('Use an existing verified role')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Disable the verification system and remove the verification channel.')
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the current verification system configuration.')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete all verification configuration for this server.')),

    async execute(interaction) {
        setClient(interaction.client);
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.verification.warningUseSlash));
        }

        try {
            await deferReply(interaction, true);
            if (!await checkPermissions(interaction)) return;

            const { guild } = interaction;
            const guildId = guild.id;
            const sub = interaction.options.getSubcommand();

            if (sub === 'enable') {
                const unverifiedRole = interaction.options.getRole('unverified_role');
                const verifiedRole = interaction.options.getRole('verified_role');

                const updatedConfig = await enableVerificationSystem(guildId, {
                    unverifiedRoleId: unverifiedRole?.id,
                    verifiedRoleId: verifiedRole?.id
                });

                const card = cards.success(
                    lang.setups.verification.title,
                    lang.setups.verification.enabled({
                        channel: `<#${updatedConfig.verificationChannelId}>`,
                        verifiedRole: `<@&${updatedConfig.verifiedRoleId}>`,
                        unverifiedRole: `<@&${updatedConfig.unverifiedRoleId}>`
                    })
                );

                return sendV2(interaction, card);
            }

            if (sub === 'disable') {
                await disableVerificationSystem(guildId);
                return sendV2(interaction, cards.warning(lang.setups.verification.title, lang.setups.verification.disabled));
            }

            if (sub === 'view') {
                const config = await getVerificationConfig(guildId);
                if (!config || !config.verificationEnabled) {
                    return sendV2(interaction, cards.info(lang.setups.verification.title, lang.setups.verification.notConfigured));
                }

                const card = buildCard({ accent: ACCENT.info })
                    .addText(`**${lang.setups.verification.title}**`)
                    .addSeparator()
                    .addText(
                        `**${lang.setups.verification.statusLabel}:** ${lang.setups.verification.statusEnabled}\n` +
                        `**${lang.setups.verification.verifiedRoleLabel}:** <@&${config.verifiedRoleId}>\n` +
                        `**${lang.setups.verification.unverifiedRoleLabel}:** <@&${config.unverifiedRoleId}>\n` +
                        `**${lang.setups.verification.channelLabel}:** <#${config.verificationChannelId}>\n\n` +
                        `*${lang.setups.verification.footerTip}*`
                    );

                return sendV2(interaction, card);
            }

            if (sub === 'delete') {
                await deleteVerificationConfig(guildId);
                return sendV2(interaction, cards.success(lang.setups.verification.title, lang.setups.verification.deleted));
            }

        } catch (error) {
            console.error('[Setup-Verification] Error in setup-verification command:', error);
            const errorMsg = error.message || lang.setups.verification.processError;
            return sendV2(interaction, cards.error(lang.errorTitle, errorMsg));
        }
    }
};
