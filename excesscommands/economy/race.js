'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.race);

module.exports = {
    name: 'race',
    aliases: ['streetrace', 'dragrace'],
    description: lang.cmdDesc.toString(),
    usage: '!race',
    cooldown: 300,
    async execute(message) {
        try {
            const userId = message.author.id;
            let profile = await EconomyManager.getProfile(userId, message.guild.id);

            
            const cooldownCheck = EconomyManager.checkCooldown(profile, 'race');
            if (cooldownCheck.onCooldown) {
                const { minutes, seconds } = cooldownCheck.timeLeft;
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ time: `${minutes}m ${seconds}s` })
                ));
            }

            if (!profile.activeCar) {
                const noCarCard = cards.warning(lang.noCarTitle, lang.noCarDesc);
                const noCarRows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('race_dealership', lang.btnDealership),
                        btn.secondary('race_close', lang.btnClose)
                    )
                ];
                const sentMsg = await sendV2(message, { card: noCarCard, rows: noCarRows });
                if (!sentMsg) return;

                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'race_close') {
                            collector.stop('closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }
                        if (interaction.customId === 'race_dealership') {
                            collector.stop('dealership');
                            const buycarCmd = require('./buycar');
                            return buycarCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error handling race no-car interaction:', err);
                        editV2(sentMsg, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return;
            }

            const rawCar = profile.cars?.find(c => c.carId === profile.activeCar);
            if (!rawCar) {
                return sendV2(message, cards.warning(
                    lang.carMissingTitle,
                    lang.carMissingDesc
                ));
            }

            const car = resolveEntity('cars', rawCar.carId, rawCar);

            const performance = ((rawCar.speed || 50) + (rawCar.acceleration || 50) + (rawCar.handling || 50)) / 3;
            const winChance = Math.min(90, Math.max(10, performance + Math.random() * 20));
            const won = Math.random() * 100 < winChance;

            const baseWinnings = Math.floor(Math.random() * 5000) + 1000;
            const winnings = Math.floor(baseWinnings * (performance / 50));

            let roleBonus = 0;
            if (Array.isArray(profile.purchasedRoles)) {
                profile.purchasedRoles.forEach(role => {
                    if (!role.expiryDate || new Date(role.expiryDate) > new Date()) {
                        roleBonus += (role.benefits?.racingBonus || 0);
                    }
                });
            }

            if (!profile.cooldowns) profile.cooldowns = {};
            if (won) {
                const totalWinnings = winnings + roleBonus;
                const settlement = await EconomyManager.mutateProfileAtomically({
                    userId, guildId: message.guild.id, referenceId: `race:${message.id}`,
                    mutate: async current => {
                        if (current.activeCar !== rawCar.carId) return { success: false, error: 'active_car_changed' };
                        const currentCar = (current.cars || []).find(entry => entry.carId === rawCar.carId);
                        if (!currentCar) return { success: false, error: 'car_missing' };
                        if (!current.cooldowns) current.cooldowns = {};
                        const cooldown = EconomyManager.checkCooldown(current, 'race');
                        if (cooldown.onCooldown) return { success: false, error: 'cooldown' };
                        current.cooldowns.race = new Date();
                        current.wallet = (current.wallet || 0) + totalWinnings;
                        if (!current.racingStats) current.racingStats = { wins: 0, losses: 0, winStreak: 0, earnings: 0, totalRaces: 0 };
                        current.racingStats.wins = (current.racingStats.wins || 0) + 1;
                        current.racingStats.winStreak = (current.racingStats.winStreak || 0) + 1;
                        current.racingStats.earnings = (current.racingStats.earnings || 0) + totalWinnings;
                        current.racingStats.totalRaces = (current.racingStats.totalRaces || 0) + 1;
                        currentCar.raceWins = (currentCar.raceWins || 0) + 1;
                        current.transactions.push({ type: 'income', amount: totalWinnings, description: lang.txRaceVictory({ name: car.name }).toString(), category: 'racing', timestamp: new Date() });
                        return {};
                    }
                });
                if (!settlement?.success) return sendV2(message, cards.warning(lang.cooldownTitle, settlement?.error === 'cooldown' ? lang.cooldownDesc({ time: 'a moment' }) : lang.carMissingDesc));
                profile = settlement.profile;

                const victoryCard = buildCard({
                    title: lang.victoryTitle({ name: car.name }),
                    accentColor: ACCENT.success
                })
                    .addText(`${lang.victoryIntro}\n`)
                    .addSeparator()
                    .addText(`### ${lang.prizePurseHeader}`)
                    .addText(
                        `${lang.circuitPurse({ purse: winnings.toLocaleString() })}\n` +
                        (roleBonus > 0 ? `${lang.vipRoleBonus({ bonus: roleBonus.toLocaleString() })}\n` : '') +
                        `${lang.totalWinnings({ total: totalWinnings.toLocaleString() })}\n` +
                        `${lang.updatedWallet({ wallet: profile.wallet.toLocaleString() })}`
                    )
                    .addSeparator()
                    .addText(`### ${lang.telemetryHeader}`)
                    .addText(
                        lang.telemetryDetails({
                            name: car.name,
                            perf: performance.toFixed(1),
                            odds: winChance.toFixed(1),
                            streak: profile.racingStats.winStreak,
                            wins: profile.racingStats.wins,
                            losses: profile.racingStats.losses || 0,
                            earnings: profile.racingStats.earnings.toLocaleString()
                        })
                    );

                const rows = [
                    new ActionRowBuilder().addComponents(
                        btn.success('race_deposit', lang.btnDepositBank),
                        btn.primary('race_garage', lang.btnGarage),
                        btn.secondary('race_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: victoryCard, rows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'race_close') {
                            collector.stop('user_closed');
                            return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'race_garage') {
                            collector.stop('garage');
                            const garageCmd = require('./garage');
                            return garageCmd.execute(message, []);
                        }

                        if (interaction.customId === 'race_deposit') {
                            const currentProfile = await EconomyManager.getProfile(userId, message.guild.id);
                            const requested = Math.min(totalWinnings, currentProfile.wallet || 0);
                            const transfer = requested > 0 ? await EconomyManager.transferBank({ userId, guildId: message.guild.id, direction: 'deposit', amount: requested, referenceId: `race-deposit:${sentMessage.id}`, description: lang.txDepositRaceWinnings({ amount: 'winnings' }).toString() }) : { success: false };
                            const canDeposit = transfer.success ? transfer.amount : 0;
                            collector.stop('deposited');
                            const updatedCard = victoryCard.addSeparator().addText(`> 🏦 **${lang.depositedAlert({ amount: canDeposit.toLocaleString() })}**`);
                            return editV2(sentMessage, { card: updatedCard, rows: [] });
                        }
                    } catch (error) {
                        console.error('Error handling race victory interaction:', error);
                        editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;

            } else {
                const lossCost = Math.floor(winnings * 0.3);
                const durabilityLoss = Math.floor(Math.random() * 5) + 1;
                const settlement = await EconomyManager.mutateProfileAtomically({
                    userId, guildId: message.guild.id, referenceId: `race:${message.id}`,
                    mutate: async current => {
                        if (current.activeCar !== rawCar.carId) return { success: false, error: 'active_car_changed' };
                        const currentCar = (current.cars || []).find(entry => entry.carId === rawCar.carId);
                        if (!currentCar) return { success: false, error: 'car_missing' };
                        if (!current.cooldowns) current.cooldowns = {};
                        const cooldown = EconomyManager.checkCooldown(current, 'race');
                        if (cooldown.onCooldown) return { success: false, error: 'cooldown' };
                        current.cooldowns.race = new Date();
                        if (!current.racingStats) current.racingStats = { wins: 0, losses: 0, winStreak: 0, earnings: 0, totalRaces: 0 };
                        const actualLoss = Math.min(Number(current.wallet) || 0, lossCost);
                        current.wallet = (current.wallet || 0) - actualLoss;
                        current.racingStats.losses = (current.racingStats.losses || 0) + 1;
                        current.racingStats.winStreak = 0;
                        current.racingStats.totalRaces = (current.racingStats.totalRaces || 0) + 1;
                        currentCar.raceLosses = (currentCar.raceLosses || 0) + 1;
                        currentCar.durability = Math.max(0, (currentCar.durability || 100) - durabilityLoss);
                        current.transactions.push({ type: 'expense', amount: actualLoss, description: lang.txRaceLoss({ name: car.name }).toString(), category: 'racing', timestamp: new Date() });
                        return { actualLoss, currentDurability: currentCar.durability };
                    }
                });
                if (!settlement?.success) return sendV2(message, cards.warning(lang.cooldownTitle, settlement?.error === 'cooldown' ? lang.cooldownDesc({ time: 'a moment' }) : lang.carMissingDesc));
                profile = settlement.profile;
                const actualLoss = settlement.actualLoss;
                rawCar.durability = settlement.currentDurability;

                const defeatCard = buildCard({
                    title: lang.defeatTitle({ name: car.name }),
                    accentColor: ACCENT.danger
                })
                    .addText(`${lang.defeatIntro}\n`)
                    .addSeparator()
                    .addText(`### ${lang.costsWearHeader}`)
                    .addText(
                        `${lang.repairEntryCosts({ cost: actualLoss.toLocaleString() })}\n` +
                        `${lang.durabilityWear({ wear: durabilityLoss, durability: rawCar.durability })}\n` +
                        `${lang.streakReset}\n` +
                        `${lang.updatedWallet({ wallet: profile.wallet.toLocaleString() })}`
                    )
                    .addSeparator()
                    .addText(`### ${lang.tuningTipsHeader}`)
                    .addText(lang.tuningTipsDesc);

                const rows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('race_garage', lang.btnGarage),
                        btn.secondary('race_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: defeatCard, rows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'race_close') {
                            collector.stop('user_closed');
                            return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'race_garage') {
                            collector.stop('garage');
                            const garageCmd = require('./garage');
                            return garageCmd.execute(message, []);
                        }
                    } catch (error) {
                        console.error('Error handling race defeat interaction:', error);
                        editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            }

        } catch (error) {
            console.error('Error in race command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
