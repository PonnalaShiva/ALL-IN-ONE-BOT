

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

const gestures = {
    bleh: { func: gifs.sfw.bleh, requiresTarget: false },
    cheers: { func: gifs.sfw.cheers, requiresTarget: false },
    clap: { func: gifs.sfw.clap, requiresTarget: false },
    dance: { func: gifs.sfw.dance, requiresTarget: false },
    disappear: { func: gifs.sfw.disappear, requiresTarget: false },
    dodge: { func: gifs.sfw.dodge, requiresTarget: false },
    facedesk: { func: gifs.sfw.facedesk, requiresTarget: false },
    facepalm: { func: gifs.sfw.facepalm, requiresTarget: false },
    headbang: { func: gifs.sfw.headbang, requiresTarget: false },
    hide: { func: gifs.sfw.hide, requiresTarget: false },
    money: { func: gifs.sfw.money, requiresTarget: false },
    nom: { func: gifs.sfw.nom, requiresTarget: false },
    peek: { func: gifs.sfw.peek, requiresTarget: false },
    purr: { func: gifs.sfw.purr, requiresTarget: false },
    roll: { func: gifs.sfw.roll, requiresTarget: false },
    run: { func: gifs.sfw.run, requiresTarget: false },
    salute: { func: gifs.sfw.salute, requiresTarget: false },
    shrug: { func: gifs.sfw.shrug, requiresTarget: false },
    sigh: { func: gifs.sfw.sigh, requiresTarget: false },
    sip: { func: gifs.sfw.sip, requiresTarget: false },
    sit: { func: gifs.sfw.sit, requiresTarget: false },
    sleep: { func: gifs.sfw.sleep, requiresTarget: false },
    sleepy: { func: gifs.sfw.sleepy, requiresTarget: false },
    spin: { func: gifs.sfw.spin, requiresTarget: false },
    stare: { func: gifs.sfw.stare, requiresTarget: false }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif-gestures')
        .setDescription('Make anime-style gestures and actions!')
        .addSubcommand(sub =>
            sub
                .setName('bleh')
                .setDescription('Make a bleh face!')
        )
        .addSubcommand(sub =>
            sub
                .setName('cheers')
                .setDescription('Cheers with a drink!')
        )
        .addSubcommand(sub =>
            sub
                .setName('clap')
                .setDescription('Clap your hands!')
        )
        .addSubcommand(sub =>
            sub
                .setName('dance')
                .setDescription('Dance happily!')
        )
        .addSubcommand(sub =>
            sub
                .setName('disappear')
                .setDescription('Disappear from sight!')
        )
        .addSubcommand(sub =>
            sub
                .setName('dodge')
                .setDescription('Dodge an attack!')
        )
        .addSubcommand(sub =>
            sub
                .setName('facedesk')
                .setDescription('Bang your head on the desk!')
        )
        .addSubcommand(sub =>
            sub
                .setName('facepalm')
                .setDescription('Facepalm at something stupid!')
        )
        .addSubcommand(sub =>
            sub
                .setName('headbang')
                .setDescription('Headbang to music!')
        )
        .addSubcommand(sub =>
            sub
                .setName('hide')
                .setDescription('Hide from view!')
        )
        .addSubcommand(sub =>
            sub
                .setName('money')
                .setDescription('Show off your money!')
        )
        .addSubcommand(sub =>
            sub
                .setName('nom')
                .setDescription('Eat something delicious!')
        )
        .addSubcommand(sub =>
            sub
                .setName('peek')
                .setDescription('Peek from hiding!')
        )
        .addSubcommand(sub =>
            sub
                .setName('purr')
                .setDescription('Purr like a cat!')
        )
        .addSubcommand(sub =>
            sub
                .setName('roll')
                .setDescription('Roll around!')
        )
        .addSubcommand(sub =>
            sub
                .setName('run')
                .setDescription('Run away quickly!')
        )
        .addSubcommand(sub =>
            sub
                .setName('salute')
                .setDescription('Give a salute!')
        )
        .addSubcommand(sub =>
            sub
                .setName('shrug')
                .setDescription('Shrug your shoulders!')
        )
        .addSubcommand(sub =>
            sub
                .setName('sigh')
                .setDescription('Let out a sigh!')
        )
        .addSubcommand(sub =>
            sub
                .setName('sip')
                .setDescription('Take a sip of your drink!')
        )
        .addSubcommand(sub =>
            sub
                .setName('sit')
                .setDescription('Sit down!')
        )
        .addSubcommand(sub =>
            sub
                .setName('sleep')
                .setDescription('Fall asleep!')
        )
        .addSubcommand(sub =>
            sub
                .setName('sleepy')
                .setDescription('Show that you are sleepy!')
        )
        .addSubcommand(sub =>
            sub
                .setName('spin')
                .setDescription('Spin around!')
        )
        .addSubcommand(sub =>
            sub
                .setName('stare')
                .setDescription('Stare intensely!')
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

            if (!subcommand || !gestures[subcommand]) {
                const prefix = interaction.guildPrefix || '!';
                const available = Object.keys(gestures).map(s => `\`${s}\``).join(', ');
                const helpContent = [
                    lang.media.guide.title.replace('{emoji}', getEmoji('info') || 'ℹ️').replace('{name}', 'gif-gestures'),
                    '',
                    lang.media.guide.gesturesDesc,
                    '',
                    lang.media.guide.usageTitle,
                    `\`${prefix}gif-gestures <subcommand>\``,
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

        const action = gestures[subcommand];

        if (isSlash) {
            try {
                await interaction.deferReply();
            } catch (err) {
                console.error('[gif-gestures] Defer failed:', err.message);
                return;
            }
        }

        try {
            const gif = await action.func();

            let verbForm;
            if (subcommand === 'sleep') {
                verbForm = lang.media.verbs.fallsAsleep;
            } else if (subcommand === 'run') {
                verbForm = lang.media.verbs.runsAway;
            } else if (subcommand === 'hide') {
                verbForm = lang.media.verbs.hides;
            } else if (subcommand === 'sit') {
                verbForm = lang.media.verbs.sitsDown;
            } else if (subcommand === 'disappear') {
                verbForm = lang.media.verbs.disappears;
            } else if (subcommand === 'sigh') {
                verbForm = lang.media.verbs.sighs;
            } else if (subcommand === 'stare') {
                verbForm = lang.media.verbs.staresIntensely;
            } else if (subcommand === 'purr') {
                verbForm = lang.media.verbs.purrs;
            } else if (subcommand === 'peek') {
                verbForm = lang.media.verbs.peeks;
            } else if (subcommand === 'nom') {
                verbForm = lang.media.verbs.noms;
            } else if (subcommand === 'dodge') {
                verbForm = lang.media.verbs.dodges;
            } else if (subcommand === 'dance') {
                verbForm = lang.media.verbs.dances;
            } else if (subcommand.endsWith('p')) {
                verbForm = `${subcommand}s`;
            } else {
                verbForm = `${subcommand}s`;
            }

            const description = lang.media.verbs.soloAction
                .replace('{sender}', sender)
                .replace('{verb}', verbForm);

            const container = new ContainerBuilder()
                .setAccentColor(0x92FF7E)
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
                            `${lang.media.error.title.replace('{emoji}', getEmoji('cross'))}\n\n${lang.media.error.gesturesFailed}`
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