'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { CARS } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.buycar);

function buildCarCatalogCard() {
    const card = buildCard({
        title: lang.catalogTitle,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.catalogSubtitle}**\n> ${lang.catalogIntro}`)
        .addSeparator();

    const carsByType = {};
    Object.entries(CARS).forEach(([id, car]) => {
        if (!carsByType[car.type]) carsByType[car.type] = [];
        carsByType[car.type].push([id, car]);
    });

    Object.entries(carsByType).forEach(([type, cars]) => {
        card.addText(`### ${type.toUpperCase()}`);
        const carText = cars.map(([id, car]) => {
            const locCar = resolveEntity('vehicles', id, car);
            return `**\`${id}\`** — ${locCar.name}\n> **${lang.priceLabel}:** \`$${car.price.toLocaleString()}\` • ${lang.speedLabel}: \`${car.speed}\` • ${lang.accelLabel}: \`${car.acceleration}\` • ${lang.handlingLabel}: \`${car.handling}\``;
        }).join('\n');
        card.addText(carText);
    });

    card.addSeparator()
        .addText(`> ${lang.howToPurchase}`);

    return card;
}

function buildCarCatalogActionRows(profile) {
    const ownedIds = new Set((profile.cars || []).map(c => c.carId));
    const wallet = profile.wallet || 0;

    const selectOptions = Object.entries(CARS).map(([id, car]) => {
        const locCar = resolveEntity('vehicles', id, car);
        const isOwned = ownedIds.has(id);
        const canAfford = wallet >= car.price;
        return {
            label: locCar.name,
            value: id,
            description: `$${car.price.toLocaleString()} • Speed ${car.speed} • Handling ${car.handling}${isOwned ? ' [Owned]' : !canAfford ? ' [Short]' : ''}`
        };
    });

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('buycar_select')
            .setPlaceholder(lang.selectPlaceholder.toString())
            .addOptions(selectOptions)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('buycar_close', lang.btnClose)
    );

    return [menuRow, btnRow];
}

async function processCarPurchase(userId, guildId, carId, referenceId) {
    const carData = CARS[carId];
    if (!carData) {
        return { error: 'invalid', card: cards.warning(lang.invalidCarTitle, lang.invalidCarDesc({ id: carId })) };
    }

    const locCar = resolveEntity('vehicles', carId, carData);
    const purchase = await EconomyManager.mutateProfileAtomically({
        userId, guildId, referenceId,
        mutate: profile => {
            if ((profile.cars || []).some(car => car.carId === carId)) return { success: false, reason: 'owned' };
            const primaryProperty = profile.properties?.find(p => p.propertyId === profile.primaryResidence);
            const garageCap = primaryProperty?.garageCapacity || 1;
            if ((profile.cars || []).length >= garageCap) return { success: false, reason: 'garage_full', capacity: garageCap };
            if ((Number(profile.wallet) || 0) < carData.price) return { success: false, reason: 'funds', wallet: Number(profile.wallet) || 0 };

            profile.wallet = (Number(profile.wallet) || 0) - carData.price;
            if (!Array.isArray(profile.cars)) profile.cars = [];
            profile.cars.push({
                carId, name: locCar.name, type: carData.type,
                speed: carData.speed, acceleration: carData.acceleration, handling: carData.handling,
                purchasePrice: carData.price, currentValue: carData.price,
                maintenanceCost: carData.maintenanceCost, durability: 100,
                raceWins: 0, raceLosses: 0, totalDistance: 0, dateAcquired: new Date()
            });
            if (!profile.activeCar) profile.activeCar = carId;
            if (!Array.isArray(profile.transactions)) profile.transactions = [];
            profile.transactions.push({
                type: 'expense', amount: carData.price,
                description: lang.txPurchasedCar({ name: locCar.name }).toString(), category: 'vehicle'
            });
            return { car: locCar.name };
        }
    });
    if (!purchase.success) {
        if (purchase.reason === 'owned') return { error: 'owned', card: cards.warning(lang.alreadyOwnedTitle, lang.alreadyOwnedDesc({ name: carData.name })) };
        if (purchase.reason === 'garage_full') return { error: 'garage_full', card: cards.warning(lang.garageFullTitle, lang.garageFullDesc({ capacity: purchase.capacity })) };
        if (purchase.reason === 'duplicate') return { error: 'duplicate', card: cards.info(lang.closedTitle, lang.closedDesc) };
        const wallet = purchase.wallet || 0;
        return { error: 'funds', card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({
            name: carData.name, price: carData.price.toLocaleString(), wallet: wallet.toLocaleString(), shortage: Math.max(0, carData.price - wallet).toLocaleString()
        })) };
    }
    const profile = purchase.profile;

    const overallPerformance = ((carData.speed + carData.acceleration + carData.handling) / 3).toFixed(1);

    const successCard = buildCard({
        title: lang.successTitle,
        accentColor: ACCENT.success
    })
        .addText(`> **${lang.successSubtitle}**\n> ${lang.successDesc({ name: carData.name, price: carData.price.toLocaleString() })}`)
        .addSeparator()
        .addText(`### ${lang.specsTitle}`)
        .addText(
            `**🚗 ${lang.vehicleLabel}:** \`${carData.name}\` (${carData.type})\n` +
            `**🏁 ${lang.speedLabel}:** \`${carData.speed}/100\` • **⚡ ${lang.accelLabel}:** \`${carData.acceleration}/100\` • **🎯 ${lang.handlingLabel}:** \`${carData.handling}/100\`\n` +
            `**📊 ${lang.overallRatingLabel}:** \`${overallPerformance}/100\` • **🔧 ${lang.conditionLabel}:** \`${lang.brandNew}\``
        )
        .addSeparator()
        .addText(`### ${lang.summaryTitle}`)
        .addText(
            `**💰 ${lang.priceLabel}:** \`$${carData.price.toLocaleString()}\`\n` +
            `**💳 ${lang.walletLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
            `**🏎️ ${lang.totalCarsLabel}:** \`${profile.cars.length}\``
        );

    return { success: true, card: successCard };
}

module.exports = {
    name: 'buycar',
    aliases: ['car-buy', 'purchasecar'],
    description: lang.cmdDesc.toString(),
    usage: '!buycar [car_id]',
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;

            
            if (args[0]) {
                const carId = args[0].toLowerCase();
                const result = await processCarPurchase(userId, guildId, carId, `buycar:${message.id}`);
                return sendV2(message, result.card);
            }

            
            const profile = await EconomyManager.getProfile(userId, guildId);
            const catalogCard = buildCarCatalogCard();
            const actionRows = buildCarCatalogActionRows(profile);

            const sentMessage = await sendV2(message, {
                card: catalogCard,
                rows: actionRows
            });

            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({
                time: 120000
            });

            collector.on('collect', async (interaction) => {
            try {    
                    if (interaction.user.id !== message.author.id) {
                        return replyUnauthorized(interaction);
                    }
    
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.isStringSelectMenu() && interaction.customId === 'buycar_select') {
                        const selectedId = interaction.values[0];
                        const result = await processCarPurchase(userId, guildId, selectedId, `buycar:${interaction.id}`);
                        collector.stop('purchased');
                        return editV2(sentMessage, result.card);
                    } else if (interaction.customId === 'buycar_close') {
                        collector.stop('closed');
                        return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }
            } catch (err) {
                console.error('[buycar.js] Error in component collector:', err);
            }
        });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed' || reason === 'purchased') return;
                await editV2(sentMessage, {
                    card: catalogCard,
                    rows: []
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in buycar command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
