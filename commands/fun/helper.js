
const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');

const POPCAT_API_URL = (process.env.POPCAT_API_URL || 'https://api.popcat.xyz').replace(/\/+$/, '');

function hexToRgb(hexStr) {
    if (!hexStr || typeof hexStr !== 'string') return null;
    const clean = hexStr.replace(/^#+/, '').trim();
    let fullHex = clean;
    if (clean.length === 3) {
        fullHex = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(fullHex, 16);
    if (isNaN(num) || fullHex.length !== 6) return null;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgb(${r}, ${g}, ${b})`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('helper')
        .setDescription('Utility and helper commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('color')
                .setDescription('Get info on a hex color')
                .addStringOption(option =>
                    option.setName('hex')
                        .setDescription('Hex color code (without #)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('randomcolor')
                .setDescription('Get a random hex color with image & name')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('periodic')
                .setDescription('Get info on a chemical element')
                .addStringOption(option =>
                    option.setName('element')
                        .setDescription('Element name, symbol, or number')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('randomperiodic')
                .setDescription('Get a random element from the periodic table')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('translate')
                .setDescription('Translate text to specified language')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to translate')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('to')
                        .setDescription('Target language code (e.g., es, fr, de)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('encode')
                .setDescription('Encode text into binary')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to encode')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('decode')
                .setDescription('Decode binary into text')
                .addStringOption(option =>
                    option.setName('binary')
                        .setDescription('Binary code to decode')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reverse')
                .setDescription('Reverse the provided text')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to reverse')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('morse')
                .setDescription('Convert text to morse code')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to convert to morse')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('doublestruck')
                .setDescription('Convert text to double struck font')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to convert')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('screenshot')
                .setDescription('Screenshot a website')
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('Website URL to screenshot')
                        .setRequired(true)
                )
        ),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        const VALID_SUBS = new Set([
            'color', 'randomcolor', 'periodic', 'randomperiodic', 'translate',
            'encode', 'decode', 'reverse', 'morse', 'doublestruck', 'screenshot'
        ]);

        let subcommand = '';
        let optionsMock = {};

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            const rawSub = args?.[0]?.toLowerCase();
            if (rawSub && VALID_SUBS.has(rawSub)) {
                subcommand = rawSub;

                if (subcommand === 'translate') {
                    let text = '';
                    let to = 'en';
                    const input = args.slice(1).join(' ');
                    const commaIdx = input.lastIndexOf(',');
                    if (commaIdx !== -1) {
                        text = input.substring(0, commaIdx).trim();
                        to = input.substring(commaIdx + 1).trim();
                    } else {
                        const words = args.slice(1);
                        if (words.length >= 2) {
                            if (words[0].length <= 3) {
                                to = words[0];
                                text = words.slice(1).join(' ');
                            } else if (words[words.length - 1].length <= 3) {
                                to = words[words.length - 1];
                                text = words.slice(0, words.length - 1).join(' ');
                            } else {
                                to = 'en';
                                text = words.join(' ');
                            }
                        } else {
                            text = words.join(' ');
                            to = 'en';
                        }
                    }
                    optionsMock.text = text;
                    optionsMock.to = to;
                } else {
                    const val = args.slice(1).join(' ');
                    optionsMock.hex = val;
                    optionsMock.element = val;
                    optionsMock.text = val;
                    optionsMock.binary = val;
                    optionsMock.url = val;
                }
            } else {
                subcommand = 'help';
            }
        }

        if (!isSlash && subcommand === 'help') {
            const title = lang.fun.helper.guideTitle.replace('{emoji}', getEmoji('settings'));
            const helpCard = buildCard({
                title,
                description: lang.fun.helper.guideDescription,
                sections: [
                    `**Usage:** \`!helper <command> <arguments>\`\n\n` +
                    `**Available Commands:**\n` +
                    `• \`color <hex>\` - Info on a hex color (e.g. \`ff0000\`)\n` +
                    `• \`randomcolor\` - Get a random color\n` +
                    `• \`periodic <element>\` - Info on element (e.g. \`gold\`, \`Au\`, \`79\`)\n` +
                    `• \`randomperiodic\` - Get a random chemical element\n` +
                    `• \`translate <text>, <language_code>\` - Translate text (e.g. \`hello, es\`)\n` +
                    `• \`encode <text>\` - Encode text to binary\n` +
                    `• \`decode <binary>\` - Decode binary to text\n` +
                    `• \`reverse <text>\` - Reverse text\n` +
                    `• \`morse <text>\` - Convert text to morse code\n` +
                    `• \`doublestruck <text>\` - Convert text to double struck font\n` +
                    `• \`screenshot <url>\` - Screenshot a website`
                ],
                accentColor: ACCENT.primary
            });
            return await sendV2(interaction, helpCard);
        }

        if (!isSlash) {
            interaction.options = {
                getSubcommand: () => subcommand,
                getString: (name) => optionsMock[name] || null
            };
        }

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Helper] Defer failed:', err.message);
                return;
            }
        }

        const sendReply = async (card) => {
            return await sendV2(interaction, card);
        };

        try {
            let response, card;

            switch (subcommand) {
                case 'color': {
                    const rawHex = interaction.options.getString('hex');
                    if (!rawHex) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.helper.missingHex
                        );
                        return await sendReply(err);
                    }
                    const cleanHex = rawHex.replace(/^#+/, '').trim();
                    try {
                        response = await axios.get(`${POPCAT_API_URL}/color/${cleanHex}`, { timeout: 8000 });
                    } catch (e) {
                        response = null;
                    }

                    if (!response || !response.data || response.data.error) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Please provide a valid 6-character hex color code (e.g. `FFFFFF` or `#00FF00`).'
                        );
                        return await sendReply(err);
                    }

                    const data = response.data;
                    const hexUpper = cleanHex.toUpperCase();
                    const displayHex = data.hex ? (data.hex.startsWith('#') ? data.hex : `#${data.hex}`) : `#${hexUpper}`;
                    const rgbValue = typeof data.rgb === 'string' && data.rgb.startsWith('rgb')
                        ? data.rgb
                        : (hexToRgb(cleanHex) || 'rgb(0, 0, 0)');
                    const imgUrl = (typeof data.color_image === 'string' && data.color_image)
                        ? data.color_image
                        : `${POPCAT_API_URL}/color/image/${cleanHex}`;

                    const title = lang.fun.helper.colorTitle
                        .replace('{emoji}', getEmoji('palette'))
                        .replace('{hex}', hexUpper);

                    const desc = [
                        `> **Name:** ${data.name || 'Unknown'}`,
                        `> **Hex:** \`${displayHex}\``,
                        `> **RGB:** \`${rgbValue}\``
                    ].join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        thumbnailURL: imgUrl,
                        accentColor: parseInt(cleanHex, 16) || ACCENT.primary
                    });

                    await sendReply(card);
                    break;
                }

                case 'randomcolor': {
                    response = await axios.get(`${POPCAT_API_URL}/randomcolor`, { timeout: 8000 });
                    const rawRandHex = response.data?.hex || '000000';
                    const randHex = rawRandHex.replace(/^#+/, '').trim();
                    const displayHex = `#${randHex.toUpperCase()}`;
                    const rgbValue = hexToRgb(randHex) || 'rgb(0, 0, 0)';
                    const title = lang.fun.helper.randomColorTitle.replace('{emoji}', getEmoji('palette'));
                    const imgUrl = response.data?.image || response.data?.color_image || `${POPCAT_API_URL}/color/image/${randHex}`;

                    const desc = [
                        `> **Name:** ${response.data?.name || 'Unknown'}`,
                        `> **Hex:** \`${displayHex}\``,
                        `> **RGB:** \`${rgbValue}\``
                    ].join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        thumbnailURL: imgUrl,
                        accentColor: parseInt(randHex, 16) || ACCENT.primary
                    });

                    await sendReply(card);
                    break;
                }

                case 'periodic': {
                    const element = interaction.options.getString('element');
                    if (!element) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.helper.missingElement
                        );
                        return await sendReply(err);
                    }
                    try {
                        response = await axios.get(`${POPCAT_API_URL}/periodic-table?element=${encodeURIComponent(element)}`, { timeout: 8000 });
                    } catch (e) {
                        response = null;
                    }

                    if (!response || !response.data || response.data.error) {
                        const errMsg = response?.data?.error || 'Invalid element, please enter a valid element symbol, name, or atomic number.';
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            errMsg
                        );
                        return await sendReply(err);
                    }

                    const title = lang.fun.helper.periodicTitle
                        .replace('{emoji}', getEmoji('atom'))
                        .replace('{name}', response.data.name || element)
                        .replace('{symbol}', response.data.symbol || '');

                    const desc = [
                        `> ${response.data.summary || 'No summary available.'}`,
                        '',
                        `• **Atomic Number:** ${response.data.atomic_number ?? 'N/A'}`,
                        `• **Atomic Mass:** ${response.data.atomic_mass ?? 'N/A'}`,
                        `• **Period:** ${response.data.period ?? 'N/A'}`,
                        response.data.phase ? `• **Phase:** ${response.data.phase}` : null,
                        response.data.discovered_by ? `• **Discovered By:** ${response.data.discovered_by}` : null
                    ].filter(Boolean).join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        thumbnailURL: (response.data.image && typeof response.data.image === 'string') ? response.data.image : null,
                        accentColor: 0x0099FF
                    });

                    await sendReply(card);
                    break;
                }

                case 'randomperiodic': {
                    const randomAtomicNumber = Math.floor(Math.random() * 118) + 1;
                    try {
                        response = await axios.get(`${POPCAT_API_URL}/periodic-table?element=${randomAtomicNumber}`, { timeout: 8000 });
                    } catch (e) {
                        response = null;
                    }

                    if (!response || !response.data || response.data.error) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Failed to fetch a random periodic element. Please try again later.'
                        );
                        return await sendReply(err);
                    }

                    const title = lang.fun.helper.randomPeriodicTitle
                        .replace('{emoji}', getEmoji('atom'))
                        .replace('{name}', response.data.name || `Element ${randomAtomicNumber}`)
                        .replace('{symbol}', response.data.symbol || '');

                    const desc = [
                        `> ${response.data.summary || 'No summary available.'}`,
                        '',
                        `• **Atomic Number:** ${response.data.atomic_number ?? randomAtomicNumber}`,
                        `• **Atomic Mass:** ${response.data.atomic_mass ?? 'N/A'}`,
                        `• **Period:** ${response.data.period ?? 'N/A'}`,
                        response.data.phase ? `• **Phase:** ${response.data.phase}` : null,
                        response.data.discovered_by ? `• **Discovered By:** ${response.data.discovered_by}` : null
                    ].filter(Boolean).join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        thumbnailURL: (response.data.image && typeof response.data.image === 'string') ? response.data.image : null,
                        accentColor: 0x0099FF
                    });

                    await sendReply(card);
                    break;
                }

                case 'translate': {
                    const text = interaction.options.getString('text');
                    const targetLang = interaction.options.getString('to') || 'en';
                    if (!text) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.helper.missingText
                        );
                        return await sendReply(err);
                    }
                    response = await axios.get(`${POPCAT_API_URL}/translate?to=${targetLang}&text=${encodeURIComponent(text)}`);
                    const title = lang.fun.helper.translateTitle.replace('{emoji}', getEmoji('globe'));

                    const desc = [
                        `**Original Text:**`,
                        `\`\`\`\n${text}\n\`\`\``,
                        `**Translated Text (${targetLang.toUpperCase()}):**`,
                        `\`\`\`\n${response.data.translated}\n\`\`\``
                    ].join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        accentColor: ACCENT.success
                    });

                    await sendReply(card);
                    break;
                }

                case 'encode': {
                    const encodeText = interaction.options.getString('text');
                    if (!encodeText) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.helper.missingText
                        );
                        return await sendReply(err);
                    }
                    response = await axios.get(`${POPCAT_API_URL}/encode?text=${encodeURIComponent(encodeText)}`);
                    const title = lang.fun.helper.encodeTitle.replace('{emoji}', getEmoji('desktop'));

                    const desc = [
                        `**Input Text:**`,
                        `> ${encodeText}`,
                        '',
                        `**Encoded Binary:**`,
                        `\`\`\`\n${response.data.binary}\n\`\`\``
                    ].join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        accentColor: 0x2ecc71
                    });

                    await sendReply(card);
                    break;
                }

                case 'decode': {
                    const binary = interaction.options.getString('binary');
                    if (!binary) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.helper.missingBinary
                        );
                        return await sendReply(err);
                    }
                    response = await axios.get(`${POPCAT_API_URL}/decode?binary=${encodeURIComponent(binary)}`);
                    const title = lang.fun.helper.decodeTitle.replace('{emoji}', getEmoji('desktop'));

                    const desc = [
                        `**Input Binary:**`,
                        `\`\`\`\n${binary}\n\`\`\``,
                        '',
                        `**Decoded Text:**`,
                        `> ${response.data.text}`
                    ].join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        accentColor: 0x3498db
                    });

                    await sendReply(card);
                    break;
                }

                case 'reverse': {
                    const reverseText = interaction.options.getString('text');
                    if (!reverseText) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.helper.missingText
                        );
                        return await sendReply(err);
                    }
                    response = await axios.get(`${POPCAT_API_URL}/reverse?text=${encodeURIComponent(reverseText)}`);
                    const title = lang.fun.helper.reverseTitle.replace('{emoji}', getEmoji('loop'));

                    const desc = [
                        `**Original:**`,
                        `> ${reverseText}`,
                        '',
                        `**Reversed:**`,
                        `> ${response.data.text}`
                    ].join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        accentColor: 0x9b59b6
                    });

                    await sendReply(card);
                    break;
                }

                case 'morse': {
                    const morseText = interaction.options.getString('text');
                    if (!morseText) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.helper.missingText
                        );
                        return await sendReply(err);
                    }
                    response = await axios.get(`${POPCAT_API_URL}/texttomorse?text=${encodeURIComponent(morseText)}`);
                    const title = lang.fun.helper.morseTitle.replace('{emoji}', getEmoji('wifi'));

                    const desc = [
                        `**Input:**`,
                        `> ${morseText}`,
                        '',
                        `**Morse Output:**`,
                        `\`\`\`\n${response.data.morse}\n\`\`\``
                    ].join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        accentColor: 0xe67e22
                    });

                    await sendReply(card);
                    break;
                }

                case 'doublestruck': {
                    const dsText = interaction.options.getString('text');
                    if (!dsText) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.helper.missingText
                        );
                        return await sendReply(err);
                    }
                    response = await axios.get(`${POPCAT_API_URL}/doublestruck?text=${encodeURIComponent(dsText)}`);
                    const title = lang.fun.helper.doublestruckTitle.replace('{emoji}', getEmoji('document'));

                    const desc = [
                        `**Original:**`,
                        `> ${dsText}`,
                        '',
                        `**Double Struck Output:**`,
                        `> ${response.data.text}`
                    ].join('\n');

                    card = buildCard({
                        title,
                        description: desc,
                        accentColor: 0xf1c40f
                    });

                    await sendReply(card);
                    break;
                }

                case 'screenshot': {
                    const url = interaction.options.getString('url');
                    if (!url) {
                        const err = cards.error(
                            lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.helper.missingUrl
                        );
                        return await sendReply(err);
                    }
                    const screenshotUrl = `${POPCAT_API_URL}/screenshot?url=${encodeURIComponent(url)}`;
                    const title = lang.fun.helper.screenshotTitle.replace('{emoji}', getEmoji('desktop'));

                    card = buildCard({
                        title,
                        description: `> **Target URL:** ${url}`,
                        bannerURL: screenshotUrl,
                        accentColor: 0x0099FF
                    });

                    await sendReply(card);
                    break;
                }

                default: {
                    const err = cards.error(
                        lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                        lang.fun.common.genericError
                    );
                    await sendReply(err);
                    break;
                }
            }

        } catch (error) {
            console.error('Utility command error:', error);
            const errCard = cards.error(
                lang.fun.helper.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.helper.error || lang.fun.common.genericError
            );
            await sendReply(errCard);
        }
    }
};