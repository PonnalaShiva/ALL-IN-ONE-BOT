'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy, getEmoji } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.balance);

function buildBalanceCard(profile, user, notification = null) {
    const totalWealth = (profile.wallet || 0) + (profile.bank || 0) + (profile.familyVault || 0);
    const securityLevel = EconomyManager.calculateSecurityLevel(profile);
    const vaultCapacity = EconomyManager.getVaultCapacity(profile);
    const bankLimit = EconomyManager.getBankLimit(profile);
    const hasCashAtRisk = (profile.wallet || 0) > 0;

    const card = buildCard({
        title: lang.title({ username: user.username }),
        accentColor: ACCENT.success
    });

    if (notification) {
        card.addText(`> ${notification}`).addSeparator();
    } else {
        card.addText(`> ${lang.overviewSubtitle}`).addSeparator();
    }

    card.addText(`### ${lang.liquidAssetsTitle}`)
        .addText(
            `**${getEmoji('cart')} ${lang.walletLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\`\n` +
            `**${getEmoji('home')} ${lang.bankLabel}:** \`$${(profile.bank || 0).toLocaleString()}\`\n` +
            `**${getEmoji('analytics')} ${lang.bankLimitLabel}:** \`$${bankLimit.toLocaleString()}\`\n` +
            `**${getEmoji('lock')} ${lang.vaultLabel}:** \`$${(profile.familyVault || 0).toLocaleString()}\`\n` +
            `**${getEmoji('box')} ${lang.vaultCapacityLabel}:** \`$${vaultCapacity.toLocaleString()}\`\n` +
            `**${getEmoji('security')} ${lang.securityLabel}:** \`${securityLevel}%\``
        )
        .addSeparator()
        .addText(`### ${lang.wealthTitle}`)
        .addText(
            `**${getEmoji('sparkles')} ${lang.netWorthLabel}:** \`$${totalWealth.toLocaleString()}\`\n` +
            `**${getEmoji('trend')} ${lang.levelLabel}:** \`${profile.level || 1}\`\n` +
            `**${getEmoji('star')} ${lang.xpLabel}:** \`${(profile.experience || 0).toLocaleString()} XP\`\n` +
            `**${getEmoji('groupusers')} ${lang.familyBondLabel}:** \`${profile.familyBond || 0}%\`\n` +
            `**${getEmoji('crown')} ${lang.reputationLabel}:** \`${profile.reputation || 0}\``
        )
        .addSeparator()
        .addText(`### ${lang.vulnerabilityTitle}`)
        .addText(`> ${hasCashAtRisk ? lang.vulnerabilityHigh : lang.vulnerabilitySafe}`);

    if (profile.activeEffects && profile.activeEffects.length > 0) {
        const effectsText = profile.activeEffects.map(effect => {
            const timeLeft = Math.max(0, Math.ceil((new Date(effect.expiryTime) - new Date()) / (60 * 60 * 1000)));
            const stackText = effect.stacks > 1 ? ` (×${effect.stacks})` : '';
            return `**\`${effect.name}\`**${stackText} • ${effect.description || lang.activeBoostFallback}\n> **Duration:** \`${timeLeft}h remaining\``;
        }).join('\n\n');

        card.addSeparator()
            .addText(`### ${lang.activeEffectsTitle}`)
            .addText(effectsText);
    }

    return card;
}

function buildActionRow(profile, disabled = false) {
    const wallet = profile.wallet || 0;
    const bank = profile.bank || 0;
    const bankLimit = EconomyManager.getBankLimit(profile);
    const canDeposit = wallet > 0 && bank < bankLimit;
    const canWithdraw = bank > 0;

    return new ActionRowBuilder().addComponents(
        btn.success('bal_dep_all', lang.btnDepositAll, 'cart').setDisabled(disabled || !canDeposit),
        btn.primary('bal_with_all', lang.btnWithdrawAll, 'arrright').setDisabled(disabled || !canWithdraw),
        btn.secondary('bal_refresh', lang.btnRefresh, 'loop').setDisabled(disabled),
        btn.danger('bal_close', lang.btnClose, 'stop').setDisabled(disabled)
    );
}

module.exports = {
    name: 'balance',
    aliases: ['bal', 'money', 'wallet', 'bank'],
    description: lang.cmdDesc.toString(),
    usage: '!balance [@user]',
    async execute(message, args) {
        try {
            const targetUser = message.mentions.users.first() || message.author;
            const isSelf = targetUser.id === message.author.id;
            let profile = await EconomyManager.getProfile(targetUser.id, message.guild.id);

            const initialCard = buildBalanceCard(profile, targetUser);

            if (!isSelf) {
                return sendV2(message, initialCard);
            }

            const initialRow = buildActionRow(profile);
            const sentMessage = await sendV2(message, {
                card: initialCard,
                rows: [initialRow]
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
    
                    let notification = null;
    
                    if (interaction.customId === 'bal_dep_all') {
                        const transfer = await EconomyManager.transferBank({ userId: message.author.id, guildId: message.guild.id, direction: 'deposit', amount: 'all', referenceId: `balance-deposit:${sentMessage.id}`, description: lang.txQuickDeposit.toString() });
                        profile = transfer.profile || await EconomyManager.getProfile(message.author.id, message.guild.id);
                        notification = transfer.success ? lang.depositSuccess({ amount: transfer.amount.toLocaleString() }) : transfer.reason === 'duplicate' ? ((profile.wallet || 0) > 0 ? lang.bankFull : lang.noWalletToDeposit) : transfer.reason === 'no_wallet_or_space' ? ((profile.wallet || 0) > 0 ? lang.bankFull : lang.noWalletToDeposit) : lang.bankFull;
                    } else if (interaction.customId === 'bal_with_all') {
                        const transfer = await EconomyManager.transferBank({ userId: message.author.id, guildId: message.guild.id, direction: 'withdraw', amount: 'all', referenceId: `balance-withdraw:${sentMessage.id}`, description: lang.txQuickWithdraw.toString() });
                        profile = transfer.profile || await EconomyManager.getProfile(message.author.id, message.guild.id);
                        notification = transfer.success ? lang.withdrawSuccess({ amount: transfer.amount.toLocaleString() }) : lang.noBankToWithdraw;
                    } else if (interaction.customId === 'bal_refresh') {
                        
                        profile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                    } else if (interaction.customId === 'bal_close') {
                        collector.stop('closed');
                        return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }
    
                    const updatedCard = buildBalanceCard(profile, message.author, notification);
                    const updatedRow = buildActionRow(profile);
    
                    await editV2(sentMessage, {
                        card: updatedCard,
                        rows: [updatedRow]});
            
                } catch (err) {
                    console.error('[balance.js] Error in component collector:', err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const disabledRow = buildActionRow(profile, true);
                const expiredCard = buildBalanceCard(profile, message.author, lang.sessionExpiredDesc);

                await editV2(sentMessage, {
                    card: expiredCard,
                    rows: [disabledRow]
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in balance command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
