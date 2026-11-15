'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { getButtonEmoji, getEmoji } = require('../../UI/emojis/emoji');
const { EconomyManager } = require('../../models/economy/economy');
const { HOUSES } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.myhome);
const buyhouseLang = createInterpolatableProxy(rawLang.economy?.buyhouse);

function buildMyHomeCard(profile, username, notification = null) {
    const properties = profile.properties || [];
    const primaryId = profile.primaryResidence || (properties[0]?.propertyId);
    const primary = properties.find(p => p.propertyId === primaryId) || properties[0];

    const card = buildCard({
        title: lang.title({ username }),
        accentColor: ACCENT.primary
    });

    if (notification) {
        card.addText(`> ${notification}`).addSeparator();
    } else {
        card.addText(`> ${lang.subtitle}`).addSeparator();
    }

    if (primary) {
        const localizedPrimary = resolveEntity('houses', primary.propertyId, primary);
        card.addText(`### 🏡 ${lang.primaryResidenceTitle}`)
            .addText(
                `**${localizedPrimary.name}** (\`${primary.type}\`)\n` +
                `> • **${lang.conditionLabel}:** \`${(primary.condition || 'good').toUpperCase()}\`\n` +
                `> • **${lang.securityLabel}:** \`${primary.securityLevel || 1}/10\`\n` +
                `> • **${lang.vaultCapLabel}:** \`$${(primary.vaultCapacity || 10000).toLocaleString()}\`\n` +
                `> • **${lang.garageLabel}:** \`${primary.hasGarage ? `${primary.garageCapacity} slots` : 'None'}\`\n` +
                `> • **${lang.residentsLabel}:** \`${(profile.familyMembers || []).length} / ${primary.maxFamilyMembers || 1}\`\n` +
                `> • **${lang.marketValueLabel}:** \`$${(primary.currentValue || primary.purchasePrice || 10000).toLocaleString()}\``
            );
    }

    if (properties.length > 1) {
        card.addSeparator().addText(`### 🏘️ ${lang.otherPropertiesTitle}`);
        const otherList = properties
            .filter(p => p.propertyId !== primary?.propertyId)
            .map((p, idx) => {
                const locProp = resolveEntity('houses', p.propertyId, p);
                return `**${idx + 2}. ${locProp.name}** (\`${p.type}\`) — \`$${(p.currentValue || p.purchasePrice || 10000).toLocaleString()}\``;
            })
            .join('\n');
        card.addText(otherList);
    }

    return card;
}

function buildRealEstateMarketView(profile) {
    const card = buildCard({
        title: buyhouseLang.title,
        description: buyhouseLang.catalogSubtitle,
        accentColor: ACCENT.primary
    });

    const options = [];
    const ownedIds = (profile.properties || []).map(p => p.propertyId);

    for (const [id, house] of Object.entries(HOUSES)) {
        const localized = resolveEntity('houses', id, house);
        const isOwned = ownedIds.includes(id);

        card.addText(
            `**${localized.name}** (\`${house.type}\`) — \`${house.price.toLocaleString()}\`${isOwned ? ' \`[OWNED]\`' : ''}\n` +
            `> Security: \`Lvl ${house.securityLevel}\` · Family: \`${house.maxFamilyMembers} slots\` · Garage: \`${house.hasGarage ? `${house.garageCapacity} slots` : 'None'}\`\n`
        );

        if (!isOwned) {
            options.push({
                label: `${localized.name} ($${house.price.toLocaleString()})`,
                value: `buy_house_${id}`,
                description: `Sec: ${house.securityLevel} • Family: ${house.maxFamilyMembers} • ${house.type}`,
                emoji: getButtonEmoji('home')
            });
        }
    }

    const rows = [];
    if (options.length > 0) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('home_buy_select')
                    .setPlaceholder(buyhouseLang.selectPlaceholder.toString())
                    .addOptions(options.slice(0, 25))
            )
        );
    }

    rows.push(
        new ActionRowBuilder().addComponents(
            btn.primary('home_back_to_estate', lang.title({ username: 'My' })),
            btn.danger('home_close', lang.btnClose)
        )
    );

    return { card, rows };
}

async function routeHomeAction(interaction, sentMessage, message, collector) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (interaction.customId === 'home_close') {
        collector.stop('user_closed');
        return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
    }

    if (interaction.customId === 'home_back_to_estate') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        const curProps = freshProfile.properties || [];
        if (curProps.length === 0) {
            const emptyCard = cards.warning(
                lang.noHomeTitle,
                `${lang.noHomeDesc}\n\n> 💡 *Click below to browse the Real Estate Agency directly!*`
            );
            const emptyRows = [
                new ActionRowBuilder().addComponents(
                    btn.primary('home_browse_realestate', lang.btnBrowseShop),
                    btn.danger('home_close', lang.btnClose)
                )
            ];
            return editV2(sentMessage, { card: emptyCard, rows: emptyRows });
        }

        const curPrimary = curProps.find(p => p.propertyId === freshProfile.primaryResidence) || curProps[0];
        const nextCost = Math.floor((curPrimary?.currentValue || 10000) * 0.1);
        const stillCan = (freshProfile.wallet || 0) >= nextCost && (curPrimary?.securityLevel || 1) < 10;

        const freshCard = buildMyHomeCard(freshProfile, message.author.username);
        const freshRows = [
            new ActionRowBuilder().addComponents(
                btn.primary('home_upgrade', `${lang.btnUpgrade} ($${nextCost.toLocaleString()})`).setDisabled(!stillCan),
                btn.secondary('home_browse_realestate', lang.btnBrowseShop),
                btn.danger('home_close', lang.btnClose)
            )
        ];
        return editV2(sentMessage, { card: freshCard, rows: freshRows });
    }

    if (interaction.customId === 'home_browse_realestate') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        const marketView = buildRealEstateMarketView(freshProfile);
        return editV2(sentMessage, { card: marketView.card, rows: marketView.rows });
    }

    if (interaction.customId === 'home_buy_select') {
        const houseId = interaction.values[0].replace('buy_house_', '');
        const houseData = HOUSES[houseId];
        if (!houseData) return;

        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        const localizedHouse = resolveEntity('houses', houseId, houseData);

        if ((freshProfile.wallet || 0) < houseData.price) {
            return editV2(sentMessage, {
                card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ name: localizedHouse.name, cost: houseData.price.toLocaleString(), wallet: (freshProfile.wallet || 0).toLocaleString() })),
                rows: [new ActionRowBuilder().addComponents(btn.primary('home_back_to_estate', lang.title({ username: 'My' })), btn.danger('home_close', lang.btnClose))]
            });
        }

        const purchase = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `home-buy:${interaction.id}`, mutate: async current => {
            if ((current.wallet || 0) < houseData.price) return { success: false, error: 'funds' };
            current.wallet -= houseData.price;
            current.properties.push({ propertyId: houseId, name: localizedHouse.name, type: houseData.type, securityLevel: houseData.securityLevel, vaultCapacity: houseData.vaultCapacity, hasGarage: houseData.hasGarage, garageCapacity: houseData.garageCapacity, maxFamilyMembers: houseData.maxFamilyMembers, purchasePrice: houseData.price, currentValue: houseData.price, condition: 'excellent', acquiredAt: new Date() });
            if (!current.primaryResidence) current.primaryResidence = houseId;
            current.transactions.push({ type: 'expense', amount: houseData.price, description: lang.txPurchasedProperty({ name: localizedHouse.name }).toString(), category: 'property', timestamp: new Date() });
            return {};
        } });
        if (!purchase?.success) {
            const current = purchase.profile || freshProfile;
            return editV2(sentMessage, { card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ name: localizedHouse.name, cost: houseData.price.toLocaleString(), wallet: (current.wallet || 0).toLocaleString() })), rows: [new ActionRowBuilder().addComponents(btn.primary('home_back_to_estate', lang.title({ username: 'My' })), btn.danger('home_close', lang.btnClose))] });
        }

        const boughtCard = cards.success(buyhouseLang.successTitle, buyhouseLang.successDesc({ name: localizedHouse.name, price: houseData.price.toLocaleString() }));
        return editV2(sentMessage, {
            card: boughtCard,
            rows: [new ActionRowBuilder().addComponents(btn.primary('home_back_to_estate', lang.btnBackToEstate), btn.danger('home_close', lang.btnClose))]
        });
    }

    if (interaction.customId === 'home_upgrade') {
        let freshProfile = await EconomyManager.getProfile(userId, guildId);
        const curProps = freshProfile.properties || [];
        const curPrimary = curProps.find(p => p.propertyId === freshProfile.primaryResidence) || curProps[0];
        if (!curPrimary) return;

        const loc = resolveEntity('houses', curPrimary.propertyId, curPrimary);
        const upgrade = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `home-upgrade:${interaction.id}`, mutate: async current => {
            const property = (current.properties || []).find(entry => entry.propertyId === curPrimary.propertyId);
            if (!property) return { success: false, error: 'missing' };
            if ((property.securityLevel || 1) >= 10) return { success: false, error: 'max_level' };
            const cost = Math.floor((property.currentValue || 10000) * 0.1);
            if ((current.wallet || 0) < cost) return { success: false, error: 'funds', cost };
            property.securityLevel = Math.min(10, (property.securityLevel || 1) + 1);
            property.currentValue = Math.floor((property.currentValue || 10000) * 1.15);
            const conditions = ['poor', 'fair', 'good', 'excellent'];
            const condIndex = conditions.indexOf(property.condition || 'good');
            if (condIndex !== -1 && condIndex < conditions.length - 1) property.condition = conditions[condIndex + 1];
            current.wallet -= cost;
            current.transactions.push({ type: 'expense', amount: cost, description: lang.txPropertyUpgrade({ name: loc.name }).toString(), category: 'property', timestamp: new Date() });
            return { cost, securityLevel: property.securityLevel, currentValue: property.currentValue };
        } });
        if (!upgrade?.success) return editV2(sentMessage, cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ name: loc.name, cost: (upgrade.cost || 0).toLocaleString(), wallet: ((upgrade.profile || freshProfile).wallet || 0).toLocaleString() })));
        freshProfile = upgrade.profile;
        const cost = upgrade.cost;
        curPrimary.securityLevel = upgrade.securityLevel;
        curPrimary.currentValue = upgrade.currentValue;

        const notif = lang.upgradeSuccessDesc({ level: curPrimary.securityLevel, value: curPrimary.currentValue.toLocaleString() });
        const nextCost = Math.floor((curPrimary.currentValue || 10000) * 0.1);
        const stillCan = freshProfile.wallet >= nextCost && curPrimary.securityLevel < 10;

        const updatedCard = buildMyHomeCard(freshProfile, message.author.username, notif);
        const updatedRows = [
            new ActionRowBuilder().addComponents(
                btn.primary('home_upgrade', `${lang.btnUpgrade} ($${nextCost.toLocaleString()})`).setDisabled(!stillCan),
                btn.secondary('home_browse_realestate', lang.btnBrowseShop),
                btn.danger('home_close', lang.btnClose)
            )
        ];

        return editV2(sentMessage, { card: updatedCard, rows: updatedRows });
    }
}

function attachHomeCollector(sentMessage, message) {
    if (!sentMessage) return null;
    const collector = sentMessage.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async (interaction) => {
        try {
            if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
            await interaction.deferUpdate();
            await routeHomeAction(interaction, sentMessage, message, collector);
        } catch (err) {
            console.error('Error in home collector:', err);
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
    name: 'myhome',
    aliases: ['home', 'house', 'property', 'residence'],
    description: lang.cmdDesc.toString(),
    usage: '!myhome | !myhome upgrade <number> | !myhome sell <number>',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);
            const properties = profile.properties || [];

            
            if (properties.length === 0) {
                const emptyCard = cards.warning(
                    lang.noHomeTitle,
                    `${lang.noHomeDesc}\n\n> 💡 *Click below to browse the Real Estate Agency directly!*`
                );
                const emptyRows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('home_browse_realestate', lang.btnBrowseShop),
                        btn.danger('home_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: emptyCard, rows: emptyRows });
                attachHomeCollector(sentMessage, message);
                return;
            }

            
            const action = args[0]?.toLowerCase();
            if (action === 'upgrade' && args[1]) {
                const propertyIndex = parseInt(args[1], 10) - 1;
                if (propertyIndex < 0 || propertyIndex >= properties.length) {
                    return sendV2(message, cards.warning(
                        lang.invalidNumberTitle,
                        lang.invalidNumberDesc({ count: properties.length })
                    ));
                }

                const property = properties[propertyIndex];
                const locProp = resolveEntity('houses', property.propertyId, property);
                const upgradeCost = Math.floor((property.currentValue || 10000) * 0.1);

                if ((profile.wallet || 0) < upgradeCost) {
                    return sendV2(message, cards.warning(
                        lang.insufficientFundsTitle,
                        lang.insufficientFundsDesc({
                            name: locProp.name,
                            cost: upgradeCost.toLocaleString(),
                            wallet: (profile.wallet || 0).toLocaleString()
                        })
                    ));
                }

                const mutation = await EconomyManager.mutateProfileAtomically({ userId, guildId, referenceId: `home-upgrade:${message.id}`, mutate: async current => {
                    const liveProperty = current.properties?.find(entry => entry.propertyId === property.propertyId);
                    if (!liveProperty) return { success: false, error: 'missing' };
                    const cost = Math.floor((liveProperty.currentValue || 10000) * 0.1);
                    if ((current.wallet || 0) < cost) return { success: false, error: 'funds' };
                    current.wallet -= cost;
                    liveProperty.securityLevel = Math.min(10, (liveProperty.securityLevel || 1) + 1);
                    liveProperty.currentValue = Math.floor((liveProperty.currentValue || 10000) * 1.15);
                    const conditions = ['poor', 'fair', 'good', 'excellent'];
                    const conditionIndex = conditions.indexOf(liveProperty.condition || 'good');
                    if (conditionIndex !== -1 && conditionIndex < conditions.length - 1) liveProperty.condition = conditions[conditionIndex + 1];
                    current.transactions.push({ type: 'expense', amount: cost, description: lang.txPropertyUpgrade({ name: locProp.name }).toString(), category: 'property', timestamp: new Date() });
                    return { securityLevel: liveProperty.securityLevel, currentValue: liveProperty.currentValue };
                } });
                if (!mutation?.success) return sendV2(message, cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ name: locProp.name, cost: upgradeCost.toLocaleString(), wallet: ((mutation.profile || profile).wallet || 0).toLocaleString() })));
                profile = mutation.profile;
                const securityLevel = mutation.securityLevel;
                const currentValue = mutation.currentValue;

                const upgradeCard = buildCard({
                    title: lang.upgradeSuccessTitle({ name: locProp.name }),
                    accentColor: ACCENT.success
                })
                    .addText(`> ${lang.upgradeSuccessDesc({ level: securityLevel, value: currentValue.toLocaleString() })}`)
                    .addSeparator()
                    .addText(`> **${lang.marketValueLabel}:** \`$${currentValue.toLocaleString()}\` • **${lang.securityLabel}:** \`${securityLevel}/10\``);

                return sendWithCloseCollector(message, { card: upgradeCard, rows: [new ActionRowBuilder().addComponents(btn.danger('home_close', lang.btnClose))] }, userId);
            }

            
            const primary = properties.find(p => p.propertyId === profile.primaryResidence) || properties[0];
            const upgradeCost = Math.floor((primary.currentValue || 10000) * 0.1);
            const canUpgrade = (profile.wallet || 0) >= upgradeCost && (primary.securityLevel || 1) < 10;

            const initialCard = buildMyHomeCard(profile, message.author.username);
            const initialRows = [
                new ActionRowBuilder().addComponents(
                    btn.primary('home_upgrade', `${lang.btnUpgrade} ($${upgradeCost.toLocaleString()})`).setDisabled(!canUpgrade),
                    btn.secondary('home_browse_realestate', lang.btnBrowseShop),
                    btn.danger('home_close', lang.btnClose)
                )
            ];

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            attachHomeCollector(sentMessage, message);

        } catch (error) {
            console.error('Error in myhome command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
