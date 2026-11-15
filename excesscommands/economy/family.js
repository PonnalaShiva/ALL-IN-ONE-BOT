'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.family);

function buildFamilyOverviewCard(profile, username) {
    const card = buildCard({
        title: lang.title({ user: username }),
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.subtitle}**\n> ${lang.introDesc}`)
        .addSeparator();

    card.addText(`### ${lang.rosterHeader}`);

    (profile.familyMembers || []).forEach((member, index) => {
        const num = index + 1;
        const efficiency = ((member.bond / 100) * (member.workEfficiency || 1) * 100).toFixed(0);
        const lastTripText = member.lastTrip ? new Date(member.lastTrip).toLocaleDateString() : lang.neverLabel.toString();

        card.addText(lang.memberLine({
            num,
            name: member.name,
            relationship: member.relationship,
            profession: member.profession || lang.defaultProfession.toString(),
            salary: (member.salary || 0).toLocaleString(),
            bond: member.bond,
            efficiency,
            trips: member.totalTrips || 0,
            lastTrip: lastTripText
        }));
    });

    const totalIncome = (profile.familyMembers || []).reduce((sum, member) => {
        return sum + ((member.salary || 0) * (member.workEfficiency || 1) * (member.bond / 100));
    }, 0);

    const averageBond = (profile.familyMembers || []).length > 0
        ? profile.familyMembers.reduce((sum, m) => sum + m.bond, 0) / profile.familyMembers.length
        : 0;

    const totalTrips = (profile.familyMembers || []).reduce((sum, m) => sum + (m.totalTrips || 0), 0);
    const primaryProperty = (profile.properties || []).find(p => p.propertyId === profile.primaryResidence);
    const maxCapacity = primaryProperty ? primaryProperty.maxFamilyMembers : 0;
    const workMultiplier = EconomyManager.calculateWorkMultiplier(profile);

    card.addSeparator()
        .addText(`### 📊 ${lang.statsTitle}`)
        .addText(
            `• **${lang.combinedBonusLabel}:** \`+$${Math.floor(totalIncome).toLocaleString()}${lang.perWork}\`\n` +
            `• **${lang.averageBondLabel}:** \`${averageBond.toFixed(1)}%\`\n` +
            `• **${lang.capacityLabel}:** \`${(profile.familyMembers || []).length}/${maxCapacity} ${lang.membersSuffix}\`\n` +
            `• **${lang.totalTripsLabel}:** \`${totalTrips}\` • **${lang.workMultiplierLabel}:** \`${workMultiplier.toFixed(2)}x\``
        );

    const highBond = (profile.familyMembers || []).filter(m => m.bond >= 80).length;
    const medBond = (profile.familyMembers || []).filter(m => m.bond >= 50 && m.bond < 80).length;
    const lowBond = (profile.familyMembers || []).filter(m => m.bond < 50).length;

    card.addSeparator()
        .addText(`### 💝 ${lang.bondsTitle}`)
        .addText(
            `• ${lang.highBondLabel}: **${highBond}** ${lang.membersSuffix}\n` +
            `• ${lang.medBondLabel}: **${medBond}** ${lang.membersSuffix}\n` +
            `• ${lang.lowBondLabel}: **${lowBond}** ${lang.membersSuffix}`
        );

    card.addSeparator()
        .addText(`### 💡 ${lang.tipsTitle}`)
        .addText(lang.tipsDesc);

    return card;
}

function buildFamilyActionRows(hasMembers, canAdd = true) {
    const buttons = [];
    if (hasMembers) {
        buttons.push(btn.primary('family_trip', lang.btnTrip));
    }
    if (canAdd) {
        buttons.push(btn.secondary('family_add', lang.btnAdd));
    }
    if (hasMembers) {
        buttons.push(btn.secondary('family_refresh', lang.btnRefresh));
    }
    buttons.push(btn.danger('family_close', lang.btnClose));

    return [new ActionRowBuilder().addComponents(buttons)];
}

module.exports = {
    name: 'family',
    aliases: ['fam', 'familytree', 'household'],
    description: lang.cmdDesc.toString(),
    usage: '!family | !family remove <number>',
    cooldown: 5000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);
            const action = args[0]?.toLowerCase();

            
            if (action === 'remove' && args[1]) {
                const memberIndex = parseInt(args[1], 10) - 1;

                if (isNaN(memberIndex) || memberIndex < 0 || memberIndex >= (profile.familyMembers || []).length) {
                    return sendV2(message, cards.warning(
                        lang.invalidIndexTitle,
                        lang.invalidIndexDesc({ max: (profile.familyMembers || []).length })
                    ));
                }

                const selectedMemberId = profile.familyMembers[memberIndex].memberId;
                const removal = await EconomyManager.mutateProfileAtomically({
                    userId, guildId, referenceId: `family-remove:${message.id}`,
                    mutate: async current => {
                        const currentIndex = (current.familyMembers || []).findIndex((member, index) => member.memberId === selectedMemberId || (!member.memberId && index === memberIndex));
                        if (currentIndex < 0) return { success: false, error: 'changed' };
                        const [removedMember] = current.familyMembers.splice(currentIndex, 1);
                        current.transactions.push({ type: 'expense', amount: 0, description: lang.txFamilyDeparted({ name: removedMember.name, relationship: removedMember.relationship }).toString(), category: 'family', timestamp: new Date() });
                        return { removedMember };
                    }
                });
                if (!removal?.success) return sendV2(message, cards.warning(lang.invalidIndexTitle, lang.invalidIndexDesc({ max: (removal?.profile?.familyMembers || []).length })));
                profile = removal.profile;
                const removedMember = removal.removedMember;

                const removeCard = buildCard({
                    title: lang.removeSuccessTitle,
                    accentColor: ACCENT.warning
                }).addText(lang.removeSuccessDesc({
                    name: removedMember.name,
                    relationship: removedMember.relationship,
                    remaining: profile.familyMembers.length
                }));

                const removeRows = [
                    new ActionRowBuilder().addComponents(
                        btn.secondary('family_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: removeCard, rows: removeRows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        if (!interaction.deferred && !interaction.replied) {
                            await interaction.deferUpdate();
                        }
                        if (interaction.customId === 'family_close') {
                            collector.stop('user_closed');
                            return await closeAndAutoDelete(interaction);
                        }
                    } catch (err) {
                        console.error('Error in family remove collector:', err);
                    }
                });
                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, {
                            card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc),
                            rows: []
                        }).catch(() => { });
                    }
                });
                return;
            }

            
            let card;
            let rows;
            const hasMembers = Array.isArray(profile.familyMembers) && profile.familyMembers.length > 0;

            if (!hasMembers) {
                card = cards.info(
                    lang.noFamilyTitle,
                    lang.noFamilyDesc()
                );
                rows = buildFamilyActionRows(false);
            } else {
                card = buildFamilyOverviewCard(profile, message.author.username);
                rows = buildFamilyActionRows(true);
            }

            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferUpdate();
                    }

                    if (interaction.customId === 'family_close') {
                        collector.stop('user_closed');
                        return await closeAndAutoDelete(interaction);
                    }

                    if (interaction.customId === 'family_refresh') {
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const freshHasMembers = (freshProfile.familyMembers || []).length > 0;
                        const freshCard = freshHasMembers
                            ? buildFamilyOverviewCard(freshProfile, message.author.username)
                            : cards.info(lang.noFamilyTitle, lang.noFamilyDesc());
                        const freshRows = buildFamilyActionRows(freshHasMembers);
                        return await editV2(sentMessage, { card: freshCard, rows: freshRows });
                    }

                    if (interaction.customId === 'family_trip') {
                        collector.stop('trip');
                        const tripCmd = require('./trip');
                        return tripCmd.execute(message, []);
                    }

                    if (interaction.customId === 'family_add') {
                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        if (!freshProfile.properties || freshProfile.properties.length === 0) {
                            const addLang = createInterpolatableProxy(rawLang.economy?.addfamily);
                            const warningCard = cards.warning(addLang.noPropertyTitle, addLang.noPropertyDesc);
                            const backRows = [
                                new ActionRowBuilder().addComponents(
                                    btn.secondary('family_refresh', lang.btnRefresh),
                                    btn.danger('family_close', lang.btnClose)
                                )
                            ];
                            return await editV2(sentMessage, { card: warningCard, rows: backRows });
                        }
                        collector.stop('add');
                        const addFamCmd = require('./addfamily');
                        return addFamCmd.execute(message, []);
                    }
                } catch (err) {
                    console.error('Error in family collector:', err);
                    return await editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, {
                        card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc),
                        rows: []
                    }).catch(() => { });
                }
            });

            } catch (error) {
                console.error('Error in family command:', error);
                return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
            }
        }
};
