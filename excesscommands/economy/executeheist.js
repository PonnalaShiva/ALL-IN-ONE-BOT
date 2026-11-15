'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager, Heist } = require('../../models/economy/economy');
const { HEIST_TARGETS } = require('../../models/economy/constants/businessData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.executeheist);

const ROLE_MULTIPLIERS = {
    mastermind: 1.5,
    hacker: 1.3,
    safecracker: 1.2,
    driver: 1.1,
    lookout: 1.0,
    muscle: 1.0
};

async function runHeistExecution(message, heistId) {
    const heist = await Heist.findOne({ heistId, guildId: message.guild.id });

    if (!heist) {
        return sendV2(message, cards.warning(
            lang.notFoundTitle,
            lang.notFoundDesc({ heistId })
        ));
    }

    const locTarget = resolveEntity('heist_targets', heist.targetType, { name: heist.targetName });

    if (heist.plannerUserId !== message.author.id) {
        const planner = message.guild.members.cache.get(heist.plannerUserId);
        const plannerName = planner ? planner.displayName : lang.unknownPlanner.toString();
        const userRole = heist.members.find(m => m.userId === message.author.id)?.role || lang.unknownRole.toString();

        return sendV2(message, cards.warning(
            lang.unauthorizedTitle,
            lang.unauthorizedDesc({ planner: plannerName, role: userRole })
        ));
    }

    if (heist.status !== 'ready') {
        const targetData = HEIST_TARGETS[heist.targetType] || {};
        const currentMemberRoles = heist.members.map(m => m.role);
        const missingRoles = (targetData.requiredRoles || []).filter(r => !currentMemberRoles.includes(r));

        const extraDesc = missingRoles.length > 0
            ? `\n> ${lang.missingRolesDesc({ roles: missingRoles.join(', ') })}`
            : `\n> ${lang.readyTeamDesc()}`;

        return sendV2(message, cards.warning(
            lang.notReadyTitle,
            lang.notReadyDesc({
                target: locTarget.name,
                status: heist.status.toUpperCase(),
                current: heist.members.length,
                required: heist.requiredMembers
            }) + extraDesc
        ));
    }

    const targetData = HEIST_TARGETS[heist.targetType] || {};

    
    const phase1Card = buildCard({
        title: lang.phase1Title,
        accentColor: ACCENT.warning
    }).addText(`> **${locTarget.name.toUpperCase()} OPERATION**\n> ${lang.phase1Desc({ target: locTarget.name })}`);

    const executionMsg = await sendV2(message, phase1Card);
    if (!executionMsg) return;

    const claimedHeist = await EconomyManager.claimHeist(heistId, message.guild.id);
    if (!claimedHeist) {
        return editV2(executionMsg, cards.warning(
            lang.notReadyTitle,
            lang.notReadyDesc({
                target: locTarget.name,
                status: lang.inProgressStatus?.toString?.() || 'IN PROGRESS',
                current: heist.members.length,
                required: heist.requiredMembers
            })
        ));
    }

    
    setTimeout(async () => {
        try {
            const phase2Card = buildCard({
                title: lang.phase2Title,
                accentColor: ACCENT.warning
            }).addText(`> **${locTarget.name.toUpperCase()} OPERATION**\n> ${lang.phase2Desc()}`);

            await editV2(executionMsg, phase2Card);
        } catch (e) {
            console.error('Phase 2 error in executeheist:', e);
        }
    }, 3000);

    
    setTimeout(async () => {
        try {
            const phase3Card = buildCard({
                title: lang.phase3Title,
                accentColor: ACCENT.warning
            }).addText(`> **${locTarget.name.toUpperCase()} OPERATION**\n> ${lang.phase3Desc()}`);

            await editV2(executionMsg, phase3Card);
        } catch (e) {
            console.error('Phase 3 error in executeheist:', e);
        }
    }, 6000);

    
    setTimeout(async () => {
        try {
            const txOptions = {
                txSuccess: lang.txHeistSuccess({ name: locTarget.name }).toString(),
                txFailure: lang.txHeistFailure({ name: locTarget.name }).toString()
            };
            const result = await EconomyManager.executeHeist(heistId, txOptions);
            if (result.alreadyResolved) {
                return editV2(executionMsg, cards.warning(lang.notReadyTitle, lang.notReadyDesc({
                    target: locTarget.name,
                    status: lang.inProgressStatus?.toString?.() || 'RESOLVED',
                    current: heist.members.length,
                    required: heist.requiredMembers
                })));
            }

            if (result.success) {
                const memberPayouts = result.heist.members.map(member => {
                    const multiplier = ROLE_MULTIPLIERS[member.role] || 1.0;
                    const basePayout = Math.floor(result.heist.actual_payout / result.heist.members.length);
                    const finalPayout = Math.floor(basePayout * multiplier);
                    const bonusPct = ((multiplier - 1) * 100).toFixed(0);

                    return lang.memberPayoutLine({
                        username: member.username,
                        role: member.role,
                        base: basePayout.toLocaleString(),
                        bonus: bonusPct,
                        payout: finalPayout.toLocaleString()
                    });
                }).join('\n\n');

                const prob = Math.floor(await EconomyManager.calculateHeistSuccess(result.heist, result.memberProfiles));

                const successCard = buildCard({
                    title: lang.successTitle,
                    accentColor: ACCENT.success
                })
                    .addText(`> **${lang.successSubtitle({ target: locTarget.name.toUpperCase() })}**\n> ${lang.successSecured}`)
                    .addSeparator()
                    .addText(`### 💰 ${lang.financialTitle}`)
                    .addText(lang.scoreDesc({
                        score: result.heist.actual_payout.toLocaleString(),
                        prob: prob,
                        crew: result.heist.members.length
                    }))
                    .addSeparator()
                    .addText(`### 👥 ${lang.payoutsTitle}`)
                    .addText(memberPayouts)
                    .addSeparator()
                    .addText(lang.notorietyNotice);

                const plannerMember = result.heist.members.find(member => member.userId === message.author.id);
                const plannerPayout = plannerMember
                    ? Math.floor(Math.floor(result.heist.actual_payout / result.heist.members.length) * (ROLE_MULTIPLIERS[plannerMember.role] || 1.0))
                    : 0;
                const successButtons = [];
                if (plannerPayout > 0) successButtons.push(btn.success('exec_deposit', lang.btnDepositLoot));
                successButtons.push(btn.secondary('exec_close', lang.btnClose));
                const rows = [new ActionRowBuilder().addComponents(...successButtons)];

                await editV2(executionMsg, { card: successCard, rows });

                const collector = executionMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'exec_close') {
                            collector.stop('closed');
                            return editV2(executionMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'exec_deposit') {
                            const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                            const bankLimit = EconomyManager.getBankLimit ? EconomyManager.getBankLimit(freshProfile) : (freshProfile.bankLimit || 1000000);
                            const deposit = await EconomyManager.depositWalletToBank({
                                userId: message.author.id,
                                guildId: message.guild.id,
                                maxAmount: plannerPayout,
                                bankLimit,
                                referenceId: `heist-deposit:${heistId}:${message.author.id}`,
                                description: lang.txDepositLoot({ amount: plannerPayout.toLocaleString() }).toString()
                            });
                            const canDeposit = deposit.amount;
                            collector.stop('deposited');
                            const finishCard = cards.success(
                                lang.successTitle,
                                lang.depositSuccess({
                                    amount: canDeposit.toLocaleString(),
                                    bank: (deposit.bank || freshProfile.bank || 0).toLocaleString()
                                })
                            );
                            return editV2(executionMsg, { card: finishCard, rows: [] });
                        }
                    } catch (err) {
                        console.error('Error in executeheist success collector:', err);
                    }
                });
                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(executionMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] }).catch(() => {});
                    }
                });

            } else {
                const memberPenalties = result.heist.members.map(member => {
                    const penalty = result.memberResults.find(item => item.userId === member.userId)?.fine || 0;
                    const jailHours = (targetData.difficulty || 1) * 6;

                    return lang.memberPenaltyLine({
                        username: member.username,
                        role: member.role,
                        jail: jailHours,
                        fine: penalty.toLocaleString()
                    });
                }).join('\n\n');

                const failProb = 100 - Math.floor(await EconomyManager.calculateHeistSuccess(result.heist, result.memberProfiles));
                const avgJail = (targetData.difficulty || 1) * 6;

                const failCard = buildCard({
                    title: lang.failureTitle,
                    accentColor: ACCENT.danger
                })
                    .addText(`> **${lang.failureSubtitle}**\n> ${lang.interceptedDesc({ target: locTarget.name })}`)
                    .addSeparator()
                    .addText(`### ⚖️ ${lang.consequencesTitle}`)
                    .addText(lang.penaltiesDesc({ fine: lang.confiscatedText.toString(), jail: avgJail }))
                    .addSeparator()
                    .addText(`### 🚔 ${lang.penaltiesTitle}`)
                    .addText(memberPenalties)
                    .addSeparator()
                    .addText(lang.failureProbRecord({ prob: failProb }));

                const rows = [
                    new ActionRowBuilder().addComponents(btn.secondary('exec_close', lang.btnClose))
                ];

                await editV2(executionMsg, { card: failCard, rows });

                const failCollector = executionMsg.createMessageComponentCollector({ time: 60000 });
                failCollector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();
                        if (interaction.customId === 'exec_close') {
                            failCollector.stop('closed');
                            return editV2(executionMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }
                    } catch (err) {
                        console.error('Error in executeheist fail collector:', err);
                    }
                });
                failCollector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(executionMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] }).catch(() => {});
                    }
                });
            }

        } catch (resErr) {
            console.error('Phase 4 resolution error in executeheist:', resErr);
            await editV2(executionMsg, cards.error(lang.errorTitle, lang.errorMessage)).catch(() => {});
        }
    }, 9000);
}

module.exports = {
    name: 'executeheist',
    aliases: ['heist-execute', 'startheist'],
    description: lang.cmdDesc.toString(),
    usage: '!executeheist [heist_id]',
    cooldown: 5000,
    async execute(message, args) {
        try {
            const userId = message.author.id;

            if (args[0]) {
                return await runHeistExecution(message, args[0]);
            }

            
            const readyHeists = await Heist.find({
                plannerUserId: userId,
                guildId: message.guild.id,
                status: 'ready'
            });

            if (readyHeists.length === 0) {
                const noReadyCard = cards.warning(
                    lang.missingIdTitle,
                    lang.missingIdDesc()
                );
                const noReadyRows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('exec_plan_new', lang.btnPlanNew),
                        btn.secondary('exec_close', lang.btnClose)
                    )
                ];
                const sentMsg = await sendV2(message, { card: noReadyCard, rows: noReadyRows });
                if (!sentMsg) return;

                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'exec_close') {
                            collector.stop('closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }
                        if (interaction.customId === 'exec_plan_new') {
                            collector.stop('plan');
                            const planCmd = require('./planheist');
                            return planCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error in executeheist plan collector:', err);
                    }
                });
                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] }).catch(() => {});
                    }
                });
                return;
            }

            const selectOptions = readyHeists.slice(0, 25).map(h => {
                const locTarget = resolveEntity('heist_targets', h.targetType, { name: h.targetName });
                return {
                    label: `${locTarget.name} (${h.heistId.substring(0, 10)}...)`,
                    value: h.heistId,
                    description: lang.readyOptionDesc({
                        crew: h.members.length,
                        payout: (h.payoutMin || 1000).toLocaleString()
                    }).toString()
                };
            });

            const card = buildCard({
                title: lang.title,
                accentColor: ACCENT.danger
            })
                .addText(`> **${lang.readyTeamDesc()}**`)
                .addSeparator()
                .addText(lang.readyHeistsHeader);

            const rows = [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('executeheist_select')
                        .setPlaceholder(lang.selectReadyPlaceholder.toString())
                        .addOptions(selectOptions)
                ),
                new ActionRowBuilder().addComponents(
                    btn.danger('exec_close', lang.btnClose)
                )
            ];

            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'exec_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'executeheist_select') {
                        collector.stop('executed');
                        const selectedHeistId = interaction.values[0];
                        return runHeistExecution(message, selectedHeistId);
                    }
                } catch (err) {
                    console.error('Error in executeheist select collector:', err);
                    editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in executeheist command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
