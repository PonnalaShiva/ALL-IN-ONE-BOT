'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { HuntingManager } = require('../../models/economy/huntingManager');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.hunt);

async function executeExpedition(message, args, sentMessage = null) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    let profile = await EconomyManager.getProfile(userId, guildId);

    const attachCollector = (currentMsg) => {
        if (!currentMsg) return;
        const collector = currentMsg.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async (interaction) => {
            try {
                if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                await interaction.deferUpdate();

                if (interaction.customId === 'hunt_close') {
                    collector.stop('user_closed');
                    return closeAndAutoDelete(currentMsg, cards.info(lang.closedTitle, lang.closedDesc));
                }

                if (interaction.customId === 'hunt_heal_self') {
                    const healing = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `hunt-heal:${interaction.id}`, mutate: async current => {
                        const curHp = current.huntingProfile?.currentHealth || 0;
                        const cost = Math.max(0, (100 - curHp) * 50);
                        if (cost <= 0) return { success: false, error: 'already_healed', cost };
                        if ((current.wallet || 0) < cost) return { success: false, error: 'funds', cost };
                        current.wallet -= cost;
                        if (!current.huntingProfile) current.huntingProfile = {};
                        current.huntingProfile.currentHealth = 100;
                        current.transactions.push({ type: 'expense', amount: cost, description: 'Healed hunting injuries', category: 'hunting', timestamp: new Date() });
                        return { cost };
                    } });
                    if (!healing?.success) return editV2(currentMsg, { card: cards.warning(lang.errorTitle, lang.fieldClinicFundsError({ cost: (healing.cost || 0).toLocaleString() })), rows: [new ActionRowBuilder().addComponents(btn.danger('hunt_close', lang.btnClose))] });
                    const freshProfile = healing.profile;
                    const cost = healing.cost;

                    const healedCard = cards.success(lang.fieldClinicTitle, lang.fieldClinicDesc({ cost: cost.toLocaleString(), wallet: freshProfile.wallet.toLocaleString() }));
                    return editV2(currentMsg, { card: healedCard, rows: [new ActionRowBuilder().addComponents(btn.primary('hunt_again', lang.btnHuntAgain), btn.danger('hunt_close', lang.btnClose))] });
                }

                if (interaction.customId === 'hunt_sell_spoils') {
                    const freshProfile = await EconomyManager.getProfile(userId, guildId);
                    const inv = freshProfile.huntingInventory || [];
                    const spoils = inv.filter(i => i.type === 'meat' || i.type === 'pelt');

                    if (spoils.length === 0) {
                        return editV2(currentMsg, { card: cards.info(lang.noSpoilsTitle, lang.noSpoilsDesc), rows: [new ActionRowBuilder().addComponents(btn.primary('hunt_again', lang.btnHuntAgain), btn.danger('hunt_close', lang.btnClose))] });
                    }

                    const sale = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `hunt-sell:${interaction.id}`, mutate: async current => {
                        const ids = new Set(spoils.map(item => item.itemId));
                        const eligible = (current.huntingInventory || []).filter(item => ids.has(item.itemId) && ['meat', 'pelt'].includes(item.type)).map(item => item.itemId);
                        if (!eligible.length) return { success: false, error: 'empty' };
                        const result = await HuntingManager.sellHuntingItems(current, eligible);
                        return { totalVal: result.totalValue, count: result.soldItems.length };
                    } });
                    if (!sale?.success) return editV2(currentMsg, { card: cards.info(lang.noSpoilsTitle, lang.noSpoilsDesc), rows: [new ActionRowBuilder().addComponents(btn.primary('hunt_again', lang.btnHuntAgain), btn.danger('hunt_close', lang.btnClose))] });
                    const soldProfile = sale.profile;
                    const totalVal = sale.totalVal;

                    const sellCard = cards.success(lang.spoilsLiquidatedTitle, lang.spoilsLiquidatedDesc({ count: sale.count, value: totalVal.toLocaleString(), wallet: soldProfile.wallet.toLocaleString() }));
                    return editV2(currentMsg, { card: sellCard, rows: [new ActionRowBuilder().addComponents(btn.primary('hunt_again', lang.btnHuntAgain), btn.danger('hunt_close', lang.btnClose))] });
                }

                if (interaction.customId === 'hunt_again') {
                    collector.stop('again');
                    return executeExpedition(message, args, currentMsg);
                }

                if (interaction.customId === 'hunt_shop') {
                    collector.stop('shop');
                    const huntShopCmd = require('./huntshop');
                    return huntShopCmd.execute(message, []);
                }
            } catch (err) {
                console.error('Error handling hunt interaction:', err);
                editV2(currentMsg, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
            }
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                editV2(currentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
            }
        });
        return currentMsg;
    };

    const cooldownCheck = EconomyManager.checkCooldown(profile, 'hunt');
    if (cooldownCheck.onCooldown) {
        const { minutes, seconds } = cooldownCheck.timeLeft;
        const cdCard = cards.warning(
            lang.cooldownTitle,
            `${lang.cooldownDesc({ minutes, seconds })}\n\n> 💡 *${lang.cooldownWaitHint}*`
        );
        const cdRows = [new ActionRowBuilder().addComponents(
            btn.secondary('hunt_shop', lang.btnShop),
            btn.danger('hunt_close', lang.btnClose)
        )];

        const currentMsg = sentMessage ? await editV2(sentMessage, { card: cdCard, rows: cdRows }) : await sendV2(message, { card: cdCard, rows: cdRows });
        return attachCollector(currentMsg);
    }

    if ((profile.huntingVehicles || []).length === 0 || (profile.huntingWeapons || []).length === 0) {
        const card = buildCard({
            title: lang.missingEquipmentTitle,
            description: lang.missingEquipmentDesc,
            accentColor: ACCENT.danger
        })
            .addSeparator()
            .addText(`${lang.getStartedHeader}\n${lang.getStartedDetails({ wallet: (profile.wallet || 0).toLocaleString() })}`);

        const rows = [
            new ActionRowBuilder().addComponents(
                btn.primary('hunt_shop', lang.btnShop),
                btn.danger('hunt_close', lang.btnClose)
            )
        ];

        const currentMsg = sentMessage ? await editV2(sentMessage, { card, rows }) : await sendV2(message, { card, rows });
        return attachCollector(currentMsg);
    }

    const currentHealth = profile.huntingProfile?.currentHealth || 100;
    if (currentHealth < 20) {
        const healingCost = Math.floor((100 - currentHealth) * 50);
        const canHeal = (profile.wallet || 0) >= healingCost;

        const card = buildCard({
            title: lang.tooInjuredTitle,
            description: lang.tooInjuredDesc({ health: currentHealth, cost: healingCost.toLocaleString() }),
            accentColor: ACCENT.danger
        });

        const rows = [
            new ActionRowBuilder().addComponents(
                btn.success('hunt_heal_self', lang.btnHealSelfWithCost({ cost: healingCost.toLocaleString() })).setDisabled(!canHeal),
                btn.danger('hunt_close', lang.btnClose)
            )
        ];

        const currentMsg = sentMessage ? await editV2(sentMessage, { card, rows }) : await sendV2(message, { card, rows });
        return attachCollector(currentMsg);
    }

    const useBusinessFunds = args[0]?.toLowerCase() === 'fund';
    let businessFundsUsed = 0;

    if (useBusinessFunds && (profile.businesses || []).length > 0) {
        const businessResult = await EconomyManager.collectBusinessIncome(userId, guildId, `hunt-business:${message.id}`);

        if (businessResult.totalProfit > 0) {
            businessFundsUsed = businessResult.totalProfit;
            profile = businessResult.profile;
        }
    }

    const settlement = await EconomyManager.mutateProfileAtomically({
        userId, guildId, referenceId: `hunt:${message.id}`,
        mutate: async current => {
            if (!current.cooldowns) current.cooldowns = {};
            const cooldown = EconomyManager.checkCooldown(current, 'hunt');
            if (cooldown.onCooldown) return { success: false, error: 'cooldown' };
            let huntResult;
            try { huntResult = await HuntingManager.executeHunt(current); }
            catch (error) { return { success: false, error: error.message }; }
            const totalCosts = Object.values(huntResult.costs || {}).reduce((sum, cost) => sum + cost, 0);
            if ((current.wallet || 0) < totalCosts) return { success: false, error: `Not enough wallet funds to cover the expedition's $${totalCosts.toLocaleString()} medical and repair costs.` };
            if (!current.huntingStats) current.huntingStats = { totalHunts: 0, successfulHunts: 0, failedHunts: 0, totalEarnings: 0, animalsKilled: 0 };
            current.huntingStats.totalHunts = (current.huntingStats.totalHunts || 0) + 1;
            if (huntResult.success) {
                current.huntingStats.successfulHunts = (current.huntingStats.successfulHunts || 0) + 1;
                current.huntingStats.animalsKilled = (current.huntingStats.animalsKilled || 0) + 1;
                if (!Array.isArray(current.huntingInventory)) current.huntingInventory = [];
                (huntResult.loot || []).forEach(item => current.huntingInventory.push(item));
            } else current.huntingStats.failedHunts = (current.huntingStats.failedHunts || 0) + 1;
            if (!current.huntingProfile) current.huntingProfile = { currentHealth: 100 };
            current.huntingProfile.currentHealth = Math.max(0, (current.huntingProfile.currentHealth || 100) - (huntResult.damageTaken || 0));
            current.experience = (current.experience || 0) + (huntResult.experience || 0);
            current.huntingStats.huntingSkill = Math.min(100, (current.huntingStats.huntingSkill || 0) + (huntResult.skillGain || 0));
            if (totalCosts > 0) {
                current.wallet -= totalCosts;
                current.transactions.push({ type: 'expense', amount: totalCosts, description: lang.txExpeditionCosts.toString(), category: 'hunting', timestamp: new Date() });
            } else current.transactions.push({ type: 'shop', amount: 0, description: 'Hunting expedition completed', category: 'hunting', timestamp: new Date() });
            if (!current.cooldowns) current.cooldowns = {};
            current.cooldowns.hunt = new Date();
            return { huntResult, totalCosts };
        }
    });
    if (!settlement?.success) {
        const errorCard = settlement?.error === 'cooldown'
            ? cards.warning(lang.cooldownTitle, lang.cooldownDesc({ minutes: 0, seconds: 5 }))
            : cards.warning(lang.missingEquipmentTitle, settlement?.error || lang.missingEquipmentDesc);
        if (sentMessage) return editV2(sentMessage, { card: errorCard, rows: [new ActionRowBuilder().addComponents(btn.secondary('hunt_shop', lang.btnShop), btn.danger('hunt_close', lang.btnClose))] });
        return sendV2(message, errorCard);
    }
    profile = settlement.profile;
    const { huntResult, totalCosts } = settlement;

    const fundingText = businessFundsUsed > 0 ?
        lang.businessFundingTag({ amount: businessFundsUsed.toLocaleString() }) : '';

    const localizedAnimal = resolveEntity('hunting_animals', huntResult.animal.id || huntResult.animal.type, huntResult.animal);

    const card = buildCard({
        title: huntResult.success ? lang.successTitle : lang.failedTitle,
        description: huntResult.success ?
            `${lang.successDesc({ animal: localizedAnimal.name, tier: huntResult.animal.tier })}${fundingText}` :
            lang.failedDesc({ animal: localizedAnimal.name }),
        accentColor: huntResult.success ? ACCENT.success : ACCENT.danger
    });

    card.addSeparator().addText(
        `### ⚔️ ${lang.combatTitle}\n` +
        `> **${lang.combatDealt}:** \`${huntResult.damageDealt}\`\n` +
        `> **${lang.combatTaken}:** \`${huntResult.damageTaken}\`\n` +
        `> **${lang.healthRemaining}:** \`${profile.huntingProfile.currentHealth}/100\`\n` +
        `> **${lang.expGained}:** \`+${huntResult.experience} XP\` • **${lang.skillGained}:** \`+${huntResult.skillGain}%\` (\`${profile.huntingStats.huntingSkill}%\`)`
    );

    const hasSpoils = huntResult.loot && huntResult.loot.some(i => i.type === 'meat' || i.type === 'pelt');
    if (huntResult.success && huntResult.loot && huntResult.loot.length > 0) {
        const lootText = huntResult.loot.slice(0, 5).map(item => {
            const locItem = resolveEntity('items', item.itemId, item);
            return lang.lootItemLine({
                name: locItem.name,
                rarity: item.rarity,
                value: item.currentValue.toLocaleString(),
                type: item.type
            });
        }).join('\n');

        const extraLoot = huntResult.loot.length > 5 ? lang.moreLoot({ count: huntResult.loot.length - 5 }) : '';

        card.addSeparator().addText(
            `### 💎 ${lang.lootTitle}\n${lootText}${extraLoot}`
        );
    }

    if (totalCosts > 0) {
        const costBreakdown = Object.entries(huntResult.costs)
            .filter(([_, value]) => value > 0)
            .map(([key, value]) => lang.costItemLine({ key: key.replace('_', ' ').toUpperCase(), cost: value.toLocaleString() }))
            .join('\n');

        card.addSeparator().addText(
            `### 💸 ${lang.costsTitle}\n${costBreakdown}\n` +
            lang.totalCostsLine({ total: totalCosts.toLocaleString(), wallet: (profile.wallet || 0).toLocaleString() })
        );
    }

    const buttons = [
        btn.primary('hunt_again', lang.btnHuntAgain)
    ];

    if (hasSpoils) {
        buttons.push(btn.success('hunt_sell_spoils', lang.btnSellSpoils));
    }
    buttons.push(btn.danger('hunt_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];

    let currentMsg;
    if (sentMessage) {
        currentMsg = await editV2(sentMessage, { card, rows });
    } else {
        currentMsg = await sendV2(message, { card, rows });
    }
    return attachCollector(currentMsg);
}

module.exports = {
    name: 'hunt',
    aliases: ['expedition', 'safari'],
    description: 'Go on a hunting expedition with localized wildlife and seamless loop actions',
    usage: '!hunt [fund]',
    cooldown: 5000,
    async execute(message, args) {
        try {
            await executeExpedition(message, args);
        } catch (error) {
            console.error('Error in hunt command:', error);
            return sendV2(message, cards.error(lang.errorTitle, error.message || lang.errorMessage));
        }
    }
};
