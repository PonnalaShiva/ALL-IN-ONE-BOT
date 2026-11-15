


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const TruthOrDareConfig = require('../../models/truthordare/TruthOrDareConfig');
const { invalidateTruthOrDareConfig } = require('../../utils/cacheHelpers');
const checkPermissions = require('../../utils/checkPermissions');
const { sendTruthOrDareEmbed } = require('../../dashboard/modules/truthordare/activation');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        truthordare: createInterpolatableProxy(rawLang.setups?.truthordare),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-truthordare')
        .setDescription('Configure the Truth or Dare channel and view settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the Truth or Dare interaction channel')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel where the Truth or Dare embed will be sent')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the current Truth or Dare configuration')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete all Truth or Dare configuration for this server.')),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.truthordare.warningUseSlash));
        }

        try {
            await deferReply(interaction, true);
            if (!await checkPermissions(interaction)) return;

            const { options, guild } = interaction;
            const sub = options.getSubcommand();
            const serverId = guild.id;

            if (sub === 'set') {
                const targetChannel = options.getChannel('channel');

                await TruthOrDareConfig.findOneAndUpdate(
                    { serverId },
                    { serverId, channelId: targetChannel.id },
                    { upsert: true }
                );

                invalidateTruthOrDareConfig(serverId);
                await sendTruthOrDareEmbed(targetChannel);

                const card = cards.success(
                    lang.setups.truthordare.title,
                    lang.setups.truthordare.configured({ channel: targetChannel.toString() })
                );
                return sendV2(interaction, card);
            }

            if (sub === 'view') {
                const config = await TruthOrDareConfig.findOne({ serverId });
                if (!config) {
                    return sendV2(interaction, cards.info(lang.setups.truthordare.title, lang.setups.truthordare.noConfig));
                }

                const card = buildCard({ accent: ACCENT.primary })
                    .addText(`**${lang.setups.truthordare.title}**`)
                    .addSeparator()
                    .addText(`**${lang.setups.truthordare.channelLabel}:** <#${config.channelId}>`);

                return sendV2(interaction, card);
            }

            if (sub === 'delete') {
                const deleted = await TruthOrDareConfig.deleteOne({ serverId });
                invalidateTruthOrDareConfig(serverId);

                if (deleted.deletedCount > 0) {
                    return sendV2(interaction, cards.success(lang.setups.truthordare.title, lang.setups.truthordare.deleted));
                } else {
                    return sendV2(interaction, cards.warning(lang.setups.truthordare.title, lang.setups.truthordare.noConfigToDelete));
                }
            }
        } catch (error) {
            console.error('[Setup-TruthOrDare] Error in setup-truthordare command:', error);
            const card = cards.error(lang.errorTitle, lang.setups.truthordare.processError);
            return sendV2(interaction, card);
        }
    }
};
