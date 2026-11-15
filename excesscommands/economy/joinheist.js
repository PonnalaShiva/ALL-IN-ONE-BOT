'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager, Heist } = require('../../models/economy/economy');
const { HEIST_TARGETS } = require('../../models/economy/constants/businessData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.joinheist);

const VALID_ROLES = ['hacker', 'driver', 'muscle', 'lookout', 'safecracker'];

async function attemptJoinHeist(guild, user, heistId, role) {
    if (!role || !VALID_ROLES.includes(role)) {
        return {
            error: 'invalid_role',
            card: cards.warning(
                lang.invalidRoleTitle,
                `${lang.invalidRoleDesc({ role: role || lang.noneRole.toString() })}\n\n${lang.validRolesDesc}`
            )
        };
    }

    let heist = await Heist.findOne({ heistId, guildId: guild.id });
    if (!heist) {
        return {
            error: 'not_found',
            card: cards.warning(
                lang.notFoundTitle,
                `${lang.notFoundDesc({ heistId })}\n\n${lang.findActiveDesc}`
            )
        };
    }

    const locTarget = resolveEntity('heist_targets', heist.targetType, { name: heist.targetName });

    if (heist.status !== 'recruiting') {
        return {
            error: 'not_recruiting',
            card: cards.warning(
                lang.notRecruitingTitle,
                `${lang.notRecruitingDesc({ target: locTarget.name, status: heist.status.toUpperCase() })}\n\n${lang.statusAlternative}`
            )
        };
    }

    let profile = await EconomyManager.getProfile(user.id, guild.id);

    
    if (profile.jailTime && new Date(profile.jailTime) > new Date()) {
        const hoursLeft = Math.ceil((new Date(profile.jailTime) - new Date()) / (1000 * 60 * 60));
        return {
            error: 'in_jail',
            card: cards.warning(
                lang.inJailTitle,
                lang.inJailDesc({ hours: hoursLeft })
            )
        };
    }

    
    if (heist.members.some(m => m.userId === user.id)) {
        const existingRole = heist.members.find(m => m.userId === user.id)?.role;
        return {
            error: 'already_member',
            card: cards.warning(
                lang.alreadyMemberTitle,
                lang.alreadyMemberDesc({ target: locTarget.name, role: existingRole })
            )
        };
    }

    
    if (heist.members.some(m => m.role === role)) {
        const existingMember = heist.members.find(m => m.role === role);
        return {
            error: 'role_taken',
            card: cards.warning(
                lang.roleTakenTitle,
                lang.roleTakenDesc({
                    role,
                    roleCap: role.toUpperCase(),
                    username: existingMember?.username || lang.anotherSpecialist.toString()
                })
            )
        };
    }

    const targetData = HEIST_TARGETS[heist.targetType];
    if (targetData && !targetData.requiredRoles.includes(role)) {
        return {
            error: 'role_not_required',
            card: cards.warning(
                lang.roleNotRequiredTitle,
                `${lang.roleNotRequiredDesc({ target: locTarget.name, role })}\n\n> **${lang.requiredRolesLabel({ roles: targetData.requiredRoles.join(', ') })}**`
            )
        };
    }

    if (heist.members.length >= heist.requiredMembers) {
        return {
            error: 'crew_full',
            card: cards.warning(
                lang.teamFullTitle,
                lang.teamFullDesc({ target: locTarget.name, current: heist.members.length, required: heist.requiredMembers })
            )
        };
    }

    const joinSettlement = await EconomyManager.mutateProfileAtomically({
        userId: user.id, guildId: guild.id, referenceId: `heist-join:${guild.id}:${heistId}:${user.id}`,
        mutate: async (current, { session }) => {
            const currentHeist = await Heist.findOne({ heistId, guildId: guild.id }).session(session);
            if (!currentHeist || currentHeist.status !== 'recruiting') return { success: false, error: 'not_recruiting' };
            if (current.jailTime && new Date(current.jailTime) > new Date()) return { success: false, error: 'in_jail' };
            if (currentHeist.members.some(m => m.userId === user.id)) return { success: false, error: 'already_member' };
            if (currentHeist.members.some(m => m.role === role)) return { success: false, error: 'role_taken' };
            if (currentHeist.members.length >= currentHeist.requiredMembers) return { success: false, error: 'crew_full' };
            currentHeist.members.push({ userId: user.id, username: user.username, role, confirmed: true, equipment: current.heistEquipment || [], joinedAt: new Date() });
            if (currentHeist.members.length === currentHeist.requiredMembers) currentHeist.status = 'ready';
            await currentHeist.save({ session });
            if (!Array.isArray(current.activeHeists)) current.activeHeists = [];
            if (!current.activeHeists.includes(heistId)) current.activeHeists.push(heistId);
            current.transactions.push({ type: 'shop', amount: 0, description: `Joined heist ${heistId} as ${role}`, category: 'heist', timestamp: new Date() });
            return { heist: currentHeist };
        }
    });
    if (!joinSettlement.success) {
        const messages = {
            not_recruiting: lang.notRecruitingTitle,
            in_jail: lang.inJailTitle,
            already_member: lang.alreadyMemberTitle,
            role_taken: lang.roleTakenTitle,
            crew_full: lang.teamFullTitle
        };
        return { error: joinSettlement.duplicate ? 'already_member' : joinSettlement.error, card: cards.warning(messages[joinSettlement.error] || lang.notRecruitingTitle, lang.notRecruitingDesc({ target: locTarget.name, status: heist.status.toUpperCase() })) };
    }
    heist = joinSettlement.heist;
    profile = joinSettlement.profile;

    const individualPayout = Math.floor(heist.potential_payout / heist.requiredMembers);
    const crewList = heist.members.map(m => `• **${m.username}** — \`${m.role}\``).join('\n');

    const stillNeeded = targetData ? targetData.requiredRoles.filter(r =>
        !heist.members.some(m => m.role === r)
    ) : [];

    const wasReady = false;
    const isNowReady = heist.status === 'ready';

    const joinCard = buildCard({
        title: lang.successTitle,
        accentColor: ACCENT.success
    })
        .addText(lang.successDesc({ target: locTarget.name, role: role.toUpperCase() }))
        .addSeparator()
        .addText(`### ${lang.assignmentTitle}`)
        .addText(lang.assignmentDesc({
            target: locTarget.name,
            role: role.toUpperCase(),
            current: heist.members.length,
            required: heist.requiredMembers,
            share: individualPayout.toLocaleString(),
            heistId
        }))
        .addSeparator()
        .addText(`### ${lang.crewRosterTitle} (${heist.members.length} / ${heist.requiredMembers})`)
        .addText(crewList);

    if (stillNeeded.length > 0) {
        joinCard.addSeparator().addText(lang.stillNeeded({ roles: stillNeeded.join(', ') }));
    }

    if (isNowReady) {
        joinCard.addSeparator()
            .addText(`### ${lang.crewReadyTitle}`)
            .addText(lang.crewReadyDesc({ heistId }));
    }

    const rows = [
        new ActionRowBuilder().addComponents(btn.secondary('joinheist_close', lang.btnClose))
    ];

    return {
        success: true,
        card: joinCard,
        rows,
        isNowReady,
        wasReady,
        targetName: locTarget.name,
        requiredMembers: heist.requiredMembers,
        heistId
    };
}

module.exports = {
    name: 'joinheist',
    aliases: ['heist-join', 'enlistheist'],
    description: lang.cmdDesc.toString(),
    usage: '!joinheist [heist_id] [role]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;

            
            if (args[0] && args[1]) {
                const heistId = args[0];
                const role = args[1].toLowerCase();
                const result = await attemptJoinHeist(message.guild, message.author, heistId, role);

                if (result.isNowReady && !result.wasReady) {
                    setTimeout(async () => {
                        try {
                            const readyCard = buildCard({
                                title: lang.readyBroadcastTitle,
                                accentColor: ACCENT.danger
                            })
                                .addText(`> **${lang.readyBroadcastSubtitle({ target: result.targetName })}**\n> ${lang.readyBroadcastDesc({ heistId: result.heistId })}`);
                            await sendV2(message.channel, readyCard);
                        } catch (_) {}
                    }, 1000);
                }

                if (result.rows) {
                    return sendWithCloseCollector(message, { card: result.card, rows: result.rows }, message.author.id);
                }
                return sendV2(message, result.card);
            }

            
            const activeHeists = await Heist.find({
                guildId: message.guild.id,
                status: 'recruiting'
            }).limit(5);

            if (activeHeists.length === 0) {
                const guideCard = buildCard({
                    title: lang.title,
                    accentColor: ACCENT.warning
                })
                    .addText(`> **${lang.missingInfoDesc}**`)
                    .addSeparator()
                    .addText(`### ${lang.availableRolesTitle}`)
                    .addText(lang.availableRolesDesc)
                    .addSeparator()
                    .addText(`> ${lang.findActiveDesc}`);

                const guideRows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('joinheist_plan', lang.btnPlanHeist),
                        btn.secondary('joinheist_close', lang.btnClose)
                    )
                ];

                const sentMsg = await sendV2(message, { card: guideCard, rows: guideRows });
                if (!sentMsg) return;

                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'joinheist_close') {
                            collector.stop('closed');
                            return closeAndAutoDelete(sentMsg, cards.info(lang.title, lang.missingInfoDesc));
                        }

                        if (interaction.customId === 'joinheist_plan') {
                            collector.stop('plan');
                            const planCmd = require('./planheist');
                            return planCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error in direct joinheist collector:', err);
                    }
                });
                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.title, lang.missingInfoDesc), rows: [] }).catch(() => {});
                    }
                });
                return;
            }

            
            const heistOptions = activeHeists.slice(0, 25).map(h => {
                const locTarget = resolveEntity('heist_targets', h.targetType, { name: h.targetName });
                return {
                    label: `${locTarget.name} (${h.heistId.substring(0, 12)}...)`,
                    value: h.heistId,
                    description: lang.heistOptionDesc({
                        current: h.members.length,
                        required: h.requiredMembers,
                        status: h.status.toUpperCase()
                    }).toString()
                };
            });

            const card = buildCard({
                title: lang.title,
                accentColor: ACCENT.primary
            })
                .addText(`> **${lang.availableRolesTitle}**\n${lang.availableRolesDesc}`)
                .addSeparator()
                .addText(`> ${lang.findActiveDesc}`);

            const rows = [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('joinheist_select_heist')
                        .setPlaceholder(lang.title.toString())
                        .addOptions(heistOptions)
                ),
                new ActionRowBuilder().addComponents(
                    btn.primary('joinheist_plan', lang.btnPlanHeist),
                    btn.secondary('joinheist_close', lang.btnClose)
                )
            ];

            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'joinheist_close') {
                        collector.stop('closed');
                        return closeAndAutoDelete(sentMessage, cards.info(lang.title, lang.missingInfoDesc));
                    }

                    if (interaction.customId === 'joinheist_plan') {
                        collector.stop('plan');
                        const planCmd = require('./planheist');
                        return planCmd.execute(message, []);
                    }

                    if (interaction.customId === 'joinheist_select_heist') {
                        const chosenHeistId = interaction.values[0];
                        const chosenHeist = await Heist.findOne({ heistId: chosenHeistId, guildId: message.guild.id });
                        if (!chosenHeist) {
                            return editV2(sentMessage, {
                                card: cards.warning(lang.notFoundTitle, lang.notFoundDesc({ heistId: chosenHeistId })),
                                rows: [new ActionRowBuilder().addComponents(btn.secondary('joinheist_close', lang.btnClose))]
                            });
                        }

                        const targetData = HEIST_TARGETS[chosenHeist.targetType];
                        const neededRoles = targetData ? targetData.requiredRoles.filter(r =>
                            !chosenHeist.members.some(m => m.role === r)
                        ) : VALID_ROLES;

                        const roleOptions = neededRoles.map(r => ({
                            label: r.toUpperCase(),
                            value: `${chosenHeistId}:${r}`,
                            description: lang.enlistAsRole({ role: r }).toString()
                        }));

                        if (roleOptions.length === 0) {
                            return editV2(sentMessage, {
                                card: cards.warning(lang.teamFullTitle, lang.teamFullDesc({ target: chosenHeist.targetName, current: chosenHeist.members.length, required: chosenHeist.requiredMembers })),
                                rows: [new ActionRowBuilder().addComponents(btn.secondary('joinheist_close', lang.btnClose))]
                            });
                        }

                        const roleRows = [
                            new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId('joinheist_select_role')
                                    .setPlaceholder(lang.availableRolesTitle.toString())
                                    .addOptions(roleOptions)
                            ),
                            new ActionRowBuilder().addComponents(btn.secondary('joinheist_close', lang.btnClose))
                        ];

                        return editV2(sentMessage, { card, rows: roleRows });
                    }

                    if (interaction.customId === 'joinheist_select_role') {
                        const [hId, rName] = interaction.values[0].split(':');
                        const result = await attemptJoinHeist(message.guild, message.author, hId, rName);
                        const receiptRows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('joinheist_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows: receiptRows });
                    }
                } catch (err) {
                    console.error('Error in joinheist collector:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.title, lang.missingInfoDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in joinheist command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
