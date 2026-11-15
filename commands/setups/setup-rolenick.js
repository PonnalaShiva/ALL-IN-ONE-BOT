


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const RoleNickConfig = require('../../models/rolenick/RoleNickConfig');
const checkPermissions = require('../../utils/checkPermissions');
const { invalidateRoleNickConfig } = require('../../utils/cacheHelpers');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        rolenick: createInterpolatableProxy(rawLang.setups?.rolenick),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-rolenick')
        .setDescription('Configure nickname formats based on roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a role with a nickname format')
                .addRoleOption(opt => opt.setName('role').setDescription('Target role').setRequired(true))
                .addStringOption(opt => opt.setName('format').setDescription('Nickname format').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View all nickname role configurations')
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a specific role from nickname config')
                .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('clear')
                .setDescription('Delete all nickname configurations')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete the entire role nickname configuration for this server')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.rolenick.warningUseSlash));
        }

        try {
            await deferReply(interaction, true);
            if (!await checkPermissions(interaction)) return;

            if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.common?.adminRequired || 'Administrator permission is required.'));
            }

            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;
            const role = interaction.options.getRole('role');
            const format = interaction.options.getString('format') || '[{ROLE}] {USERNAME}';

            const config = await RoleNickConfig.findOne({ guildId });

            if (subcommand === 'add') {
                if (config) {
                    const existing = config.roles.find(r => r.roleId === role.id);
                    if (existing) {
                        existing.nicknameFormat = format;
                    } else {
                        config.roles.push({ roleId: role.id, nicknameFormat: format });
                    }
                    await config.save();
                } else {
                    await RoleNickConfig.create({
                        guildId,
                        roles: [{ roleId: role.id, nicknameFormat: format }]
                    });
                }

                invalidateRoleNickConfig(guildId);

                const card = cards.success(
                    lang.setups.rolenick.title,
                    lang.setups.rolenick.configured({ role: role.name, format })
                );
                return sendV2(interaction, card);
            }

            if (subcommand === 'view') {
                if (!config || config.roles.length === 0) {
                    return sendV2(interaction, cards.warning(lang.setups.rolenick.title, lang.setups.rolenick.notConfigured));
                }

                const display = config.roles.map(r => {
                    const guildRole = interaction.guild.roles.cache.get(r.roleId);
                    return `• ${guildRole?.name || 'Unknown Role'}: \`${r.nicknameFormat}\``;
                }).join('\n');

                const card = buildCard({ accent: ACCENT.info })
                    .addText(`**${lang.setups.rolenick.title}**`)
                    .addSeparator()
                    .addText(display);

                return sendV2(interaction, card);
            }

            if (subcommand === 'remove') {
                if (!config) {
                    return sendV2(interaction, cards.warning(lang.setups.rolenick.title, lang.setups.rolenick.notFound));
                }

                config.roles = config.roles.filter(r => r.roleId !== role.id);
                await config.save();

                invalidateRoleNickConfig(guildId);

                const card = cards.success(
                    lang.setups.rolenick.title,
                    lang.setups.rolenick.removed({ role: role.name })
                );
                return sendV2(interaction, card);
            }

            if (subcommand === 'clear') {
                if (!config) {
                    return sendV2(interaction, cards.warning(lang.setups.rolenick.title, lang.setups.rolenick.notConfigured));
                }

                config.roles = [];
                await config.save();

                invalidateRoleNickConfig(guildId);

                const card = cards.success(lang.setups.rolenick.title, lang.setups.rolenick.cleared);
                return sendV2(interaction, card);
            }

            if (subcommand === 'delete') {
                if (!config) {
                    return sendV2(interaction, cards.warning(lang.setups.rolenick.title, lang.setups.rolenick.notConfigured));
                }

                await RoleNickConfig.deleteOne({ guildId });
                invalidateRoleNickConfig(guildId);

                const card = cards.success(lang.setups.rolenick.title, lang.setups.rolenick.deleted);
                return sendV2(interaction, card);
            }
        } catch (error) {
            console.error('[Setup-RoleNick] Error:', error);
            const card = cards.error(lang.errorTitle, lang.unknownError);
            return sendV2(interaction, card);
        }
    }
};
