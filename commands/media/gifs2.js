

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

const interactions = {
    airkiss: { func: gifs.sfw.airkiss, requiresTarget: true },
    bite: { func: gifs.sfw.bite, requiresTarget: true },
    bonk: { func: gifs.sfw.bonk, requiresTarget: true },
    boop: { func: gifs.sfw.boop, requiresTarget: true },
    brofist: { func: gifs.sfw.brofist, requiresTarget: true },
    bully: { func: gifs.sfw.bully, requiresTarget: true },
    cuddle: { func: gifs.sfw.cuddle, requiresTarget: true },
    fight: { func: gifs.sfw.fight, requiresTarget: true },
    fluff: { func: gifs.sfw.fluff, requiresTarget: true },
    glomp: { func: gifs.sfw.glomp, requiresTarget: true },
    handhold: { func: gifs.sfw.handhold, requiresTarget: true },
    highfive: { func: gifs.sfw.highfive, requiresTarget: true },
    hug: { func: gifs.sfw.hug, requiresTarget: true },
    kick: { func: gifs.sfw.kick, requiresTarget: true },
    kiss: { func: gifs.sfw.kiss, requiresTarget: true },
    lick: { func: gifs.sfw.lick, requiresTarget: true },
    nuzzle: { func: gifs.sfw.nuzzle, requiresTarget: true },
    pat: { func: gifs.sfw.pat, requiresTarget: true },
    pinch: { func: gifs.sfw.pinch, requiresTarget: true },
    poke: { func: gifs.sfw.poke, requiresTarget: true },
    protect: { func: gifs.sfw.protect, requiresTarget: true },
    punch: { func: gifs.sfw.punch, requiresTarget: true },
    slap: { func: gifs.sfw.slap, requiresTarget: true },
    smack: { func: gifs.sfw.smack, requiresTarget: true },
    tickle: { func: gifs.sfw.tickle, requiresTarget: true }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif-interactions')
        .setDescription('Interact with other users using anime gifs!')
        .addSubcommand(sub =>
            sub
                .setName('airkiss')
                .setDescription('Blow a kiss to someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to air kiss')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('bite')
                .setDescription('Bite someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to bite')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('bonk')
                .setDescription('Bonk someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to bonk')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('boop')
                .setDescription('Boop someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to boop')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('brofist')
                .setDescription('Give someone a brofist!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to brofist')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('bully')
                .setDescription('Bully someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to bully')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('cuddle')
                .setDescription('Cuddle with someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to cuddle with')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('fight')
                .setDescription('Fight with someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to fight with')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('fluff')
                .setDescription('Fluff someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to fluff')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('glomp')
                .setDescription('Glomp someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to glomp')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('handhold')
                .setDescription('Hold hands with someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to hold hands with')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('highfive')
                .setDescription('High five someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to high five')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('hug')
                .setDescription('Hug someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to hug')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('kick')
                .setDescription('Kick someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to kick')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('kiss')
                .setDescription('Kiss someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to kiss')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('lick')
                .setDescription('Lick someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to lick')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('nuzzle')
                .setDescription('Nuzzle someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to nuzzle')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('pat')
                .setDescription('Pat someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to pat')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('pinch')
                .setDescription('Pinch someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to pinch')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('poke')
                .setDescription('Poke someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to poke')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('protect')
                .setDescription('Protect someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to protect')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('punch')
                .setDescription('Punch someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to punch')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('slap')
                .setDescription('Slap someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to slap')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('smack')
                .setDescription('Smack someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to smack')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('tickle')
                .setDescription('Tickle someone!')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to tickle')
                        .setRequired(true)
                )
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

            if (!subcommand || !interactions[subcommand]) {
                const prefix = interaction.guildPrefix || '!';
                const available = Object.keys(interactions).map(s => `\`${s}\``).join(', ');
                const helpContent = [
                    lang.media.guide.title.replace('{emoji}', getEmoji('info') || 'ℹ️').replace('{name}', 'gif-interactions'),
                    '',
                    lang.media.guide.interactionsDesc,
                    '',
                    lang.media.guide.usageTitle,
                    `\`${prefix}gif-interactions <subcommand> <@user>\``,
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

        const action = interactions[subcommand];

        if (isSlash) {
            try {
                await interaction.deferReply();
            } catch (err) {
                console.error('[gif-interactions] Defer failed:', err.message);
                return;
            }
        }

        try {
            const gif = await action.func();

            let verbForm;
            if (subcommand === 'handhold') {
                verbForm = lang.media.verbs.holdsHands;
            } else if (subcommand === 'highfive') {
                verbForm = lang.media.verbs.highFives;
            } else if (subcommand === 'kiss') {
                verbForm = lang.media.verbs.kisses;
            } else if (subcommand.endsWith('h')) {
                verbForm = `${subcommand}es`;
            } else {
                verbForm = `${subcommand}s`;
            }

            const description = lang.media.verbs.targetedAction
                .replace('{sender}', sender)
                .replace('{verb}', verbForm)
                .replace('{target}', target);

            const container = new ContainerBuilder()
                .setAccentColor(0x82DCFF)
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
                            `${lang.media.error.title.replace('{emoji}', getEmoji('cross'))}\n\n${lang.media.error.interactionsFailed}`
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