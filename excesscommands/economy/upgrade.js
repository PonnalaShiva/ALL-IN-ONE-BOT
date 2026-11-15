'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { HuntingManager } = require('../../models/economy/huntingManager');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.upgrade);

function buildWorkshopHelpCard() {
    return buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.subtitle}**\n${lang.workshopIntro}`)
        .addSeparator()
        .addText(`### ${lang.weaponSectionHeader}`)
        .addText(lang.weaponSectionDesc)
        .addSeparator()
        .addText(`### ${lang.vehicleSectionHeader}`)
        .addText(lang.vehicleSectionDesc)
        .addSeparator()
        .addText(lang.tipsDesc);
}

function buildWorkshopActionRows(profile) {
    const hasWeapons = (profile.huntingWeapons || []).length > 0;
    const hasVehicles = (profile.huntingVehicles || []).length > 0;

    const components = [];
    if (hasWeapons) {
        components.push(btn.primary('upg_weapon_1', lang.btnUpgradeWeapon));
    }
    if (hasVehicles) {
        components.push(btn.primary('upg_vehicle_1', lang.btnUpgradeVehicle));
    }
    if (!hasWeapons && !hasVehicles) {
        components.push(btn.primary('upg_hunt', lang.btnHuntingOutpost));
    }
    components.push(btn.danger('upg_close', lang.btnClose));

    return [new ActionRowBuilder().addComponents(components)];
}

async function handleWeaponUpgrade(profile, equipmentNumber, referenceId) {
    const weapons = profile.huntingWeapons || [];
    if (isNaN(equipmentNumber) || equipmentNumber < 1 || equipmentNumber > weapons.length) {
        return {
            error: 'invalid_index',
            card: cards.warning(
                lang.invalidWeaponTitle,
                lang.invalidWeaponDesc({ count: weapons.length })
            )
        };
    }

    const weapon = weapons[equipmentNumber - 1];
    const locWeapon = resolveEntity('hunting_weapons', weapon.weaponId, weapon);

    try {
        const mutation = await EconomyManager.mutateProfileAtomically({
            userId: profile.userId,
            guildId: profile.guildId,
            referenceId: `hunt-upgrade:${referenceId}`,
            mutate: async current => {
                const currentWeapon = (current.huntingWeapons || [])[equipmentNumber - 1];
                if (!currentWeapon || currentWeapon.weaponId !== weapon.weaponId) return { success: false, error: 'changed' };
                const result = await HuntingManager.upgradeWeapon(current, currentWeapon.weaponId);
                return { result };
            }
        });
        if (!mutation?.success) throw new Error(mutation?.duplicate ? 'This upgrade was already applied.' : mutation?.error === 'changed' ? 'This weapon changed. Refresh and try again.' : 'Upgrade could not be applied.');
        profile = mutation.profile;
        const result = mutation.result;

        const nextCostText = result.newLevel < 10
            ? lang.nextCostText({ cost: Math.floor(weapon.purchasePrice * 0.3 * (result.newLevel + 1)).toLocaleString() })
            : lang.maxLevelCombat.toString();

        const card = buildCard({
            title: lang.weaponUpgradedTitle({ name: locWeapon.name }),
            accentColor: ACCENT.success
        })
            .addText(`### ${lang.combatImprvHeader}`)
            .addText(
                `> **${lang.levelLabel}:** \`${result.newLevel} / 10\`\n` +
                `> **${lang.costPaidLabel}:** \`$${result.upgradeCost.toLocaleString()}\` · **${lang.walletBalanceLabel}:** \`$${profile.wallet.toLocaleString()}\`\n\n` +
                `> • **${lang.damageLabel}:** \`${result.newStats.damage}\` (\`+${result.improvements.damage}\`)\n` +
                `> • **${lang.accuracyLabel}:** \`${result.newStats.accuracy}%\` (\`+${result.improvements.accuracy}%\`)\n` +
                `> • **${lang.critChanceLabel}:** \`${result.newStats.criticalChance}%\` (\`+${result.improvements.criticalChance}%\`)\n\n` +
                nextCostText
            );

        const rows = [
            new ActionRowBuilder().addComponents(btn.secondary('upg_close', lang.btnClose))
        ];

        return { success: true, card, rows };
    } catch (err) {
        return { error: 'failed', card: cards.warning(lang.errorTitle, err.message || lang.errorMessage) };
    }
}

async function handleVehicleUpgrade(profile, equipmentNumber, referenceId) {
    const vehicles = profile.huntingVehicles || [];
    if (isNaN(equipmentNumber) || equipmentNumber < 1 || equipmentNumber > vehicles.length) {
        return {
            error: 'invalid_index',
            card: cards.warning(
                lang.invalidVehicleTitle,
                lang.invalidVehicleDesc({ count: vehicles.length })
            )
        };
    }

    const vehicle = vehicles[equipmentNumber - 1];
    const locVehicle = resolveEntity('vehicles', vehicle.vehicleId, vehicle);

    try {
        const mutation = await EconomyManager.mutateProfileAtomically({
            userId: profile.userId,
            guildId: profile.guildId,
            referenceId: `hunt-upgrade:${referenceId}`,
            mutate: async current => {
                const currentVehicle = (current.huntingVehicles || [])[equipmentNumber - 1];
                if (!currentVehicle || currentVehicle.vehicleId !== vehicle.vehicleId) return { success: false, error: 'changed' };
                const result = await HuntingManager.upgradeVehicle(current, currentVehicle.vehicleId);
                return { result };
            }
        });
        if (!mutation?.success) throw new Error(mutation?.duplicate ? 'This upgrade was already applied.' : mutation?.error === 'changed' ? 'This vehicle changed. Refresh and try again.' : 'Upgrade could not be applied.');
        profile = mutation.profile;
        const result = mutation.result;

        const nextCostText = result.newTier < 5
            ? lang.nextTierCost({ cost: Math.floor(vehicle.purchasePrice * 0.4 * result.newTier).toLocaleString() })
            : lang.maxTierCombat.toString();

        const card = buildCard({
            title: lang.vehicleUpgradedTitle({ name: locVehicle.name }),
            accentColor: ACCENT.success
        })
            .addText(`### ${lang.mechanicHeader}`)
            .addText(
                `> **${lang.tierLabel}:** \`${result.newTier} / 5\`\n` +
                `> **${lang.costPaidLabel}:** \`$${result.upgradeCost.toLocaleString()}\` · **${lang.walletBalanceLabel}:** \`$${profile.wallet.toLocaleString()}\`\n\n` +
                `> • **${lang.payloadLabel}:** \`${vehicle.capacity}\` ${lang.carcassesUnit} (\`+${result.improvements.capacity}\`)\n` +
                `> • **${lang.fuelTankLabel}:** \`${vehicle.fuelCapacity}\` ${lang.unitsUnit} (\`+${result.improvements.fuelCapacity}\`)\n` +
                `> • **${lang.expeditionDepthLabel}:** \`${vehicle.jungleDepth} / 10\` (\`+${result.improvements.jungleDepth}\`)\n\n` +
                nextCostText
            );

        const rows = [
            new ActionRowBuilder().addComponents(btn.secondary('upg_close', lang.btnClose))
        ];

        return { success: true, card, rows };
    } catch (err) {
        return { error: 'failed', card: cards.warning(lang.errorTitle, err.message || lang.errorMessage) };
    }
}

module.exports = {
    name: 'upgrade',
    aliases: ['upg', 'improve', 'enhance'],
    description: lang.cmdDesc.toString(),
    usage: '!upgrade weapon <number> | !upgrade vehicle <number>',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            
            if (!args[0] || !args[1]) {
                const helpCard = buildWorkshopHelpCard();
                const rows = buildWorkshopActionRows(profile);

                const sentMessage = await sendV2(message, { card: helpCard, rows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'upg_close') {
                            collector.stop('user_closed');
                            return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                        }

                        if (interaction.customId === 'upg_hunt') {
                            collector.stop('hunt');
                            const huntCmd = require('./hunt');
                            return huntCmd.execute(message, []);
                        }

                        if (interaction.customId === 'upg_weapon_1') {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const result = await handleWeaponUpgrade(freshProfile, 1, `${message.id}:weapon`);
                            const receiptRows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('upg_close', lang.btnClose))];
                            return editV2(sentMessage, { card: result.card, rows: receiptRows });
                        }

                        if (interaction.customId === 'upg_vehicle_1') {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const result = await handleVehicleUpgrade(freshProfile, 1, `${message.id}:vehicle`);
                            const receiptRows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('upg_close', lang.btnClose))];
                            return editV2(sentMessage, { card: result.card, rows: receiptRows });
                        }
                    } catch (err) {
                        console.error('Error in upgrade workshop collector:', err);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            }

            const attachReceiptCollector = (sentMsg) => {
                if (!sentMsg) return;
                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'upg_close') {
                            collector.stop('user_closed');
                            return closeAndAutoDelete(sentMsg, cards.info(lang.closedTitle, lang.closedDesc));
                        }

                        if (interaction.customId === 'upg_hunt') {
                            collector.stop('hunt');
                            const huntCmd = require('./hunt');
                            return huntCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error in upgrade receipt collector:', err);
                    }
                });
                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
            };

            const equipmentType = args[0].toLowerCase();
            const equipmentNumber = parseInt(args[1], 10);

            if (equipmentType === 'weapon') {
                const result = await handleWeaponUpgrade(profile, equipmentNumber, `${message.id}:weapon:${equipmentNumber}`);
                if (result.rows) {
                    const sentMsg = await sendV2(message, { card: result.card, rows: result.rows });
                    attachReceiptCollector(sentMsg);
                    return sentMsg;
                }
                return sendV2(message, result.card);
            }

            if (equipmentType === 'vehicle') {
                const result = await handleVehicleUpgrade(profile, equipmentNumber, `${message.id}:vehicle:${equipmentNumber}`);
                if (result.rows) {
                    const sentMsg = await sendV2(message, { card: result.card, rows: result.rows });
                    attachReceiptCollector(sentMsg);
                    return sentMsg;
                }
                return sendV2(message, result.card);
            }

            return sendV2(message, cards.warning(
                lang.invalidTypeTitle,
                lang.invalidTypeDesc
            ));

        } catch (error) {
            console.error('Error in upgrade command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
