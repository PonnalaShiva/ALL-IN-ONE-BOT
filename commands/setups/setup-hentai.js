


'use strict';

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const HentaiConfig = require('../../models/hentai/hentaiSchema');
const { getHentaiConfig, invalidateHentaiConfig } = require('../../utils/cacheHelpers');
const checkPermissions = require('../../utils/checkPermissions');
const { getButtonEmoji } = require('../../UI/emojis/emoji');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, deferUpdate, ACCENT, btn, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        hentai: createInterpolatableProxy(rawLang.setups?.hentai),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

function buildHentaiPanel(guild, configData) {
    const isEnabled = Boolean(configData && configData.status);

    const statusBadge = isEnabled
        ? lang.setups.hentai.statusEnabled
        : lang.setups.hentai.statusDisabled;

    const statusDesc = isEnabled
        ? lang.setups.hentai.descEnabled
        : lang.setups.hentai.descDisabled;

    const ownerMention = configData?.ownerId ? `<@${configData.ownerId}>` : `<@${guild.ownerId}>`;
    const lastUpdate = configData?.updatedAt
        ? `<t:${Math.floor(new Date(configData.updatedAt).getTime() / 1000)}:R>`
        : lang.setups.hentai.notUpdatedYet;

    
    const enableBtn = btn(
        ButtonStyle.Success,
        isEnabled ? lang.setups.hentai.btnEnabled : lang.setups.hentai.btnEnable,
        {
            id: 'setup-hentai_enable',
            emoji: getButtonEmoji('tick'),
            disabled: isEnabled
        }
    );

    const disableBtn = btn(
        ButtonStyle.Danger,
        !isEnabled ? lang.setups.hentai.btnDisabled : lang.setups.hentai.btnDisable,
        {
            id: 'setup-hentai_disable',
            emoji: getButtonEmoji('cross'),
            disabled: !isEnabled
        }
    );

    const refreshBtn = btn(
        ButtonStyle.Secondary,
        lang.setups.hentai.btnRefresh,
        {
            id: 'setup-hentai_refresh',
            emoji: getButtonEmoji('loop')
        }
    );

    const actionRow = new ActionRowBuilder().addComponents(enableBtn, disableBtn, refreshBtn);

    return buildCard({ accent: isEnabled ? ACCENT.success : ACCENT.danger })
        .addText(`**${lang.setups.hentai.title}**\n${lang.setups.hentai.description({ guild: guild.name })}`)
        .addSeparator()
        .addText(
            `**${lang.setups.hentai.systemStatusTitle}**\n` +
            `• **${lang.setups.hentai.statusLabel}:** ${statusBadge}\n` +
            `• **${lang.setups.hentai.descLabel}:** ${statusDesc}\n` +
            `• **${lang.setups.hentai.configuredByLabel}:** ${ownerMention}\n` +
            `• **${lang.setups.hentai.lastUpdatedLabel}:** ${lastUpdate}\n\n` +
            `*${lang.setups.hentai.nsfwNotice}*`
        )
        .addRow(actionRow);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-hentai')
        .setDescription('Configure or view hentai commands configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Enable or disable hentai commands')
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable (true) or disable (false) hentai commands')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('view')
                .setDescription('View current hentai commands configuration panel')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.hentai.warningUseSlash));
        }

        try {
            await deferReply(interaction, true);
            if (!await checkPermissions(interaction)) return;

            const { guild } = interaction;
            const serverId = guild.id;
            const subcommand = interaction.options.getSubcommand(false);

            if (subcommand === 'set') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
                    !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.hentai.permissionDenied));
                }

                const status = interaction.options.getBoolean('status');
                const config = await HentaiConfig.findOneAndUpdate(
                    { serverId },
                    { serverId, status, ownerId: guild.ownerId },
                    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
                );
                invalidateHentaiConfig(serverId);

                const panel = buildHentaiPanel(guild, config);
                return sendV2(interaction, panel);
            } else {
                const config = await getHentaiConfig(serverId);
                const panel = buildHentaiPanel(guild, config);
                return sendV2(interaction, panel);
            }
        } catch (error) {
            console.error('[Setup-Hentai] Error executing command:', error);
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.hentai.actionFailed || lang.error));
        }
    },

    async handleComponent(interaction) {
        const { customId, guild, member } = interaction;
        if (!guild || !customId?.startsWith('setup-hentai_')) return;

        await deferUpdate(interaction);
        if (!await checkPermissions(interaction)) return;

        if (!member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.followUp({
                components: [cards.error(lang.errorTitle, lang.setups.hentai.permissionDenied)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const action = customId.replace('setup-hentai_', '');
        const serverId = guild.id;

        try {
            if (action === 'enable' || action === 'disable') {
                const newStatus = action === 'enable';
                const config = await HentaiConfig.findOneAndUpdate(
                    { serverId },
                    { serverId, status: newStatus, ownerId: guild.ownerId },
                    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
                );
                invalidateHentaiConfig(serverId);

                const panel = buildHentaiPanel(guild, config);
                return sendV2(interaction, panel);
            } else if (action === 'refresh') {
                const config = await getHentaiConfig(serverId);
                const panel = buildHentaiPanel(guild, config);
                return sendV2(interaction, panel);
            }
        } catch (error) {
            console.error('[Setup-Hentai] Error handling component interaction:', error);
            if (interaction.deferred || interaction.replied) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.hentai.actionFailed || lang.error));
            } else {
                return replyEphemeral(interaction, cards.error(lang.errorTitle, lang.setups.hentai.actionFailed || lang.error));
            }
        }
    }
};
