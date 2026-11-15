'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { PRESTIGE_CONFIG } = require('../../models/economy/constants/systemData');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.prestige);

function buildPrestigeInfoCard(profile) {
    const currentPrestige = profile.prestigeLevel || 0;
    const currentMultiplier = profile.prestigeMultiplier || 1;
    const nextMultiplier = 1 + ((currentPrestige + 1) * PRESTIGE_CONFIG.multiplierPerLevel);
    const canPrestige = (profile.level || 0) >= PRESTIGE_CONFIG.minLevel;
    const netWorth = EconomyManager.calculateNetWorth(profile);

    const bonusLines = Object.entries(PRESTIGE_CONFIG.bonuses).map(([level, bonus]) => {
        const unlocked = currentPrestige >= parseInt(level, 10) ? '✅' : '🔒';
        return `${unlocked} **${bonus.name}** ${bonus.emoji} — ${bonus.bonus}`;
    }).join('\n');

    const card = buildCard({
        title: lang.systemTitle,
        accentColor: ACCENT.warning
    })
        .addText(lang.systemIntro.toString())
        .addSeparator()
        .addText(lang.statusHeader.toString())
        .addText(
            `**⭐ ${lang.currentPrestigeLabel}:** \`${currentPrestige}/${PRESTIGE_CONFIG.maxPrestigeLevel}\`\n` +
            `**📈 ${lang.currentMultiplierLabel}:** \`${currentMultiplier.toFixed(2)}x\`\n` +
            `**🔮 ${lang.nextMultiplierLabel}:** \`${nextMultiplier.toFixed(2)}x\` (+${(PRESTIGE_CONFIG.multiplierPerLevel * 100).toFixed(0)}%)\n` +
            `**🏆 ${lang.levelLabel}:** \`${lang.levelProgress({ current: profile.level || 0, req: PRESTIGE_CONFIG.minLevel })}\`\n` +
            `**💎 ${lang.netWorthLabel}:** \`$${netWorth.toLocaleString()}\`\n` +
            `**🔄 ${lang.totalResetsLabel}:** \`${profile.totalPrestigeResets || 0}\`\n\n` +
            (canPrestige
                ? lang.eligibleNotice.toString()
                : lang.needLevelNotice({ req: PRESTIGE_CONFIG.minLevel, current: profile.level || 0 }))
        )
        .addSeparator()
        .addText(lang.bonusesHeader.toString())
        .addText(bonusLines)
        .addSeparator()
        .addText(lang.loseVsKeepHeader.toString())
        .addText(lang.loseVsKeepDesc.toString());

    const buttons = [];
    if (canPrestige) {
        buttons.push(btn.danger('prest_confirm', lang.btnConfirm));
    } else {
        buttons.push(btn.primary('prest_refresh', lang.btnRefresh));
    }
    buttons.push(btn.secondary('prest_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];
    return { card, rows };
}

async function executePrestigeRebirth(userId, guildId, referenceId) {
    const result = await EconomyManager.prestige(userId, guildId, referenceId);
    if (!result.success) {
        return {
            error: 'cannot',
            card: cards.error(lang.cannotPrestigeTitle, result.error)
        };
    }

    const card = buildCard({
        title: lang.rebirthTitle({ level: result.prestigeLevel }),
        accentColor: ACCENT.success
    })
        .addText(lang.rebirthIntro.toString())
        .addSeparator()
        .addText(
            `**🔮 ${lang.newMultiplierLabel}:** \`${result.multiplier.toFixed(2)}x\`\n` +
            `**📊 ${lang.previousLevelLabel}:** \`${result.preStats.level}\`\n` +
            `**💸 ${lang.wealthSacrificedLabel}:** \`$${(result.preStats.wallet + result.preStats.bank).toLocaleString()}\``
        );

    const newProfile = await EconomyManager.getProfile(userId, guildId);
    const newAchievements = await EconomyManager.checkAchievements(newProfile);
    if (newAchievements.length > 0) {
        const achText = newAchievements.map(a => `${a.emoji} **${a.name}** — ${a.description}`).join('\n');
        card.addSeparator().addText(`${lang.achUnlockedHeader}\n${achText}`);
    }

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.secondary('prest_close', lang.btnClose)
        )
    ];

    return { success: true, card, rows };
}

module.exports = {
    name: 'prestige',
    aliases: ['rebirth', 'reset'],
    description: lang.cmdDesc.toString(),
    usage: '!prestige | !prestige confirm',
    cooldown: 5000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const profile = await EconomyManager.getProfile(userId, guildId);
            const action = args[0]?.toLowerCase();

            
            if (action === 'confirm') {
                const res = await executePrestigeRebirth(userId, guildId, `prestige:${message.id}`);
                return sendV2(message, { card: res.card, rows: res.rows || [] });
            }

            
            const initial = buildPrestigeInfoCard(profile);
            const sentMessage = await sendV2(message, { card: initial.card, rows: initial.rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'prest_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'prest_refresh') {
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const updated = buildPrestigeInfoCard(freshProfile);
                        return editV2(sentMessage, { card: updated.card, rows: updated.rows });
                    }

                    if (interaction.customId === 'prest_confirm') {
                        const rebirthRes = await executePrestigeRebirth(userId, guildId, `prestige:${interaction.id}`);
                        return editV2(sentMessage, { card: rebirthRes.card, rows: rebirthRes.rows || [] });
                    }
                } catch (err) {
                    console.error('Error in prestige collector:', err);
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in prestige command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
