'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { HuntingManager } = require('../../models/economy/huntingManager');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.hunting);

module.exports = {
    name: 'hunting',
    aliases: ['hunter', 'huntstats', 'hunterprofile'],
    description: 'View your complete hunting passport, skills, equipment, and wildlife records',
    usage: '!hunting',
    cooldown: 4000,
    async execute(message) {
        try {
            const userId = message.author.id;
            const profile = await EconomyManager.getProfile(userId, message.guild.id);

            const huntingStats = profile.huntingStats || {};
            const huntingProfile = profile.huntingProfile || {};
            const totalHunts = huntingStats.totalHunts || 0;
            const successHunts = huntingStats.successfulHunts || 0;
            const failedHunts = huntingStats.failedHunts || 0;
            const successRate = totalHunts > 0 ? Math.floor((successHunts / totalHunts) * 100) : 0;

            const rawVehicle = (profile.huntingVehicles || []).find(v => v.vehicleId === profile.activeVehicle);
            const rawWeapon = (profile.huntingWeapons || []).find(w => w.weaponId === profile.activeWeapon);

            const activeVehicle = rawVehicle ? resolveEntity('hunting_vehicles', rawVehicle.vehicleId, rawVehicle) : null;
            const activeWeapon = rawWeapon ? resolveEntity('hunting_weapons', rawWeapon.weaponId, rawWeapon) : null;
            const activeCompanionCount = (profile.activeCompanions || []).length;

            const card = buildCard({
                title: lang.title({ user: message.author.username }),
                description: lang.subtitle,
                accentColor: ACCENT.primary
            });

            card.addSeparator().addText(
                `### 🎯 ${lang.statsTitle}\n` +
                lang.statsDetails({
                    level: huntingProfile.hunterLevel || 1,
                    health: huntingProfile.currentHealth || 100,
                    exp: (huntingProfile.hunterExperience || 0).toLocaleString(),
                    huntSkill: huntingStats.huntingSkill || 0,
                    survivalSkill: huntingStats.survivalSkill || 0,
                    rate: successRate
                })
            );

            card.addSeparator().addText(
                `### 📊 ${lang.historyTitle}\n` +
                lang.historyDetails({
                    total: totalHunts,
                    success: successHunts,
                    failed: failedHunts,
                    kills: huntingStats.animalsKilled || 0,
                    boxes: huntingStats.lootBoxesFound || 0,
                    earnings: (huntingStats.totalEarnings || 0).toLocaleString()
                })
            );

            card.addSeparator().addText(
                `### 🎒 ${lang.equipmentTitle}\n` +
                lang.equipmentDetails({
                    vehicle: activeVehicle ? activeVehicle.name : lang.noneEquipped,
                    vehicleCount: (profile.huntingVehicles || []).length,
                    weapon: activeWeapon ? activeWeapon.name : lang.noneEquipped,
                    weaponCount: (profile.huntingWeapons || []).length,
                    compActive: activeCompanionCount,
                    compMax: profile.maxCompanions || 3,
                    compTotal: (profile.huntingCompanions || []).length
                })
            );

            if ((profile.huntingWarehouses || []).length > 0 || (profile.huntingInventory || []).length > 0) {
                const storageUsed = HuntingManager.calculateInventoryWeight(profile);
                const storageCapacity = HuntingManager.calculateStorageCapacity(profile);
                const totalInventoryValue = (profile.huntingInventory || []).reduce((sum, item) => sum + ((item.currentValue || 0) * (item.quantity || 1)), 0);

                card.addSeparator().addText(
                    `### 🏭 ${lang.storageTitle}\n` +
                    lang.storageDetails({
                        items: (profile.huntingInventory || []).length,
                        used: storageUsed,
                        cap: storageCapacity,
                        warehouses: (profile.huntingWarehouses || []).length,
                        value: totalInventoryValue.toLocaleString()
                    })
                );
            }

            card.addSeparator().addText(
                `### 📋 ${lang.commandsTitle}\n` +
                lang.commandsDetails
            );

            const rows = [
                new ActionRowBuilder().addComponents(
                    btn.primary('hunting_hunt', lang.btnHunt),
                    btn.secondary('hunting_shop', lang.btnShop),
                    btn.secondary('hunting_heal', lang.btnHeal),
                    btn.danger('hunting_close', lang.btnClose)
                )
            ];

            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
            try {    
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'hunting_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }
    
                    if (interaction.customId === 'hunting_hunt') {
                        collector.stop('hunt');
                        const huntCmd = require('./hunt');
                        return huntCmd.execute(message, []);
                    }
    
                    if (interaction.customId === 'hunting_shop') {
                        collector.stop('shop');
                        const huntShopCmd = require('./huntshop');
                        return huntShopCmd.execute(message, []);
                    }
    
                    if (interaction.customId === 'hunting_heal') {
                        collector.stop('heal');
                        const healCmd = require('./heal');
                        return healCmd.execute(message, []);
                    }
            } catch (err) {
                console.error('[hunting.js] Error in component collector:', err);
            }
        });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in hunting command:', error);
            return sendV2(message, cards.error(
                lang.errorTitle,
                error.message || lang.errorMessage
            ));
        }
    }
};
