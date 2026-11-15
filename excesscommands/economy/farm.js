'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { CROPS, FERTILIZERS, CROP_QUALITY } = require('../../models/economy/constants/farmingData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.farm);

function buildStatusCard(profile, username) {
    const maxPlots = profile.maxPlots || 3;
    const plots = profile.farmPlots || [];
    const stats = profile.farmingStats || {};

    const card = buildCard({
        title: lang.title({ user: username }),
        accentColor: ACCENT.success
    }).addText(
        `> **${lang.statusSubtitle}**\n` +
        lang.statusOverviewLine({
            plots: plots.length,
            max: maxPlots,
            harvested: stats.totalHarvested || 0,
            revenue: (stats.totalFarmEarnings || 0).toLocaleString(),
            level: profile.level || 1
        })
    );

    if (plots.length > 0) {
        card.addSeparator().addText(`### 🌱 ${lang.plotsHeading}`);
        const now = new Date();

        for (let i = 0; i < maxPlots; i++) {
            const plot = plots.find(p => Number(p.plotId) === i);
            if (!plot || plot.status === 'empty') {
                card.addText(lang.emptyPlotLine({ plot: i + 1, idx: i }));
            } else {
                const crop = CROPS[plot.crop];
                const locCrop = resolveEntity('crops', plot.crop, crop || { name: plot.crop });
                const ready = now >= new Date(plot.harvestAt);
                const quality = CROP_QUALITY[plot.quality] || CROP_QUALITY.normal;
                const cropName = locCrop.name || crop?.name || plot.crop;

                if (ready) {
                    card.addText(lang.readyPlotLine({ plot: i + 1, crop: cropName, quality: quality.name, idx: i }));
                } else {
                    const timeLeft = new Date(plot.harvestAt).getTime() - now.getTime();
                    const minsLeft = Math.max(1, Math.ceil(timeLeft / (60 * 1000)));
                    const statusWater = plot.watered ? lang.wateredStatus : lang.dryStatus;
                    card.addText(lang.growingPlotLine({ plot: i + 1, crop: cropName, quality: quality.name, mins: minsLeft, status: statusWater }));
                }
            }
        }
    } else {
        card.addSeparator().addText(lang.noCropsDesc());
    }

    return card;
}

function buildStatusActionRows(profile) {
    const buttons = [
        btn.success('farm_harvest_all', lang.btnHarvestAll),
        btn.primary('farm_water_all', lang.btnWaterAll),
        btn.secondary('farm_view_shop', lang.btnShop),
        btn.danger('farm_close', lang.btnClose)
    ];

    return [new ActionRowBuilder().addComponents(buttons)];
}

function buildShopCard(profile) {
    const card = buildCard({
        title: lang.shopTitle,
        description: lang.shopSubtitle,
        accentColor: ACCENT.primary
    });

    card.addSeparator().addText(`### 🌱 ${lang.seedsHeading}`);
    for (const [id, crop] of Object.entries(CROPS)) {
        const locCrop = resolveEntity('crops', id, crop);
        const locked = (profile.level || 1) < crop.level
            ? lang.seedLocked({ level: crop.level }).toString()
            : '';
        const growMins = Math.round(crop.growTime / (60 * 1000));
        card.addText(lang.seedShopItem({
            name: locCrop.name || crop.name,
            id,
            locked,
            buy: crop.seedPrice,
            sell: crop.sellPrice,
            grow: growMins
        }));
    }

    card.addSeparator().addText(`### 🧪 ${lang.fertsHeading}`);
    for (const [, fert] of Object.entries(FERTILIZERS)) {
        const locFert = resolveEntity('fertilizers', fert.id || '', fert);
        card.addText(lang.fertShopItem({
            name: locFert.name || fert.name,
            price: fert.price,
            speed: fert.growthBoost * 100,
            quality: fert.qualityBoost * 100
        }));
    }

    return card;
}

function buildShopActionRows(profile) {
    const options = Object.entries(CROPS).map(([id, crop]) => {
        const locCrop = resolveEntity('crops', id, crop);
        return {
            label: `${locCrop.name || crop.name} ($${crop.seedPrice})`,
            value: id,
            description: `Yield: $${crop.sellPrice} • Matures in ${Math.round(crop.growTime / 60000)}m • Lv.${crop.level}`,
            emoji: '🌱'
        };
    });

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('farm_select_seed')
            .setPlaceholder(lang.selectSeedPlaceholder.toString())
            .addOptions(options.slice(0, 25))
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.primary('farm_view_status', lang.btnStatus),
        btn.danger('farm_close', lang.btnClose)
    );

    return [selectRow, btnRow];
}

async function routeFarmAction(interaction, sentMsg, message, collector) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (interaction.customId === 'farm_close') {
        collector.stop('user_closed');
        return closeAndAutoDelete(sentMsg, cards.info(lang.closedTitle, lang.closedDesc));
    }

    if (interaction.customId === 'farm_view_shop') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        return editV2(sentMsg, { card: buildShopCard(freshProfile), rows: buildShopActionRows(freshProfile) });
    }

    if (interaction.customId === 'farm_view_status') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        return editV2(sentMsg, { card: buildStatusCard(freshProfile, message.author.username), rows: buildStatusActionRows(freshProfile) });
    }

    if (interaction.customId === 'farm_select_seed') {
        const seedId = interaction.values[0];
        const freshProfile = await EconomyManager.getProfile(userId, guildId);

        const maxPlots = freshProfile.maxPlots || 3;
        let targetPlot = 0;
        for (let i = 0; i < maxPlots; i++) {
            const p = (freshProfile.farmPlots || []).find(x => Number(x.plotId) === i);
            if (!p || p.status === 'empty') {
                targetPlot = i;
                break;
            }
        }

        const result = await EconomyManager.plantCrop(userId, guildId, seedId, targetPlot, `farm-plant:${interaction.id}`);
        if (!result.success) {
            return editV2(sentMsg, {
                card: cards.error(lang.errorTitle, result.error || lang.errorMessage),
                rows: [new ActionRowBuilder().addComponents(btn.primary('farm_view_shop', lang.btnShop), btn.secondary('farm_close', lang.btnClose))]
            });
        }

        const locCrop = resolveEntity('crops', seedId, result.crop);
        const growMins = Math.round(result.crop.growTime / (60 * 1000));
        const plantCard = buildCard({
            title: lang.plantSuccessTitle,
            accentColor: ACCENT.success
        }).addText(
            lang.plantSuccessDesc({
                crop: locCrop.name || result.crop.name,
                plot: targetPlot + 1,
                growMins,
                cost: result.crop.seedPrice,
                sell: result.crop.sellPrice
            }) + `\n\n${lang.waterHint({ plot: targetPlot })}`
        );

        const afterRows = [new ActionRowBuilder().addComponents(
            btn.primary('farm_view_status', lang.btnStatus),
            btn.secondary('farm_close', lang.btnClose)
        )];

        return editV2(sentMsg, { card: plantCard, rows: afterRows });
    }

    if (interaction.customId.startsWith('farm_deposit_')) {
        const depositAmt = parseInt(interaction.customId.replace('farm_deposit_', ''), 10) || 0;
        const transfer = depositAmt > 0 ? await EconomyManager.transferBank({ userId, guildId, direction: 'deposit', amount: depositAmt, referenceId: `farm-deposit:${sentMsg.id}`, description: 'Deposited farm harvest proceeds' }) : { success: false };
        const freshProfile = transfer.profile || await EconomyManager.getProfile(userId, guildId);
        const canDeposit = transfer.success ? transfer.amount : 0;
        return editV2(sentMsg, {
            card: cards.success(lang.harvestSuccessTitle, `> 🏦 **Deposited $${canDeposit.toLocaleString()} into your bank!**\n> Bank Balance: $${(freshProfile.bank || 0).toLocaleString()}`),
            rows: [new ActionRowBuilder().addComponents(
                btn.primary('farm_view_status', lang.btnStatus),
                btn.secondary('farm_close', lang.btnClose)
            )]
        });
    }

    if (interaction.customId === 'farm_harvest_all') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        const maxPlots = freshProfile.maxPlots || 3;
        let totalEarnings = 0;
        let harvestedCount = 0;
        const results = [];

        for (let i = 0; i < maxPlots; i++) {
            const result = await EconomyManager.harvestCrop(userId, guildId, i, `farm-harvest:${interaction.id}:${i}`);
            if (result.success) {
                totalEarnings += result.sellPrice;
                harvestedCount++;
                results.push(result);
            }
        }

        if (harvestedCount === 0) {
            return editV2(sentMsg, {
                card: cards.warning(lang.nothingToHarvestTitle, lang.nothingToHarvestDesc()),
                rows: [new ActionRowBuilder().addComponents(btn.primary('farm_view_status', lang.btnStatus), btn.secondary('farm_close', lang.btnClose))]
            });
        }

        const hCard = buildCard({
            title: lang.harvestSuccessTitle,
            accentColor: ACCENT.success
        }).addText(lang.harvestSuccessDesc({
            count: harvestedCount,
            earnings: totalEarnings.toLocaleString()
        }));

        hCard.addSeparator().addText(`### ${lang.harvestBreakdownHeader}`);
        for (const r of results) {
            const locCrop = resolveEntity('crops', r.crop?.id || '', r.crop || {});
            hCard.addText(lang.harvestItemLine({
                crop: locCrop.name || r.crop.name,
                quality: r.quality.name,
                price: r.sellPrice.toLocaleString()
            }));
        }

        return editV2(sentMsg, {
            card: hCard,
            rows: [new ActionRowBuilder().addComponents(
                btn.success(`farm_deposit_${totalEarnings}`, lang.btnDepositBank),
                btn.primary('farm_view_status', lang.btnStatus),
                btn.secondary('farm_close', lang.btnClose)
            )]
        });
    }

    if (interaction.customId === 'farm_water_all') {
        const freshProfile = await EconomyManager.getProfile(userId, guildId);
        const maxPlots = freshProfile.maxPlots || 3;
        for (let i = 0; i < maxPlots; i++) {
            await EconomyManager.waterCrop(userId, guildId, i, `farm-water:${interaction.id}:${i}`);
        }

        const updatedProfile = await EconomyManager.getProfile(userId, guildId);
        const refreshedCard = buildStatusCard(updatedProfile, message.author.username);
        return editV2(sentMsg, { card: refreshedCard, rows: buildStatusActionRows(updatedProfile) });
    }
}

function attachFarmCollector(sentMsg, message) {
    if (!sentMsg) return null;
    const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async (interaction) => {
        try {
            if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
            await interaction.deferUpdate();
            await routeFarmAction(interaction, sentMsg, message, collector);
        } catch (err) {
            console.error('Error in farm collector:', err);
        }
    });
    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
        }
    });
    return collector;
}

module.exports = {
    name: 'farm',
    aliases: ['farming', 'garden', 'plant'],
    description: 'Manage your farm — plant, water, harvest crops',
    usage: '!farm | !farm plant <crop> [plot] | !farm water [plot] | !farm harvest [plot|all] | !farm shop',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const profile = await EconomyManager.getProfile(userId, guildId);
            const action = args[0]?.toLowerCase();

            
            if (action === 'shop') {
                const card = buildShopCard(profile);
                const rows = buildShopActionRows(profile);

                const sentMessage = await sendV2(message, { card, rows });
                attachFarmCollector(sentMessage, message);
                return;
            }

            
            if (action === 'plant') {
                const cropId = args[1]?.toLowerCase();
                const plotIndex = parseInt(args[2], 10) || 0;

                if (!cropId) {
                    return sendV2(message, cards.warning(
                        lang.specifyCropTitle,
                        lang.specifyCropDesc()
                    ));
                }

                const result = await EconomyManager.plantCrop(userId, guildId, cropId, plotIndex, `farm-plant:${message.id}`);
                if (!result.success) {
                    return sendV2(message, cards.error(
                        lang.errorTitle,
                        result.error || lang.errorMessage
                    ));
                }

                const locCrop = resolveEntity('crops', cropId, result.crop);
                const growMins = Math.round(result.crop.growTime / (60 * 1000));
                const plantCard = buildCard({
                    title: lang.plantSuccessTitle,
                    accentColor: ACCENT.success
                }).addText(
                    lang.plantSuccessDesc({
                        crop: locCrop.name || result.crop.name,
                        plot: plotIndex + 1,
                        growMins,
                        cost: result.crop.seedPrice,
                        sell: result.crop.sellPrice
                    }) + `\n\n${lang.waterHint({ plot: plotIndex })}`
                );

                const rows = [new ActionRowBuilder().addComponents(
                    btn.primary('farm_view_status', lang.btnStatus),
                    btn.secondary('farm_close', lang.btnClose)
                )];
                const sentMsg = await sendV2(message, { card: plantCard, rows });
                attachFarmCollector(sentMsg, message);
                return sentMsg;
            }

            
            if (action === 'water') {
                const plotIndex = parseInt(args[1], 10) || 0;
                const result = await EconomyManager.waterCrop(userId, guildId, plotIndex, `farm-water:${message.id}`);

                if (!result.success) {
                    return sendV2(message, cards.error(
                        lang.errorTitle,
                        result.error || lang.errorMessage
                    ));
                }

                const quality = CROP_QUALITY[result.quality] || CROP_QUALITY.normal;
                const waterCard = buildCard({
                    title: lang.waterSuccessTitle,
                    accentColor: ACCENT.primary
                }).addText(lang.waterSuccessDesc({
                    plot: plotIndex + 1,
                    quality: `${quality.name} (${quality.multiplier}x value)`
                }));

                const rows = [new ActionRowBuilder().addComponents(
                    btn.primary('farm_view_status', lang.btnStatus),
                    btn.secondary('farm_close', lang.btnClose)
                )];
                const sentMsg = await sendV2(message, { card: waterCard, rows });
                attachFarmCollector(sentMsg, message);
                return sentMsg;
            }

            
            if (action === 'harvest') {
                const plotArg = args[1]?.toLowerCase();

                if (plotArg === 'all') {
                    const maxPlots = profile.maxPlots || 3;
                    let totalEarnings = 0;
                    let harvestedCount = 0;
                    const results = [];

                    for (let i = 0; i < maxPlots; i++) {
                        const result = await EconomyManager.harvestCrop(userId, guildId, i, `farm-harvest:${message.id}:${i}`);
                        if (result.success) {
                            totalEarnings += result.sellPrice;
                            harvestedCount++;
                            results.push(result);
                        }
                    }

                    if (harvestedCount === 0) {
                        return sendV2(message, cards.warning(
                            lang.nothingToHarvestTitle,
                            lang.nothingToHarvestDesc()
                        ));
                    }

                    const card = buildCard({
                        title: lang.harvestSuccessTitle,
                        accentColor: ACCENT.success
                    }).addText(lang.harvestSuccessDesc({
                        count: harvestedCount,
                        earnings: totalEarnings.toLocaleString()
                    }));

                    card.addSeparator().addText(`### ${lang.harvestBreakdownHeader}`);
                    for (const r of results) {
                        const locCrop = resolveEntity('crops', r.crop?.id || '', r.crop || {});
                        card.addText(lang.harvestItemLine({
                            crop: locCrop.name || r.crop.name,
                            quality: r.quality.name,
                            price: r.sellPrice.toLocaleString()
                        }));
                    }

                    const rows = [new ActionRowBuilder().addComponents(
                        btn.success(`farm_deposit_${totalEarnings}`, lang.btnDepositBank),
                        btn.primary('farm_view_status', lang.btnStatus),
                        btn.secondary('farm_close', lang.btnClose)
                    )];

                    const sentMsg = await sendV2(message, { card, rows });
                    attachFarmCollector(sentMsg, message);
                    return;
                }

                const plotIndex = parseInt(plotArg, 10) || 0;
                const result = await EconomyManager.harvestCrop(userId, guildId, plotIndex, `farm-harvest:${message.id}:${plotIndex}`);

                if (!result.success) {
                    if (result.readyAt) {
                        const minsLeft = Math.max(1, Math.ceil((new Date(result.readyAt).getTime() - Date.now()) / (60 * 1000)));
                        return sendV2(message, cards.warning(
                            lang.notReadyTitle,
                            lang.notReadyDesc({ plot: plotIndex + 1, mins: minsLeft })
                        ));
                    }
                    return sendV2(message, cards.error(
                        lang.errorTitle,
                        result.error || lang.errorMessage
                    ));
                }

                const locCrop = resolveEntity('crops', result.crop?.id || '', result.crop || {});
                const card = buildCard({
                    title: lang.singleHarvestTitle,
                    accentColor: ACCENT.success
                }).addText(lang.singleHarvestDesc({
                    crop: locCrop.name || result.crop.name,
                    quality: result.quality.name,
                    plot: plotIndex + 1,
                    earnings: result.sellPrice.toLocaleString(),
                    xp: result.xp
                }));

                const newProfile = await EconomyManager.getProfile(userId, guildId);
                const newAchievements = await EconomyManager.checkAchievements(newProfile);
                if (newAchievements.length > 0) {
                    card.addSeparator().addText(`### 🏆 ${lang.achievementTitle}`);
                    for (const a of newAchievements) {
                        card.addText(`• **${a.name}** — ${a.description} (+\`$${a.reward}\`)`);
                    }
                }

                const rows = [new ActionRowBuilder().addComponents(
                    btn.success(`farm_deposit_${result.sellPrice}`, lang.btnDepositBank),
                    btn.primary('farm_view_status', lang.btnStatus),
                    btn.secondary('farm_close', lang.btnClose)
                )];
                const sentMsg = await sendV2(message, { card, rows });
                attachFarmCollector(sentMsg, message);
                return;
            }

            
            const card = buildStatusCard(profile, message.author.username);
            const rows = buildStatusActionRows(profile);

            const sentMessage = await sendV2(message, { card, rows });
            attachFarmCollector(sentMessage, message);

        } catch (error) {
            console.error('Error in farm command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
