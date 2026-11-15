'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { HuntingManager } = require('../../models/economy/huntingManager');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.inventory);

const RARITY_EMOJIS = {
    common: '⚪',
    uncommon: '🟢',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟡',
    mythic: '🔴'
};

const TYPE_EMOJIS = {
    meat: '🥩',
    pelt: '🦌',
    trophy: '🏆',
    rare_material: '💎',
    artifact: '⚱️',
    loot_box: '📦',
    fuel: '⛽',
    ammo: '🔫'
};

function getFilteredItems(inventory, filter) {
    if (filter === 'all') return inventory;
    return inventory.filter(item => {
        switch (filter) {
            case 'rare':
                return ['rare', 'epic', 'legendary', 'mythic'].includes(item.rarity);
            case 'common':
                return ['common', 'uncommon'].includes(item.rarity);
            case 'lootboxes':
                return item.type === 'loot_box';
            case 'meat':
                return item.type === 'meat';
            case 'pelts':
                return item.type === 'pelt';
            case 'trophies':
                return item.type === 'trophy';
            case 'materials':
                return item.type === 'rare_material';
            case 'artifacts':
                return item.type === 'artifact';
            default:
                return true;
        }
    });
}

function buildInventoryCard(profile, username, filter = 'all', page = 1) {
    const inventory = profile.huntingInventory || [];

    if (inventory.length === 0) {
        return {
            card: buildCard({
                title: lang.emptyTitle,
                description: lang.emptyDesc,
                accentColor: ACCENT.warning
            })
                .addSeparator()
                .addText(`### ${lang.emptyTipsTitle}\n> ${lang.emptyTipsDesc}`),
            totalPages: 1,
            safePage: 1
        };
    }

    const itemsPerPage = 8;
    const filteredItems = [...getFilteredItems(inventory, filter)];
    filteredItems.sort((a, b) => ((b.currentValue || 0) * (b.quantity || 1)) - ((a.currentValue || 0) * (a.quantity || 1)));

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredItems.slice(startIndex, endIndex);

    const totalItems = inventory.length;
    const totalValue = inventory.reduce((sum, item) => sum + ((item.currentValue || 0) * (item.quantity || 1)), 0);
    const storageUsed = HuntingManager.calculateInventoryWeight ? HuntingManager.calculateInventoryWeight(profile) : '0';
    const storageCapacity = HuntingManager.calculateStorageCapacity ? HuntingManager.calculateStorageCapacity(profile) : '100';

    const rarityCount = {};
    inventory.forEach(item => {
        rarityCount[item.rarity] = (rarityCount[item.rarity] || 0) + 1;
    });

    const raritySummary = Object.entries(rarityCount)
        .map(([r, c]) => `**${r.charAt(0).toUpperCase() + r.slice(1)}:** \`${c}\``)
        .join(' · ');

    let itemsText = '';
    if (pageItems.length > 0) {
        for (const item of pageItems) {
            const locItem = resolveEntity('items', item.itemId, item);
            const rEmoji = RARITY_EMOJIS[item.rarity] || '⚪';
            const tEmoji = TYPE_EMOJIS[item.type] || '📦';
            const qtyStr = (item.quantity || 1) > 1 ? ` (${item.quantity}x @ $${(item.currentValue || 0).toLocaleString()})` : '';

            itemsText += lang.itemLine({
                rEmoji,
                tEmoji,
                name: locItem.name,
                value: ((item.currentValue || 0) * (item.quantity || 1)).toLocaleString(),
                qtyStr,
                id: (item.itemId || '').slice(-8)
            }) + '\n\n';
        }
    } else {
        itemsText = lang.noItemsMatching.toString();
    }

    let quickCmds = `${lang.quickCommandsDesc}\n`;
    if (totalPages > 1) {
        quickCmds += `> ${lang.paginationNav({ page: safePage, totalPages, filter, nextPage: safePage + 1 <= totalPages ? safePage + 1 : 1 })}`;
    }

    const invCard = buildCard({
        title: lang.userInventoryTitle({ username }),
        accentColor: ACCENT.primary
    })
        .addText(`### 📊 ${lang.statsTitle}`)
        .addText(
            `> **${lang.totalItemsLabel}:** \`${totalItems}\` · **${lang.totalValueLabel}:** \`$${totalValue.toLocaleString()}\`\n` +
            `> **${lang.storageLabel}:** ${lang.storageValue({ used: storageUsed, capacity: storageCapacity })}\n` +
            (raritySummary ? `> ${raritySummary}\n` : '') +
            `> ${lang.filterOverview({ filter: filter === 'all' ? lang.allItems : filter, page: safePage, totalPages })}`
        )
        .addSeparator()
        .addText(`### 🎁 ${lang.itemsTitle({ start: startIndex + 1, end: Math.min(endIndex, filteredItems.length), total: filteredItems.length })}\n\n${itemsText.trim()}`)
        .addSeparator()
        .addText(`### 📋 ${lang.quickCommandsTitle}\n${quickCmds}`);

    return { card: invCard, totalPages, safePage };
}

function buildInventoryActionRows(safePage, totalPages, hasSellable = false) {
    const buttons = [];
    if (totalPages > 1) {
        buttons.push(btn.secondary('inv_prev', lang.btnPrev).setDisabled(safePage <= 1));
        buttons.push(btn.secondary('inv_next', lang.btnNext).setDisabled(safePage >= totalPages));
    }
    if (hasSellable) {
        buttons.push(btn.success('inv_sell_all', lang.btnSellAll));
    }
    buttons.push(btn.danger('inv_close', lang.btnClose));

    return [new ActionRowBuilder().addComponents(buttons)];
}

module.exports = {
    name: 'inventory',
    aliases: ['inv', 'huntinv', 'bag'],
    description: lang.cmdDesc.toString(),
    usage: '!inventory [filter] [page]',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);
            const filter = args[0]?.toLowerCase() || 'all';
            let currentPage = parseInt(args[1], 10) || 1;

            const initial = buildInventoryCard(profile, message.author.username, filter, currentPage);
            const sellableCount = (profile.huntingInventory || []).filter(i => ['meat', 'pelt', 'trophy', 'rare_material', 'artifact'].includes(i.type)).length;
            const rows = buildInventoryActionRows(initial.safePage, initial.totalPages, sellableCount > 0);

            const sentMessage = await sendV2(message, { card: initial.card, rows });
            if (!sentMessage) return;

            let lastPayout = 0;
            let lastSoldLength = 0;

            const collector = sentMessage.createMessageComponentCollector({ time: 120000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'inv_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'inv_prev') {
                        currentPage = Math.max(1, currentPage - 1);
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const update = buildInventoryCard(freshProfile, message.author.username, filter, currentPage);
                        const curSellable = (freshProfile.huntingInventory || []).filter(i => ['meat', 'pelt', 'trophy', 'rare_material', 'artifact'].includes(i.type)).length;
                        return editV2(sentMessage, { card: update.card, rows: buildInventoryActionRows(update.safePage, update.totalPages, curSellable > 0) });
                    }

                    if (interaction.customId === 'inv_next') {
                        currentPage += 1;
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const update = buildInventoryCard(freshProfile, message.author.username, filter, currentPage);
                        const curSellable = (freshProfile.huntingInventory || []).filter(i => ['meat', 'pelt', 'trophy', 'rare_material', 'artifact'].includes(i.type)).length;
                        return editV2(sentMessage, { card: update.card, rows: buildInventoryActionRows(update.safePage, update.totalPages, curSellable > 0) });
                    }

                    if (interaction.customId === 'inv_sell_all') {
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const inv = freshProfile.huntingInventory || [];
                        const sellable = inv.filter(i => ['meat', 'pelt', 'trophy', 'rare_material', 'artifact'].includes(i.type));

                        if (sellable.length === 0) {
                            return editV2(sentMessage, { card: cards.warning(lang.noSellableItemsTitle, lang.noSellableItemsDesc), rows: [new ActionRowBuilder().addComponents(btn.danger('inv_close', lang.btnClose))] });
                        }

                        const sale = await EconomyManager.mutateProfileAtomically({
                            userId, guildId, referenceId: `inventory-liquidate:${sentMessage.id}`,
                            mutate: async current => {
                                const eligible = new Set(sellable.map(i => i.itemId));
                                const currentIds = (current.huntingInventory || []).filter(i => eligible.has(i.itemId) && ['meat', 'pelt', 'trophy', 'rare_material', 'artifact'].includes(i.type)).map(i => i.itemId);
                                if (!currentIds.length) return { success: false, error: 'empty' };
                                const ledgerCount = (current.transactions || []).length;
                                const result = await HuntingManager.sellHuntingItems(current, currentIds);
                                if (!result.soldItems?.length) return { success: false, error: 'empty' };
                                if ((current.transactions || []).length <= ledgerCount) current.transactions.push({ type: 'income', amount: 0, description: lang.txLiquidatedWarehouse({ count: result.soldItems.length }).toString(), category: 'hunting', timestamp: new Date() });
                                return { result, count: result.soldItems.length };
                            }
                        });
                        if (!sale?.success) return editV2(sentMessage, { card: cards.warning(lang.noSellableItemsTitle, lang.noSellableItemsDesc), rows: [new ActionRowBuilder().addComponents(btn.danger('inv_close', lang.btnClose))] });
                        const payout = sale.result.totalValue || 0;
                        lastPayout = payout;
                        lastSoldLength = sale.count;
                        const committedProfile = sale.profile;

                        const soldCard = cards.success(lang.sellGoodsSuccessTitle, lang.sellGoodsSuccessDesc({ count: sale.count, payout: payout.toLocaleString(), wallet: (committedProfile.wallet || 0).toLocaleString() }));
                        const finishRows = [
                            new ActionRowBuilder().addComponents(
                                btn.success(`inv_deposit_${payout}`, lang.btnDepositBank),
                                btn.danger('inv_close', lang.btnClose)
                            )
                        ];
                        return editV2(sentMessage, { card: soldCard, rows: finishRows });
                    }

                    if (interaction.customId.startsWith('inv_deposit_')) {
                        const currentProfile = await EconomyManager.getProfile(userId, guildId);
                        const requested = Math.min(lastPayout, currentProfile.wallet || 0);
                        const transfer = requested > 0 ? await EconomyManager.transferBank({ userId, guildId, direction: 'deposit', amount: requested, referenceId: `inventory-deposit:${sentMessage.id}`, description: lang.txDepositLiquidation({ amount: 'sale proceeds' }).toString() }) : { success: false, profile: currentProfile };
                        const freshProfile = transfer.profile || currentProfile;
                        const canDeposit = transfer.success ? transfer.amount : 0;
                        const depositedCard = cards.success(
                            lang.sellGoodsSuccessTitle,
                            `${lang.sellGoodsSuccessDesc({ count: lastSoldLength, payout: lastPayout.toLocaleString(), wallet: (freshProfile.wallet || 0).toLocaleString() })}\n\n> 🏦 **${lang.depositedAlert({ amount: canDeposit.toLocaleString() })}**`
                        );
                        return editV2(sentMessage, { card: depositedCard, rows: [new ActionRowBuilder().addComponents(btn.danger('inv_close', lang.btnClose))] });
                    }
                } catch (err) {
                    console.error('Error in inventory collector:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in inventory command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
