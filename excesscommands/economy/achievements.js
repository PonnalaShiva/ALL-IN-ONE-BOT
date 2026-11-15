'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { ACHIEVEMENTS } = require('../../models/economy/constants/systemData');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.achievements);

const CATEGORY_EMOJIS = {
    gambling: '🎰', wealth: '💰', social: '👥', crime: '🔫', fishing: '🐟',
    farming: '🌾', stocks: '📈', hunting: '🎯', prestige: '⭐', general: '🏛️'
};

function getAchievementRank(count) {
    if (count >= 50) return lang.rankLegendary.toString();
    if (count >= 35) return lang.rankDiamond.toString();
    if (count >= 25) return lang.rankGold.toString();
    if (count >= 15) return lang.rankSilver.toString();
    if (count >= 8) return lang.rankBronze.toString();
    if (count >= 3) return lang.rankNovice.toString();
    return lang.rankNewcomer.toString();
}

function generateProgressBar(current, total) {
    const filled = total > 0 ? Math.round((current / total) * 10) : 0;
    const empty = 10 - filled;
    return '`' + '█'.repeat(filled) + '░'.repeat(empty) + '`';
}

function getGroupedAchievements(userAchievements) {
    const categories = {};
    for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
        if (!categories[ach.category]) categories[ach.category] = [];
        const unlocked = userAchievements.find(a => a.achievementId === id);
        categories[ach.category].push({ id, ...ach, unlocked: !!unlocked, unlockedAt: unlocked?.unlockedAt });
    }
    return categories;
}

function buildCategoryCard(categoryName, catAchs) {
    const emoji = CATEGORY_EMOJIS[categoryName] || '🏆';
    const unlockedCount = catAchs.filter(a => a.unlocked).length;
    const catTitle = `${emoji} ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}`;

    const card = buildCard({
        title: lang.categoryTitle({ category: catTitle }),
        accentColor: ACCENT.warning
    })
        .addText(`**${lang.categoryUnlocked({ unlocked: unlockedCount, total: catAchs.length })}**`)
        .addSeparator();

    let listText = '';
    for (const ach of catAchs) {
        const lockIcon = ach.unlocked ? '✅' : '🔒';
        const dateStr = ach.unlocked ? ` — *${new Date(ach.unlockedAt).toLocaleDateString()}*` : '';
        listText += `${lockIcon} **${ach.name}** (+${ach.reward.toLocaleString()} ${lang.ptsSuffix})\n> ${ach.description}${dateStr}\n\n`;
    }

    card.addText(listText.trim());

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('ach_overview', lang.btnOverview),
            btn.secondary('ach_close', lang.btnClose)
        )
    ];

    return { card, rows };
}

function buildOverviewCard(profile, username) {
    const userAchievements = profile.achievements || [];
    const categories = getGroupedAchievements(userAchievements);

    const totalAch = Object.keys(ACHIEVEMENTS).length;
    const totalUnlocked = userAchievements.length;
    const totalPoints = profile.achievementPoints || 0;
    const pct = totalAch > 0 ? Math.round((totalUnlocked / totalAch) * 100) : 0;

    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.warning
    })
        .addText(`**${lang.userTrophies({ username })}**`)
        .addSeparator()
        .addText(
            `> **${lang.unlockedLabel}:** ${totalUnlocked}/${totalAch} (${pct}%)\n` +
            `> **${lang.pointsLabel}:** ${totalPoints.toLocaleString()} ${lang.ptsSuffix}\n` +
            `> **${lang.rankLabel}:** ${getAchievementRank(totalUnlocked)}`
        )
        .addSeparator()
        .addText(`### ${lang.categoriesTitle}`);

    let catText = '';
    for (const [catName, catAchs] of Object.entries(categories)) {
        const emoji = CATEGORY_EMOJIS[catName] || '🏆';
        const unlocked = catAchs.filter(a => a.unlocked).length;
        const total = catAchs.length;
        const bar = generateProgressBar(unlocked, total);
        catText += `${emoji} **${catName.charAt(0).toUpperCase() + catName.slice(1)}** — ${unlocked}/${total}\n${bar}\n\n`;
    }
    catText += `> ${lang.categoryHelp}`;
    card.addText(catText.trim());

    if (userAchievements.length > 0) {
        const recent = [...userAchievements]
            .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
            .slice(0, 5);

        let recentText = '';
        for (const ach of recent) {
            const achData = ACHIEVEMENTS[ach.achievementId];
            if (achData) {
                recentText += `✅ **${achData.name}** — *${new Date(ach.unlockedAt).toLocaleDateString()}*\n`;
            }
        }

        card.addSeparator()
            .addText(`### ${lang.recentTitle}`)
            .addText(recentText.trim());
    }

    const selectOptions = Object.keys(categories).map(catName => ({
        label: `${catName.charAt(0).toUpperCase() + catName.slice(1)}`,
        value: catName,
        description: lang.selectCategoryOptionDesc({ unlocked: categories[catName].filter(a => a.unlocked).length, total: categories[catName].length }).toString(),
        emoji: CATEGORY_EMOJIS[catName] || '🏆'
    }));

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ach_category_select')
            .setPlaceholder(lang.selectCategoryPlaceholder.toString())
            .addOptions(selectOptions)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('ach_close', lang.btnClose)
    );

    return { card, rows: [selectRow, btnRow] };
}

module.exports = {
    name: 'achievements',
    aliases: ['achieve', 'badges', 'trophy'],
    description: lang.cmdDesc.toString(),
    usage: '!achievements | !achievements <category>',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const profile = await EconomyManager.getProfile(userId, guildId);
            const userAchievements = profile.achievements || [];
            const action = args[0]?.toLowerCase();

            const categories = getGroupedAchievements(userAchievements);

            const attachAchievementsCollector = (sentMsg) => {
                if (!sentMsg) return null;
                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'ach_close') {
                            collector.stop('user_closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'ach_overview') {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const ov = buildOverviewCard(freshProfile, message.author.username);
                            return editV2(sentMsg, { card: ov.card, rows: ov.rows });
                        }

                        if (interaction.customId === 'ach_category_select') {
                            const selectedCat = interaction.values[0];
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const freshCategories = getGroupedAchievements(freshProfile.achievements || []);
                            if (freshCategories[selectedCat]) {
                                const catRes = buildCategoryCard(selectedCat, freshCategories[selectedCat]);
                                return editV2(sentMsg, { card: catRes.card, rows: catRes.rows });
                            }
                        }
                    } catch (err) {
                        console.error('Error in achievements collector:', err);
                    }
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return collector;
            };

            
            if (action && categories[action]) {
                const res = buildCategoryCard(action, categories[action]);
                const sentMessage = await sendV2(message, { card: res.card, rows: res.rows });
                attachAchievementsCollector(sentMessage);
                return;
            }

            
            const overview = buildOverviewCard(profile, message.author.username);
            const sentMessage = await sendV2(message, { card: overview.card, rows: overview.rows });
            attachAchievementsCollector(sentMessage);

        } catch (error) {
            console.error('Error in achievements command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
