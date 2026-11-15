'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.beg);

module.exports = {
    name: 'beg',
    aliases: ['ask', 'plead'],
    description: lang.cmdDesc.toString(),
    usage: '!beg',
    async execute(message) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            const now = new Date();
            const cooldown = 10 * 60 * 1000;

            if (profile.cooldowns?.beg && now - new Date(profile.cooldowns.beg) < cooldown) {
                const remaining = cooldown - (now - new Date(profile.cooldowns.beg));
                const remainingMinutes = Math.ceil(remaining / (60 * 1000));

                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ minutes: remainingMinutes })
                ));
            }

            const successOutcomes = [
                { min: 30,  max: 80,  text: lang.outcome1 },
                { min: 50,  max: 120, text: lang.outcome2 },
                { min: 20,  max: 60,  text: lang.outcome3 },
                { min: 80,  max: 150, text: lang.outcome4 }
            ];

            const failOutcomes = [
                lang.failOutcome1,
                lang.failOutcome2,
                lang.failOutcome3
            ];

            const isSuccess = Math.random() < 0.70; 
            let baseEarnings = 0;
            let outcomeMessage = '';

            if (isSuccess) {
                const picked = successOutcomes[Math.floor(Math.random() * successOutcomes.length)];
                baseEarnings = Math.floor(Math.random() * (picked.max - picked.min + 1)) + picked.min;
                outcomeMessage = picked.text;
            } else {
                outcomeMessage = failOutcomes[Math.floor(Math.random() * failOutcomes.length)];
            }

            const settlement = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `beg:${message.id}`, mutate: async current => {
                if (!current.cooldowns) current.cooldowns = {};
                const lastBeg = current.cooldowns.beg ? new Date(current.cooldowns.beg).getTime() : 0;
                if (Date.now() - lastBeg < cooldown) return { success: false, error: 'cooldown' };
                const levelBonus = isSuccess ? Math.floor((current.level || 1) * 2) : 0;
                const earnings = isSuccess ? baseEarnings + levelBonus : 0;
                current.wallet = (current.wallet || 0) + earnings;
                current.cooldowns.beg = new Date();
                if (earnings > 0) {
                    current.experience = (current.experience || 0) + 5;
                    current.transactions.push({ type: 'income', amount: earnings, description: lang.txBeggingEarnings.toString(), category: 'begging', timestamp: new Date() });
                } else current.transactions.push({ type: 'shop', amount: 0, description: 'Begging attempt yielded no money', category: 'begging', timestamp: new Date() });
                return { earnings, levelBonus };
            } });
            if (!settlement?.success) return sendV2(message, cards.warning(lang.cooldownTitle, lang.cooldownDesc({ minutes: 10 })));
            profile = settlement.profile;
            const { earnings, levelBonus } = settlement;

            if (earnings > 0) {
                const card = buildCard({
                    title: lang.successTitle,
                    accentColor: ACCENT.success
                })
                    .addText(`> ${outcomeMessage}`)
                    .addSeparator()
                    .addText(
                        `**💰 ${lang.earningsLabel}:** \`+$${earnings.toLocaleString()}\`\n` +
                        `**💳 ${lang.walletLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
                        `**🎯 ${lang.xpLabel}:** \`+5 XP\`\n` +
                        `**📈 ${lang.levelLabel}:** \`${profile.level || 1}\``
                    );

                if (levelBonus > 0) {
                    card.addSeparator()
                        .addText(`> **🆙 ${lang.levelBonusLabel}:** ${lang.levelBonusInfo({ level: profile.level || 1, bonus: levelBonus, base: earnings - levelBonus })}`);
                }

                const bankLimit = EconomyManager.getBankLimit(profile);
                const canDeposit = (profile.wallet || 0) > 0 && (profile.bank || 0) < bankLimit;

                const row = new ActionRowBuilder().addComponents(
                    btn.success('beg_dep', lang.btnDeposit).setDisabled(!canDeposit),
                    btn.danger('beg_close', lang.btnClose)
                );

                const sentMessage = await sendV2(message, {
                    card,
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
    
                        if (interaction.customId === 'beg_dep') {
                            const transfer = await EconomyManager.transferBank({ userId, guildId, direction: 'deposit', amount: 'all', referenceId: `beg-deposit:${sentMessage.id}`, description: lang.txInstantDeposit.toString() });
                            profile = transfer.profile || await EconomyManager.getProfile(userId, guildId);
                            const depAmount = transfer.success ? transfer.amount : 0;
    
                            if (depAmount > 0) {
    
                                const updatedCard = buildCard({
                                    title: lang.successTitle,
                                    accentColor: ACCENT.success
                                })
                                    .addText(`> ${lang.depositDone({ amount: depAmount.toLocaleString() })}`)
                                    .addSeparator()
                                    .addText(
                                        `**💰 ${lang.earningsLabel}:** \`+$${earnings.toLocaleString()}\`\n` +
                                        `**💳 ${lang.walletLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
                                        `**🏦 Bank:** \`$${profile.bank.toLocaleString()}\``
                                    );
    
                                const disabledRow = new ActionRowBuilder().addComponents(
                                    btn.success('beg_dep', lang.btnDeposit).setDisabled(true),
                                    btn.danger('beg_close', lang.btnClose)
                                );
    
                                await editV2(sentMessage, {
                                    card: updatedCard,
                                    rows: [disabledRow]});
                        }
                    } else if (interaction.customId === 'beg_close') {
                        collector.stop('closed');
                        return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }
                
                } catch (err) {
                    console.error('[beg.js] Error in component collector:', err);
                }
            });

                collector.on('end', async (_, reason) => {
                    if (reason === 'closed') return;
                    const disabledRow = new ActionRowBuilder().addComponents(
                        btn.success('beg_dep', lang.btnDeposit).setDisabled(true),
                        btn.danger('beg_close', lang.btnClose).setDisabled(true)
                    );
                    await editV2(sentMessage, {
                        card,
                        rows: [disabledRow]
                    }).catch(() => {});
                });

            } else {
                const card = buildCard({
                    title: lang.failedTitle,
                    accentColor: ACCENT.warning
                })
                    .addText(`> ${outcomeMessage}`)
                    .addSeparator()
                    .addText(
                        `**💸 ${lang.earningsLabel}:** \`$0\`\n` +
                        `**💳 ${lang.walletLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
                        `> ${lang.tryAgainLater}`
                    );

                const row = new ActionRowBuilder().addComponents(
                    btn.danger('beg_close', lang.btnClose)
                );

                const sentMessage = await sendV2(message, {
                    card,
                    rows: [row]
                });

                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 30000
                });

                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) {
                            return replyUnauthorized(interaction);
                        }
                        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
                        if (interaction.customId === 'beg_close') {
                            collector.stop('closed');
                            return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                        }
                    } catch (err) {
                        console.error('Error in beg failure collector:', err);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
            }
        } catch (error) {
            console.error('Error in beg command:', error);
            return sendV2(message, cards.error(lang.errorTitle, rawLang.economy?.common?.errorMessage || 'Something went wrong. Please try again.'));
        }
    }
};
