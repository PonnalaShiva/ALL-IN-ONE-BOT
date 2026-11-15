'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { Economy } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.leaderboard);

async function fetchLeaderboard(guild, type = 'wealth') {
    let leaderboardData = [];
    let title = '';
    let emoji = '';
    let description = '';

    switch (type) {
        case 'wealth':
            leaderboardData = await Economy.aggregate([
                { $match: { guildId: guild.id } },
                {
                    $addFields: {
                        totalWealth: {
                            $add: [
                                { $ifNull: ['$wallet', 0] },
                                { $ifNull: ['$bank', 0] },
                                { $ifNull: ['$familyVault', 0] },
                                {
                                    $sum: {
                                        $map: {
                                            input: { $ifNull: ['$properties', []] },
                                            as: 'asset',
                                            in: { $ifNull: ['$$asset.currentValue', { $ifNull: ['$$asset.purchasePrice', 0] }] }
                                        }
                                    }
                                },
                                {
                                    $sum: {
                                        $map: {
                                            input: { $ifNull: ['$cars', []] },
                                            as: 'asset',
                                            in: { $ifNull: ['$$asset.currentValue', { $ifNull: ['$$asset.purchasePrice', 0] }] }
                                        }
                                    }
                                },
                                {
                                    $sum: {
                                        $map: {
                                            input: { $ifNull: ['$businesses', []] },
                                            as: 'asset',
                                            in: { $ifNull: ['$$asset.purchasePrice', 0] }
                                        }
                                    }
                                },
                                {
                                    $sum: {
                                        $map: {
                                            input: { $ifNull: ['$stockPortfolio', []] },
                                            as: 'holding',
                                            in: { $multiply: [{ $ifNull: ['$$holding.shares', 0] }, { $ifNull: ['$$holding.avgBuyPrice', 0] }] }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                },
                { $sort: { totalWealth: -1 } },
                { $limit: 15 }
            ]);
            title = lang.wealthTitle.toString();
            emoji = '💰';
            description = lang.wealthDesc.toString();
            break;

        case 'level':
            leaderboardData = await Economy.find({ guildId: guild.id })
                .sort({ level: -1, experience: -1 })
                .limit(15);
            title = lang.levelTitle.toString();
            emoji = '⭐';
            description = lang.levelDesc.toString();
            break;

        case 'racing':
            leaderboardData = await Economy.find({ guildId: guild.id })
                .sort({ 'racingStats.wins': -1 })
                .limit(15);
            title = lang.racingTitle.toString();
            emoji = '🏁';
            description = lang.racingDesc.toString();
            break;

        case 'family':
            leaderboardData = await Economy.find({
                guildId: guild.id,
                'familyMembers.0': { $exists: true }
            })
                .sort({ familyBond: -1 })
                .limit(15);
            title = lang.familyTitle.toString();
            emoji = '👨‍👩‍👧‍👦';
            description = lang.familyDesc.toString();
            break;
    }

    if (!leaderboardData || leaderboardData.length === 0) {
        const emptyCard = cards.info(
            lang.noDataTitle,
            lang.noDataDesc({ type })
        );
        return { empty: true, card: emptyCard };
    }

    
    const topThree = leaderboardData.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    let podiumText = '';

    for (let i = 0; i < topThree.length; i++) {
        const doc = topThree[i];
        const member = guild.members.cache.get(doc.userId);
        const username = member ? member.displayName : `<@${doc.userId}>`;

        let metricStr = '';
        switch (type) {
            case 'wealth':
                metricStr = `$${(doc.totalWealth || 0).toLocaleString()}`;
                break;
            case 'level':
                metricStr = lang.levelFormat({ level: doc.level || 0, xp: (doc.experience || 0).toLocaleString() });
                break;
            case 'racing':
                const races = (doc.racingStats?.wins || 0) + (doc.racingStats?.losses || 0);
                const rate = races > 0 ? (((doc.racingStats?.wins || 0) / races) * 100).toFixed(0) : '0';
                metricStr = lang.racingFormat({ wins: doc.racingStats?.wins || 0, rate });
                break;
            case 'family':
                metricStr = lang.familyFormat({ bond: doc.familyBond || 0, kin: doc.familyMembers?.length || 0 });
                break;
        }

        podiumText += `${medals[i]} **${username}** — \`${metricStr}\`\n`;
    }

    
    let runnerUpsText = '';
    if (leaderboardData.length > 3) {
        const runners = leaderboardData.slice(3);
        runnerUpsText = runners.map((doc, idx) => {
            const rank = idx + 4;
            const member = guild.members.cache.get(doc.userId);
            const username = member ? member.displayName : `<@${doc.userId}>`;

            let metricStr = '';
            switch (type) {
                case 'wealth':
                    metricStr = `$${(doc.totalWealth || 0).toLocaleString()}`;
                    break;
                case 'level':
                    metricStr = lang.lvlShort({ level: doc.level || 0 });
                    break;
                case 'racing':
                    metricStr = lang.winsShort({ wins: doc.racingStats?.wins || 0 });
                    break;
                case 'family':
                    metricStr = lang.bondShort({ bond: doc.familyBond || 0 });
                    break;
            }

            return `**${rank}.** ${username} — \`${metricStr}\``;
        }).join('\n');
    }

    const card = buildCard({
        title: `${emoji} ${title} — ${guild.name}`,
        accentColor: ACCENT.warning
    })
        .addText(`> ${description}\n\n### 🏆 ${lang.podiumTitle}\n${podiumText}`);

    if (runnerUpsText) {
        card.addSeparator()
            .addText(`### 📊 ${lang.rankingsTitle({ start: 4, end: leaderboardData.length })}\n${runnerUpsText}`);
    }

    const selectOptions = [
        { label: lang.wealthTitle.toString(), value: 'wealth', description: lang.wealthDesc.toString(), emoji: '💰', default: type === 'wealth' },
        { label: lang.levelTitle.toString(), value: 'level', description: lang.levelDesc.toString(), emoji: '⭐', default: type === 'level' },
        { label: lang.racingTitle.toString(), value: 'racing', description: lang.racingDesc.toString(), emoji: '🏁', default: type === 'racing' },
        { label: lang.familyTitle.toString(), value: 'family', description: lang.familyDesc.toString(), emoji: '👨‍👩‍👧‍👦', default: type === 'family' },
    ];

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('lb_type_select')
            .setPlaceholder(lang.selectCategoryPlaceholder.toString())
            .addOptions(selectOptions)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.primary('lb_refresh', lang.btnRefresh),
        btn.secondary('lb_close', lang.btnClose)
    );

    return { card, rows: [selectRow, btnRow] };
}

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    description: lang.cmdDesc.toString(),
    usage: '!leaderboard [wealth | level | racing | family]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const requestedType = args[0]?.toLowerCase() || 'wealth';
            const validTypes = ['wealth', 'level', 'racing', 'family'];

            if (!validTypes.includes(requestedType)) {
                return sendV2(message, cards.warning(
                    lang.invalidTypeTitle,
                    `${lang.invalidTypeDesc({ type: requestedType })}\n\n${lang.availableTypesDesc}`
                ));
            }

            let currentType = requestedType;
            const res = await fetchLeaderboard(message.guild, currentType);
            const sentMessage = await sendV2(message, { card: res.card, rows: res.rows || [] });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
            try {    
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'lb_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }
    
                    if (interaction.customId === 'lb_refresh') {
                        const refreshed = await fetchLeaderboard(message.guild, currentType);
                        return editV2(sentMessage, { card: refreshed.card, rows: refreshed.rows || [] });
                    }
    
                    if (interaction.customId === 'lb_type_select') {
                        currentType = interaction.values[0];
                        const switched = await fetchLeaderboard(message.guild, currentType);
                        return editV2(sentMessage, { card: switched.card, rows: switched.rows || [] });
                    }
            } catch (err) {
                console.error('[leaderboard.js] Error in component collector:', err);
            }
        });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in leaderboard command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
