'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.interest);

module.exports = {
    name: 'interest',
    aliases: ['bankinterest', 'claiminterest'],
    description: 'Claim daily compound interest on your bank balance',
    usage: '!interest',
    async execute(message) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;

            const result = await EconomyManager.claimInterest(userId, guildId);

            
            if (!result.success) {
                if (result.nextClaim) {
                    const remaining = new Date(result.nextClaim).getTime() - Date.now();
                    const hours   = Math.floor(remaining / (60 * 60 * 1000));
                    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
                    return sendV2(message, cards.warning(
                        lang.notReadyTitle,
                        lang.notReadyDesc({ hours, minutes })
                    ));
                }
                return sendV2(message, cards.error(lang.errorTitle, result.error || lang.errorMessage));
            }

            
            const interestAmount = result.interest;
            const newBalance     = result.newBalance;
            const bankBefore     = newBalance - interestAmount;

            const card = buildCard({
                title: lang.claimedTitle,
                accentColor: ACCENT.economy
            })
                .addText(
                    `> **${lang.claimedSubtitle}**\n` +
                    `> ${lang.savingsGrewText({ amount: interestAmount.toLocaleString() })}`
                )
                .addSeparator()
                .addText(
                    `**📊 ${lang.rateLabel}:** \`${(result.rate * 100).toFixed(2)}%\`\n` +
                    `**🏦 ${lang.bankBalanceLabel}:** \`$${bankBefore.toLocaleString()}\`\n` +
                    `**💰 ${lang.earnedLabel}:** \`+$${interestAmount.toLocaleString()}\`\n` +
                    `**💳 ${lang.newBalanceLabel}:** \`$${newBalance.toLocaleString()}\``
                );

            if (result.rate > 0.01) {
                card.addSeparator()
                    .addText(`### ${lang.prestigeBonusTitle}`)
                    .addText(`> ${lang.prestigeBonusDesc}`);
            }

            card.addSeparator()
                .addText(`> -# ${lang.footerText}`);

            const row = new ActionRowBuilder().addComponents(
                btn.danger('interest_close', lang.btnClose)
            );

            const sentMessage = await sendV2(message, {
                card,
                rows: [row]
            });

            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async (interaction) => {
            try {    
                    if (interaction.user.id !== message.author.id) {
                        return replyUnauthorized(interaction);
                    }
    
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
                    if (interaction.customId === 'interest_close') {
                        collector.stop('closed');
                        return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }
            } catch (err) {
                console.error('[interest.js] Error in component collector:', err);
            }
        });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const disabledRow = new ActionRowBuilder().addComponents(
                    btn.danger('interest_close', lang.btnClose).setDisabled(true)
                );
                await editV2(sentMessage, {
                    card,
                    rows: [disabledRow]
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in interest command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
