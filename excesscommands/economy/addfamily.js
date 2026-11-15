'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { FAMILY_TYPES } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.addfamily);

async function executeAddFamily(profile, type, name, referenceId) {
    let activeProperty = (profile.properties || []).find(p => p.propertyId === profile.primaryResidence) || profile.properties[0];
    let locProperty = activeProperty ? resolveEntity('houses', activeProperty.propertyId, activeProperty) : null;
    const template = FAMILY_TYPES[type];
    const locKinship = resolveEntity('kinships', type, template);

    if (!activeProperty) return { error: 'house', card: cards.warning(lang.capacityTitle, lang.capacityDesc({ property: 'home', max: 0, current: 0 })) };

    if ((profile.familyMembers || []).length >= activeProperty.maxFamilyMembers) {
        return {
            error: 'capacity',
            card: cards.warning(
                lang.capacityTitle,
                lang.capacityDesc({ property: locProperty.name, max: activeProperty.maxFamilyMembers, current: profile.familyMembers.length })
            )
        };
    }

    if ((profile.familyMembers || []).some(member => member.name.toLowerCase() === name.toLowerCase())) {
        return {
            error: 'duplicate',
            card: cards.warning(lang.duplicateTitle, lang.duplicateDesc({ name }))
        };
    }

    const availableProfessions = locKinship.professions?.length > 0
        ? locKinship.professions
        : [lang.defaultProfession.toString()];
    const profession = availableProfessions[Math.floor(Math.random() * availableProfessions.length)];

    const [minSalary, maxSalary] = template.salaryRange || [100, 300];
    const salary = Math.floor(Math.random() * (maxSalary - minSalary + 1)) + minSalary;

    const minAge = template.minAge || 20;
    const maxAge = template.maxAge || 50;
    const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;

    const familyMember = {
        memberId: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        relationship: type,
        age,
        profession,
        salary,
        bond: 50,
        workEfficiency: 1.0,
        totalTrips: 0,
        dateAdded: new Date(),
        lastTrip: null
    };

    const mutation = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId,
        guildId: profile.guildId,
        referenceId,
        mutate: async current => {
            const currentProperty = (current.properties || []).find(p => p.propertyId === current.primaryResidence) || current.properties?.[0];
            if (!currentProperty) return { success: false, error: 'house' };
            if (!current.familyMembers) current.familyMembers = [];
            if (current.familyMembers.length >= currentProperty.maxFamilyMembers) return { success: false, error: 'capacity' };
            if (current.familyMembers.some(member => member.name.toLowerCase() === name.toLowerCase())) return { success: false, error: 'duplicate' };
            current.familyMembers.push(familyMember);
            current.familyBond = Math.floor(current.familyMembers.reduce((sum, member) => sum + (member.bond || 0), 0) / current.familyMembers.length);
            current.maxPets = Math.min(10, Math.floor(currentProperty.maxFamilyMembers / 2) + 1);
            current.transactions.push({ type: 'income', amount: 0, description: lang.txFamilyAdded({ name, type: locKinship.name }).toString(), category: 'family', timestamp: new Date() });
            return {};
        }
    });
    if (!mutation?.success) {
        const currentCount = mutation?.profile?.familyMembers?.length ?? profile.familyMembers?.length ?? 0;
        return { error: mutation?.error || 'failed', card: mutation?.error === 'duplicate' ? cards.warning(lang.duplicateTitle, lang.duplicateDesc({ name })) : cards.warning(lang.capacityTitle, lang.capacityDesc({ property: locProperty?.name || 'home', max: activeProperty.maxFamilyMembers, current: currentCount })) };
    }
    profile = mutation.profile;
    activeProperty = (profile.properties || []).find(p => p.propertyId === profile.primaryResidence) || profile.properties[0];
    locProperty = resolveEntity('houses', activeProperty.propertyId, activeProperty);

    const totalFamilyIncome = profile.familyMembers.reduce((sum, member) => {
        return sum + ((member.salary || 0) * (member.workEfficiency || 1) * (member.bond / 100));
    }, 0);

    const successCard = buildCard({
        title: lang.successTitle({ name }),
        accentColor: ACCENT.success
    })
        .addText(`> **${lang.successSubtitle}**\n${lang.successJoinedDesc({ name, type: locKinship.name })}`)
        .addSeparator()
        .addText(`### 👤 ${lang.profileTitle}`)
        .addText(
            `> • **${lang.nameLabel}:** \`${name}\`\n` +
            `> • **${lang.relationshipLabel}:** \`${locKinship.name}\`\n` +
            `> • **${lang.ageLabel}:** \`${lang.ageFormat({ age })}\`\n` +
            `> • **${lang.professionLabel}:** \`${profession}\`\n` +
            `> • **${lang.workSalaryLabel}:** \`+$${salary.toLocaleString()}${lang.perSession}\``
        )
        .addSeparator()
        .addText(`### 🏡 ${lang.householdTitle}`)
        .addText(
            `> • **${lang.totalMembersLabel}:** \`${profile.familyMembers.length}/${activeProperty.maxFamilyMembers}\`\n` +
            `> • **${lang.avgBondLabel}:** \`${profile.familyBond}%\`\n` +
            `> • **${lang.combinedIncomeLabel}:** \`+$${Math.floor(totalFamilyIncome).toLocaleString()}${lang.perWork}\`\n` +
            `> • **${lang.propertyLabel}:** \`${locProperty.name}\`\n` +
            `> • **${lang.petCapacityLabel}:** \`${lang.petsAllowedFormat({ count: profile.maxPets })}\``
        )
        .addSeparator()
        .addText(lang.tipText);

    const successRows = [
        new ActionRowBuilder().addComponents(
            btn.primary('addfamily_view', lang.btnViewFamily),
            btn.secondary('addfamily_close', lang.btnClose)
        )
    ];

    return { error: null, card: successCard, rows: successRows };
}

module.exports = {
    name: 'addfamily',
    aliases: ['family-add'],
    description: lang.cmdDesc.toString(),
    usage: '!addfamily <type> <name>',
    cooldown: 5000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            let profile = await EconomyManager.getProfile(userId, guildId);

            if (!profile.properties || profile.properties.length === 0) {
                return sendV2(message, cards.warning(lang.noPropertyTitle, lang.noPropertyDesc));
            }

            const primaryProperty = profile.properties.find(p => p.propertyId === profile.primaryResidence) || profile.properties[0];
            const locProperty = resolveEntity('houses', primaryProperty.propertyId, primaryProperty);
            const currentCount = (profile.familyMembers || []).length;
            const maxCap = primaryProperty.maxFamilyMembers || 0;

            
            if (args.length >= 2) {
                const type = args[0].toLowerCase();
                const name = args.slice(1).join(' ').trim();

                if (!FAMILY_TYPES[type]) {
                    return sendV2(message, cards.warning(lang.invalidTypeTitle, lang.invalidTypeDesc({ type })));
                }

                const result = await executeAddFamily(profile, type, name, `family-add:${message.id}`);
                const rows = result.rows || [new ActionRowBuilder().addComponents(btn.danger('addfamily_close', lang.btnClose))];
                const sentMsg = await sendV2(message, { card: result.card, rows });
                if (!sentMsg) return;

                const directCollector = sentMsg.createMessageComponentCollector({ time: 60000 });
                directCollector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();
                        if (interaction.customId === 'addfamily_close') {
                            directCollector.stop('user_closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }
                        if (interaction.customId === 'addfamily_view') {
                            directCollector.stop('view');
                            const famCmd = require('./family');
                            return famCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error in addfamily direct collector:', err);
                    }
                });
                directCollector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return;
            }

            
            let kinshipsList = '';
            const selectOptions = [];

            for (const [id, template] of Object.entries(FAMILY_TYPES)) {
                const locKinship = resolveEntity('kinships', id, template);
                const [minSal, maxSal] = template.salaryRange || [100, 300];
                kinshipsList += lang.kinshipItemLine({
                    id,
                    name: locKinship.name,
                    minSal,
                    maxSal,
                    perWork: lang.perWork.toString()
                });

                selectOptions.push({
                    label: locKinship.name,
                    value: `recruit_${id}`,
                    description: locKinship.description || `${minSal}-${maxSal} ${lang.perWork}`,
                    emoji: locKinship.emoji || template.emoji || '👥'
                });
            }

            const card = buildCard({
                title: lang.recruitmentTerminalTitle,
                accentColor: ACCENT.primary
            })
                .addText(`> **${lang.recruitmentSubtitle}**`)
                .addSeparator()
                .addText(lang.capacityStatus({
                    property: locProperty.name,
                    current: currentCount,
                    max: maxCap
                }))
                .addSeparator()
                .addText(`### ${lang.availableKinshipsHeader}\n${kinshipsList}\n${lang.recruitmentGuideExample}`);

            const rows = [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('addfamily_select_type')
                        .setPlaceholder(lang.selectTypePlaceholder.toString())
                        .addOptions(selectOptions)
                        .setDisabled(currentCount >= maxCap)
                ),
                new ActionRowBuilder().addComponents(
                    btn.danger('addfamily_close', lang.btnClose)
                )
            ];

            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'addfamily_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'addfamily_view') {
                        collector.stop('view');
                        const famCmd = require('./family');
                        return famCmd.execute(message, []);
                    }

                    if (interaction.customId === 'addfamily_select_type') {
                        const chosenType = interaction.values[0].replace('recruit_', '');
                        const template = FAMILY_TYPES[chosenType];
                        const locKinship = resolveEntity('kinships', chosenType, template);
                        const defaultNames = locKinship.defaultNames?.length > 0
                            ? locKinship.defaultNames
                            : [lang.defaultName.toString()];
                        const randomName = defaultNames[Math.floor(Math.random() * defaultNames.length)];

                        const freshProfile = await EconomyManager.getProfile(userId, guildId);
                        const result = await executeAddFamily(freshProfile, chosenType, randomName, `family-add:${interaction.id}`);
                        const doneRows = result.rows || [
                            new ActionRowBuilder().addComponents(
                                btn.danger('addfamily_close', lang.btnClose)
                            )
                        ];
                        return editV2(sentMessage, { card: result.card, rows: doneRows });
                    }
                } catch (err) {
                    console.error('Error in addfamily interactive collector:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in addfamily command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
