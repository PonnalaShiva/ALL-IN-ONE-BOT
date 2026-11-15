

const POPCAT_API_URL = (process.env.POPCAT_API_URL || 'https://api.popcat.xyz').replace(/\/+$/, '');
const { SlashCommandBuilder } = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');

function getCleanAvatar(target, defaultIndex = 0) {
    if (!target) return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    const raw = target.displayAvatarURL?.({ extension: 'png', size: 256 })
        || target.avatarURL?.({ extension: 'png', size: 256 })
        || `https://cdn.discordapp.com/embed/avatars/${Number(target.discriminator || defaultIndex) % 5}.png`;
    return raw.replace(/\.webp(?:\?.*)?$/i, '.png').replace(/\?.*$/, '');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('memes')
        .setDescription('Create memes')
        .addSubcommand(subcommand =>
            subcommand
                .setName('drake')
                .setDescription('Create a Drake meme')
                .addStringOption(option =>
                    option.setName('top')
                        .setDescription('Text for top (bad thing)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('bottom')
                        .setDescription('Text for bottom (good thing)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('biden')
                .setDescription('Make Biden tweet anything')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('What should Biden tweet?')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pikachu')
                .setDescription('Create a surprised Pikachu meme')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text for the meme')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pooh')
                .setDescription('Create a Pooh meme (normal vs tuxedo)')
                .addStringOption(option =>
                    option.setName('text1')
                        .setDescription('Text for normal Pooh')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('text2')
                        .setDescription('Text for tuxedo Pooh')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('oogway')
                .setDescription('Create an Oogway quote meme')
                .addStringOption(option =>
                    option.setName('quote')
                        .setDescription('Wise quote from Master Oogway')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('opinion')
                .setDescription('Generate an opinion meme with someone\'s face')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('The opinion text')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User whose face to use (defaults to you)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('facts')
                .setDescription('This man is speaking facts meme')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('The facts being spoken')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('whowould')
                .setDescription('Who Would Win? — two users face off')
                .addUserOption(option =>
                    option.setName('user1')
                        .setDescription('First competitor')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option.setName('user2')
                        .setDescription('Second competitor')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('alert')
                .setDescription('Create a fake iPhone alert')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Alert message')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('caution')
                .setDescription('Create a caution banner')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Caution message')
                        .setRequired(true)
                )
        ),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Memes] Defer failed:', err.message);
                return;
            }
        }

        const VALID_SUBS = new Set([
            'drake', 'biden', 'pikachu', 'pooh', 'oogway',
            'opinion', 'facts', 'whowould', 'alert', 'caution'
        ]);

        let subcommand = '';
        let optionsMock = {};

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            const rawSub = args?.[0]?.toLowerCase();
            if (rawSub && VALID_SUBS.has(rawSub)) {
                subcommand = rawSub;
                const queryStr = args.slice(1).join(' ');

                
                const getMentionedUser = (idx = 0) => {
                    const mentionIds = [...(interaction.content?.matchAll(/<@!?(\d+)>/g) || [])].map(m => m[1]);
                    const uid = mentionIds[idx];
                    return uid ? interaction.guild?.members?.cache?.get(uid)?.user || null : null;
                };

                if (subcommand === 'drake' || subcommand === 'pooh') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.top = parts[0].trim();
                        optionsMock.bottom = parts[1].trim();
                        optionsMock.text1 = parts[0].trim();
                        optionsMock.text2 = parts[1].trim();
                    } else {
                        const words = queryStr.split(' ');
                        const mid = Math.ceil(words.length / 2);
                        optionsMock.top = words.slice(0, mid).join(' ').trim();
                        optionsMock.bottom = words.slice(mid).join(' ').trim();
                        optionsMock.text1 = optionsMock.top;
                        optionsMock.text2 = optionsMock.bottom;
                    }
                } else if (subcommand === 'whowould') {
                    
                    optionsMock._user1 = getMentionedUser(0) || interaction.author;
                    optionsMock._user2 = getMentionedUser(1) || interaction.author;
                } else if (subcommand === 'opinion') {
                    
                    const mentionMatch = queryStr.match(/^<@!?(\d+)>\s*/);
                    if (mentionMatch) {
                        const uid = mentionMatch[1];
                        optionsMock._user = interaction.guild?.members?.cache?.get(uid)?.user || null;
                        optionsMock.text = queryStr.replace(/^<@!?(\d+)>\s*/, '').trim() || 'No opinion provided';
                    } else {
                        optionsMock._user = null;
                        optionsMock.text = queryStr.trim();
                    }
                } else {
                    optionsMock.text = queryStr.trim();
                    optionsMock.quote = queryStr.trim();
                }
            } else {
                subcommand = 'help';
            }
        }

        if (!isSlash) {
            interaction.options = {
                getSubcommand: () => subcommand,
                getString: (name) => optionsMock[name] || null,
                getUser: (name) => {
                    if (name === 'user') return optionsMock._user || interaction.author;
                    if (name === 'user1') return optionsMock._user1 || interaction.author;
                    if (name === 'user2') return optionsMock._user2 || interaction.author;
                    return null;
                }
            };
        }


        if (subcommand === 'help') {
            const helpTitle = lang.fun.meme.guideTitle
                .replace('{emoji}', getEmoji('games'));
            const helpDesc = lang.fun.meme.guideDesc;
            const subcommandsTitle = lang.fun.meme.subcommandsTitle;
            const subcommandsList = lang.fun.meme.subcommandsList;

            const helpCard = buildCard({
                title: helpTitle,
                description: `${helpDesc}\n\n### **${subcommandsTitle}**\n\n${subcommandsList}`,
                accentColor: ACCENT.primary
            });

            return await sendV2(interaction, helpCard);
        }

        try {
            let imageUrl = '';
            let title = '';

            switch (subcommand) {
                case 'drake': {
                    const drakeTop = interaction.options.getString('top') || lang.fun.meme.drakeTopDefault;
                    const drakeBottom = interaction.options.getString('bottom') || lang.fun.meme.drakeBottomDefault;
                    imageUrl = `${POPCAT_API_URL}/drake?text1=${encodeURIComponent(drakeTop)}&text2=${encodeURIComponent(drakeBottom)}`;
                    title = lang.fun.meme.drakeTitle;
                    break;
                }
                case 'biden': {
                    const bidenText = interaction.options.getString('text') || lang.fun.meme.bidenTextDefault;
                    imageUrl = `${POPCAT_API_URL}/biden?text=${encodeURIComponent(bidenText)}`;
                    title = lang.fun.meme.bidenTitle;
                    break;
                }
                case 'pikachu': {
                    const pikachuText = interaction.options.getString('text') || lang.fun.meme.pikachuTextDefault;
                    imageUrl = `${POPCAT_API_URL}/pikachu?text=${encodeURIComponent(pikachuText)}`;
                    title = lang.fun.meme.pikachuTitle;
                    break;
                }
                case 'pooh': {
                    const poohText1 = interaction.options.getString('text1') || lang.fun.meme.poohText1Default;
                    const poohText2 = interaction.options.getString('text2') || lang.fun.meme.poohText2Default;
                    imageUrl = `${POPCAT_API_URL}/pooh?text1=${encodeURIComponent(poohText1)}&text2=${encodeURIComponent(poohText2)}`;
                    title = lang.fun.meme.poohTitle;
                    break;
                }
                case 'oogway': {
                    const oogwayQuote = interaction.options.getString('quote') || lang.fun.meme.oogwayQuoteDefault;
                    imageUrl = `${POPCAT_API_URL}/oogway?text=${encodeURIComponent(oogwayQuote)}`;
                    title = lang.fun.meme.oogwayTitle;
                    break;
                }
                case 'opinion': {
                    const opinionText = interaction.options.getString('text') || lang.fun.meme.opinionTextDefault;
                    const opinionTarget = interaction.options.getUser?.('user') || (isSlash ? interaction.user : interaction.author);
                    const opinionAvatar = getCleanAvatar(opinionTarget, 0);
                    imageUrl = `${POPCAT_API_URL}/v2/opinion?image=${encodeURIComponent(opinionAvatar)}&text=${encodeURIComponent(opinionText)}`;
                    title = lang.fun.meme.opinionTitle;
                    break;
                }
                case 'facts': {
                    const factsText = interaction.options.getString('text') || lang.fun.meme.factsTextDefault;
                    imageUrl = `${POPCAT_API_URL}/facts?text=${encodeURIComponent(factsText)}`;
                    title = lang.fun.meme.factsTitle;
                    break;
                }
                case 'whowould': {
                    const wwUser1 = interaction.options.getUser?.('user1') || (isSlash ? interaction.user : interaction.author);
                    const wwUser2 = interaction.options.getUser?.('user2') || (isSlash ? interaction.user : interaction.author);
                    const wwAvatar1 = getCleanAvatar(wwUser1, 0);
                    const wwAvatar2 = getCleanAvatar(wwUser2, 1);
                    imageUrl = `${POPCAT_API_URL}/v2/whowouldwin?image1=${encodeURIComponent(wwAvatar1)}&image2=${encodeURIComponent(wwAvatar2)}`;
                    title = lang.fun.meme.whowouldTitle;
                    break;
                }
                case 'alert': {
                    const alertText = interaction.options.getString('text') || lang.fun.meme.alertTextDefault;
                    imageUrl = `${POPCAT_API_URL}/alert?text=${encodeURIComponent(alertText)}`;
                    title = lang.fun.meme.alertTitle;
                    break;
                }
                case 'caution': {
                    const cautionText = interaction.options.getString('text') || lang.fun.meme.cautionTextDefault;
                    imageUrl = `${POPCAT_API_URL}/caution?text=${encodeURIComponent(cautionText)}`;
                    title = lang.fun.meme.cautionTitle;
                    break;
                }
            }

            const author = isSlash ? interaction.user : interaction.author;
            const authorName = author.displayName || author.username;
            const cardTitle = `${getEmoji('games')} ${title}`;
            const footerText = lang.fun.meme.createdBy.replace('{user}', authorName);

            const card = buildCard({
                title: cardTitle,
                bannerURL: imageUrl,
                footer: footerText,
                accentColor: ACCENT.primary
            });

            await sendV2(interaction, card);
        } catch (error) {
            console.error('Meme command error:', error);
            const errTitle = lang.fun.meme.errorTitle.replace('{emoji}', getEmoji('cross'));
            const errDesc = lang.fun.meme.errorDesc;
            await sendV2(interaction, cards.error(errTitle, errDesc));
        }
    }
};
