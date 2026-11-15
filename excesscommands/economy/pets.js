'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { PETS } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.pets);

function buildRosterCard(profile, username, alertText = null) {
    const pets = profile.pets || [];
    const maxPets = profile.maxPets || 1;

    if (pets.length === 0) {
        return buildCard({
            title: lang.noPetsTitle,
            accentColor: ACCENT.warning
        })
            .addText(`> ${lang.noPetsDesc}`)
            .addSeparator()
            .addText(`### ${lang.whyKeepHeader}`)
            .addText(lang.whyKeepDesc);
    }

    let petsText = '';
    for (let i = 0; i < pets.length; i++) {
        const pet = pets[i];
        const cond = ((pet.happiness ?? 100) + (pet.health ?? 100) + (pet.cleanliness ?? 100)) / 3;
        const condStatus = cond > 80 ? lang.statusExcellent : cond > 50 ? lang.statusGood : lang.statusNeedsCare;
        const eff = Math.min(100, Math.floor(((pet.happiness ?? 100) + (pet.health ?? 100) + (pet.cleanliness ?? 100)) / 3));

        const localizedPet = resolveEntity('pets', pet.type, pet);

        petsText += lang.petItemLine({
            index: i + 1,
            name: pet.name || localizedPet.name,
            breed: pet.breed || localizedPet.name || lang.defaultBreed.toString(),
            security: pet.securityLevel ?? 10,
            efficiency: eff,
            status: condStatus,
            happiness: pet.happiness ?? 100,
            health: pet.health ?? 100,
            cleanliness: pet.cleanliness ?? 100,
            hunger: pet.hunger ?? 0
        }) + '\n\n';
    }

    const totalSecurity = pets.reduce((sum, p) => sum + ((p.securityLevel ?? 10) * (((p.happiness ?? 100) + (p.health ?? 100)) / 200)), 0);
    const petsNeedingCare = pets.filter(p => ((p.hunger ?? 0) > 60 || (p.health ?? 100) < 50 || (p.happiness ?? 100) < 50)).length;

    const card = buildCard({
        title: lang.rosterTitle({ username, count: pets.length, max: maxPets }),
        accentColor: ACCENT.primary
    });

    if (alertText) {
        card.addText(alertText).addSeparator();
    }

    card.addText(`### ${lang.rosterHeader}`)
        .addText(petsText.trim())
        .addSeparator()
        .addText(`### ${lang.summaryHeader}`)
        .addText(
            `> **${lang.totalSecurityLabel}:** \`+${Math.floor(totalSecurity)} ${lang.defenceSuffix}\`\n` +
            `> **${lang.needingCareLabel}:** \`${petsNeedingCare}\``
        )
        .addSeparator()
        .addText(`### ${lang.commandsHeader}`)
        .addText(`> ${lang.commandsDesc}`);

    return card;
}

function buildRosterActionRows(profile) {
    const pets = profile.pets || [];
    const maxPets = profile.maxPets || 1;
    const rows = [];

    if (pets.length === 0) {
        rows.push(
            new ActionRowBuilder().addComponents(
                btn.primary('pets_adopt', lang.btnAdopt),
                btn.danger('pets_close', lang.btnClose)
            )
        );
        return rows;
    }

    const buttons = [
        btn.success('pets_quickcare', lang.btnQuickCare)
    ];

    if (pets.length < maxPets) {
        buttons.push(btn.secondary('pets_adopt', lang.btnAdopt));
    }
    buttons.push(btn.secondary('pets_refresh', lang.btnRefresh));
    buttons.push(btn.danger('pets_close', lang.btnClose));

    rows.push(new ActionRowBuilder().addComponents(buttons));
    return rows;
}

function buildAdoptionView(profile) {
    const card = buildCard({
        title: lang.adoptionAgencyTitle,
        description: lang.adoptionAgencyDesc,
        accentColor: ACCENT.primary
    });

    const options = [];
    for (const [id, pet] of Object.entries(PETS)) {
        const localized = resolveEntity('pets', id, pet);
        card.addText(lang.companionItemLine({
            name: localized.name,
            breed: pet.breed || pet.type,
            price: pet.price.toLocaleString(),
            securityLabel: lang.totalSecurityLabel.toString(),
            security: pet.securityLevel
        }));
        options.push({
            label: `${localized.name} ($${pet.price.toLocaleString()})`,
            value: `adopt_${id}`,
            description: lang.petDefenseDesc({ security: pet.securityLevel, breed: pet.breed || pet.type }).toString(),
            emoji: '🐾'
        });
    }

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('pets_adopt_select')
            .setPlaceholder(lang.selectCompanionPlaceholder.toString())
            .addOptions(options)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.primary('pets_back_to_roster', lang.btnBackToSanctuary),
        btn.danger('pets_close', lang.btnClose)
    );

    return { card, rows: [selectRow, btnRow] };
}

module.exports = {
    name: 'pets',
    aliases: ['mypets'],
    description: lang.cmdDesc.toString(),
    usage: '!pets | !pets sell <number>',
    cooldown: 4000,
    async execute(message, args) {
        try {
            let profile = await EconomyManager.getProfile(message.author.id, message.guild.id);
            const pets = profile.pets || [];

            
            const action = args[0]?.toLowerCase();
            if (action === 'sell' && args[1]) {
                const petIndex = parseInt(args[1], 10) - 1;
                if (isNaN(petIndex) || petIndex < 0 || petIndex >= pets.length) {
                    return sendV2(message, cards.warning(
                        lang.invalidSelectionTitle,
                        lang.invalidSelectionDesc({ slot: args[1], count: pets.length })
                    ));
                }

                const selectedPetId = pets[petIndex].petId;
                const sale = await EconomyManager.mutateProfileAtomically({
                    userId: message.author.id, guildId: message.guild.id,
                    referenceId: `pets-sell:${message.id}`,
                    mutate: async current => {
                        const currentIndex = (current.pets || []).findIndex((pet, index) => pet.petId === selectedPetId || (!pet.petId && index === petIndex));
                        if (currentIndex < 0) return { success: false, error: 'changed' };
                        const [pet] = current.pets.splice(currentIndex, 1);
                        const condition = ((pet.happiness ?? 100) + (pet.health ?? 100) + (pet.cleanliness ?? 100)) / 3;
                        const data = PETS[pet.type] || { price: 500 };
                        const sellPrice = Math.max(50, Math.floor(data.price * 0.5 * (condition / 100)));
                        current.wallet = (current.wallet || 0) + sellPrice;
                        current.transactions.push({ type: 'income', amount: sellPrice, description: lang.txAdoptedOut({ name: pet.name }).toString(), category: 'pet', timestamp: new Date() });
                        return { petSnapshot: { name: pet.name, breed: pet.breed, type: pet.type }, condition: Math.floor(condition), petPrice: data.price, sellPrice };
                    }
                });
                if (!sale?.success) return sendV2(message, cards.warning(lang.invalidSelectionTitle, lang.invalidSelectionDesc({ slot: args[1], count: (sale?.profile?.pets || []).length })));
                profile = sale.profile;
                const targetPet = sale.petSnapshot;
                const cond = sale.condition;
                const petData = { price: sale.petPrice };
                const sellPrice = sale.sellPrice;

                const receiptCard = buildCard({
                    title: lang.sellReceiptTitle({ name: targetPet.name }),
                    accentColor: ACCENT.success
                })
                    .addText(`### ${lang.sellReceiptHeader}`)
                    .addText(
                        lang.sellReceiptDesc({
                            name: targetPet.name,
                            breed: targetPet.breed || lang.defaultBreed.toString(),
                            price: sellPrice.toLocaleString(),
                            condition: Math.floor(cond),
                            cost: petData.price.toLocaleString(),
                            wallet: (profile.wallet || 0).toLocaleString(),
                            remaining: (profile.pets || []).length,
                            max: profile.maxPets || 1
                        })
                    );

                const rows = [
                    new ActionRowBuilder().addComponents(
                        btn.success(`pets_deposit_${sellPrice}`, lang.btnDepositBank),
                        btn.secondary('pets_close', lang.btnClose)
                    )
                ];
                const sentMsg = await sendV2(message, { card: receiptCard, rows });
                if (!sentMsg) return;

                const sellCollector = sentMsg.createMessageComponentCollector({ time: 60000 });
                sellCollector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();

                    if (interaction.customId === 'pets_close') {
                        sellCollector.stop('user_closed');
                        return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId.startsWith('pets_deposit_')) {
                        const depositAmt = parseInt(interaction.customId.split('_')[2], 10);
                        if (!isNaN(depositAmt) && depositAmt > 0) {
                            const transfer = await EconomyManager.transferBank({ userId: message.author.id, guildId: message.guild.id, direction: 'deposit', amount: depositAmt, referenceId: `pets-deposit:${sentMsg.id}`, description: lang.txDepositPetsEarnings({ amount: 'pet sale proceeds' }).toString() });
                            const freshProfile = transfer.profile || await EconomyManager.getProfile(message.author.id, message.guild.id);
                            const canDeposit = transfer.success ? transfer.amount : 0;
                            if (canDeposit > 0) {
                                sellCollector.stop('deposited');
                                return editV2(sentMsg, {
                                    card: cards.success(lang.sellReceiptTitle({ name: targetPet.name }), lang.depositSuccess({ amount: canDeposit.toLocaleString(), bank: freshProfile.bank.toLocaleString() })),
                                    rows: []
                                });
                            }
                        }
                    }
                
                } catch (err) {
                    console.error('[pets.js] Error in component collector:', err);
                }
            });

                sellCollector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { rows: [] }).catch(() => {});
                    }
                });

                return;
            }

            
            const initialCard = buildRosterCard(profile, message.author.username);
            const initialRows = buildRosterActionRows(profile);

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async (interaction) => {
                try {    
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'pets_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }
    
                    if (interaction.customId === 'pets_refresh' || interaction.customId === 'pets_back_to_roster') {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const freshCard = buildRosterCard(freshProfile, message.author.username);
                        const freshRows = buildRosterActionRows(freshProfile);
                        return editV2(sentMessage, { card: freshCard, rows: freshRows });
                    }
    
                    if (interaction.customId === 'pets_adopt') {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const adoptView = buildAdoptionView(freshProfile);
                        return editV2(sentMessage, { card: adoptView.card, rows: adoptView.rows });
                    }
    
                    if (interaction.customId === 'pets_adopt_select') {
                        const petId = interaction.values[0].replace('adopt_', '');
                        const petData = PETS[petId];
                        if (!petData) return;
    
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const maxPets = freshProfile.maxPets || 1;
                        if ((freshProfile.pets || []).length >= maxPets) {
                            return editV2(sentMessage, {
                                card: cards.warning(lang.capacityLimitTitle, lang.capacityLimitDesc({ max: maxPets })),
                                rows: [new ActionRowBuilder().addComponents(btn.primary('pets_back_to_roster', lang.btnBackToSanctuary), btn.danger('pets_close', lang.btnClose))]});
                    }

                    if ((freshProfile.wallet || 0) < petData.price) {
                        return editV2(sentMessage, {
                            card: cards.warning(lang.insufficientCareFundsTitle, lang.adoptionCostError({ cost: petData.price.toLocaleString(), wallet: (freshProfile.wallet || 0).toLocaleString() })),
                            rows: [new ActionRowBuilder().addComponents(btn.primary('pets_back_to_roster', lang.btnBackToSanctuary), btn.danger('pets_close', lang.btnClose))]
                        });
                    }

                    const localized = resolveEntity('pets', petId, petData);

                    const adoption = await EconomyManager.mutateProfileAtomically({
                        userId: message.author.id, guildId: message.guild.id,
                        referenceId: `pets-adopt:${interaction.id}`,
                        mutate: async current => {
                            const currentMax = current.maxPets || 1;
                            if ((current.pets || []).length >= currentMax) return { success: false, error: 'capacity' };
                            if ((current.wallet || 0) < petData.price) return { success: false, error: 'funds' };
                            current.wallet -= petData.price;
                            current.pets.push({ petId: `${petId}_${interaction.id}`, type: petId, name: localized.name, breed: petData.breed || lang.defaultBreed.toString(), securityLevel: petData.securityLevel || 10, health: 100, happiness: 100, cleanliness: 100, hunger: 0, acquiredAt: new Date() });
                            current.transactions.push({ type: 'expense', amount: petData.price, description: lang.txAdoptedCompanion({ name: localized.name }).toString(), category: 'pet', timestamp: new Date() });
                            return {};
                        }
                    });
                    if (!adoption?.success) {
                        const currentProfile = adoption.profile || await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const errorCard = adoption.error === 'capacity'
                            ? cards.warning(lang.capacityLimitTitle, lang.capacityLimitDesc({ max: currentProfile.maxPets || 1 }))
                            : cards.warning(lang.insufficientCareFundsTitle, lang.adoptionCostError({ cost: petData.price.toLocaleString(), wallet: (currentProfile.wallet || 0).toLocaleString() }));
                        return editV2(sentMessage, { card: errorCard, rows: [new ActionRowBuilder().addComponents(btn.primary('pets_back_to_roster', lang.btnBackToSanctuary), btn.danger('pets_close', lang.btnClose))] });
                    }
                    const adoptSuccess = cards.success(lang.adoptionSuccessTitle, lang.adoptionSuccessDesc({ name: localized.name, security: petData.securityLevel }));
                    return editV2(sentMessage, {
                        card: adoptSuccess,
                        rows: [new ActionRowBuilder().addComponents(btn.primary('pets_back_to_roster', lang.btnViewRoster), btn.danger('pets_close', lang.btnClose))]
                    });
                }

                if (interaction.customId === 'pets_quickcare') {
                    const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                    const pList = freshProfile.pets || [];
                    const careCost = 100;

                    if ((freshProfile.wallet || 0) < careCost) {
                        const alert = `> ⚠️ **${lang.insufficientCareFunds({ cost: careCost })}**`;
                        const freshCard = buildRosterCard(freshProfile, message.author.username, alert);
                        const freshRows = buildRosterActionRows(freshProfile);
                        return editV2(sentMessage, { card: freshCard, rows: freshRows });
                    }

                    const care = await EconomyManager.mutateProfileAtomically({
                        userId: message.author.id, guildId: message.guild.id,
                        referenceId: `pets-quickcare:${interaction.id}`,
                        mutate: async current => {
                            if ((current.wallet || 0) < careCost) return { success: false, error: 'funds' };
                            if (!(current.pets || []).length) return { success: false, error: 'pets' };
                            current.wallet -= careCost;
                            const now = new Date();
                            for (const pet of current.pets) Object.assign(pet, { health: 100, happiness: 100, cleanliness: 100, hunger: 0, lastFed: now, lastGroomed: now, lastPlayed: now });
                            current.transactions.push({ type: 'expense', amount: careCost, description: lang.txQuickCare({ count: current.pets.length }).toString(), category: 'pet', timestamp: now });
                            return {};
                        }
                    });
                    if (!care?.success) return editV2(sentMessage, { card: cards.warning(lang.insufficientCareFundsTitle, lang.insufficientCareFunds({ cost: careCost })), rows: buildRosterActionRows(care.profile || freshProfile) });
                    const refreshedProfile = care.profile;

                    const alert = `> ✅ **${lang.careSuccessDesc({ count: pList.length })}**`;
                    const freshCard = buildRosterCard(refreshedProfile, message.author.username, alert);
                    const freshRows = buildRosterActionRows(refreshedProfile);
                    return editV2(sentMessage, { card: freshCard, rows: freshRows });
                }
            
                } catch (err) {
                    console.error('[pets.js] Error in component collector:', err);
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in pets command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
