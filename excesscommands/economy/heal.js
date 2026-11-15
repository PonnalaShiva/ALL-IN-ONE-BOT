'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { HuntingManager } = require('../../models/economy/huntingManager');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.heal);

async function executeSelfHeal(profile, referenceId = `heal-self:${Date.now()}`) {
    const settlement = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId, guildId: profile.guildId, referenceId,
        mutate: async current => {
            const currentHealth = current.huntingProfile?.currentHealth ?? 100;
            const missingHealth = 100 - currentHealth;
            if (missingHealth <= 0) return { success: false, error: 'already_healthy' };
            const healingCost = missingHealth * 50;
            if ((current.wallet || 0) < healingCost) return { success: false, error: 'funds' };
            if (!current.huntingProfile) current.huntingProfile = {};
            current.wallet -= healingCost;
            current.huntingProfile.currentHealth = 100;
            current.transactions.push({ type: 'expense', amount: healingCost, description: lang.txMedicalTreatment.toString(), category: 'hunting' });
            return { healingCost, missingHealth };
        }
    });
    if (!settlement.success) {
        const currentHealth = settlement.profile.huntingProfile?.currentHealth ?? 100;
        return {
            error: settlement.error || 'already_healthy', card: settlement.error === 'funds'
                ? cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ cost: ((100 - currentHealth) * 50).toLocaleString(), wallet: (settlement.profile.wallet || 0).toLocaleString(), shortage: Math.max(0, (100 - currentHealth) * 50 - (settlement.profile.wallet || 0)).toLocaleString() }))
                : cards.success(lang.alreadyHealthyTitle, `${lang.alreadyHealthyDesc}\n${lang.currentHealthLine({ health: currentHealth })}`)
        };
    }
    profile = settlement.profile;
    const currentHealth = 100 - settlement.missingHealth;
    const missingHealth = settlement.missingHealth;
    const healingCost = settlement.healingCost;

    const card = buildCard({
        title: lang.selfHealedTitle,
        description: lang.selfHealedDesc,
        accentColor: ACCENT.success
    })
        .addSeparator()
        .addText(
            `${lang.selfHealCost({ cost: healingCost.toLocaleString() })}\n` +
            `${lang.healthRestored({ hp: missingHealth })}\n` +
            lang.balanceRemaining({ balance: profile.wallet.toLocaleString() })
        );

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('heal_go_hunt', lang.btnGoHunt),
            btn.secondary('heal_close', lang.btnClose)
        )
    ];
    return { success: true, card, rows };
}

async function executeCompanionsHeal(profile, companionIds = null, referenceId = `heal-companions:${Date.now()}`) {
    const injuredCompanions = (profile.huntingCompanions || []).filter(c => c.injured || c.health < 100);

    if (injuredCompanions.length === 0) {
        return {
            error: 'all_healthy',
            card: cards.success(
                lang.allCompanionsHealthyTitle,
                lang.allCompanionsHealthyDesc
            )
        };
    }

    let companionsToHeal = [];
    if (companionIds && companionIds.length > 0) {
        companionsToHeal = profile.huntingCompanions.filter(c =>
            companionIds.some(id => c.companionId.includes(id) || c.companionId.endsWith(id))
        );
    } else {
        companionsToHeal = injuredCompanions;
    }

    if (companionsToHeal.length === 0) {
        return {
            error: 'not_found',
            card: cards.warning(
                lang.noCompanionsFoundTitle,
                lang.noCompanionsFoundDesc
            )
        };
    }

    const ids = companionsToHeal.map(c => c.companionId);
    const settlement = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId, guildId: profile.guildId, referenceId, mutate: async current => {
            const result = await HuntingManager.healCompanions(current, ids);
            if (!result.healedCompanions.length) return { success: false, error: 'all_healthy' };
            return result;
        }
    });
    if (!settlement.success) return { error: settlement.error || 'all_healthy', card: cards.success(lang.allCompanionsHealthyTitle, lang.allCompanionsHealthyDesc) };
    profile = settlement.profile;
    const result = settlement;

    const companionsText = result.healedCompanions.map(c => {
        const loc = resolveEntity('hunting_companions', c.companionId, c);
        return `> • **${loc.name}** - \`$${c.cost.toLocaleString()}\``;
    }).join('\n');

    const card = buildCard({
        title: lang.companionsHealedTitle,
        description: lang.companionsHealedDesc({ count: result.healedCompanions.length }),
        accentColor: ACCENT.success
    })
        .addSeparator()
        .addText(`### 💊 ${lang.healingSummaryTitle}`)
        .addText(
            `${lang.totalCostLine({ cost: result.totalCost.toLocaleString() })}\n` +
            `${lang.balanceRemaining({ balance: profile.wallet.toLocaleString() })}\n\n` +
            `${lang.healedCompanionsHeader}\n${companionsText}`
        );

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('heal_go_hunt', lang.btnGoHunt),
            btn.secondary('heal_close', lang.btnClose)
        )
    ];
    return { success: true, card, rows };
}

module.exports = {
    name: 'heal',
    aliases: ['healme', 'healcompanions', 'medical'],
    description: 'Heal yourself or your hunting companions with full medical treatment',
    usage: '!heal [self | companions]',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const profile = await EconomyManager.getProfile(userId, message.guild.id);
            const action = args[0]?.toLowerCase();

            const attachReceiptCollector = (sentMsg) => {
                if (!sentMsg) return;
                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'heal_close') {
                            collector.stop('user_closed');
                            return closeAndAutoDelete(sentMsg, cards.info(lang.closedTitle, lang.closedDesc));
                        }

                        if (interaction.customId === 'heal_go_hunt') {
                            collector.stop('go_hunt');
                            const huntCmd = require('./hunt');
                            return huntCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error in direct heal collector:', err);
                    }
                });
                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => { });
                    }
                });
            };

            
            if (action === 'self') {
                const result = await executeSelfHeal(profile, `heal-self:${message.id}`);
                if (result.rows) {
                    const sentMsg = await sendV2(message, { card: result.card, rows: result.rows });
                    attachReceiptCollector(sentMsg);
                    return sentMsg;
                }
                return sendV2(message, result.card);
            }

            
            if (action === 'companions' || action === 'companion') {
                const ids = args.slice(1);
                const result = await executeCompanionsHeal(profile, ids.length > 0 ? ids : null, `heal-companions:${message.id}`);
                if (result.rows) {
                    const sentMsg = await sendV2(message, { card: result.card, rows: result.rows });
                    attachReceiptCollector(sentMsg);
                    return sentMsg;
                }
                return sendV2(message, result.card);
            }

            
            const currentHealth = profile.huntingProfile?.currentHealth ?? 100;
            const injuredCompanions = (profile.huntingCompanions || []).filter(c => c.injured || c.health < 100);

            const card = buildCard({
                title: lang.helpTitle,
                description: lang.helpDesc,
                accentColor: ACCENT.primary
            })
                .addSeparator()
                .addText(`### 💊 ${lang.selfTitle}\n${lang.selfDesc}\n${lang.currentHealthLine({ health: currentHealth })}`)
                .addSeparator()
                .addText(`### 🐕 ${lang.companionsTitle}\n${lang.companionsDesc}\n${lang.injuredCompanionsLine({ count: injuredCompanions.length })}`);

            const buttons = [
                btn.success('heal_action_self', lang.btnHealSelf),
                btn.primary('heal_action_companions', lang.btnHealCompanions),
                btn.danger('heal_close', lang.btnClose)
            ];

            const rows = [new ActionRowBuilder().addComponents(buttons)];
            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'heal_close') {
                        collector.stop('user_closed');
                        return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }

                    if (interaction.customId === 'heal_go_hunt') {
                        collector.stop('go_hunt');
                        const huntCmd = require('./hunt');
                        return huntCmd.execute(message, []);
                    }

                    if (interaction.customId === 'heal_action_self') {
                        const freshProfile = await EconomyManager.getProfile(userId, message.guild.id);
                        const result = await executeSelfHeal(freshProfile, `heal-self:${interaction.id}`);
                        const receiptRows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('heal_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows: receiptRows });
                    }

                    if (interaction.customId === 'heal_action_companions') {
                        const freshProfile = await EconomyManager.getProfile(userId, message.guild.id);
                        const result = await executeCompanionsHeal(freshProfile, null, `heal-companions:${interaction.id}`);
                        const receiptRows = result.rows || [new ActionRowBuilder().addComponents(btn.secondary('heal_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows: receiptRows });
                    }
                } catch (err) {
                    console.error('Error in interactive heal collector:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => { });
                }
            });

        } catch (error) {
            console.error('Error in heal command:', error);
            return sendV2(message, cards.error(lang.errorTitle, error.message || lang.errorMessage));
        }
    }
};
