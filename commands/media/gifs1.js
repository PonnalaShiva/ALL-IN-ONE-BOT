

const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');
require('../../utils/mediaPatch');
const { gifs } = require('mediacord');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');

const emotions = {
    amazing: { func: gifs.sfw.amazing, requiresTarget: false },
    blush: { func: gifs.sfw.blush, requiresTarget: false },
    confused: { func: gifs.sfw.confused, requiresTarget: false },
    cool: { func: gifs.sfw.cool, requiresTarget: false },
    cringe: { func: gifs.sfw.cringe, requiresTarget: false },
    cry: { func: gifs.sfw.cry, requiresTarget: false },
    drool: { func: gifs.sfw.drool, requiresTarget: false },
    evillaugh: { func: gifs.sfw.evillaugh, requiresTarget: false },
    happy: { func: gifs.sfw.happy, requiresTarget: false },
    laugh: { func: gifs.sfw.laugh, requiresTarget: false },
    lonely: { func: gifs.sfw.lonely, requiresTarget: false },
    love: { func: gifs.sfw.love, requiresTarget: false },
    mad: { func: gifs.sfw.mad, requiresTarget: false },
    nervous: { func: gifs.sfw.nervous, requiresTarget: false },
    nosebleed: { func: gifs.sfw.nosebleed, requiresTarget: false },
    nyah: { func: gifs.sfw.nyah, requiresTarget: false },
    pout: { func: gifs.sfw.pout, requiresTarget: false },
    sad: { func: gifs.sfw.sad, requiresTarget: false },
    scared: { func: gifs.sfw.scared, requiresTarget: false },
    shocked: { func: gifs.sfw.shocked, requiresTarget: false },
    shy: { func: gifs.sfw.shy, requiresTarget: false },
    smile: { func: gifs.sfw.smile, requiresTarget: false },
    smug: { func: gifs.sfw.smug, requiresTarget: false },
    surprised: { func: gifs.sfw.surprised, requiresTarget: false },
    sweat: { func: gifs.sfw.sweat, requiresTarget: false }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif-emotions')
        .setDescription('Express your emotions with anime gifs!')
        .addSubcommand(sub =>
            sub
                .setName('amazing')
                .setDescription('Show that you are amazed!')
        )
        .addSubcommand(sub =>
            sub
                .setName('blush')
                .setDescription('Show that you are blushing!')
        )
        .addSubcommand(sub =>
            sub
                .setName('confused')
                .setDescription('Show that you are confused!')
        )
        .addSubcommand(sub =>
            sub
                .setName('cool')
                .setDescription('Show that you are cool!')
        )
        .addSubcommand(sub =>
            sub
                .setName('cringe')
                .setDescription('Show that you are cringing!')
        )
        .addSubcommand(sub =>
            sub
                .setName('cry')
                .setDescription('Show that you are crying!')
        )
        .addSubcommand(sub =>
            sub
                .setName('drool')
                .setDescription('Show that you are drooling!')
        )
        .addSubcommand(sub =>
            sub
                .setName('evillaugh')
                .setDescription('Show your evil laugh!')
        )
        .addSubcommand(sub =>
            sub
                .setName('happy')
                .setDescription('Show that you are happy!')
        )
        .addSubcommand(sub =>
            sub
                .setName('laugh')
                .setDescription('Show that you are laughing!')
        )
        .addSubcommand(sub =>
            sub
                .setName('lonely')
                .setDescription('Show that you are feeling lonely!')
        )
        .addSubcommand(sub =>
            sub
                .setName('love')
                .setDescription('Show that you are feeling love!')
        )
        .addSubcommand(sub =>
            sub
                .setName('mad')
                .setDescription('Show that you are mad!')
        )
        .addSubcommand(sub =>
            sub
                .setName('nervous')
                .setDescription('Show that you are nervous!')
        )
        .addSubcommand(sub =>
            sub
                .setName('nosebleed')
                .setDescription('Show a nosebleed reaction!')
        )
        .addSubcommand(sub =>
            sub
                .setName('nyah')
                .setDescription('Make a nyah sound!')
        )
        .addSubcommand(sub =>
            sub
                .setName('pout')
                .setDescription('Show that you are pouting!')
        )
        .addSubcommand(sub =>
            sub
                .setName('sad')
                .setDescription('Show that you are sad!')
        )
        .addSubcommand(sub =>
            sub
                .setName('scared')
                .setDescription('Show that you are scared!')
        )
        .addSubcommand(sub =>
            sub
                .setName('shocked')
                .setDescription('Show that you are shocked!')
        )
        .addSubcommand(sub =>
            sub
                .setName('shy')
                .setDescription('Show that you are shy!')
        )
        .addSubcommand(sub =>
            sub
                .setName('smile')
                .setDescription('Show that you are smiling!')
        )
        .addSubcommand(sub =>
            sub
                .setName('smug')
                .setDescription('Show a smug expression!')
        )
        .addSubcommand(sub =>
            sub
                .setName('surprised')
                .setDescription('Show that you are surprised!')
        )
        .addSubcommand(sub =>
            sub
                .setName('sweat')
                .setDescription('Show a nervous sweat!')
        ),

    async execute(interaction, args) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        let subcommand = '';
        let sender = null;

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
            sender = interaction.user;
        } else {
            subcommand = args?.[0]?.toLowerCase();
            sender = interaction.author;

            if (!subcommand || !emotions[subcommand]) {
                const prefix = interaction.guildPrefix || '!';
                const available = Object.keys(emotions).map(s => `\`${s}\``).join(', ');
                const helpContent = [
                    lang.media.guide.title.replace('{emoji}', getEmoji('info') || 'ℹ️').replace('{name}', 'gif-emotions'),
                    '',
                    lang.media.guide.emotionsDesc,
                    '',
                    lang.media.guide.usageTitle,
                    `\`${prefix}gif-emotions <subcommand>\``,
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

        const action = emotions[subcommand];

        if (isSlash) {
            try {
                await interaction.deferReply();
            } catch (err) {
                console.error('[gif-emotions] Defer failed:', err.message);
                return;
            }
        }

        try {
            const gif = await action.func();

            let verbForm;
            if (subcommand === 'cry') {
                verbForm = lang.media.verbs.cries;
            } else if (subcommand === 'love') {
                verbForm = lang.media.verbs.feelingLove;
            } else if (subcommand === 'nyah') {
                verbForm = lang.media.verbs.saysNyah;
            } else if (subcommand.endsWith('h')) {
                verbForm = `${subcommand}s`;
            } else {
                verbForm = `${subcommand}s`;
            }

            const description = lang.media.verbs.soloAction
                .replace('{sender}', sender)
                .replace('{verb}', verbForm);

            const container = new ContainerBuilder()
                .setAccentColor(0xFF9CE0)
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(`### ${description}`)
                )
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder()
                        .addItems(
                            new MediaGalleryItemBuilder()
                                .setURL(gif)
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
                            `${lang.media.error.title.replace('{emoji}', getEmoji('cross'))}\n\n${lang.media.error.emotionsFailed}`
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