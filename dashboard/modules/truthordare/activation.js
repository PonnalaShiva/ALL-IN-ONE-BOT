const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const { getEmoji, getButtonEmoji } = require('../../../UI/emojis/emoji');

function buildTruthOrDareCard() {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF66CC);

    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(`## ${getEmoji('games')} **Truth or Dare Game Portal**`)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                `### ${getEmoji('sparkles')} **Choose Your Challenge**\n` +
                `Click a button below to receive a **Truth**, **Dare**, or let fate decide with **Random**!`
            )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    const btnTruth = new ButtonBuilder()
        .setCustomId('tod_truth')
        .setLabel('Truth')
        .setStyle(ButtonStyle.Primary);
    const truthEmoji = getButtonEmoji('help') || getButtonEmoji('sparkles');
    if (truthEmoji) btnTruth.setEmoji(truthEmoji);

    const btnDare = new ButtonBuilder()
        .setCustomId('tod_dare')
        .setLabel('Dare')
        .setStyle(ButtonStyle.Danger);
    const dareEmoji = getButtonEmoji('fire') || getButtonEmoji('warning');
    if (dareEmoji) btnDare.setEmoji(dareEmoji);

    const btnRandom = new ButtonBuilder()
        .setCustomId('tod_random')
        .setLabel('Random')
        .setStyle(ButtonStyle.Secondary);
    const randomEmoji = getButtonEmoji('loop') || getButtonEmoji('games');
    if (randomEmoji) btnRandom.setEmoji(randomEmoji);

    const row = new ActionRowBuilder().addComponents(btnTruth, btnDare, btnRandom);
    container.addActionRowComponents(row);

    return container;
}

async function sendTruthOrDareEmbed(channel) {
    if (!channel) return false;
    try {
        const card = buildTruthOrDareCard();
        await channel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        });
        console.log(`✅ Sent Truth or Dare V2 card to #${channel.name}`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to send Truth or Dare card:`, err);
        return false;
    }
}

module.exports = {
    buildTruthOrDareCard,
    sendTruthOrDareEmbed
};
