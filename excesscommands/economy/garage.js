'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { CARS } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.garage);

function buildGarageCard(profile, username, notification = null) {
    const cars = profile.cars || [];
    const activeCarId = profile.activeCar || (cars[0]?.carId);
    const activeCar = cars.find(c => c.carId === activeCarId) || cars[0];

    const card = buildCard({
        title: lang.title({ user: username }),
        subtitle: lang.subtitle,
        accentColor: ACCENT.primary
    });

    if (notification) {
        card.addText(`> ${notification}`).addSeparator();
    }

    if (activeCar) {
        const localizedActive = resolveEntity('vehicles', activeCar.carId, activeCar);
        const conditionText = activeCar.durability > 75 ? lang.conditionExcellent :
            activeCar.durability > 40 ? lang.conditionGood : lang.conditionNeedsRepair;

        card.addText(`### 🏎️ Active: ${localizedActive.name} (\`${activeCar.type?.toUpperCase() || lang.defaultType}\`)`)
            .addText(
                `> **${lang.conditionLabel}:** \`${activeCar.durability || 100}%\` (${conditionText})\n` +
                `> **${lang.speedLabel}:** \`${activeCar.speed || 50}\` · **${lang.accelLabel}:** \`${activeCar.acceleration || 50}\` · **${lang.handlingLabel}:** \`${activeCar.handling || 50}\`\n` +
                `> **${lang.valuationLabel}:** \`$${(activeCar.currentValue || activeCar.purchasePrice || 15000).toLocaleString()}\``
            )
            .addSeparator();
    }

    const totalVal = cars.reduce((s, c) => s + (c.currentValue || c.purchasePrice || 0), 0);
    const avgCond = cars.length > 0 ? (cars.reduce((s, c) => s + (c.durability || 100), 0) / cars.length).toFixed(0) : '0';

    card.addText(`### 📊 ${lang.fleetStatsTitle}`)
        .addText(
            `> **Fleet Size:** \`${cars.length}\` vehicles\n` +
            `> **Combined Asset Value:** \`$${totalVal.toLocaleString()}\`\n` +
            `> **Average Durability:** \`${avgCond}%\``
        );

    if (cars.length > 0) {
        card.addSeparator().addText(`### 🚗 ${lang.collectionHeader({ count: cars.length })}`);
        const carLines = cars.map((c, i) => {
            const loc = resolveEntity('vehicles', c.carId, c);
            const status = c.carId === activeCarId ? `\`${lang.activeStatus}\`` : `\`${lang.parkedStatus}\``;
            return `**${i + 1}. ${loc.name}** — ${status} · \`${c.durability}%\` cond · \`$${(c.currentValue || c.purchasePrice || 0).toLocaleString()}\``;
        }).join('\n');
        card.addText(carLines);
    }

    return card;
}

function buildGarageActionRows(profile) {
    const cars = profile.cars || [];
    const rows = [];

    if (cars.length === 0) {
        rows.push(
            new ActionRowBuilder().addComponents(
                btn.primary('garage_dealership', lang.btnDealership),
                btn.danger('garage_close', lang.btnClose)
            )
        );
        return rows;
    }

    const selectOptions = cars.slice(0, 25).map((car, idx) => {
        const loc = resolveEntity('vehicles', car.carId, car);
        return {
            label: `${idx + 1}. ${loc.name}`,
            value: String(idx),
            description: lang.carOptionDesc({
                durability: car.durability,
                speed: car.speed,
                status: car.carId === profile.activeCar ? lang.statusActive.toString() : lang.statusParked.toString()
            }).toString(),
            emoji: '🏎️'
        };
    });

    if (selectOptions.length > 0) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('garage_select_menu')
                    .setPlaceholder(lang.selectPlaceholder.toString())
                    .addOptions(selectOptions)
            )
        );
    }

    const activeCar = cars.find(c => c.carId === profile.activeCar) || cars[0];
    const upgradeCost = activeCar ? Math.floor((activeCar.currentValue || activeCar.purchasePrice || 10000) * 0.05) : 1000;
    const canUpgrade = (profile.wallet || 0) >= upgradeCost;

    const btnRow = new ActionRowBuilder().addComponents(
        btn.primary('garage_upgrade_active', `${lang.btnUpgradeActive} ($${upgradeCost.toLocaleString()})`).setDisabled(!canUpgrade || !activeCar),
        btn.secondary('garage_dealership', lang.btnDealership),
        btn.danger('garage_close', lang.btnClose)
    );
    rows.push(btnRow);

    return rows;
}

function buildDealershipView(profile) {
    const card = buildCard({
        title: lang.showroomTitle,
        description: lang.showroomSubtitle,
        accentColor: ACCENT.primary
    });

    const options = [];
    for (const [id, car] of Object.entries(CARS)) {
        const localized = resolveEntity('vehicles', id, car);
        card.addText(`**${localized.name}** (\`${car.type?.toUpperCase()}\`) — \`$${car.price.toLocaleString()}\`\n> ${lang.speedLabel}: \`${car.speed}\` · ${lang.accelLabel}: \`${car.acceleration}\` · ${lang.handlingLabel}: \`${car.handling}\`\n`);
        options.push({
            label: `${localized.name} ($${car.price.toLocaleString()})`,
            value: `buy_car_${id}`,
            description: `SPD: ${car.speed} • ACC: ${car.acceleration} • ${car.type}`,
            emoji: '🏎️'
        });
    }

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('garage_buy_select')
            .setPlaceholder(lang.showroomSelectPlaceholder.toString())
            .addOptions(options)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.primary('garage_back_to_fleet', lang.btnBackToGarage),
        btn.danger('garage_close', lang.btnClose)
    );

    return { card, rows: [selectRow, btnRow] };
}

async function routeGarageAction(interaction, sentMessage, message, collector) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (interaction.customId === 'garage_close') {
        collector.stop('user_closed');
        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
    }

    if (interaction.customId === 'garage_back_to_fleet') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        if (!freshProfile.cars || freshProfile.cars.length === 0) {
            const emptyCard = cards.warning(
                lang.emptyTitle,
                `${lang.emptyDesc()}\n\n> 💡 *${lang.browseDealershipHint}*`
            );
            const emptyRows = [
                new ActionRowBuilder().addComponents(
                    btn.primary('garage_dealership', lang.btnDealership),
                    btn.danger('garage_close', lang.btnClose)
                )
            ];
            return editV2(sentMessage, { card: emptyCard, rows: emptyRows });
        }
        const freshCard = buildGarageCard(freshProfile, message.author.username);
        const freshRows = buildGarageActionRows(freshProfile);
        return editV2(sentMessage, { card: freshCard, rows: freshRows });
    }

    if (interaction.customId === 'garage_dealership') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        const dView = buildDealershipView(freshProfile);
        return editV2(sentMessage, { card: dView.card, rows: dView.rows });
    }

    if (interaction.customId === 'garage_buy_select') {
        const carId = interaction.values[0].replace('buy_car_', '');
        const carData = CARS[carId];
        if (!carData) return;

        let freshProfile = await EconomyManager.getProfile(userId, guildId);
        const localizedCar = resolveEntity('vehicles', carId, carData);
        const purchase = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `garage-buy:${interaction.id}`, mutate: async current => {
            if ((current.wallet || 0) < carData.price) return { success: false, error: 'funds' };
            current.wallet -= carData.price;
            current.cars.push({ carId, name: localizedCar.name, type: carData.type, speed: carData.speed, acceleration: carData.acceleration, handling: carData.handling, durability: 100, purchasePrice: carData.price, currentValue: carData.price, acquiredAt: new Date() });
            current.activeCar = carId;
            current.transactions.push({ type: 'expense', amount: carData.price, description: lang.txPurchasedVehicle({ name: localizedCar.name }).toString(), category: 'vehicle', timestamp: new Date() });
            return {};
        } });
        if (!purchase?.success) {
            const current = purchase.profile || freshProfile;
            return editV2(sentMessage, { card: cards.warning(lang.cannotAffordTitle, lang.cannotAffordDesc({ name: localizedCar.name, cost: carData.price.toLocaleString(), wallet: (current.wallet || 0).toLocaleString(), shortage: Math.max(0, carData.price - (current.wallet || 0)).toLocaleString() })), rows: [new ActionRowBuilder().addComponents(btn.primary('garage_back_to_fleet', lang.btnBackToGarage), btn.danger('garage_close', lang.btnClose))] });
        }
        freshProfile = purchase.profile;

        const boughtCard = cards.success(lang.vehiclePurchasedTitle, lang.vehiclePurchasedDesc({ name: localizedCar.name, cost: carData.price.toLocaleString() }));
        return editV2(sentMessage, {
            card: boughtCard,
            rows: [new ActionRowBuilder().addComponents(btn.primary('garage_back_to_fleet', lang.btnViewFleet), btn.danger('garage_close', lang.btnClose))]
        });
    }

    if (interaction.customId === 'garage_select_menu') {
        const idx = parseInt(interaction.values[0], 10);
        let freshProfile = await EconomyManager.getProfile(userId, guildId);
        const selected = freshProfile.cars[idx];
        if (!selected) return;
        const selection = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `garage-select:${interaction.id}`, mutate: async current => {
            if (!(current.cars || []).some(car => car.carId === selected.carId)) return { success: false, error: 'missing' };
            current.activeCar = selected.carId;
            return { noLedger: true };
        } });
        if (!selection?.success) return;
        freshProfile = selection.profile;

        const loc = resolveEntity('vehicles', selected.carId, selected);
        const notif = lang.selectSuccessDesc({ name: loc.name });
        const updatedCard = buildGarageCard(freshProfile, message.author.username, notif);
        const updatedRows = buildGarageActionRows(freshProfile);
        return editV2(sentMessage, { card: updatedCard, rows: updatedRows });
    }

    if (interaction.customId === 'garage_upgrade_active') {
        let freshProfile = await EconomyManager.getProfile(userId, guildId);
        const carsList = freshProfile.cars || [];
        const active = carsList.find(c => c.carId === freshProfile.activeCar) || carsList[0];
        if (!active) return;

        const loc = resolveEntity('vehicles', active.carId, active);
        const tuning = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `garage-upgrade:${interaction.id}`, mutate: async current => {
            const car = (current.cars || []).find(entry => entry.carId === current.activeCar && entry.carId === active.carId);
            if (!car) return { success: false, error: 'missing' };
            const cost = Math.floor((car.currentValue || car.purchasePrice || 10000) * 0.05);
            if ((current.wallet || 0) < cost) return { success: false, error: 'funds', cost };
            current.wallet -= cost;
            car.speed = Math.min(100, (car.speed || 50) + 3);
            car.acceleration = Math.min(100, (car.acceleration || 50) + 3);
            car.handling = Math.min(100, (car.handling || 50) + 2);
            car.durability = 100;
            car.currentValue = Math.floor((car.currentValue || car.purchasePrice || 10000) * 1.08);
            current.transactions.push({ type: 'expense', amount: cost, description: lang.txTuningUpgrade({ name: loc.name }).toString(), category: 'vehicle', timestamp: new Date() });
            return { cost, carValue: car.currentValue };
        } });
        if (!tuning?.success) {
            const current = tuning.profile || freshProfile;
            return editV2(sentMessage, { card: cards.warning(lang.cannotAffordTitle, lang.cannotAffordDesc({ name: loc.name, cost: (tuning.cost || 0).toLocaleString(), wallet: (current.wallet || 0).toLocaleString(), shortage: Math.max(0, (tuning.cost || 0) - (current.wallet || 0)).toLocaleString() })), rows: [new ActionRowBuilder().addComponents(btn.primary('garage_back_to_fleet', lang.btnBackToGarage), btn.danger('garage_close', lang.btnClose))] });
        }
        freshProfile = tuning.profile;
        const cost = tuning.cost;
        active.currentValue = tuning.carValue;

        const notif = lang.upgradeSuccessDesc({ name: loc.name, cost: cost.toLocaleString(), improvements: '+3 SPD, +3 ACC, +2 HND, 100% Durability', value: active.currentValue.toLocaleString() });
        const updatedCard = buildGarageCard(freshProfile, message.author.username, notif);
        const updatedRows = buildGarageActionRows(freshProfile);
        return editV2(sentMessage, { card: updatedCard, rows: updatedRows });
    }
}

function attachGarageCollector(sentMessage, message) {
    if (!sentMessage) return null;
    const collector = sentMessage.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async (interaction) => {
        try {
            if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
            await interaction.deferUpdate();
            await routeGarageAction(interaction, sentMessage, message, collector);
        } catch (err) {
            console.error('Error in garage collector:', err);
        }
    });
    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] }).catch(() => {});
        }
    });
    return collector;
}

module.exports = {
    name: 'garage',
    aliases: ['cars', 'mycars', 'vehicles'],
    description: lang.cmdDesc.toString(),
    usage: '!garage | !garage select <number> | !garage sell <number> | !garage upgrade <number>',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            if (!profile.cars || profile.cars.length === 0) {
                const emptyCard = cards.warning(
                    lang.emptyTitle,
                    `${lang.emptyDesc()}\n\n> 💡 *${lang.browseDealershipHint}*`
                );
                const emptyRows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('garage_dealership', lang.btnDealership),
                        btn.danger('garage_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: emptyCard, rows: emptyRows });
                attachGarageCollector(sentMessage, message);
                return;
            }

            const initialCard = buildGarageCard(profile, message.author.username);
            const initialRows = buildGarageActionRows(profile);

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            attachGarageCollector(sentMessage, message);

        } catch (error) {
            console.error('Error in garage command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
