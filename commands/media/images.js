

const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');
require('../../utils/mediaPatch');
const { images } = require('mediacord');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');

const imageTypes = {
    neko: images.sfw.neko,
    waifu: images.sfw.waifu,
    shinobu: images.sfw.shinobu,
    megumin: images.sfw.megumin,
    cat: images.sfw.cat,
    dog: images.sfw.dog,
    food: images.sfw.food,
    senko: images.sfw.senko,
    kanna: images.sfw.kanna,
    kitsune: images.sfw.kitsune,
    background: images.sfw.background,
    holo: images.sfw.holo,
    awoo: images.sfw.awoo,
    coffee: images.sfw.coffee,
    icon: images.sfw.icon,
    okami: images.sfw.okami,
    eevee: images.sfw.eevee,
    kemonomimi: images.sfw.kemonomimi,
    random: images.sfw.random
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('images')
        .setDescription('Send various anime/styled images')
        .addSubcommand(sub =>
            sub.setName('neko').setDescription('Get a neko image')
        )
        .addSubcommand(sub =>
            sub.setName('waifu').setDescription('Get a waifu image')
        )
        .addSubcommand(sub =>
            sub.setName('shinobu').setDescription('Get a Shinobu image')
        )
        .addSubcommand(sub =>
            sub.setName('megumin').setDescription('Get a Megumin image')
        )
        .addSubcommand(sub =>
            sub.setName('cat').setDescription('Get a cat image')
        )
        .addSubcommand(sub =>
            sub.setName('dog').setDescription('Get a dog image')
        )
        .addSubcommand(sub =>
            sub.setName('food').setDescription('Get a food image')
        )
        .addSubcommand(sub =>
            sub.setName('senko').setDescription('Get a Senko image')
        )
        .addSubcommand(sub =>
            sub.setName('kanna').setDescription('Get a Kanna image')
        )
        .addSubcommand(sub =>
            sub.setName('kitsune').setDescription('Get a kitsune image')
        )
        .addSubcommand(sub =>
            sub.setName('background').setDescription('Get a background image')
        )
        .addSubcommand(sub =>
            sub.setName('holo').setDescription('Get a Holo image')
        )
        .addSubcommand(sub =>
            sub.setName('awoo').setDescription('Get an awoo image')
        )
        .addSubcommand(sub =>
            sub.setName('coffee').setDescription('Get a coffee image')
        )
        .addSubcommand(sub =>
            sub.setName('icon').setDescription('Get an icon image')
        )
        .addSubcommand(sub =>
            sub.setName('okami').setDescription('Get an Okami image')
        )
        .addSubcommand(sub =>
            sub.setName('eevee').setDescription('Get an Eevee image')
        )
        .addSubcommand(sub =>
            sub.setName('kemonomimi').setDescription('Get a kemonomimi image')
        )
        .addSubcommand(sub =>
            sub.setName('random').setDescription('Get a completely random image')
        ),

    async execute(interaction, args) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        let subcommand = '';

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            subcommand = args?.[0]?.toLowerCase();

            if (!subcommand || !imageTypes[subcommand]) {
                const prefix = interaction.guildPrefix || '!';
                const available = Object.keys(imageTypes).map(s => `\`${s}\``).join(', ');
                const helpContent = [
                    lang.media.guide.title.replace('{emoji}', getEmoji('info') || 'ℹ️').replace('{name}', 'images'),
                    '',
                    lang.media.guide.imagesDesc,
                    '',
                    lang.media.guide.usageTitle,
                    `\`${prefix}images <subcommand>\``,
                    '',
                    lang.media.guide.availableTitle,
                    available
                ].join('\n');

                const helpContainer = new ContainerBuilder()
                    .setAccentColor(0x3498db)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(helpContent)
                    );

                const replyMsg = await interaction.reply({
                    components: [helpContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                setTimeout(() => {
                    replyMsg.delete().catch(() => { });
                    interaction.delete().catch(() => { });
                }, 15000);
                return;
            }
        }

        const fetchImage = imageTypes[subcommand];

        if (isSlash) {
            try {
                await interaction.deferReply();
            } catch (err) {
                console.error('[images] Defer failed:', err.message);
                return;
            }
        }

        try {
            const imageUrl = await fetchImage();
            const name = subcommand.charAt(0).toUpperCase() + subcommand.slice(1);

            const container = new ContainerBuilder()
                .setAccentColor(0xFF99CC)
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(lang.media.verbs.imageTitle.replace('{name}', name))
                )
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder()
                        .addItems(
                            new MediaGalleryItemBuilder()
                                .setURL(imageUrl)
                                .setDescription(subcommand)
                        )
                );

            if (isSlash) {
                await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                await interaction.channel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
                await interaction.delete().catch(() => { });
            }
        } catch (error) {
            console.error(error);

            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xEF4444)
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(
                            `${lang.media.error.title.replace('{emoji}', getEmoji('cross'))}\n\n${lang.media.error.imagesFailed}`
                        )
                );

            if (isSlash) {
                await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                const replyMsg = await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
                setTimeout(() => {
                    replyMsg.delete().catch(() => { });
                    interaction.delete().catch(() => { });
                }, 8000);
            }
        }
    }
};