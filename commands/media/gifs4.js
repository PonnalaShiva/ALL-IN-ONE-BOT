

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
const { resolveUser } = require('../../utils/userResolver');

const reactions = {
    alarm: { func: gifs.sfw.alarm, requiresTarget: false },
    angrystare: { func: gifs.sfw.angrystare, requiresTarget: false },
    ask: { func: gifs.sfw.ask, requiresTarget: false },
    baka: { func: gifs.sfw.baka, requiresTarget: true },
    blyat: { func: gifs.sfw.blyat, requiresTarget: false },
    celebrate: { func: gifs.sfw.celebrate, requiresTarget: false },
    coffee: { func: gifs.sfw.coffee, requiresTarget: false },
    comfy: { func: gifs.sfw.comfy, requiresTarget: false },
    error: { func: gifs.sfw.error, requiresTarget: false },
    no: { func: gifs.sfw.no, requiresTarget: false },
    ok: { func: gifs.sfw.ok, requiresTarget: false },
    scream: { func: gifs.sfw.scream, requiresTarget: false },
    shame: { func: gifs.sfw.shame, requiresTarget: true },
    slowclap: { func: gifs.sfw.slowclap, requiresTarget: false },
    smoke: { func: gifs.sfw.smoke, requiresTarget: false },
    sneeze: { func: gifs.sfw.sneeze, requiresTarget: false },
    sorry: { func: gifs.sfw.sorry, requiresTarget: true },
    stop: { func: gifs.sfw.stop, requiresTarget: false },
    thumbsup: { func: gifs.sfw.thumbsup, requiresTarget: false },
    tired: { func: gifs.sfw.tired, requiresTarget: false },
    triggered: { func: gifs.sfw.triggered, requiresTarget: false },
    wave: { func: gifs.sfw.wave, requiresTarget: true },
    wink: { func: gifs.sfw.wink, requiresTarget: true },
    woah: { func: gifs.sfw.woah, requiresTarget: false },
    yawn: { func: gifs.sfw.yawn, requiresTarget: false }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif-reactions')
        .setDescription('React to situations with anime gifs!')
        .addSubcommand(sub =>
            sub
                .setName('alarm')
                .setDescription('Sound the alarm!')
        )
        .addSubcommand(sub =>
            sub
                .setName('angrystare')
                .setDescription('Give an angry stare!')
        )
        .addSubcommand(sub =>
            sub
                .setName('ask')
                .setDescription('Ask a question!')
        )
        .addSubcommand(sub =>
            sub
                .setName('baka')
                .setDescription('Call someone a baka (idiot)!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to call baka')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('blyat')
                .setDescription('Say blyat!')
        )
        .addSubcommand(sub =>
            sub
                .setName('celebrate')
                .setDescription('Celebrate something!')
        )
        .addSubcommand(sub =>
            sub
                .setName('coffee')
                .setDescription('Enjoy some coffee!')
        )
        .addSubcommand(sub =>
            sub
                .setName('comfy')
                .setDescription('Feel comfy!')
        )
        .addSubcommand(sub =>
            sub
                .setName('error')
                .setDescription('Show an error reaction!')
        )
        .addSubcommand(sub =>
            sub
                .setName('no')
                .setDescription('Say no!')
        )
        .addSubcommand(sub =>
            sub
                .setName('ok')
                .setDescription('Say OK!')
        )
        .addSubcommand(sub =>
            sub
                .setName('scream')
                .setDescription('Let out a scream!')
        )
        .addSubcommand(sub =>
            sub
                .setName('shame')
                .setDescription('Shame someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to shame')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('slowclap')
                .setDescription('Do a slow clap!')
        )
        .addSubcommand(sub =>
            sub
                .setName('smoke')
                .setDescription('Take a smoke!')
        )
        .addSubcommand(sub =>
            sub
                .setName('sneeze')
                .setDescription('Sneeze!')
        )
        .addSubcommand(sub =>
            sub
                .setName('sorry')
                .setDescription('Apologize to someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to apologize to')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('stop')
                .setDescription('Tell someone to stop!')
        )
        .addSubcommand(sub =>
            sub
                .setName('thumbsup')
                .setDescription('Give a thumbs up!')
        )
        .addSubcommand(sub =>
            sub
                .setName('tired')
                .setDescription('Show that you are tired!')
        )
        .addSubcommand(sub =>
            sub
                .setName('triggered')
                .setDescription('Show that you are triggered!')
        )
        .addSubcommand(sub =>
            sub
                .setName('wave')
                .setDescription('Wave at someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to wave at')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('wink')
                .setDescription('Wink at someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to wink at')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('woah')
                .setDescription('Show amazement!')
        )
        .addSubcommand(sub =>
            sub
                .setName('yawn')
                .setDescription('Let out a yawn!')
        ),

    async execute(interaction, args) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        let subcommand = '';
        let sender = null;
        let target = null;

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
            sender = interaction.user;
            target = interaction.options.getUser('user');
        } else {
            subcommand = args?.[0]?.toLowerCase();
            sender = interaction.author;

            if (!subcommand || !reactions[subcommand]) {
                const prefix = interaction.guildPrefix || '!';
                const available = Object.keys(reactions).map(s => `\`${s}\``).join(', ');
                const helpContent = [
                    lang.media.guide.title.replace('{emoji}', getEmoji('info') || 'ℹ️').replace('{name}', 'gif-reactions'),
                    '',
                    lang.media.guide.reactionsDesc,
                    '',
                    lang.media.guide.usageTitle,
                    `\`${prefix}gif-reactions <subcommand> [user]\``,
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

            if (reactions[subcommand].requiresTarget) {
                target = resolveUser(interaction, args, 1);
                if (!target) {
                    const warningContainer = new ContainerBuilder()
                        .setAccentColor(0xEF4444)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(
                                    lang.media.warning.missingTarget
                                        .replace('{emoji}', getEmoji('warning'))
                                        .replace('{subcommand}', subcommand)
                                )
                        );

                    const replyMsg = await interaction.reply({
                        components: [warningContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    setTimeout(() => {
                        replyMsg.delete().catch(() => { });
                        interaction.delete().catch(() => { });
                    }, 8000);
                    return;
                }
            }
        }

        const action = reactions[subcommand];

        if (isSlash) {
            try {
                await interaction.deferReply();
            } catch (err) {
                console.error('[gif-reactions] Defer failed:', err.message);
                return;
            }
        }

        try {
            const gif = await action.func();

            let description;
            if (target) {
                if (subcommand === 'baka') {
                    description = lang.media.verbs.callsBaka.replace('{sender}', sender).replace('{target}', target);
                } else if (subcommand === 'shame') {
                    description = lang.media.verbs.shames.replace('{sender}', sender).replace('{target}', target);
                } else if (subcommand === 'sorry') {
                    description = lang.media.verbs.apologizes.replace('{sender}', sender).replace('{target}', target);
                } else if (subcommand === 'wave') {
                    description = lang.media.verbs.wavesAt.replace('{sender}', sender).replace('{target}', target);
                } else if (subcommand === 'wink') {
                    description = lang.media.verbs.winksAt.replace('{sender}', sender).replace('{target}', target);
                } else {
                    description = `${sender} ${subcommand}s at ${target}!`;
                }
            } else {
                if (subcommand === 'angrystare') {
                    description = lang.media.verbs.angryStare.replace('{sender}', sender);
                } else if (subcommand === 'error') {
                    description = lang.media.verbs.errorReaction.replace('{sender}', sender);
                } else if (subcommand === 'coffee') {
                    description = lang.media.verbs.coffeeReaction.replace('{sender}', sender);
                } else if (subcommand === 'comfy') {
                    description = lang.media.verbs.comfyReaction.replace('{sender}', sender);
                } else if (subcommand === 'scream') {
                    description = lang.media.verbs.screams.replace('{sender}', sender);
                } else if (subcommand === 'sneeze') {
                    description = lang.media.verbs.sneezes.replace('{sender}', sender);
                } else if (subcommand === 'tired') {
                    description = lang.media.verbs.isTired.replace('{sender}', sender);
                } else if (subcommand === 'thumbsup') {
                    description = lang.media.verbs.thumbsUp.replace('{sender}', sender);
                } else if (subcommand === 'triggered') {
                    description = lang.media.verbs.isTriggered.replace('{sender}', sender);
                } else if (subcommand === 'woah') {
                    description = lang.media.verbs.saysWoah.replace('{sender}', sender);
                } else if (subcommand === 'yawn') {
                    description = lang.media.verbs.yawns.replace('{sender}', sender);
                } else {
                    description = lang.media.verbs.soloAction.replace('{sender}', sender).replace('{verb}', `${subcommand}s`);
                }
            }

            const container = new ContainerBuilder()
                .setAccentColor(0xFFCC4D)
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
                            `${lang.media.error.title.replace('{emoji}', getEmoji('cross'))}\n\n${lang.media.error.reactionsFailed}`
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