'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.guess);

async function handleGuessDeposit(userId, guildId, referenceId) {
    const freshProfile = await EconomyManager.getProfile(userId, guildId);
    const result = await EconomyManager.transferBank({
        userId, guildId, direction: 'deposit', amount: 'all',
        referenceId: `guess-deposit:${referenceId}`,
        description: lang.txDepositGuess({ amount: (freshProfile.wallet || 0).toLocaleString() }).toString()
    });
    return result.amount || 0;
}

async function executeGuess(profile, betAmount, guess, referenceId, bypassCooldown = false) {
    const correctNumber = Math.floor(Math.random() * 10) + 1;
    const won = guess === correctNumber;

    const luckMultiplier = EconomyManager.getGamblingLuck ? EconomyManager.getGamblingLuck(profile) : 1;
    let winnings = 0;
    let multiplier = 0;

    if (won) {
        multiplier = 10.0 * luckMultiplier;
        winnings = Math.floor(betAmount * multiplier);
    }

    const profit = won ? winnings - betAmount : -betAmount;
    const settlement = await EconomyManager.settleGamblingBet({
        userId: profile.userId,
        guildId: profile.guildId,
        betAmount,
        winnings: won ? winnings : 0,
        won,
        referenceId,
        bypassCooldown,
        description: lang.txGuess({ outcome: won ? lang.txWin.toString() : lang.txLoss.toString(), guess, correct: correctNumber }).toString()
    });
    if (!settlement.success) {
        if (settlement.cooldown) return { card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ seconds: Math.max(1, Math.ceil((settlement.nextBet - Date.now()) / 1000)) })), rows: [] };
        if (settlement.insufficientFunds) return { card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (settlement.profile?.wallet || 0).toLocaleString(), bet: betAmount.toLocaleString() })), rows: [] };
        return { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] };
    }
    profile = settlement.profile;

    const card = buildCard({
        title: won ? lang.winTitle : lang.lossTitle,
        accentColor: won ? ACCENT.success : ACCENT.danger
    })
        .addText(
            `> **${lang.resultDesc({ guess, correct: correctNumber })}**` +
            (won ? lang.perfectMatchNotice.toString() : '')
        )
        .addSeparator()
        .addText(`### 💰 ${won ? lang.winDetailsTitle : lang.lossDetailsTitle}`);

    if (won) {
        card.addText(
            `> **💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `> **🎯 ${lang.multiplierLabel}:** \`${multiplier.toFixed(2)}x\`\n` +
            `> **💎 ${lang.winningsLabel}:** \`$${winnings.toLocaleString()}\`\n` +
            `> **📈 ${lang.profitLabel}:** \`+$${profit.toLocaleString()}\`\n` +
            `> **💳 ${lang.newBalanceLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\`` +
            (luckMultiplier > 1 ? `\n> **🍀 ${lang.luckBonusLabel}:** \`${luckMultiplier.toFixed(2)}x\`` : '')
        );
    } else {
        card.addText(
            `> **💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `> **💸 ${lang.lossLabel}:** \`-$${betAmount.toLocaleString()}\`\n` +
            `> **💳 ${lang.remainingBalanceLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\`\n\n` +
            `> ${lang.tipText}`
        );
    }

    const buttons = [];
    if (won && (profile.wallet || 0) > 0) {
        buttons.push(btn.success('guess_deposit_bank', lang.btnDepositBank));
    }
    buttons.push(btn.secondary('guess_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];
    return { card, rows };
}

module.exports = {
    name: 'guess',
    aliases: ['numberguess', 'pick'],
    description: lang.cmdDesc.toString(),
    usage: '!guess <bet> <number>',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const profile = await EconomyManager.getProfile(message.author.id, message.guild.id);

            const cooldownCheck = EconomyManager.checkCooldown(profile, 'gambling');
            if (cooldownCheck && cooldownCheck.onCooldown) {
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ seconds: cooldownCheck.timeLeft.seconds })
                ));
            }

            
            if (!args[0] || !args[1]) {
                const betAmount = args[0] ? (args[0] === 'all' || args[0] === 'max' ? (profile.wallet || 0) : (/^\d+$/.test(args[0]) ? Number(args[0]) : NaN)) : 500;
                const validatedBet = !Number.isSafeInteger(betAmount) || betAmount <= 0 || !Number.isSafeInteger(Math.floor(betAmount * 25)) ? 500 : betAmount;

                const guideCard = buildCard({
                    title: lang.missingArgsTitle,
                    accentColor: ACCENT.primary
                }).addText(
                    `> ${lang.missingArgsDesc}\n\n` +
                    `${lang.walletBalance({ wallet: (profile.wallet || 0).toLocaleString() })}\n` +
                    `> **💵 Default Bet:** \`$${validatedBet.toLocaleString()}\``
                );

                const selectOptions = [];
                for (let i = 1; i <= 10; i++) {
                    selectOptions.push({
                        label: `Number ${i}`,
                        value: `guess_val_${validatedBet}_${i}`,
                        description: `Wager $${validatedBet.toLocaleString()} on number ${i} (10x payout)`
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('guess_number_select')
                    .setPlaceholder(lang.selectNumberPlaceholder.toString())
                    .addOptions(selectOptions);

                const rows = [
                    new ActionRowBuilder().addComponents(selectMenu),
                    new ActionRowBuilder().addComponents(btn.danger('guess_close', lang.btnClose))
                ];

                const sentMessage = await sendV2(message, { card: guideCard, rows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'guess_close') {
                            collector.stop('user_closed');
                            return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'guess_deposit_bank') {
                            const deposited = await handleGuessDeposit(message.author.id, message.guild.id, interaction.message.id);
                            collector.stop('deposited');
                            return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                        }

                        if (interaction.customId === 'guess_number_select') {
                            const val = interaction.values[0];
                            const parts = val.replace('guess_val_', '').split('_');
                            const wager = /^\d+$/.test(parts[0]) ? Number(parts[0]) : NaN;
                            const pickedNumber = /^\d+$/.test(parts[1]) ? Number(parts[1]) : NaN;

                            if (!Number.isSafeInteger(wager) || wager <= 0 || !Number.isInteger(pickedNumber) || pickedNumber < 1 || pickedNumber > 10) {
                                return editV2(sentMessage, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc({ guess: parts[1] })));
                            }

                            const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                            if ((freshProfile.wallet || 0) < wager) {
                                collector.stop('funds');
                                return editV2(sentMessage, {
                                    card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (freshProfile.wallet || 0).toLocaleString(), bet: wager.toLocaleString() })),
                                    rows: []
                                });
                            }

                            const guessRes = await executeGuess(freshProfile, wager, pickedNumber, interaction.id, true);
                            return editV2(sentMessage, { card: guessRes.card, rows: guessRes.rows });
                        }
                    } catch (collectorErr) {
                        console.error('Error in guess interactive collector:', collectorErr);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            }

            let betAmount;
            if (args[0] === 'all' || args[0] === 'max') {
                betAmount = profile.wallet || 0;
            } else {
                betAmount = /^\d+$/.test(args[0]) ? Number(args[0]) : NaN;
            }

            const guess = /^\d+$/.test(args[1]) ? Number(args[1]) : NaN;

            if (!Number.isSafeInteger(betAmount) || betAmount <= 0 || !Number.isSafeInteger(Math.floor(betAmount * 25))) {
                return sendV2(message, cards.error(
                    lang.invalidBetTitle,
                    lang.invalidBetDesc({ input: args[0] })
                ));
            }

            if (isNaN(guess) || guess < 1 || guess > 10) {
                return sendV2(message, cards.error(
                    lang.invalidNumberTitle,
                    lang.invalidNumberDesc({ guess: args[1] })
                ));
            }

            if ((profile.wallet || 0) < betAmount) {
                return sendV2(message, cards.error(
                    lang.insufficientFundsTitle,
                    lang.insufficientFundsDesc({
                        wallet: (profile.wallet || 0).toLocaleString(),
                        bet: betAmount.toLocaleString()
                    })
                ));
            }

            const guessRes = await executeGuess(profile, betAmount, guess, message.id);
            const sentMessage = await sendV2(message, { card: guessRes.card, rows: guessRes.rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'guess_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'guess_deposit_bank') {
                        const deposited = await handleGuessDeposit(message.author.id, message.guild.id, interaction.message.id);
                        collector.stop('deposited');
                        return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                    }
                } catch (collectorErr) {
                    console.error('Error in guess result collector:', collectorErr);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in guess command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
