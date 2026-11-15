'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { PETS } = require('../../models/economy/constants/gameData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.petcare);

const COSTS = {
    feed: 50,
    groom: 100,
    play: 25,
    all: 175
};

function buildTerminalCard(pet, selectedIndex, totalPets, alertText = null) {
    const eff = Math.min(100, Math.floor(((pet.happiness ?? 100) + (pet.health ?? 100) + (pet.cleanliness ?? 100)) / 3));
    const locPet = resolveEntity('pets', pet.type, pet);

    const card = buildCard({
        title: lang.title,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.subtitle}**`)
        .addSeparator();

    if (alertText) {
        card.addText(alertText).addSeparator();
    }

    card.addText(`### ${lang.terminalHeader({ name: pet.name || locPet.name, breed: pet.breed || locPet.name || lang.defaultBreed.toString() })}`)
        .addText(lang.terminalStats({
            security: pet.securityLevel || 50,
            efficiency: eff,
            happiness: pet.happiness ?? 100,
            health: pet.health ?? 100,
            cleanliness: pet.cleanliness ?? 100,
            hunger: pet.hunger ?? 50
        }))
        .addSeparator()
        .addText(lang.companionIndexIndicator({ current: selectedIndex + 1, total: totalPets }));

    return card;
}

function buildTerminalActionRows(pets, selectedIndex, wallet) {
    const rows = [];

    if (pets.length > 1) {
        const options = pets.slice(0, 25).map((p, idx) => {
            const loc = resolveEntity('pets', p.type, p);
            return {
                label: p.name || loc.name,
                value: String(idx),
                description: lang.petOptionDesc({
                    breed: p.breed || loc.name || lang.defaultBreed.toString(),
                    security: p.securityLevel || 50
                }).toString(),
                default: idx === selectedIndex
            };
        });

        rows.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('petcare_select_pet')
                    .setPlaceholder(lang.selectPetPlaceholder.toString())
                    .addOptions(options)
            )
        );
    }

    rows.push(
        new ActionRowBuilder().addComponents(
            btn.primary('petcare_feed', lang.btnFeed).setDisabled(wallet < COSTS.feed),
            btn.primary('petcare_groom', lang.btnGroom).setDisabled(wallet < COSTS.groom),
            btn.primary('petcare_play', lang.btnPlay).setDisabled(wallet < COSTS.play),
            btn.success('petcare_all', lang.btnAll).setDisabled(wallet < COSTS.all),
            btn.danger('petcare_close', lang.btnClose)
        )
    );

    return rows;
}

async function executeCare(profile, petIndex, action, referenceId) {
    const cost = COSTS[action];
    const mutation = await EconomyManager.mutateProfileAtomically({
        userId: profile.userId,
        guildId: profile.guildId,
        referenceId,
        mutate: async current => {
            const pet = (current.pets || [])[petIndex];
            if (!pet) return { success: false, error: 'pet_missing', card: cards.warning(lang.invalidSlotTitle, lang.invalidSlotDesc({ max: (current.pets || []).length, roster: '' })) };
            if ((current.wallet || 0) < cost) return { success: false, error: 'funds', card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ action, name: pet.name || pet.type, cost, wallet: (current.wallet || 0).toLocaleString(), deficit: (cost - (current.wallet || 0)).toLocaleString() })) };
            const locPet = resolveEntity('pets', pet.type, pet);
            const before = { hunger: pet.hunger ?? 50, health: pet.health ?? 100, cleanliness: pet.cleanliness ?? 50, happiness: pet.happiness ?? 50 };
            current.wallet -= cost;
            const now = new Date();
            if (action === 'feed' || action === 'all') { pet.hunger = Math.max(0, (pet.hunger ?? 50) - 30); pet.health = Math.min(100, (pet.health ?? 100) + 5); pet.lastFed = now; }
            if (action === 'groom' || action === 'all') { pet.cleanliness = Math.min(100, (pet.cleanliness ?? 50) + 40); pet.happiness = Math.min(100, (pet.happiness ?? 50) + 10); pet.lastGroomed = now; }
            if (action === 'play' || action === 'all') { pet.happiness = Math.min(100, (pet.happiness ?? 50) + 25); pet.health = Math.min(100, (pet.health ?? 100) + 5); pet.lastPlayed = now; }
            current.transactions.push({ type: 'expense', amount: cost, description: lang.txPetCare({ action, name: pet.name || locPet.name }).toString(), category: 'pet', timestamp: now });
            return { petIndex, before };
        }
    });
    if (!mutation?.success) return mutation?.card || cards.warning(lang.errorTitle, lang.errorMessage);
    profile = mutation.profile;
    const pet = profile.pets[petIndex];
    const { before } = mutation;
    const locPet = resolveEntity('pets', pet.type, pet);

    const eff = Math.min(100, Math.floor(((pet.happiness ?? 100) + (pet.health ?? 100) + (pet.cleanliness ?? 100)) / 3));

    const card = buildCard({
        title: lang.careSuccessTitle({ name: pet.name || locPet.name }),
        accentColor: ACCENT.success
    })
        .addText(`### ${lang.sessionHeader({ action: action.toUpperCase() })}`)
        .addText(lang.sessionOverview({
            name: pet.name || locPet.name,
            breed: pet.breed || locPet.name || lang.defaultBreed.toString(),
            cost,
            wallet: (profile.wallet || 0).toLocaleString(),
            efficiency: eff,
            security: pet.securityLevel || 50
        }))
        .addSeparator()
        .addText(`### ${lang.enhancementsHeader}`);

    const enhancements = [];
    if (action === 'feed' || action === 'all') {
        enhancements.push(lang.hungerEnhance({ before: before.hunger, after: pet.hunger, diff: before.hunger - pet.hunger }));
    }
    if (action === 'groom' || action === 'all') {
        enhancements.push(lang.cleanEnhance({ before: before.cleanliness, after: pet.cleanliness, diff: pet.cleanliness - before.cleanliness }));
    }
    if (action === 'play' || action === 'all') {
        enhancements.push(lang.happyEnhance({ before: before.happiness, after: pet.happiness, diff: pet.happiness - before.happiness }));
    }
    if (action === 'feed' || action === 'play' || action === 'all') {
        enhancements.push(lang.healthEnhance({ before: before.health, after: pet.health, diff: pet.health - before.health }));
    }

    card.addText(enhancements.join('\n'));

    return card;
}

module.exports = {
    name: 'petcare',
    aliases: ['carepet', 'feedpet', 'groompet'],
    description: lang.cmdDesc.toString(),
    usage: '!petcare [feed|groom|play|all] [slot#]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            let profile = await EconomyManager.getProfile(message.author.id, message.guild.id);
            const pets = profile.pets || [];

            if (pets.length === 0) {
                const emptyCard = cards.warning(lang.noPetsTitle, lang.noPetsDesc);
                const emptyRows = [
                    new ActionRowBuilder().addComponents(
                        btn.danger('petcare_close', lang.btnClose)
                    )
                ];
                return sendWithCloseCollector(message, { card: emptyCard, rows: emptyRows }, message.author.id);
            }

            const actionArg = args[0]?.toLowerCase();
            const slotArg = args[1] ? parseInt(args[1], 10) - 1 : 0;

            
            if (actionArg && COSTS[actionArg]) {
                if (isNaN(slotArg) || slotArg < 0 || slotArg >= pets.length) {
                    const roster = pets.map((p, i) => {
                        const loc = resolveEntity('pets', p.type, p);
                        return `> \`#${i + 1}\` **${p.name || loc.name}** (${p.breed || loc.name || lang.defaultBreed.toString()})`;
                    }).join('\n');
                    return sendV2(message, cards.warning(lang.invalidSlotTitle, lang.invalidSlotDesc({ max: pets.length, roster })));
                }

                const targetPet = pets[slotArg];
                const locTarget = resolveEntity('pets', targetPet.type, targetPet);
                const cost = COSTS[actionArg];
                const wallet = profile.wallet || 0;

                if (wallet < cost) {
                    return sendV2(message, cards.warning(
                        lang.insufficientFundsTitle,
                        lang.insufficientFundsDesc({
                            action: actionArg,
                            name: targetPet.name || locTarget.name,
                            cost,
                            wallet: wallet.toLocaleString(),
                            deficit: (cost - wallet).toLocaleString()
                        })
                    ));
                }

                const resultCard = await executeCare(profile, slotArg, actionArg, `pet-care:${message.id}`);
                const rows = [new ActionRowBuilder().addComponents(btn.secondary('petcare_close', lang.btnClose))];
                return sendWithCloseCollector(message, { card: resultCard, rows }, message.author.id);
            }

            
            let selectedIndex = 0;
            const currentPet = pets[selectedIndex];
            const initialCard = buildTerminalCard(currentPet, selectedIndex, pets.length);
            const initialRows = buildTerminalActionRows(pets, selectedIndex, profile.wallet || 0);

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 90000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'petcare_close') {
                        collector.stop('user_closed');
                        return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }

                    if (interaction.customId === 'petcare_select_pet') {
                        selectedIndex = parseInt(interaction.values[0], 10);
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const selPet = freshProfile.pets[selectedIndex] || freshProfile.pets[0];
                        const updatedCard = buildTerminalCard(selPet, selectedIndex, freshProfile.pets.length);
                        const updatedRows = buildTerminalActionRows(freshProfile.pets, selectedIndex, freshProfile.wallet || 0);
                        return editV2(sentMessage, { card: updatedCard, rows: updatedRows });
                    }

                    const actionMap = {
                        petcare_feed: 'feed',
                        petcare_groom: 'groom',
                        petcare_play: 'play',
                        petcare_all: 'all'
                    };

                    const chosenAction = actionMap[interaction.customId];
                    if (chosenAction) {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const pList = freshProfile.pets || [];
                        const activePet = pList[selectedIndex];
                        const loc = resolveEntity('pets', activePet.type, activePet);
                        const cost = COSTS[chosenAction];

                        if ((freshProfile.wallet || 0) < cost) {
                            const alert = `> ⚠️ **${lang.insufficientFundsDesc({ action: chosenAction, name: activePet.name || loc.name, cost, wallet: (freshProfile.wallet || 0).toLocaleString(), deficit: (cost - (freshProfile.wallet || 0)).toLocaleString() })}**`;
                            const freshCard = buildTerminalCard(activePet, selectedIndex, pList.length, alert);
                            const freshRows = buildTerminalActionRows(pList, selectedIndex, freshProfile.wallet || 0);
                            return editV2(sentMessage, { card: freshCard, rows: freshRows });
                        }

                        const receiptCard = await executeCare(freshProfile, selectedIndex, chosenAction, `pet-care:${interaction.id}`);
                        const doneRows = [
                            new ActionRowBuilder().addComponents(
                                btn.primary('petcare_back', lang.title),
                                btn.danger('petcare_close', lang.btnClose)
                            )
                        ];
                        return editV2(sentMessage, { card: receiptCard, rows: doneRows });
                    }

                    if (interaction.customId === 'petcare_back') {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const pList = freshProfile.pets || [];
                        const selPet = pList[selectedIndex] || pList[0];
                        const updatedCard = buildTerminalCard(selPet, selectedIndex, pList.length);
                        const updatedRows = buildTerminalActionRows(pList, selectedIndex, freshProfile.wallet || 0);
                        return editV2(sentMessage, { card: updatedCard, rows: updatedRows });
                    }
                } catch (err) {
                    console.error('Error handling petcare interaction:', err);
                    editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in petcare command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
