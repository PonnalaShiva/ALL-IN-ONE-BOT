'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { HEIST_EQUIPMENT } = require('../../models/economy/constants/businessData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.buyequipment);

function buildEquipmentCatalogCard(profile) {
    const sortedEquipment = Object.entries(HEIST_EQUIPMENT)
        .sort((a, b) => a[1].cost - b[1].cost);

    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.catalogSubtitle}**\n> ${lang.catalogIntro}`)
        .addSeparator()
        .addText(`### ${lang.availableEquipmentTitle}`);

    sortedEquipment.forEach(([id, equip], index) => {
        const locEquip = resolveEntity('heist_equipment', id, equip);
        const isOwned = (profile.heistEquipment || []).includes(id);
        const status = isOwned ? lang.ownedTag.toString() : '';

        card.addText(
            lang.equipItemLine({
                idx: index + 1,
                name: locEquip.name,
                id,
                status,
                cost: equip.cost.toLocaleString(),
                desc: locEquip.description || equip.description
            })
        );
    });

    card.addSeparator().addText(
        lang.howToPurchase({ wallet: (profile.wallet || 0).toLocaleString() })
    );

    return card;
}

function buildEquipmentActionRows(profile) {
    const sortedEquipment = Object.entries(HEIST_EQUIPMENT)
        .sort((a, b) => a[1].cost - b[1].cost);

    const wallet = profile.wallet || 0;
    const owned = new Set(profile.heistEquipment || []);

    const options = sortedEquipment.map(([id, equip]) => {
        const locEquip = resolveEntity('heist_equipment', id, equip);
        const isOwned = owned.has(id);
        const canAfford = wallet >= equip.cost;

        let statusText = '';
        if (isOwned) statusText = lang.ownedTag.toString();
        else if (!canAfford) statusText = lang.cannotAffordTag.toString();

        return {
            label: locEquip.name,
            value: id,
            description: lang.equipOptionDesc({
                cost: equip.cost.toLocaleString(),
                desc: (locEquip.description || equip.description).slice(0, 50),
                status: statusText
            }).toString()
        };
    });

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('buyequipment_select')
            .setPlaceholder(lang.selectPlaceholder.toString())
            .addOptions(options)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('buyequipment_close', lang.btnClose)
    );

    return [selectRow, btnRow];
}

async function processEquipmentPurchase(userId, guildId, equipmentId, referenceId) {
    const equipment = HEIST_EQUIPMENT[equipmentId];
    if (!equipment) {
        return {
            error: 'invalid',
            card: cards.warning(
                lang.invalidEquipmentTitle,
                lang.invalidEquipmentDesc({ id: equipmentId })
            )
        };
    }

    const locEquip = resolveEntity('heist_equipment', equipmentId, equipment);

    const purchase = await EconomyManager.mutateProfileAtomically({
        userId, guildId, referenceId,
        mutate: profile => {
            if ((profile.heistEquipment || []).includes(equipmentId)) return { success: false, reason: 'owned' };
            const wallet = Number(profile.wallet) || 0;
            if (wallet < equipment.cost) return { success: false, reason: 'funds', wallet };
            profile.wallet = wallet - equipment.cost;
            if (!Array.isArray(profile.heistEquipment)) profile.heistEquipment = [];
            profile.heistEquipment.push(equipmentId);
            if (!Array.isArray(profile.transactions)) profile.transactions = [];
            profile.transactions.push({
                type: 'expense', amount: equipment.cost,
                description: lang.txPurchasedEquipment({ name: locEquip.name }).toString(), category: 'heist', timestamp: new Date()
            });
            return {};
        }
    });
    if (!purchase.success) {
        if (purchase.reason === 'owned') return { error: 'owned', card: cards.warning(lang.alreadyOwnedTitle, lang.alreadyOwnedDesc({ name: locEquip.name })) };
        if (purchase.reason === 'duplicate') return { error: 'duplicate', card: cards.info(lang.closedTitle, lang.closedDesc) };
        const wallet = purchase.wallet || 0;
        return { error: 'funds', card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({
            name: locEquip.name, price: equipment.cost.toLocaleString(), wallet: wallet.toLocaleString(), shortage: Math.max(0, equipment.cost - wallet).toLocaleString()
        })) };
    }
    const profile = purchase.profile;

    const successCard = buildCard({
        title: lang.successTitle,
        accentColor: ACCENT.success
    })
        .addText(`> **${lang.successSubtitle({ name: locEquip.name })}**\n${lang.successPurchaseDesc({ name: locEquip.name })}`)
        .addSeparator()
        .addText(
            `**💸 ${lang.costLabel}:** \`$${equipment.cost.toLocaleString()}\`\n` +
            `**💳 ${lang.walletLabel}:** \`$${profile.wallet.toLocaleString()}\``
        )
        .addSeparator()
        .addText(lang.nextStepsHeist);

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('equip_plan', lang.btnPlanHeist),
            btn.secondary('buyequipment_close', lang.btnClose)
        )
    ];

    return { error: null, card: successCard, rows };
}

module.exports = {
    name: 'buyequipment',
    aliases: ['heistequipment', 'buygear', 'tacticalshop'],
    description: lang.cmdDesc.toString(),
    usage: '!buyequipment [equipment_id]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const profile = await EconomyManager.getProfile(userId, message.guild.id);
            const equipmentId = args[0]?.toLowerCase();

            
            if (equipmentId) {
                const result = await processEquipmentPurchase(message.author.id, message.guild.id, equipmentId, `buyequipment:${message.id}`);
                const rows = result.rows || [new ActionRowBuilder().addComponents(btn.danger('buyequipment_close', lang.btnClose))];
                const sentMsg = await sendV2(message, { card: result.card, rows });
                if (!sentMsg) return;

                const directCollector = sentMsg.createMessageComponentCollector({ time: 60000 });
                directCollector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'buyequipment_close') {
                            directCollector.stop('user_closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }
                        if (interaction.customId === 'equip_plan') {
                            directCollector.stop('plan');
                            const planCmd = require('./planheist');
                            return planCmd.execute(message, []);
                        }
                    } catch (directErr) {
                        console.error('Error in direct buyequipment collector:', directErr);
                    }
                });
                directCollector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return;
            }

            
            const initialCard = buildEquipmentCatalogCard(profile);
            const initialRows = buildEquipmentActionRows(profile);

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'buyequipment_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'equip_plan') {
                        collector.stop('plan');
                        const planCmd = require('./planheist');
                        return planCmd.execute(message, []);
                    }

                    if (interaction.customId === 'buyequipment_select') {
                        const chosenId = interaction.values[0];
                        const result = await processEquipmentPurchase(message.author.id, message.guild.id, chosenId, `buyequipment:${interaction.id}`);
                        const receiptRows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('buyequipment_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows: receiptRows });
                    }
                } catch (collectorErr) {
                    console.error('Error in buyequipment catalog collector:', collectorErr);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in buyequipment command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
