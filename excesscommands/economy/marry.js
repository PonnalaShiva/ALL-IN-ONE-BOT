'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, sendWithCloseCollector, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.marry);

module.exports = {
    name: 'marry',
    aliases: ['marriage', 'wedding', 'propose'],
    description: lang.cmdDesc.toString(),
    usage: '!marry <@user> | !marry status | !marry divorce',
    cooldown: 5000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const profile = await EconomyManager.getProfile(userId, guildId);
            const action = args[0]?.toLowerCase();

            
            if (action === 'divorce') {
                if (!profile.marriedTo) {
                    return sendV2(message, cards.warning(lang.notMarriedTitle, lang.notMarriedDesc));
                }

                const partner = await message.client.users.fetch(profile.marriedTo).catch(() => null);
                const result = await EconomyManager.divorce(userId, guildId);
                if (!result.success) {
                    return sendV2(message, cards.error(lang.errorTitle, result.error || lang.errorMessage));
                }

                const card = buildCard({
                    title: lang.divorceSuccessTitle,
                    accentColor: ACCENT.neutral
                })
                    .addText(lang.divorceSuccessDesc({ partner: partner?.username || lang.defaultPartner.toString() }));

                const rows = [
                    new ActionRowBuilder().addComponents(
                        btn.secondary('marry_close', lang.btnClose)
                    )
                ];

                return sendWithCloseCollector(message, { card, rows }, userId);
            }

            
            if (action === 'status' || (!action && profile.marriedTo)) {
                if (!profile.marriedTo) {
                    const singleCard = buildCard({
                        title: lang.singleTitle,
                        accentColor: ACCENT.warning
                    })
                        .addText(lang.singleDesc);

                    const rows = [
                        new ActionRowBuilder().addComponents(
                            btn.secondary('marry_close', lang.btnClose)
                        )
                    ];
                    return sendWithCloseCollector(message, { card: singleCard, rows }, userId);
                }

                const partner = await message.client.users.fetch(profile.marriedTo).catch(() => null);
                const partnerName = partner?.username || lang.unknownPartner.toString();
                const marriageDays = profile.marriageDate
                    ? Math.max(0, Math.floor((Date.now() - new Date(profile.marriageDate).getTime()) / (86_400_000)))
                    : 0;

                const statusCard = buildCard({
                    title: lang.statusTitle,
                    accentColor: 0xE91E63
                })
                    .addText(`> **${lang.happilyMarried}**\n`)
                    .addText(
                        `**💞 ${lang.partnerLabel}:** \`${partnerName}\`\n` +
                        `**📅 ${lang.marriedDuration}:** \`${lang.daysFormat({ days: marriageDays })}\`\n` +
                        `**💰 ${lang.bonusLabel}:** \`+10%\`\n` +
                        `> ${lang.bonusDesc}`
                    );

                const statusRows = [
                    new ActionRowBuilder().addComponents(
                        btn.danger('marry_divorce_action', lang.btnDivorce),
                        btn.secondary('marry_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: statusCard, rows: statusRows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

                collector.on('collect', async (interaction) => {
            try {    
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                        if (interaction.customId === 'marry_close') {
                            collector.stop('user_closed');
                            return closeAndAutoDelete(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                        }
    
                        if (interaction.customId === 'marry_divorce_action') {
                            collector.stop('divorced');
                            const result = await EconomyManager.divorce(userId, guildId);
                            if (!result.success) {
                                return editV2(sentMessage, cards.error(lang.errorTitle, result.error || lang.errorMessage));
                            }
                            const divorcedCard = buildCard({
                                title: lang.divorceSuccessTitle,
                                accentColor: ACCENT.neutral
                            }).addText(lang.divorceSuccessDesc({ partner: partnerName }));
                            return editV2(sentMessage, { card: divorcedCard, rows: [] });
                        }
            } catch (err) {
                console.error('[marry.js] Error in component collector:', err);
            }
        });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            }

            
            const target = message.mentions.users.first();
            if (!target) {
                const helpCard = buildCard({
                    title: lang.helpTitle,
                    accentColor: ACCENT.primary
                })
                    .addText(lang.helpDesc);

                const rows = [
                    new ActionRowBuilder().addComponents(
                        btn.secondary('marry_close', lang.btnClose)
                    )
                ];
                return sendWithCloseCollector(message, { card: helpCard, rows }, userId);
            }

            
            if (target.id === userId) {
                return sendV2(message, cards.warning(lang.cannotMarrySelfTitle, lang.cannotMarrySelfDesc));
            }

            if (target.bot) {
                return sendV2(message, cards.warning(lang.noBotTitle, lang.noBotDesc));
            }

            if (profile.marriedTo) {
                const currentSpouse = await message.client.users.fetch(profile.marriedTo).catch(() => null);
                return sendV2(message, cards.warning(
                    lang.alreadyMarriedTitle,
                    lang.alreadyMarriedDesc({ spouse: currentSpouse?.username || lang.someoneElse.toString() })
                ));
            }

            const targetProfile = await EconomyManager.getProfile(target.id, guildId);
            if (targetProfile.marriedTo) {
                return sendV2(message, cards.warning(
                    lang.partnerAlreadyMarriedTitle,
                    lang.partnerAlreadyMarriedDesc({ target: target.username })
                ));
            }

            const weddingFee = 5000;
            if ((profile.wallet || 0) < weddingFee) {
                return sendV2(message, cards.warning(
                    lang.insufficientFundsTitle,
                    lang.insufficientFundsDesc
                ));
            }

            
            const proposalCard = buildCard({
                title: lang.proposalTitle,
                accentColor: 0xE91E63
            })
                .addText(lang.proposalDesc({
                    proposer: message.author.username,
                    target: target.username
                }));

            const proposalRows = [
                new ActionRowBuilder().addComponents(
                    btn.success('marry_accept', lang.btnAccept),
                    btn.danger('marry_decline', lang.btnDecline)
                )
            ];

            const proposalMessage = await sendV2(message, { card: proposalCard, rows: proposalRows });
            if (!proposalMessage) return;

            const collector = proposalMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.customId === 'marry_close') {
                        if (interaction.user.id !== target.id && interaction.user.id !== userId) {
                            return replyUnauthorized(interaction);
                        }
                        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
                        collector.stop('user_closed');
                        return closeAndAutoDelete(proposalMessage, cards.info(lang.closedTitle, lang.closedDesc));
                    }

                    if (interaction.user.id !== target.id) {
                        return replyUnauthorized(interaction);
                    }

                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();

                    if (interaction.customId === 'marry_decline') {
                        collector.stop('declined');
                        const declinedCard = buildCard({
                            title: lang.proposalDeclinedTitle,
                            accentColor: ACCENT.neutral
                        }).addText(lang.proposalDeclinedDesc({ target: target.username }));
                        return editV2(proposalMessage, { card: declinedCard, rows: [] });
                    }

                    if (interaction.customId === 'marry_accept') {
                        const result = await EconomyManager.marry(userId, guildId, target.id);
                        if (!result.success) {
                            collector.stop('failed');
                            return editV2(proposalMessage, {
                                card: cards.error(lang.errorTitle, result.error || lang.errorMessage),
                                rows: []
                            });
                        }

                        const acceptCard = buildCard({
                            title: lang.proposalAcceptedTitle,
                            accentColor: 0xE91E63
                        })
                            .addText(lang.proposalAcceptedDesc({
                                user1: message.author.username,
                                user2: target.username,
                                cost: result.cost.toLocaleString()
                            }));

                        
                        const newProfile = await EconomyManager.getProfile(userId, guildId);
                        const newAchievements = await EconomyManager.checkAchievements(newProfile);
                        if (newAchievements.length > 0) {
                            const achText = newAchievements.map(a => `${a.emoji} **${a.name}** — ${a.description} (+$${a.reward})`).join('\n');
                            acceptCard.addSeparator().addText(`### ${lang.achievementHeader}\n${achText}`);
                        }

                        const finishRows = [
                            new ActionRowBuilder().addComponents(
                                btn.secondary('marry_close', lang.btnClose)
                            )
                        ];

                        return editV2(proposalMessage, { card: acceptCard, rows: finishRows });
                    }
                } catch (err) {
                    console.error('Error in marry proposal collector:', err);
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(proposalMessage, {
                        card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc),
                        rows: []
                    }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in marry command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
