'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { HuntingManager } = require('../../models/economy/huntingManager');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.lootbox);

const RARITY_EMOJIS = {
    common: '⚪',
    uncommon: '🟢',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟡',
    mythic: '🔴'
};

async function executeOpenAll(profile, referenceId) {
    const inventory = profile.huntingInventory || [];
    const lootBoxes = inventory.filter(item => item.type === 'loot_box');

    if (lootBoxes.length === 0) {
        return {
            error: 'none',
            card: cards.warning(lang.noBoxesTitle, lang.noBoxesDesc)
        };
    }

    const mutation = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId,
        guildId: profile.guildId,
        referenceId,
        mutate: async current => {
            const boxes = (current.huntingInventory || []).filter(item => item.type === 'loot_box');
            if (!boxes.length) return { success: false, error: 'none' };
            const totalRewards = { money: 0, items: [] };
            for (const box of boxes) {
                const rewards = HuntingManager.openLootBox ? HuntingManager.openLootBox(box) : [];
                rewards.forEach(reward => {
                    if (reward.type === 'money' || reward.type === 'cash') totalRewards.money += reward.amount || 0;
                    else totalRewards.items.push(reward);
                });
                const index = current.huntingInventory.findIndex(item => item.itemId === box.itemId);
                if (index >= 0) current.huntingInventory.splice(index, 1);
            }
            if (totalRewards.money > 0) current.wallet = (current.wallet || 0) + totalRewards.money;
            for (const item of totalRewards.items) current.huntingInventory.push({
                itemId: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: item.name || item.type, type: item.type, quantity: item.amount || 1,
                currentValue: item.currentValue || 100, rarity: item.rarity || 'common', acquiredAt: new Date()
            });
            if (!current.huntingStats) current.huntingStats = {};
            current.huntingStats.lootBoxesOpened = (current.huntingStats.lootBoxesOpened || 0) + boxes.length;
            if (!Array.isArray(current.transactions)) current.transactions = [];
            current.transactions.push({ type: totalRewards.money > 0 ? 'income' : 'shop', amount: totalRewards.money, description: lang.txBulkOpened({ count: boxes.length }).toString(), category: 'hunting', timestamp: new Date() });
            return { totalRewards, openedBoxesCount: boxes.length };
        }
    });
    if (!mutation?.success) return { error: mutation?.duplicate ? 'duplicate' : 'none', card: cards.warning(lang.noBoxesTitle, lang.noBoxesDesc) };
    profile = mutation.profile;
    const { totalRewards, openedBoxesCount } = mutation;

    let rewardsSummary = lang.bulkRewardDetails({
        count: openedBoxesCount,
        money: totalRewards.money.toLocaleString(),
        itemsCount: totalRewards.items.length,
        wallet: profile.wallet.toLocaleString()
    });

    if (totalRewards.items.length > 0) {
        const itemPreview = totalRewards.items.slice(0, 5).map(i => `• **${(i.name || i.type).replace('_', ' ')}** ×\`${i.amount || 1}\``).join('\n');
        rewardsSummary += `\n\n### 📦 ${lang.topItemsTitle}\n${itemPreview}`;
        if (totalRewards.items.length > 5) {
            rewardsSummary += `\n*${lang.moreItems({ count: totalRewards.items.length - 5 })}*`;
        }
    }

    const bulkOpenCard = buildCard({
        title: lang.allOpenedTitle,
        accentColor: ACCENT.success
    })
        .addText(`### 💎 ${lang.totalRewardsTitle}\n${rewardsSummary}`);

    const buttons = [];
    if (totalRewards.money > 0) {
        buttons.push(btn.success(`lootbox_deposit_${totalRewards.money}`, lang.btnDepositBank));
    }
    buttons.push(btn.secondary('lootbox_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];
    return { success: true, card: bulkOpenCard, rows };
}

async function executeOpenSingle(profile, itemId, referenceId) {
    const inventory = profile.huntingInventory || [];
    let lootBox = inventory.find(item =>
        item.itemId === itemId && item.type === 'loot_box'
    );

    if (!lootBox) {
        lootBox = inventory.find(item =>
            item.itemId.endsWith(itemId) && item.type === 'loot_box'
        );
    }

    if (!lootBox) {
        return {
            error: 'not_found',
            card: cards.warning(
                lang.notFoundTitle,
                lang.notFoundDesc({ id: itemId })
            )
        };
    }

    const mutation = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId,
        guildId: profile.guildId,
        referenceId,
        mutate: async current => {
            const currentBox = (current.huntingInventory || []).find(item => item.itemId === lootBox.itemId && item.type === 'loot_box');
            if (!currentBox) return { success: false, error: 'not_found' };
            const rewards = HuntingManager.openLootBox ? HuntingManager.openLootBox(currentBox) : [];
            current.huntingInventory.splice(current.huntingInventory.indexOf(currentBox), 1);
            const totalMoney = rewards.filter(r => r.type === 'money' || r.type === 'cash').reduce((sum, r) => sum + (r.amount || 0), 0);
            const rewardItems = rewards.filter(r => r.type !== 'money' && r.type !== 'cash');
            if (totalMoney > 0) current.wallet = (current.wallet || 0) + totalMoney;
            for (const item of rewardItems) current.huntingInventory.push({
                itemId: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: item.name || item.type, type: item.type, quantity: item.amount || 1,
                currentValue: item.currentValue || 100, rarity: item.rarity || 'common', acquiredAt: new Date()
            });
            if (!current.huntingStats) current.huntingStats = {};
            current.huntingStats.lootBoxesOpened = (current.huntingStats.lootBoxesOpened || 0) + 1;
            if (!Array.isArray(current.transactions)) current.transactions = [];
            current.transactions.push({ type: totalMoney > 0 ? 'income' : 'shop', amount: totalMoney, description: lang.txSingleOpened({ name: currentBox.name }).toString(), category: 'hunting', timestamp: new Date() });
            return { totalMoney, rewardItems, lootBox: { name: currentBox.name, rarity: currentBox.rarity }, empty: rewards.length === 0 };
        }
    });
    if (!mutation?.success) return { error: 'not_found', card: cards.warning(lang.notFoundTitle, lang.notFoundDesc({ id: itemId })) };
    profile = mutation.profile;
    const { totalMoney, rewardItems, lootBox: openedBox, empty } = mutation;
    if (empty) return { error: 'empty', card: cards.warning(lang.emptyBoxTitle, lang.emptyBoxDesc({ name: openedBox.name })) };

    let cashLine = totalMoney > 0 ? `> **${lang.cashEarnedLabel}:** \`$${totalMoney.toLocaleString()}\`\n` : '';
    let itemsBlock = '';
    if (rewardItems.length > 0) {
        const itemLines = rewardItems.map(item => `• **${(item.name || item.type).replace('_', ' ')}** ×\`${item.amount || 1}\``).join('\n');
        itemsBlock = `\n### 📦 ${lang.topItemsTitle}\n${itemLines}\n\n`;
    }

    const singleOpenCard = buildCard({
        title: lang.openedTitle({ name: openedBox.name }),
        accentColor: ACCENT.success
    })
        .addText(`### 💎 ${lang.rewardsTitle}\n${lang.singleRewardDetails({
            name: openedBox.name,
            rarity: openedBox.rarity,
            cashLine,
            itemsBlock,
            wallet: (profile.wallet || 0).toLocaleString()
        })}`);

    const buttons = [];
    if (totalMoney > 0) {
        buttons.push(btn.success(`lootbox_deposit_${totalMoney}`, lang.btnDepositBank));
    }
    buttons.push(btn.secondary('lootbox_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];
    return { success: true, card: singleOpenCard, rows };
}

module.exports = {
    name: 'lootbox',
    aliases: ['openlootbox', 'openbox', 'loot'],
    description: lang.cmdDesc.toString(),
    usage: '!lootbox | !lootbox <item_id> | !lootbox all',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const profile = await EconomyManager.getProfile(userId, message.guild.id);
            const inventory = profile.huntingInventory || [];

            const attachReceiptCollector = (sentMsg) => {
                if (!sentMsg) return;
                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'lootbox_close') {
                            collector.stop('user_closed');
                            return closeAndAutoDelete(sentMsg, cards.info(lang.closedTitle, lang.closedDesc));
                        }

                        if (interaction.customId.startsWith('lootbox_deposit_')) {
                            const depositAmt = parseInt(interaction.customId.replace('lootbox_deposit_', ''), 10) || 0;
                            const transfer = depositAmt > 0 ? await EconomyManager.transferBank({ userId, guildId: message.guild.id, direction: 'deposit', amount: depositAmt, referenceId: `lootbox-deposit:${sentMsg.id}`, description: 'Deposited lootbox reward' }) : { success: false };
                            const freshProfile = transfer.profile || await EconomyManager.getProfile(userId, message.guild.id);
                            const canDeposit = transfer.success ? transfer.amount : 0;
                            collector.stop('deposited');
                            return editV2(sentMsg, {
                                card: cards.success(lang.title, `> 🏦 **Deposited $${canDeposit.toLocaleString()} into your bank!**\n> Bank Balance: $${(freshProfile.bank || 0).toLocaleString()}`),
                                rows: []
                            });
                        }
                    } catch (err) {
                        console.error('Error in direct lootbox collector:', err);
                    }
                });
                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
            };

            
            if (args[0]?.toLowerCase() === 'all') {
                const result = await executeOpenAll(profile, `lootbox:${message.id}:all`);
                if (result.rows) {
                    const sentMsg = await sendV2(message, { card: result.card, rows: result.rows });
                    attachReceiptCollector(sentMsg);
                    return sentMsg;
                }
                return sendV2(message, result.card);
            }

            
            if (args[0]) {
                const result = await executeOpenSingle(profile, args[0], `lootbox:${message.id}:${args[0]}`);
                if (result.rows) {
                    const sentMsg = await sendV2(message, { card: result.card, rows: result.rows });
                    attachReceiptCollector(sentMsg);
                    return sentMsg;
                }
                return sendV2(message, result.card);
            }

            
            const lootBoxes = inventory.filter(item => item.type === 'loot_box');

            if (lootBoxes.length === 0) {
                const emptyCard = buildCard({
                    title: lang.noBoxesTitle,
                    accentColor: ACCENT.warning
                })
                    .addText(`> ${lang.noBoxesDesc}`);

                const rows = [new ActionRowBuilder().addComponents(btn.secondary('lootbox_close', lang.btnClose))];
                return sendWithCloseCollector(message, { card: emptyCard, rows }, userId);
            }

            const boxesText = lootBoxes.slice(0, 8).map(box => {
                const emoji = RARITY_EMOJIS[box.rarity] || '📦';
                return lang.boxItemLine({
                    emoji,
                    name: box.name,
                    rarity: box.rarity,
                    id: box.itemId.slice(-8),
                    value: (box.currentValue || 0).toLocaleString()
                });
            }).join('\n\n');

            const overflowText = lootBoxes.length > 8 ? `\n\n*${lang.moreBoxes({ count: lootBoxes.length - 8 })}*` : '';

            const listCard = buildCard({
                title: lang.userBoxesTitle({ count: lootBoxes.length }),
                accentColor: ACCENT.primary
            })
                .addText(`> ${lang.userBoxesDesc}\n`)
                .addSeparator()
                .addText(`### 🎁 ${lang.availableBoxesTitle}\n\n${boxesText}${overflowText}`)
                .addSeparator()
                .addText(`### 💡 ${lang.tipTitle}\n${lang.boxCommandsTip}`);

            const buttons = [
                btn.success('lootbox_open_all', lang.btnOpenAll),
                btn.danger('lootbox_close', lang.btnClose)
            ];

            const rows = [new ActionRowBuilder().addComponents(buttons)];
            const sentMessage = await sendV2(message, { card: listCard, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'lootbox_close') {
                        collector.stop('user_closed');
                        return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }

                    if (interaction.customId.startsWith('lootbox_deposit_')) {
                        const depositAmt = parseInt(interaction.customId.replace('lootbox_deposit_', ''), 10) || 0;
                        const transfer = depositAmt > 0 ? await EconomyManager.transferBank({ userId, guildId: message.guild.id, direction: 'deposit', amount: depositAmt, referenceId: `lootbox-deposit:${sentMessage.id}`, description: 'Deposited lootbox reward' }) : { success: false };
                        const freshProfile = transfer.profile || await EconomyManager.getProfile(userId, message.guild.id);
                        const canDeposit = transfer.success ? transfer.amount : 0;
                        collector.stop('deposited');
                        return editV2(sentMessage, {
                            card: cards.success(lang.title, `> 🏦 **Deposited $${canDeposit.toLocaleString()} into your bank!**\n> Bank Balance: $${(freshProfile.bank || 0).toLocaleString()}`),
                            rows: []
                        });
                    }

                    if (interaction.customId === 'lootbox_open_all') {
                        const freshProfile = await EconomyManager.getProfile(userId, message.guild.id);
                        const result = await executeOpenAll(freshProfile, `lootbox:${interaction.id}:all`);
                        const receiptRows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('lootbox_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows: receiptRows });
                    }
                } catch (err) {
                    console.error('Error in lootbox interactive collector:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in lootbox command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage({ error: error.message })));
        }
    }
};
