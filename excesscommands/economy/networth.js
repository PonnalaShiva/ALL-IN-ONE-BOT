'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.networth);

async function buildNetWorthCard(target, guildId) {
    const profile = await EconomyManager.getProfile(target.id, guildId);
    const netWorth = EconomyManager.calculateNetWorth(profile);

    const vaultVal = profile.familyVault || (profile.vault && profile.vault.stored) || 0;
    const liquidTotal = (profile.wallet || 0) + (profile.bank || 0) + vaultVal;

    const propValue = (profile.properties || []).reduce((s, p) => s + (p.currentValue ?? p.purchasePrice ?? 0), 0);
    const carValue  = (profile.cars || []).reduce((s, c) => s + (c.currentValue ?? c.purchasePrice ?? 0), 0);
    const bizValue  = (profile.businesses || []).reduce((s, b) => s + (b.purchasePrice || 0), 0);

    let stockTotal = 0;
    const stockLines = [];
    for (const holding of (profile.stockPortfolio || [])) {
        const currentPrice = await EconomyManager.getStockPrice(holding.symbol);
        const value  = currentPrice * holding.shares;
        const cost   = holding.avgBuyPrice * holding.shares;
        const pnl    = value - cost;
        const sign   = pnl >= 0 ? '+' : '';
        stockTotal  += value;
        stockLines.push(`> **${holding.symbol}:** ${holding.shares} shares × $${currentPrice.toFixed(2)} = \`$${value.toLocaleString()}\` (${sign}$${pnl.toFixed(2)})`);
    }

    const card = buildCard({
        title: lang.title({ username: target.username }),
        accentColor: ACCENT.economy
    })
        .addText(
            `> **${lang.totalVal({ total: netWorth.toLocaleString() })}**\n` +
            `> *${lang.subtitle}*`
        )
        .addSeparator()
        .addText(`### ${lang.liquidAssetsTitle}`)
        .addText(
            `**👛 ${lang.walletLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\`\n` +
            `**🏦 ${lang.bankLabel}:** \`$${(profile.bank || 0).toLocaleString()}\`\n` +
            `**🔐 ${lang.vaultLabel}:** \`$${vaultVal.toLocaleString()}\`\n` +
            `**${lang.subtotalLabel}:** \`$${liquidTotal.toLocaleString()}\``
        );

    if (propValue > 0 || carValue > 0) {
        card.addSeparator()
            .addText(`### ${lang.physicalAssetsTitle}`)
            .addText(
                (propValue > 0 ? `**🏘️ ${lang.propertiesLabel} (${profile.properties.length}):** \`$${propValue.toLocaleString()}\`\n` : '') +
                (carValue  > 0 ? `**🚗 ${lang.vehiclesLabel} (${profile.cars.length}):** \`$${carValue.toLocaleString()}\`\n` : '') +
                `**${lang.subtotalLabel}:** \`$${(propValue + carValue).toLocaleString()}\``
            );
    }

    if (bizValue > 0) {
        card.addSeparator()
            .addText(`### ${lang.businessesTitle}`)
            .addText(
                `**${lang.ownedLabel}:** \`${profile.businesses.length}\`\n` +
                `**${lang.portfolioValueLabel}:** \`$${bizValue.toLocaleString()}\``
            );
    }

    if (stockLines.length > 0) {
        card.addSeparator()
            .addText(`### ${lang.stocksTitle}`)
            .addText(stockLines.join('\n') + `\n**${lang.portfolioTotalLabel}:** \`$${stockTotal.toLocaleString()}\``);
    }

    card.addSeparator()
        .addText(`### ${lang.statsTitle}`)
        .addText(
            `**🏅 ${lang.prestigeLabel}:** \`${profile.prestigeLevel || 0}\`\n` +
            `**🏆 ${lang.achievementsLabel}:** \`${(profile.achievements || []).length}\`\n` +
            `**💍 ${lang.marriageBonusLabel}:** \`${profile.marriedTo ? '+10%' : 'None'}\`\n` +
            `**📈 ${lang.lifetimeEarningsLabel}:** \`$${(profile.lifetimeEarnings || 0).toLocaleString()}\``
        );

    return card;
}

module.exports = {
    name: 'networth',
    aliases: ['nw', 'worth', 'wealth'],
    description: 'View your total net worth breakdown and balance sheet',
    usage: '!networth [@user]',
    async execute(message) {
        try {
            const target  = message.mentions.users.first() || message.author;
            const isSelf  = target.id === message.author.id;
            const guildId = message.guild.id;

            const card = await buildNetWorthCard(target, guildId);

            if (!isSelf) {
                return sendV2(message, card);
            }

            const row = new ActionRowBuilder().addComponents(
                btn.secondary('nw_refresh', lang.btnRefresh),
                btn.danger('nw_close', lang.btnClose)
            );

            const sentMessage = await sendV2(message, {
                card,
                rows: [row]
            });

            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000
            });

            collector.on('collect', async (interaction) => {
                try {    
                    if (interaction.user.id !== message.author.id) {
                        return replyUnauthorized(interaction);
                    }
    
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'nw_refresh') {
                        const refreshedCard = await buildNetWorthCard(target, guildId);
                        await editV2(sentMessage, {
                            card: refreshedCard,
                            rows: [row]});
                } else if (interaction.customId === 'nw_close') {
                    collector.stop('closed');
                    return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                }
            
                } catch (err) {
                    console.error('[networth.js] Error in component collector:', err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const disabledRow = new ActionRowBuilder().addComponents(
                    btn.secondary('nw_refresh', lang.btnRefresh).setDisabled(true),
                    btn.danger('nw_close', lang.btnClose).setDisabled(true)
                );
                await editV2(sentMessage, {
                    card,
                    rows: [disabledRow]
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in networth command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
