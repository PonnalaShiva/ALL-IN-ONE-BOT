'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.weekly);

const WEEKLY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function buildWeeklyCard(profile, totalReward, baseReward, levelBonus, familyBonus, workMultiplier, roleBonus, bonusSources, notification = null) {
    const totalNetWorth = (profile.wallet || 0) + (profile.bank || 0) + (profile.familyVault || 0);

    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.economy
    });

    if (notification) {
        card.addText(`> ${notification}`).addSeparator();
    } else {
        card.addText(
            `> **${lang.subtitleClaimed}**\n` +
            `> ${lang.claimedDesc({ amount: totalReward.toLocaleString() })}`
        ).addSeparator();
    }

    card.addText(`### ${lang.breakdownTitle}`)
        .addText(
            `**💎 ${lang.baseLabel}:** \`$${baseReward.toLocaleString()}\`\n` +
            `**🏆 ${lang.levelBonusLabel}:** \`$${levelBonus.toLocaleString()}\` (Level ${profile.level || 1})\n` +
            `**👨‍👩‍👧‍👦 ${lang.familyBonusLabel}:** \`$${familyBonus.toLocaleString()}\` (${profile.familyBond || 0}% bond)\n` +
            `**📈 ${lang.multiplierLabel}:** \`${workMultiplier.toFixed(2)}x\`` +
            (roleBonus > 0 ? `\n**👑 ${lang.roleBonusLabel}:** \`$${roleBonus.toLocaleString()}\`` : '') +
            `\n**💰 ${lang.totalLabel}:** \`$${totalReward.toLocaleString()}\`\n` +
            `**⭐ ${lang.xpLabel}:** \`+25 XP\`\n` +
            `**💳 ${lang.walletLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\`\n` +
            `**📊 ${lang.netWorthLabel}:** \`$${totalNetWorth.toLocaleString()}\``
        );

    if (bonusSources.length > 0) {
        card.addSeparator()
            .addText(`**⚡ ${lang.bonusSourcesLabel}:** ${bonusSources.join(', ')}\n> ${lang.investmentsPayingDividends}`);
    }

    if ((profile.familyMembers || []).length > 0) {
        card.addSeparator()
            .addText(`### ${lang.familyTitle}`)
            .addText(
                `**💞 ${lang.familyBondLabel}:** \`${profile.familyBond || 0}%\`\n` +
                `**👥 ${lang.familyMembersLabel}:** \`${profile.familyMembers.length}\`\n` +
                `> ${lang.streakTip}`
            );
    }

    return card;
}

module.exports = {
    name: 'weekly',
    aliases: ['week', 'claimweekly'],
    description: lang.cmdDesc.toString(),
    usage: '!weekly',
    async execute(message) {
        try {
            const userId  = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            const now = new Date();

            if (profile.cooldowns?.weekly && now - new Date(profile.cooldowns.weekly) < WEEKLY_COOLDOWN_MS) {
                const remaining = WEEKLY_COOLDOWN_MS - (now - new Date(profile.cooldowns.weekly));
                const days      = Math.floor(remaining / (24 * 60 * 60 * 1000));
                const hours     = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                const minutes   = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
                const nextDate  = new Date(now.getTime() + remaining).toLocaleDateString();

                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ days, hours, minutes, nextDate })
                ));
            }

            const settlement = await EconomyManager.mutateProfileAtomically({
                userId, guildId, referenceId: `weekly:${message.id}`,
                mutate: async current => {
                    if (!current.cooldowns) current.cooldowns = {};
                    const lastClaim = current.cooldowns.weekly ? new Date(current.cooldowns.weekly).getTime() : 0;
                    if (Date.now() - lastClaim < WEEKLY_COOLDOWN_MS) return { success: false, error: 'cooldown' };
                    const baseReward = 3000;
                    const levelBonus = (current.level || 1) * 100;
                    const familyBonus = Math.floor(((current.familyBond || 0) / 100) * 1000);
                    const workMultiplier = EconomyManager.calculateWorkMultiplier(current);
                    let roleBonus = 0;
                    (current.purchasedRoles || []).forEach(role => { if (!role.expiryDate || new Date(role.expiryDate) > now) roleBonus += (role.benefits?.workMultiplier || 0) * 500; });
                    const totalReward = Math.floor((baseReward + levelBonus + familyBonus) * workMultiplier) + roleBonus;
                    current.wallet = (current.wallet || 0) + totalReward;
                    current.cooldowns.weekly = now;
                    current.experience = (current.experience || 0) + 25;
                    current.transactions.push({ type: 'income', amount: totalReward, description: lang.txWeeklyReward({ level: current.level || 1, bond: current.familyBond || 0 }).toString(), category: 'reward', timestamp: now });
                    return { totalReward, baseReward, levelBonus, familyBonus, workMultiplier, roleBonus };
                }
            });
            if (!settlement?.success) return sendV2(message, cards.warning(lang.cooldownTitle, lang.cooldownDesc({ days: 7, hours: 0, minutes: 0, nextDate: new Date(Date.now() + WEEKLY_COOLDOWN_MS).toLocaleDateString() })));
            profile = settlement.profile;
            const { totalReward, baseReward, levelBonus, familyBonus, workMultiplier, roleBonus } = settlement;

            const bonusSources = [];
            if ((profile.familyMembers || []).length > 0 && (profile.properties || []).length > 0) {
                bonusSources.push(`Family Support (+${(((profile.familyBond || 0) / 100) * 0.5 * 100).toFixed(1)}%)`);
            }
            const activeRoles = (profile.purchasedRoles || []).filter(r => !r.expiryDate || new Date(r.expiryDate) > now);
            if (activeRoles.length > 0) bonusSources.push(`Active Roles (${activeRoles.length})`);

            const initialCard = buildWeeklyCard(profile, totalReward, baseReward, levelBonus, familyBonus, workMultiplier, roleBonus, bonusSources);

            const bankLimit = EconomyManager.getBankLimit(profile);
            const canDeposit = (profile.wallet || 0) > 0 && (profile.bank || 0) < bankLimit;

            const row = new ActionRowBuilder().addComponents(
                btn.success('weekly_dep', lang.btnDeposit).setDisabled(!canDeposit),
                btn.danger('weekly_close', lang.btnClose)
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
    
                    if (interaction.customId === 'weekly_dep') {
                        const transfer = await EconomyManager.transferBank({ userId, guildId, direction: 'deposit', amount: 'all', referenceId: `weekly-deposit:${sentMessage.id}`, description: lang.txInstantDeposit.toString() });
                        profile = transfer.profile || await EconomyManager.getProfile(userId, guildId);
                        const depAmount = transfer.success ? transfer.amount : 0;
    
                        if (depAmount > 0) {
                            const updatedCard = buildWeeklyCard(
                                profile,
                                totalReward,
                                baseReward,
                                levelBonus,
                                familyBonus,
                                workMultiplier,
                                roleBonus,
                                bonusSources,
                                lang.depositDone({ amount: depAmount.toLocaleString() })
                            );
    
                            const disabledRow = new ActionRowBuilder().addComponents(
                                btn.success('weekly_dep', lang.btnDeposit).setDisabled(true),
                                btn.danger('weekly_close', lang.btnClose)
                            );
    
                            await editV2(sentMessage, {
                                card: updatedCard,
                                rows: [disabledRow]});
                    }
                } else if (interaction.customId === 'weekly_close') {
                    collector.stop('closed');
                    return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                }
            
                } catch (err) {
                    console.error('[weekly.js] Error in component collector:', err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const disabledRow = new ActionRowBuilder().addComponents(
                    btn.success('weekly_dep', lang.btnDeposit).setDisabled(true),
                    btn.danger('weekly_close', lang.btnClose).setDisabled(true)
                );
                await editV2(sentMessage, {
                    card: initialCard,
                    rows: [disabledRow]
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in weekly command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
