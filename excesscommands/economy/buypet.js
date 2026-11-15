'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { PETS } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.buypet);

function buildPetCatalogCard() {
    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.catalogSubtitle}**\n> ${lang.catalogIntro}`)
        .addSeparator();

    const petsByType = {};
    Object.entries(PETS).forEach(([id, pet]) => {
        if (!petsByType[pet.type]) {
            petsByType[pet.type] = [];
        }
        petsByType[pet.type].push([id, pet]);
    });

    Object.entries(petsByType).forEach(([type, pets]) => {
        card.addText(lang.companionsHeader({ type: type.toUpperCase() }));
        const petText = pets.map(([id, pet]) => {
            const locPet = resolveEntity('pets', id, pet);
            return lang.petItemLine({
                id,
                name: locPet.name,
                breed: pet.breed,
                priceLabel: lang.priceLabel.toString(),
                price: pet.price.toLocaleString(),
                securityLabel: lang.securityLabel.toString(),
                security: pet.securityLevel,
                typeLabel: lang.typeLabel.toString(),
                type: pet.type
            });
        }).join('\n');
        card.addText(petText);
    });

    card.addSeparator()
        .addText(`> ${lang.howToAdopt}`);

    return card;
}

function buildPetCatalogActionRows(profile) {
    const wallet = profile.wallet || 0;
    const maxPets = profile.maxPets || 1;
    const ownedCount = (profile.pets || []).length;
    const atCapacity = ownedCount >= maxPets;

    const selectOptions = Object.entries(PETS).map(([id, pet]) => {
        const locPet = resolveEntity('pets', id, pet);
        const canAfford = wallet >= pet.price;
        let suffix = '';
        if (atCapacity) {
            suffix = lang.suffixFull.toString();
        } else if (!canAfford) {
            suffix = lang.suffixShort.toString();
        }

        return {
            label: locPet.name,
            value: id,
            description: lang.selectOptionDesc({
                price: pet.price.toLocaleString(),
                security: pet.securityLevel,
                breed: pet.breed,
                suffix
            }).toString()
        };
    });

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('buypet_select')
            .setPlaceholder(lang.selectPlaceholder.toString())
            .addOptions(selectOptions)
            .setDisabled(atCapacity)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('buypet_close', lang.btnClose)
    );

    return [menuRow, btnRow];
}

async function processPetAdoption(userId, guildId, petId, customName = null, referenceId) {
    const petData = PETS[petId];
    if (!petData) {
        return { error: 'invalid', card: cards.warning(lang.invalidPetTitle, lang.invalidPetDesc({ id: petId })) };
    }

    const locPet = resolveEntity('pets', petId, petData);
    const petName = customName || locPet.name;
    const adoption = await EconomyManager.mutateProfileAtomically({
        userId, guildId, referenceId,
        mutate: profile => {
            const maxPets = profile.maxPets || 1;
            if ((profile.pets || []).length >= maxPets) return { success: false, reason: 'capacity', maxPets };
            const wallet = Number(profile.wallet) || 0;
            if (wallet < petData.price) return { success: false, reason: 'funds', wallet };
            const now = new Date();
            profile.wallet = wallet - petData.price;
            if (!Array.isArray(profile.pets)) profile.pets = [];
            profile.pets.push({
                petId: `${petId}_${referenceId}`, name: petName, type: petData.type, breed: petData.breed,
                securityLevel: petData.securityLevel, happiness: 50, health: 100, hunger: 50, cleanliness: 50,
                purchasePrice: petData.price, lastFed: now, lastGroomed: now, lastPlayed: now, dateAdopted: now
            });
            if (!Array.isArray(profile.transactions)) profile.transactions = [];
            profile.transactions.push({
                type: 'expense', amount: petData.price,
                description: lang.txAdoptedPet({ name: petName, breed: petData.breed }).toString(), category: 'pet', timestamp: now
            });
            return { petName, maxPets };
        }
    });
    if (!adoption.success) {
        if (adoption.reason === 'capacity') return { error: 'capacity', card: cards.warning(lang.capacityReachedTitle, lang.capacityReachedDesc({ max: adoption.maxPets })) };
        if (adoption.reason === 'duplicate') return { error: 'duplicate', card: cards.info(lang.closedTitle, lang.closedDesc) };
        const wallet = adoption.wallet || 0;
        return { error: 'funds', card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({
            name: locPet.name, price: petData.price.toLocaleString(), wallet: wallet.toLocaleString(), shortage: Math.max(0, petData.price - wallet).toLocaleString()
        })) };
    }
    const profile = adoption.profile;
    const maxPets = adoption.maxPets;

    const newSecurityLevel = EconomyManager.calculateSecurityLevel(profile);

    const card = buildCard({
        title: lang.successTitle,
        accentColor: ACCENT.success
    })
        .addText(`> **${lang.successSubtitle}**\n${lang.successAdoptDesc({ name: petName, breed: petData.breed, price: petData.price.toLocaleString() })}`)
        .addSeparator()
        .addText(`### ${lang.profileTitle}`)
        .addText(
            `**🐾 ${lang.petNameLabel}:** \`${petName}\` (${petData.breed})\n` +
            `**🏷️ ${lang.petTypeLabel}:** \`${petData.type}\` • **🛡️ ${lang.petSecurityRating}:** \`${petData.securityLevel}/100\`\n` +
            `**❤️ ${lang.happinessLabel}:** \`50%\` • **🏥 ${lang.healthLabel}:** \`100%\` • **🍽️ ${lang.hungerLabel}:** \`50%\``
        )
        .addSeparator()
        .addText(`### ${lang.securityTitle}`)
        .addText(
            `**🔒 ${lang.robberyBoostLabel}:** \`+${petData.securityLevel}%\`\n` +
            `**📊 ${lang.homeSecurityLabel}:** \`${newSecurityLevel}%\`\n` +
            `**🐾 ${lang.petsOwnedLabel}:** \`${profile.pets.length}/${maxPets}\``
        )
        .addSeparator()
        .addText(`### ${lang.summaryTitle}`)
        .addText(
            `**💰 ${lang.adoptionFeeLabel}:** \`$${petData.price.toLocaleString()}\`\n` +
            `**💳 ${lang.remainingWalletLabel}:** \`$${profile.wallet.toLocaleString()}\``
        );

    const resultRows = [
        new ActionRowBuilder().addComponents(
            btn.primary('buypet_view_pets', lang.btnViewPets),
            btn.secondary('buypet_close', lang.btnClose)
        )
    ];

    return { success: true, card, rows: resultRows, profile };
}

module.exports = {
    name: 'buypet',
    aliases: ['pet-buy', 'adopt', 'adoptpet'],
    description: lang.cmdDesc.toString(),
    usage: '!buypet [pet_id] [name]',
    async execute(message, args) {
        try {
            
            if (args[0]) {
                const petId = args[0].toLowerCase();
                const petName = args.slice(1).join(' ').trim() || null;
                const result = await processPetAdoption(message.author.id, message.guild.id, petId, petName, `buypet:${message.id}`);
                if (result.rows) {
                    const sentMsg = await sendV2(message, { card: result.card, rows: result.rows });
                    if (!sentMsg) return;
                    const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                    collector.on('collect', async (interaction) => {
                        try {
                            if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                            await interaction.deferUpdate();
                            if (interaction.customId === 'buypet_close') {
                                collector.stop('user_closed');
                                return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                            }
                            if (interaction.customId === 'buypet_view_pets') {
                                collector.stop('view_pets');
                                const petsCmd = require('./pets');
                                return petsCmd.execute(message, []);
                            }
                        } catch (err) {
                            console.error('Error in direct buypet collector:', err);
                        }
                    });
                    collector.on('end', (_, reason) => {
                        if (reason === 'time') {
                            editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                        }
                    });
                    return;
                }
                return sendV2(message, result.card);
            }

            
            const profile = await EconomyManager.getProfile(message.author.id, message.guild.id);
            const card = buildPetCatalogCard();
            const rows = buildPetCatalogActionRows(profile);

            const sentMessage = await sendV2(message, { card, rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({
                time: 60000
            });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) {
                        return replyUnauthorized(interaction);
                    }

                    await interaction.deferUpdate();

                    if (interaction.customId === 'buypet_close') {
                        collector.stop('user_closed');
                        const closedCard = cards.info(lang.closedTitle, lang.closedDesc);
                        return editV2(sentMessage, { card: closedCard, rows: [] });
                    }

                    if (interaction.customId === 'buypet_view_pets') {
                        collector.stop('view_pets');
                        const petsCmd = require('./pets');
                        return petsCmd.execute(message, []);
                    }

                    if (interaction.customId === 'buypet_select') {
                        const selectedPetId = interaction.values[0];
                        const result = await processPetAdoption(message.author.id, message.guild.id, selectedPetId, null, `buypet:${interaction.id}`);

                        if (result.error) {
                            return editV2(sentMessage, {
                                card: result.card,
                                rows: [new ActionRowBuilder().addComponents(btn.secondary('buypet_close', lang.btnClose))]
                            });
                        }

                        return editV2(sentMessage, { card: result.card, rows: result.rows });
                    }
                } catch (err) {
                    console.error('Error in buypet catalog collector:', err);
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    const expiredCard = cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc);
                    editV2(sentMessage, { card: expiredCard, rows: [] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error('Error in buypet command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
