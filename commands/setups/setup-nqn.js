


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');
const NqnConfig = require('../../models/nqn/nqnSchema');
const ServerConfig = require('../../models/serverConfig/schema');
const checkPermissions = require('../../utils/checkPermissions');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        nqn: createInterpolatableProxy(rawLang.setups?.nqn),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-nqn')
        .setDescription('Configure or view NQN status for a server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Enable or disable NQN')
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable NQN')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('view')
                .setDescription('View the current NQN status')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.nqn.warningUseSlash));
        }

        await deferReply(interaction, true);
        const guild = interaction.guild;
        const serverId = guild.id;

        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return sendV2(interaction, cards.error(lang.setups.nqn.title, lang.setups.nqn.permissionDenied));
            }

            const status = interaction.options.getBoolean('status');
            const serverOwnerId = guild.ownerId;

            try {
                await NqnConfig.findOneAndUpdate(
                    { serverId },
                    { 
                        serverId, 
                        status, 
                        ownerId: serverOwnerId 
                    },
                    { 
                        upsert: true, 
                        returnDocument: 'after',
                        runValidators: true 
                    }
                );

                
                interaction.client.emit('nqnConfigUpdated', serverId);

                const statusText = status ? lang.setups.nqn.statusEnabled : lang.setups.nqn.statusDisabled;
                const card = cards[status ? 'success' : 'warning'](
                    lang.setups.nqn.title,
                    lang.setups.nqn.configured({ status: statusText })
                );
                return sendV2(interaction, card);
            } catch (error) {
                console.error('[Setup-NQN] Error updating NQN config:', error);
                return sendV2(interaction, cards.error(lang.setups.nqn.title, lang.setups.nqn.updateError));
            }
        }

        if (subcommand === 'view') {
            try {
                const configManagerData = await ServerConfig.findOne({ serverId });
                const botManagers = configManagerData ? configManagerData.botManagers || [] : [];

                if (!botManagers.includes(interaction.user.id) && interaction.user.id !== guild.ownerId) {
                    return sendV2(interaction, cards.error(lang.setups.nqn.title, lang.setups.nqn.managersOnly));
                }

                const configData = await NqnConfig.findOne({ serverId });

                if (!configData) {
                    return sendV2(interaction, cards.info(lang.setups.nqn.title, lang.setups.nqn.noConfig));
                }

                const statusText = configData.status ? lang.setups.nqn.statusEnabled : lang.setups.nqn.statusDisabled;
                const updatedTime = configData.updatedAt
                    ? `<t:${Math.floor(configData.updatedAt.getTime() / 1000)}:R>`
                    : 'Unknown';

                const card = buildCard({ accent: configData.status ? ACCENT.success : ACCENT.warning })
                    .addText(`**${lang.setups.nqn.title}**`)
                    .addSeparator()
                    .addText(`**${lang.setups.nqn.statusLabel}:** ${statusText}\n**${lang.setups.nqn.ownerLabel}:** \`${configData.ownerId}\`\n**${lang.setups.nqn.updatedLabel}:** ${updatedTime}`);

                return sendV2(interaction, card);
            } catch (error) {
                console.error('[Setup-NQN] Error retrieving NQN config:', error);
                return sendV2(interaction, cards.error(lang.setups.nqn.title, lang.setups.nqn.fetchError));
            }
        }
    }
};