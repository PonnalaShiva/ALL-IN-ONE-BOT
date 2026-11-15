

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

const special = {
    cute: { func: gifs.sfw.cute, requiresTarget: false },
    destroy: { func: gifs.sfw.destroy, requiresTarget: true },
    die: { func: gifs.sfw.die, requiresTarget: false },
    eevee: { func: gifs.sfw.eevee, requiresTarget: false },
    fbi: { func: gifs.sfw.fbi, requiresTarget: false },
    kill: { func: gifs.sfw.kill, requiresTarget: true },
    neko: { func: gifs.sfw.neko, requiresTarget: false },
    party: { func: gifs.sfw.party, requiresTarget: false },
    puke: { func: gifs.sfw.puke, requiresTarget: false },
    pusheen: { func: gifs.sfw.pusheen, requiresTarget: false },
    random: { func: gifs.sfw.random, requiresTarget: false },
    stomp: { func: gifs.sfw.stomp, requiresTarget: false },
    tail: { func: gifs.sfw.tail, requiresTarget: false },
    trap: { func: gifs.sfw.trap, requiresTarget: false },
    uwu: { func: gifs.sfw.uwu, requiresTarget: false },
    wasted: { func: gifs.sfw.wasted, requiresTarget: true },
    wiggle: { func: gifs.sfw.wiggle, requiresTarget: false },
    yay: { func: gifs.sfw.yay, requiresTarget: false },
    yeet: { func: gifs.sfw.yeet, requiresTarget: true },
    yes: { func: gifs.sfw.yes, requiresTarget: false }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif-special')
        .setDescription('Special anime gifs for unique situations!')
        .addSubcommand(sub =>
            sub
                .setName('cute')
                .setDescription('Show something cute!')
        )
        .addSubcommand(sub =>
            sub
                .setName('destroy')
                .setDescription('Destroy something or someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to destroy')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('die')
                .setDescription('Dramatically die!')
        )
        .addSubcommand(sub =>
            sub
                .setName('eevee')
                .setDescription('Show an Eevee gif!')
        )
        .addSubcommand(sub =>
            sub
                .setName('fbi')
                .setDescription('FBI open up!')
        )
        .addSubcommand(sub =>
            sub
                .setName('kill')
                .setDescription('Kill someone (in anime)!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to kill')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('neko')
                .setDescription('Show a neko (cat girl) gif!')
        )
        .addSubcommand(sub =>
            sub
                .setName('party')
                .setDescription('Start partying!')
        )
        .addSubcommand(sub =>
            sub
                .setName('puke')
                .setDescription('Puke reaction!')
        )
        .addSubcommand(sub =>
            sub
                .setName('pusheen')
                .setDescription('Show a Pusheen gif!')
        )
        .addSubcommand(sub =>
            sub
                .setName('random')
                .setDescription('Show a random anime gif!')
        )
        .addSubcommand(sub =>
            sub
                .setName('stomp')
                .setDescription('Stomp angrily!')
        )
        .addSubcommand(sub =>
            sub
                .setName('tail')
                .setDescription('Wag your tail!')
        )
        .addSubcommand(sub =>
            sub
                .setName('trap')
                .setDescription('It\'s a trap!')
        )
        .addSubcommand(sub =>
            sub
                .setName('uwu')
                .setDescription('UwU face!')
        )
        .addSubcommand(sub =>
            sub
                .setName('wasted')
                .setDescription('Show someone as wasted!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user who is wasted')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('wiggle')
                .setDescription('Wiggle around!')
        )
        .addSubcommand(sub =>
            sub
                .setName('yay')
                .setDescription('Express excitement!')
        )
        .addSubcommand(sub =>
            sub
                .setName('yeet')
                .setDescription('Yeet someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to yeet')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('yes')
                .setDescription('Say yes!')
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

            if (!subcommand || !special[subcommand]) {
                const prefix = interaction.guildPrefix || '!';
                const available = Object.keys(special).map(s => `\`${s}\``).join(', ');
                const helpContent = [
                    lang.media.guide.title.replace('{emoji}', getEmoji('info') || 'ℹ️').replace('{name}', 'gif-special'),
                    '',
                    lang.media.guide.specialDesc,
                    '',
                    lang.media.guide.usageTitle,
                    `\`${prefix}gif-special <subcommand> [user]\``,
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

            if (special[subcommand].requiresTarget) {
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

        const action = special[subcommand];

        if (isSlash) {
            try {
                await interaction.deferReply();
            } catch (err) {
                console.error('[gif-special] Defer failed:', err.message);
                return;
            }
        }

        try {
            const gif = await action.func();

            let description;
            if (target) {
                if (subcommand === 'destroy') {
                    description = lang.media.verbs.destroys.replace('{sender}', sender).replace('{target}', target);
                } else if (subcommand === 'kill') {
                    description = lang.media.verbs.kills.replace('{sender}', sender).replace('{target}', target);
                } else if (subcommand === 'wasted') {
                    description = lang.media.verbs.isWasted.replace('{target}', target);
                } else if (subcommand === 'yeet') {
                    description = lang.media.verbs.yeets.replace('{sender}', sender).replace('{target}', target);
                } else {
                    description = `${sender} ${subcommand}s ${target}!`;
                }
            } else {
                if (subcommand === 'die') {
                    description = lang.media.verbs.diesDramatically.replace('{sender}', sender);
                } else if (subcommand === 'eevee') {
                    description = lang.media.verbs.showsEevee.replace('{sender}', sender);
                } else if (subcommand === 'fbi') {
                    description = lang.media.verbs.callsFBI.replace('{sender}', sender);
                } else if (subcommand === 'neko') {
                    description = lang.media.verbs.showsNeko.replace('{sender}', sender);
                } else if (subcommand === 'party') {
                    description = lang.media.verbs.startsParty.replace('{sender}', sender);
                } else if (subcommand === 'puke') {
                    description = lang.media.verbs.pukes.replace('{sender}', sender);
                } else if (subcommand === 'pusheen') {
                    description = lang.media.verbs.showsPusheen.replace('{sender}', sender);
                } else if (subcommand === 'random') {
                    description = lang.media.verbs.showsRandomGif.replace('{sender}', sender);
                } else if (subcommand === 'tail') {
                    description = lang.media.verbs.wagsTail.replace('{sender}', sender);
                } else if (subcommand === 'trap') {
                    description = lang.media.verbs.saysTrap.replace('{sender}', sender);
                } else if (subcommand === 'uwu') {
                    description = lang.media.verbs.saysUwU.replace('{sender}', sender);
                } else if (subcommand === 'wiggle') {
                    description = lang.media.verbs.wiggles.replace('{sender}', sender);
                } else if (subcommand === 'yay') {
                    description = lang.media.verbs.saysYay.replace('{sender}', sender);
                } else if (subcommand === 'yes') {
                    description = lang.media.verbs.saysYes.replace('{sender}', sender);
                } else {
                    description = lang.media.verbs.soloAction.replace('{sender}', sender).replace('{verb}', `${subcommand}s`);
                }
            }

            const container = new ContainerBuilder()
                .setAccentColor(0xD580FF)
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
                            `${lang.media.error.title.replace('{emoji}', getEmoji('cross'))}\n\n${lang.media.error.specialFailed}`
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