'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { HuntingManager } = require('../../models/economy/huntingManager');
const {
    HUNTING_VEHICLES,
    HUNTING_WEAPONS,
    HUNTING_COMPANIONS,
    HUNTING_WAREHOUSES,
    FUEL_TYPES,
    AMMO_TYPES,
    MAINTENANCE_SUPPLIES
} = require('../../models/economy/constants/huntingData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.huntshop);

const CATEGORIES = {
    vehicles: { get name() { return lang.catVehicles.toString(); }, icon: '🚗', data: HUNTING_VEHICLES, color: ACCENT.primary },
    weapons: { get name() { return lang.catWeapons.toString(); }, icon: '🔫', data: HUNTING_WEAPONS, color: ACCENT.danger },
    companions: { get name() { return lang.catCompanions.toString(); }, icon: '👥', data: HUNTING_COMPANIONS, color: ACCENT.purple || ACCENT.info },
    warehouses: { get name() { return lang.catWarehouses.toString(); }, icon: '🏭', data: HUNTING_WAREHOUSES, color: ACCENT.warning },
    fuel: { get name() { return lang.catFuel.toString(); }, icon: '⛽', data: FUEL_TYPES, color: ACCENT.success },
    ammo: { get name() { return lang.catAmmo.toString(); }, icon: '🔫', data: AMMO_TYPES, color: ACCENT.warning },
    maintenance: { get name() { return lang.catMaintenance.toString(); }, icon: '🔧', data: MAINTENANCE_SUPPLIES, color: ACCENT.info }
};

function buildOverviewCard(profile) {
    const card = buildCard({
        title: lang.title,
        description: lang.subtitle,
        accentColor: ACCENT.primary
    })
        .addSeparator()
        .addText(`### 🏪 ${lang.categoriesTitle}\n${lang.categoriesOverview}`)
        .addSeparator()
        .addText(`### ${lang.quickActionsHeader}\n${lang.quickActionsDetails}`)
        .addSeparator()
        .addText(`### 💳 ${lang.budgetTitle}\n${lang.currentBalanceFormat({ balance: (profile.wallet || 0).toLocaleString() })}`);

    return card;
}

function buildCategoryCard(profile, categoryKey) {
    const cat = CATEGORIES[categoryKey];
    if (!cat) return buildOverviewCard(profile);

    const card = buildCard({
        title: lang.categoryTitle({ icon: cat.icon, name: cat.name }),
        description: lang.categoryCardDesc({ name: cat.name.toLowerCase() }),
        accentColor: cat.color
    });

    Object.entries(cat.data).forEach(([itemId, rawItem]) => {
        const item = resolveEntity(`hunting_${categoryKey}`, itemId, rawItem);
        const canAfford = (profile.wallet || 0) >= rawItem.price;
        const affordBadge = canAfford ? '✅' : '❌';

        let specs = '';
        if (categoryKey === 'fuel') {
            specs = `> **⚡ Efficiency:** \`${Math.floor((2.0 - rawItem.efficiency) * 100)}% savings\` • **Value:** \`${rawItem.fuelValue} units\``;
        } else if (categoryKey === 'ammo') {
            const compatible = Array.isArray(rawItem.compatibleWeapons) ? rawItem.compatibleWeapons.join(', ') : 'All';
            specs = `> **🔫 Compatible:** \`${compatible}\`\n> **💥 Damage:** \`+${Math.floor((rawItem.damage - 1) * 100)}%\` • **🎯 Accuracy:** \`+${Math.floor((rawItem.accuracy - 1) * 100)}%\``;
        } else if (categoryKey === 'maintenance') {
            specs = `> **🔧 Repair Amount:** \`${rawItem.repairAmount || 'N/A'}\' • **Uses:** \`${rawItem.uses || 1}\``;
        } else if (categoryKey === 'vehicles') {
            specs = `> **⚡ Speed:** \`${rawItem.speed || 50}\` • **⛽ Tank:** \`${rawItem.fuelCapacity || 100}\` • **📦 Cargo:** \`${rawItem.cargoCapacity || 50}\``;
        } else if (categoryKey === 'weapons') {
            specs = `> **💥 Damage:** \`${rawItem.damage || 50}\` • **🎯 Accuracy:** \`${rawItem.accuracy || 75}%\` • **📦 Ammo:** \`${rawItem.ammoCapacity || 30}\``;
        } else if (categoryKey === 'companions') {
            specs = `> **⭐ Skill:** \`${rawItem.skill || 50}%\` • **❤️ Health:** \`${rawItem.health || 100}\``;
        } else if (categoryKey === 'warehouses') {
            specs = `> **📦 Capacity:** \`${rawItem.capacity || 50}\` • **❄️ Preservation:** \`${rawItem.preservation || 5}\``;
        }

        card.addSeparator().addText(
            lang.itemDisplayBlock({
                name: item.name,
                id: itemId,
                affordBadge,
                specs: specs ? `${specs}\n` : '',
                price: rawItem.price.toLocaleString(),
                desc: item.description || rawItem.description
            })
        );
    });

    card.addSeparator().addText(
        `### 💳 ${lang.budgetTitle}\n${lang.currentBalanceFormat({ balance: (profile.wallet || 0).toLocaleString() })}`
    );

    return card;
}

async function processPurchaseUnsafe(profile, itemId, quantity = 1) {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
        return { error: 'quantity', card: cards.warning(lang.errorTitle, lang.errorMessage) };
    }
    let item = null;
    let category = '';
    let price = 0;

    if (HUNTING_VEHICLES[itemId]) {
        item = HUNTING_VEHICLES[itemId];
        category = 'vehicle';
        price = item.price;
    } else if (HUNTING_WEAPONS[itemId]) {
        item = HUNTING_WEAPONS[itemId];
        category = 'weapon';
        price = item.price;
    } else if (HUNTING_COMPANIONS[itemId]) {
        item = HUNTING_COMPANIONS[itemId];
        category = 'companion';
        price = item.price;
    } else if (HUNTING_WAREHOUSES[itemId]) {
        item = HUNTING_WAREHOUSES[itemId];
        category = 'warehouse';
        price = item.price;
    } else if (FUEL_TYPES[itemId]) {
        item = FUEL_TYPES[itemId];
        category = 'fuel';
        price = item.price * quantity;
    } else if (AMMO_TYPES[itemId]) {
        item = AMMO_TYPES[itemId];
        category = 'ammo';
        price = item.price * quantity;
    } else if (MAINTENANCE_SUPPLIES[itemId]) {
        item = MAINTENANCE_SUPPLIES[itemId];
        category = 'maintenance';
        price = item.price * quantity;
    }

    if (!item) {
        return {
            error: 'not_found',
            card: cards.error(lang.itemNotFoundTitle, lang.itemNotFoundDesc({ itemId }))
        };
    }

    const locItem = resolveEntity(`hunting_${category}`, itemId, item);

    if ((profile.wallet || 0) < price) {
        return {
            error: 'funds',
            card: cards.warning(
                lang.insufficientFundsTitle,
                lang.insufficientFundsDesc({
                    itemName: locItem.name,
                    price: price.toLocaleString(),
                    balance: (profile.wallet || 0).toLocaleString()
                })
            )
        };
    }

    profile.wallet = (profile.wallet || 0) - price;
    if (!Array.isArray(profile.transactions)) profile.transactions = [];

    let successCard = buildCard({
        title: lang.purchaseSuccessTitle,
        description: lang.purchaseSuccessDesc({ name: `${quantity > 1 ? `${quantity}x ` : ''}${locItem.name}` }),
        accentColor: ACCENT.success
    });

    if (category === 'fuel' || category === 'ammo' || category === 'maintenance') {
        if (!Array.isArray(profile.huntingInventory)) profile.huntingInventory = [];
        profile.huntingInventory.push({
            itemId: `${itemId}_${Date.now()}`,
            name: `${locItem.name} (x${quantity})`,
            type: category,
            rarity: 'common',
            baseValue: price,
            currentValue: price,
            weight: quantity,
            quantity,
            huntDate: new Date(),
            description: item.description,
            consumableData: {
                itemType: itemId,
                usesRemaining: quantity
            }
        });

        profile.transactions.push({
            type: 'expense',
            amount: price,
            description: lang.txPurchasedItem({ qty: quantity, name: locItem.name }).toString(),
            category: 'hunting',
            timestamp: new Date()
        });

        successCard.addSeparator().addText(
            lang.purchasedItemDetails({
                price: price.toLocaleString(),
                balance: profile.wallet.toLocaleString()
            })
        );
    } else if (category === 'vehicle') {
        if (!Array.isArray(profile.huntingVehicles)) profile.huntingVehicles = [];
        profile.huntingVehicles.push({
            vehicleId: itemId,
            name: locItem.name,
            type: item.type || 'atv',
            tier: item.tier || 1,
            speed: item.speed || 50,
            fuelCapacity: item.fuelCapacity || 100,
            currentFuel: item.fuelCapacity || 100,
            durability: item.durability || 100,
            maxDurability: item.durability || 100,
            cargoCapacity: item.cargoCapacity || 50,
            purchasePrice: price,
            dateAcquired: new Date()
        });
        if (!profile.activeVehicle) profile.activeVehicle = itemId;

        profile.transactions.push({
            type: 'expense',
            amount: price,
            description: lang.txPurchasedVehicle({ name: locItem.name }).toString(),
            category: 'hunting',
            timestamp: new Date()
        });

        successCard.addSeparator().addText(
            lang.purchasedVehicleDetails({
                type: (item.type || 'VEHICLE').toUpperCase(),
                tier: item.tier || 1,
                capacity: item.fuelCapacity || 100,
                cargo: item.cargoCapacity || 50,
                price: price.toLocaleString(),
                balance: profile.wallet.toLocaleString()
            })
        );
    } else if (category === 'weapon') {
        if (!Array.isArray(profile.huntingWeapons)) profile.huntingWeapons = [];
        profile.huntingWeapons.push({
            weaponId: itemId,
            name: locItem.name,
            type: item.type || 'rifle',
            tier: item.tier || 1,
            damage: item.damage || 50,
            accuracy: item.accuracy || 75,
            durability: item.durability || 100,
            maxDurability: item.durability || 100,
            ammoCapacity: item.ammoCapacity || 30,
            currentAmmo: item.ammoCapacity || 30,
            criticalChance: item.criticalChance || 10,
            purchasePrice: price,
            dateAcquired: new Date()
        });
        if (!profile.activeWeapon) profile.activeWeapon = itemId;

        profile.transactions.push({
            type: 'expense',
            amount: price,
            description: lang.txPurchasedWeapon({ name: locItem.name }).toString(),
            category: 'hunting',
            timestamp: new Date()
        });

        successCard.addSeparator().addText(
            lang.purchasedWeaponDetails({
                damage: item.damage || 50,
                accuracy: item.accuracy || 75,
                capacity: item.ammoCapacity || 30,
                critical: item.criticalChance || 10,
                price: price.toLocaleString(),
                balance: profile.wallet.toLocaleString()
            })
        );
    } else if (category === 'companion') {
        if (!Array.isArray(profile.huntingCompanions)) profile.huntingCompanions = [];
        if (!Array.isArray(profile.activeCompanions)) profile.activeCompanions = [];

        profile.huntingCompanions.push({
            companionId: itemId,
            name: locItem.name,
            type: item.type || 'dog',
            tier: item.tier || 1,
            health: 100,
            maxHealth: 100,
            stamina: 100,
            skill: item.skill || 50,
            experience: 0,
            level: 1,
            purchasePrice: price,
            dateAcquired: new Date()
        });
        if (profile.activeCompanions.length < (profile.maxCompanions || 3)) {
            profile.activeCompanions.push(itemId);
        }

        profile.transactions.push({
            type: 'expense',
            amount: price,
            description: lang.txPurchasedCompanion({ name: locItem.name }).toString(),
            category: 'hunting',
            timestamp: new Date()
        });

        successCard.addSeparator().addText(
            lang.purchasedCompanionDetails({
                name: locItem.name,
                type: (item.type || 'COMPANION').toUpperCase(),
                skill: item.skill || 50,
                price: price.toLocaleString(),
                balance: profile.wallet.toLocaleString()
            })
        );
    } else if (category === 'warehouse') {
        if (!Array.isArray(profile.huntingWarehouses)) profile.huntingWarehouses = [];
        profile.huntingWarehouses.push({
            warehouseId: itemId,
            name: locItem.name,
            type: item.type || 'basic_storage',
            tier: item.tier || 1,
            capacity: item.capacity || 50,
            preservation: item.preservation || 5,
            bonusMultiplier: item.bonusMultiplier || 1.0,
            purchasePrice: price,
            dateAcquired: new Date()
        });

        profile.transactions.push({
            type: 'expense',
            amount: price,
            description: lang.txPurchasedWarehouse({ name: locItem.name }).toString(),
            category: 'hunting',
            timestamp: new Date()
        });

        successCard.addSeparator().addText(
            lang.purchasedWarehouseDetails({
                name: locItem.name,
                capacity: item.capacity || 50,
                multiplier: item.bonusMultiplier || 1.0,
                price: price.toLocaleString(),
                balance: profile.wallet.toLocaleString()
            })
        );
    }

    const finishRows = [
        new ActionRowBuilder().addComponents(
            btn.primary('huntshop_go_hunt', lang.btnGoHunt),
            btn.secondary('huntshop_close', lang.btnClose)
        )
    ];

    return { success: true, card: successCard, rows: finishRows };
}

async function processPurchase(profile, itemId, quantity = 1, referenceId = `huntshop:${Date.now()}`) {
    const settlement = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId,
        guildId: profile.guildId,
        referenceId,
        mutate: async current => {
            const result = await processPurchaseUnsafe(current, itemId, quantity);
            return result.error ? { success: false, result } : { result };
        }
    });
    if (!settlement.success) {
        return settlement.result || { error: settlement.duplicate ? 'duplicate' : 'failed', card: cards.warning(lang.errorTitle, lang.errorMessage) };
    }
    return settlement.result;
}

module.exports = {
    name: 'huntshop',
    aliases: ['huntstore', 'buyhunting', 'outfitter'],
    description: lang.cmdDesc.toString(),
    usage: '!huntshop | !huntshop buy <item_id> [quantity] | !huntshop refuel | !huntshop reload',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const profile = await EconomyManager.getProfile(userId, message.guild.id);
            const action = args[0]?.toLowerCase();

            
            if (action === 'refuel' && args[1] && args[2]) {
                const vehicleIndex = parseInt(args[1], 10) - 1;
                const fuelType = args[2].toLowerCase();
                const quantity = parseInt(args[3], 10) || 1;

                if (isNaN(vehicleIndex) || vehicleIndex < 0 || vehicleIndex >= (profile.huntingVehicles || []).length) {
                    return sendV2(message, cards.error(
                        lang.invalidVehicleTitle,
                        lang.invalidVehicleDesc
                    ));
                }

                const vehicle = profile.huntingVehicles[vehicleIndex];

                try {
                    const settlement = await EconomyManager.mutateProfileAtomically({ userId, guildId: message.guild.id, referenceId: `huntshop-refuel:${message.id}`, mutate: async current => {
                        const target = current.huntingVehicles?.[vehicleIndex];
                        if (!target) return { success: false, error: 'Vehicle not found!' };
                        return HuntingManager.refuelVehicle(current, target.vehicleId, fuelType, quantity);
                    }});
                    if (!settlement.success) throw new Error(settlement.error || 'This refuel request was already processed.');
                    const result = settlement;
                    const currentProfile = settlement.profile;

                    const refuelCard = buildCard({
                        title: lang.refueledTitle,
                        description: lang.refueledDesc({ fuelAdded: result.fuelAdded, vehicleName: vehicle.name }),
                        accentColor: ACCENT.success
                    })
                        .addSeparator()
                        .addText(
                            lang.refueledDetails({
                                fuel: result.fuelAdded,
                                level: result.newFuelLevel,
                                capacity: vehicle.fuelCapacity,
                                cost: result.cost.toLocaleString(),
                                balance: currentProfile.wallet.toLocaleString()
                            })
                        );

                    const rows = [new ActionRowBuilder().addComponents(btn.secondary('huntshop_close', lang.btnClose))];
                    return sendWithCloseCollector(message, { card: refuelCard, rows }, userId);
                } catch (error) {
                    return sendV2(message, cards.error(lang.errorTitle, error.message));
                }
            }

            
            if (action === 'reload' && args[1] && args[2]) {
                const weaponIndex = parseInt(args[1], 10) - 1;
                const ammoType = args[2].toLowerCase();
                const quantity = parseInt(args[3], 10) || 1;

                if (isNaN(weaponIndex) || weaponIndex < 0 || weaponIndex >= (profile.huntingWeapons || []).length) {
                    return sendV2(message, cards.error(
                        lang.invalidWeaponTitle,
                        lang.invalidWeaponDesc
                    ));
                }

                const weapon = profile.huntingWeapons[weaponIndex];

                try {
                    const settlement = await EconomyManager.mutateProfileAtomically({ userId, guildId: message.guild.id, referenceId: `huntshop-reload:${message.id}`, mutate: async current => {
                        const target = current.huntingWeapons?.[weaponIndex];
                        if (!target) return { success: false, error: 'Weapon not found!' };
                        return HuntingManager.reloadWeapon(current, target.weaponId, ammoType, quantity);
                    }});
                    if (!settlement.success) throw new Error(settlement.error || 'This reload request was already processed.');
                    const result = settlement;
                    const currentProfile = settlement.profile;

                    const reloadCard = buildCard({
                        title: lang.reloadedTitle,
                        description: lang.reloadedDesc({ ammoAdded: result.ammoAdded, weaponName: weapon.name }),
                        accentColor: ACCENT.success
                    })
                        .addSeparator()
                        .addText(
                            lang.reloadedDetails({
                                ammo: result.ammoAdded,
                                level: result.newAmmoLevel,
                                capacity: weapon.ammoCapacity,
                                cost: result.cost.toLocaleString(),
                                balance: currentProfile.wallet.toLocaleString()
                            })
                        );

                    const rows = [new ActionRowBuilder().addComponents(btn.secondary('huntshop_close', lang.btnClose))];
                    return sendWithCloseCollector(message, { card: reloadCard, rows }, userId);
                } catch (error) {
                    return sendV2(message, cards.error(lang.errorTitle, error.message));
                }
            }

            
            if (action === 'buy' && args[1]) {
                const itemId = args[1].toLowerCase();
                const quantity = Math.max(1, parseInt(args[2], 10) || 1);
                const result = await processPurchase(profile, itemId, quantity, `huntshop-buy:${message.id}`);
                if (result.rows) {
                    return sendWithCloseCollector(message, { card: result.card, rows: result.rows }, userId, {
                        onCollect: async (i, c) => {
                            if (i.customId === 'huntshop_go_hunt') {
                                c.stop('hunt');
                                const huntCmd = require('./hunt');
                                huntCmd.execute(message, []);
                                return true;
                            }
                        }
                    });
                }
                return sendV2(message, result.card);
            }

            
            const categorySelectRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('huntshop_category_select')
                    .setPlaceholder(lang.selectCategoryPlaceholder.toString())
                    .addOptions(
                        Object.entries(CATEGORIES).map(([key, cat]) => ({
                            label: cat.name,
                            value: key,
                            description: lang.browseCategory({ name: cat.name.toLowerCase() }).toString(),
                            emoji: cat.icon
                        }))
                    )
            );

            const initialBtnRow = new ActionRowBuilder().addComponents(
                btn.danger('huntshop_close', lang.btnClose)
            );

            let initialCard;
            if (action && CATEGORIES[action]) {
                initialCard = buildCategoryCard(profile, action);
            } else {
                initialCard = buildOverviewCard(profile);
            }

            const sentMessage = await sendV2(message, { card: initialCard, rows: [categorySelectRow, initialBtnRow] });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'huntshop_close') {
                        collector.stop('user_closed');
                        return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }

                    if (interaction.customId === 'huntshop_go_hunt') {
                        collector.stop('go_hunt');
                        const huntCmd = require('./hunt');
                        return huntCmd.execute(message, []);
                    }

                    if (interaction.customId === 'huntshop_overview') {
                        const freshProfile = await EconomyManager.getProfile(userId, message.guild.id);
                        return editV2(sentMessage, { card: buildOverviewCard(freshProfile), rows: [categorySelectRow, initialBtnRow] });
                    }

                    if (interaction.customId === 'huntshop_category_select') {
                        const chosenCategory = interaction.values[0];
                        const freshProfile = await EconomyManager.getProfile(userId, message.guild.id);
                        const cat = CATEGORIES[chosenCategory];
                        const catCard = buildCategoryCard(freshProfile, chosenCategory);

                        
                        const itemOptions = Object.entries(cat.data).slice(0, 25).map(([id, rawItm]) => {
                            const itm = resolveEntity(`hunting_${chosenCategory}`, id, rawItm);
                            return {
                                label: itm.name,
                                value: id,
                                description: `$${rawItm.price.toLocaleString()} • ${(itm.description || rawItm.description)?.slice(0, 45)}`
                            };
                        });

                        const itemSelectRow = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('huntshop_item_select')
                                .setPlaceholder(lang.selectItemPlaceholder.toString())
                                .addOptions(itemOptions)
                        );

                        const navBtnRow = new ActionRowBuilder().addComponents(
                            btn.primary('huntshop_overview', lang.btnDepartments),
                            btn.danger('huntshop_close', lang.btnClose)
                        );

                        return editV2(sentMessage, { card: catCard, rows: [itemSelectRow, categorySelectRow, navBtnRow] });
                    }

                    if (interaction.customId === 'huntshop_item_select') {
                        const chosenItem = interaction.values[0];
                        const freshProfile = await EconomyManager.getProfile(userId, message.guild.id);
                        const result = await processPurchase(freshProfile, chosenItem, 1, `huntshop-buy:${interaction.id}`);

                        const receiptRows = result.rows || [
                            new ActionRowBuilder().addComponents(
                                btn.primary('huntshop_overview', lang.btnDepartments),
                                btn.secondary('huntshop_close', lang.btnClose)
                            )
                        ];
                        return editV2(sentMessage, { card: result.card, rows: receiptRows });
                    }
                } catch (err) {
                    console.error('Error in huntshop collector:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in huntshop command:', error);
            return sendV2(message, cards.error(lang.errorTitle, error.message || lang.errorMessage));
        }
    }
};
