'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.withdraw);

function buildWithdrawCard(profile, notification = null) {
    const wallet = profile.wallet || 0;
    const bank = profile.bank || 0;
    const familyVault = profile.familyVault || 0;
    const totalNetWorth = wallet + bank + familyVault;

    const card = buildCard({
        title: lang.panelTitle,
        accentColor: ACCENT.success
    });

    if (notification) {
        card.addText(`> ${notification}`).addSeparator();
    } else {
        card.addText(`> ${lang.panelDesc}`).addSeparator();
    }

    card.addText(`### ${lang.balancesHeader}`)
        .addText(
            `**💳 ${lang.walletLabel}:** \`$${wallet.toLocaleString()}\`\n` +
            `**🏦 ${lang.bankLabel}:** \`$${bank.toLocaleString()}\`\n` +
            `**🏠 ${lang.vaultLabel}:** \`$${familyVault.toLocaleString()}\`\n` +
            `**💎 ${lang.netWorthLabel}:** \`$${totalNetWorth.toLocaleString()}\``
        )
        .addSeparator()
        .addText(`> ${lang.tipText}`);

    return card;
}

function buildWithdrawActionRows(profile, disabled = false) {
    const wallet = profile.wallet || 0;
    const bank = profile.bank || 0;
    const bankLimit = EconomyManager.getBankLimit(profile);
    const space = Math.max(0, bankLimit - bank);

    const can100 = bank >= 100;
    const can500 = bank >= 500;
    const can1k = bank >= 1000;
    const canAll = bank > 0;
    const canDepositAll = wallet > 0 && space > 0;

    const row1 = new ActionRowBuilder().addComponents(
        btn.primary('with_100', lang.btn100).setDisabled(disabled || !can100),
        btn.primary('with_500', lang.btn500).setDisabled(disabled || !can500),
        btn.primary('with_1k', lang.btn1k).setDisabled(disabled || !can1k),
        btn.success('with_all', lang.btnAll).setDisabled(disabled || !canAll)
    );

    const row2 = new ActionRowBuilder().addComponents(
        btn.secondary('with_dep_all', lang.btnDepositAll).setDisabled(disabled || !canDepositAll),
        btn.secondary('with_refresh', lang.btnRefresh).setDisabled(disabled),
        btn.danger('with_close', lang.btnClose).setDisabled(disabled)
    );

    return [row1, row2];
}

module.exports = {
    name: 'withdraw',
    aliases: ['with'],
    description: lang.cmdDesc.toString(),
    usage: '!withdraw <amount | all | max>',
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            let initialNotification = null;

            
            if (args[0]) {
                const currentBank = profile.bank || 0;
                let amount;

                if (args[0] === 'all' || args[0] === 'max') {
                    amount = 'all';
                } else {
                    amount = /^\d+$/.test(args[0]) ? Number(args[0]) : NaN;
                }

                if (amount !== 'all' && (!Number.isSafeInteger(amount) || amount <= 0)) {
                    initialNotification = lang.invalidAmountDesc({
                        amount: args[0]
                    });
                } else {
                    const result = await EconomyManager.transferBank({
                        userId, guildId, direction: 'withdraw', amount,
                        referenceId: `bank:${message.id}`,
                        description: lang.txBankWithdraw.toString()
                    });
                    profile = result.profile;
                    if (result.success) initialNotification = lang.successDesc({ amount: result.amount.toLocaleString() });
                    else if (result.reason === 'insufficient_bank') initialNotification = lang.insufficientFundsDesc({ bank: currentBank.toLocaleString(), amount: amount.toLocaleString(), shortage: Math.max(0, (amount === 'all' ? 0 : amount) - currentBank).toLocaleString() });
                    else initialNotification = lang.noBankFunds;
                }
            }

            const initialCard = buildWithdrawCard(profile, initialNotification);
            const initialRows = buildWithdrawActionRows(profile);

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
                    const wallet = profile.wallet || 0;
                    const bank = profile.bank || 0;
                    const bankLimit = EconomyManager.getBankLimit(profile);
                    const space = Math.max(0, bankLimit - bank);
    
                    let notification = null;
    
                    if (interaction.customId === 'with_100' || interaction.customId === 'with_500' || interaction.customId === 'with_1k' || interaction.customId === 'with_all') {
                        const withdrawTarget = interaction.customId === 'with_all' ? 'all'
                            : interaction.customId === 'with_100' ? 100
                            : interaction.customId === 'with_500' ? 500 : 1000;
                        const result = await EconomyManager.transferBank({
                            userId, guildId, direction: 'withdraw', amount: withdrawTarget,
                            referenceId: `bank:${interaction.id}`,
                            description: lang.txAtmWithdraw.toString()});
                    profile = result.profile;
                    notification = result.success ? lang.successDesc({ amount: result.amount.toLocaleString() }) : lang.noBankFunds;
                } else if (interaction.customId === 'with_dep_all') {
                    const result = await EconomyManager.transferBank({
                        userId, guildId, direction: 'deposit', amount: 'all',
                        referenceId: `bank:${interaction.id}`,
                        description: lang.txAtmDeposit.toString()
                    });
                    profile = result.profile;
                    notification = result.success ? lang.depositSuccess({ amount: result.amount.toLocaleString() }) : lang.bankFull;
                } else if (interaction.customId === 'with_refresh') {
                    
                } else if (interaction.customId === 'with_close') {
                    collector.stop('closed');
                    return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                }

                const updatedCard = buildWithdrawCard(profile, notification);
                const updatedRows = buildWithdrawActionRows(profile);

                await editV2(sentMessage, {
                    card: updatedCard,
                    rows: updatedRows
                });
            
                } catch (err) {
                    console.error('[withdraw.js] Error in component collector:', err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const disabledRows = buildWithdrawActionRows(profile, true);
                const expiredCard = buildWithdrawCard(profile, lang.sessionExpiredDesc);

                await editV2(sentMessage, {
                    card: expiredCard,
                    rows: disabledRows
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in withdraw command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
