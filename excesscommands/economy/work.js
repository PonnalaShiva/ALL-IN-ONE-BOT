'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.work);

function buildWorkCard(profile, personalEarnings, familyEarnings, totalEarnings, workMultiplier, leveledUp, requiredXP, hasProperty, notification = null) {
    const subtitle = leveledUp ? lang.subtitleLevelUp : lang.subtitleComplete;

    const card = buildCard({
        title: lang.title,
        accentColor: leveledUp ? ACCENT.economy : ACCENT.success
    });

    if (notification) {
        card.addText(`> ${notification}`).addSeparator();
    } else {
        card.addText(
            `> **${subtitle}**\n` +
            `> ${lang.workCompleteDesc}` +
            (leveledUp ? `\n> ${lang.levelUpBonusDesc}` : '')
        ).addSeparator();
    }

    card.addText(`### ${lang.earningsTitle}`)
        .addText(
            `**💼 ${lang.personalLabel}:** \`$${personalEarnings.toLocaleString()}\`\n` +
            `**👨‍👩‍👧‍👦 ${lang.familyLabel}:** \`$${Math.floor(familyEarnings).toLocaleString()}\`\n` +
            `**💎 ${lang.totalLabel}:** \`$${totalEarnings.toLocaleString()}\`\n` +
            `**📈 ${lang.multiplierLabel}:** \`${workMultiplier.toFixed(2)}x\`\n` +
            `**⭐ ${lang.xpLabel}:** \`+25 XP\`\n` +
            `**💳 ${lang.walletLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\``
        )
        .addSeparator();

    if (leveledUp) {
        card.addText(`### ${lang.levelUpTitle}`)
            .addText(lang.levelUpDesc({ level: profile.level }))
            .addText(
                `**🆙 ${lang.newLevelLabel}:** \`${profile.level}\`\n` +
                `**🔄 ${lang.xpResetLabel}:** \`0 / ${profile.level * 100} XP\``
            );
    } else {
        card.addText(`### ${lang.progressTitle}`)
            .addText(
                `**🏆 ${lang.levelLabel}:** \`${profile.level}\`\n` +
                `**⭐ ${lang.experienceLabel}:** \`${profile.experience} / ${requiredXP} XP\`\n` +
                `**📈 ${lang.progressLabel}:** \`${((profile.experience / requiredXP) * 100).toFixed(1)}%\`\n` +
                `**🎯 ${lang.xpNeededLabel}:** \`${requiredXP - profile.experience} XP\``
            );
    }

    if ((profile.familyMembers || []).length > 0) {
        card.addSeparator();
        if (hasProperty) {
            const details = profile.familyMembers.slice(0, 3).map(m => {
                const contrib = Math.floor(m.salary * m.workEfficiency * (m.bond / 100));
                return `**${m.name}** (${m.relationship})\n> **${lang.contributionLabel}:** \`$${contrib.toLocaleString()}\` • **${lang.bondLabel}:** \`${m.bond}%\``;
            }).join('\n\n');

            card.addText(`### ${lang.familyTitle}`)
                .addText(details);
        } else {
            card.addText(`### ${lang.familyNeedsHousingTitle}`)
                .addText(lang.familyNeedsHousingDesc({ count: profile.familyMembers.length }));
        }
    }

    return card;
}

module.exports = {
    name: 'work',
    aliases: ['job', 'shift'],
    description: lang.cmdDesc.toString(),
    usage: '!work',
    async execute(message) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const result = await EconomyManager.claimWorkReward(userId, guildId, lang.txWorkEarnings.toString());
            if (!result.success) {
                const timeLeft = Math.max(0, new Date(result.nextWork).getTime() - Date.now());
                const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                const nextTime = new Date(result.nextWork).toLocaleTimeString();
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ hours, minutes, nextTime })
                ));
            }

            let profile = result.profile;
            const { personalEarnings, familyEarnings, totalEarnings, workMultiplier, leveledUp, requiredXP, hasProperty } = result;

            const initialCard = buildWorkCard(profile, personalEarnings, familyEarnings, totalEarnings, workMultiplier, leveledUp, requiredXP, hasProperty);

            const bankLimit = EconomyManager.getBankLimit(profile);
            const canDeposit = (profile.wallet || 0) > 0 && (profile.bank || 0) < bankLimit;

            const row = new ActionRowBuilder().addComponents(
                btn.success('work_dep', lang.btnDeposit).setDisabled(!canDeposit),
                btn.danger('work_close', lang.btnClose)
            );

            const sentMessage = await sendV2(message, {
                card: initialCard,
                rows: [row]
            });

            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async (interaction) => {
                try {    
                    if (interaction.user.id !== message.author.id) {
                        return replyUnauthorized(interaction);
                    }
    
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'work_dep') {
                        const deposit = await EconomyManager.transferBank({
                            userId, guildId, direction: 'deposit', amount: 'all',
                            referenceId: `work-deposit:${interaction.id}`,
                            description: lang.txInstantDeposit.toString()});
                    if (deposit.success) {
                        profile = deposit.profile;

                        const updatedCard = buildWorkCard(
                            profile,
                            personalEarnings,
                            familyEarnings,
                            totalEarnings,
                            workMultiplier,
                            leveledUp,
                            requiredXP,
                            hasProperty,
                            lang.depositDone({ amount: deposit.amount.toLocaleString() })
                        );

                        const disabledRow = new ActionRowBuilder().addComponents(
                            btn.success('work_dep', lang.btnDeposit).setDisabled(true),
                            btn.danger('work_close', lang.btnClose)
                        );

                        await editV2(sentMessage, {
                            card: updatedCard,
                            rows: [disabledRow]
                        });
                    }
                } else if (interaction.customId === 'work_close') {
                    collector.stop('closed');
                    return editV2(sentMessage, cards.info(lang.closedTitle, lang.closedDesc));
                }
            
                } catch (err) {
                    console.error('[work.js] Error in component collector:', err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const disabledRow = new ActionRowBuilder().addComponents(
                    btn.success('work_dep', lang.btnDeposit).setDisabled(true),
                    btn.danger('work_close', lang.btnClose).setDisabled(true)
                );
                await editV2(sentMessage, {
                    card: initialCard,
                    rows: [disabledRow]
                }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in work command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
