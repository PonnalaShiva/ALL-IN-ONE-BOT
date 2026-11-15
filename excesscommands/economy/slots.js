'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.slots);

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];

async function executeSpin(profile, betAmount, referenceId, bypassCooldown = false) {

    const reel1 = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    const reel2 = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    const reel3 = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];

    const luckMultiplier = EconomyManager.getGamblingLuck(profile);
    let won = false;
    let winnings = 0;
    let multiplier = 0;
    let winType = '';

    if (reel1 === '7️⃣' && reel2 === '7️⃣' && reel3 === '7️⃣') {
        won = true;
        multiplier = 50.0 * luckMultiplier;
        winType = lang.megaJackpot.toString();
    } else if (reel1 === '💎' && reel2 === '💎' && reel3 === '💎') {
        won = true;
        multiplier = 20.0 * luckMultiplier;
        winType = lang.diamondJackpot.toString();
    } else if (reel1 === '⭐' && reel2 === '⭐' && reel3 === '⭐') {
        won = true;
        multiplier = 10.0 * luckMultiplier;
        winType = lang.starJackpot.toString();
    } else if (reel1 === reel2 && reel2 === reel3) {
        won = true;
        multiplier = 5.0 * luckMultiplier;
        winType = lang.tripleMatch.toString();
    } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
        won = true;
        multiplier = 2.0 * luckMultiplier;
        winType = lang.doubleMatch.toString();
    }

    if (won) {
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
        description: lang.txSlots({ outcome: won ? lang.txWin.toString() : lang.txLoss.toString(), r1: reel1, r2: reel2, r3: reel3 }).toString()
    });
    if (!settlement.success) {
        if (settlement.cooldown) return { card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ seconds: Math.max(1, Math.ceil((settlement.nextBet - Date.now()) / 1000)) })), rows: [] };
        if (settlement.insufficientFunds) return { card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (settlement.profile?.wallet || 0).toLocaleString(), bet: betAmount.toLocaleString() })), rows: [] };
        return { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] };
    }
    profile = settlement.profile;

    const slotDisplay = `[ ${reel1} | ${reel2} | ${reel3} ]`;

    const card = buildCard({
        title: `🎰 ${lang.spinTitle}`,
        accentColor: won ? ACCENT.success : ACCENT.danger
    })
        .addText(
            `> **${slotDisplay}**\n` +
            `> ${won ? winType : lang.noWin}\n` +
            `> ${won ? lang.congratulations : lang.betterLuck}`
        )
        .addSeparator()
        .addText(`### ${won ? `💰 ${lang.winTitle}` : `📊 ${lang.lossTitle}`}`);

    if (won) {
        card.addText(
            `**💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `**🎯 ${lang.multiplierLabel}:** \`${multiplier.toFixed(2)}x\`\n` +
            `**💎 ${lang.winningsLabel}:** \`$${winnings.toLocaleString()}\`\n` +
            `**📈 ${lang.profitLabel}:** \`+$${profit.toLocaleString()}\`\n` +
            `**💳 ${lang.newBalanceLabel}:** \`$${profile.wallet.toLocaleString()}\`` +
            (luckMultiplier > 1 ? `\n**🍀 ${lang.luckBonusLabel}:** \`${luckMultiplier.toFixed(2)}x\`` : '')
        );
    } else {
        card.addText(
            `**💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `**💸 ${lang.lossLabel}:** \`-$${betAmount.toLocaleString()}\`\n` +
            `**💳 ${lang.remainingBalanceLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
            `> 💡 ${lang.slotsTip}`
        );
    }

    card.addSeparator().addText(lang.nextSpinCountdown({ seconds: 30 }));

    const buttons = [];
    if ((profile.wallet || 0) >= betAmount) {
        buttons.push(btn.primary('slots_spin_again', lang.btnSpinAgain({ bet: betAmount.toLocaleString() })));
    }
    if (won && (profile.wallet || 0) > 0) {
        buttons.push(btn.success('slots_deposit_bank', lang.btnDepositBank));
    }
    buttons.push(btn.danger('slots_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];
    return { card, rows };
}

module.exports = {
    name: 'slots',
    aliases: ['slot', 'slotmachine'],
    description: lang.cmdDesc.toString(),
    usage: '!slots <bet>',
    cooldown: 5000,
    async execute(message, args) {
        try {
            const profile = await EconomyManager.getProfile(message.author.id, message.guild.id);

            
            const cooldownCheck = EconomyManager.checkCooldown(profile, 'gambling');
            if (cooldownCheck.onCooldown) {
                const seconds = cooldownCheck.timeLeft?.seconds ?? 30;
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ seconds })
                ));
            }

            
            let betAmount;
            if (args[0] === 'all' || args[0] === 'max') {
                betAmount = profile.wallet || 0;
            } else {
                betAmount = /^\d+$/.test(args[0]) ? Number(args[0]) : NaN;
            }

            if (!Number.isSafeInteger(betAmount) || betAmount <= 0 || !Number.isSafeInteger(Math.floor(betAmount * 125))) {
                return sendV2(message, cards.warning(
                    lang.invalidBetTitle,
                    lang.invalidBetDesc()
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

            
            const result = await executeSpin(profile, betAmount, message.id);
            const sentMessage = await sendV2(message, { card: result.card, rows: result.rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'slots_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'slots_deposit_bank') {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const deposit = await EconomyManager.transferBank({
                            userId: message.author.id, guildId: message.guild.id, direction: 'deposit', amount: 'all',
                            referenceId: `slots-deposit:${interaction.message.id}`,
                            description: lang.txDepositSlots({ amount: (freshProfile.wallet || 0).toLocaleString() }).toString()
                        });
                        const canDeposit = deposit.amount || 0;
                        collector.stop('deposited');
                        return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: canDeposit.toLocaleString() })), rows: [] });
                    }

                    if (interaction.customId === 'slots_spin_again') {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);

                        if ((freshProfile.wallet || 0) < betAmount) {
                            collector.stop('funds');
                            return editV2(sentMessage, {
                                card: cards.warning(
                                    lang.insufficientFundsTitle,
                                    lang.insufficientFundsDesc({
                                        wallet: (freshProfile.wallet || 0).toLocaleString(),
                                        bet: betAmount.toLocaleString()
                                    })
                                ),
                                rows: []
                            });
                        }

                        const spinResult = await executeSpin(freshProfile, betAmount, interaction.id, true);
                        return editV2(sentMessage, { card: spinResult.card, rows: spinResult.rows });
                    }
                } catch (err) {
                    console.error('[Slots] Collector interaction error:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in slots command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
