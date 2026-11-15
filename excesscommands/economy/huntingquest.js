'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.huntingquest);

const HUNTING_QUESTS = {
    'beginner_hunter': {
        get name() { return lang.quest_beginner_hunter_name.toString(); },
        get description() { return lang.quest_beginner_hunter_desc.toString(); },
        target: { type: 'hunts', amount: 5 },
        reward: { money: 5000, experience: 100, skill: 5 },
        rarity: 'common'
    },
    'rare_finder': {
        get name() { return lang.quest_rare_finder_name.toString(); },
        get description() { return lang.quest_rare_finder_desc.toString(); },
        target: { type: 'rarity', rarity: 'rare', amount: 3 },
        reward: { money: 15000, experience: 250, skill: 10 },
        rarity: 'uncommon'
    },
    'trophy_collector': {
        get name() { return lang.quest_trophy_collector_name.toString(); },
        get description() { return lang.quest_trophy_collector_desc.toString(); },
        target: { type: 'trophies', amount: 10 },
        reward: { money: 20000, experience: 300, skill: 15 },
        rarity: 'rare'
    },
    'elite_hunter': {
        get name() { return lang.quest_elite_hunter_name.toString(); },
        get description() { return lang.quest_elite_hunter_desc.toString(); },
        target: { type: 'hunts', amount: 20 },
        reward: { money: 50000, experience: 500, skill: 25 },
        rarity: 'epic'
    },
    'legendary_hunter': {
        get name() { return lang.quest_legendary_hunter_name.toString(); },
        get description() { return lang.quest_legendary_hunter_desc.toString(); },
        target: { type: 'rarity', rarity: 'legendary', amount: 5 },
        reward: { money: 100000, experience: 1000, skill: 50 },
        rarity: 'legendary'
    }
};

async function executeQuestClaimUnsafe(profile, questId) {
    const quest = HUNTING_QUESTS[questId];
    if (!quest) {
        return {
            error: 'invalid',
            card: cards.error(lang.invalidQuestTitle, lang.invalidQuestDesc({ questId }))
        };
    }

    if (!profile.huntingProfile) profile.huntingProfile = {};
    if (!Array.isArray(profile.huntingProfile.achievements)) {
        profile.huntingProfile.achievements = [];
    }

    if (profile.huntingProfile.achievements.includes(questId)) {
        return {
            error: 'already_completed',
            card: cards.warning(lang.alreadyCompletedTitle, lang.alreadyCompletedDesc({ name: quest.name }))
        };
    }

    let progress = 0;
    const target = quest.target.amount;

    if (quest.target.type === 'hunts') {
        progress = profile.huntingStats?.successfulHunts || 0;
    } else if (quest.target.type === 'rarity') {
        progress = (profile.huntingInventory || []).filter(item =>
            item.type === 'animal' && item.rarity === quest.target.rarity
        ).length;
    } else if (quest.target.type === 'trophies') {
        progress = (profile.huntingInventory || []).filter(item =>
            item.type === 'trophy'
        ).length;
    }

    if (progress < target) {
        return {
            error: 'not_complete',
            card: cards.warning(
                lang.notCompleteTitle,
                lang.notCompleteDesc({
                    name: quest.name,
                    progress,
                    target,
                    remaining: target - progress
                })
            )
        };
    }

    
    profile.huntingProfile.achievements.push(questId);
    profile.wallet = (profile.wallet || 0) + quest.reward.money;
    profile.experience = (profile.experience || 0) + quest.reward.experience;

    if (!profile.huntingStats) profile.huntingStats = {};
    profile.huntingStats.huntingSkill = Math.min(100, (profile.huntingStats.huntingSkill || 0) + quest.reward.skill);

    if (!Array.isArray(profile.transactions)) profile.transactions = [];
    profile.transactions.push({
        type: 'income',
        amount: quest.reward.money,
        description: lang.txQuestReward({ name: quest.name }).toString(),
        category: 'hunting',
        timestamp: new Date()
    });

    const successCard = buildCard({
        title: lang.completedTitle,
        description: lang.completedDesc({ name: quest.name }),
        accentColor: ACCENT.success
    })
        .addSeparator()
        .addText(`### 💰 ${lang.rewardsTitle}`)
        .addText(lang.rewardsDetails({
            money: quest.reward.money.toLocaleString(),
            exp: quest.reward.experience,
            totalExp: profile.experience.toLocaleString(),
            skill: quest.reward.skill,
            currentSkill: profile.huntingStats.huntingSkill,
            wallet: profile.wallet.toLocaleString()
        }));

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.success(`quest_deposit_${quest.reward.money}`, lang.btnDepositBank),
            btn.secondary('quest_close', lang.btnClose)
        )
    ];

    return { success: true, card: successCard, rows, rewardMoney: quest.reward.money };
}

async function executeQuestClaim(profile, questId, referenceId = `huntquest:${Date.now()}`) {
    const settlement = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId,
        guildId: profile.guildId,
        referenceId,
        mutate: async current => {
            const result = await executeQuestClaimUnsafe(current, questId);
            return result.error ? { success: false, result } : { result };
        }
    });
    if (!settlement.success) return settlement.result || { error: settlement.duplicate ? 'duplicate' : 'failed', card: cards.warning(lang.alreadyCompletedTitle, lang.alreadyCompletedDesc({ name: HUNTING_QUESTS[questId]?.name || questId })) };
    return settlement.result;
}

module.exports = {
    name: 'huntingquest',
    aliases: ['huntquest', 'quest'],
    description: lang.cmdDesc.toString(),
    usage: '!huntingquest [complete <quest_id>]',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const profile = await EconomyManager.getProfile(userId, message.guild.id);

            
            if (args[0]?.toLowerCase() === 'complete' && args[1]) {
                const questId = args[1].toLowerCase();
                const result = await executeQuestClaim(profile, questId, `huntquest-claim:${message.id}`);
                if (result.rows) {
                    const sentMsg = await sendV2(message, { card: result.card, rows: result.rows });
                    if (sentMsg) {
                        const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                        collector.on('collect', async (interaction) => {
                try {    
                                if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                                if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                                if (interaction.customId === 'quest_close') {
                                    collector.stop('user_closed');
                                    return closeAndAutoDelete(sentMsg, cards.info(lang.closedTitle, lang.closedDesc));
                                }
    
                                if (interaction.customId.startsWith('quest_deposit_')) {
                                    const depositAmt = parseInt(interaction.customId.replace('quest_deposit_', ''), 10) || 0;
                                    const transfer = depositAmt > 0 ? await EconomyManager.transferBank({ userId, guildId: message.guild.id, direction: 'deposit', amount: depositAmt, referenceId: `quest-deposit:${sentMsg.id}`, description: 'Deposited hunting quest reward' }) : { success: false };
                                    const freshProfile = transfer.profile || await EconomyManager.getProfile(userId, message.guild.id);
                                    const canDeposit = transfer.success ? transfer.amount : 0;
                                    collector.stop('deposited');
                                    return editV2(sentMsg, {
                                        card: cards.success(lang.completedTitle, `> 🏦 **Deposited $${canDeposit.toLocaleString()} into your bank!**\n> Bank Balance: $${(freshProfile.bank || 0).toLocaleString()}`),
                                        rows: []});
                            }
                        
                } catch (err) {
                    console.error('[huntingquest.js] Error in component collector:', err);
                }
            });
                        collector.on('end', (_, reason) => {
                            if (reason === 'time') {
                                editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                            }
                        });
                    }
                    return sentMsg;
                }
                return sendV2(message, result.card);
            }

            
            const listCard = buildCard({
                title: lang.title,
                description: lang.subtitle,
                accentColor: ACCENT.primary
            });

            const claimableQuests = [];

            Object.entries(HUNTING_QUESTS).forEach(([questId, quest], index) => {
                const isCompleted = (profile.huntingProfile?.achievements || []).includes(questId);

                let progress = 0;
                const target = quest.target.amount;

                if (quest.target.type === 'hunts') {
                    progress = profile.huntingStats?.successfulHunts || 0;
                } else if (quest.target.type === 'rarity') {
                    progress = (profile.huntingInventory || []).filter(item =>
                        item.type === 'animal' && item.rarity === quest.target.rarity
                    ).length;
                } else if (quest.target.type === 'trophies') {
                    progress = (profile.huntingInventory || []).filter(item =>
                        item.type === 'trophy'
                    ).length;
                }

                const progressPercent = Math.min(100, Math.floor((progress / target) * 100));
                const statusEmoji = isCompleted ? '✅' : progress >= target ? '🎯' : '⏳';
                const statusText = isCompleted ? lang.statusCompleted : progress >= target ? lang.statusReady : lang.statusInProgress;

                let questBody =
                    `${lang.questItemHeader({ statusEmoji, idx: index + 1, name: quest.name, rarity: quest.rarity.toUpperCase() })}\n` +
                    `${lang.questItemGoal({ desc: quest.description })}\n` +
                    `${lang.questItemProgress({ progress, target, percent: progressPercent, status: statusText })}\n` +
                    `${lang.questItemReward({ money: quest.reward.money.toLocaleString(), exp: quest.reward.experience, skill: quest.reward.skill })}`;

                if (progress >= target && !isCompleted) {
                    questBody += `\n${lang.questClaimHint({ questId })}`;
                    claimableQuests.push({ questId, name: quest.name });
                }

                listCard.addSeparator().addText(questBody);
            });

            listCard.addSeparator().addText(
                `### 💡 ${lang.guideTitle}\n${lang.guideDetails}`
            );

            const buttons = [];
            claimableQuests.slice(0, 4).forEach(q => {
                buttons.push(btn.success(`claim_${q.questId}`, lang.btnClaim({ name: q.name })));
            });
            buttons.push(btn.danger('quest_close', lang.btnClose));

            const rows = [new ActionRowBuilder().addComponents(buttons)];
            const sentMessage = await sendV2(message, { card: listCard, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();

                    if (interaction.customId === 'quest_close') {
                        collector.stop('user_closed');
                        return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }

                    if (interaction.customId.startsWith('quest_deposit_')) {
                        const depositAmt = parseInt(interaction.customId.replace('quest_deposit_', ''), 10) || 0;
                        const transfer = depositAmt > 0 ? await EconomyManager.transferBank({ userId, guildId: message.guild.id, direction: 'deposit', amount: depositAmt, referenceId: `quest-deposit:${sentMessage.id}`, description: 'Deposited hunting quest reward' }) : { success: false };
                        const freshProfile = transfer.profile || await EconomyManager.getProfile(userId, message.guild.id);
                        const canDeposit = transfer.success ? transfer.amount : 0;
                        collector.stop('deposited');
                        return editV2(sentMessage, {
                            card: cards.success(lang.completedTitle, `> 🏦 **Deposited $${canDeposit.toLocaleString()} into your bank!**\n> Bank Balance: $${(freshProfile.bank || 0).toLocaleString()}`),
                            rows: []
                        });
                    }

                    if (interaction.customId.startsWith('claim_')) {
                        const questIdToClaim = interaction.customId.replace('claim_', '');
                        const freshProfile = await EconomyManager.getProfile(userId, message.guild.id);
                        const result = await executeQuestClaim(freshProfile, questIdToClaim, `huntquest-claim:${interaction.id}`);
                        const rows = result.rows || [new ActionRowBuilder().addComponents(btn.danger('quest_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows });
                    }
                } catch (err) {
                    console.error('Error handling huntingquest interaction:', err);
                    editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in huntingquest command:', error);
            return sendV2(message, cards.error(
                lang.errorTitle,
                error.message || lang.errorMessage
            ));
        }
    }
};
