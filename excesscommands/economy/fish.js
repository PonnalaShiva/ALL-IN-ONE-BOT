'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { FISH_TYPES, FISHING_RODS, BAIT_TYPES } = require('../../models/economy/constants/fishingData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.fish);

const RARITY_COLORS = {
    common: 0x95A5A6,
    uncommon: 0x2ECC71,
    rare: 0x3498DB,
    epic: 0x9B59B6,
    legendary: 0xFFD700
};

const RARITY_EMOJIS = {
    common: '⬜',
    uncommon: '🟢',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟡'
};

function buildShopCard(profile) {
    const shopCard = buildCard({
        title: lang.shopTitle,
        description: lang.shopSubtitle,
        accentColor: ACCENT.primary
    });

    
    shopCard.addSeparator().addText(`### 🎣 ${lang.rodsTitle}`);
    for (const [id, rod] of Object.entries(FISHING_RODS)) {
        const locRod = resolveEntity('fishing_rods', id, rod);
        const owned = (profile.fishingRod || 'basic_rod') === id ? lang.equippedTag.toString() : '';
        const locked = (profile.level || 1) < rod.level ? lang.levelRequiredTag({ level: rod.level }) : '';
        shopCard.addText(
            `**${locRod.emoji || rod.emoji || '🎣'} ${locRod.name}** — \`$${rod.price.toLocaleString()}\`${owned}${locked}\n` +
            lang.rodSpecsLine({ bonus: rod.catchBonus, boost: rod.rarityBoost })
        );
    }

    
    shopCard.addSeparator().addText(`### 🪱 ${lang.baitTitle}`);
    for (const [id, bait] of Object.entries(BAIT_TYPES)) {
        const locBait = resolveEntity('fishing_baits', id, bait);
        shopCard.addText(
            `**${locBait.emoji || bait.emoji || '🪱'} ${locBait.name}** — \`$${bait.price}/ea\`\n` +
            lang.baitSpecsLine({ desc: locBait.description || bait.description })
        );
    }

    return shopCard;
}

function buildShopActionRows(profile) {
    const options = [];

    
    for (const [id, rod] of Object.entries(FISHING_RODS)) {
        const locRod = resolveEntity('fishing_rods', id, rod);
        options.push({
            label: `${locRod.name}`,
            value: `rod_${id}`,
            description: `$${rod.price.toLocaleString()} • Lv.${rod.level} • ${rod.catchBonus}x`,
            emoji: locRod.emoji || rod.emoji || '🎣'
        });
    }

    
    for (const [id, bait] of Object.entries(BAIT_TYPES)) {
        const locBait = resolveEntity('fishing_baits', id, bait);
        options.push({
            label: `${locBait.name} (x10)`,
            value: `bait_${id}`,
            description: `$${(bait.price * 10).toLocaleString()} • ${(locBait.description || bait.description)?.slice(0, 45)}`,
            emoji: locBait.emoji || bait.emoji || '🪱'
        });
    }

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('fish_shop_select')
            .setPlaceholder(lang.selectGearPlaceholder.toString())
            .addOptions(options.slice(0, 25))
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.primary('fish_cast_again', lang.btnBackToFishing),
        btn.danger('fish_close', lang.btnClose)
    );

    return [selectRow, btnRow];
}

async function executeSellAll(profile, referenceId) {
    const collection = profile.fishCollection || [];
    if (collection.length === 0) {
        return {
            error: 'none',
            card: cards.warning(
                lang.noFishToSellTitle,
                lang.noFishToSellDesc()
            ),
            rows: [new ActionRowBuilder().addComponents(
                btn.primary('fish_cast_again', lang.btnCastAgain),
                btn.secondary('fish_open_shop', lang.btnShop),
                btn.danger('fish_close', lang.btnClose)
            )]
        };
    }

    const mutation = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId,
        guildId: profile.guildId,
        referenceId,
        mutate: async current => {
            const fish = current.fishCollection || [];
            if (!fish.length) return { success: false, error: 'none' };
            const totalValue = fish.reduce((sum, caught) => sum + Math.max(0, Number(caught.value) || 0), 0);
            current.fishCollection = [];
            current.wallet = (current.wallet || 0) + totalValue;
            current.transactions.push({ type: 'income', amount: totalValue, description: lang.txFishSold({ count: fish.length }).toString(), category: 'fishing', timestamp: new Date() });
            return { totalValue, count: fish.length };
        }
    });
    if (!mutation?.success) return { error: mutation?.duplicate ? 'duplicate' : 'none', card: cards.warning(lang.noFishToSellTitle, lang.noFishToSellDesc()), rows: [] };
    profile = mutation.profile;
    const { totalValue, count } = mutation;

    const soldCard = buildCard({
        title: lang.fishSoldTitle,
        accentColor: ACCENT.success
    }).addText(lang.fishSoldDesc({
        count: count.toLocaleString(),
        value: totalValue.toLocaleString(),
        wallet: (profile.wallet || 0).toLocaleString()
    }));

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.success(`fish_deposit_${totalValue}`, lang.btnDepositBank),
            btn.primary('fish_cast_again', lang.btnCastAgain),
            btn.secondary('fish_open_shop', lang.btnShop),
            btn.danger('fish_close', lang.btnClose)
        )
    ];

    return { success: true, card: soldCard, rows };
}

async function handleFishCast(userId, guildId, referenceId) {
    const result = await EconomyManager.executeFishing(userId, guildId, `fish-cast:${referenceId}`);
    if (!result.success) {
        const seconds = Math.ceil((result.cooldownRemaining || 0) / 1000);
        return { success: false, card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ seconds })), rows: [] };
    }
    const localizedFish = resolveEntity('fish', result.fish.id, result.fish);

    const catchCard = buildCard({
        title: lang.catchTitle,
        accentColor: RARITY_COLORS[result.rarity] || ACCENT.primary
    }).addText(lang.catchDesc({
        name: `${localizedFish.emoji || result.fish.emoji || '🐟'} ${localizedFish.name}`,
        rarityEmoji: RARITY_EMOJIS[result.rarity] || '🔹',
        rarity: result.rarity.toUpperCase(),
        weight: result.weight,
        value: (result.value || 0).toLocaleString(),
        xp: result.xp
    }));

    
    const newProfile = await EconomyManager.getProfile(userId, guildId);
    const newAchievements = await EconomyManager.checkAchievements(newProfile);
    if (newAchievements.length > 0) {
        catchCard.addSeparator().addText(`### 🏆 ${lang.achievementTitle}`);
        const achText = newAchievements.map(a => `> ${a.emoji} **${a.name}** — ${a.description} (+\`$${a.reward}\`)`).join('\n');
        catchCard.addText(achText);
    }

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('fish_cast_again', lang.btnCastAgain),
            btn.success('fish_sell', lang.btnSell),
            btn.secondary('fish_open_shop', lang.btnShop),
            btn.danger('fish_close', lang.btnClose)
        )
    ];

    return { card: catchCard, rows };
}

async function routeFishAction(interaction, sentMsg, message, collector) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (interaction.customId === 'fish_close') {
        collector.stop('user_closed');
        return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
    }

    if (interaction.customId === 'fish_open_shop') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        const sCard = buildShopCard(freshProfile);
        const sRows = buildShopActionRows(freshProfile);
        return editV2(sentMsg, { card: sCard, rows: sRows });
    }

    if (interaction.customId === 'fish_sell') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        const sellResult = await executeSellAll(freshProfile, `fish-sell:${interaction.id}`);
        return editV2(sentMsg, { card: sellResult.card, rows: sellResult.rows || [] });
    }

    if (interaction.customId.startsWith('fish_deposit_')) {
        const depositAmt = parseInt(interaction.customId.replace('fish_deposit_', ''), 10) || 0;
        const transfer = depositAmt > 0 ? await EconomyManager.transferBank({ userId, guildId, direction: 'deposit', amount: depositAmt, referenceId: `fish-deposit:${sentMsg.id}`, description: 'Deposited fish sale proceeds' }) : { success: false };
        const freshProfile = transfer.profile || await EconomyManager.getProfile(userId, guildId);
        const canDeposit = transfer.success ? transfer.amount : 0;
        return editV2(sentMsg, {
            card: cards.success(lang.fishSoldTitle, `> 🏦 **Deposited $${canDeposit.toLocaleString()} into your bank!**\n> Bank Balance: $${(freshProfile.bank || 0).toLocaleString()}`),
            rows: [new ActionRowBuilder().addComponents(
                btn.primary('fish_cast_again', lang.btnCastAgain),
                btn.secondary('fish_open_shop', lang.btnShop),
                btn.danger('fish_close', lang.btnClose)
            )]
        });
    }

    if (interaction.customId === 'fish_cast_again') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        const cd = freshProfile.cooldowns?.fish;
        const el = cd ? Date.now() - new Date(cd).getTime() : Infinity;
        const fishCd = 30 * 1000;
        if (el < fishCd) {
            const rem = Math.ceil((fishCd - el) / 1000);
            return editV2(sentMsg, {
                card: cards.warning(lang.cooldownTitle, `${lang.cooldownDesc({ remaining: rem })}\n\n> 💡 *${lang.cooldownTackleShopHint}*`),
                rows: [new ActionRowBuilder().addComponents(
                    btn.primary('fish_cast_again', lang.btnCastAgain).setDisabled(true),
                    btn.success('fish_sell', lang.btnSell),
                    btn.secondary('fish_open_shop', lang.btnShop),
                    btn.danger('fish_close', lang.btnClose)
                )]
            });
        }

        const castResult = await handleFishCast(userId, guildId, interaction.id);
        return editV2(sentMsg, { card: castResult.card, rows: castResult.rows });
    }

    if (interaction.customId === 'fish_shop_select') {
        const val = interaction.values[0];
        let freshProfile = await EconomyManager.getProfile(userId, guildId);

        if (val.startsWith('rod_')) {
            const rodId = val.replace('rod_', '');
            const rod = FISHING_RODS[rodId];
            if (!rod) return;

            const purchase = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `fish-rod:${interaction.id}`, mutate: async current => {
                if ((current.level || 1) < rod.level) return { success: false, error: 'level' };
                if ((current.wallet || 0) < rod.price) return { success: false, error: 'funds' };
                current.wallet -= rod.price;
                current.fishingRod = rodId;
                current.transactions.push({ type: 'expense', amount: rod.price, description: `Purchased fishing rod ${rodId}`, category: 'fishing', timestamp: new Date() });
                return {};
            } });
            if (!purchase?.success) {
                const current = purchase.profile || freshProfile;
                const errorCard = purchase.error === 'level' ? cards.warning(lang.levelRequiredTitle, lang.levelRequiredDesc({ level: rod.level })) : cards.warning(lang.notEnoughTitle, lang.notEnoughDesc({ cost: rod.price.toLocaleString(), wallet: (current.wallet || 0).toLocaleString() }));
                return editV2(sentMsg, { card: errorCard, rows: [new ActionRowBuilder().addComponents(btn.primary('fish_cast_again', lang.btnBackToFishing), btn.secondary('fish_open_shop', lang.btnShop), btn.danger('fish_close', lang.btnClose))] });
            }
            freshProfile = purchase.profile;

            const locRod = resolveEntity('fishing_rods', rodId, rod);
            const rodCard = buildCard({
                title: lang.rodPurchasedTitle,
                accentColor: ACCENT.success
            })
                .addText(lang.rodPurchasedDesc({
                    name: locRod.name,
                    cost: rod.price.toLocaleString(),
                    bonus: rod.catchBonus,
                    boost: rod.rarityBoost
                }))
                .addSeparator()
                .addText(lang.remainingBalance({ balance: (freshProfile.wallet || 0).toLocaleString() }));

            return editV2(sentMsg, { card: rodCard, rows: [new ActionRowBuilder().addComponents(btn.primary('fish_cast_again', lang.btnBackToFishing), btn.secondary('fish_open_shop', lang.btnShop), btn.danger('fish_close', lang.btnClose))] });

        } else if (val.startsWith('bait_')) {
            const baitId = val.replace('bait_', '');
            const bait = BAIT_TYPES[baitId];
            if (!bait) return;

            const qty = 10;
            const totalCost = bait.price * qty;

            const purchase = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `fish-bait:${interaction.id}`, mutate: async current => {
                if ((current.wallet || 0) < totalCost) return { success: false, error: 'funds' };
                current.wallet -= totalCost;
                if (!current.baitBox) current.baitBox = [];
                const existingBait = current.baitBox.find(b => b.id === baitId);
                if (existingBait) existingBait.quantity += qty;
                else current.baitBox.push({ id: baitId, name: bait.name, quantity: qty });
                current.transactions.push({ type: 'expense', amount: totalCost, description: `Purchased ${qty} ${baitId} bait`, category: 'fishing', timestamp: new Date() });
                return {};
            } });
            if (!purchase?.success) return editV2(sentMsg, { card: cards.warning(lang.notEnoughTitle, lang.notEnoughDesc({ cost: totalCost.toLocaleString(), wallet: ((purchase.profile || freshProfile).wallet || 0).toLocaleString() })), rows: [new ActionRowBuilder().addComponents(btn.primary('fish_cast_again', lang.btnBackToFishing), btn.secondary('fish_open_shop', lang.btnShop), btn.danger('fish_close', lang.btnClose))] });
            freshProfile = purchase.profile;

            const locBait = resolveEntity('fishing_baits', baitId, bait);
            const baitCard = buildCard({
                title: lang.baitPurchasedTitle,
                accentColor: ACCENT.success
            })
                .addText(lang.baitPurchasedDesc({
                    qty: qty.toLocaleString(),
                    name: locBait.name,
                    cost: totalCost.toLocaleString()
                }))
                .addSeparator()
                .addText(lang.remainingBalance({ balance: (freshProfile.wallet || 0).toLocaleString() }));

            return editV2(sentMsg, { card: baitCard, rows: [new ActionRowBuilder().addComponents(btn.primary('fish_cast_again', lang.btnBackToFishing), btn.secondary('fish_open_shop', lang.btnShop), btn.danger('fish_close', lang.btnClose))] });
        }
    }
}

function attachFishCollector(sentMsg, message) {
    if (!sentMsg) return null;
    const collector = sentMsg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async (interaction) => {
        try {
            if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
            await interaction.deferUpdate();
            await routeFishAction(interaction, sentMsg, message, collector);
        } catch (err) {
            console.error('Error in fish collector:', err);
        }
    });
    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
        }
    });
    return collector;
}

module.exports = {
    name: 'fish',
    aliases: ['fishing', 'castline'],
    description: 'Go fishing to catch rare aquatic species, sell catch, and upgrade tackle',
    usage: '!fish | !fish shop | !fish collection | !fish sell',
    cooldown: 5000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const profile = await EconomyManager.getProfile(userId, guildId);
            const action = args[0]?.toLowerCase();

            
            if (action === 'shop') {
                const shopCard = buildShopCard(profile);
                const rows = buildShopActionRows(profile);

                const sentMessage = await sendV2(message, { card: shopCard, rows });
                attachFishCollector(sentMessage, message);
                return;
            }

            
            if (action === 'sell') {
                const sellResult = await executeSellAll(profile, `fish-sell:${message.id}`);
                const sentMsg = await sendV2(message, { card: sellResult.card, rows: sellResult.rows });
                attachFishCollector(sentMsg, message);
                return;
            }

            
            if (action === 'collection' || action === 'col') {
                const stats = profile.fishingStats || {};
                const collection = profile.fishCollection || [];
                const uniqueFish = [...new Set(collection.map(f => f.fishId))];

                const colCard = buildCard({
                    title: lang.collectionTitle({ user: message.author.username }),
                    accentColor: ACCENT.primary
                })
                    .addText(`> **${lang.collectionSubtitle}**`)
                    .addSeparator()
                    .addText(
                        lang.collectionStatsLine({
                            total: stats.totalCaught || 0,
                            unique: uniqueFish.length,
                            max: Object.keys(FISH_TYPES).length,
                            earned: (stats.totalEarned || 0).toLocaleString(),
                            biggest: (stats.biggestCatch || 0).toFixed(2),
                            legendary: stats.legendaryCaught || 0
                        })
                    );

                if (uniqueFish.length > 0) {
                    colCard.addSeparator().addText(`### 📋 ${lang.recentCatchesTitle}`);
                    const last10 = collection.slice(-10).reverse();
                    const fishText = last10.map(f => {
                        const data = resolveEntity('fish', f.fishId, f);
                        return `> ${data?.emoji || '🐟'} **${data.name}** (\`${f.rarity}\`) — \`${f.weight}kg\` — \`$${(f.value || 0).toLocaleString()}\``;
                    }).join('\n');
                    colCard.addText(fishText);
                }

                const rows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('fish_cast_again', lang.btnCastAgain),
                        btn.success('fish_sell', lang.btnSell),
                        btn.secondary('fish_open_shop', lang.btnShop),
                        btn.danger('fish_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: colCard, rows });
                attachFishCollector(sentMessage, message);
                return;
            }

            
            const cooldown = profile.cooldowns?.fish;
            if (cooldown) {
                const elapsed = Date.now() - new Date(cooldown).getTime();
                const fishCooldown = 30 * 1000;
                if (elapsed < fishCooldown) {
                    const remaining = Math.ceil((fishCooldown - elapsed) / 1000);
                    const cdCard = cards.warning(
                        lang.cooldownTitle,
                        `${lang.cooldownDesc({ remaining })}\n\n> 💡 *${lang.cooldownManageCatchHint}*`
                    );
                    const cdRows = [
                        new ActionRowBuilder().addComponents(
                            btn.success('fish_sell', lang.btnSell),
                            btn.secondary('fish_open_shop', lang.btnShop),
                            btn.danger('fish_close', lang.btnClose)
                        )
                    ];
                    const sentMessage = await sendV2(message, { card: cdCard, rows: cdRows });
                    attachFishCollector(sentMessage, message);
                    return;
                }
            }

            const initialCast = await handleFishCast(userId, guildId, message.id);
            const sentMessage = await sendV2(message, { card: initialCast.card, rows: initialCast.rows });
            attachFishCollector(sentMessage, message);

        } catch (error) {
            console.error('Error in fish command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
