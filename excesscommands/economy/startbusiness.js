'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { BUSINESS_TYPES } = require('../../models/economy/constants/businessData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.startbusiness);

function buildRegistryCard() {
    const listText = Object.entries(BUSINESS_TYPES).map(([id, biz]) => {
        const locBiz = resolveEntity('businesses', id, biz);
        return lang.sectorItemLine({
            id,
            name: locBiz.name,
            cost: biz.baseCost.toLocaleString(),
            min: biz.dailyIncome[0].toLocaleString(),
            max: biz.dailyIncome[1].toLocaleString(),
            desc: locBiz.description || biz.description
        });
    }).join('\n\n');

    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.subtitle}**\n> ${lang.registryDesc}`)
        .addSeparator()
        .addText(`### ${lang.sectorsHeader}`)
        .addText(listText)
        .addSeparator()
        .addText(`### ${lang.howToLaunchHeader}`)
        .addText(lang.howToLaunchDesc);

    return card;
}

function buildRegistryActionRows(profile) {
    const wallet = profile.wallet || 0;
    const businesses = profile.businesses || [];
    const maxBusinesses = profile.maxBusinesses || 1;
    const atCapacity = businesses.length >= maxBusinesses;
    const ownedTypes = new Set(businesses.map(b => b.type));

    const selectOptions = Object.entries(BUSINESS_TYPES).map(([id, biz]) => {
        const locBiz = resolveEntity('businesses', id, biz);
        const isOwned = ownedTypes.has(id);
        const canAfford = wallet >= biz.baseCost;

        let statusText = '';
        if (isOwned) {
            statusText = lang.ownedStatusTag.toString();
        } else if (atCapacity) {
            statusText = lang.capacityFullTag.toString();
        } else if (!canAfford) {
            statusText = lang.cannotAffordTag.toString();
        }

        return {
            label: locBiz.name,
            value: id,
            description: lang.selectOptionDesc({
                cost: biz.baseCost.toLocaleString(),
                min: biz.dailyIncome[0],
                max: biz.dailyIncome[1],
                status: statusText
            }).toString()
        };
    });

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('startbiz_select')
            .setPlaceholder(lang.selectPlaceholder.toString())
            .addOptions(selectOptions)
            .setDisabled(atCapacity)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('startbiz_close', lang.btnClose)
    );

    return [menuRow, btnRow];
}

async function processBusinessFounding(userId, guildId, businessType, referenceId) {
    const businessData = BUSINESS_TYPES[businessType];
    if (!businessData) {
        return {
            error: 'invalid',
            card: cards.warning(
                lang.invalidSectorTitle,
                lang.invalidSectorDesc({ type: businessType })
            )
        };
    }

    const locBiz = resolveEntity('businesses', businessType, businessData);
    const founding = await EconomyManager.mutateProfileAtomically({
        userId, guildId, referenceId,
        mutate: profile => {
            if (!Array.isArray(profile.businesses)) profile.businesses = [];
            const maxBusinesses = profile.maxBusinesses || 1;
            if (profile.businesses.length >= maxBusinesses) return { success: false, reason: 'capacity', maxBusinesses, current: profile.businesses.length };
            if (profile.businesses.some(business => business.type === businessType)) return { success: false, reason: 'owned' };
            const wallet = Number(profile.wallet) || 0;
            if (wallet < businessData.baseCost) return { success: false, reason: 'funds', wallet };

            profile.wallet = wallet - businessData.baseCost;
            const now = new Date();
            const newBusiness = {
                businessId: `${businessType}_${referenceId}`, name: locBiz.name, type: businessType,
                level: 1, employees: 0, dailyIncome: businessData.dailyIncome[0], totalEarned: 0,
                lastCollected: now, foundedDate: now, upgradeCost: Math.floor(businessData.baseCost * 0.75), employeeCapacity: 5
            };
            profile.businesses.push(newBusiness);
            profile.businessSkill = Math.min(100, (profile.businessSkill || 0) + 5);
            if (!Array.isArray(profile.transactions)) profile.transactions = [];
            profile.transactions.push({
                type: 'expense', amount: businessData.baseCost,
                description: lang.txIncorporated({ name: locBiz.name }).toString(), category: 'business', timestamp: now
            });
            return { newBusiness };
        }
    });
    if (!founding.success) {
        if (founding.reason === 'capacity') return { error: 'capacity', card: cards.warning(lang.capacityReachedTitle, lang.capacityReachedDesc({ max: founding.maxBusinesses, current: founding.current })) };
        if (founding.reason === 'owned') return { error: 'owned', card: cards.warning(lang.sectorOwnedTitle, lang.sectorOwnedDesc({ name: locBiz.name })) };
        if (founding.reason === 'duplicate') return { error: 'duplicate', card: cards.info(lang.closedTitle, lang.closedDesc) };
        const wallet = founding.wallet || 0;
        return { error: 'funds', card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({
            name: locBiz.name, cost: businessData.baseCost.toLocaleString(), wallet: wallet.toLocaleString(), deficit: Math.max(0, businessData.baseCost - wallet).toLocaleString()
        })) };
    }
    const profile = founding.profile;
    const newBusiness = founding.newBusiness;
    const maxBusinesses = profile.maxBusinesses || 1;

    const charterCard = buildCard({
        title: lang.foundedSuccessTitle({ name: locBiz.name }),
        accentColor: ACCENT.success
    })
        .addText(`### ${lang.corporateCharterHeader}`)
        .addText(lang.charterDetails({
            name: locBiz.name,
            cost: businessData.baseCost.toLocaleString(),
            min: businessData.dailyIncome[0].toLocaleString(),
            max: businessData.dailyIncome[1].toLocaleString(),
            upgradeCost: newBusiness.upgradeCost.toLocaleString(),
            wallet: profile.wallet.toLocaleString()
        }))
        .addSeparator()
        .addText(`### ${lang.growthHeader}`)
        .addText(lang.growthDetails({
            skill: profile.businessSkill,
            current: profile.businesses.length,
            max: maxBusinesses
        }))
        .addSeparator()
        .addText(`### ${lang.nextStepsHeader}`)
        .addText(lang.nextStepsDesc);

    return { error: null, card: charterCard };
}

module.exports = {
    name: 'startbusiness',
    aliases: ['foundbusiness', 'createbusiness', 'newbiz', 'openbusiness'],
    description: lang.cmdDesc.toString(),
    usage: '!startbusiness [type]',
    cooldown: 5000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            const businessType = args[0]?.toLowerCase();

            
            if (businessType) {
                const result = await processBusinessFounding(userId, guildId, businessType, `startbusiness:${message.id}`);
                const rows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('startbiz_manage', lang.btnManage),
                        btn.danger('startbiz_close', lang.btnClose)
                    )
                ];
                const sentMsg = await sendV2(message, { card: result.card, rows });
                if (!sentMsg) return;

                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'startbiz_close') {
                            collector.stop('closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }
                        if (interaction.customId === 'startbiz_manage') {
                            collector.stop('manage');
                            const bizCmd = require('./business');
                            return bizCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error handling startbusiness CLI interaction:', err);
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

            
            const initialCard = buildRegistryCard();
            const initialRows = buildRegistryActionRows(profile);

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'startbiz_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'startbiz_select') {
                        const selectedType = interaction.values[0];
                        const result = await processBusinessFounding(userId, guildId, selectedType, `startbusiness:${interaction.id}`);
                        const finishRows = [
                            new ActionRowBuilder().addComponents(
                                btn.primary('startbiz_manage', lang.btnManage),
                                btn.danger('startbiz_close', lang.btnClose)
                            )
                        ];
                        return editV2(sentMessage, { card: result.card, rows: finishRows });
                    }

                    if (interaction.customId === 'startbiz_manage') {
                        collector.stop('manage');
                        const bizCmd = require('./business');
                        return bizCmd.execute(message, []);
                    }
                } catch (err) {
                    console.error('Error handling startbusiness interactive interaction:', err);
                    editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in startbusiness command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
