'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { SHOP_ITEMS } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.shop);

function buildCatalogCard(profile) {
    const categories = {
        pet_care: lang.catPetCare.toString(),
        vehicle: lang.catVehicle.toString(),
        security: lang.catSecurity.toString(),
        family: lang.catFamily.toString(),
        boost: lang.catBoost.toString(),
        storage: lang.catStorage.toString()
    };

    const card = buildCard({
        title: lang.title,
        description: lang.subtitle,
        accentColor: ACCENT.primary
    })
        .addSeparator()
        .addText(lang.catalogIntro({ wallet: (profile.wallet || 0).toLocaleString() }));

    for (const [catKey, catName] of Object.entries(categories)) {
        const items = Object.entries(SHOP_ITEMS).filter(([, item]) => item.category === catKey);
        if (items.length > 0) {
            const itemsText = items.map(([id, item]) => {
                const locItem = resolveEntity('items', id, item);
                return `• **\`${id}\`** — **${locItem.name}** (\`$${item.price.toLocaleString()}\`)\n> *${locItem.description}*`;
            }).join('\n\n');
            card.addSeparator().addText(`### ${catName}\n\n${itemsText}`);
        }
    }

    card.addSeparator().addText(
        `### ${lang.howToPurchaseHeader}\n${lang.howToPurchaseDesc}`
    );

    return card;
}

function buildCatalogActionRows() {
    const options = Object.entries(SHOP_ITEMS).slice(0, 25).map(([id, item]) => {
        const locItem = resolveEntity('items', id, item);
        return {
            label: `${locItem.name} ($${item.price.toLocaleString()})`,
            value: id,
            description: locItem.description?.slice(0, 50) || id,
            emoji: locItem.emoji || '🛒'
        };
    });

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('shop_select_item')
            .setPlaceholder(lang.selectItemPlaceholder.toString())
            .addOptions(options)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('shop_close', lang.btnClose)
    );

    return [selectRow, btnRow];
}

async function executeBuyItem(profile, message, itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item) {
        return {
            error: 'invalid',
            card: cards.warning(
                lang.invalidItemIdTitle,
                lang.invalidItemIdDesc({ id: itemId })
            )
        };
    }

    const locItem = resolveEntity('items', itemId, item);
    const mutation = await EconomyManager.mutateProfileAtomically({
        userId: message.author.id,
        guildId: message.guild.id,
        referenceId: `shop-buy:${message.id}:${itemId}`,
        mutate: async current => {
    profile = current;
    if ((current.wallet || 0) < item.price) {
        return { success: false, error: 'funds', card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ name: locItem.name, price: item.price.toLocaleString(), wallet: (current.wallet || 0).toLocaleString(), shortage: (item.price - (current.wallet || 0)).toLocaleString() })) };
    }
    const cooldown = EconomyManager.checkCooldown(current, 'shop');
    if (cooldown.onCooldown) return { success: false, error: 'cooldown', card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ seconds: cooldown.timeLeft.seconds })) };

    if (itemId === 'pet_food' && !(current.pets || []).length) return { success: false, error: 'pets', card: cards.warning(lang.noPetsTitle, lang.noPetsDesc({ name: locItem.name })) };
    if (itemId === 'car_repair' && !(current.cars || []).some(car => car.carId === current.activeCar)) return { success: false, error: 'car', card: cards.warning(lang.noCarTitle, lang.noCarDesc({ name: locItem.name })) };
    if (itemId === 'security_upgrade' && !(current.properties || []).some(property => property.propertyId === current.primaryResidence)) return { success: false, error: 'house', card: cards.warning(lang.noHouseTitle, lang.noHouseDesc) };
    if (itemId === 'family_vacation' && !(current.familyMembers || []).length) return { success: false, error: 'family', card: cards.warning(lang.noFamilyTitle, lang.noFamilyDesc) };

    current.wallet -= item.price;
    if (!current.cooldowns) current.cooldowns = {};
    current.cooldowns.shop = new Date();

    let effectDescription = '';
    switch (itemId) {
        case 'pet_food':
            current.pets.forEach(pet => {
                pet.hunger = Math.min(100, (pet.hunger || 0) + 40);
                pet.health = Math.min(100, (pet.health || 0) + 10);
            });
            effectDescription = lang.petFedEffect({ count: current.pets.length });
            break;

        case 'car_repair': {
            const rawCar = (current.cars || []).find(c => c.carId === current.activeCar);
            const locCar = resolveEntity('vehicles', rawCar.carId, rawCar);
            rawCar.durability = Math.min(100, (rawCar.durability || 0) + 30);
            effectDescription = lang.carRepairedEffect({ name: locCar.name, durability: rawCar.durability });
            break;
        }

        case 'security_upgrade': {
            const primaryProperty = (current.properties || []).find(p => p.propertyId === current.primaryResidence);
            const locProp = resolveEntity('properties', primaryProperty.propertyId, primaryProperty);
            primaryProperty.securityLevel = Math.min(10, (primaryProperty.securityLevel || 0) + 2);
            effectDescription = lang.securityFortifiedEffect({ name: locProp.name, level: primaryProperty.securityLevel });
            break;
        }

        case 'family_vacation':
            current.familyMembers.forEach(member => {
                member.bond = Math.min(100, (member.bond || 0) + 15);
            });
            {
                const newFamilyBond = Math.floor(current.familyMembers.reduce((sum, m) => sum + (m.bond || 0), 0) / current.familyMembers.length);
                current.familyBond = newFamilyBond;
                effectDescription = lang.familyVacationEffect({ bond: current.familyBond });
            }
            break;

        case 'lucky_charm':
        case 'gambling_luck':
        case 'robbery_protection':
        case 'vault_expansion':
        case 'bank_upgrade':
        case 'business_boost_small':
        case 'business_boost_medium':
        case 'business_boost_large': {
            const effect = item.effect;
            const duration = effect.duration;
            const stacks = 1;

            const existingEffect = (current.activeEffects || []).find(active => active.type === effect.type);
            if (!current.activeEffects) current.activeEffects = [];
            if (existingEffect && effect.type === 'gambling_luck') {
                existingEffect.stacks = Math.min(5, (existingEffect.stacks || 0) + stacks);
                existingEffect.expiryTime = new Date(Date.now() + duration);
            } else {
                if (existingEffect) current.activeEffects.splice(current.activeEffects.indexOf(existingEffect), 1);
                current.activeEffects.push({ effectId: `${effect.type}_${Date.now()}`, name: effect.type.replace('_', ' ').toUpperCase(), type: effect.type, multiplier: effect.multiplier, stacks, expiryTime: new Date(Date.now() + duration) });
            }

            const hours = Math.floor(duration / (60 * 60 * 1000));
            const boostPercent = ((effect.multiplier - 1) * 100).toFixed(0);
            effectDescription = lang.boostActivatedEffect({
                name: locItem.name,
                percent: boostPercent,
                type: effect.type.replace('_', ' '),
                hours
            });
            break;
        }

        default:
            effectDescription = lang.genericSuccessEffect({ name: locItem.name });
            break;
    }

    if (!Array.isArray(current.transactions)) current.transactions = [];
    current.transactions.push({
        type: 'expense',
        amount: item.price,
        description: lang.txPurchasedItem({ name: locItem.name }).toString(),
        category: 'shop',
        timestamp: new Date()
    });

    return { effectDescription };
        }
    });
    if (!mutation?.success) return { error: mutation?.error || (mutation?.duplicate ? 'duplicate' : 'failed'), card: mutation?.card || cards.warning(lang.errorTitle, lang.errorMessage) };
    profile = mutation.profile;
    const effectDescription = mutation.effectDescription;

    const receiptCard = buildCard({
        title: lang.receiptTitle({ name: locItem.name }),
        accentColor: ACCENT.success
    })
        .addText(`### ${lang.purchaseReceiptHeader}\n` + lang.purchaseReceiptDetails({
            name: locItem.name,
            price: item.price.toLocaleString(),
            wallet: profile.wallet.toLocaleString()
        }))
        .addSeparator()
        .addText(`### ${lang.effectAppliedHeader}\n` + lang.effectAppliedDetails({
            effect: effectDescription,
            desc: locItem.description
        }));

    const rows = [new ActionRowBuilder().addComponents(btn.secondary('shop_close', lang.btnClose))];
    return { success: true, card: receiptCard, rows };
}

module.exports = {
    name: 'shop',
    description: lang.cmdDesc.toString(),
    usage: '!shop | !shop buy <item_id>',
    cooldown: 10,
    async execute(message, args) {
        try {
            const profile = await EconomyManager.getProfile(message.author.id, message.guild.id);

            
            const cooldownCheck = EconomyManager.checkCooldown(profile, 'shop');
            if (cooldownCheck.onCooldown) {
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ seconds: cooldownCheck.timeLeft.seconds })
                ));
            }

            
            if (args[0]?.toLowerCase() === 'buy' && args[1]) {
                const itemId = args[1].toLowerCase();
                const result = await executeBuyItem(profile, message, itemId);
                if (result.rows) {
                    return sendV2(message, { card: result.card, rows: result.rows });
                }
                return sendV2(message, result.card);
            }

            
            const catalogCard = buildCatalogCard(profile);
            const rows = buildCatalogActionRows();

            const sentMessage = await sendV2(message, { card: catalogCard, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'shop_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'shop_select_item') {
                        const selectedItemId = interaction.values[0];
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const result = await executeBuyItem(freshProfile, message, selectedItemId);

                        const receiptRows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('shop_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows: receiptRows });
                    }
                } catch (err) {
                    console.error('Error in shop collector:', err);
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in shop command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
