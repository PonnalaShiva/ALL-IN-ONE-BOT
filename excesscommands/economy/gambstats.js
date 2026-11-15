'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.gambstats);

function getGamblerQuote(netProfit, totalBets) {
    if (totalBets === 0) return lang.quoteNoData.toString();
    if (netProfit > 100000) return lang.quoteTop.toString();
    if (netProfit > 50000) return lang.quoteHigh.toString();
    if (netProfit > 10000) return lang.quoteGood.toString();
    if (netProfit > 0) return lang.quoteSlight.toString();
    if (netProfit === 0) return lang.quoteEven.toString();
    if (netProfit > -10000) return lang.quoteLow.toString();
    if (netProfit > -50000) return lang.quoteBad.toString();
    return lang.quoteRuin.toString();
}

function buildGamblingStatsCard(profile, username) {
    const stats = profile.gamblingStats || {};

    const totalBets = stats.totalBets || 0;
    const totalWagered = stats.totalWagered || 0;
    const totalWon = stats.totalWon || 0;
    const totalLost = stats.totalLost || 0;
    const biggestWin = stats.biggestWin || 0;
    const biggestLoss = stats.biggestLoss || 0;

    const netProfit = totalWon - totalLost;
    const profitSign = netProfit >= 0 ? '+' : '';
    const winRate = totalBets > 0 ? ((totalWon > 0 ? totalBets - (totalLost > 0 ? Math.round(totalBets * (totalLost / (totalWon + totalLost))) : 0) : 0) / totalBets * 100).toFixed(1) : '0.0';
    const avgBet = totalBets > 0 ? Math.round(totalWagered / totalBets) : 0;
    const roi = totalWagered > 0 ? ((netProfit / totalWagered) * 100).toFixed(1) : '0.0';

    let rating, ratingEmoji;
    if (totalBets === 0) { rating = lang.ratingNoData; ratingEmoji = '🆕'; }
    else if (netProfit > 100000) { rating = lang.ratingCasinoNightmare; ratingEmoji = '🌟'; }
    else if (netProfit > 50000) { rating = lang.ratingHighRoller; ratingEmoji = '💎'; }
    else if (netProfit > 10000) { rating = lang.ratingLuckyStreak; ratingEmoji = '🍀'; }
    else if (netProfit > 0) { rating = lang.ratingSlightlyLucky; ratingEmoji = '😊'; }
    else if (netProfit === 0) { rating = lang.ratingPerfect; ratingEmoji = '⚖️'; }
    else if (netProfit > -10000) { rating = lang.ratingSlightlyUnlucky; ratingEmoji = '😅'; }
    else if (netProfit > -50000) { rating = lang.ratingAddict; ratingEmoji = '😰'; }
    else { rating = lang.ratingDegen; ratingEmoji = '💀'; }

    return buildCard({
        title: lang.title({ user: username }),
        accentColor: netProfit >= 0 ? ACCENT.success : ACCENT.error
    })
        .addText(
            `> **${lang.subtitle}**\n\n` +
            `> **${lang.netProfitLabel}:** \`${profitSign}$${netProfit.toLocaleString()}\`\n` +
            `> **${lang.roiLabel}:** \`${roi}%\``
        )
        .addSeparator()
        .addText(`### 📊 ${lang.overviewTitle}`)
        .addText(
            `> 🎲 **${lang.totalBetsLabel}:** \`${totalBets.toLocaleString()}\`\n` +
            `> 💸 **${lang.totalWageredLabel}:** \`$${totalWagered.toLocaleString()}\`\n` +
            `> 💰 **${lang.avgBetLabel}:** \`$${avgBet.toLocaleString()}\`\n` +
            `> 📈 **${lang.winRateLabel}:** \`${winRate}%\``
        )
        .addSeparator()
        .addText(`### 💰 ${lang.winsLossesTitle}`)
        .addText(
            `> ✅ **${lang.totalWonLabel}:** \`$${totalWon.toLocaleString()}\`\n` +
            `> ❌ **${lang.totalLostLabel}:** \`$${totalLost.toLocaleString()}\`\n` +
            `> 🏆 **${lang.biggestWinLabel}:** \`$${biggestWin.toLocaleString()}\`\n` +
            `> 💀 **${lang.biggestLossLabel}:** \`$${biggestLoss.toLocaleString()}\``
        )
        .addSeparator()
        .addText(`### ${ratingEmoji} ${lang.ratingTitle}`)
        .addText(
            `> **${lang.ratingLabel}:** **${rating}**\n` +
            `> *${getGamblerQuote(netProfit, totalBets)}*`
        );
}

module.exports = {
    name: 'gambstats',
    aliases: ['gamblingstat', 'gamblingstats', 'gstats', 'bethistory'],
    description: lang.cmdDesc.toString(),
    usage: '!gambstats [@user]',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const target = message.mentions.users.first() || message.author;
            const userId = target.id;
            const guildId = message.guild.id;
            const profile = await EconomyManager.getProfile(userId, guildId);

            const card = buildGamblingStatsCard(profile, target.username);
            const rows = [
                new ActionRowBuilder().addComponents(
                    btn.primary('gambstats_refresh', lang.btnRefresh),
                    btn.secondary('gambstats_close', lang.btnClose)
                )
            ];

            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
            try {    
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'gambstats_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }
    
                    if (interaction.customId === 'gambstats_refresh') {
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const updatedCard = buildGamblingStatsCard(freshProfile, target.username);
                        return editV2(sentMessage, { card: updatedCard, rows });
                    }
            } catch (err) {
                console.error('[gambstats.js] Error in component collector:', err);
            }
        });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in gambstats command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
