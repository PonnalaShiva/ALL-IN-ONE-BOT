'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.deposit);

function buildDepositCard(profile, notification = null) {
    const bankLimit = EconomyManager.getBankLimit(profile);
    const wallet = profile.wallet || 0;
    const bank = profile.bank || 0;
    const availableSpace = Math.max(0, bankLimit - bank);
    const bankUsagePercent = bankLimit > 0 ? ((bank / bankLimit) * 100).toFixed(1) : '100.0';
    const totalNetWorth = wallet + bank + (profile.familyVault || 0);

    const card = buildCard({
        title: lang.panelTitle,
        accentColor: ACCENT.success
    });

    if (notification) {
        card.addText(`> ${notification}`).addSeparator();
    } else {
        card.addText(`> ${lang.panelDesc}`).addSeparator();
    }

    card.addText(`### ${lang.balancesTitle}`)
        .addText(
            `**💳 ${lang.walletLabel}:** \`$${wallet.toLocaleString()}\`\n` +
            `**🏦 ${lang.bankLabel}:** \`$${bank.toLocaleString()}\` / \`$${bankLimit.toLocaleString()}\` (\`${bankUsagePercent}%\`)\n` +
            `**💾 ${lang.spaceLabel}:** \`$${availableSpace.toLocaleString()}\`\n` +
            `**💎 ${lang.netWorthLabel}:** \`$${totalNetWorth.toLocaleString()}\``
        )
        .addSeparator()
        .addText(`### ${lang.benefitsTitle}`)
        .addText(
            `> • ${lang.benefitsProtected}\n` +
            `> • ${lang.benefitsYield}`
        );

    return card;
}

function buildDepositActionRows(profile, disabled = false) {
    const wallet = profile.wallet || 0;
    const bank = profile.bank || 0;
    const bankLimit = EconomyManager.getBankLimit(profile);
    const space = Math.max(0, bankLimit - bank);

    const can100 = wallet >= 100 && space >= 100;
    const can500 = wallet >= 500 && space >= 500;
    const can1k = wallet >= 1000 && space >= 1000;
    const canAll = wallet > 0 && space > 0;
    const canWithdrawAll = bank > 0;

    const row1 = new ActionRowBuilder().addComponents(
        btn.primary('dep_100', lang.btn100).setDisabled(disabled || !can100),
        btn.primary('dep_500', lang.btn500).setDisabled(disabled || !can500),
        btn.primary('dep_1k', lang.btn1k).setDisabled(disabled || !can1k),
        btn.success('dep_all', lang.btnAll).setDisabled(disabled || !canAll)
    );

    const row2 = new ActionRowBuilder().addComponents(
        btn.secondary('dep_with_all', lang.btnWithdrawAll).setDisabled(disabled || !canWithdrawAll),
        btn.secondary('dep_refresh', lang.btnRefresh).setDisabled(disabled),
        btn.danger('dep_close', lang.btnClose).setDisabled(disabled)
    );

    return [row1, row2];
}

module.exports = {
    name: 'deposit',
    aliases: ['dep'],
    description: lang.cmdDesc.toString(),
    usage: '!deposit <amount | all | max>',
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            let initialNotification = null;

            
            if (args[0]) {
                const bankLimit = EconomyManager.getBankLimit(profile);
                const currentWallet = profile.wallet || 0;
                const currentBank = profile.bank || 0;
                const availableSpace = Math.max(0, bankLimit - currentBank);

                let amount;
                if (args[0] === 'all' || args[0] === 'max') {
                    amount = 'all';
                } else {
                    amount = /^\d+$/.test(args[0]) ? Number(args[0]) : NaN;
                }

                if (amount !== 'all' && (!Number.isSafeInteger(amount) || amount <= 0)) {
                    initialNotification = lang.invalidAmountDesc({
                        wallet: currentWallet.toLocaleString(),
                        space: availableSpace.toLocaleString()
                    });
                } else {
                    const result = await EconomyManager.transferBank({
                        userId, guildId, direction: 'deposit', amount,
                        referenceId: `bank:${message.id}`,
                        description: lang.txBankDeposit.toString()
                    });
                    profile = result.profile;
                    if (result.success) initialNotification = lang.desc({ amount: result.amount.toLocaleString() });
                    else if (result.reason === 'insufficient_wallet') initialNotification = lang.insufficientFundsDesc({ wallet: currentWallet.toLocaleString(), amount: amount.toLocaleString() });
                    else if (result.reason === 'bank_capacity' || result.reason === 'no_wallet_or_space') initialNotification = lang.bankFull;
                    else initialNotification = lang.sessionExpiredDesc;
                }
            }

            const initialCard = buildDepositCard(profile, initialNotification);
            const initialRows = buildDepositActionRows(profile);

            const sentMessage = await sendV2(message, {
                card: initialCard,
                rows: initialRows
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
    
                    
                    profile = await EconomyManager.getProfile(userId, guildId);
                    const bankLimit = EconomyManager.getBankLimit(profile);
                    const wallet = profile.wallet || 0;
                    const bank = profile.bank || 0;
                    const availableSpace = Math.max(0, bankLimit - bank);
    
                    let notification = null;
    
                    if (interaction.customId === 'dep_100' || interaction.customId === 'dep_500' || interaction.customId === 'dep_1k' || interaction.customId === 'dep_all') {
                        let depositTarget = interaction.customId === 'dep_all' ? 'all'
                            : interaction.customId === 'dep_100' ? 100
                            : interaction.customId === 'dep_500' ? 500 : 1000;
                        const result = await EconomyManager.transferBank({
                            userId, guildId, direction: 'deposit', amount: depositTarget,
                            referenceId: `bank:${interaction.id}`,
                            description: lang.txInteractiveDeposit.toString()});
                    profile = result.profile;
                    if (result.success) notification = lang.desc({ amount: result.amount.toLocaleString() });
                    else if (result.reason === 'insufficient_wallet') notification = lang.insufficientFundsDesc({ wallet: wallet.toLocaleString(), amount: depositTarget.toLocaleString() });
                    else if (result.reason === 'bank_capacity' || result.reason === 'no_wallet_or_space') notification = lang.bankFull;
                    else notification = lang.sessionExpiredDesc;
                } else if (interaction.customId === 'dep_with_all') {
                    const result = await EconomyManager.transferBank({
                        userId, guildId, direction: 'withdraw', amount: 'all',
                        referenceId: `bank:${interaction.id}`,
                        description: lang.txTerminalWithdraw.toString()
                    });
                    profile = result.profile;
                    notification = result.success ? lang.withdrawSuccess({ amount: result.amount.toLocaleString() }) : lang.noBankFunds;
                } else if (interaction.customId === 'dep_refresh') {
                    
                } else if (interaction.customId === 'dep_close') {
                    collector.stop('closed');
                    return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                }

                const updatedCard = buildDepositCard(profile, notification);
                const updatedRows = buildDepositActionRows(profile);

                await editV2(sentMessage, {
                    card: updatedCard,
                    rows: updatedRows
                });
            
                } catch (err) {
                    console.error('[deposit.js] Error in component collector:', err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const disabledRows = buildDepositActionRows(profile, true);
                const expiredCard = buildDepositCard(profile, lang.sessionExpiredDesc);

                await editV2(sentMessage, {
                    card: expiredCard,
                    rows: disabledRows
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in deposit command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
