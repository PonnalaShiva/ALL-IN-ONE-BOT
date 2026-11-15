'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { ROLES } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.buyrole);

function getRoleTier(price) {
    if (price <= 50000) return 'VIP';
    if (price <= 100000) return 'PREMIUM';
    return 'DIAMOND';
}

function buildRoleCatalogCard() {
    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.catalogSubtitle}**\n> ${lang.catalogIntro}`)
        .addSeparator();

    const rolesByTier = {};
    Object.entries(ROLES).forEach(([id, role]) => {
        const tier = getRoleTier(role.price);
        if (!rolesByTier[tier]) rolesByTier[tier] = [];
        rolesByTier[tier].push([id, role]);
    });

    Object.entries(rolesByTier).forEach(([tier, roles]) => {
        card.addText(lang.tierHeader({ tier }));
        const roleText = roles.map(([id, role]) => {
            const locRole = resolveEntity('roles', id, role);
            return lang.roleItemLine({
                id,
                name: locRole.name,
                price: role.price.toLocaleString(),
                duration: lang.daysDuration({ days: role.duration }),
                multiplier: role.benefits.workMultiplier,
                racing: role.benefits.racingBonus.toLocaleString(),
                defense: role.benefits.robberyProtection
            });
        }).join('\n');
        card.addText(roleText);
    });

    card.addSeparator()
        .addText(`> ${lang.howToPurchase}`);

    return card;
}

function buildRoleCatalogActionRows(profile) {
    const wallet = profile.wallet || 0;
    const purchased = profile.purchasedRoles || [];

    const selectOptions = Object.entries(ROLES).map(([id, role]) => {
        const locRole = resolveEntity('roles', id, role);
        const active = purchased.find(r => r.roleId === id && (!r.expiryDate || new Date(r.expiryDate) > new Date()));
        const canAfford = wallet >= role.price;

        let statusText = '';
        if (active) {
            statusText = lang.activeStatusTag.toString();
        } else if (!canAfford) {
            statusText = lang.shortageStatusTag.toString();
        }

        return {
            label: locRole.name,
            value: id,
            description: lang.roleOptionDesc({
                price: role.price.toLocaleString(),
                multiplier: role.benefits.workMultiplier,
                defense: role.benefits.robberyProtection,
                status: statusText
            }).toString()
        };
    });

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('buyrole_select')
            .setPlaceholder(lang.selectPlaceholder.toString())
            .addOptions(selectOptions)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('buyrole_close', lang.btnClose)
    );

    return [menuRow, btnRow];
}

async function processRolePurchase(guild, member, roleId, referenceId) {
    const roleData = ROLES[roleId];
    if (!roleData) {
        return { error: 'invalid', card: cards.warning(lang.invalidRoleTitle, lang.invalidRoleDesc({ id: roleId })) };
    }

    const locRole = resolveEntity('roles', roleId, roleData);
    const purchase = await EconomyManager.mutateProfileAtomically({
        userId: member.id, guildId: guild.id, referenceId,
        mutate: profile => {
            const now = new Date();
            const existingRole = (profile.purchasedRoles || []).find(role =>
                role.roleId === roleId && (!role.expiryDate || new Date(role.expiryDate) > now)
            );
            if (existingRole) return { success: false, reason: 'active', expiryDate: existingRole.expiryDate };
            const wallet = Number(profile.wallet) || 0;
            if (wallet < roleData.price) return { success: false, reason: 'funds', wallet };
            const expiryDate = new Date(now);
            expiryDate.setDate(expiryDate.getDate() + roleData.duration);
            profile.wallet = wallet - roleData.price;
            if (!Array.isArray(profile.purchasedRoles)) profile.purchasedRoles = [];
            profile.purchasedRoles.push({
                roleId, name: locRole.name, price: roleData.price,
                purchaseDate: now, expiryDate, active: true
            });
            if (!Array.isArray(profile.transactions)) profile.transactions = [];
            profile.transactions.push({
                type: 'expense', amount: roleData.price,
                description: lang.txPurchasedRole({ name: locRole.name }).toString(), category: 'role', timestamp: now
            });
            return { expiryDate };
        }
    });
    if (!purchase.success) {
        if (purchase.reason === 'active') return { error: 'active', card: cards.warning(lang.alreadyActiveTitle, lang.alreadyActiveDesc({
            name: locRole.name, expiry: purchase.expiryDate ? new Date(purchase.expiryDate).toLocaleDateString() : lang.neverLabel.toString()
        })) };
        if (purchase.reason === 'duplicate') return { error: 'duplicate', card: cards.info(lang.closedTitle, lang.closedDesc) };
        const wallet = purchase.wallet || 0;
        return { error: 'funds', card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({
            name: locRole.name, price: roleData.price.toLocaleString(), wallet: wallet.toLocaleString(), shortage: Math.max(0, roleData.price - wallet).toLocaleString()
        })) };
    }
    const profile = purchase.profile;
    const expiryDate = purchase.expiryDate;

    const discordRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleData.discordRoleName.toLowerCase());
    if (discordRole) {
        try {
            await member.roles.add(discordRole);
        } catch {
            
        }
    }

    const baseWorkEarnings = 1500;
    const enhancedWork = Math.floor(baseWorkEarnings * roleData.benefits.workMultiplier);
    const difference = enhancedWork - baseWorkEarnings;
    const sessionsToROI = difference > 0 ? Math.ceil(roleData.price / difference) : 0;

    const successCard = buildCard({
        title: lang.successTitle,
        accentColor: ACCENT.success
    })
        .addText(`> **${lang.successSubtitle}**\n${lang.successPurchaseDesc({ name: locRole.name, price: roleData.price.toLocaleString() })}`)
        .addSeparator()
        .addText(`### 🌟 ${lang.benefitsTitle}`)
        .addText(
            `> • **${lang.workMultiplierLabel}:** \`${roleData.benefits.workMultiplier}x\` ${lang.bonusSuffix}\n` +
            `> • **${lang.racingBonusLabel}:** \`+$${roleData.benefits.racingBonus.toLocaleString()}\` ${lang.perWinSuffix}\n` +
            `> • **${lang.robberyProtectionLabel}:** \`+${roleData.benefits.robberyProtection}%\` ${lang.defenseSuffix}\n` +
            `> • **${lang.durationLabel}:** \`${lang.daysDuration({ days: roleData.duration })}\` (${lang.expiresLabel}: \`${expiryDate.toLocaleDateString()}\`)`
        )
        .addSeparator()
        .addText(`### 📈 ${lang.projectionsTitle}`)
        .addText(
            `> • **${lang.enhancedWorkLabel}:** \`$${enhancedWork.toLocaleString()}\` ${lang.perWorkSession} (+${Math.round((roleData.benefits.workMultiplier - 1) * 100)}%)\n` +
            `> • **${lang.roiTimelineLabel}:** ${lang.roiSessionsDesc({ sessions: sessionsToROI })}`
        )
        .addSeparator()
        .addText(`### 💳 ${lang.summaryTitle}`)
        .addText(
            `> • **${lang.priceLabel}:** \`$${roleData.price.toLocaleString()}\`\n` +
            `> • **${lang.remainingWalletLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
            `> • **${lang.activeRolesLabel}:** \`${profile.purchasedRoles.filter(r => new Date(r.expiryDate) > new Date()).length}\``
        );

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('buyrole_myroles', lang.btnMyRoles),
            btn.secondary('buyrole_close', lang.btnClose)
        )
    ];

    return { error: null, card: successCard, rows };
}

module.exports = {
    name: 'buyrole',
    aliases: ['roleshop', 'purchaserole', 'vipshop'],
    description: lang.cmdDesc.toString(),
    usage: '!buyrole [role_id]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guild = message.guild;
            const member = message.member;
            let profile = await EconomyManager.getProfile(userId, guild.id);

            const roleId = args[0]?.toLowerCase();

            
            if (roleId) {
                const result = await processRolePurchase(guild, member, roleId, `buyrole:${message.id}`);
                const rows = result.rows || [new ActionRowBuilder().addComponents(btn.danger('buyrole_close', lang.btnClose))];
                const sentMsg = await sendV2(message, { card: result.card, rows });
                if (!sentMsg) return;

                const directCollector = sentMsg.createMessageComponentCollector({ time: 60000 });
                directCollector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'buyrole_close') {
                            directCollector.stop('user_closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'buyrole_myroles') {
                            directCollector.stop('myroles');
                            const myRolesCmd = require('./myroles');
                            return myRolesCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error in buyrole direct collector:', err);
                    }
                });
                directCollector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return;
            }

            
            const initialCard = buildRoleCatalogCard();
            const initialRows = buildRoleCatalogActionRows(profile);

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'buyrole_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'buyrole_myroles') {
                        collector.stop('myroles');
                        const myRolesCmd = require('./myroles');
                        return myRolesCmd.execute(message, []);
                    }

                    if (interaction.customId === 'buyrole_select') {
                        const selectedRoleId = interaction.values[0];
                        const result = await processRolePurchase(guild, member, selectedRoleId, `buyrole:${interaction.id}`);
                        const rows = result.rows || [new ActionRowBuilder().addComponents(btn.danger('buyrole_close', lang.btnClose))];
                        return editV2(sentMessage, { card: result.card, rows });
                    }
                } catch (err) {
                    console.error('Error in buyrole interactive collector:', err);
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in buyrole command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
