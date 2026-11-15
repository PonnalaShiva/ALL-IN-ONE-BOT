'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { BUSINESS_TYPES } = require('../../models/economy/constants/businessData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.business);

async function buildEmpireDashboardCard(profile, alertText = null) {
    let totalDailyProfit = 0;
    const businesses = profile.businesses || [];

    for (const biz of businesses) {
        const income = await EconomyManager.calculateBusinessIncome(biz, profile);
        totalDailyProfit += income.profit;
    }

    const totalAssetValue = businesses.reduce((total, biz) => total + (biz.purchasePrice || 0), 0);
    const avgReputation = businesses.length > 0
        ? Math.floor(businesses.reduce((sum, biz) => sum + (biz.reputation || 0), 0) / businesses.length)
        : 0;

    const card = buildCard({
        title: lang.overviewTitle,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.overviewSubtitle}**\n> ${lang.managingCount({ count: businesses.length, max: profile.maxBusinesses || 5 })}`)
        .addSeparator();

    if (alertText) {
        card.addText(alertText).addSeparator();
    }

    card.addText(`### ${lang.statsTitle}`)
        .addText(
            `**💎 ${lang.dailyProfitLabel}:** \`$${totalDailyProfit.toLocaleString()}\`\n` +
            `**🏢 ${lang.portfolioValueLabel}:** \`$${totalAssetValue.toLocaleString()}\`\n` +
            `**📈 ${lang.businessSkillLabel}:** \`${profile.businessSkill || 0}%\`\n` +
            `**🎯 ${lang.experienceLabel}:** \`${(profile.experience || 0).toLocaleString()} XP\`\n` +
            `**⭐ ${lang.avgReputationLabel}:** \`${avgReputation}%\``
        )
        .addSeparator()
        .addText(`### ${lang.businessesTitle}`);

    const businessesToShow = businesses.slice(0, 3);
    for (let i = 0; i < businessesToShow.length; i++) {
        const biz = businessesToShow[i];
        const bizType = BUSINESS_TYPES[biz.type] || {};
        const locBiz = resolveEntity('businesses', biz.type, bizType);
        const income = await EconomyManager.calculateBusinessIncome(biz, profile);
        const hoursUntilCollection = biz.lastCollection ?
            Math.max(0, 24 - Math.floor((Date.now() - new Date(biz.lastCollection).getTime()) / (1000 * 60 * 60))) : 0;

        const profitMargin = income.revenue > 0 ? ((income.profit / income.revenue) * 100).toFixed(1) : 0;
        const profitText = income.profit > 0 ?
            lang.profitMarginFormat({ profit: income.profit.toLocaleString(), margin: profitMargin }) :
            lang.profitLossFormat.toString();

        const collectionStr = hoursUntilCollection > 0 ?
            lang.remainingHours({ hours: hoursUntilCollection }) :
            lang.readyCollection.toString();

        card.addText(
            lang.bizCardItem({
                idx: i + 1,
                name: biz.name || locBiz.name,
                level: biz.level,
                type: locBiz.name || biz.type,
                profitText,
                revenue: income.revenue.toLocaleString(),
                expenses: income.expenses.toLocaleString(),
                employees: biz.employees || 0,
                maxEmployees: bizType.maxEmployees || 10,
                reputation: biz.reputation || 0,
                collection: collectionStr
            })
        );
    }

    if (businesses.length > 3) {
        card.addText(lang.moreBusinesses({ count: businesses.length - 3 }));
    }

    card.addSeparator()
        .addText(`### ${lang.quickCommandsTitle}`)
        .addText(lang.quickCommandsList);

    return card;
}

function buildEmpireDashboardActionRows() {
    return [
        new ActionRowBuilder().addComponents(
            btn.success('biz_collect', lang.btnCollect),
            btn.primary('biz_expand', lang.btnExpand),
            btn.secondary('biz_refresh', lang.btnRefresh),
            btn.danger('biz_close', lang.btnClose)
        )
    ];
}

module.exports = {
    name: 'business',
    aliases: ['biz', 'businesses'],
    description: lang.cmdDesc.toString(),
    usage: '!business [collect | upgrade | hire | fire | delete | invest | help] [index] [amount]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            if (!profile.businesses || profile.businesses.length === 0) {
                const emptyCard = cards.warning(lang.noBusinessTitle, lang.noBusinessDesc);
                const emptyRows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('biz_start_new', lang.btnFound),
                        btn.danger('biz_close', lang.btnClose)
                    )
                ];
                const sentMsg = await sendV2(message, { card: emptyCard, rows: emptyRows });
                if (!sentMsg) return;

                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'biz_close') {
                            collector.stop('closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }
                        if (interaction.customId === 'biz_start_new') {
                            collector.stop('start');
                            const startCmd = require('./startbusiness');
                            return startCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error in business empty collector:', err);
                    }
                });
                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return;
            }

            const action = args[0]?.toLowerCase();

            
            if (!action) {
                const card = await buildEmpireDashboardCard(profile);
                const rows = buildEmpireDashboardActionRows();

                const sentMessage = await sendV2(message, { card, rows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 90000 });

                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'biz_close') {
                            collector.stop('user_closed');
                            return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'biz_expand') {
                            collector.stop('expand');
                            const startCmd = require('./startbusiness');
                            return startCmd.execute(message, []);
                        }

                        if (interaction.customId === 'biz_refresh') {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const freshCard = await buildEmpireDashboardCard(freshProfile);
                            return editV2(sentMessage, { card: freshCard, rows: buildEmpireDashboardActionRows() });
                        }

                        if (interaction.customId === 'biz_collect') {
                            const result = await EconomyManager.collectBusinessIncome(userId, guildId, `business-collect:${interaction.id}`);
                            const freshProfile = result.profile || await EconomyManager.getProfile(userId, guildId);

                            if (result.totalProfit <= 0) {
                                const alert = `> ⚠️ **${lang.noProfitsTitle}** — ${lang.noProfitsDesc}`;
                                const freshCard = await buildEmpireDashboardCard(freshProfile, alert);
                                return editV2(sentMessage, { card: freshCard, rows: buildEmpireDashboardActionRows() });
                            }

                            const rewards = result.rewards;

                            const collectCard = buildCard({
                                title: lang.collectSuccessTitle,
                                accentColor: ACCENT.success
                            })
                                .addText(lang.collectIntro)
                                .addSeparator()
                                .addText(`### ${lang.collectReportTitle}`)
                                .addText(
                                    `**💎 ${lang.totalProfitLabel}:** \`+$${result.totalProfit.toLocaleString()}\`\n` +
                                    `**💳 ${lang.newBalanceLabel}:** \`$${(freshProfile.wallet || 0).toLocaleString()}\`\n` +
                                    `**⭐ ${lang.experienceGainedLabel}:** \`+${rewards.expGain} XP\`\n` +
                                    `**📈 ${lang.skillGainedLabel}:** \`+${rewards.skillGain}%\` (Now ${freshProfile.businessSkill}%)`
                                );

                            if (result.businessReport && result.businessReport.length > 0) {
                                const reportText = result.businessReport.slice(0, 3).map(biz =>
                                    lang.reportItemLine({
                                        name: biz.name,
                                        revenue: biz.revenue.toLocaleString(),
                                        expenses: biz.expenses.toLocaleString(),
                                        profit: biz.profit.toLocaleString()
                                    })
                                ).join('\n\n');

                                collectCard.addSeparator()
                                    .addText(`### ${lang.breakdownTitle}`)
                                    .addText(reportText);
                            }

                            const finishRows = [
                                new ActionRowBuilder().addComponents(
                                    btn.success('biz_deposit', lang.btnDepositProfits),
                                    btn.primary('biz_dashboard_back', lang.title),
                                    btn.danger('biz_close', lang.btnClose)
                                )
                            ];

                            return editV2(sentMessage, { card: collectCard, rows: finishRows });
                        }

                        if (interaction.customId === 'biz_deposit') {
                            const transfer = await EconomyManager.transferBank({ userId, guildId, direction: 'deposit', amount: 'all', referenceId: `business-deposit:${sentMessage.id}`, description: lang.txDepositProfits({ amount: 'business profits' }).toString() });
                            const freshProfile = transfer.profile || await EconomyManager.getProfile(userId, guildId);

                            const freshCard = await buildEmpireDashboardCard(freshProfile);
                            return editV2(sentMessage, { card: freshCard, rows: buildEmpireDashboardActionRows() });
                        }

                        if (interaction.customId === 'biz_dashboard_back') {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const freshCard = await buildEmpireDashboardCard(freshProfile);
                            return editV2(sentMessage, { card: freshCard, rows: buildEmpireDashboardActionRows() });
                        }
                    } catch (err) {
                        console.error('Error in business dashboard collector:', err);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => { });
                    }
                });

                return;
            }

            
            if (action === 'collect') {
                const result = await EconomyManager.collectBusinessIncome(userId, guildId, `business-collect:${message.id}`);
                profile = result.profile || await EconomyManager.getProfile(userId, guildId);

                if (result.totalProfit <= 0) {
                    const collectionInfo = profile.businesses.map((biz, idx) => {
                        const locBiz = resolveEntity('businesses', biz.type, biz);
                        const hoursSince = biz.lastCollection ?
                            (Date.now() - new Date(biz.lastCollection).getTime()) / (1000 * 60 * 60) : 24;
                        const hoursLeft = Math.max(0, 24 - hoursSince);
                        return `**${idx + 1}. ${biz.name || locBiz.name}:** \`${hoursLeft > 0 ? `${Math.floor(hoursLeft)}h ${Math.floor((hoursLeft % 1) * 60)}m` : lang.readyCollection}\``;
                    }).join('\n');

                    return sendV2(message, cards.warning(
                        lang.noProfitsTitle,
                        `${lang.noProfitsDesc}\n\n**${lang.collectionStatusHeader}:**\n${collectionInfo}`
                    ));
                }

                const rewards = result.rewards;

                const card = buildCard({
                    title: lang.collectSuccessTitle,
                    accentColor: ACCENT.success
                })
                    .addText(lang.collectIntro)
                    .addSeparator()
                    .addText(`### ${lang.collectReportTitle}`)
                    .addText(
                        `**💎 ${lang.totalProfitLabel}:** \`+$${result.totalProfit.toLocaleString()}\`\n` +
                        `**💳 ${lang.newBalanceLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\`\n` +
                        `**⭐ ${lang.experienceGainedLabel}:** \`+${rewards.expGain} XP\`\n` +
                        `**📈 ${lang.skillGainedLabel}:** \`+${rewards.skillGain}%\` (Now ${profile.businessSkill}%)`
                    );

                if (result.businessReport && result.businessReport.length > 0) {
                    const reportText = result.businessReport.slice(0, 3).map(biz =>
                        lang.reportItemLine({
                            name: biz.name,
                            revenue: biz.revenue.toLocaleString(),
                            expenses: biz.expenses.toLocaleString(),
                            profit: biz.profit.toLocaleString()
                        })
                    ).join('\n\n');

                    card.addSeparator()
                        .addText(`### ${lang.breakdownTitle}`)
                        .addText(reportText);
                }

                const rows = [
                    new ActionRowBuilder().addComponents(
                        btn.success('biz_deposit', lang.btnDepositProfits),
                        btn.secondary('biz_close', lang.btnClose)
                    )
                ];

                const sentMsg = await sendV2(message, { card, rows });
                if (!sentMsg) return;

                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'biz_close') {
                            collector.stop('closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'biz_deposit') {
                            const transfer = await EconomyManager.transferBank({ userId, guildId, direction: 'deposit', amount: 'all', referenceId: `business-deposit:${sentMsg.id}`, description: lang.txDepositProfits({ amount: 'business profits' }).toString() });
                            const freshProfile = transfer.profile || await EconomyManager.getProfile(userId, guildId);
                            const canDeposit = transfer.success ? transfer.amount : 0;
                            collector.stop('deposited');
                            return editV2(sentMsg, {
                                card: cards.success(lang.title, lang.depositSuccess({
                                    amount: canDeposit.toLocaleString(),
                                    bank: (freshProfile.bank || 0).toLocaleString()
                                })),
                                rows: []
                            });
                        }
                    } catch (err) {
                        console.error('Error in business collect receipt collector:', err);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            }

            
            if (action === 'fire') {
                const businessIndex = parseInt(args[1], 10) - 1;
                const fireAmount = args[2] === undefined ? 1 : Number(args[2]);

                if (!Number.isSafeInteger(fireAmount) || fireAmount <= 0) return sendV2(message, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc));

                if (isNaN(businessIndex) || businessIndex < 0 || businessIndex >= profile.businesses.length) {
                    return sendV2(message, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc));
                }

                let business = profile.businesses[businessIndex];
                const locBiz = resolveEntity('businesses', business.type, business);
                if ((business.employees || 0) < fireAmount) {
                    return sendV2(message, cards.warning(
                        lang.notEnoughEmployeesTitle,
                        lang.notEnoughEmployeesDesc({
                            name: business.name || locBiz.name,
                            employees: business.employees || 0,
                            amount: fireAmount
                        })
                    ));
                }

                const mutation = await EconomyManager.mutateProfileAtomically({
                    userId, guildId, referenceId: `business-fire:${message.id}`,
                    mutate: async current => {
                        const currentBusiness = current.businesses?.[businessIndex];
                        if (!currentBusiness || currentBusiness.businessId !== business.businessId || (currentBusiness.employees || 0) < fireAmount) return { success: false, error: 'staff_changed' };
                        currentBusiness.employees -= fireAmount;
                        const severanceCost = Math.min(Number(current.wallet) || 0, fireAmount * 200);
                        current.wallet = (current.wallet || 0) - severanceCost;
                        current.transactions.push({ type: 'expense', amount: severanceCost, description: `Severance for ${fireAmount} staff at ${currentBusiness.name}`, category: 'business', timestamp: new Date() });
                        const rewards = await EconomyManager.giveBusinessExperience(current, 'fire', fireAmount);
                        return { severanceCost, rewards };
                    }
                });
                if (!mutation?.success) return sendV2(message, cards.warning(lang.notEnoughEmployeesTitle, lang.notEnoughEmployeesDesc({ name: business.name || locBiz.name, employees: business.employees || 0, amount: fireAmount })));
                profile = mutation.profile;
                business = profile.businesses[businessIndex];
                const severanceCost = mutation.severanceCost;
                const rewards = mutation.rewards;

                const bizType = BUSINESS_TYPES[business.type] || {};
                const dailySavings = fireAmount * (bizType.employeeCost || 100) * 0.6;

                const card = buildCard({
                    title: lang.fireSuccessTitle,
                    accentColor: ACCENT.warning
                })
                    .addText(lang.firedDesc({ amount: fireAmount, name: business.name || locBiz.name }))
                    .addSeparator()
                    .addText(`### ${lang.fireDetailsTitle}`)
                    .addText(
                        `**💸 ${lang.severanceLabel}:** \`$${severanceCost.toLocaleString()}\`\n` +
                        `**👥 ${lang.remainingStaffLabel}:** \`${business.employees}\`\n` +
                        `**💰 ${lang.dailySavingsLabel}:** \`$${dailySavings.toLocaleString()}\`\n` +
                        `**💳 ${lang.remainingWalletLabel}:** \`$${profile.wallet.toLocaleString()}\``
                    );

                const rows = [
                    new ActionRowBuilder().addComponents(btn.secondary('biz_close', lang.btnClose))
                ];
                return sendWithCloseCollector(message, { card, rows }, userId);
            }

            
            if (action === 'delete' || action === 'sell') {
                const businessIndex = parseInt(args[1], 10) - 1;

                if (isNaN(businessIndex) || businessIndex < 0 || businessIndex >= profile.businesses.length) {
                    return sendV2(message, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc));
                }

                const business = profile.businesses[businessIndex];
                const locBiz = resolveEntity('businesses', business.type, business);
                const sale = await EconomyManager.mutateProfileAtomically({
                    userId, guildId, referenceId: `business-sell:${message.id}`,
                    mutate: async current => {
                        const currentBusiness = current.businesses?.[businessIndex];
                        if (!currentBusiness || currentBusiness.businessId !== business.businessId) return { success: false, error: 'business_changed' };
                        const businessSnapshot = { name: currentBusiness.name, purchasePrice: currentBusiness.purchasePrice || 0 };
                        const sellValue = await EconomyManager.sellBusiness(current, businessIndex);
                        const rewards = await EconomyManager.giveBusinessExperience(current, 'delete');
                        return { sellValue, rewards, businessSnapshot };
                    }
                });
                if (!sale?.success) return sendV2(message, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc));
                profile = sale.profile;
                const sellValue = sale.sellValue;
                const rewards = sale.rewards;
                const soldBusiness = sale.businessSnapshot;

                const card = buildCard({
                    title: lang.soldSuccessTitle,
                    accentColor: ACCENT.primary
                })
                    .addText(lang.soldIntro({ name: soldBusiness.name || locBiz.name, value: sellValue.toLocaleString() }))
                    .addSeparator()
                    .addText(`### ${lang.soldDetailsTitle}`)
                    .addText(
                        `**💎 ${lang.saleValueLabel}:** \`$${sellValue.toLocaleString()}\`\n` +
                        `**📊 ${lang.originalCostLabel}:** \`$${(soldBusiness.purchasePrice || 0).toLocaleString()}\`\n` +
                        `**📈 ${lang.profitLossLabel}:** \`$${(sellValue - (soldBusiness.purchasePrice || 0)).toLocaleString()}\`\n` +
                        `**💳 ${lang.newBalanceLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
                        `**⭐ ${lang.xpGainedLabel}:** \`+${rewards.expGain} XP\`\n` +
                        `**🏢 ${lang.remainingBizLabel}:** \`${profile.businesses.length}/${profile.maxBusinesses || 5}\``
                    );

                const rows = [
                    new ActionRowBuilder().addComponents(btn.secondary('biz_close', lang.btnClose))
                ];
                return sendWithCloseCollector(message, { card, rows }, userId);
            }

            
            if (action === 'upgrade') {
                const businessIndex = parseInt(args[1], 10) - 1;
                if (isNaN(businessIndex) || businessIndex < 0 || businessIndex >= profile.businesses.length) {
                    return sendV2(message, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc));
                }

                let business = profile.businesses[businessIndex];
                const businessType = BUSINESS_TYPES[business.type] || {};
                const locBiz = resolveEntity('businesses', business.type, businessType);

                if (business.level >= (businessType.maxLevel || 10)) {
                    return sendV2(message, cards.warning(
                        lang.maxLevelTitle,
                        lang.maxLevelDesc({ name: business.name || locBiz.name, max: businessType.maxLevel || 10 })
                    ));
                }

                if ((profile.wallet || 0) < business.upgradeCost) {
                    return sendV2(message, cards.warning(
                        lang.insufficientFundsTitle,
                        lang.upgradeNeededFunds({
                            cost: business.upgradeCost.toLocaleString(),
                            name: business.name || locBiz.name,
                            wallet: (profile.wallet || 0).toLocaleString()
                        })
                    ));
                }

                const upgrade = await EconomyManager.mutateProfileAtomically({
                    userId, guildId, referenceId: `business-upgrade:${message.id}`,
                    mutate: async current => {
                        const currentBusiness = current.businesses?.[businessIndex];
                        if (!currentBusiness || currentBusiness.businessId !== business.businessId) return { success: false, error: 'business_changed' };
                        if ((currentBusiness.level || 1) >= (businessType.maxLevel || 10)) return { success: false, error: 'max_level' };
                        const cost = Number(currentBusiness.upgradeCost) || 0;
                        if (cost <= 0 || (current.wallet || 0) < cost) return { success: false, error: 'funds' };
                        const oldIncome = await EconomyManager.calculateBusinessIncome(currentBusiness, current);
                        current.wallet -= cost;
                        currentBusiness.level += 1;
                        currentBusiness.upgradeCost = Math.floor(cost * (businessType.upgradeCostMultiplier || 1.5));
                        currentBusiness.reputation = Math.min(100, (currentBusiness.reputation || 0) + 5);
                        currentBusiness.efficiency = Math.min(2.0, (currentBusiness.efficiency || 1.0) + 0.05);
                        const newIncome = await EconomyManager.calculateBusinessIncome(currentBusiness, current);
                        current.transactions.push({ type: 'expense', amount: cost, description: lang.txUpgradedBiz({ name: currentBusiness.name || locBiz.name, level: currentBusiness.level }).toString(), category: 'business', timestamp: new Date() });
                        const rewards = await EconomyManager.giveBusinessExperience(current, 'upgrade');
                        return { upgradeCostPaid: cost, oldIncome, newIncome, rewards };
                    }
                });
                if (!upgrade?.success) {
                    if (upgrade?.error === 'max_level') return sendV2(message, cards.warning(lang.maxLevelTitle, lang.maxLevelDesc({ name: business.name || locBiz.name, max: businessType.maxLevel || 10 })));
                    if (upgrade?.error === 'business_changed') return sendV2(message, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc));
                    return sendV2(message, cards.warning(lang.insufficientFundsTitle, lang.upgradeNeededFunds({ cost: (business.upgradeCost || 0).toLocaleString(), name: business.name || locBiz.name, wallet: ((upgrade.profile || profile).wallet || 0).toLocaleString() })));
                }
                profile = upgrade.profile;
                business = profile.businesses[businessIndex];
                const upgradeCostPaid = upgrade.upgradeCostPaid;
                const oldIncome = upgrade.oldIncome;
                const newIncome = upgrade.newIncome;
                const rewards = upgrade.rewards;

                const card = buildCard({
                    title: lang.upgradeSuccessTitle,
                    accentColor: ACCENT.success
                })
                    .addText(lang.upgradedIntro({ name: business.name || locBiz.name, level: business.level }))
                    .addSeparator()
                    .addText(`### ${lang.upgradeBenefitsTitle}`)
                    .addText(
                        `**💰 ${lang.upgradeCostLabel}:** \`$${upgradeCostPaid.toLocaleString()}\`\n` +
                        `**📊 ${lang.newLevelLabel}:** \`${business.level}/${businessType.maxLevel || 10}\`\n` +
                        `**⭐ ${lang.reputationLabel}:** \`${business.reputation}%\` (+5%)\n` +
                        `**🎯 ${lang.efficiencyLabel}:** \`${Math.floor(business.efficiency * 100)}%\` (+5%)\n` +
                        `**📈 ${lang.profitIncreaseLabel}:** \`+$${(newIncome.profit - oldIncome.profit).toLocaleString()}\`\n` +
                        `**💎 ${lang.newDailyProfitLabel}:** \`$${newIncome.profit.toLocaleString()}\`\n` +
                        `**⭐ ${lang.experienceLabel}:** \`+${rewards.expGain} XP\` • **Skill:** \`+${rewards.skillGain}%\`\n` +
                        `**💳 ${lang.remainingWalletLabel}:** \`$${profile.wallet.toLocaleString()}\``
                    );

                const rows = [
                    new ActionRowBuilder().addComponents(btn.secondary('biz_close', lang.btnClose))
                ];
                return sendWithCloseCollector(message, { card, rows }, userId);
            }

            
            if (action === 'hire') {
                const businessIndex = parseInt(args[1], 10) - 1;
                const hireAmount = args[2] === undefined ? 1 : Number(args[2]);

                if (!Number.isSafeInteger(hireAmount) || hireAmount <= 0) return sendV2(message, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc));

                if (isNaN(businessIndex) || businessIndex < 0 || businessIndex >= profile.businesses.length) {
                    return sendV2(message, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc));
                }

                let business = profile.businesses[businessIndex];
                const businessType = BUSINESS_TYPES[business.type] || {};
                const locBiz = resolveEntity('businesses', business.type, businessType);

                if ((business.employees || 0) + hireAmount > (businessType.maxEmployees || 20)) {
                    return sendV2(message, cards.warning(
                        lang.employeeLimitTitle,
                        lang.employeeLimitDesc({
                            name: business.name || locBiz.name,
                            max: businessType.maxEmployees || 20,
                            current: business.employees || 0
                        })
                    ));
                }

                const baseHiringCost = 1000 + (business.level * 200);
                const hiringCost = hireAmount * baseHiringCost;

                if ((profile.wallet || 0) < hiringCost) {
                    return sendV2(message, cards.warning(
                        lang.insufficientFundsTitle,
                        lang.hireNeededFunds({
                            cost: hiringCost.toLocaleString(),
                            amount: hireAmount,
                            name: business.name || locBiz.name,
                            wallet: (profile.wallet || 0).toLocaleString()
                        })
                    ));
                }

                const mutation = await EconomyManager.mutateProfileAtomically({
                    userId, guildId, referenceId: `business-hire:${message.id}`,
                    mutate: async current => {
                        const currentBusiness = current.businesses?.[businessIndex];
                        if (!currentBusiness || currentBusiness.businessId !== business.businessId) return { success: false, error: 'business_changed' };
                        const limit = businessType.maxEmployees || 20;
                        if ((currentBusiness.employees || 0) + hireAmount > limit) return { success: false, error: 'employee_limit' };
                        const liveCost = hireAmount * (1000 + ((currentBusiness.level || 1) * 200));
                        if ((current.wallet || 0) < liveCost) return { success: false, error: 'funds' };
                        const oldIncome = await EconomyManager.calculateBusinessIncome(currentBusiness, current);
                        current.wallet -= liveCost;
                        currentBusiness.employees = (currentBusiness.employees || 0) + hireAmount;
                        const newIncome = await EconomyManager.calculateBusinessIncome(currentBusiness, current);
                        current.transactions.push({ type: 'expense', amount: liveCost, description: `Hired ${hireAmount} staff at ${currentBusiness.name}`, category: 'business', timestamp: new Date() });
                        const rewards = await EconomyManager.giveBusinessExperience(current, 'hire', hireAmount);
                        return { hiringCost: liveCost, oldIncome, newIncome, profitIncrease: newIncome.profit - oldIncome.profit, rewards };
                    }
                });
                if (!mutation?.success) {
                    const current = mutation.profile || profile;
                    if (mutation.error === 'employee_limit') return sendV2(message, cards.warning(lang.employeeLimitTitle, lang.employeeLimitDesc({ name: business.name || locBiz.name, max: businessType.maxEmployees || 20, current: business.employees || 0 })));
                    if (mutation.error === 'business_changed') return sendV2(message, cards.warning(lang.invalidNumberTitle, lang.invalidNumberDesc));
                    return sendV2(message, cards.warning(lang.insufficientFundsTitle, lang.hireNeededFunds({ cost: hiringCost.toLocaleString(), amount: hireAmount, name: business.name || locBiz.name, wallet: (current.wallet || 0).toLocaleString() })));
                }
                profile = mutation.profile;
                business = profile.businesses[businessIndex];
                const rewards = mutation.rewards;
                const newIncome = mutation.newIncome;
                const profitIncrease = mutation.profitIncrease;
                const liveHiringCost = mutation.hiringCost;

                const card = buildCard({
                    title: lang.hireSuccessTitle,
                    accentColor: ACCENT.success
                })
                    .addText(lang.hiredIntro({ amount: hireAmount, name: business.name || locBiz.name }))
                    .addSeparator()
                    .addText(`### ${lang.hireBenefitsTitle}`)
                    .addText(
                        `**💰 ${lang.hiringCostLabel}:** \`$${liveHiringCost.toLocaleString()}\`\n` +
                        `**👥 ${lang.totalStaffLabel}:** \`${business.employees}/${businessType.maxEmployees || 20}\`\n` +
                        `**💸 ${lang.dailyStaffCostLabel}:** \`$${newIncome.expenses.toLocaleString()}\`\n` +
                        `**📈 ${lang.profitIncreaseLabel}:** \`+$${profitIncrease.toLocaleString()}\`\n` +
                        `**💎 ${lang.newDailyProfitLabel}:** \`$${newIncome.profit.toLocaleString()}\`\n` +
                        `**⭐ ${lang.experienceLabel}:** \`+${rewards.expGain} XP\` • **Skill:** \`+${rewards.skillGain}%\`\n` +
                        `**💳 ${lang.remainingWalletLabel}:** \`$${profile.wallet.toLocaleString()}\``
                    );

                const rows = [
                    new ActionRowBuilder().addComponents(btn.secondary('biz_close', lang.btnClose))
                ];
                return sendWithCloseCollector(message, { card, rows }, userId);
            }

            
            if (action === 'invest' && args[1]) {
                const investmentAmount = Number(args[1]);

                if (!Number.isSafeInteger(investmentAmount) || investmentAmount <= 0) {
                    return sendV2(message, cards.warning(lang.invalidInvestmentTitle, lang.invalidInvestmentDesc));
                }

                if ((profile.wallet || 0) < investmentAmount) {
                    return sendV2(message, cards.warning(
                        lang.insufficientFundsTitle,
                        lang.investNeededFunds({
                            amount: investmentAmount.toLocaleString(),
                            wallet: (profile.wallet || 0).toLocaleString()
                        })
                    ));
                }

                const investment = await EconomyManager.mutateProfileAtomically({
                    userId, guildId, referenceId: `business-invest:${message.id}`,
                    mutate: async current => {
                        const businesses = current.businesses || [];
                        if (!businesses.length) return { success: false, error: 'no_business' };
                        if ((current.wallet || 0) < investmentAmount) return { success: false, error: 'funds' };
                        const investmentPerBusiness = Math.floor(investmentAmount / businesses.length);
                        const remainder = investmentAmount % businesses.length;
                        let totalReputationGain = 0;
                        let totalEfficiencyGain = 0;
                        businesses.forEach((business, index) => {
                            const businessInvestment = investmentPerBusiness + (index === businesses.length - 1 ? remainder : 0);
                            const reputationGain = Math.min(5, Math.floor(businessInvestment / 10000));
                            const efficiencyGain = Math.min(2.5, Math.floor(businessInvestment / 20000));
                            business.reputation = Math.min(100, (business.reputation || 0) + reputationGain);
                            business.efficiency = Math.min(2.0, (business.efficiency || 1.0) + (efficiencyGain / 100));
                            totalReputationGain += reputationGain;
                            totalEfficiencyGain += efficiencyGain;
                        });
                        current.wallet -= investmentAmount;
                        current.transactions.push({ type: 'expense', amount: investmentAmount, description: lang.txInvestedBiz({ count: businesses.length }).toString(), category: 'business', timestamp: new Date() });
                        return { count: businesses.length, totalReputationGain, totalEfficiencyGain };
                    }
                });
                if (!investment?.success) return sendV2(message, cards.warning(lang.insufficientFundsTitle, lang.investNeededFunds({ amount: investmentAmount.toLocaleString(), wallet: ((investment.profile || profile).wallet || 0).toLocaleString() })));
                profile = investment.profile;
                const { totalReputationGain, totalEfficiencyGain } = investment;

                const card = buildCard({
                    title: lang.investSuccessTitle,
                    accentColor: ACCENT.success
                })
                    .addText(lang.investIntro({ amount: investmentAmount.toLocaleString(), count: investment.count }))
                    .addSeparator()
                    .addText(`### ${lang.investBenefitsTitle}`)
                    .addText(
                        `**📈 ${lang.totalRepGainLabel}:** \`+${totalReputationGain}%\`\n` +
                        `**⚡ ${lang.totalEffGainLabel}:** \`+${totalEfficiencyGain.toFixed(1)}%\`\n` +
                        `**💳 ${lang.remainingWalletLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
                        `${lang.investFooter}`
                    );

                const rows = [
                    new ActionRowBuilder().addComponents(btn.secondary('biz_close', lang.btnClose))
                ];
                return sendWithCloseCollector(message, { card, rows }, userId);
            }

            
            const helpCard = buildCard({
                title: lang.helpTitle,
                accentColor: ACCENT.info
            }).addText(lang.helpGuideDesc);

            const rows = [
                new ActionRowBuilder().addComponents(btn.secondary('biz_close', lang.btnClose))
            ];
            return sendWithCloseCollector(message, { card: helpCard, rows }, userId);

        } catch (error) {
            console.error('Error in business command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
