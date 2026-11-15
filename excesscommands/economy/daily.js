'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.daily);

function buildDailyCard(profile, totalReward, baseReward, streakBonus, roleBonus, notification = null) {
    const streakMsg = profile.dailyStreak === 1
        ? lang.streakFresh
        : lang.streakConsistent({ streak: profile.dailyStreak });

    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.success
    });

    if (notification) {
        card.addText(`> ${notification}`).addSeparator();
    } else {
        card.addText(
            `> **${lang.claimedSubtitle}**\n` +
            `> ${lang.claimedDesc({ amount: totalReward.toLocaleString() })}\n` +
            `> ${streakMsg}`
        ).addSeparator();
    }

    card.addText(`### ${lang.breakdownTitle}`)
        .addText(
            `**💎 ${lang.baseRewardLabel}:** \`$${baseReward.toLocaleString()}\`\n` +
            `**🔥 ${lang.streakBonusLabel}:** \`$${streakBonus.toLocaleString()}\` (${profile.dailyStreak} days)\n` +
            (roleBonus > 0 ? `**👑 ${lang.roleBonusLabel}:** \`$${roleBonus.toLocaleString()}\`\n` : '') +
            `**💰 ${lang.totalRewardLabel}:** \`$${totalReward.toLocaleString()}\`\n` +
            `**⭐ ${lang.xpGainedLabel}:** \`+5 XP\`\n` +
            `**💳 ${lang.walletBalanceLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\``
        )
        .addSeparator()
        .addText(`### ${lang.streakTitle}`)
        .addText(
            `**🔥 ${lang.currentStreakLabel}:** \`${profile.dailyStreak} days\`\n` +
            `**📈 ${lang.nextDayBonusLabel}:** \`$${Math.min((profile.dailyStreak + 1) * 100, 2000)}\`\n` +
            `**🎯 ${lang.maxBonusLabel}:** \`$2,000\`\n\n` +
            (profile.dailyStreak >= 7
                ? `> ${lang.streakMilestone({ streak: profile.dailyStreak })}`
                : `> ${lang.streakTip({ days: 7 - (profile.dailyStreak % 7 || 7) })}`)
        );

    return card;
}

module.exports = {
    name: 'daily',
    aliases: ['claimdaily'],
    description: lang.cmdDesc.toString(),
    usage: '!daily',
    async execute(message) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const claim = await EconomyManager.claimDailyReward(
                userId,
                guildId,
                streak => lang.txDailyReward({ streak }).toString()
            );
            if (!claim.success) {
                if (claim.nextClaim) {
                    const timeLeft = Math.max(0, new Date(claim.nextClaim).getTime() - Date.now());
                    const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
                    const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({
                        hours: hoursLeft,
                        minutes: minutesLeft,
                            streak: claim.streak || 0
                    })
                ));
                }
                return sendV2(message, cards.error(lang.title, lang.errorMessage));
            }

            let profile = claim.profile;
            const { baseReward, streakBonus, roleBonus, totalReward } = claim;

            const initialCard = buildDailyCard(profile, totalReward, baseReward, streakBonus, roleBonus);

            const bankLimit = EconomyManager.getBankLimit(profile);
            const canDeposit = (profile.wallet || 0) > 0 && (profile.bank || 0) < bankLimit;

            const row = new ActionRowBuilder().addComponents(
                btn.success('daily_dep', lang.btnDeposit).setDisabled(!canDeposit),
                btn.danger('daily_close', lang.btnClose)
            );

            const sentMessage = await sendV2(message, {
                card: initialCard,
                rows: [row]
            });

            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async (interaction) => {
                try {    
                    if (interaction.user.id !== message.author.id) {
                        return replyUnauthorized(interaction);
                    }
    
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'daily_dep') {
                        const deposit = await EconomyManager.transferBank({
                            userId, guildId, direction: 'deposit', amount: 'all',
                            referenceId: `daily-deposit:${interaction.id}`,
                            description: lang.txInstantDeposit.toString()});
                    if (deposit.success) {
                        profile = deposit.profile;

                        const updatedCard = buildDailyCard(
                            profile,
                            totalReward,
                            baseReward,
                            streakBonus,
                            roleBonus,
                            lang.depositDone({ amount: deposit.amount.toLocaleString() })
                        );

                        const disabledRow = new ActionRowBuilder().addComponents(
                            btn.success('daily_dep', lang.btnDeposit).setDisabled(true),
                            btn.danger('daily_close', lang.btnClose)
                        );

                        await editV2(sentMessage, {
                            card: updatedCard,
                            rows: [disabledRow]
                        });
                    }
                } else if (interaction.customId === 'daily_close') {
                    collector.stop('closed');
                    return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                }
            
                } catch (err) {
                    console.error('[daily.js] Error in component collector:', err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const disabledRow = new ActionRowBuilder().addComponents(
                    btn.success('daily_dep', lang.btnDeposit).setDisabled(true),
                    btn.danger('daily_close', lang.btnClose).setDisabled(true)
                );
                await editV2(sentMessage, {
                    card: initialCard,
                    rows: [disabledRow]
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in daily command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
