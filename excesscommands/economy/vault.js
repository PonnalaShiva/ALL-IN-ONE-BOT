'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.vault);

function buildVaultCard(profile, primaryProperty, notification = null) {
    const vaultBal = profile.familyVault || 0;
    const wallet = profile.wallet || 0;
    const vaultCapacity = EconomyManager.getVaultCapacity ? EconomyManager.getVaultCapacity(profile) : 50000;
    const securityLevel = EconomyManager.calculateSecurityLevel ? EconomyManager.calculateSecurityLevel(profile) : 0;
    const usagePercent = vaultCapacity > 0 ? ((vaultBal / vaultCapacity) * 100).toFixed(1) : '0.0';
    const availableSpace = Math.max(0, vaultCapacity - vaultBal);

    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    });

    if (notification) {
        card.addText(`> ${notification}`).addSeparator();
    } else {
        card.addText(`> ${lang.subtitle}`).addSeparator();
    }

    card.addText(`### ${lang.vaultBalancesTitle}`)
        .addText(
            `**🏠 ${lang.vaultLabel}:** \`$${vaultBal.toLocaleString()}\` / \`$${vaultCapacity.toLocaleString()}\` (\`${usagePercent}%\`)\n` +
            `**💵 ${lang.walletLabel}:** \`$${wallet.toLocaleString()}\`\n` +
            `**📦 ${lang.availableStorageLabel}:** \`$${availableSpace.toLocaleString()}\`\n` +
            `**🛡️ ${lang.propertySecurityLabel}:** \`${securityLevel}%\` (${primaryProperty.name})\n` +
            `**🔒 ${lang.robberyImmunityLabel}:** \`${lang.robberyImmunityDesc}\``
        );

    return card;
}

function buildVaultActionRows(profile, disabled = false) {
    const wallet = profile.wallet || 0;
    const vaultBal = profile.familyVault || 0;
    const vaultCapacity = EconomyManager.getVaultCapacity ? EconomyManager.getVaultCapacity(profile) : 50000;
    const space = Math.max(0, vaultCapacity - vaultBal);

    const canDep500 = wallet >= 500 && space >= 500;
    const canDep1k = wallet >= 1000 && space >= 1000;
    const canDepMax = wallet > 0 && space > 0;

    const canWith500 = vaultBal >= 500;
    const canWith1k = vaultBal >= 1000;
    const canWithAll = vaultBal > 0;

    const row1 = new ActionRowBuilder().addComponents(
        btn.success('vault_dep_500', lang.btnDeposit500).setDisabled(disabled || !canDep500),
        btn.success('vault_dep_1k', lang.btnDeposit1k).setDisabled(disabled || !canDep1k),
        btn.success('vault_dep_max', lang.btnDepositMax).setDisabled(disabled || !canDepMax)
    );

    const row2 = new ActionRowBuilder().addComponents(
        btn.primary('vault_with_500', lang.btnWithdraw500).setDisabled(disabled || !canWith500),
        btn.primary('vault_with_1k', lang.btnWithdraw1k).setDisabled(disabled || !canWith1k),
        btn.primary('vault_with_all', lang.btnWithdrawAll).setDisabled(disabled || !canWithAll),
        btn.danger('vault_close', lang.btnClose).setDisabled(disabled)
    );

    return [row1, row2];
}

module.exports = {
    name: 'vault',
    aliases: ['fvault'],
    description: lang.cmdDesc.toString(),
    usage: '!vault | !vault deposit <amount|all|max> | !vault withdraw <amount|all|max>',
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            const primaryProperty = profile.properties?.find(p => p.propertyId === profile.primaryResidence);
            if (!primaryProperty) {
                return sendV2(message, cards.warning(
                    lang.noPropertyTitle,
                    lang.noPropertyDesc
                ));
            }

            const vaultCapacity = EconomyManager.getVaultCapacity ? EconomyManager.getVaultCapacity(profile) : 50000;
            let initialNotification = null;

            
            if (args[0]) {
                const action = args[0].toLowerCase();
                if (!['deposit', 'withdraw'].includes(action)) {
                    initialNotification = lang.missingArgsDesc;
                } else {
                    let amount;
                    if (args[1]?.toLowerCase() === 'all' || args[1]?.toLowerCase() === 'max') {
                        amount = 'all';
                    } else {
                        const rawAmount = args[1] || '';
                        amount = /^\d+$/.test(rawAmount) ? Number(rawAmount) : NaN;
                    }

                    if (amount !== 'all' && (!Number.isSafeInteger(amount) || amount <= 0)) {
                        initialNotification = lang.invalidAmountDesc;
                    } else {
                        const result = await EconomyManager.transferVault({
                            userId, guildId, direction: action, amount,
                            referenceId: `vault:${message.id}`,
                            description: action === 'deposit' ? lang.txVaultDeposit.toString() : lang.txVaultWithdraw.toString()
                        });
                        profile = result.profile;
                        if (result.success) {
                            const amountText = result.amount.toLocaleString();
                            initialNotification = action === 'deposit'
                                ? lang.depositSuccessDesc({ amount: amountText })
                                : lang.withdrawSuccessDesc({ amount: amountText });
                        } else if (result.reason === 'insufficient_wallet' || result.reason === 'insufficient_vault' || result.reason === 'balance_changed') {
                            initialNotification = lang.insufficientFundsDesc;
                        } else if (result.reason === 'vault_capacity' || result.reason === 'vault_full_or_empty') {
                            initialNotification = lang.vaultFullDesc({ capacity: (result.capacity || vaultCapacity).toLocaleString() });
                        } else if (result.reason === 'no_property') {
                            initialNotification = lang.noPropertyDesc;
                        } else if (result.reason === 'duplicate') {
                            initialNotification = lang.sessionExpiredDesc;
                        } else {
                            initialNotification = lang.noVaultFunds;
                        }
                    }
                }
            }

            const initialCard = buildVaultCard(profile, primaryProperty, initialNotification);
            const initialRows = buildVaultActionRows(profile);

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
                    const currentProp = profile.properties?.find(p => p.propertyId === profile.primaryResidence);
                    if (!currentProp) {
                        collector.stop('no_property');
                        return editV2(sentMessage, cards.warning(lang.noPropertyTitle, lang.noPropertyDesc));
                    }
    
                    const currentCap = EconomyManager.getVaultCapacity ? EconomyManager.getVaultCapacity(profile) : 50000;
                    const wallet = profile.wallet || 0;
                    const vaultBal = profile.familyVault || 0;
                    const space = Math.max(0, currentCap - vaultBal);
    
                    let notification = null;
    
                    if (interaction.customId === 'vault_dep_500' || interaction.customId === 'vault_dep_1k' || interaction.customId === 'vault_dep_max') {
                        let depAmount = 0;
                        if (interaction.customId === 'vault_dep_500') depAmount = 500;
                        else if (interaction.customId === 'vault_dep_1k') depAmount = 1000;
                        else if (interaction.customId === 'vault_dep_max') depAmount = Math.min(wallet, space);
    
                        const result = await EconomyManager.transferVault({
                            userId, guildId, direction: 'deposit', amount: interaction.customId === 'vault_dep_max' ? 'all' : depAmount,
                            referenceId: `vault:${interaction.id}`,
                            description: lang.txVaultInteractiveDeposit.toString()});
                    profile = result.profile;
                    if (result.success) notification = lang.depositSuccessDesc({ amount: result.amount.toLocaleString() });
                    else if (result.reason === 'insufficient_wallet') notification = lang.insufficientFundsDesc;
                    else if (result.reason === 'vault_capacity' || result.reason === 'vault_full_or_empty') notification = lang.vaultFullDesc({ capacity: currentCap.toLocaleString() });
                    else if (result.reason === 'no_property') notification = lang.noPropertyDesc;
                    else notification = lang.noWalletFunds;
                } else if (interaction.customId === 'vault_with_500' || interaction.customId === 'vault_with_1k' || interaction.customId === 'vault_with_all') {
                    let withAmount = 0;
                    if (interaction.customId === 'vault_with_500') withAmount = 500;
                    else if (interaction.customId === 'vault_with_1k') withAmount = 1000;
                    else if (interaction.customId === 'vault_with_all') withAmount = vaultBal;

                    const result = await EconomyManager.transferVault({
                        userId, guildId, direction: 'withdraw', amount: interaction.customId === 'vault_with_all' ? 'all' : withAmount,
                        referenceId: `vault:${interaction.id}`,
                        description: lang.txVaultInteractiveWithdraw.toString()
                    });
                    profile = result.profile;
                    if (result.success) notification = lang.withdrawSuccessDesc({ amount: result.amount.toLocaleString() });
                    else notification = result.reason === 'no_property' ? lang.noPropertyDesc : lang.noVaultFunds;
                } else if (interaction.customId === 'vault_close') {
                    collector.stop('closed');
                    return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                }

                const updatedCard = buildVaultCard(profile, currentProp, notification);
                const updatedRows = buildVaultActionRows(profile);

                await editV2(sentMessage, {
                    card: updatedCard,
                    rows: updatedRows
                });
            
                } catch (err) {
                    console.error('[vault.js] Error in component collector:', err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed' || reason === 'no_property') return;
                const disabledRows = buildVaultActionRows(profile, true);
                const expiredCard = buildVaultCard(profile, primaryProperty, lang.sessionExpiredDesc);

                await editV2(sentMessage, {
                    card: expiredCard,
                    rows: disabledRows
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in vault command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
