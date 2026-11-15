'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { CRIME_TYPES, JAILBREAK_METHODS, HEAT_LEVELS } = require('../../models/economy/constants/crimeData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.crime);

function getLocalizedHeatLevel(heatScore) {
    const heatLevel = HEAT_LEVELS.find(h => heatScore >= h.min && heatScore <= h.max) || HEAT_LEVELS[0];
    let name = heatLevel.name;
    let description = heatLevel.description;

    if (heatLevel.min === 0) {
        name = lang.heatClean.toString();
        description = lang.heatDescClean.toString();
    } else if (heatLevel.min === 21) {
        name = lang.heatSuspicious.toString();
        description = lang.heatDescSuspicious.toString();
    } else if (heatLevel.min === 41) {
        name = lang.heatWanted.toString();
        description = lang.heatDescWanted.toString();
    } else if (heatLevel.min === 61) {
        name = lang.heatMostWanted.toString();
        description = lang.heatDescMostWanted.toString();
    } else if (heatLevel.min === 81) {
        name = lang.heatPublicEnemy.toString();
        description = lang.heatDescPublicEnemy.toString();
    }

    return { ...heatLevel, name, description };
}

function buildCrimeListCard(profile) {
    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.listSubtitle}**\n> ${lang.listIntro}`)
        .addSeparator()
        .addText(lang.availableCrimesHeader);

    const crimeLines = Object.entries(CRIME_TYPES).map(([id, crime]) => {
        const locCrime = resolveEntity('crime', id, crime);
        const locked = (profile.level || 1) < crime.level ? lang.lockedTag({ level: crime.level }) : '';
        const cooldownMins = Math.round(crime.cooldown / (60 * 1000));
        return lang.crimeItemLine({
            name: locCrime.name,
            locked,
            rate: crime.successRate,
            minReward: crime.minReward.toLocaleString(),
            maxReward: crime.maxReward.toLocaleString(),
            minFine: crime.minFine.toLocaleString(),
            maxFine: crime.maxFine.toLocaleString(),
            cooldown: cooldownMins,
            id
        });
    }).join('\n\n');

    card.addText(crimeLines);

    const crimeStats = profile.crimeStats || {};
    const heatLevel = getLocalizedHeatLevel(crimeStats.heatLevel || 0);

    card.addSeparator()
        .addText(`### ${lang.recordTitle}`)
        .addText(
            `${lang.heatFormat({ name: heatLevel.name, heat: crimeStats.heatLevel || 0 })}\n` +
            `${lang.crimesCommittedFormat({ committed: crimeStats.crimesCommitted || 0, caught: crimeStats.timesCaught || 0 })}\n` +
            `${lang.earningsFormat({ earnings: (crimeStats.totalCrimeEarnings || 0).toLocaleString(), fines: (crimeStats.totalFinesPaid || 0).toLocaleString() })}`
        );

    return card;
}

function buildCrimeActionRows(profile) {
    const inJail = profile.jailTime && new Date() < new Date(profile.jailTime);
    if (inJail) {
        return [
            new ActionRowBuilder().addComponents(
                btn.danger('crime_jailbreak', lang.btnJailbreak),
                btn.secondary('crime_close', lang.btnClose)
            )
        ];
    }

    const selectOptions = Object.entries(CRIME_TYPES).map(([id, crime]) => {
        const locCrime = resolveEntity('crime', id, crime);
        const isLocked = (profile.level || 1) < crime.level;
        const lockedText = isLocked ? lang.requiresLevelTag({ level: crime.level }).toString() : '';
        return {
            label: locCrime.name,
            value: id,
            description: lang.selectMenuOptionDesc({
                rate: crime.successRate,
                min: crime.minReward.toLocaleString(),
                max: crime.maxReward.toLocaleString(),
                locked: lockedText
            }),
            emoji: locCrime.emoji || crime.emoji || '🎯'
        };
    });

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('crime_select')
            .setPlaceholder(lang.selectPlaceholder.toString())
            .addOptions(selectOptions)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('crime_close', lang.btnClose)
    );

    return [menuRow, btnRow];
}

async function executeCrimeAction(userId, guildId, crimeId, referenceId) {
    const crime = CRIME_TYPES[crimeId];
    if (!crime) {
        return {
            error: 'unknown',
            card: cards.warning(
                lang.unknownCrimeTitle,
                lang.unknownCrimeDesc({ valid: Object.keys(CRIME_TYPES).join(', ') })
            )
        };
    }

    const locCrime = resolveEntity('crime', crimeId, crime);
    const profile = await EconomyManager.getProfile(userId, guildId);
    const cooldown = profile.cooldowns?.crime;
    if (cooldown) {
        const elapsed = Date.now() - new Date(cooldown).getTime();
        if (elapsed < crime.cooldown) {
            const remaining = Math.ceil((crime.cooldown - elapsed) / (60 * 1000));
            return {
                error: 'cooldown',
                card: cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ remaining })
                )
            };
        }
    }

    const txOptions = {
        referenceId: `crime:${referenceId}`,
        txSuccess: lang.txCrimeSuccess({ name: locCrime.name }).toString(),
        txFine: lang.txCrimeFine({ name: locCrime.name }).toString()
    };

    const result = await EconomyManager.executeCrime(userId, guildId, crimeId, txOptions);

    if (result.error === 'In jail') {
        const remaining = Math.ceil(result.jailRemaining / (60 * 1000));
        return {
            error: 'jail',
            card: cards.warning(
                lang.inJailTitle,
                lang.inJailDesc({ remaining })
            )
        };
    }

    if (result.error === 'cooldown') {
        const remaining = Math.ceil((result.cooldownRemaining || 0) / (60 * 1000));
        return { error: 'cooldown', card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ remaining })) };
    }

    if (result.error) {
        return {
            error: 'cannot_commit',
            card: cards.warning(
                lang.cannotCommitTitle,
                result.error || lang.cannotCommitDefault.toString()
            )
        };
    }

    let card;
    const rows = [];

    if (result.success) {
        card = buildCard({
            title: lang.successTitle,
            accentColor: ACCENT.success
        })
            .addText(lang.jobPulledOff({ name: locCrime.name.toUpperCase() }))
            .addSeparator()
            .addText(
                `**💰 ${lang.rewardLabel}:** \`+$${result.reward.toLocaleString()}\`\n` +
                `**⭐ ${lang.xpGainedLabel}:** \`+${result.xp}\` XP\n` +
                `**🔥 ${lang.heatGainedLabel}:** \`+${result.heatGained}\` (Current: \`${result.heatLevel}/100\`)\n\n` +
                lang.watchHeatTip
            );

        rows.push(
            new ActionRowBuilder().addComponents(
                btn.success(`crime_deposit_${result.reward}`, lang.btnDepositBank),
                btn.secondary('crime_close', lang.btnClose)
            )
        );
    } else {
        const jailMins = Math.ceil(crime.jailTime / (60 * 1000));
        card = buildCard({
            title: lang.bustedTitle,
            accentColor: ACCENT.danger
        })
            .addText(lang.jobFailed({ name: locCrime.name.toUpperCase() }))
            .addSeparator()
            .addText(
                `**💸 ${lang.fineLabel}:** \`$${result.fine.toLocaleString()}\`\n` +
                (result.insuranceCoverage > 0 ? `**🛡️ ${lang.insuranceCoverageLabel}:** \`$${result.insuranceCoverage.toLocaleString()}\`\n` : '') +
                `**🔒 ${lang.jailSentenceLabel}:** \`${lang.jailMinsRemaining({ minutes: jailMins })}\`\n` +
                `**${lang.statusFieldLabel}:** ${lang.incarceratedStatus}`
            );

        rows.push(
            new ActionRowBuilder().addComponents(
                btn.danger('crime_jailbreak', lang.btnJailbreak),
                btn.secondary('crime_close', lang.btnClose)
            )
        );
    }

    const newProfile = await EconomyManager.getProfile(userId, guildId);
    const newAchievements = await EconomyManager.checkAchievements(newProfile);
    if (newAchievements.length > 0) {
        const achText = newAchievements.map(a => lang.achievementItem({ name: a.name, description: a.description, reward: a.reward }).toString()).join('\n');
        card.addSeparator().addText(`### ${lang.achievementsTitle}\n${achText}`);
    }

    return { success: result.success, card, rows, reward: result.reward || 0 };
}

module.exports = {
    name: 'crime',
    aliases: ['crimes', 'criminal'],
    description: lang.cmdDesc.toString(),
    usage: '!crime [type | list | status | jailbreak]',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const profile = await EconomyManager.getProfile(userId, guildId);
            const action = args[0]?.toLowerCase();

            
            if (action === 'status') {
                const crimeStats = profile.crimeStats || {};
                const heatLevel = getLocalizedHeatLevel(crimeStats.heatLevel || 0);
                const inJail = profile.jailTime && new Date() < new Date(profile.jailTime);

                const card = buildCard({
                    title: lang.statusTitle,
                    accentColor: inJail ? ACCENT.danger : ACCENT.warning
                })
                    .addText(
                        `> **${lang.targetUserLabel}:** ${message.author.username}\n` +
                        `> **${lang.heatLevelLabel}:** ${heatLevel.name} (\`${crimeStats.heatLevel || 0}/100\`)\n` +
                        `> **${lang.successPenaltyLabel}:** \`-${heatLevel.penalty}%\`\n` +
                        `> ${heatLevel.description}`
                    );

                if (inJail) {
                    const remaining = Math.ceil((new Date(profile.jailTime).getTime() - Date.now()) / (60 * 1000));
                    card.addSeparator()
                        .addText(`### ${lang.incarceratedHeader}\n> **${lang.timeRemainingLabel}:** \`${lang.jailMinsRemaining({ minutes: remaining })}\`\n> ${lang.jailEscapeHint}`);
                }

                card.addSeparator()
                    .addText(`### ${lang.recordTitle}`)
                    .addText(
                        `${lang.crimesCommittedFormat({ committed: crimeStats.crimesCommitted || 0, caught: crimeStats.timesCaught || 0 })}\n` +
                        `${lang.earningsFormat({ earnings: (crimeStats.totalCrimeEarnings || 0).toLocaleString(), fines: (crimeStats.totalFinesPaid || 0).toLocaleString() })}`
                    );

                const rows = [
                    new ActionRowBuilder().addComponents(btn.secondary('crime_close', lang.btnClose))
                ];

                return sendV2(message, { card, rows });
            }

            
            if (action === 'jailbreak' || action === 'escape') {
                if (!profile.jailTime || new Date() >= new Date(profile.jailTime)) {
                    return sendV2(message, cards.info(lang.notInJailTitle, lang.notInJailDesc));
                }

                const method = args[1]?.toLowerCase();
                if (!method || !JAILBREAK_METHODS[method]) {
                    const card = buildCard({
                        title: lang.jailbreakMethodsTitle,
                        accentColor: ACCENT.warning
                    })
                        .addText(`> **${lang.jailbreakMethodsSubtitle}**\n> ${lang.chooseEscapePlan}`)
                        .addSeparator();

                    const methodLines = Object.entries(JAILBREAK_METHODS).map(([id, m]) => {
                        const locMethod = resolveEntity('jailbreak_methods', id, m);
                        const costText = m.cost > 0 ? `$${m.cost.toLocaleString()}` : lang.freeCost.toString();
                        return lang.escapeMethodItem({ name: locMethod.name, cost: costText, rate: m.successRate, id });
                    }).join('\n\n');

                    card.addText(methodLines);

                    const rows = [
                        new ActionRowBuilder().addComponents(btn.secondary('crime_close', lang.btnClose))
                    ];

                    return sendV2(message, { card, rows });
                }

                const jailMethod = JAILBREAK_METHODS[method];
                const locMethod = resolveEntity('jailbreak_methods', method, jailMethod);
                if (jailMethod.cost > 0 && (profile.wallet || 0) < jailMethod.cost) {
                    return sendV2(message, cards.warning(
                        lang.notEnoughMoneyTitle,
                        lang.notEnoughMoneyDesc({ cost: jailMethod.cost.toLocaleString() })
                    ));
                }

                const success = Math.random() * 100 < jailMethod.successRate;
                const settlement = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `jailbreak:${message.id}`, mutate: async current => {
                    if (!current.jailTime || new Date(current.jailTime) <= new Date()) return { success: false, error: 'not_in_jail' };
                    if ((current.wallet || 0) < jailMethod.cost) return { success: false, error: 'funds' };
                    current.wallet -= jailMethod.cost;
                    if (success) {
                        current.jailTime = null;
                        if (!current.crimeStats) current.crimeStats = {};
                        current.crimeStats.jailbreaks = (current.crimeStats.jailbreaks || 0) + 1;
                    } else {
                        current.jailTime = new Date(new Date(current.jailTime).getTime() + 10 * 60 * 1000);
                    }
                    current.transactions.push({ type: 'expense', amount: jailMethod.cost, description: lang.txJailbreakAttempt({ method: locMethod.name }).toString(), category: 'crime', timestamp: new Date() });
                    return { success };
                }});
                if (!settlement.success) {
                    return sendV2(message, settlement.error === 'funds'
                        ? cards.warning(lang.notEnoughMoneyTitle, lang.notEnoughMoneyDesc({ cost: jailMethod.cost.toLocaleString() }))
                        : cards.info(lang.notInJailTitle, lang.notInJailDesc));
                }

                if (success) {

                    const successCard = cards.success(
                        lang.jailbreakSuccessTitle,
                        lang.jailbreakSuccessDesc({
                            method: locMethod.name,
                            cost: jailMethod.cost > 0 ? `$${jailMethod.cost.toLocaleString()}` : lang.freeCost.toString()
                        })
                    );
                    const rows = [new ActionRowBuilder().addComponents(btn.secondary('crime_close', lang.btnClose))];
                    return sendWithCloseCollector(message, { card: successCard, rows }, userId);
                } else {
                    const failedCard = cards.error(
                        lang.jailbreakFailedTitle,
                        lang.jailbreakFailedDesc({
                            costMsg: jailMethod.cost > 0 ? lang.lostCostMsg({ cost: jailMethod.cost.toLocaleString() }) : ''
                        })
                    );
                    const rows = [new ActionRowBuilder().addComponents(btn.secondary('crime_close', lang.btnClose))];
                    return sendWithCloseCollector(message, { card: failedCard, rows }, userId);
                }
            }

            
            if (action && action !== 'list' && CRIME_TYPES[action]) {
                const execResult = await executeCrimeAction(userId, guildId, action, message.id);
                const sentMsg = await sendV2(message, { card: execResult.card, rows: execResult.rows });
                if (!sentMsg || !execResult.rows || execResult.rows.length === 0) return;

                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'crime_close') {
                            collector.stop('user_closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'crime_jailbreak') {
                            collector.stop('jailbreak');
                            return module.exports.execute(message, ['jailbreak']);
                        }

                        if (interaction.customId.startsWith('crime_deposit_')) {
                            const transfer = await EconomyManager.transferBank({ userId, guildId, direction: 'deposit', amount: 'all', referenceId: `crime-deposit:${sentMsg.id}`, description: lang.txDepositLoot({ amount: 'loot' }).toString() });
                            const canDeposit = transfer.success ? transfer.amount : 0;
                            collector.stop('deposited');
                            const finishCard = buildCard({
                                title: lang.successTitle,
                                accentColor: ACCENT.success
                            }).addText(lang.depositedAlert({ amount: canDeposit.toLocaleString() }));
                            return editV2(sentMsg, { card: finishCard, rows: [] });
                        }
                    } catch (err) {
                        console.error('Error in crime direct action collector:', err);
                    }
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            }

            
            const initialCard = buildCrimeListCard(profile);
            const initialRows = buildCrimeActionRows(profile);

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'crime_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'crime_jailbreak') {
                        collector.stop('jailbreak');
                        return module.exports.execute(message, ['jailbreak']);
                    }

                    if (interaction.customId === 'crime_select') {
                        const chosenCrime = interaction.values[0];
                        const execResult = await executeCrimeAction(userId, guildId, chosenCrime, interaction.id);
                        return editV2(sentMessage, { card: execResult.card, rows: execResult.rows });
                    }

                    if (interaction.customId.startsWith('crime_deposit_')) {
                        const transfer = await EconomyManager.transferBank({ userId, guildId, direction: 'deposit', amount: 'all', referenceId: `crime-deposit:${sentMessage.id}`, description: lang.txDepositLoot({ amount: 'loot' }).toString() });
                        const canDeposit = transfer.success ? transfer.amount : 0;
                        collector.stop('deposited');
                        const finishCard = buildCard({
                            title: lang.successTitle,
                            accentColor: ACCENT.success
                        }).addText(lang.depositedAlert({ amount: canDeposit.toLocaleString() }));
                        return editV2(sentMessage, { card: finishCard, rows: [] });
                    }
                } catch (err) {
                    console.error('Error in crime interactive menu collector:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in crime command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
