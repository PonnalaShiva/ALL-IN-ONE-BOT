'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.donate);

module.exports = {
    name: 'donate',
    aliases: ['give', 'transfer', 'pay'],
    description: lang.cmdDesc.toString(),
    usage: '!donate @user <amount>',
    cooldown: 5000,
    async execute(message, args) {
        try {
            if (args.length < 2) {
                return sendV2(message, cards.warning(
                    lang.missingArgsTitle,
                    lang.missingArgsDesc()
                ));
            }

            const target = message.mentions.users.first();
            if (!target) {
                return sendV2(message, cards.warning(
                    lang.noUserTitle,
                    lang.noUserDesc()
                ));
            }

            if (target.id === message.author.id) {
                return sendV2(message, cards.warning(
                    lang.selfDonateTitle,
                    lang.selfDonateDesc()
                ));
            }

            if (target.bot) {
                return sendV2(message, cards.warning(
                    lang.botDonateTitle,
                    lang.botDonateDesc()
                ));
            }

            const donorProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
            if (typeof donorProfile.wallet !== 'number') {
                donorProfile.wallet = Number(donorProfile.wallet) || 0;
            }

            let amount;
            if (args[1] === 'all' || args[1] === 'max') {
                amount = donorProfile.wallet;
            } else {
                const normalizedAmount = args[1].replace(/[,$]/g, '');
                amount = /^\d+$/.test(normalizedAmount) ? Number(normalizedAmount) : NaN;
            }

            if (!Number.isSafeInteger(amount) || amount <= 0) {
                return sendV2(message, cards.warning(
                    lang.invalidAmountTitle,
                    lang.invalidAmountDesc()
                ));
            }

            if (amount < 10) {
                return sendV2(message, cards.warning(
                    lang.minAmountTitle,
                    lang.minAmountDesc()
                ));
            }

            if (amount > 1000000) {
                return sendV2(message, cards.warning(
                    lang.maxAmountTitle,
                    lang.maxAmountDesc()
                ));
            }

            if (donorProfile.wallet < amount) {
                return sendV2(message, cards.warning(
                    lang.insufficientFundsTitle,
                    lang.insufficientFundsDesc({
                        wallet: donorProfile.wallet.toLocaleString(),
                        amount: amount.toLocaleString()
                    })
                ));
            }

            const tax = Math.floor(amount * 0.02);
            const netAmount = amount - tax;
            const timestamp = new Date();
            const donorXp = Math.min(50, Math.floor(amount / 1000));
            const transfer = await EconomyManager.transferWallet({
                fromUserId: message.author.id,
                toUserId: target.id,
                guildId: message.guild.id,
                amount,
                tax,
                referenceId: message.id,
                donorXp,
                recipientXp: 5,
                donorDescription: lang.txDonatedTo({ user: target.username }).toString(),
                recipientDescription: lang.txReceivedFrom({ user: message.author.username }).toString()
            });

            if (transfer.insufficientFunds) {
                return sendV2(message, cards.warning(
                    lang.insufficientFundsTitle,
                    lang.insufficientFundsDesc({
                        wallet: transfer.donorWallet?.toLocaleString?.() ?? '0',
                        amount: amount.toLocaleString()
                    })
                ));
            }

            const donorWallet = transfer.donorWallet;
            const recipientWallet = transfer.recipientWallet;

            const card = buildCard({
                title: lang.successTitle,
                accentColor: ACCENT.success
            })
                .addText(`> **${lang.successSubtitle}**\n> ${lang.successDesc({ donor: message.author.username, amount: amount.toLocaleString(), recipient: target.username })}`)
                .addSeparator()
                .addText(`### ${lang.detailsTitle}`)
                .addText(
                    `**💰 ${lang.donationAmountLabel}:** \`$${amount.toLocaleString()}\`\n` +
                    `**💸 ${lang.transferFeeLabel}:** \`$${tax.toLocaleString()}\`\n` +
                    `**💎 ${lang.netReceivedLabel}:** \`$${netAmount.toLocaleString()}\`\n` +
                    `**⏰ ${lang.timeLabel}:** <t:${Math.floor(timestamp.getTime() / 1000)}:R>`
                )
                .addSeparator()
                .addText(`### ${lang.balancesTitle}`)
                .addText(
                    `**${message.author.username} (${lang.senderLabel})**\n` +
                    `> ${lang.newBalanceLabel}: \`$${donorWallet.toLocaleString()}\` (XP +${donorXp})\n\n` +
                    `**${target.username} (${lang.recipientLabel})**\n` +
                    `> ${lang.newBalanceLabel}: \`$${recipientWallet.toLocaleString()}\` (XP +5)`
                );

            const row = new ActionRowBuilder().addComponents(
                btn.danger('donate_close', lang.btnClose)
            );

            const sentMessage = await sendV2(message, {
                card,
                rows: [row]
            });

            if (!transfer.duplicate) try {
                await target.send(lang.dmReceived({
                    amount: netAmount.toLocaleString(),
                    donor: message.author.username,
                    server: message.guild.name
                }));
            } catch {
                
            }

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
                    if (interaction.customId === 'donate_close') {
                        collector.stop('closed');
                        return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }
            } catch (err) {
                console.error('[donate.js] Error in component collector:', err);
            }
        });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const disabledRow = new ActionRowBuilder().addComponents(
                    btn.danger('donate_close', lang.btnClose).setDisabled(true)
                );
                await editV2(sentMessage, {
                    card,
                    rows: [disabledRow]
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in donate command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
