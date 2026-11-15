'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { PROPERTIES } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.buyhouse);

function buildCatalogCard() {
    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.catalogSubtitle}**\n> ${lang.catalogIntro}`)
        .addSeparator();

    const propertiesByType = {};
    Object.entries(PROPERTIES).forEach(([id, prop]) => {
        if (!propertiesByType[prop.type]) propertiesByType[prop.type] = [];
        propertiesByType[prop.type].push([id, prop]);
    });

    Object.entries(propertiesByType).forEach(([type, properties]) => {
        card.addText(`### ${type.toUpperCase()}`);
        const propText = properties.map(([id, prop]) => {
            const locProp = resolveEntity('houses', id, prop);
            return `**\`${id}\`** — ${locProp.name}\n> **${lang.priceLabel}:** \`$${prop.price.toLocaleString()}\` • ${lang.familyLabel}: \`${prop.maxFamilyMembers}\` • ${lang.securityLabel}: \`${prop.securityLevel}/10\`\n> **${lang.garageLabel}:** \`${prop.hasGarage ? `${prop.garageCapacity} cars` : 'None'}\' • **${lang.vaultLabel}:** \`$${prop.vaultCapacity.toLocaleString()}\``;
        }).join('\n');
        card.addText(propText);
    });

    card.addSeparator()
        .addText(`> ${lang.howToPurchase}`);

    return card;
}

function buildCatalogActionRows(profile) {
    const ownedIds = new Set((profile.properties || []).map(p => p.propertyId));
    const wallet = profile.wallet || 0;

    const selectOptions = Object.entries(PROPERTIES).map(([id, prop]) => {
        const locProp = resolveEntity('houses', id, prop);
        const isOwned = ownedIds.has(id);
        const canAfford = wallet >= prop.price;
        return {
            label: locProp.name,
            value: id,
            description: `$${prop.price.toLocaleString()} • ${prop.type} • Vault $${prop.vaultCapacity.toLocaleString()}${isOwned ? ' [Owned]' : !canAfford ? ' [Short]' : ''}`
        };
    });

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('buyhouse_select')
            .setPlaceholder(lang.selectPlaceholder.toString())
            .addOptions(selectOptions)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('buyhouse_close', lang.btnClose)
    );

    return [menuRow, btnRow];
}

async function processPropertyPurchase(userId, guildId, propertyId, referenceId) {
    const propertyData = PROPERTIES[propertyId];
    if (!propertyData) {
        return { error: 'invalid', card: cards.warning(lang.invalidPropertyTitle, lang.invalidPropertyDesc({ id: propertyId })) };
    }

    const locProp = resolveEntity('houses', propertyId, propertyData);
    const purchase = await EconomyManager.mutateProfileAtomically({
        userId, guildId, referenceId,
        mutate: profile => {
            if ((profile.properties || []).some(property => property.propertyId === propertyId)) return { success: false, reason: 'owned' };
            const wallet = Number(profile.wallet) || 0;
            if (wallet < propertyData.price) return { success: false, reason: 'funds', wallet };

            profile.wallet = wallet - propertyData.price;
            if (!Array.isArray(profile.properties)) profile.properties = [];
            profile.properties.push({
                propertyId, name: locProp.name, type: propertyData.type,
                purchasePrice: propertyData.price, currentValue: propertyData.price,
                monthlyRent: propertyData.monthlyRent, utilities: propertyData.utilities,
                securityLevel: propertyData.securityLevel, maxFamilyMembers: propertyData.maxFamilyMembers,
                hasGarage: propertyData.hasGarage, garageCapacity: propertyData.garageCapacity,
                vaultCapacity: propertyData.vaultCapacity, condition: 'good', dateAcquired: new Date()
            });
            if (!profile.primaryResidence) {
                profile.primaryResidence = propertyId;
                profile.maxPets = Math.floor(propertyData.maxFamilyMembers / 2);
            }
            if (!Array.isArray(profile.transactions)) profile.transactions = [];
            profile.transactions.push({
                type: 'expense', amount: propertyData.price,
                description: lang.txPurchasedProperty({ name: locProp.name }).toString(), category: 'property'
            });
            return { property: locProp.name };
        }
    });
    if (!purchase.success) {
        if (purchase.reason === 'owned') return { error: 'owned', card: cards.warning(lang.alreadyOwnedTitle, lang.alreadyOwnedDesc({ name: propertyData.name })) };
        if (purchase.reason === 'duplicate') return { error: 'duplicate', card: cards.info(lang.closedTitle, lang.closedDesc) };
        const wallet = purchase.wallet || 0;
        return { error: 'funds', card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({
            name: propertyData.name, price: propertyData.price.toLocaleString(), wallet: wallet.toLocaleString(), shortage: Math.max(0, propertyData.price - wallet).toLocaleString()
        })) };
    }
    const profile = purchase.profile;

    const successCard = buildCard({
        title: lang.successTitle,
        accentColor: ACCENT.success
    })
        .addText(`> **${lang.successSubtitle}**\n> ${lang.successDesc({ name: locProp.name, price: propertyData.price.toLocaleString() })}`)
        .addSeparator()
        .addText(`### ${lang.specsTitle}`)
        .addText(
            `**🏠 ${lang.propertyLabel}:** \`${locProp.name}\` (${propertyData.type})\n` +
            `**👨‍👩‍👧‍👦 ${lang.familyLabel}:** \`${propertyData.maxFamilyMembers}\` • **🛡️ ${lang.securityLabel}:** \`${propertyData.securityLevel}/10\`\n` +
            `**🏦 ${lang.vaultLabel}:** \`$${propertyData.vaultCapacity.toLocaleString()}\` • **🚗 ${lang.garageLabel}:** \`${propertyData.hasGarage ? lang.garageCapacityFormat({ capacity: propertyData.garageCapacity }) : lang.noneLabel}\`\n` +
            `**💰 ${lang.maintenanceLabel}:** \`$${(propertyData.monthlyRent + propertyData.utilities).toLocaleString()}\``
        )
        .addSeparator()
        .addText(`### ${lang.summaryTitle}`)
        .addText(
            `**💰 ${lang.purchasePriceLabel}:** \`$${propertyData.price.toLocaleString()}\`\n` +
            `**💳 ${lang.remainingWalletLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
            `**🏘️ ${lang.totalPropertiesLabel}:** \`${profile.properties.length}\``
        );

    return { success: true, card: successCard };
}

module.exports = {
    name: 'buyhouse',
    aliases: ['house-buy', 'buyproperty'],
    description: lang.cmdDesc.toString(),
    usage: '!buyhouse [property_id]',
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;

            
            if (args[0]) {
                const propertyId = args[0].toLowerCase();
                const result = await processPropertyPurchase(userId, guildId, propertyId, `buyhouse:${message.id}`);
                return sendV2(message, result.card);
            }

            
            const profile = await EconomyManager.getProfile(userId, guildId);
            const catalogCard = buildCatalogCard();
            const actionRows = buildCatalogActionRows(profile);

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
    
                    if (interaction.isStringSelectMenu() && interaction.customId === 'buyhouse_select') {
                        const selectedId = interaction.values[0];
                        const result = await processPropertyPurchase(userId, guildId, selectedId, `buyhouse:${interaction.id}`);
                        collector.stop('purchased');
                        return editV2(sentMessage, result.card);
                    } else if (interaction.customId === 'buyhouse_close') {
                        collector.stop('closed');
                        return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }
            } catch (err) {
                console.error('[buyhouse.js] Error in component collector:', err);
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
            console.error('Error in buyhouse command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
