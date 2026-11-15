


'use strict';

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
} = require('discord.js');
const BoycottBan = require('../../models/moderation/boycottBan');
const checkPermissions = require('../../utils/checkPermissions');
const { getEmoji } = require('../../UI/emojis/emoji');
const { 
    buildCard, 
    cards, 
    sendV2, 
    deferReply, 
    ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    moderation: {
        ...rawLang.moderation,
        boycottban: createInterpolatableProxy(rawLang.moderation?.boycottban),
        common: createInterpolatableProxy(rawLang.moderation?.common),
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boycottban')
        .setDescription('VC restriction system - prevent users from joining VCs with protected roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add-user')
                .setDescription('Restrict a user from joining VCs with a protected role')
                .addUserOption(opt => opt.setName('target').setDescription('User to restrict').setRequired(true))
                .addRoleOption(opt => opt.setName('restrict_near').setDescription('Protected role (e.g., Female role)').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('add-role')
                .setDescription('Restrict a role from joining VCs with a protected role')
                .addRoleOption(opt => opt.setName('target').setDescription('Role to restrict').setRequired(true))
                .addRoleOption(opt => opt.setName('restrict_near').setDescription('Protected role (e.g., Female role)').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a boycott ban restriction')
                .addStringOption(opt => opt.setName('target_id').setDescription('User or Role ID to unban').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all boycott ban restrictions')),

    async execute(interaction) {
        await deferReply(interaction);

        if (!await checkPermissions(interaction, 'admin')) return;

        if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
            return sendV2(interaction, cards.error(
                lang.moderation.common.accessDeniedTitle || 'Access Denied',
                lang.moderation.common.adminRequired || 'Administrator permission is required to use this command.'
            ));
        }

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        try {
            switch (subcommand) {
                case 'add-user': {
                    const target = interaction.options.getUser('target');
                    const restrictNear = interaction.options.getRole('restrict_near');

                    const existing = await BoycottBan.findOne({ guildId: guild.id, targetId: target.id });
                    if (existing) {
                        const card = cards.warning(
                            lang.moderation.boycottban.alreadyRestrictedTitle,
                            lang.moderation.boycottban.alreadyRestricted({ target: target.tag })
                        );
                        return await sendV2(interaction, card);
                    }

                    await BoycottBan.create({
                        guildId: guild.id,
                        targetId: target.id,
                        targetType: 'user',
                        restrictedNear: restrictNear.id
                    });

                    const card = cards.success(
                        lang.moderation.boycottban.userBannedTitle,
                        lang.moderation.boycottban.userBanned({ target: target.tag, role: restrictNear.name })
                    );
                    return await sendV2(interaction, card);
                }

                case 'add-role': {
                    const target = interaction.options.getRole('target');
                    const restrictNear = interaction.options.getRole('restrict_near');

                    const existing = await BoycottBan.findOne({ guildId: guild.id, targetId: target.id });
                    if (existing) {
                        const card = cards.warning(
                            lang.moderation.boycottban.alreadyRestrictedTitle,
                            lang.moderation.boycottban.alreadyRestricted({ target: target.name })
                        );
                        return await sendV2(interaction, card);
                    }

                    await BoycottBan.create({
                        guildId: guild.id,
                        targetId: target.id,
                        targetType: 'role',
                        restrictedNear: restrictNear.id
                    });

                    const card = cards.success(
                        lang.moderation.boycottban.roleBannedTitle,
                        lang.moderation.boycottban.roleBanned({ target: target.name, role: restrictNear.name })
                    );
                    return await sendV2(interaction, card);
                }

                case 'remove': {
                    const targetId = interaction.options.getString('target_id');

                    const deleted = await BoycottBan.findOneAndDelete({ guildId: guild.id, targetId });
                    if (!deleted) {
                        const card = cards.error(
                            lang.moderation.boycottban.notFoundTitle,
                            lang.moderation.boycottban.notFound
                        );
                        return await sendV2(interaction, card);
                    }

                    const card = cards.success(
                        lang.moderation.boycottban.removedTitle,
                        lang.moderation.boycottban.removed({ id: targetId })
                    );
                    return await sendV2(interaction, card);
                }

                case 'list': {
                    const restrictions = await BoycottBan.find({ guildId: guild.id });

                    if (restrictions.length === 0) {
                        const card = buildCard({
                            title: `${getEmoji('security')} ${lang.moderation.boycottban.listTitle}`,
                            description: lang.moderation.boycottban.noRestrictions,
                            accentColor: ACCENT.primary
                        });
                        return await sendV2(interaction, card);
                    }

                    const list = restrictions.map(r => {
                        let targetName;
                        if (r.targetType === 'user') {
                            const user = guild.members.cache.get(r.targetId);
                            targetName = user ? `User: ${user.user.tag}` : `User: ${r.targetId}`;
                        } else {
                            const role = guild.roles.cache.get(r.targetId);
                            targetName = role ? `Role: ${role.name}` : `Role: ${r.targetId}`;
                        }

                        const protectedRole = guild.roles.cache.get(r.restrictedNear);
                        const protectedName = protectedRole ? protectedRole.name : r.restrictedNear;

                        return lang.moderation.boycottban.listEntry({
                            target: targetName,
                            role: protectedName
                        });
                    }).join('\n');

                    const card = buildCard({
                        title: `${getEmoji('security')} ${lang.moderation.boycottban.listTitle}`,
                        description: list,
                        accentColor: ACCENT.primary
                    });
                    return await sendV2(interaction, card);
                }
            }
        } catch (error) {
            console.error('[BoycottBan] Error:', error);
            const card = cards.error(
                'Error',
                error.message || 'An error occurred while processing the boycott ban request.'
            );
            return await sendV2(interaction, card);
        }
    }
};
