'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager, Heist } = require('../../models/economy/economy');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.heist);

async function buildStatusCard(profile, guild) {
    const activeHeists = await Heist.find({
        heistId: { $in: profile.activeHeists || [] },
        guildId: guild.id,
        status: { $in: ['planning', 'recruiting', 'ready', 'in_progress'] }
    });

    if (activeHeists.length === 0) {
        const totalOps = (profile.completedHeists || 0) + (profile.failedHeists || 0);
        const successRate = totalOps > 0 ? Math.floor(((profile.completedHeists || 0) / totalOps) * 100) : 0;

        let jailStatusText = `> **${lang.legalStatusLabel}:** \`${lang.jailFree}\`\n> ${lang.legalStatusReady}`;
        if (profile.jailTime && new Date(profile.jailTime) > new Date()) {
            const hoursLeft = Math.ceil((new Date(profile.jailTime) - new Date()) / (1000 * 60 * 60));
            jailStatusText = `> **${lang.jailStatusLabel}:** \`${lang.jailRemaining({ hours: hoursLeft })}\`\n> ${lang.jailStatusLocked}`;
        }

        const card = buildCard({
            title: lang.noHeistsTitle,
            accentColor: ACCENT.secondary
        })
            .addText(`> ${lang.noHeistsDesc}`)
            .addSeparator()
            .addText(`### 🎭 ${lang.getStartedTitle}\n${lang.getStartedDesc}`)
            .addSeparator()
            .addText(
                `### 📊 ${lang.recordTitle}\n` +
                `> **${lang.completedLabel}:** \`${profile.completedHeists || 0}\` • **${lang.failedLabel}:** \`${profile.failedHeists || 0}\`\n` +
                `> **${lang.successRateLabel}:** \`${successRate}%\`\n` +
                `> **${lang.heatLevelLabel}:** \`${profile.heatLevel || 0}%\` • **${lang.heistSkillLabel}:** \`${profile.heistSkill || 0}%\`\n` +
                `${jailStatusText}`
            );

        return card;
    }

    const card = buildCard({
        title: lang.activeHeistsTitle,
        accentColor: ACCENT.warning
    })
        .addText(`> ${lang.activeHeistsDesc({ count: activeHeists.length })}`);

    activeHeists.forEach(heist => {
        const locTarget = resolveEntity('heist_targets', heist.targetType, { name: heist.targetName });
        const memberRole = heist.members.find(m => m.userId === profile.userId)?.role || lang.defaultRole.toString();
        const timeLeft = heist.plannedDate ? Math.max(0, Math.floor((new Date(heist.plannedDate) - new Date()) / (1000 * 60 * 60))) : 0;
        const individualPayout = Math.floor(heist.potential_payout / heist.requiredMembers);

        let statusText = `> **${lang.statusLabel}:** \`${lang.readyToExecuteStatus}\`\n> **${lang.actionLabel}:** ${lang.heistReadyAction({ heistId: heist.heistId })}`;
        if (heist.status === 'in_progress') {
            statusText = `> **${lang.statusLabel}:** \`${lang.inProgressStatus?.toString?.() || 'In progress'}\`\n> ${lang.inProgressDescription?.toString?.() || 'The crew is resolving this operation.'}`;
        } else if (timeLeft > 0) {
            statusText = `> **${lang.timeUntilReadyLabel}:** \`${lang.heistTimeUntilReady({ timeLeft })}\`\n> **${lang.plannedDateLabel}:** \`${new Date(heist.plannedDate).toLocaleString()}\``;
        }

        card.addSeparator().addText(
            lang.heistCardItem({
                target: locTarget.name,
                status: heist.status.toUpperCase(),
                role: memberRole,
                current: heist.members.length,
                required: heist.requiredMembers,
                cut: individualPayout.toLocaleString(),
                heistId: heist.heistId,
                statusText
            })
        );
    });

    card.addSeparator().addText(
        `### 📊 ${lang.activeStatsTitle}\n` +
        `> **${lang.completedLabel}:** \`${profile.completedHeists || 0}\` • **${lang.failedLabel}:** \`${profile.failedHeists || 0}\`\n` +
        `> **${lang.heatLevelLabel}:** \`${profile.heatLevel || 0}%\` • **${lang.heistSkillLabel}:** \`${profile.heistSkill || 0}%\``
    );

    return card;
}

async function buildHistoryCard(profile, guild) {
    const completedHeists = await Heist.find({
        guildId: guild.id,
        'members.userId': profile.userId,
        status: { $in: ['completed', 'failed'] }
    }).sort({ executionDate: -1 }).limit(10);

    if (completedHeists.length === 0) {
        return cards.info(lang.noHistoryTitle, lang.noHistoryDesc);
    }

    const totalOps = (profile.completedHeists || 0) + (profile.failedHeists || 0);
    const successRate = totalOps > 0 ? Math.floor(((profile.completedHeists || 0) / totalOps) * 100) : 0;

    const card = buildCard({
        title: lang.historyTitle,
        accentColor: ACCENT.primary
    })
        .addText(`> ${lang.historyDesc}`)
        .addSeparator();

    const historyText = completedHeists.map(heist => {
        const locTarget = resolveEntity('heist_targets', heist.targetType, { name: heist.targetName });
        const success = heist.status === 'completed';
        const memberRole = heist.members.find(m => m.userId === profile.userId)?.role || lang.defaultCrewRole.toString();
        const outcome = success ?
            lang.heistSuccessOutcome({ payout: Math.floor(heist.actual_payout / heist.members.length).toLocaleString() }) :
            lang.heistFailedOutcome.toString();

        return lang.historyItemLine({
            target: locTarget.name,
            role: memberRole,
            outcome,
            date: heist.executionDate ? new Date(heist.executionDate).toLocaleDateString() : lang.naLabel.toString()
        });
    }).join('\n\n');

    card.addText(historyText);

    const tip = successRate < 70 ? lang.tipFocusSkill : lang.tipElite;
    card.addSeparator().addText(
        `### 📈 ${lang.analysisTitle}\n` +
        `> **${lang.successRateLabel}:** \`${successRate}%\`\n` +
        `> **${lang.totalOpsLabel}:** \`${totalOps}\`\n` +
        `> **${lang.completedLabel}:** \`${profile.completedHeists || 0}\` • **${lang.failedLabel}:** \`${profile.failedHeists || 0}\`\n` +
        lang.tipFormat({ tip })
    );

    return card;
}

async function buildLeaderboardCard(guild) {
    const topProfiles = await EconomyManager.getTopHeistProfiles(guild.id, 5);

    if (topProfiles.length === 0) {
        return cards.info(lang.noDataTitle, lang.noDataDesc);
    }

    const card = buildCard({
        title: lang.leaderboardTitle,
        accentColor: ACCENT.primary
    })
        .addText(`> ${lang.leaderboardDesc({ guild: guild.name })}`)
        .addSeparator();

    const lbText = topProfiles.map((p, index) => {
        const member = guild.members.cache.get(p.userId);
        const username = member ? member.displayName : lang.operativeFormat({ id: p.userId.slice(-4) }).toString();
        const totalOps = (p.completedHeists || 0) + (p.failedHeists || 0);
        const successRate = totalOps > 0 ? Math.floor(((p.completedHeists || 0) / totalOps) * 100) : 0;
        const badges = ['🥇', '🥈', '🥉', '🏅', '🎖️'];

        return lang.leaderboardItem({
            badge: badges[index] || '•',
            username,
            heists: p.completedHeists || 0,
            rate: successRate,
            skill: p.heistSkill || 0
        });
    }).join('\n\n');

    card.addText(`### 🏆 ${lang.topThreeTitle}\n${lbText}`);
    return card;
}

function buildHeistActionRows() {
    return [
        new ActionRowBuilder().addComponents(
            btn.primary('heist_plan', lang.btnPlan),
            btn.secondary('heist_view_history', lang.btnHistory),
            btn.secondary('heist_view_lb', lang.btnLeaderboard),
            btn.danger('heist_close', lang.btnClose)
        )
    ];
}

module.exports = {
    name: 'heist',
    aliases: ['heists', 'heiststatus', 'heistlist'],
    description: lang.cmdDesc.toString(),
    usage: '!heist [status | history | leaderboard]',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const profile = await EconomyManager.getProfile(userId, message.guild.id);
            const action = args[0]?.toLowerCase();

            if (action === 'history') {
                const card = await buildHistoryCard(profile, message.guild);
                const rows = [new ActionRowBuilder().addComponents(btn.secondary('heist_close', lang.btnClose))];
                return sendWithCloseCollector(message, { card, rows }, userId);
            }

            if (action === 'leaderboard' || action === 'lb') {
                const card = await buildLeaderboardCard(message.guild);
                const rows = [new ActionRowBuilder().addComponents(btn.secondary('heist_close', lang.btnClose))];
                return sendWithCloseCollector(message, { card, rows }, userId);
            }

            
            const card = await buildStatusCard(profile, message.guild);
            const rows = buildHeistActionRows();

            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
            try {    
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'heist_close') {
                        collector.stop('user_closed');
                        return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }
    
                    if (interaction.customId === 'heist_plan') {
                        collector.stop('plan');
                        const planCmd = require('./planheist');
                        return planCmd.execute(message, []);
                    }
    
                    if (interaction.customId === 'heist_view_history') {
                        const freshProfile = await EconomyManager.getProfile(userId, message.guild.id);
                        const historyCard = await buildHistoryCard(freshProfile, message.guild);
                        const historyRows = [
                            new ActionRowBuilder().addComponents(
                                btn.primary('heist_view_status', lang.btnActiveOps),
                                btn.secondary('heist_view_lb', lang.btnLeaderboard),
                                btn.danger('heist_close', lang.btnClose)
                            )
                        ];
                        return editV2(sentMessage, { card: historyCard, rows: historyRows });
                    }
    
                    if (interaction.customId === 'heist_view_lb') {
                        const lbCard = await buildLeaderboardCard(message.guild);
                        const lbRows = [
                            new ActionRowBuilder().addComponents(
                                btn.primary('heist_view_status', lang.btnActiveOps),
                                btn.secondary('heist_view_history', lang.btnHistory),
                                btn.danger('heist_close', lang.btnClose)
                            )
                        ];
                        return editV2(sentMessage, { card: lbCard, rows: lbRows });
                    }
    
                    if (interaction.customId === 'heist_view_status') {
                        const freshProfile = await EconomyManager.getProfile(userId, message.guild.id);
                        const statusCard = await buildStatusCard(freshProfile, message.guild);
                        return editV2(sentMessage, { card: statusCard, rows: buildHeistActionRows() });
                    }
            } catch (err) {
                console.error('[heist.js] Error in component collector:', err);
            }
        });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => { });
                }
            });

        } catch (error) {
            console.error('Error in heist command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
