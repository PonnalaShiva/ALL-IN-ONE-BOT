'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.coinflip);

async function handleCoinflipDeposit(userId, guildId, referenceId) {
    const freshProfile = await EconomyManager.getProfile(userId, guildId);
    const result = await EconomyManager.transferBank({
        userId, guildId, direction: 'deposit', amount: 'all',
        referenceId: `coinflip-deposit:${referenceId}`,
        description: lang.txDepositCoinflip({ amount: (freshProfile.wallet || 0).toLocaleString() }).toString()
    });
    return result.amount || 0;
}

async function executeFlip(profile, betAmount, guess = 'heads', referenceId, bypassCooldown = false) {
    const isHeads = Math.random() < 0.5;
    const result = isHeads ? 'heads' : 'tails';

    const luckMultiplier = EconomyManager.getGamblingLuck(profile);
    const userGuess = guess.startsWith('h') ? 'heads' : 'tails';
    const won = result === userGuess;

    let winnings = 0;
    let multiplier = 0;

    if (won) {
        multiplier = 2.0 * luckMultiplier;
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
        description: lang.txCoinflip({ outcome: won ? lang.txWin.toString() : lang.txLoss.toString(), result }).toString()
    });
    if (!settlement.success) {
        if (settlement.cooldown) return { card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ timeLeft: Math.max(1, Math.ceil((settlement.nextBet - Date.now()) / 1000)) })), rows: [] };
        if (settlement.insufficientFunds) return { card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (settlement.profile?.wallet || 0).toLocaleString(), bet: betAmount.toLocaleString() })), rows: [] };
        return { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] };
    }
    profile = settlement.profile;

    const guessText = lang.guessNotice({ guess: userGuess.toUpperCase() }).toString();

    const card = buildCard({
        title: lang.title,
        accentColor: won ? ACCENT.success : ACCENT.danger
    })
        .addText(`> **${won ? lang.winSubtitle : lang.loseSubtitle}**\n` + lang.landingNotice({ result: result.toUpperCase(), guessText }))
        .addSeparator()
        .addText(`### ${lang.detailsTitle}`)
        .addText(
            `**💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            (won
                ? `**🎯 ${lang.multiplierLabel}:** \`${multiplier.toFixed(2)}x\`\n**💎 ${lang.winningsLabel}:** \`$${winnings.toLocaleString()}\`\n**📈 ${lang.profitLabel}:** \`+$${profit.toLocaleString()}\``
                : `**💸 ${lang.lossLabel}:** \`-$${betAmount.toLocaleString()}\``) +
            `\n**💳 ${lang.balanceLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\`` +
            (luckMultiplier > 1 ? `\n**🍀 ${lang.luckBonusLabel}:** \`${luckMultiplier.toFixed(2)}x\`` : '')
        );

    const buttons = [];
    if (won && (profile.wallet || 0) > 0) {
        buttons.push(btn.success('cf_deposit_bank', lang.btnDepositBank));
    }
    buttons.push(btn.secondary('cf_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];
    return { card, rows };
}

module.exports = {
    name: 'coinflip',
    aliases: ['flip', 'coin'],
    description: lang.cmdDesc.toString(),
    usage: '!coinflip [bet] [heads/tails]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const profile = await EconomyManager.getProfile(message.author.id, message.guild.id);

            const cooldownCheck = EconomyManager.checkCooldown(profile, 'gambling');
            if (cooldownCheck.onCooldown) {
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ timeLeft: cooldownCheck.timeLeft.seconds })
                ));
            }

            
            if (!args[0]) {
                const guideCard = buildCard({
                    title: lang.title,
                    accentColor: ACCENT.primary
                }).addText(
                    `> **${lang.invalidBetTitle}**\n${lang.invalidBetDesc}\n\n` +
                    `${lang.walletBalance({ wallet: (profile.wallet || 0).toLocaleString() })}`
                );

                const quickRows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('cf_heads_500', lang.btnHeads500),
                        btn.secondary('cf_tails_500', lang.btnTails500),
                        btn.primary('cf_heads_1000', lang.btnHeads1k),
                        btn.secondary('cf_tails_1000', lang.btnTails1k),
                        btn.danger('cf_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: guideCard, rows: quickRows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'cf_close') {
                            collector.stop('user_closed');
                            return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'cf_deposit_bank') {
                            const deposited = await handleCoinflipDeposit(message.author.id, message.guild.id, interaction.message.id);
                            collector.stop('deposited');
                            return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                        }

                        let qBet = 500;
                        let qGuess = 'heads';
                        if (interaction.customId === 'cf_heads_500') { qBet = 500; qGuess = 'heads'; }
                        else if (interaction.customId === 'cf_tails_500') { qBet = 500; qGuess = 'tails'; }
                        else if (interaction.customId === 'cf_heads_1000') { qBet = 1000; qGuess = 'heads'; }
                        else if (interaction.customId === 'cf_tails_1000') { qBet = 1000; qGuess = 'tails'; }

                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        if ((freshProfile.wallet || 0) < qBet) {
                            collector.stop('funds');
                            return editV2(sentMessage, {
                                card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (freshProfile.wallet || 0).toLocaleString(), bet: qBet.toLocaleString() })),
                                rows: []
                            });
                        }

                        const flipRes = await executeFlip(freshProfile, qBet, qGuess, interaction.id, true);
                        return editV2(sentMessage, { card: flipRes.card, rows: flipRes.rows || [] });
                    } catch (err) {
                        console.error('[Coinflip] Collector 1 interaction error:', err);
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

            if (!Number.isSafeInteger(betAmount) || betAmount <= 0 || !Number.isSafeInteger(Math.floor(betAmount * 5))) {
                return sendV2(message, cards.warning(
                    lang.invalidBetTitle,
                    lang.invalidBetDesc
                ));
            }

            if ((profile.wallet || 0) < betAmount) {
                return sendV2(message, cards.warning(
                    lang.insufficientFundsTitle,
                    lang.insufficientFundsDesc({
                        wallet: (profile.wallet || 0).toLocaleString(),
                        bet: betAmount.toLocaleString()
                    })
                ));
            }

            const guess = args[1]?.toLowerCase() || 'heads';
            const validGuesses = ['heads', 'h', 'tails', 't'];
            if (!validGuesses.includes(guess)) {
                return sendV2(message, cards.warning(
                    lang.invalidGuessTitle,
                    lang.invalidGuessDesc({ guess })
                ));
            }

            const flipRes = await executeFlip(profile, betAmount, guess, message.id);
            const sentMessage = await sendV2(message, { card: flipRes.card, rows: flipRes.rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'cf_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'cf_deposit_bank') {
                        const deposited = await handleCoinflipDeposit(message.author.id, message.guild.id, interaction.message.id);
                        collector.stop('deposited');
                        return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                    }
                } catch (err) {
                    console.error('[Coinflip] Collector 2 interaction error:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in coinflip command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
