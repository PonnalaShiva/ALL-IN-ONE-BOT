'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const UserProfile = require('../../models/profile/UserProfile');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.profile);

const PLATFORM_EMOJIS = {
    steam: '🛠️ Steam', epic: '🎮 Epic Games', riot: '🔴 Riot Games', minecraft: '⛏️ Minecraft',
    xbox: '🎯 Xbox', playstation: '🎮 PlayStation', nintendo: '🎮 Nintendo', battlenet: '⚔️ Battle.net',
    fortnite: '🏆 Fortnite', youtube: '📺 YouTube', twitch: '🟣 Twitch', instagram: '📸 Instagram',
    twitter: '🐦 Twitter/X', facebook: '📘 Facebook', tiktok: '🎵 TikTok', linkedin: '💼 LinkedIn',
    github: '💻 GitHub', reddit: '🔶 Reddit', website: '🌐 Website', spotify: '🎵 Spotify'
};

function getConnectedAccounts(userProfile) {
    if (!userProfile) return [];
    const accounts = [];

    
    if (userProfile.gaming) {
        for (const [key, val] of Object.entries(userProfile.gaming)) {
            if (val && (val.username || val.gamertag || val.riotId || val.epicName || val.battleTag || val.psnId || val.friendCode)) {
                const label = val.username || val.gamertag || val.riotId || val.epicName || val.battleTag || val.psnId || val.friendCode;
                accounts.push({ platform: key, label, emoji: PLATFORM_EMOJIS[key] || key });
            }
        }
    }

    
    if (userProfile.social) {
        for (const [key, val] of Object.entries(userProfile.social)) {
            if (val && (val.username || val.channelName || val.displayName)) {
                const label = val.username || val.channelName || val.displayName;
                accounts.push({ platform: key, label, emoji: PLATFORM_EMOJIS[key] || key });
            }
        }
    }

    
    if (userProfile.content?.website?.url) {
        accounts.push({ platform: 'website', label: userProfile.content.website.title || userProfile.content.website.url, emoji: PLATFORM_EMOJIS.website });
    }
    if (userProfile.other?.spotify?.displayName) {
        accounts.push({ platform: 'spotify', label: userProfile.other.spotify.displayName, emoji: PLATFORM_EMOJIS.spotify });
    }

    return accounts;
}

function buildProfileCard(profile, targetUser, userProfile) {
    const wallet = profile.wallet || 0;
    const bank = profile.bank || 0;
    const vault = profile.familyVault || 0;
    const liquidWealth = wallet + bank + vault;

    const securityLevel = EconomyManager.calculateSecurityLevel ? EconomyManager.calculateSecurityLevel(profile) : 0;
    const workMultiplier = EconomyManager.calculateWorkMultiplier ? EconomyManager.calculateWorkMultiplier(profile) : 1.0;

    const cars = profile.cars || [];
    const properties = profile.properties || [];
    const businesses = profile.businesses || [];
    const familyMembers = profile.familyMembers || [];
    const activeEffects = profile.activeEffects || [];

    const carValue = cars.reduce((sum, c) => sum + (c.currentValue || 0), 0);
    const propertyValue = properties.reduce((sum, p) => sum + (p.currentValue || 0), 0);
    const businessValue = businesses.reduce((sum, b) => sum + (b.purchasePrice || 0), 0);
    const totalNetWorth = liquidWealth + carValue + propertyValue + businessValue;

    const racingStats = profile.racingStats || { wins: 0, losses: 0, totalRaces: 0, earnings: 0 };
    const totalRaces = racingStats.totalRaces || (racingStats.wins + racingStats.losses);
    const winRate = totalRaces > 0 ? ((racingStats.wins / totalRaces) * 100).toFixed(1) : '0.0';

    const totalHeists = (profile.completedHeists || 0) + (profile.failedHeists || 0);
    const heistSuccessRate = totalHeists > 0 ? (((profile.completedHeists || 0) / totalHeists) * 100).toFixed(1) : '0.0';

    const connectedAccounts = getConnectedAccounts(userProfile);
    const sections = [];

    
    if (userProfile?.bio) {
        sections.push(`### ${lang.bioHeader}\n> *" ${userProfile.bio} "*`);
    }

    
    sections.push(
        `${lang.financialSectionHeader}\n` +
        `${lang.liquidWalletLine({ wallet: wallet.toLocaleString() })}\n` +
        `${lang.bankReserveLine({ bank: bank.toLocaleString(), bankLimit: (profile.bankLimit || 10000).toLocaleString() })}\n` +
        `${lang.vaultReserveLine({ vault: vault.toLocaleString() })}\n` +
        `${lang.netWorthLine({ netWorth: totalNetWorth.toLocaleString(), liquid: liquidWealth.toLocaleString() })}\n` +
        `${lang.progressionLine({ level: profile.level || 1, xp: (profile.experience || 0).toLocaleString(), reputation: profile.reputation || 0, multiplier: workMultiplier.toFixed(2) })}`
    );

    
    sections.push(
        `${lang.assetsSectionHeader}\n` +
        `${lang.realEstateLine({ count: properties.length, value: propertyValue.toLocaleString() })}\n` +
        `${lang.garageFleetLine({ count: cars.length, value: carValue.toLocaleString() })}\n` +
        `${lang.householdLine({ count: familyMembers.length, bond: profile.familyBond || 0 })}\n` +
        `${lang.securityLine({ pets: profile.pets?.length || 0, maxPets: profile.maxPets || 1, security: securityLevel })}`
    );

    
    let opsText = `${lang.racingRecordLine({ wins: racingStats.wins || 0, losses: racingStats.losses || 0, winRate, earnings: (racingStats.earnings || 0).toLocaleString() })}\n` +
        `${lang.heistRecordLine({ wins: profile.completedHeists || 0, losses: profile.failedHeists || 0, successRate: heistSuccessRate, skill: profile.heistSkill || 0, heat: profile.heatLevel || 0 })}`;

    if (profile.jailTime && new Date(profile.jailTime) > new Date()) {
        const jailHours = Math.ceil((new Date(profile.jailTime) - new Date()) / (60 * 60 * 1000));
        opsText += lang.jailStatusLine({ hours: jailHours });
    }

    sections.push(`${lang.careerSectionHeader}\n${opsText}`);

    
    if (businesses.length > 0) {
        const totalBizProfit = businesses.reduce((sum, b) => sum + (b.profit || 0), 0);
        const bizPreviews = businesses.slice(0, 3).map(b => {
            const localizedBiz = resolveEntity('businesses', b.type, { name: b.type });
            return lang.bizPreviewLine({
                name: b.name,
                typeName: localizedBiz.name,
                level: b.level,
                employees: b.employees,
                efficiency: (b.efficiency * 100).toFixed(0)
            }).toString();
        }).join('\n');

        sections.push(
            `${lang.empireSectionHeader}\n` +
            lang.empireOverviewLine({
                count: businesses.length,
                max: profile.maxBusinesses || 1,
                skill: profile.businessSkill || 0,
                value: businessValue.toLocaleString(),
                profit: totalBizProfit.toLocaleString()
            }) +
            bizPreviews +
            (businesses.length > 3 ? lang.moreBusinessesText({ count: businesses.length - 3 }) : '')
        );
    }

    
    if (activeEffects.length > 0) {
        const effectLines = activeEffects.slice(0, 3).map(eff => {
            const hoursLeft = Math.ceil((new Date(eff.expiryTime) - new Date()) / (60 * 60 * 1000));
            return lang.boostLine({ name: eff.name || eff.type, multiplier: eff.multiplier, hours: hoursLeft });
        }).join('\n');

        sections.push(`${lang.boostsSectionHeader}\n${effectLines}`);
    }

    
    if (connectedAccounts.length > 0) {
        const preview = connectedAccounts.slice(0, 4).map(a => a.emoji).join(' · ');
        sections.push(
            `### ${lang.socialGamingHeader}\n` +
            lang.connectedAccountsLine({ accounts: lang.connectedPlatformsText({ count: connectedAccounts.length, preview }).toString() })
        );
    }

    const avatarURL = targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ dynamic: true, size: 256 }) : null;
    return buildCard({
        title: lang.title({ username: targetUser.username }),
        description: lang.subtitle,
        accentColor: ACCENT.primary,
        thumbnailURL: avatarURL,
        sections
    });
}

function buildSocialsCard(targetUser, userProfile) {
    const connected = getConnectedAccounts(userProfile);
    const sections = [];

    if (userProfile?.bio) {
        sections.push(`### ${lang.bioHeader}\n> *" ${userProfile.bio} "*`);
    }

    if (connected.length === 0) {
        sections.push(`### ${lang.socialGamingHeader}\n${lang.noSocialsLine}`);
    } else {
        const lines = connected.map(a => `> **${a.emoji}:** \`${a.label}\``).join('\n');
        sections.push(`### ${lang.socialGamingHeader}\n${lines}`);
    }

    const avatarURL = targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ dynamic: true, size: 256 }) : null;
    return buildCard({
        title: lang.socialIdentityTitle({ username: targetUser.username }),
        description: lang.socialIdentitySubtitle,
        accentColor: ACCENT.primary,
        thumbnailURL: avatarURL,
        sections
    });
}

module.exports = {
    name: 'profile',
    aliases: ['stats', 'me', 'userprofile'],
    description: lang.cmdDesc.toString(),
    usage: '!profile [@user]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const targetUser = message.mentions.users.first() || message.author;

            const [profile, userProfile] = await Promise.all([
                EconomyManager.getProfile(targetUser.id, message.guild.id),
                UserProfile.findOne({ userId: targetUser.id }).catch(() => null)
            ]);

            let isSocialView = false;
            let currentCard = buildProfileCard(profile, targetUser, userProfile);

            const buildRows = (socialView) => {
                const buttons = [
                    socialView ?
                        btn.primary('prof_toggle_view', lang.btnDossier) :
                        btn.secondary('prof_toggle_view', lang.btnSocials),
                    btn.secondary('prof_refresh', lang.btnRefresh),
                    btn.danger('prof_close', lang.btnClose)
                ];
                return [new ActionRowBuilder().addComponents(buttons)];
            };

            const sentMessage = await sendV2(message, { card: currentCard, rows: buildRows(isSocialView) });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
            try {    
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'prof_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }
    
                    if (interaction.customId === 'prof_toggle_view') {
                        isSocialView = !isSocialView;
                        currentCard = isSocialView ?
                            buildSocialsCard(targetUser, userProfile) :
                            buildProfileCard(profile, targetUser, userProfile);
                        return editV2(sentMessage, { card: currentCard, rows: buildRows(isSocialView) });
                    }
    
                    if (interaction.customId === 'prof_refresh') {
                        const [freshProfile, freshUserProfile] = await Promise.all([
                            EconomyManager.getProfile(targetUser.id, message.guild.id),
                            UserProfile.findOne({ userId: targetUser.id }).catch(() => null)
                        ]);
                        currentCard = isSocialView ?
                            buildSocialsCard(targetUser, freshUserProfile) :
                            buildProfileCard(freshProfile, targetUser, freshUserProfile);
                        return editV2(sentMessage, { card: currentCard, rows: buildRows(isSocialView) });
                    }
            } catch (err) {
                console.error('[profile.js] Error in component collector:', err);
            }
        });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in profile command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
