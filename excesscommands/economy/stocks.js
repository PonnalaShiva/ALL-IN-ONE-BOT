'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { STOCKS } = require('../../models/economy/constants/stockData');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.stocks);

function buildMarketCard() {
    const prices = EconomyManager.getAllStockPrices();

    let stockText = '';
    for (const [symbol, stock] of Object.entries(prices)) {
        const change = ((stock.currentPrice - stock.basePrice) / stock.basePrice * 100).toFixed(1);
        const changeEmoji = change >= 0 ? '📈' : '📉';
        const divText = stock.dividendRate > 0 ? lang.dividendTag({ rate: (stock.dividendRate * 100).toFixed(1) }) : '';

        stockText += lang.tickerLine({
            emoji: stock.emoji,
            symbol,
            name: stock.name,
            price: stock.currentPrice.toLocaleString(),
            changeEmoji,
            change,
            vol: (stock.volatility * 100).toFixed(0),
            divText
        }) + '\n\n';
    }

    const card = buildCard({
        title: lang.marketTitle,
        accentColor: ACCENT.primary
    })
        .addText(`${lang.marketIntro}\n`)
        .addSeparator()
        .addText(`### ${lang.availableStocksHeader}\n\n${stockText.trim()}`)
        .addSeparator()
        .addText(`### ${lang.commandsHeader}\n${lang.commandsList}`);

    return card;
}

function buildMarketActionRows() {
    const prices = EconomyManager.getAllStockPrices();

    const options = Object.entries(prices).map(([symbol, stock]) => ({
        label: `${symbol} — ${stock.name}`,
        value: symbol,
        description: lang.stockOptionDesc({
            price: stock.currentPrice.toLocaleString(),
            vol: (stock.volatility * 100).toFixed(0)
        }).toString(),
        emoji: stock.emoji || '📈'
    }));

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('stocks_select_buy')
            .setPlaceholder(lang.selectBuyPlaceholder.toString())
            .addOptions(options)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.primary('stocks_view_portfolio', lang.btnPortfolio),
        btn.secondary('stocks_refresh_market', lang.btnRefresh),
        btn.danger('stocks_close', lang.btnClose)
    );

    return [selectRow, btnRow];
}

async function buildPortfolioCard(profile) {
    const portfolio = profile.stockPortfolio || [];
    const stats = profile.stockStats || {};

    if (portfolio.length === 0) {
        return cards.info(
            lang.emptyPortfolioTitle,
            lang.emptyPortfolioDesc
        );
    }

    let totalValue = 0;
    let totalInvested = 0;
    let holdingsText = '';

    for (const position of portfolio) {
        const currentPrice = EconomyManager.getStockPrice(position.symbol);
        const marketValue = currentPrice * position.shares;
        const pl = marketValue - position.totalInvested;
        const plPercent = position.totalInvested > 0 ? ((pl / position.totalInvested) * 100).toFixed(1) : '0.0';

        totalValue += marketValue;
        totalInvested += position.totalInvested;

        const plEmoji = pl >= 0 ? '📈' : '📉';
        const stockData = STOCKS[position.symbol];
        holdingsText += lang.holdingItemLine({
            emoji: stockData?.emoji || '📊',
            symbol: position.symbol,
            shares: position.shares,
            avg: position.avgBuyPrice.toLocaleString(),
            current: currentPrice.toLocaleString(),
            emojiPL: plEmoji,
            sign: pl >= 0 ? '+' : '',
            pl: pl.toLocaleString(),
            percent: plPercent
        }) + '\n\n';
    }

    const totalPL = totalValue - totalInvested;
    const isOverallProfit = totalPL >= 0;

    const card = buildCard({
        title: lang.portfolioCardTitle,
        accentColor: isOverallProfit ? ACCENT.success : ACCENT.danger
    })
        .addText(`### ${lang.portfolioSummaryHeader}`)
        .addText(lang.portfolioSummaryDetails({
            totalValue: totalValue.toLocaleString(),
            totalInvested: totalInvested.toLocaleString(),
            sign: isOverallProfit ? '+' : '',
            totalPL: totalPL.toLocaleString(),
            trades: stats.totalTrades || 0
        }))
        .addSeparator()
        .addText(`### ${lang.assetHoldingsHeader}\n\n${holdingsText.trim()}`);

    return card;
}

function buildPortfolioActionRows() {
    return [
        new ActionRowBuilder().addComponents(
            btn.primary('stocks_view_market', lang.btnMarket),
            btn.danger('stocks_close', lang.btnClose)
        )
    ];
}

module.exports = {
    name: 'stocks',
    aliases: ['stock', 'invest', 'portfolio', 'market'],
    description: 'Virtual stock market — buy, sell, and track stocks with real-time tickers',
    usage: '!stocks [buy | sell | portfolio] [symbol] [shares]',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const profile = await EconomyManager.getProfile(userId, guildId);
            const action = args[0]?.toLowerCase();

            
            if (action === 'buy') {
                const symbol = args[1]?.toUpperCase();
                const shares = args[2] === undefined ? 1 : Number(args[2]);

                if (!symbol || !STOCKS[symbol]) {
                    return sendV2(message, cards.warning(
                        lang.invalidSymbolTitle,
                        lang.invalidSymbolDesc({ symbols: Object.keys(STOCKS).join(', ') })
                    ));
                }

                if (!Number.isSafeInteger(shares) || shares <= 0) {
                    return sendV2(message, cards.warning(
                        lang.invalidSharesTitle,
                        lang.invalidSharesDesc
                    ));
                }

                const result = await EconomyManager.buyStock(userId, guildId, symbol, shares, `stock-buy:${message.id}`);
                if (!result.success) {
                    return sendV2(message, cards.error(lang.purchaseFailedTitle, result.error));
                }

                const stock = STOCKS[symbol];
                const buyCard = buildCard({
                    title: lang.stockPurchasedTitle({ symbol }),
                    accentColor: ACCENT.success
                })
                    .addText(lang.purchasedDetails({
                        emoji: stock.emoji,
                        symbol,
                        name: stock.name,
                        shares,
                        price: result.price.toLocaleString(),
                        total: result.totalCost.toLocaleString(),
                        wallet: (result.profile?.wallet ?? ((profile.wallet || 0) - result.totalCost)).toLocaleString()
                    }));

                const rows = [new ActionRowBuilder().addComponents(btn.secondary('stocks_close', lang.btnClose))];
                return sendWithCloseCollector(message, { card: buyCard, rows }, userId);
            }

            
            if (action === 'sell') {
                const symbol = args[1]?.toUpperCase();
                const sharesArg = args[2]?.toLowerCase();

                if (!symbol || !STOCKS[symbol]) {
                    return sendV2(message, cards.warning(
                        lang.invalidSellTitle,
                        lang.invalidSellDesc
                    ));
                }

                let shares;
                if (sharesArg === 'all' || sharesArg === 'max') {
                    const position = profile.stockPortfolio?.find(s => s.symbol === symbol);
                    shares = position?.shares || 0;
                } else {
                    shares = sharesArg === undefined ? 1 : Number(sharesArg);
                }

                if (!Number.isSafeInteger(shares) || shares <= 0) return sendV2(message, cards.warning(lang.invalidSharesTitle, lang.invalidSharesDesc));

                const result = await EconomyManager.sellStock(userId, guildId, symbol, shares, `stock-sell:${message.id}`);
                if (!result.success) {
                    return sendV2(message, cards.error(lang.saleFailedTitle, result.error));
                }

                const isProfitable = result.profit >= 0;
                const profitEmoji = isProfitable ? '📈' : '📉';
                const sellCard = buildCard({
                    title: lang.stockSoldTitle({ emoji: profitEmoji, symbol }),
                    accentColor: isProfitable ? ACCENT.success : ACCENT.danger
                })
                    .addText(lang.soldDetails({
                        emoji: STOCKS[symbol]?.emoji || '📊',
                        symbol,
                        shares,
                        price: result.price.toLocaleString(),
                        revenue: result.totalRevenue.toLocaleString(),
                        sign: isProfitable ? '+' : '',
                        profit: result.profit.toLocaleString()
                    }));

                const rows = [new ActionRowBuilder().addComponents(btn.secondary('stocks_close', lang.btnClose))];
                return sendWithCloseCollector(message, { card: sellCard, rows }, userId);
            }

            
            let card;
            let rows;
            if (action === 'portfolio' || action === 'port' || action === 'holdings') {
                card = await buildPortfolioCard(profile);
                rows = buildPortfolioActionRows();
            } else {
                card = buildMarketCard();
                rows = buildMarketActionRows();
            }

            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'stocks_close') {
                        collector.stop('user_closed');
                        return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }

                    if (interaction.customId === 'stocks_refresh_market') {
                        const freshCard = buildMarketCard();
                        return editV2(sentMessage, { card: freshCard, rows: buildMarketActionRows() });
                    }

                    if (interaction.customId === 'stocks_view_portfolio') {
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const portCard = await buildPortfolioCard(freshProfile);
                        return editV2(sentMessage, { card: portCard, rows: buildPortfolioActionRows() });
                    }

                    if (interaction.customId === 'stocks_view_market') {
                        const freshCard = buildMarketCard();
                        return editV2(sentMessage, { card: freshCard, rows: buildMarketActionRows() });
                    }

                    if (interaction.customId === 'stocks_select_buy') {
                        const selectedSymbol = interaction.values[0];
                        const buyResult = await EconomyManager.buyStock(userId, guildId, selectedSymbol, 1, `stock-buy:${interaction.id}`);

                        if (!buyResult.success) {
                            return editV2(sentMessage, {
                                card: cards.error(lang.purchaseFailedTitle, buyResult.error),
                                rows: [new ActionRowBuilder().addComponents(btn.secondary('stocks_view_market', lang.btnMarket), btn.danger('stocks_close', lang.btnClose))]
                            });
                        }

                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const stock = STOCKS[selectedSymbol];
                        const buySuccessCard = buildCard({
                            title: lang.stockPurchasedTitle({ symbol: selectedSymbol }),
                            accentColor: ACCENT.success
                        })
                            .addText(lang.purchasedDetails({
                                emoji: stock.emoji,
                                symbol: selectedSymbol,
                                name: stock.name,
                                shares: 1,
                                price: buyResult.price.toLocaleString(),
                                total: buyResult.totalCost.toLocaleString(),
                                wallet: (freshProfile.wallet || 0).toLocaleString()
                            }));

                        const afterRows = [
                            new ActionRowBuilder().addComponents(
                                btn.primary('stocks_view_market', lang.btnMarket),
                                btn.secondary('stocks_view_portfolio', lang.btnPortfolio),
                                btn.danger('stocks_close', lang.btnClose)
                            )
                        ];

                        return editV2(sentMessage, { card: buySuccessCard, rows: afterRows });
                    }
                } catch (err) {
                    console.error('Error handling stocks interaction:', err);
                    editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in stocks command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
