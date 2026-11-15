

const { SlashCommandBuilder } = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');

const POPCAT_API_URL = (process.env.POPCAT_API_URL || 'https://api.popcat.xyz').replace(/\/+$/, '');

function normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return url;
    return url.replace(/\.webp(?:\?.*)?$/i, '.png');
}

const SUB_ALIASES = {
    'quotecard': 'quote',
    'imgquote': 'quote',
    'imageship': 'ship',
    'hue': 'huerotate',
    'rotatehue': 'huerotate'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription('Image manipulation commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('blur')
                .setDescription('Blur an image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to blur')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('invert')
                .setDescription('Invert the colors of an image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to invert')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('greyscale')
                .setDescription('Convert image to greyscale')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to convert')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('huerotate')
                .setDescription('Rotate the hue of an image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to rotate hue')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('degrees')
                        .setDescription('Degrees of hue rotation (1-360, default: 120)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(360)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('colorify')
                .setDescription('Overlay colors on your image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to colorify')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Color to overlay (red, blue, green, etc.)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Red', value: 'red' },
                            { name: 'Blue', value: 'blue' },
                            { name: 'Green', value: 'green' },
                            { name: 'Yellow', value: 'yellow' },
                            { name: 'Purple', value: 'purple' },
                            { name: 'Orange', value: 'orange' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('jail')
                .setDescription('Add jail overlay to image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to put in jail')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('wanted')
                .setDescription('Create a wanted poster with your image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image for wanted poster')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('gun')
                .setDescription('Add gun overlay to image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to add gun to')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('communism')
                .setDescription('Add communist overlay to image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to add communist overlay')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('drip')
                .setDescription('Add expensive drip jacket overlay')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to add drip to')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clown')
                .setDescription('Turn someone into a clown')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to clownify')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('uncover')
                .setDescription('Uncover someone hiding behind a wall')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to uncover')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ad')
                .setDescription('Make yourself an ad')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image for the ad')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('mnm')
                .setDescription('Turn your image into M&M shape')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to M&M-ify')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pet')
                .setDescription('Create a pet-pet GIF of any image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to pet')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('nokia')
                .setDescription('Add your image on Nokia screen')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image for Nokia screen')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sadcat')
                .setDescription('Create a sad cat meme')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text for the sad cat meme')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ship')
                .setDescription('Create a ship combination of 2 avatars')
                .addAttachmentOption(option =>
                    option.setName('image1')
                        .setDescription('First person\'s avatar')
                        .setRequired(true)
                )
                .addAttachmentOption(option =>
                    option.setName('image2')
                        .setDescription('Second person\'s avatar')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('quote')
                .setDescription('Quote text with image background')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Background image')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Quote text')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Author name (defaults to your username)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tweet')
                .setDescription('Generate a realistic fake tweet')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Tweet content')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Display name (defaults to your username)')
                        .setRequired(false)
                )
                .addAttachmentOption(option =>
                    option.setName('avatar')
                        .setDescription('Avatar image (defaults to your avatar)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('achievement')
                .setDescription('Generate a Minecraft-style achievement popup')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Achievement text')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('caption')
                .setDescription('Add a meme-style caption to any image')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('Image to caption')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Caption text')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('dark')
                        .setDescription('Use dark background for caption (default: false)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('supreme')
                .setDescription('Generate the iconic Supreme logo with custom text')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text for the Supreme logo')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('couldread')
                .setDescription('If those kids could read, they\'d be very upset')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text for the meme')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('discordmsg')
                .setDescription('Generate a fake Discord message image')
                .addStringOption(option =>
                    option.setName('content')
                        .setDescription('Message content')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Display name (defaults to your username)')
                        .setRequired(false)
                )
                .addAttachmentOption(option =>
                    option.setName('avatar')
                        .setDescription('Avatar image (defaults to your avatar)')
                        .setRequired(false)
                )
        ),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        const VALID_SUBS = new Set([
            'blur', 'invert', 'greyscale', 'huerotate', 'colorify', 'jail',
            'wanted', 'gun', 'communism', 'drip', 'clown', 'uncover', 'ad',
            'mnm', 'pet', 'nokia', 'sadcat', 'ship', 'quote',
            'tweet', 'achievement', 'caption', 'supreme', 'couldread', 'discordmsg'
        ]);

        let subcommand = '';
        let optionsMock = {};

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            let rawSub = args?.[0]?.toLowerCase();
            if (rawSub && SUB_ALIASES[rawSub]) {
                rawSub = SUB_ALIASES[rawSub];
            }
            if (rawSub && VALID_SUBS.has(rawSub)) {
                subcommand = rawSub;

                const resolveUser = (input) => {
                    if (!input) return null;
                    const mentionMatch = input.match(/^<@!?(\d+)>$/);
                    if (mentionMatch) {
                        const userId = mentionMatch[1];
                        const resolved = client.users.cache.get(userId);
                        if (resolved) return resolved;
                    }
                    if (/^\d+$/.test(input)) {
                        const resolved = client.users.cache.get(input);
                        if (resolved) return resolved;
                    }
                    const username = input.toLowerCase();
                    const resolved = client.users.cache.find(u => u.username.toLowerCase() === username || u.displayName?.toLowerCase() === username);
                    if (resolved) return resolved;
                    return null;
                };

                const getAvatar = (user) => {
                    return user.displayAvatarURL({ extension: 'png', size: 1024 });
                };

                const attachment1 = interaction.attachments?.first()?.url;
                const attachment2 = interaction.attachments?.at(1)?.url;

                if (subcommand === 'ship') {
                    let url1 = attachment1;
                    let url2 = attachment2;

                    if (!url1) {
                        const user1 = resolveUser(args[1]);
                        url1 = user1 ? getAvatar(user1) : getAvatar(interaction.author);
                    }
                    if (!url2) {
                        const user2 = resolveUser(args[2]);
                        url2 = user2 ? getAvatar(user2) : getAvatar(client.user);
                    }

                    optionsMock.image1 = { url: url1 };
                    optionsMock.image2 = { url: url2 };
                } else if (subcommand === 'quote') {
                    let url = attachment1;
                    let text = '';
                    let name = '';

                    const remainingArgs = args.slice(1);
                    const potentialUser = resolveUser(remainingArgs[0]);
                    if (potentialUser) {
                        url = getAvatar(potentialUser);
                        name = potentialUser.displayName || potentialUser.username;
                        text = remainingArgs.slice(1).join(' ');
                    } else if (url) {
                        text = remainingArgs.join(' ');
                        name = interaction.author.displayName || interaction.author.username;
                    } else {
                        url = getAvatar(interaction.author);
                        text = remainingArgs.join(' ');
                        name = interaction.author.displayName || interaction.author.username;
                    }

                    optionsMock.image = { url: url };
                    optionsMock.text = text || 'Inspirational quote';
                    optionsMock.name = name || 'Anonymous';
                } else if (subcommand === 'sadcat') {
                    const text = args.slice(1).join(' ');
                    optionsMock.text = text || 'Why are we still here?';
                } else if (subcommand === 'huerotate') {
                    let url = attachment1;
                    let deg = 120;
                    const remainingArgs = args.slice(1);
                    const potentialUser = resolveUser(remainingArgs[0]);
                    if (potentialUser) {
                        url = getAvatar(potentialUser);
                        if (remainingArgs[1] && !isNaN(parseInt(remainingArgs[1]))) {
                            deg = parseInt(remainingArgs[1]);
                        }
                    } else if (remainingArgs[0] && !isNaN(parseInt(remainingArgs[0]))) {
                        deg = parseInt(remainingArgs[0]);
                        if (!url) url = getAvatar(interaction.author);
                    } else {
                        if (!url) url = getAvatar(interaction.author);
                    }
                    optionsMock.image = { url };
                    optionsMock.degrees = deg;
                } else if (subcommand === 'colorify') {
                    let url = attachment1;
                    let color = 'red';

                    const remainingArgs = args.slice(1);
                    const validColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

                    let colorArg = remainingArgs.find(arg => validColors.includes(arg.toLowerCase()));
                    if (colorArg) {
                        color = colorArg.toLowerCase();
                    }

                    const filteredArgs = remainingArgs.filter(arg => arg.toLowerCase() !== color);
                    const potentialUser = resolveUser(filteredArgs[0]);
                    if (!url) {
                        url = potentialUser ? getAvatar(potentialUser) : getAvatar(interaction.author);
                    }

                    optionsMock.image = { url: url };
                    optionsMock.color = color;
                } else if (subcommand === 'tweet') {
                    const text = args.slice(1).join(' ');
                    const tweetName = interaction.author.displayName || interaction.author.username;
                    const tweetUsername = (interaction.author.username || 'user').toLowerCase().replace(/\s+/g, '_');
                    const pfpUrl = normalizeImageUrl(getAvatar(interaction.author));
                    optionsMock.text = text || 'Just tweeted from my Discord bot!';
                    optionsMock.name = tweetName;
                    optionsMock.username = tweetUsername;
                    optionsMock.avatar = { url: pfpUrl };
                } else if (subcommand === 'achievement') {
                    optionsMock.text = args.slice(1).join(' ') || 'Achievement Unlocked!';
                } else if (subcommand === 'caption') {
                    const url = attachment1;
                    const text = args.slice(1).join(' ');
                    optionsMock.image = { url: url || getAvatar(interaction.author) };
                    optionsMock.text = text || 'Caption goes here';
                    optionsMock.dark = false;
                } else if (subcommand === 'supreme') {
                    optionsMock.text = args.slice(1).join(' ') || 'Supreme';
                } else if (subcommand === 'couldread') {
                    optionsMock.text = args.slice(1).join(' ') || 'This bot is amazing';
                } else if (subcommand === 'discordmsg') {
                    const content = args.slice(1).join(' ');
                    const pfpUrl = normalizeImageUrl(getAvatar(interaction.author));
                    optionsMock.content = content || 'Hello from this bot!';
                    optionsMock.username = interaction.author.displayName || interaction.author.username;
                    optionsMock.avatar = { url: pfpUrl };
                } else {
                    let url = attachment1;
                    const remainingArgs = args.slice(1);
                    const potentialUser = resolveUser(remainingArgs[0]);
                    if (!url) {
                        url = potentialUser ? getAvatar(potentialUser) : getAvatar(interaction.author);
                    }
                    optionsMock.image = { url: url };
                }
            } else {
                subcommand = 'help';
            }
        }

        if (!isSlash && subcommand === 'help') {
            const title = lang.fun.image.guideTitle.replace('{emoji}', getEmoji('image'));
            const helpCard = buildCard({
                title,
                description: lang.fun.image.guideDescription,
                sections: [
                    `**Usage:** \`!image <filter> [@user or attach image]\`\n\n` +
                    `**Image Filters:**\n` +
                    `• \`blur\`, \`invert\`, \`greyscale\`, \`huerotate\`, \`colorify\`\n` +
                    `• \`jail\`, \`wanted\`, \`gun\`, \`communism\`, \`drip\`, \`clown\`, \`uncover\`, \`ad\`, \`mnm\`, \`pet\`, \`nokia\`\n` +
                    `**Meme & Text Generators:**\n` +
                    `• \`sadcat <text>\`, \`achievement <text>\`, \`supreme <text>\`, \`couldread <text>\`\n` +
                    `• \`caption <text>\` - Add caption to attached image\n` +
                    `• \`tweet <text>\` - Fake tweet with your avatar & username\n` +
                    `• \`discordmsg <text>\` - Fake Discord message image\n` +
                    `• \`ship <@user1> <@user2>\` - Ship combo of two avatars\n` +
                    `• \`quote <@user> <quote text>\` - Quote card with target avatar`
                ],
                accentColor: 0x9932CC
            });
            return await sendV2(interaction, helpCard);
        }

        if (!isSlash) {
            interaction.options = {
                getSubcommand: () => subcommand,
                getAttachment: (name) => optionsMock[name] || null,
                getString: (name) => (typeof optionsMock[name] === 'string' ? optionsMock[name] : null),
                getInteger: (name) => (typeof optionsMock[name] === 'number' ? optionsMock[name] : null)
            };
        }

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Image] Defer failed:', err.message);
                return;
            }
        }

        const sendReply = async (card) => {
            return await sendV2(interaction, card);
        };

        try {
            let imageUrl;
            let title = 'Image Filter';

            switch (subcommand) {
                case 'blur': {
                    const blurImage = interaction.options.getAttachment('image');
                    if (!blurImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/blur?image=${encodeURIComponent(normalizeImageUrl(blurImage.url))}`;
                    title = 'Blurred Image';
                    break;
                }

                case 'invert': {
                    const invertImage = interaction.options.getAttachment('image');
                    if (!invertImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/invert?image=${encodeURIComponent(normalizeImageUrl(invertImage.url))}`;
                    title = 'Inverted Colors';
                    break;
                }

                case 'greyscale': {
                    const greyImage = interaction.options.getAttachment('image');
                    if (!greyImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/greyscale?image=${encodeURIComponent(normalizeImageUrl(greyImage.url))}`;
                    title = 'Greyscale Filter';
                    break;
                }

                case 'huerotate': {
                    const hueImage = interaction.options.getAttachment('image');
                    const deg = interaction.options.getInteger('degrees') || 120;
                    if (!hueImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/hue-rotate?img=${encodeURIComponent(normalizeImageUrl(hueImage.url))}&deg=${deg}`;
                    title = 'Hue Rotation';
                    break;
                }

                case 'colorify': {
                    const colorImage = interaction.options.getAttachment('image');
                    const color = interaction.options.getString('color') || 'red';
                    if (!colorImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/colorify?image=${encodeURIComponent(normalizeImageUrl(colorImage.url))}&color=${color}`;
                    title = `${color.charAt(0).toUpperCase() + color.slice(1)} Overlay`;
                    break;
                }

                case 'jail': {
                    const jailImage = interaction.options.getAttachment('image');
                    if (!jailImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/jail?image=${encodeURIComponent(normalizeImageUrl(jailImage.url))}`;
                    title = 'Jail Time!';
                    break;
                }

                case 'wanted': {
                    const wantedImage = interaction.options.getAttachment('image');
                    if (!wantedImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/wanted?image=${encodeURIComponent(normalizeImageUrl(wantedImage.url))}`;
                    title = 'Wanted Poster';
                    break;
                }

                case 'gun': {
                    const gunImage = interaction.options.getAttachment('image');
                    if (!gunImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/gun?image=${encodeURIComponent(normalizeImageUrl(gunImage.url))}`;
                    title = 'Armed Target';
                    break;
                }

                case 'communism': {
                    const commImage = interaction.options.getAttachment('image');
                    if (!commImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/communism?image=${encodeURIComponent(normalizeImageUrl(commImage.url))}`;
                    title = 'Our Comrade';
                    break;
                }

                case 'drip': {
                    const dripImage = interaction.options.getAttachment('image');
                    if (!dripImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/drip?image=${encodeURIComponent(normalizeImageUrl(dripImage.url))}`;
                    title = 'Dripping with Style';
                    break;
                }

                case 'clown': {
                    const clownImage = interaction.options.getAttachment('image');
                    if (!clownImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/clown?image=${encodeURIComponent(normalizeImageUrl(clownImage.url))}`;
                    title = 'Clownified';
                    break;
                }

                case 'uncover': {
                    const uncoverImage = interaction.options.getAttachment('image');
                    if (!uncoverImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/uncover?image=${encodeURIComponent(normalizeImageUrl(uncoverImage.url))}`;
                    title = 'Uncovered Target';
                    break;
                }

                case 'ad': {
                    const adImage = interaction.options.getAttachment('image');
                    if (!adImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/ad?image=${encodeURIComponent(normalizeImageUrl(adImage.url))}`;
                    title = 'Sponsored Advertisement';
                    break;
                }

                case 'mnm': {
                    const mnmImage = interaction.options.getAttachment('image');
                    if (!mnmImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/mnm?image=${encodeURIComponent(normalizeImageUrl(mnmImage.url))}`;
                    title = 'M&M Style';
                    break;
                }

                case 'pet': {
                    const petImage = interaction.options.getAttachment('image');
                    if (!petImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/pet?image=${encodeURIComponent(normalizeImageUrl(petImage.url))}`;
                    title = 'Pet Pet GIF';
                    break;
                }

                case 'nokia': {
                    const nokiaImage = interaction.options.getAttachment('image');
                    if (!nokiaImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/nokia?image=${encodeURIComponent(normalizeImageUrl(nokiaImage.url))}`;
                    title = 'Nokia Screen';
                    break;
                }

                case 'sadcat': {
                    const text = interaction.options.getString('text');
                    if (!text) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Text is required for the sad cat meme.'
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/sadcat?text=${encodeURIComponent(text)}`;
                    title = 'Sad Cat Meme';
                    break;
                }

                case 'ship': {
                    const ship1 = interaction.options.getAttachment('image1');
                    const ship2 = interaction.options.getAttachment('image2');
                    if (!ship1 || !ship2) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.twoImagesRequired
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/ship?user1=${encodeURIComponent(normalizeImageUrl(ship1.url))}&user2=${encodeURIComponent(normalizeImageUrl(ship2.url))}`;
                    title = 'Ultimate Ship';
                    break;
                }

                case 'quote': {
                    const quoteImage = interaction.options.getAttachment('image');
                    const quoteText = interaction.options.getString('text') || 'Inspirational text';
                    const author = isSlash ? interaction.user : interaction.author;
                    const authorName = interaction.options.getString('name') || author?.displayName || author?.username || 'Anonymous';
                    if (!quoteImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/quote?image=${encodeURIComponent(normalizeImageUrl(quoteImage.url))}&text=${encodeURIComponent(quoteText)}&name=${encodeURIComponent(authorName)}`;
                    title = 'Quote Card';
                    break;
                }

                case 'tweet': {
                    const tweetText = interaction.options.getString('text');
                    if (!tweetText) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Tweet text is required.'
                        );
                        return await sendReply(err);
                    }
                    const tweetAuthor = isSlash ? interaction.user : interaction.author;
                    const tweetName = interaction.options.getString('name') || tweetAuthor?.displayName || tweetAuthor?.username || 'User';
                    const tweetUsername = (tweetAuthor?.username || 'user').toLowerCase().replace(/\s+/g, '_');
                    const tweetAvatar = interaction.options.getAttachment('avatar');
                    const tweetPfp = tweetAvatar ? normalizeImageUrl(tweetAvatar.url) : normalizeImageUrl(tweetAuthor?.displayAvatarURL({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png');
                    imageUrl = `${POPCAT_API_URL}/v2/tweet?name=${encodeURIComponent(tweetName)}&username=${encodeURIComponent(tweetUsername)}&text=${encodeURIComponent(tweetText)}&pfp=${encodeURIComponent(tweetPfp)}`;
                    title = 'Fake Tweet';
                    break;
                }

                case 'achievement': {
                    const achieveText = interaction.options.getString('text');
                    if (!achieveText) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Achievement text is required.'
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/achievement?text=${encodeURIComponent(achieveText)}`;
                    title = 'Achievement Unlocked';
                    break;
                }

                case 'caption': {
                    const captionImage = interaction.options.getAttachment('image');
                    const captionText = interaction.options.getString('text');
                    const captionDark = interaction.options.getBoolean?.('dark') ?? false;
                    if (!captionImage) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.image.noImageFound
                        );
                        return await sendReply(err);
                    }
                    if (!captionText) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Caption text is required.'
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/caption?image=${encodeURIComponent(normalizeImageUrl(captionImage.url))}&text=${encodeURIComponent(captionText)}&dark=${captionDark}`;
                    title = 'Captioned Image';
                    break;
                }

                case 'supreme': {
                    const supremeText = interaction.options.getString('text');
                    if (!supremeText) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Supreme text is required.'
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/supreme?text=${encodeURIComponent(supremeText)}`;
                    title = 'Supreme Logo';
                    break;
                }

                case 'couldread': {
                    const crText = interaction.options.getString('text');
                    if (!crText) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Text is required for the meme.'
                        );
                        return await sendReply(err);
                    }
                    imageUrl = `${POPCAT_API_URL}/v2/couldread?text=${encodeURIComponent(crText)}`;
                    title = 'If Those Kids Could Read';
                    break;
                }

                case 'discordmsg': {
                    const dmContent = interaction.options.getString('content');
                    if (!dmContent) {
                        const err = cards.error(
                            lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Message content is required.'
                        );
                        return await sendReply(err);
                    }
                    const dmAuthor = isSlash ? interaction.user : interaction.author;
                    const dmUsername = interaction.options.getString('username') || dmAuthor?.displayName || dmAuthor?.username || 'User';
                    const dmAvatar = interaction.options.getAttachment('avatar');
                    const dmPfp = dmAvatar ? normalizeImageUrl(dmAvatar.url) : normalizeImageUrl(dmAuthor?.displayAvatarURL?.({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png');
                    const dmTimestamp = new Date().toISOString();
                    imageUrl = `${POPCAT_API_URL}/v2/discord-message?username=${encodeURIComponent(dmUsername)}&content=${encodeURIComponent(dmContent)}&avatar=${encodeURIComponent(dmPfp)}&timestamp=${encodeURIComponent(dmTimestamp)}`;
                    title = 'Fake Discord Message';
                    break;
                }

                default: {
                    const err = cards.error(
                        lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                        lang.fun.common.genericError
                    );
                    return await sendReply(err);
                }
            }

            const author = isSlash ? interaction.user : interaction.author;
            const processedText = lang.fun.image.processedFor
                .replace('{user}', author.displayName || author.username);

            const card = buildCard({
                title: `${getEmoji('image')} ${title}`,
                description: `*${processedText}*`,
                bannerURL: imageUrl,
                accentColor: 0x9932CC
            });

            await sendReply(card);

        } catch (error) {
            console.error('Image command error:', error);
            const errCard = cards.error(
                lang.fun.image.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.image.error || lang.fun.common.genericError
            );
            await sendReply(errCard);
        }
    }
};