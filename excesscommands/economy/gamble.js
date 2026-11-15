'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.gamble);

async function handleGambleDeposit(userId, guildId, referenceId) {
    const freshProfile = await EconomyManager.getProfile(userId, guildId);
    const result = await EconomyManager.transferBank({
        userId, guildId, direction: 'deposit', amount: 'all',
        referenceId: `gamble-deposit:${referenceId}`,
        description: lang.txDepositGamble({ amount: (freshProfile.wallet || 0).toLocaleString() }).toString()
    });
    return result.amount || 0;
}

async function executeGamble(profile, amount, referenceId, bypassCooldown = false) {
    const luckMultiplier = EconomyManager.getGamblingLuck(profile);
    const baseLuckBonus = (luckMultiplier - 1) * 10;
    const winChance = Math.min(75, 45 + baseLuckBonus);

    const won = Math.random() * 100 < winChance;
    let multiplier = 0;
    let winnings = 0;
    if (won) {
        const roll = Math.random() * 100;
        if (roll > 98) multiplier = 5.0 * luckMultiplier;
        else if (roll > 90) multiplier = 3.0 * luckMultiplier;
        else if (roll > 70) multiplier = 2.5 * luckMultiplier;
        else multiplier = 2.0 * luckMultiplier;
        winnings = Math.floor(amount * multiplier);
    }
    const settlement = await EconomyManager.settleGamblingBet({
        userId: profile.userId,
        guildId: profile.guildId,
        betAmount: amount,
        winnings: won ? winnings : 0,
        won,
        referenceId,
        bypassCooldown,
        description: won ? lang.txGambleWin({ multiplier: multiplier.toFixed(2) }).toString() : lang.txGambleLoss.toString()
    });
    if (!settlement.success) {
        if (settlement.cooldown) return { card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ seconds: Math.max(1, Math.ceil((settlement.nextBet - Date.now()) / 1000)) })), rows: [] };
        if (settlement.insufficientFunds) return { card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (settlement.profile?.wallet || 0).toLocaleString(), amount: amount.toLocaleString() })), rows: [] };
        return { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] };
    }
    profile = settlement.profile;

    let card;
    if (won) {
        const profit = winnings - amount;

        let winTier = lang.tierLuckyWin.toString();
        if (multiplier >= 4) winTier = lang.tierMegaJackpot.toString();
        else if (multiplier >= 3) winTier = lang.tierJackpot.toString();
        else if (multiplier >= 2.5) winTier = lang.tierBigWin.toString();

        card = buildCard({
            title: lang.winTitle,
            accentColor: ACCENT.success
        })
            .addText(`> **${winTier}**\n> ${lang.winDesc({ amount: amount.toLocaleString(), winnings: winnings.toLocaleString(), profit: profit.toLocaleString() })}`)
            .addSeparator()
            .addText(`### ${lang.breakdownTitle}`)
            .addText(
                `**💎 ${lang.netProfitLabel}:** \`+$${profit.toLocaleString()}\`\n` +
                `**📈 ${lang.winMultiplierLabel}:** \`${multiplier.toFixed(2)}x\`\n` +
                `**🍀 ${lang.luckBonusLabel}:** \`${luckMultiplier.toFixed(2)}x\`\n` +
                `**🎯 ${lang.winChanceLabel}:** \`${winChance.toFixed(1)}%\`\n` +
                `**💳 ${lang.newBalanceLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\``
            );

        if (luckMultiplier > 1) {
            card.addSeparator()
                .addText(`### ${lang.luckSystemTitle}`)
                .addText(
                    `**⚡ ${lang.multiplierBoostLabel}:** \`${((luckMultiplier - 1) * 100).toFixed(0)}%\` bonus\n` +
                    lang.luckEnhancedNote.toString()
                );
        }
    } else {
        card = buildCard({
            title: lang.lossTitle,
            accentColor: ACCENT.danger
        })
            .addText(`> **${lang.lossSubtitle}**\n> ${lang.lossDesc({ amount: amount.toLocaleString() })}`)
            .addSeparator()
            .addText(`### ${lang.statsTitle}`)
            .addText(
                `**🎯 ${lang.winChanceLabel}:** \`${winChance.toFixed(1)}%\`\n` +
                `**🍀 ${lang.luckMultiplierLabel}:** \`${luckMultiplier.toFixed(2)}x\`\n` +
                `**💸 ${lang.amountLostLabel}:** \`-$${amount.toLocaleString()}\`\n` +
                `**💳 ${lang.remainingWalletLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\``
            )
            .addSeparator()
            .addText(`### ${lang.tipsTitle}`)
            .addText(lang.tipsDesc.toString());
    }

    card.addSeparator()
        .addText(`### ${lang.sessionTitle}`)
        .addText(
            `**${lang.cooldownDurationLabel}:** \`30 seconds\`\n` +
            `**${lang.nextSessionAvailableLabel}:** <t:${Math.floor((Date.now() + 30000) / 1000)}:R>`
        );

    const buttons = [];
    if (won && (profile.wallet || 0) > 0) {
        buttons.push(btn.success('gamble_deposit_bank', lang.btnDepositBank));
    }
    buttons.push(btn.secondary('gamble_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];
    return { card, rows };
}

module.exports = {
    name: 'gamble',
    aliases: ['bet'],
    description: lang.cmdDesc.toString(),
    usage: '!gamble [amount | all | max]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const profile = await EconomyManager.getProfile(message.author.id, message.guild.id);

            const cooldownCheck = EconomyManager.checkCooldown(profile, 'gambling');
            if (cooldownCheck && cooldownCheck.onCooldown) {
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({
                        seconds: cooldownCheck.timeLeft?.seconds || 30
                    })
                ));
            }

            
            if (!args[0]) {
                const guideCard = buildCard({
                    title: lang.winTitle,
                    accentColor: ACCENT.primary
                }).addText(
                    `> **${lang.invalidAmountTitle}**\n${lang.invalidAmountDesc({ wallet: (profile.wallet || 0).toLocaleString() })}\n\n` +
                    `${lang.walletBalance({ wallet: (profile.wallet || 0).toLocaleString() })}`
                );

                const quickRows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('gamble_100', '$100'),
                        btn.primary('gamble_500', '$500'),
                        btn.primary('gamble_1000', '$1,000'),
                        btn.danger('gamble_all', lang.btnAllIn),
                        btn.secondary('gamble_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: guideCard, rows: quickRows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'gamble_close') {
                            collector.stop('user_closed');
                            return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'gamble_deposit_bank') {
                            const deposited = await handleGambleDeposit(message.author.id, message.guild.id, interaction.message.id);
                            collector.stop('deposited');
                            return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                        }

                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        let qBet = 100;
                        if (interaction.customId === 'gamble_100') qBet = 100;
                        else if (interaction.customId === 'gamble_500') qBet = 500;
                        else if (interaction.customId === 'gamble_1000') qBet = 1000;
                        else if (interaction.customId === 'gamble_all') qBet = freshProfile.wallet || 0;

                        if ((freshProfile.wallet || 0) < qBet || qBet <= 0) {
                            return editV2(sentMessage, {
                                card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (freshProfile.wallet || 0).toLocaleString(), amount: qBet.toLocaleString() })),
                                rows: []
                            });
                        }

                        const gambleRes = await executeGamble(freshProfile, qBet, interaction.id, true);
                        return editV2(sentMessage, { card: gambleRes.card, rows: gambleRes.rows });
                    } catch (collectorErr) {
                        console.error('Error in gamble quick bet collector:', collectorErr);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            }

            let amount;
            if (args[0] === 'all' || args[0] === 'max') {
                amount = profile.wallet || 0;
            } else {
                amount = /^\d+$/.test(args[0]) ? Number(args[0]) : NaN;
            }

            if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(Math.floor(amount * 12.5))) {
                return sendV2(message, cards.warning(
                    lang.invalidAmountTitle,
                    lang.invalidAmountDesc({
                        wallet: (profile.wallet || 0).toLocaleString()
                    })
                ));
            }

            if ((profile.wallet || 0) < amount) {
                return sendV2(message, cards.warning(
                    lang.insufficientFundsTitle,
                    lang.insufficientFundsDesc({
                        wallet: (profile.wallet || 0).toLocaleString(),
                        amount: amount.toLocaleString()
                    })
                ));
            }

            const gambleRes = await executeGamble(profile, amount, message.id);
            const sentMessage = await sendV2(message, { card: gambleRes.card, rows: gambleRes.rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'gamble_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'gamble_deposit_bank') {
                        const deposited = await handleGambleDeposit(message.author.id, message.guild.id, interaction.message.id);
                        collector.stop('deposited');
                        return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                    }
                } catch (collectorErr) {
                    console.error('Error in gamble result collector:', collectorErr);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in gamble command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
