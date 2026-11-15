'use strict';

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');
const { getEmoji, getButtonEmoji } = require('../../../UI/emojis/emoji');
const defaultLang = require('../../../languages/default');

module.exports.sendMainApplicationEmbed = async function (guild, appName, mainChannelId) {
    const mainChannel = guild.channels.cache.get(mainChannelId) || await guild.channels.fetch(mainChannelId).catch(() => null);
    if (!mainChannel) return false;

    const lang = defaultLang.setups?.applications || {};

    const titleText = lang.applyFormTitle || 'Application System';
    const headerText = lang.applyFormHeader
        ? lang.applyFormHeader.replace('{name}', appName)
        : `Welcome To Our Application System\n\n> Application: **${appName}**\n\n> Click the button below to fill out the application\n> Make sure to provide accurate information\n> Your responses will be reviewed by the moderators`;

    const guidelinesContent = lang.guidelinesContent || `## **Application Guidelines**\n\n**Before Applying**\nRead all requirements carefully\nEnsure you meet the criteria\n\n**Application Process**\nComplete all required fields\nProvide honest and detailed responses\nWait for moderator review\n\n**Support**\nFor any questions, please contact support\nThank you for your interest!`;

    const appFormContainer = new ContainerBuilder()
        .setAccentColor(0x5865f2)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(`# ${getEmoji('list')} ${titleText}\n## ${headerText}`)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(guidelinesContent)
                )
                .setButtonAccessory(
                    new ButtonBuilder()
                        .setCustomId(`open_application_modal_${appName}`)
                        .setLabel(lang.btnApplyNow || 'Apply Now')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(getButtonEmoji('sparkles'))
                )
        );

    await mainChannel.send({
        components: [appFormContainer],
        flags: MessageFlags.IsComponentsV2
    }).catch(err => {
        console.error('[ApplicationsActivation] Failed to send application container:', err);
    });

    return true;
};
