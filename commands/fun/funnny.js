
const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');

const POPCAT_API_URL = (process.env.POPCAT_API_URL || 'https://api.popcat.xyz').replace(/\/+$/, '');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('funny')
        .setDescription('Fun commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('pickup')
                .setDescription('Get a random pickup line')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('showerthought')
                .setDescription('Get a random shower thought')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('wouldyourather')
                .setDescription('Get a would you rather question')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('mock')
                .setDescription('Convert text to sarcastic mocking tone')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to mock')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('lulcat')
                .setDescription('Translate text to funny Lul Cat language')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to translate to cat language')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('emojipasta')
                .setDescription('Turn your text into a funny mess of emojis')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to emojify')
                        .setRequired(true)
                )
        ),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Funny] Defer failed:', err.message);
                return;
            }
        }

        const VALID_SUBS = new Set(['pickup', 'showerthought', 'wouldyourather', 'mock', 'lulcat', 'emojipasta']);
        let subcommand = 'pickup';

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            const rawSub = args?.[0]?.toLowerCase();
            if (rawSub === 'wyr') {
                subcommand = 'wouldyourather';
            } else if (rawSub && VALID_SUBS.has(rawSub)) {
                subcommand = rawSub;
            } else {
                subcommand = 'pickup';
            }

            const textArg = args?.slice(1).join(' ') || '';
            interaction.options = {
                getSubcommand: () => subcommand,
                getString: (name) => {
                    if (name === 'text') return textArg || 'Hello world!';
                    return null;
                }
            };
        }

        try {
            let card;

            switch (subcommand) {
                case 'pickup': {
                    const response = await axios.get(`${POPCAT_API_URL}/pickuplines`);
                    const cardTitle = lang.fun.funny.pickupTitle.replace('{emoji}', getEmoji('heart'));

                    card = buildCard({
                        title: cardTitle,
                        description: `*"${response.data.pickupline}"*`,
                        accentColor: 0xFF69B4
                    });
                    break;
                }

                case 'showerthought': {
                    const response = await axios.get(`${POPCAT_API_URL}/showerthoughts`);
                    const cardTitle = lang.fun.funny.showerThoughtTitle.replace('{emoji}', getEmoji('info'));
                    const upvoteText = lang.fun.funny.upvotes
                        .replace('{upvoteEmoji}', getEmoji('like'))
                        .replace('{upvotes}', response.data.upvotes || 0);

                    card = buildCard({
                        title: cardTitle,
                        description: `*"${response.data.result}"*`,
                        footer: upvoteText,
                        accentColor: ACCENT.info
                    });
                    break;
                }

                case 'wouldyourather': {
                    const response = await axios.get(`${POPCAT_API_URL}/wyr`);
                    const cardTitle = lang.fun.funny.wyrTitle.replace('{emoji}', getEmoji('help'));
                    const orLabel = lang.fun.funny.or;
                    const content = `**Option A:** ${response.data.ops1}\n\n— **${orLabel}** —\n\n**Option B:** ${response.data.ops2}`;

                    card = buildCard({
                        title: cardTitle,
                        description: content,
                        accentColor: ACCENT.primary
                    });
                    break;
                }

                case 'mock': {
                    const mockText = interaction.options.getString('text');
                    const response = await axios.get(`${POPCAT_API_URL}/mock?text=${encodeURIComponent(mockText)}`);
                    const cardTitle = lang.fun.funny.mockTitle.replace('{emoji}', getEmoji('smile'));

                    card = buildCard({
                        title: cardTitle,
                        description: `${response.data.text}`,
                        accentColor: ACCENT.warning
                    });
                    break;
                }

                case 'lulcat': {
                    const catText = interaction.options.getString('text');
                    const response = await axios.get(`${POPCAT_API_URL}/lulcat?text=${encodeURIComponent(catText)}`);
                    const cardTitle = lang.fun.funny.catTitle.replace('{emoji}', getEmoji('smile'));
                    const originalLabel = lang.fun.funny.original;
                    const catLangLabel = lang.fun.funny.catLanguage;
                    const content = `**${originalLabel}:** ${catText}\n\n**${catLangLabel}:** ${response.data.text}`;

                    card = buildCard({
                        title: cardTitle,
                        description: content,
                        accentColor: ACCENT.warning
                    });
                    break;
                }

                case 'emojipasta': {
                    const pastaText = interaction.options.getString('text');
                    const response = await axios.get(`${POPCAT_API_URL}/v2/emojipasta?text=${encodeURIComponent(pastaText)}`);
                    const cardTitle = lang.fun.funny.emojipastaTitle.replace('{emoji}', getEmoji('smile'));

                    card = buildCard({
                        title: cardTitle,
                        description: response.data.message?.text || pastaText,
                        accentColor: 0xFF6B35
                    });
                    break;
                }

                default: {
                    card = cards.error(
                        lang.fun.funny.errorTitle.replace('{emoji}', getEmoji('cross')),
                        lang.fun.common.genericError
                    );
                    break;
                }
            }

            return await sendV2(interaction, card);

        } catch (error) {
            console.error('Fun command error:', error);
            const errCard = cards.error(
                lang.fun.funny.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.funny.error || lang.fun.common.genericError
            );
            return await sendV2(interaction, errCard);
        }
    }
};