'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.trip);

function getTripTier(tierKey) {
    const tiers = {
        day_trip: {
            name: lang.tierDayTrip.toString(),
            costPerMember: 500,
            bondRange: [10, 15]
        },
        weekend_trip: {
            name: lang.tierWeekendTrip.toString(),
            costPerMember: 1200,
            bondRange: [18, 25]
        },
        international: {
            name: lang.tierIntlTrip.toString(),
            costPerMember: 3000,
            bondRange: [30, 45]
        }
    };
    return tiers[tierKey] || tiers.day_trip;
}

const TRIP_COOLDOWN_MS = 4 * 60 * 60 * 1000; 

function buildVacationTerminalCard(profile, car, familyMembers) {
    const carQuality = car ? Math.floor(((car.speed || 50) + (car.acceleration || 50) + (car.handling || 50)) / 3) : 50;
    const locCar = car ? resolveEntity('vehicles', car.carId, car) : null;

    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.subtitle}**\n> ${lang.terminalDesc}`)
        .addSeparator()
        .addText(lang.terminalStatus({
            count: familyMembers.length,
            vehicle: locCar ? locCar.name : lang.noneLabel.toString(),
            comfort: carQuality,
            wallet: (profile.wallet || 0).toLocaleString()
        }))
        .addSeparator()
        .addText(
            `**${lang.itineraryOptionsHeader}**\n` +
            `${lang.dayTripOption}\n` +
            `${lang.weekendTripOption}\n` +
            `${lang.intlTripOption}`
        );

    return card;
}

function buildTerminalActionRows(profile, memberCount) {
    const wallet = profile.wallet || 0;
    return [
        new ActionRowBuilder().addComponents(
            btn.primary('trip_day_trip', lang.btnDayTrip).setDisabled(wallet < 500 * memberCount),
            btn.primary('trip_weekend_trip', lang.btnWeekendTrip).setDisabled(wallet < 1200 * memberCount),
            btn.success('trip_international', lang.btnIntlTrip).setDisabled(wallet < 3000 * memberCount),
            btn.danger('trip_close', lang.btnClose)
        )
    ];
}

async function executeVacation(profile, tierKey, referenceId) {
    const tier = getTripTier(tierKey);
    let familyMembers = profile.familyMembers || [];

    if (familyMembers.length === 0) {
        return { error: 'no_family', card: cards.warning(lang.noFamilyTitle, lang.noFamilyDesc) };
    }

    if (!profile.activeCar) {
        return { error: 'no_car', card: cards.warning(lang.noCarTitle, lang.noCarDesc) };
    }

    let car = (profile.cars || []).find(c => c.carId === profile.activeCar);
    if (!car) {
        return { error: 'car_missing', card: cards.warning(lang.carMissingTitle, lang.carMissingDesc) };
    }

    let locCar = resolveEntity('vehicles', car.carId, car);

    
    const lastTripTime = profile.cooldowns?.trip ? new Date(profile.cooldowns.trip).getTime() : 0;
    const now = Date.now();
    if (now - lastTripTime < TRIP_COOLDOWN_MS) {
        const remainingMs = TRIP_COOLDOWN_MS - (now - lastTripTime);
        const hours = Math.floor(remainingMs / (60 * 60 * 1000));
        const minutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
        return {
            error: 'cooldown',
            card: cards.warning(
                lang.cooldownTitle,
                lang.cooldownDesc({ time: lang.timeRemainingFormat({ hours, minutes }) })
            )
        };
    }

    let totalCost = tier.costPerMember * familyMembers.length;
    const wallet = profile.wallet || 0;

    if (wallet < totalCost) {
        return {
            error: 'funds',
            card: cards.warning(
                lang.insufficientFundsTitle,
                lang.insufficientFundsDesc({
                    tripName: tier.name,
                    cost: totalCost.toLocaleString(),
                    perMember: tier.costPerMember.toLocaleString(),
                    wallet: wallet.toLocaleString(),
                    shortage: (totalCost - wallet).toLocaleString()
                })
            )
        };
    }

    
    const carComfort = Math.floor(((car.speed || 50) + (car.acceleration || 50) + (car.handling || 50)) / 3);
    const carComfortBonus = Math.floor((carComfort - 50) / 10); 

    const [minBond, maxBond] = tier.bondRange;
    const baseBondGain = Math.floor(Math.random() * (maxBond - minBond + 1)) + minBond;
    let totalBondGain = Math.max(5, baseBondGain + carComfortBonus);
    const trip = await EconomyManager.mutateProfileAtomically({ userId: profile.userId, guildId: profile.guildId, referenceId,
        mutate: async current => {
            const currentMembers = current.familyMembers || [];
            if (!currentMembers.length) return { success: false, error: 'no_family' };
            if (!current.activeCar) return { success: false, error: 'no_car' };
            const currentCar = (current.cars || []).find(entry => entry.carId === current.activeCar);
            if (!currentCar) return { success: false, error: 'car_missing' };
            if (!current.cooldowns) current.cooldowns = {};
            const lastTrip = current.cooldowns.trip ? new Date(current.cooldowns.trip).getTime() : 0;
            if (Date.now() - lastTrip < TRIP_COOLDOWN_MS) return { success: false, error: 'cooldown' };
            const liveCost = tier.costPerMember * currentMembers.length;
            if ((current.wallet || 0) < liveCost) return { success: false, error: 'funds' };
            const liveComfort = Math.floor(((currentCar.speed || 50) + (currentCar.acceleration || 50) + (currentCar.handling || 50)) / 3);
            const liveBondGain = Math.max(5, baseBondGain + Math.floor((liveComfort - 50) / 10));
            const tripTime = new Date();
            current.wallet -= liveCost;
            current.cooldowns.trip = tripTime;
            currentMembers.forEach(member => { member.bond = Math.min(100, (member.bond || 50) + liveBondGain); member.totalTrips = (member.totalTrips || 0) + 1; member.lastTrip = tripTime; });
            current.transactions.push({ type: 'expense', amount: liveCost, description: lang.txVacation({ tripName: tier.name }).toString(), category: 'family', timestamp: tripTime });
            return { totalCost: liveCost, totalBondGain: liveBondGain, avgBond: Math.floor(currentMembers.reduce((sum, member) => sum + member.bond, 0) / currentMembers.length), tripTime, activeCarId: currentCar.carId };
        }
    });
    if (!trip?.success) {
        if (trip?.error === 'cooldown') return { error: 'cooldown', card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ time: lang.timeRemainingFormat({ hours: 0, minutes: 1 }) })) };
        if (trip?.error === 'funds') return { error: 'funds', card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ tripName: tier.name, cost: totalCost.toLocaleString(), perMember: tier.costPerMember.toLocaleString(), wallet: ((trip.profile || profile).wallet || 0).toLocaleString(), shortage: Math.max(0, totalCost - ((trip.profile || profile).wallet || 0)).toLocaleString() })) };
        return { error: trip?.error || 'failed', card: cards.warning(lang.noFamilyTitle, lang.noFamilyDesc) };
    }
    profile = trip.profile;
    familyMembers = profile.familyMembers || [];
    car = (profile.cars || []).find(entry => entry.carId === trip.activeCarId) || car;
    locCar = resolveEntity('vehicles', car.carId, car);
    totalCost = trip.totalCost;
    totalBondGain = trip.totalBondGain;
    const avgBond = trip.avgBond;

    const tripEmojis = ['🏖️', '🎡', '⛰️', '🗽', '🏛️', '🏕️', '🍽️', '🎉', '🚗', '🎪'];
    const chosenEmoji = tripEmojis[Math.floor(Math.random() * tripEmojis.length)];

    const events = [
        lang.eventCoast,
        lang.eventThemePark,
        lang.eventMountain,
        lang.eventShopping,
        lang.eventMuseum,
        lang.eventCamp,
        lang.eventDining,
        lang.eventWedding,
        lang.eventCruise,
        lang.eventConcert
    ];
    const tripStory = events[Math.floor(Math.random() * events.length)];

    const memberRoster = familyMembers.slice(0, 5).map(m =>
        lang.memberRosterLine({
            name: m.name,
            relationship: m.relationship,
            bond: m.bond,
            bondGain: totalBondGain
        })
    ).join('\n');

    const extraMembers = familyMembers.length > 5 ? lang.moreMembers({ count: familyMembers.length - 5 }) : '';

    const successCard = buildCard({
        title: lang.tripSuccessTitle({ emoji: chosenEmoji }),
        accentColor: ACCENT.success
    })
        .addText(lang.tripStoryLine({ tierName: tier.name, story: tripStory }))
        .addSeparator()
        .addText(`### ${lang.accountingHeader}`)
        .addText(lang.accountingDesc({
            cost: totalCost.toLocaleString(),
            perMember: tier.costPerMember.toLocaleString(),
            count: familyMembers.length,
            bondGain: totalBondGain,
            avgBond,
            vehicle: locCar.name,
            comfort: carComfort,
            wallet: profile.wallet.toLocaleString()
        }))
        .addSeparator()
        .addText(`### ${lang.rosterHeader}\n${memberRoster}${extraMembers}`);

    const successRows = [
        new ActionRowBuilder().addComponents(
            btn.primary('trip_view_family', lang.btnViewFamily),
            btn.danger('trip_close', lang.btnClose)
        )
    ];

    return { error: null, card: successCard, rows: successRows };
}

module.exports = {
    name: 'trip',
    aliases: ['vacation', 'familytrip', 'holiday'],
    description: lang.cmdDesc.toString(),
    usage: '!trip [day|weekend|intl]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            const familyMembers = profile.familyMembers || [];
            if (familyMembers.length === 0) {
                return sendV2(message, cards.warning(lang.noFamilyTitle, lang.noFamilyDesc));
            }

            const car = (profile.cars || []).find(c => c.carId === profile.activeCar);
            const tierMap = {
                day: 'day_trip',
                weekend: 'weekend_trip',
                intl: 'international',
                international: 'international'
            };

            const directArg = args[0]?.toLowerCase();
            const directTier = tierMap[directArg];

            
            if (directTier) {
                const result = await executeVacation(profile, directTier, `trip:${message.id}`);
                const rows = result.rows || [new ActionRowBuilder().addComponents(btn.danger('trip_close', lang.btnClose))];
                const sentMsg = await sendV2(message, { card: result.card, rows });
                if (!sentMsg) return;

                const directCollector = sentMsg.createMessageComponentCollector({ time: 60000 });
                directCollector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();
                        if (interaction.customId === 'trip_close') {
                            directCollector.stop('user_closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }
                        if (interaction.customId === 'trip_view_family') {
                            directCollector.stop('view_family');
                            const famCmd = require('./family');
                            return famCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error handling direct trip interaction:', err);
                        editV2(sentMsg, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                    }
                });

                directCollector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return;
            }

            
            const initialCard = buildVacationTerminalCard(profile, car, familyMembers);
            const initialRows = buildTerminalActionRows(profile, familyMembers.length);

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 90000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'trip_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'trip_view_family') {
                        collector.stop('view_family');
                        const famCmd = require('./family');
                        return famCmd.execute(message, []);
                    }

                    const tierAction = interaction.customId.replace('trip_', '');
                    if (['day_trip', 'weekend_trip', 'international'].includes(tierAction)) {
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const result = await executeVacation(freshProfile, tierAction, `trip:${interaction.id}`);
                        const rows = result.rows || [new ActionRowBuilder().addComponents(btn.danger('trip_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows });
                    }
                } catch (err) {
                    console.error('Error handling vacation terminal interaction:', err);
                    editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in trip command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
