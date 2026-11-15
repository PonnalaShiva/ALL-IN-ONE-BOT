'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { HuntingManager } = require('../../models/economy/huntingManager');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.sell);

async function handleSellDeposit(userId, guildId, sourceMessageId) {
    const result = await EconomyManager.transferBank({
        userId,
        guildId,
        direction: 'deposit',
        amount: 'all',
        referenceId: `sell-deposit:${sourceMessageId}`,
        description: lang.txDepositSale({ amount: 'sale proceeds' }).toString()
    });
    return result.success ? result.amount : 0;
}

async function sellItemsAtomically(profile, itemIds, businessSale = false) {
    const referenceId = `sell:${profile.userId}:${profile.guildId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    return EconomyManager.mutateProfileAtomically({
        userId: profile.userId,
        guildId: profile.guildId,
        referenceId,
        mutate: async (current) => {
            const availableIds = new Set((current.huntingInventory || []).map(item => item.itemId));
            const idsToSell = [...new Set(itemIds)].filter(id => availableIds.has(id));
            if (!idsToSell.length) return { success: false, error: 'none' };

            const bonusItems = businessSale
                ? idsToSell.map(id => current.huntingInventory.find(item => item.itemId === id))
                    .filter(item => ['trophy', 'rare_material', 'artifact'].includes(item?.type))
                : [];
            const bonusRates = { trophy: 0.25, rare_material: 0.15, artifact: 0.10 };
            const businessBonus = bonusItems.reduce((sum, item) => {
                const rate = bonusRates[item.type];
                return sum + Math.floor((Number(item.currentValue) || 0) * rate) * (Number(item.quantity) || 1);
            }, 0);

            const ledgerCount = (current.transactions || []).length;
            const sale = await HuntingManager.sellHuntingItems(current, idsToSell);
            if (!sale.soldItems?.length) return { success: false, error: 'none' };
            if ((current.transactions || []).length <= ledgerCount) {
                current.transactions.push({ type: 'income', amount: 0, description: `Sold hunting loot (${sale.soldItems.length} items)`, category: 'hunting', timestamp: new Date() });
            }
            if (businessBonus > 0) {
                current.wallet = (current.wallet || 0) + businessBonus;
                current.transactions.push({ type: 'income', amount: businessBonus, description: lang.txBusinessBonus({ name: 'hunting goods' }).toString(), category: 'business', timestamp: new Date() });
            }
            return { sale, businessBonus };
        }
    });
}

async function executeBulkSell(profile, type) {
    const itemsToSell = [];
    (profile.huntingInventory || []).forEach(item => {
        switch (type) {
            case 'meat':
                if (item.type === 'meat') itemsToSell.push(item.itemId);
                break;
            case 'pelts':
            case 'pelt':
                if (item.type === 'pelt') itemsToSell.push(item.itemId);
                break;
            case 'trophies':
            case 'trophy':
                if (item.type === 'trophy') itemsToSell.push(item.itemId);
                break;
            case 'materials':
            case 'rare_material':
                if (item.type === 'rare_material') itemsToSell.push(item.itemId);
                break;
            case 'artifacts':
            case 'artifact':
                if (item.type === 'artifact') itemsToSell.push(item.itemId);
                break;
            case 'common':
            case 'uncommon':
            case 'rare':
            case 'epic':
            case 'legendary':
            case 'mythic':
                if (item.rarity === type) itemsToSell.push(item.itemId);
                break;
            case 'fuel':
                if (item.type === 'fuel') itemsToSell.push(item.itemId);
                break;
            case 'ammo':
                if (item.type === 'ammo') itemsToSell.push(item.itemId);
                break;
        }
    });

    if (itemsToSell.length === 0) {
        return {
            error: 'none',
            card: cards.warning(
                lang.noItemsCategoryTitle,
                lang.noItemsCategoryDesc({ type })
            )
        };
    }

    const mutation = await sellItemsAtomically(profile, itemsToSell);
    if (!mutation?.success) {
        return { error: 'none', card: cards.warning(lang.noItemsCategoryTitle, lang.noItemsCategoryDesc({ type })) };
    }
    const result = mutation.sale;
    profile = mutation.profile;

    const topItemsList = result.soldItems
        ?.sort((a, b) => b.value - a.value)
        ?.slice(0, 5)
        ?.map(item => `> • **${item.name}** — \`$${item.value.toLocaleString()}\``)
        ?.join('\n') || '';

    const lifetimeRev = profile.huntingStats?.totalEarnings ?
        lang.lifetimeRevenueTag({ rev: profile.huntingStats.totalEarnings.toLocaleString() }) : '';

    const topItemsBlock = topItemsList ? `${lang.topItemsHeader}${topItemsList}` : '';

    const bulkCard = buildCard({
        title: lang.bulkSaleTitle({ type: type.toUpperCase() }),
        accentColor: ACCENT.success
    })
        .addText(`### ${lang.saleOverviewHeader}\n` + lang.bulkSaleDetails({
            count: result.soldItems?.length || itemsToSell.length,
            payout: (result.totalValue || 0).toLocaleString(),
            wallet: (profile.wallet || 0).toLocaleString(),
            lifetimeRevenue: lifetimeRev,
            topItems: topItemsBlock
        }));

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.success('sell_deposit_bank', lang.btnDepositBank),
            btn.secondary('sell_close', lang.btnClose)
        )
    ];

    return { success: true, card: bulkCard, rows };
}

async function executeSingleSell(profile, itemId) {
    let item = (profile.huntingInventory || []).find(i => i.itemId === itemId);
    if (!item) {
        item = (profile.huntingInventory || []).find(i => (i.itemId || '').endsWith(itemId));
    }

    if (!item) {
        return {
            error: 'not_found',
            card: cards.warning(
                lang.itemNotFoundTitle,
                lang.itemNotFoundDesc({ id: itemId })
            )
        };
    }

    let sellValue = item.currentValue || 0;
    const warehouse = (profile.huntingWarehouses || []).find(w => item.location === w.warehouseId);
    let warehouseBonus = 0;

    if (warehouse && warehouse.bonusMultiplier) {
        const bonusValue = Math.floor(item.currentValue * warehouse.bonusMultiplier) - item.currentValue;
        warehouseBonus = bonusValue * (item.quantity || 1);
        sellValue = Math.floor(item.currentValue * warehouse.bonusMultiplier);
    }

    const totalSellValue = sellValue * (item.quantity || 1);
    const mutation = await sellItemsAtomically(profile, [item.itemId]);
    if (!mutation?.success) return { error: 'not_found', card: cards.warning(lang.itemNotFoundTitle, lang.itemNotFoundDesc({ id: itemId })) };
    profile = mutation.profile;

    const whBonusTag = warehouseBonus > 0 ?
        lang.warehouseBonusTag({ bonus: warehouseBonus.toLocaleString() }) : '';

    const singleCard = buildCard({
        title: lang.singleSaleTitle({ name: item.name }),
        accentColor: ACCENT.success
    })
        .addText(`### ${lang.saleReceiptHeader}\n` + lang.singleSaleDetails({
            name: item.name,
            rarity: item.rarity,
            quantity: item.quantity || 1,
            base: ((item.currentValue || 0) * (item.quantity || 1)).toLocaleString(),
            warehouseBonus: whBonusTag,
            total: totalSellValue.toLocaleString(),
            wallet: (profile.wallet || 0).toLocaleString()
        }));

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.success('sell_deposit_bank', lang.btnDepositBank),
            btn.secondary('sell_close', lang.btnClose)
        )
    ];

    return { success: true, card: singleCard, rows };
}

async function executeBusinessSell(profile, itemId) {
    let item = (profile.huntingInventory || []).find(i => i.itemId === itemId);
    if (!item) {
        item = (profile.huntingInventory || []).find(i => (i.itemId || '').endsWith(itemId));
    }

    if (!item) {
        return {
            error: 'not_found',
            card: cards.warning(
                lang.itemNotFoundTitle,
                lang.itemNotFoundDesc({ id: itemId })
            )
        };
    }

    if (!profile.businesses || profile.businesses.length === 0) {
        return {
            error: 'no_business',
            card: cards.warning(
                lang.noBusinessTitle,
                lang.noBusinessDesc({ id: itemId })
            )
        };
    }

    const businessBonusTypes = ['trophy', 'rare_material', 'artifact'];
    const hasBusinessBonus = businessBonusTypes.includes(item.type);

    let sellValue = item.currentValue || 0;
    let businessBonus = 0;

    if (hasBusinessBonus) {
        const bonusMultiplier = item.type === 'trophy' ? 1.25 :
            item.type === 'rare_material' ? 1.15 : 1.10;
        businessBonus = Math.floor(item.currentValue * (bonusMultiplier - 1));
        sellValue = Math.floor(item.currentValue * bonusMultiplier);
    }

    const totalSellValue = sellValue * (item.quantity || 1);
    const mutation = await sellItemsAtomically(profile, [item.itemId], true);
    if (!mutation?.success) return { error: 'not_found', card: cards.warning(lang.itemNotFoundTitle, lang.itemNotFoundDesc({ id: itemId })) };
    profile = mutation.profile;
    businessBonus = item.type === 'trophy' ? Math.floor(item.currentValue * 0.25) : item.type === 'rare_material' ? Math.floor(item.currentValue * 0.15) : item.type === 'artifact' ? Math.floor(item.currentValue * 0.10) : 0;

    const bonusInfo = businessBonus > 0
        ? lang.bizBonusTag({ bonus: (businessBonus * (item.quantity || 1)).toLocaleString(), rate: item.type === 'trophy' ? '25' : item.type === 'rare_material' ? '15' : '10' })
        : lang.bizBonusTip.toString();

    const bizCard = buildCard({
        title: lang.bizSaleTitle({ name: item.name }),
        accentColor: ACCENT.success
    })
        .addText(`### ${lang.txSummaryHeader}\n` + lang.txSummaryDetails({
            name: item.name,
            rarity: item.rarity,
            quantity: item.quantity || 1,
            base: ((item.currentValue || 0) * (item.quantity || 1)).toLocaleString(),
            bonusInfo,
            total: totalSellValue.toLocaleString(),
            wallet: (profile.wallet || 0).toLocaleString()
        }));

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.success('sell_deposit_bank', lang.btnDepositBank),
            btn.secondary('sell_close', lang.btnClose)
        )
    ];

    return { success: true, card: bizCard, rows };
}

function attachSellReceiptCollector(sentMessage, userId) {
    const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async (interaction) => {
        try {
            if (interaction.user.id !== userId) return replyUnauthorized(interaction);
            await interaction.deferUpdate();

            if (interaction.customId === 'sell_close') {
                collector.stop('user_closed');
                return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
            }

            if (interaction.customId === 'sell_deposit_bank') {
                const deposited = await handleSellDeposit(userId, interaction.guildId || sentMessage.guild?.id, sentMessage.id);
                collector.stop('deposited');
                return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
            }
        } catch (err) {
            console.error('Error handling sell interaction:', err);
            editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage({ error: err.message })), rows: [] }).catch(() => {});
        }
    });

    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
        }
    });
    return collector;
}

module.exports = {
    name: 'sell',
    aliases: ['sellitem', 'sellhunt', 'sellloot'],
    description: lang.cmdDesc.toString(),
    usage: '!sell <item_id> | !sell all <type> | !sell business <item_id>',
    cooldown: 2000,
    async execute(message, args) {
        try {
            const profile = await EconomyManager.getProfile(message.author.id, message.guild.id);
            const action = args[0]?.toLowerCase();

            
            if (action === 'business' && args[1]) {
                const result = await executeBusinessSell(profile, args[1]);
                if (result.rows) {
                    const sentMessage = await sendV2(message, { card: result.card, rows: result.rows });
                    if (!sentMessage) return;
                    attachSellReceiptCollector(sentMessage, message.author.id);
                    return;
                }
                return sendV2(message, result.card);
            }

            
            if (action === 'all' && args[1]) {
                const result = await executeBulkSell(profile, args[1].toLowerCase());
                if (result.rows) {
                    const sentMessage = await sendV2(message, { card: result.card, rows: result.rows });
                    if (!sentMessage) return;
                    attachSellReceiptCollector(sentMessage, message.author.id);
                    return;
                }
                return sendV2(message, result.card);
            }

            
            if (action) {
                const result = await executeSingleSell(profile, action);
                if (result.rows) {
                    const sentMessage = await sendV2(message, { card: result.card, rows: result.rows });
                    if (!sentMessage) return;
                    attachSellReceiptCollector(sentMessage, message.author.id);
                    return;
                }
                return sendV2(message, result.card);
            }

            
            const helpCard = buildCard({
                title: lang.helpTitle,
                accentColor: ACCENT.primary
            })
                .addText(lang.helpIntro.toString());

            const buttons = [
                btn.secondary('sell_bulk_meat', lang.btnSellMeat),
                btn.secondary('sell_bulk_pelts', lang.btnSellPelts),
                btn.secondary('sell_bulk_common', lang.btnSellCommon),
                btn.danger('sell_close', lang.btnClose)
            ];

            const rows = [new ActionRowBuilder().addComponents(buttons)];
            const sentMessage = await sendV2(message, { card: helpCard, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'sell_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'sell_deposit_bank') {
                        const deposited = await handleSellDeposit(message.author.id, message.guild.id, sentMessage.id);
                        collector.stop('deposited');
                        return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                    }

                    if (interaction.customId === 'sell_bulk_meat') {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const result = await executeBulkSell(freshProfile, 'meat');
                        const rows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('sell_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows });
                    }

                    if (interaction.customId === 'sell_bulk_pelts') {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const result = await executeBulkSell(freshProfile, 'pelts');
                        const rows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('sell_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows });
                    }

                    if (interaction.customId === 'sell_bulk_common') {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const result = await executeBulkSell(freshProfile, 'common');
                        const rows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('sell_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows });
                    }
                } catch (err) {
                    console.error('Error handling sell overview interaction:', err);
                    editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage({ error: err.message })), rows: [] }).catch(() => {});
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in sell command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage({ error: error.message })));
        }
    }
};
