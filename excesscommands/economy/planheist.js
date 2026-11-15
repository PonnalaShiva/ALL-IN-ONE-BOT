'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager, Heist } = require('../../models/economy/economy');
const { HEIST_TARGETS, HEIST_EQUIPMENT } = require('../../models/economy/constants/businessData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.planheist);

function buildTargetsCatalogCard() {
    const targetsList = Object.entries(HEIST_TARGETS).map(([id, target]) => {
        const locTarget = resolveEntity('heist_targets', id, target);
        const payoutStr = `$${(target.payout[0] || 1000).toLocaleString()} – $${(target.payout[1] || 5000).toLocaleString()}`;
        return lang.targetItemLine({
            id,
            name: locTarget.name,
            diff: target.difficulty,
            payout: payoutStr,
            odds: target.successChance,
            crew: target.requiredMembers,
            roles: target.requiredRoles.join(', '),
            window: target.planningTime,
            heat: target.minHeatLevel || 0
        });
    }).join('\n\n');

    const card = buildCard({
        title: lang.targetsTitle,
        accentColor: ACCENT.danger
    })
        .addText(`${lang.targetsIntro}\n`)
        .addSeparator()
        .addText(lang.targetsSectionHeader)
        .addText(targetsList)
        .addSeparator()
        .addText(`### ${lang.howToPlanHeader}`)
        .addText(lang.howToPlanDesc);

    return card;
}

function buildTargetsActionRows() {
    const selectOptions = Object.entries(HEIST_TARGETS).map(([id, target]) => {
        const locTarget = resolveEntity('heist_targets', id, target);
        return {
            label: locTarget.name,
            value: id,
            description: lang.targetOptionDesc({
                diff: target.difficulty,
                crew: target.requiredMembers,
                odds: target.successChance
            }).toString()
        };
    });

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('planheist_select')
            .setPlaceholder(lang.selectPlaceholder.toString())
            .addOptions(selectOptions)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.danger('planheist_close', lang.btnClose)
    );

    return [menuRow, btnRow];
}

async function processHeistPlanning(guild, author, channel, targetType) {
    const targetData = HEIST_TARGETS[targetType];
    if (!targetData) {
        return {
            error: 'invalid_target',
            card: cards.warning(
                lang.invalidTargetTitle,
                lang.invalidTargetDesc({ target: targetType })
            )
        };
    }

    const locTarget = resolveEntity('heist_targets', targetType, targetData);
    let profile = await EconomyManager.getProfile(author.id, guild.id);

    
    if (profile.jailTime && new Date(profile.jailTime) > new Date()) {
        const hoursLeft = Math.ceil((new Date(profile.jailTime) - new Date()) / (1000 * 60 * 60));
        return {
            error: 'incarcerated',
            card: cards.warning(
                lang.incarceratedTitle,
                lang.incarceratedDesc({
                    hours: hoursLeft,
                    release: new Date(profile.jailTime).toLocaleString()
                })
            )
        };
    }

    
    if ((profile.heatLevel || 0) < (targetData.minHeatLevel || 0)) {
        return {
            error: 'heat',
            card: cards.warning(
                lang.insufficientHeatTitle,
                lang.insufficientHeatDesc({
                    name: locTarget.name,
                    minHeat: targetData.minHeatLevel,
                    heat: profile.heatLevel || 0
                })
            )
        };
    }

    
    const existingHeist = await Heist.findOne({
        plannerUserId: author.id,
        guildId: guild.id,
        status: { $in: ['planning', 'recruiting', 'ready'] }
    });

    if (existingHeist) {
        const currentLocTarget = resolveEntity('heist_targets', existingHeist.targetType, { name: existingHeist.targetName });
        return {
            error: 'existing',
            card: cards.warning(
                lang.operationInProgressTitle,
                lang.operationInProgressDesc({
                    name: currentLocTarget.name,
                    id: existingHeist.heistId,
                    status: existingHeist.status.toUpperCase(),
                    current: (existingHeist.members || []).length,
                    required: existingHeist.requiredMembers
                })
            )
        };
    }

    
    const totalEquipmentCost = (targetData.requiredEquipment || []).reduce((sum, eqId) => {
        const eq = HEIST_EQUIPMENT[eqId];
        return sum + (eq ? eq.price : 0);
    }, 0);

    const initialCost = Math.floor(totalEquipmentCost * 0.25);
    const wallet = profile.wallet || 0;

    if (wallet < initialCost) {
        return {
            error: 'funds',
            card: cards.warning(
                lang.insufficientCapitalTitle,
                lang.insufficientCapitalDesc({
                    name: locTarget.name,
                    cost: initialCost.toLocaleString(),
                    wallet: wallet.toLocaleString(),
                    deficit: (initialCost - wallet).toLocaleString()
                })
            )
        };
    }

    const heistId = `HEIST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + (targetData.planningTime || 24) * 60 * 60 * 1000);
    const heistData = {
        heistId,
        guildId: guild.id,
        plannerUserId: author.id,
        plannerUsername: author.username,
        targetType,
        targetName: locTarget.name,
        difficulty: targetData.difficulty,
        successChance: targetData.successChance,
        payoutMin: targetData.payout[0],
        payoutMax: targetData.payout[1],
        requiredMembers: targetData.requiredMembers,
        requiredRoles: targetData.requiredRoles,
        status: 'recruiting',
        expiresAt,
        members: [{
            userId: author.id,
            username: author.username,
            role: 'mastermind',
            cut: Math.floor(100 / targetData.requiredMembers) + (100 % targetData.requiredMembers),
            joinedAt: new Date()
        }],
        equipment: (targetData.requiredEquipment || []).map(eqId => ({
            id: eqId,
            name: HEIST_EQUIPMENT[eqId]?.name || eqId,
            provided: false,
            providedBy: null
        }))
    };
    const planning = await EconomyManager.mutateProfileAtomically({ userId: author.id, guildId: guild.id, referenceId: `heist-plan:${guild.id}:${heistId}`, mutate: async (current, { session }) => {
        const active = await Heist.findOne({ plannerUserId: author.id, guildId: guild.id, status: { $in: ['planning', 'recruiting', 'ready'] } }).session(session);
        if (active) return { success: false, error: 'existing' };
        if (current.jailTime && new Date(current.jailTime) > new Date()) return { success: false, error: 'incarcerated' };
        if ((current.heatLevel || 0) < (targetData.minHeatLevel || 0)) return { success: false, error: 'heat' };
        if ((current.wallet || 0) < initialCost) return { success: false, error: 'funds' };
        current.wallet -= initialCost;
        current.transactions.push({ type: 'expense', amount: initialCost, description: lang.txMissionPlanning({ name: locTarget.name }).toString(), category: 'heist', timestamp: new Date() });
        const [created] = await Heist.create([heistData], { session });
        return { heist: created };
    }});
    if (!planning.success) {
        const fresh = planning.profile;
        const error = planning.error || 'failed';
        if (error === 'funds') return { error, card: cards.warning(lang.insufficientCapitalTitle, lang.insufficientCapitalDesc({ name: locTarget.name, cost: initialCost.toLocaleString(), wallet: (fresh.wallet||0).toLocaleString(), deficit: Math.max(0, initialCost-(fresh.wallet||0)).toLocaleString() })) };
        if (error === 'heat') return { error, card: cards.warning(lang.insufficientHeatTitle, lang.insufficientHeatDesc({ name: locTarget.name, minHeat: targetData.minHeatLevel, heat: fresh.heatLevel||0 })) };
        if (error === 'incarcerated') return { error, card: cards.warning(lang.incarceratedTitle, lang.incarceratedDesc({ hours: Math.ceil((new Date(fresh.jailTime)-Date.now())/3600000), release: new Date(fresh.jailTime).toLocaleString() })) };
        const active = error === 'existing' ? await Heist.findOne({ plannerUserId: author.id, guildId: guild.id, status: { $in: ['planning', 'recruiting', 'ready'] } }) : null;
        return { error, card: active ? cards.warning(lang.operationInProgressTitle, lang.operationInProgressDesc({ name: active.targetName, id: active.heistId, status: active.status.toUpperCase(), current: active.members.length, required: active.requiredMembers })) : cards.warning(lang.operationInProgressTitle, lang.operationInProgressDesc({ name: locTarget.name, id: heistId, status: 'PROCESSING', current: 1, required: targetData.requiredMembers })) };
    }
    profile = planning.profile;

    const payoutRangeStr = `$${targetData.payout[0].toLocaleString()} – $${targetData.payout[1].toLocaleString()}`;
    const unfulfilledRoles = targetData.requiredRoles.filter(r => r !== 'mastermind');

    const blueprintCard = buildCard({
        title: lang.initiatedTitle({ name: locTarget.name }),
        accentColor: ACCENT.danger
    })
        .addText(`### ${lang.blueprintHeader}`)
        .addText(lang.blueprintDetails({
            id: heistId,
            name: locTarget.name,
            diff: targetData.difficulty,
            payout: payoutRangeStr,
            chance: targetData.successChance,
            cost: initialCost.toLocaleString(),
            wallet: profile.wallet.toLocaleString()
        }))
        .addSeparator()
        .addText(`### ${lang.crewManifestHeader}`)
        .addText(lang.crewManifestDetails({
            username: author.username,
            required: targetData.requiredMembers,
            roles: unfulfilledRoles.map(r => `\`${r}\``).join(', '),
            id: heistId
        }))
        .addSeparator()
        .addText(`### ${lang.nextStepsHeader}`)
        .addText(lang.nextStepsDesc);

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('planheist_heists', lang.btnViewHeists),
            btn.secondary('planheist_close', lang.btnClose)
        )
    ];

    return { error: null, card: blueprintCard, heist: planning.heist, rows };
}

module.exports = {
    name: 'planheist',
    aliases: ['heistplan', 'newheist', 'heistsetup'],
    description: lang.cmdDesc.toString(),
    usage: '!planheist [target_type]',
    cooldown: 8000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const targetType = args[0]?.toLowerCase();

            
            if (targetType) {
                const result = await processHeistPlanning(message.guild, message.author, message.channel, targetType);
                const rows = result.rows || [
                    new ActionRowBuilder().addComponents(
                        btn.danger('planheist_close', lang.btnClose)
                    )
                ];
                const sentMsg = await sendV2(message, { card: result.card, rows });
                if (!sentMsg) return;

                const directCollector = sentMsg.createMessageComponentCollector({ time: 60000 });
                directCollector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'planheist_close') {
                            directCollector.stop('user_closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'planheist_heists') {
                            directCollector.stop('heists');
                            const heistCmd = require('./heist');
                            return heistCmd.execute(message, []);
                        }
                    } catch (err) {
                        console.error('Error in planheist direct collector:', err);
                    }
                });
                directCollector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return;
            }

            
            const initialCard = buildTargetsCatalogCard();
            const initialRows = buildTargetsActionRows();

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'planheist_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'planheist_heists') {
                        collector.stop('heists');
                        const heistCmd = require('./heist');
                        return heistCmd.execute(message, []);
                    }

                    if (interaction.customId === 'planheist_select') {
                        const chosenTarget = interaction.values[0];
                        const result = await processHeistPlanning(message.guild, message.author, message.channel, chosenTarget);
                        const finishRows = result.rows || [
                            new ActionRowBuilder().addComponents(
                                btn.danger('planheist_close', lang.btnClose)
                            )
                        ];
                        return editV2(sentMessage, { card: result.card, rows: finishRows });
                    }
                } catch (err) {
                    console.error('Error in planheist interactive collector:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in planheist command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
