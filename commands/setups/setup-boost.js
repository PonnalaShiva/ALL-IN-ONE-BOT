


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BoostSettings = require('../../models/boost/BoostSettings');
const { invalidateBoostSettings } = require('../../utils/cacheHelpers');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        boost: createInterpolatableProxy(rawLang.setups?.boost),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-boost')
        .setDescription('Set or view boost notification settings for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

        .addSubcommand(sub =>
            sub.setName('setchannel')
                .setDescription('Enable/Disable boost notifications in a channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the boost notification channel')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable boost notifications')
                        .setRequired(true))
        )

        .addSubcommand(sub =>
            sub.setName('setmessage')
                .setDescription('Set custom boost messages')
                .addStringOption(option =>
                    option.setName('boost_message')
                        .setDescription('Message when someone boosts (use {username}, {servername}, {boostlevel}, {boostcount})')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('remove_message')
                        .setDescription('Message when someone removes boost')
                        .setRequired(false))
        )

        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current boost settings')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete boost notification setup for this server')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.boost.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'setchannel') {
            const channel = interaction.options.getChannel('channel');
            const status = interaction.options.getBoolean('status');

            await BoostSettings.findOneAndUpdate(
                { serverId: guildId },
                {
                    serverId: guildId,
                    channelId: channel.id,
                    status
                },
                { upsert: true, returnDocument: 'after' }
            );

            invalidateBoostSettings(guildId);

            const statusText = status ? lang.setups.boost.statusEnabled : lang.setups.boost.statusDisabled;
            const card = cards[status ? 'success' : 'warning'](
                lang.setups.boost.title,
                lang.setups.boost.channelUpdated({ status: statusText.toLowerCase(), channel: channel.toString() })
            );

            return sendV2(interaction, card);
        }

        if (subcommand === 'setmessage') {
            const boostMessage = interaction.options.getString('boost_message');
            const removeMessage = interaction.options.getString('remove_message');

            if (!boostMessage && !removeMessage) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.boost.provideAtLeastOne));
            }

            const updateData = {};
            if (boostMessage) updateData.boostMessage = boostMessage;
            if (removeMessage) updateData.removeMessage = removeMessage;

            await BoostSettings.findOneAndUpdate(
                { serverId: guildId },
                { $set: updateData },
                { upsert: true, returnDocument: 'after' }
            );

            invalidateBoostSettings(guildId);

            return sendV2(interaction, cards.success(lang.setups.boost.title, lang.setups.boost.messagesUpdated));
        }

        if (subcommand === 'view') {
            const settings = await BoostSettings.findOne({ serverId: guildId });

            if (!settings) {
                return sendV2(interaction, cards.info(lang.setups.boost.title, lang.setups.boost.noConfig));
            }

            const channel = interaction.guild.channels.cache.get(settings.channelId);
            const channelDisplay = channel ? channel.toString() : lang.setups.boost.notSet;
            const statusDisplay = settings.status ? lang.setups.boost.statusEnabled : lang.setups.boost.statusDisabled;

            const card = buildCard({ accent: settings.status ? ACCENT.success : ACCENT.warning })
                .addText(`**${lang.setups.boost.title}**`)
                .addSeparator()
                .addText(
                    `• **${lang.setups.boost.statusLabel}:** ${statusDisplay}\n` +
                    `• **${lang.setups.boost.channelLabel}:** ${channelDisplay}\n` +
                    `• **${lang.setups.boost.boostMessageLabel}:** ${settings.boostMessage || lang.setups.boost.defaultMessage}\n` +
                    `• **${lang.setups.boost.removeMessageLabel}:** ${settings.removeMessage || lang.setups.boost.defaultMessage}`
                );

            return sendV2(interaction, card);
        }

        if (subcommand === 'delete') {
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || 
                               interaction.member.id === interaction.guild.ownerId;

            if (!hasPermission) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.boost.deletePermissionError));
            }

            const settings = await BoostSettings.findOne({ serverId: guildId });
            if (!settings) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.boost.noConfig));
            }

            try {
                await BoostSettings.deleteOne({ serverId: guildId });
                invalidateBoostSettings(guildId);

                return sendV2(interaction, cards.success(lang.setups.boost.title, lang.setups.boost.deleted));
            } catch (error) {
                console.error('[Setup-Boost] Error deleting setup:', error);
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.boost.deleteError));
            }
        }
    }
};
