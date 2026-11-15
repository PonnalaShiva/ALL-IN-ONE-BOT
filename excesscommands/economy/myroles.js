'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.myroles);

function buildRolesCard(profile, username) {
    const roles = profile.purchasedRoles || [];
    const now = new Date();

    const activeRoles = roles.filter(role =>
        !role.expiryDate || new Date(role.expiryDate) > now
    );

    const expiredRoles = roles.filter(role =>
        role.expiryDate && new Date(role.expiryDate) <= now
    );

    if (activeRoles.length === 0 && expiredRoles.length === 0) {
        return buildCard({
            title: lang.noRolesTitle,
            accentColor: ACCENT.warning
        })
            .addText(`> ${lang.noRolesDesc}`)
            .addSeparator()
            .addText(`### ${lang.advantagesHeader}`)
            .addText(lang.advantagesDesc);
    }

    const card = buildCard({
        title: lang.title({ username }),
        accentColor: activeRoles.length > 0 ? ACCENT.warning : ACCENT.neutral
    })
        .addText(`> **${lang.subtitle}**`)
        .addSeparator();

    
    if (activeRoles.length > 0) {
        const roleList = activeRoles.map((role, idx) => {
            const locRole = resolveEntity('roles', role.roleId, { name: role.roleName || role.name });
            const daysLeft = role.expiryDate
                ? Math.ceil((new Date(role.expiryDate) - now) / (1000 * 60 * 60 * 24))
                : lang.permanent.toString();
            const expiryStr = typeof daysLeft === 'number'
                ? (daysLeft > 0 ? lang.daysRemaining({ days: daysLeft }) : lang.expiresToday.toString())
                : daysLeft;

            const b = role.benefits || {};
            return lang.activeItemLine({
                idx: idx + 1,
                roleName: locRole.name,
                expiry: expiryStr,
                work: b.workMultiplier || 1,
                racing: (b.racingBonus || 0).toLocaleString(),
                defense: b.robberyProtection || 0,
                family: b.familyBonus || 0
            });
        }).join('\n\n');

        const totalWorkMultiplier = activeRoles.reduce((sum, r) => sum + ((r.benefits?.workMultiplier || 1) - 1), 0) + 1;
        const totalRacingBonus = activeRoles.reduce((sum, r) => sum + (r.benefits?.racingBonus || 0), 0);
        const totalSecurityBonus = activeRoles.reduce((sum, r) => sum + (r.benefits?.robberyProtection || 0), 0);
        const totalFamilyBonus = activeRoles.reduce((sum, r) => sum + (r.benefits?.familyBonus || 0), 0);
        const boostPercent = ((totalWorkMultiplier - 1) * 100).toFixed(0);

        card.addText(`### ${lang.activeHeader({ count: activeRoles.length })}`)
            .addText(roleList)
            .addSeparator()
            .addText(`### ${lang.combinedPerksHeader}`)
            .addText(
                `${lang.combinedWork({ multiplier: totalWorkMultiplier.toFixed(2), boost: boostPercent })}\n` +
                `${lang.combinedRacing({ racing: totalRacingBonus.toLocaleString() })}\n` +
                `${lang.combinedDefense({ defense: totalSecurityBonus })}\n` +
                `${lang.combinedFamily({ family: totalFamilyBonus })}`
            )
            .addSeparator();
    }

    
    if (expiredRoles.length > 0) {
        const expiredList = expiredRoles.slice(-3).map(r => {
            const locRole = resolveEntity('roles', r.roleId, { name: r.roleName || r.name });
            return lang.expiredItemLine({
                roleName: locRole.name,
                date: r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : lang.naLabel.toString()
            });
        }).join('\n');

        card.addText(`### ${lang.expiredHeader({ count: expiredRoles.length })}`)
            .addText(`${expiredList}\n\n${lang.expiredNotice}`)
            .addSeparator();
    }

    card.addText(`### ${lang.managementHeader}`)
        .addText(lang.managementDesc);

    return card;
}

function buildRolesActionRows(hasAnyRoles) {
    const buttons = [
        btn.primary('myroles_browse', lang.btnBrowse),
        btn.secondary('myroles_refresh', lang.btnRefresh),
        btn.danger('myroles_close', lang.btnClose)
    ];

    return [new ActionRowBuilder().addComponents(buttons)];
}

module.exports = {
    name: 'myroles',
    aliases: ['roles', 'memberships', 'viptiers'],
    description: lang.cmdDesc.toString(),
    usage: '!myroles',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            const initialCard = buildRolesCard(profile, message.author.username);
            const hasRoles = (profile.purchasedRoles || []).length > 0;
            const initialRows = buildRolesActionRows(hasRoles);

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
            try {    
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'myroles_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }
    
                    if (interaction.customId === 'myroles_refresh') {
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const freshCard = buildRolesCard(freshProfile, message.author.username);
                        const freshHasRoles = (freshProfile.purchasedRoles || []).length > 0;
                        return editV2(sentMessage, { card: freshCard, rows: buildRolesActionRows(freshHasRoles) });
                    }
    
                    if (interaction.customId === 'myroles_browse') {
                        collector.stop('browse');
                        const buyroleCmd = require('./buyrole');
                        return buyroleCmd.execute(message, []);
                    }
            } catch (err) {
                console.error('[myroles.js] Error in component collector:', err);
            }
        });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in myroles command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
