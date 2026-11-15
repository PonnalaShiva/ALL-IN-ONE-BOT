
const { getBoostSettings } = require('../utils/cacheHelpers');
const loadLanguage = require('../events/loadLanguage');
const { getEmoji } = require('../UI/emojis/emoji');
const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');

function replacePlaceholders(text, data) {
    if (!text) return '';
    return text
        .replace(/\{username\}/g, data.username)
        .replace(/\{user\}/g, data.username)
        .replace(/\{servername\}/g, data.servername)
        .replace(/\{server\}/g, data.servername)
        .replace(/\{boostlevel\}/g, data.boostlevel)
        .replace(/\{boostcount\}/g, data.boostcount);
}

function getBoostLevelEmoji(level) {
    switch (level) {
        case 0: return getEmoji('medal');
        case 1: return getEmoji('trophy');
        case 2: return getEmoji('crown');
        case 3: return getEmoji('gem');
        default: return getEmoji('star');
    }
}

function getBoostBenefits(level, lang) {
    const b = lang?.boost?.handler?.benefits || {};
    switch (level) {
        case 1: return b.level1;
        case 2: return b.level2;
        case 3: return b.level3;
        default: return b.level0;
    }
}

async function handleBoostNotification(oldMember, newMember, isBoost) {
    try {
        const guild = newMember.guild;
        if (!guild) return;

        
        const boostSettings = await getBoostSettings(guild.id);
        if (!boostSettings?.boostStatus || !boostSettings.boostChannelId) return;

        const boostChannel = guild.channels.cache.get(boostSettings.boostChannelId);
        if (!boostChannel || !boostChannel.isTextBased()) return;

        const lang = loadLanguage(guild.id);
        const user = newMember.user;
        const boostLevel = guild.premiumTier ?? 0;
        const boostCount = guild.premiumSubscriptionCount || 0;

        
        const placeholderData = {
            username: user.username,
            servername: guild.name,
            boostlevel: boostLevel,
            boostcount: boostCount
        };

        const container = new ContainerBuilder();

        if (isBoost) {
            
            container.setAccentColor(0xf47fff);

            const message = replacePlaceholders(boostSettings.boostMessage, placeholderData);
            const defaultMsg = lang.boost.handler.defaultBoostMessage.replace('{username}', user.username);
            const userAvatar = user.displayAvatarURL({ dynamic: true, size: 256 });

            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent(
                                `# ${getEmoji('rocket')} ${lang.boost.handler.serverBoostedTitle}\n` +
                                `## ${guild.name} ${lang.boost.handler.levelUpSubtitle}\n\n` +
                                `> ${message || defaultMsg}\n` +
                                `> ${lang.boost.handler.boostSupportNotice}`
                            )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder()
                            .setURL(userAvatar)
                            .setDescription(lang.boost.handler.avatarDesc.replace('{username}', user.username))
                    )
            );

            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            const benefits = getBoostBenefits(boostLevel, lang);
            const levelEmoji = getBoostLevelEmoji(boostLevel);

            container.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `### ${getEmoji('chart')} **${lang.boost.handler.statsTitle}**`,
                        '',
                        `**${getEmoji('target')} ${lang.boost.handler.boosterLabel}:** ${user.tag}`,
                        `**${getEmoji('star')} ${lang.boost.handler.serverLevelLabel}:** ${lang.boost.handler.levelLabel} ${boostLevel} ${levelEmoji}`,
                        `**${getEmoji('fire')} ${lang.boost.handler.totalBoostsLabel}:** ${boostCount} ${lang.boost.handler.boostsUnit}`,
                        '',
                        `**${getEmoji('gem')} ${lang.boost.handler.benefitsLabel}:**`,
                        benefits
                    ].join('\n'))
            );

            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            const timestamp = Math.floor(Date.now() / 1000);
            container.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `### ${getEmoji('heart')} **${lang.boost.handler.thankYouTitle}**`,
                        '',
                        `> ${lang.boost.handler.thankYouLine1}`,
                        `> ${lang.boost.handler.thankYouLine2}`,
                        '',
                        `**${lang.boost.handler.boostedAtLabel}:** <t:${timestamp}:F>`,
                        `**${lang.boost.handler.serverLabel}:** ${guild.name}`,
                        '',
                        `*${lang.boost.handler.appreciateSupport} ${getEmoji('sparkles')}*`
                    ].join('\n'))
            );
        } else {
            
            container.setAccentColor(0xff6b6b);

            const message = replacePlaceholders(boostSettings.removeMessage, placeholderData);
            const defaultMsg = lang.boost.handler.defaultRemoveMessage.replace('{username}', user.username);
            const userAvatar = user.displayAvatarURL({ dynamic: true, size: 256 });

            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent(
                                `# ${getEmoji('crossmark')} ${lang.boost.handler.boostRemovedTitle}\n` +
                                `## ${guild.name} ${lang.boost.handler.boostUpdateSubtitle}\n\n` +
                                `> ${message || defaultMsg}\n` +
                                `> ${lang.boost.handler.removeNotice}`
                            )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder()
                            .setURL(userAvatar)
                            .setDescription(lang.boost.handler.avatarDesc.replace('{username}', user.username))
                    )
            );

            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            const levelEmoji = getBoostLevelEmoji(boostLevel);

            container.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `### ${getEmoji('chart')} **${lang.boost.handler.updatedStatsTitle}**`,
                        '',
                        `**${getEmoji('user')} ${lang.boost.handler.userLabel}:** ${user.tag}`,
                        `**${getEmoji('star')} ${lang.boost.handler.currentLevelLabel}:** ${lang.boost.handler.levelLabel} ${boostLevel} ${levelEmoji}`,
                        `**${getEmoji('fire')} ${lang.boost.handler.remainingBoostsLabel}:** ${boostCount} ${lang.boost.handler.boostsUnit}`,
                        '',
                        `**${getEmoji('chat')} ${lang.boost.handler.messageLabel}:** ${lang.boost.handler.hopeBoostAgain}`
                    ].join('\n'))
            );

            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            const timestamp = Math.floor(Date.now() / 1000);
            container.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `### ${getEmoji('sparkle')} **${lang.boost.handler.comeBackSoonTitle}**`,
                        '',
                        `> ${lang.boost.handler.comeBackLine1}`,
                        `> ${lang.boost.handler.comeBackLine2}`,
                        '',
                        `**${lang.boost.handler.boostRemovedAtLabel}:** <t:${timestamp}:F>`,
                        `**${lang.boost.handler.serverLabel}:** ${guild.name}`,
                        '',
                        `*${lang.boost.handler.thankPastSupport} ${getEmoji('heart')}*`
                    ].join('\n'))
            );
        }

        
        await boostChannel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        }).catch(error => {
            console.error('[BoostHandler] Error sending boost notification:', error);
        });

    } catch (error) {
        console.error('[BoostHandler] Error in boost notification handler:', error);
    }
}

function boostHandler(client) {
    const listener = async (oldMember, newMember) => {
        try {
            const oldBoost = oldMember.premiumSince;
            const newBoost = newMember.premiumSince;

            if (!oldBoost && newBoost) {
                
                await handleBoostNotification(oldMember, newMember, true);
            } else if (oldBoost && !newBoost) {
                
                await handleBoostNotification(oldMember, newMember, false);
            }
        } catch (error) {
            console.error('[BoostHandler] Error in boost handler:', error);
        }
    };
    client.on('guildMemberUpdate', listener);

    return {
        stop() {
            client.off('guildMemberUpdate', listener);
        },
        handleBoostNotification,
        replacePlaceholders,
        getBoostLevelEmoji,
        getBoostBenefits
    };
}

boostHandler.handleBoostNotification = handleBoostNotification;
boostHandler.replacePlaceholders = replacePlaceholders;
boostHandler.getBoostLevelEmoji = getBoostLevelEmoji;
boostHandler.getBoostBenefits = getBoostBenefits;

module.exports = boostHandler;
