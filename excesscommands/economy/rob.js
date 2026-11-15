'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.rob);

module.exports = {
    name: 'rob',
    aliases: ['steal'],
    description: lang.cmdDesc.toString(),
    usage: '!rob <@user>',
    cooldown: 1800,
    async execute(message, args) {
        try {
            const robberProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
            if (!robberProfile) {
                return sendV2(message, cards.error(
                    lang.profileInaccessibleTitle,
                    lang.profileInaccessibleDesc
                ));
            }

            if (typeof robberProfile.wallet !== 'number') robberProfile.wallet = Number(robberProfile.wallet) || 0;
            if (!robberProfile.cooldowns || typeof robberProfile.cooldowns !== 'object') robberProfile.cooldowns = {};

            
            const cooldownCheck = EconomyManager.checkCooldown(robberProfile, 'robbery');
            if (cooldownCheck.onCooldown) {
                const { minutes, seconds } = cooldownCheck.timeLeft;
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ time: `${minutes}m ${seconds}s` })
                ));
            }

            
            const target = message.mentions.users.first();
            if (!target) {
                return sendV2(message, cards.warning(
                    lang.targetRequiredTitle,
                    lang.targetRequiredDesc
                ));
            }

            if (target.id === message.author.id) {
                return sendV2(message, cards.warning(
                    lang.invalidTargetTitle,
                    lang.cannotRobSelf
                ));
            }

            if (target.bot) {
                return sendV2(message, cards.warning(
                    lang.invalidTargetTitle,
                    lang.cannotRobBot
                ));
            }

            const victimProfile = await EconomyManager.getProfile(target.id, message.guild.id);
            if (!victimProfile) {
                return sendV2(message, cards.warning(
                    lang.targetUnavailableTitle,
                    lang.targetUnavailableDesc({ target: target.username })
                ));
            }

            if (typeof victimProfile.wallet !== 'number') victimProfile.wallet = Number(victimProfile.wallet) || 0;
            if (!Array.isArray(victimProfile.pets)) victimProfile.pets = [];

            if (victimProfile.wallet < 500) {
                return sendV2(message, cards.warning(
                    lang.targetPoorTitle,
                    lang.targetPoorDesc({
                        target: target.username,
                        wallet: victimProfile.wallet.toLocaleString()
                    })
                ));
            }

            const outcome = await EconomyManager.commitRobbery({
                robberId: message.author.id,
                victimId: target.id,
                guildId: message.guild.id,
                referenceId: message.id,
                robberDescription: lang.txRobbedTarget({ target: target.username }).toString(),
                victimDescription: lang.txRobbedBy({ robber: message.author.username }).toString(),
                failureDescription: lang.txFailedRobberyFine.toString()
            });
            if (outcome.onCooldown) {
                const secondsLeft = Math.ceil(outcome.timeLeft / 1000);
                const minutes = Math.floor(secondsLeft / 60);
                const seconds = secondsLeft % 60;
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ time: `${minutes}m ${seconds}s` })
                ));
            }
            if (outcome.targetPoor) {
                return sendV2(message, cards.warning(
                    lang.targetPoorTitle,
                    lang.targetPoorDesc({ target: target.username, wallet: outcome.victimWallet.toLocaleString() })
                ));
            }

            const { success, successChance, security: victimSecurity, stolenAmount, penalty, robberWallet, victimWallet } = outcome;

            if (success) {
                const successCard = buildCard({
                    title: lang.robSuccessTitle,
                    accentColor: ACCENT.success
                })
                    .addText(`### ${lang.heistSummaryHeader}`)
                    .addText(lang.heistSummaryDesc({
                        target: target.username,
                        stolen: stolenAmount.toLocaleString(),
                        odds: successChance.toFixed(1),
                        security: victimSecurity,
                        wallet: robberWallet.toLocaleString()
                    }))
                    .addSeparator()
                    .addText(`### ${lang.consequencesHeader}`)
                    .addText(lang.consequencesDesc);

                
                try {
                    const victimDMCard = buildCard({
                        title: lang.victimAlertTitle,
                        accentColor: ACCENT.danger
                    })
                        .addText(lang.victimAlertIntro({ robber: message.author.username, guild: message.guild.name }))
                        .addSeparator()
                        .addText(`### ${lang.lossDetailsHeader}`)
                        .addText(lang.lossDetailsDesc({
                            stolen: stolenAmount.toLocaleString(),
                            security: victimSecurity,
                            wallet: victimWallet.toLocaleString()
                        }));
                    await sendV2(target, victimDMCard);
                } catch (_) {}

                const rows = [
                    new ActionRowBuilder().addComponents(
                        btn.success('rob_deposit', lang.btnDepositBank),
                        btn.secondary('rob_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: successCard, rows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                try {    
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                        if (interaction.customId === 'rob_close') {
                            collector.stop('user_closed');
                            return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                        }
    
                        if (interaction.customId === 'rob_deposit') {
                            const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                            const bankLimit = EconomyManager.getBankLimit ? EconomyManager.getBankLimit(freshProfile) : (freshProfile.bankLimit || 1000000);
                            const deposit = await EconomyManager.depositWalletToBank({
                                userId: message.author.id,
                                guildId: message.guild.id,
                                maxAmount: stolenAmount,
                                bankLimit,
                                referenceId: `rob-deposit:${message.id}`,
                                description: lang.txDepositLoot({ amount: stolenAmount.toLocaleString() }).toString()});
                        const canDeposit = deposit.amount;
                        collector.stop('deposited');
                        const updatedCard = successCard.addSeparator().addText(`> 🏦 **${lang.depositedAlert({ amount: canDeposit.toLocaleString() })}**`);
                        return editV2(sentMessage, { card: updatedCard, rows: [] });
                    }
                
                } catch (err) {
                    console.error('[rob.js] Error in component collector:', err);
                }
            });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            } else {
                const failureCard = buildCard({
                    title: lang.robFailedTitle,
                    accentColor: ACCENT.danger
                })
                    .addText(`### ${lang.legalSanctionsHeader}`)
                    .addText(lang.legalSanctionsDesc({
                        target: target.username,
                        fine: penalty.toLocaleString(),
                        security: victimSecurity,
                        odds: successChance.toFixed(1),
                        wallet: robberWallet.toLocaleString()
                    }))
                    .addSeparator()
                    .addText(`### ${lang.tacticalGuidanceHeader}`)
                    .addText(lang.tacticalGuidanceDesc);

                const rows = [
                    new ActionRowBuilder().addComponents(btn.secondary('rob_close', lang.btnClose))
                ];

                return sendWithCloseCollector(message, { card: failureCard, rows }, message.author.id);
            }

        } catch (error) {
            console.error('Error in rob command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
