'use strict';

const { randomUUID } = require('node:crypto');

const {
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    ButtonBuilder,
    ButtonStyle,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');

const { getApplication } = require('../models/applications/controller');
const ApplicationDecision = require('../models/applications/ApplicationDecision');
const checkPermissions = require('../utils/checkPermissions');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const defaultLang = require('../languages/default');
const { registerInteractionHandler, runWithinAcknowledgementWindow } = require('../utils/interactionRouter');


function getLang(guildId) {
    try {
        const loadLanguage = require('../events/loadLanguage');
        const lang = loadLanguage(guildId);
        return lang.applications || defaultLang.applications;
    } catch {
        return defaultLang.applications;
    }
}


const inFlightApplications = new Set();

function buildAnswerDisplays(answers, questions, noAnswerText) {
    return answers.map((answer, index) => {
        const question = questions[index]?.text || `Question ${index + 1}`;
        const safeAnswer = String(answer || noAnswerText).slice(0, 3800);
        return `**Q${index + 1}: ${question}**\n> ${safeAnswer}`;
    });
}

async function sendApplicationDecisionDM(applicantUser, payload, targetUserId) {
    try {
        await applicantUser.send(payload);
        return true;
    } catch (error) {
        console.warn(`[ApplicationsHandler] Could not DM user ${targetUserId}:`, error.message);
        return false;
    }
}

async function claimApplicationDecision({ reviewMessageId, targetUserId, appName, action, moderatorId }) {
    const now = new Date();
    const claimToken = randomUUID();
    try {
        const claim = await ApplicationDecision.findOneAndUpdate(
            { reviewMessageId, completed: { $ne: true }, leaseUntil: { $lt: now } },
            {
                $set: {
                    targetUserId,
                    appName,
                    action,
                    moderatorId,
                    claimToken,
                    completed: false,
                    leaseUntil: new Date(now.getTime() + 5 * 60 * 1000)
                }
            },
            { returnDocument: 'after', upsert: true }
        );
        return { claimed: Boolean(claim), completed: false, claimToken: claim ? claimToken : null };
    } catch (error) {
        if (error.code !== 11000) throw error;
        const existing = await ApplicationDecision.findOne({ reviewMessageId });
        return { claimed: false, completed: Boolean(existing?.completed), claimToken: null };
    }
}

module.exports = (client) => {
    
    const onReady = async () => {
        try {
            const Application = require('../models/applications/applications');
            const cacheManager = require('../utils/cacheManager');
            const apps = await Application.find({}).lean();
            for (const app of apps) {
                const cacheKey = `${app.guildId}:${app.appName}`;
                cacheManager.set('applications', cacheKey, app);
            }
        } catch (err) {
            console.error('[ApplicationsCache] Error pre-heating cache:', err);
        }
    };
    client.on('clientReady', onReady);

    const unregisterInteractionRoute = registerInteractionHandler(client, {
        name: 'applications',
        prefixes: ['open_application_modal_', 'application_form_', 'accept_application_', 'deny_application_'],
        types: ['button', 'modal'],
        handler: async (interaction) => {
        const guildId = interaction.guild?.id;
        if (!guildId) return;

        const lang = getLang(guildId);

        if (interaction.isButton() && interaction.customId.startsWith('open_application_modal_')) {
            try {
                
                const appName = interaction.customId.replace('open_application_modal_', '');
                
                const lookup = await runWithinAcknowledgementWindow(
                    interaction,
                    async () => {
                        const cacheManager = require('../utils/cacheManager');
                        const cacheKey = `${guildId}:${appName}`;
                        const cached = cacheManager.get('applications', cacheKey);
                        return cached || await getApplication(guildId, appName);
                    },
                    'Application details are taking too long to load. Please try again shortly.'
                );
                if (!lookup.completed) return;
                const app = lookup.value;

                if (!app || app === false) {
                    return interaction.reply({
                        content: `${getEmoji('cross')} ${lang.notFound}`,
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }

                if (!app.isActive) {
                    return interaction.reply({
                        content: `${getEmoji('cross')} ${lang.notActive}`,
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }

                if (!app.questions || app.questions.length === 0) {
                    return interaction.reply({
                        content: `${getEmoji('cross')} ${lang.noQuestions}`,
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }

                const modal = new ModalBuilder()
                    .setCustomId(`application_form_${appName}`)
                    .setTitle((lang.modalTitle).replace('{name}', appName.substring(0, 38)));

                
                const questionsToShow = app.questions.slice(0, 5);
                questionsToShow.forEach((question, i) => {
                    const input = new TextInputBuilder()
                        .setCustomId(`question_${i}`)
                        .setLabel(question.text.substring(0, 45))
                        .setStyle(question.inputType === 'SHORT' ? TextInputStyle.Short : TextInputStyle.Paragraph)
                        .setRequired(question.required !== false);

                    if (question.placeholder) {
                        input.setPlaceholder(question.placeholder.substring(0, 100));
                    }
                    if (question.minLength && question.minLength > 0) {
                        input.setMinLength(Math.min(question.minLength, 4000));
                    }
                    if (question.maxLength && question.maxLength > 0) {
                        input.setMaxLength(Math.min(question.maxLength, 4000));
                    }

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                });

                await interaction.showModal(modal);
            } catch (error) {
                console.error('[ApplicationsHandler] Error opening application modal:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: `${getEmoji('cross')} ${lang.modalOpenError}`,
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
            }
        }

        else if (interaction.isModalSubmit() && interaction.customId.startsWith('application_form_')) {
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                }

                const appName = interaction.customId.replace('application_form_', '');
                const app = await getApplication(guildId, appName);

                if (!app) {
                    return interaction.editReply({
                        content: `${getEmoji('cross')} ${lang.notFound}`
                    }).catch(() => {});
                }

                if (!app.isActive) {
                    return interaction.editReply({
                        content: `${getEmoji('cross')} ${lang.notActive}`
                    }).catch(() => {});
                }

                const answers = app.questions.map((_, i) => interaction.fields.getTextInputValue(`question_${i}`));
                const responseChannel = interaction.guild.channels.cache.get(app.responseChannel) ||
                    await interaction.guild.channels.fetch(app.responseChannel).catch(() => null);

                if (!responseChannel) {
                    return interaction.editReply({
                        content: `${getEmoji('cross')} ${lang.responseChannelNotFound}`
                    }).catch(() => {});
                }

                
                const reviewRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_application_${interaction.user.id}_${appName}`)
                        .setLabel(lang.btnAccept)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(getButtonEmoji('tick')),
                    new ButtonBuilder()
                        .setCustomId(`deny_application_${interaction.user.id}_${appName}`)
                        .setLabel(lang.btnDeny)
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(getButtonEmoji('cross'))
                );

                
                const userAvatar = interaction.user.displayAvatarURL({ dynamic: true });
                const submissionContainer = new ContainerBuilder()
                    .setAccentColor(0x5865f2)
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent([
                                    `# ${getEmoji('document')} ${lang.reviewHeader}`,
                                    `## ${(lang.reviewSubheader).replace('{name}', appName)}`,
                                    `> **${lang.applicantTag}:** ${interaction.user.tag} (\`${interaction.user.id}\`)`,
                                    `> **${lang.submittedAt}:** <t:${Math.floor(Date.now() / 1000)}:F>`,
                                    `> **${lang.statusReview}:** ${lang.statusAwaitingReview}`
                                ].join('\n'))
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(userAvatar)
                            )
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### ${getEmoji('list')} **${lang.responsesHeader}**`),
                        ...buildAnswerDisplays(answers, app.questions, lang.noAnswerProvided)
                            .map(content => new TextDisplayBuilder().setContent(content))
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `### ${getEmoji('search')} **${lang.moderatorActionsHeader}**\n` +
                            lang.moderatorActionsBody
                        )
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `*${getEmoji('security')} ${(lang.footerSubmission).replace('{tag}', interaction.user.tag)}*`
                        )
                    )
                    .addActionRowComponents(reviewRow);

                await responseChannel.send({
                    components: [submissionContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                await interaction.editReply({
                    content: `${getEmoji('tick')} ${lang.submittedSuccess}`
                }).catch(() => {});

            } catch (error) {
                console.error('[ApplicationsHandler] Error submitting application:', error);
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: `${getEmoji('cross')} ${lang.submissionError}`
                    }).catch(() => {});
                } else {
                    await interaction.reply({
                        content: `${getEmoji('cross')} ${lang.submissionError}`,
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
            }
        }

        else if (interaction.isButton() &&
            (interaction.customId.startsWith('accept_application_') || interaction.customId.startsWith('deny_application_'))) {
            
            const parts = interaction.customId.split('_');
            const action = parts[0]; 
            const targetUserId = parts[2];
            const appName = parts.slice(3).join('_');
            
            
            const lockKey = interaction.message.id;

            if (inFlightApplications.has(lockKey)) {
                return interaction.reply({
                    content: `${getEmoji('warning')} ${lang.alreadyProcessing}`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            inFlightApplications.add(lockKey);
            let durableClaimed = false;
            let durableCompleted = false;
            let durableClaimToken = null;

            try {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                if (!await checkPermissions(interaction, 'moderator')) {
                    return;
                }

                const decisionClaim = await claimApplicationDecision({
                    reviewMessageId: interaction.message.id,
                    targetUserId,
                    appName,
                    action,
                    moderatorId: interaction.user.id
                });
                if (!decisionClaim.claimed) {
                    return interaction.editReply({
                        content: decisionClaim.completed
                            ? 'This application has already been reviewed.'
                            : 'This application decision is already being processed.'
                    }).catch(() => {});
                }
                durableClaimed = true;
                durableClaimToken = decisionClaim.claimToken;

                const app = await getApplication(guildId, appName);
                if (!app || app.responseChannel !== interaction.channelId) {
                    return interaction.editReply({
                        content: `${getEmoji('cross')} ${lang.notFound}`
                    }).catch(() => {});
                }

                const status = action === 'accept' ? 'accepted' : 'denied';
                const statusColor = status === 'accepted' ? 0x57f287 : 0xed4245;

                
                let originalApplicantTag = `<@${targetUserId}>`;
                let previousSummary = '';

                try {
                    const messageComponents = interaction.message.components || [];
                    if (messageComponents.length > 0) {
                        
                        const containerJson = typeof messageComponents[0].toJSON === 'function' ? messageComponents[0].toJSON() : messageComponents[0];
                        const textComponents = containerJson.components || [];
                        const summaryComp = textComponents.find(c => c.content && c.content.includes('Application Responses'));
                        if (summaryComp) {
                            previousSummary = summaryComp.content;
                        }
                    }
                } catch (_) {}

                
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('processed_accept')
                        .setLabel(status === 'accepted' ? (lang.btnAccepted) : (lang.btnAccept))
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(getButtonEmoji('tick'))
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('processed_deny')
                        .setLabel(status === 'denied' ? (lang.btnDenied) : (lang.btnDeny))
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(getButtonEmoji('cross'))
                        .setDisabled(true)
                );

                
                const updatedContainer = new ContainerBuilder()
                    .setAccentColor(statusColor)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent([
                            `# ${status === 'accepted' ? getEmoji('tick') : getEmoji('cross')} ${(lang.decisionTitle).replace('{status}', status.toUpperCase())}`,
                            `## ${(lang.decisionSubheader).replace('{name}', appName)}`,
                            `> **${lang.decisionApplicant}:** ${originalApplicantTag} (\`${targetUserId}\`)`,
                            `> **${lang.decisionMade}:** **${status.toUpperCase()}**`,
                            `> **${lang.reviewedBy}:** ${interaction.user.tag}`,
                            `> **${lang.decisionDate}:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        ].join('\n'))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

                if (previousSummary) {
                    updatedContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(previousSummary)
                    );
                    updatedContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                }

                updatedContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### ${getEmoji('security')} **${lang.reviewCompleteHeader}**\n` +
                        `**Status:** ${status === 'accepted' ? `${getEmoji('tick')} ${lang.decisionAcceptedSummary}` : `${getEmoji('cross')} ${lang.decisionDeniedSummary}`}`
                    )
                );

                updatedContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                updatedContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `*${getEmoji('sparkles')} ${(lang.footerDecision).replace('{status}', status).replace('{moderator}', interaction.user.tag)}*`
                    )
                );

                updatedContainer.addActionRowComponents(disabledRow);

                await interaction.message.edit({
                    components: [updatedContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                await ApplicationDecision.findOneAndUpdate(
                    { reviewMessageId: interaction.message.id, claimToken: durableClaimToken, completed: false },
                    { $set: { completed: true, decidedAt: new Date(), leaseUntil: new Date(8640000000000000) } },
                    { returnDocument: 'after' }
                );
                durableCompleted = true;

                
                let dmSent = false;
                try {
                    const applicantUser = await client.users.fetch(targetUserId).catch(() => null);
                    if (applicantUser) {
                        const guildName = interaction.guild.name;
                        const dmContainer = new ContainerBuilder()
                            .setAccentColor(statusColor)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent([
                                    `# ${status === 'accepted' ? getEmoji('sparkles') : getEmoji('document')} ${(lang.dmTitle).replace('{status}', status.toUpperCase())}`,
                                    `## ${(lang.dmSubheader).replace('{guild}', guildName)}`,
                                    (lang.dmIntro).replace('{name}', appName).replace('{status}', status.toUpperCase())
                                ].join('\n'))
                            )
                            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `### ${status === 'accepted' ? `${getEmoji('tick')} ${lang.dmWelcomeHeader}` : `${getEmoji('cross')} ${lang.dmDeniedHeader}`}\n\n` +
                                    (status === 'accepted'
                                        ? (lang.dmWelcomeBody)
                                        : (lang.dmDeniedBody))
                                )
                            )
                            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `*${getEmoji('sparkles')} ${(lang.dmFooter).replace('{guild}', guildName).replace('{status}', status === 'accepted' ? 'Welcome!' : 'Try again later')}*`
                                )
                            );

                        dmSent = await sendApplicationDecisionDM(applicantUser, {
                            components: [dmContainer],
                            flags: MessageFlags.IsComponentsV2
                        }, targetUserId);
                    }
                } catch (dmErr) {
                    console.warn(`[ApplicationsHandler] Could not DM user ${targetUserId}:`, dmErr.message);
                }

                
                await interaction.followUp({
                    content: dmSent
                        ? `${getEmoji('tick')} ${lang.dmSentNotice}`
                        : `${getEmoji('warning')} ${lang.dmFailedNotice}`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});

            } catch (error) {
                console.error('[ApplicationsHandler] Error handling application decision:', error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: `${getEmoji('cross')} ${lang.decisionError}`,
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
            } finally {
                if (durableClaimed && !durableCompleted) {
                    await ApplicationDecision.findOneAndUpdate(
                        { reviewMessageId: interaction.message.id, claimToken: durableClaimToken, completed: false },
                        { $set: { leaseUntil: new Date(0) } }
                    ).catch(() => {});
                }
                inFlightApplications.delete(lockKey);
            }
        }
        }
    });

    return {
        stop() {
            client.off('clientReady', onReady);
            unregisterInteractionRoute();
        }
    };
};

module.exports.buildAnswerDisplays = buildAnswerDisplays;
module.exports.sendApplicationDecisionDM = sendApplicationDecisionDM;
module.exports.claimApplicationDecision = claimApplicationDecision;
