

'use strict';

const {
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const rawLang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, editV2, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const lang = { ...rawLang, text: createInterpolatableProxy(rawLang.text) };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('text')
        .setDescription('Convert text to various styles, fonts, and formats')
        .addSubcommand(sub => sub
            .setName('style')
            .setDescription('Apply Discord markdown styles to your text')
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('Text to style')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('format')
                    .setDescription('Choose formatting style')
                    .addChoices(
                        { name: 'Bold', value: 'bold' },
                        { name: 'Italic', value: 'italic' },
                        { name: 'Underline', value: 'underline' },
                        { name: 'Strikethrough', value: 'strike' },
                        { name: 'Bold Italic', value: 'bolditalic' },
                        { name: 'Bold Underline', value: 'boldunder' },
                        { name: 'All Styles', value: 'all' },
                        { name: 'Code Block', value: 'code' },
                        { name: 'Inline Code', value: 'inline' },
                        { name: 'Spoiler', value: 'spoiler' }
                    )
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('color')
                    .setDescription('Hex color (without #) for embed background')
                    .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('emoji')
            .setDescription('Convert text to regional indicator emojis')
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('Text to convert to emojis')
                    .setRequired(true))
            .addBooleanOption(option =>
                option.setName('spaces')
                    .setDescription('Add extra spacing between letters')
                    .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('unicode')
            .setDescription('Convert text to Unicode font variations')
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('Text to convert')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('font')
                    .setDescription('Choose Unicode font style')
                    .addChoices(
                        { name: 'Mathematical Bold', value: 'mathbold' },
                        { name: 'Mathematical Italic', value: 'mathitalic' },
                        { name: 'Mathematical Bold Italic', value: 'mathbolditalic' },
                        { name: 'Mathematical Sans-Serif', value: 'mathsans' },
                        { name: 'Mathematical Monospace', value: 'mathmono' },
                        { name: 'Circled Letters', value: 'circled' },
                        { name: 'Squared Letters', value: 'squared' },
                        { name: 'Fullwidth', value: 'fullwidth' },
                        { name: 'Small Caps', value: 'smallcaps' }
                    )
                    .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('fancy')
            .setDescription('Create fancy text with special characters')
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('Text to make fancy')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('style')
                    .setDescription('Choose fancy style')
                    .addChoices(
                        { name: 'Aesthetic Spacing', value: 'aesthetic' },
                        { name: 'Wave Text', value: 'wave' },
                        { name: 'Bubble Text', value: 'bubble' },
                        { name: 'Reversed', value: 'reverse' },
                        { name: 'Upside Down', value: 'upside' },
                        { name: 'Zalgo (Glitchy)', value: 'zalgo' },
                        { name: 'Leet Speak', value: 'leet' }
                    )
                    .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('gradient')
            .setDescription('Create color gradient text effect')
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('Text for gradient effect')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('colors')
                    .setDescription('Two hex colors separated by comma (e.g., FF0000,0000FF)')
                    .setRequired(true))),

    aliases: ['txt', 'style', 'font', 'fancy'],
    category: 'utility',
    description: 'Convert text to various styles, fonts, and formats',
    usage: 'text <subcommand> <options>',

    async execute(interaction, args = []) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await deferReply(interaction);
            }
        } catch (err) {
            console.error('[Text] deferReply failed:', err.message);
            return;
        }
        let subcommand = '';

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            subcommand = args[0]?.toLowerCase();
        }

        const validSubcommands = ['style', 'emoji', 'unicode', 'fancy', 'gradient'];

        
        if (!subcommand || !validSubcommands.includes(subcommand)) {
            const helpCard = buildCard({
                title: lang.text.guide.title.replace('{emoji}', getEmoji('info') || 'ℹ️'),
                description: lang.text.guide.description,
                accentColor: ACCENT.info
            });

            if (isSlash) {
                await sendV2(interaction, helpCard);
            } else {
                const replyMsg = await interaction.reply({ components: [helpCard], flags: MessageFlags.IsComponentsV2 });
                setTimeout(() => {
                    replyMsg.delete().catch(() => { });
                    interaction.delete().catch(() => { });
                }, 15000);
            }
            return;
        }

        
        let text = '';
        let payload = null;

        try {
            if (subcommand === 'style') {
                let format = '';
                let colorInput = null;

                if (isSlash) {
                    text = interaction.options.getString('text');
                    format = interaction.options.getString('format');
                    colorInput = interaction.options.getString('color');
                } else {
                    format = args[1]?.toLowerCase();
                    text = args.slice(2).join(' ');

                    const validFormats = ['bold', 'italic', 'underline', 'strike', 'bolditalic', 'boldunder', 'all', 'code', 'inline', 'spoiler'];
                    if (!format || !validFormats.includes(format) || !text) {
                        return this.sendInvalidParams(interaction);
                    }
                }

                let styledText = this.applyDiscordStyle(text, format);

                if (colorInput && this.isValidHex(colorInput)) {
                    const container = buildCard({
                        sections: [styledText],
                        accentColor: parseInt(colorInput, 16),
                    });
                    payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
                } else {
                    payload = { content: styledText };
                }
            }
            else if (subcommand === 'emoji') {
                let addSpaces = false;

                if (isSlash) {
                    text = interaction.options.getString('text');
                    addSpaces = interaction.options.getBoolean('spaces') ?? false;
                } else {
                    text = args.slice(1).join(' ');
                    if (!text) return this.sendInvalidParams(interaction);
                }

                const emojiText = this.convertToEmojis(text, addSpaces);

                if (emojiText.length > 2000) {
                    const errCard = cards.warning(
                        lang.text.error.tooLong.replace('{emoji}', '').trim()
                    );
                    if (isSlash) {
                        await sendV2(interaction, errCard);
                    } else {
                        const replyMsg = await interaction.channel.send({
                            components: [errCard],
                            flags: MessageFlags.IsComponentsV2
                        });
                        setTimeout(() => {
                            replyMsg.delete().catch(() => { });
                            interaction.delete().catch(() => { });
                        }, 6000);
                    }
                    return;
                }

                payload = { content: emojiText };
            }
            else if (subcommand === 'unicode') {
                let font = '';

                if (isSlash) {
                    text = interaction.options.getString('text');
                    font = interaction.options.getString('font');
                } else {
                    font = args[1]?.toLowerCase();
                    text = args.slice(2).join(' ');

                    const validFonts = ['mathbold', 'mathitalic', 'mathbolditalic', 'mathsans', 'mathmono', 'circled', 'squared', 'fullwidth', 'smallcaps'];
                    if (!font || !validFonts.includes(font) || !text) {
                        return this.sendInvalidParams(interaction);
                    }
                }

                const unicodeText = this.convertToUnicode(text, font);
                const container = buildCard({
                    sections: [unicodeText],
                    footer: lang.text.style.footerStyle.replace('{font}', font),
                    accentColor: ACCENT.primary,
                });

                payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
            }
            else if (subcommand === 'fancy') {
                let style = '';

                if (isSlash) {
                    text = interaction.options.getString('text');
                    style = interaction.options.getString('style');
                } else {
                    style = args[1]?.toLowerCase();
                    text = args.slice(2).join(' ');

                    const validStyles = ['aesthetic', 'wave', 'bubble', 'reverse', 'upside', 'zalgo', 'leet'];
                    if (!style || !validStyles.includes(style) || !text) {
                        return this.sendInvalidParams(interaction);
                    }
                }

                const fancyText = this.applyFancyStyle(text, style);
                payload = { content: fancyText };
            }
            else if (subcommand === 'gradient') {
                let colorString = '';

                if (isSlash) {
                    text = interaction.options.getString('text');
                    colorString = interaction.options.getString('colors');
                } else {
                    colorString = args[1];
                    text = args.slice(2).join(' ');
                }

                if (!colorString || !text) return this.sendInvalidParams(interaction);

                const colors = colorString.split(',');
                if (colors.length !== 2 || !colors.every(c => this.isValidHex(c.trim()))) {
                    return this.sendInvalidParams(interaction);
                }

                const gradientText = this.createGradientText(text, colors[0].trim(), colors[1].trim());
                const container = buildCard({
                    sections: [gradientText],
                    footer: lang.text.style.footerGradient.replace('{start}', colors[0].trim()).replace('{end}', colors[1].trim()),
                    accentColor: parseInt(colors[0].trim(), 16),
                });

                payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
            }

            
            if (isSlash) {
                if (payload.components) {
                    await sendV2(interaction, payload.components);
                } else {
                    await interaction.editReply(payload);
                }
            } else {
                await interaction.channel.send(payload);
                await interaction.delete().catch(() => { });
            }

        } catch (error) {
            console.error('Text execute error:', error);
            const errCard = cards.error(
                lang.text.error.execute.replace('{emoji}', '').trim()
            );
            if (isSlash) {
                await sendV2(interaction, errCard);
            } else {
                const replyMsg = await interaction.channel.send({
                    components: [errCard],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => { });
                if (replyMsg) {
                    setTimeout(() => {
                        replyMsg.delete().catch(() => { });
                        interaction.delete().catch(() => { });
                    }, 6000);
                }
            }
        }
    },

    async sendInvalidParams(interaction) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        const errCard = cards.error(
            lang.text.error.invalidParams.replace('{emoji}', '').trim()
        );

        if (isSlash) {
            await sendV2(interaction, errCard);
        } else {
            const replyMsg = await interaction.channel.send({
                components: [errCard],
                flags: MessageFlags.IsComponentsV2
            });
            setTimeout(() => {
                replyMsg.delete().catch(() => { });
                interaction.delete().catch(() => { });
            }, 8000);
        }
    },

    
    applyDiscordStyle(text, format) {
        switch (format) {
            case 'bold': return `**${text}**`;
            case 'italic': return `*${text}*`;
            case 'underline': return `__${text}__`;
            case 'strike': return `~~${text}~~`;
            case 'bolditalic': return `***${text}***`;
            case 'boldunder': return `__**${text}**__`;
            case 'all': return `~~__***${text}***__~~`;
            case 'code': return `\`\`\`\n${text}\n\`\`\``;
            case 'inline': return `\`${text}\``;
            case 'spoiler': return `||${text}||`;
            default: return text;
        }
    },

    convertToEmojis(text, addSpaces = false) {
        const specialCodes = {
            '0': ':zero:', '1': ':one:', '2': ':two:', '3': ':three:', '4': ':four:',
            '5': ':five:', '6': ':six:', '7': ':seven:', '8': ':eight:', '9': ':nine:',
            '#': ':hash:', '*': ':asterisk:', '?': ':grey_question:', '!': ':grey_exclamation:',
            ' ': addSpaces ? '   ' : '  '
        };

        return text.toLowerCase().split('').map(char => {
            if (/[a-z]/.test(char)) {
                return `:regional_indicator_${char}:`;
            } else if (specialCodes[char]) {
                return specialCodes[char];
            }
            return char;
        }).join(addSpaces ? ' ' : '');
    },

    convertToUnicode(text, font) {
        const fonts = {
            mathbold: this.createMathBold,
            mathitalic: this.createMathItalic,
            mathbolditalic: this.createMathBoldItalic,
            mathsans: this.createMathSans,
            mathmono: this.createMathMono,
            circled: this.createCircled,
            squared: this.createSquared,
            fullwidth: this.createFullwidth,
            smallcaps: this.createSmallCaps
        };

        const converter = fonts[font];
        if (!converter) return text;

        return text.split('').map(char => converter.call(this, char)).join('');
    },

    createMathBold(char) {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D400 + code - 65);
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D41A + code - 97);
        return char;
    },

    createMathItalic(char) {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D434 + code - 65);
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D44E + code - 97);
        return char;
    },

    createMathBoldItalic(char) {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D468 + code - 65);
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D482 + code - 97);
        return char;
    },

    createMathSans(char) {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5A0 + code - 65);
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5BA + code - 97);
        return char;
    },

    createMathMono(char) {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D670 + code - 65);
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D68A + code - 97);
        return char;
    },

    createCircled(char) {
        const circledMap = {
            'A': 'Ⓐ', 'B': 'Ⓑ', 'C': 'Ⓒ', 'D': 'Ⓓ', 'E': 'Ⓔ', 'F': 'Ⓕ', 'G': 'Ⓖ', 'H': 'Ⓗ', 'I': 'Ⓘ',
            'J': 'Ⓙ', 'K': 'Ⓚ', 'L': 'Ⓛ', 'M': 'Ⓜ', 'N': 'Ⓝ', 'O': 'Ⓞ', 'P': 'Ⓟ', 'Q': 'Ⓠ', 'R': 'Ⓡ',
            'S': 'Ⓢ', 'T': 'Ⓣ', 'U': 'Ⓤ', 'V': 'Ⓥ', 'W': 'Ⓦ', 'X': 'Ⓧ', 'Y': 'Ⓨ', 'Z': 'Ⓩ'
        };
        return circledMap[char.toUpperCase()] || char;
    },

    createSquared(char) {
        const squaredMap = {
            'A': '🄰', 'B': '🄱', 'C': '🄲', 'D': '🄳', 'E': '🄴', 'F': '🄵', 'G': '🄶', 'H': '🄷', 'I': '🄸',
            'J': '🄹', 'K': '🄺', 'L': '🄻', 'M': '🄼', 'N': '🄽', 'O': '🄾', 'P': '🄿', 'Q': '🅀', 'R': '🅁',
            'S': '🅂', 'T': '🅃', 'U': '🅄', 'V': '🅅', 'W': '🅆', 'X': '🅇', 'Y': '🅈', 'Z': '🅉'
        };
        return squaredMap[char.toUpperCase()] || char;
    },

    createFullwidth(char) {
        const code = char.charCodeAt(0);
        if (code >= 33 && code <= 126) return String.fromCodePoint(0xFF01 + code - 33);
        return char;
    },

    createSmallCaps(char) {
        const smallCapsMap = {
            'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ',
            'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ',
            's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
        };
        return smallCapsMap[char.toLowerCase()] || char;
    },

    applyFancyStyle(text, style) {
        switch (style) {
            case 'aesthetic': return text.split('').join('  ').toUpperCase();
            case 'wave': return text.split('').map((char, i) => i % 2 ? char.toLowerCase() : char.toUpperCase()).join('');
            case 'bubble': return `◦•●◉✿ ${text} ✿◉●•◦`;
            case 'reverse': return text.split('').reverse().join('');
            case 'upside': return this.flipUpsideDown(text);
            case 'zalgo': return this.addZalgo(text);
            case 'leet': return this.convertToLeet(text);
            default: return text;
        }
    },

    flipUpsideDown(text) {
        const flipMap = {
            'a': 'ɐ', 'b': 'q', 'c': 'ɔ', 'd': 'p', 'e': 'ǝ', 'f': 'ɟ', 'g': 'ƃ', 'h': 'ɥ', 'i': 'ᴉ',
            'j': 'ɾ', 'k': 'ʞ', 'l': 'l', 'm': 'ɯ', 'n': 'u', 'o': 'o', 'p': 'd', 'q': 'b', 'r': 'ɹ',
            's': 's', 't': 'ʇ', 'u': 'n', 'v': 'ʌ', 'w': 'ʍ', 'x': 'x', 'y': 'ʎ', 'z': 'z',
            'A': '∀', 'B': 'ᗺ', 'C': 'Ɔ', 'D': 'ᗡ', 'E': 'Ǝ', 'F': 'ᖴ', 'G': 'פ', 'H': 'H', 'I': 'I',
            'J': 'ſ', 'K': 'ʞ', 'L': '˥', 'M': 'W', 'N': 'N', 'O': 'O', 'P': 'Ԁ', 'Q': 'Q', 'R': 'ᴿ',
            'S': 'S', 'T': '┴', 'U': '∩', 'V': 'Λ', 'W': 'M', 'X': 'X', 'Y': '⅄', 'Z': 'Z',
            '?': '¿', '!': '¡', '.': '˙', ',': "'", ' ': ' '
        };
        return text.split('').reverse().map(char => flipMap[char] || char).join('');
    },

    addZalgo(text) {
        const zalgoUp = ['̍', '̎', '̄', '̅', '̿', '̑', '̆', '̐', '͒', '͗', '͑', '̇', '̈', '̊', '͂', '̓', '̈', '͊', '͋', '͌', '̃', '̂', '̌', '͐', '̀', '́', '̋', '̏', '̒', '̓', '̔', '̽', '̉', 'ͣ', 'ͤ', 'ͥ', 'ͦ', 'ͧ', 'ͨ', 'ͩ', 'ͪ', 'ͫ', 'ͬ', 'ͭ', 'ͮ', 'ͯ', '̾', '͛', '͆', '̚'];
        const zalgoDown = ['̖', '̗', '̘', '̙', '̜', '̝', '̞', '̟', '̠', '̤', '̥', '̦', '̩', '̪', '̫', '̬', '̭', '̮', '̯', '̰', '̱', '̲', '̳', '̹', '̺', '̻', '̼', 'ͅ', '͇', '͈', '͉', '͍', '͎', '͓', '͔', '͕', '͖', '͙', '͚', '̣'];

        return text.split('').map(char => {
            let zalgoChar = char;
            for (let i = 0; i < Math.random() * 3; i++) {
                zalgoChar += zalgoUp[Math.floor(Math.random() * zalgoUp.length)];
            }
            for (let i = 0; i < Math.random() * 3; i++) {
                zalgoChar += zalgoDown[Math.floor(Math.random() * zalgoDown.length)];
            }
            return zalgoChar;
        }).join('');
    },

    convertToLeet(text) {
        const leetMap = {
            'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '5', 't': '7', 'l': '1',
            'A': '4', 'E': '3', 'I': '1', 'O': '0', 'S': '5', 'T': '7', 'L': '1'
        };
        return text.split('').map(char => leetMap[char] || char).join('');
    },

    createGradientText(text, startColor, endColor) {
        const start = this.hexToRgb(startColor);
        const end = this.hexToRgb(endColor);
        const steps = text.length;

        let result = '';
        for (let i = 0; i < steps; i++) {
            const ratio = i / (steps - 1);
            const r = Math.round(start.r + (end.r - start.r) * ratio);
            const g = Math.round(start.g + (end.g - start.g) * ratio);
            const b = Math.round(start.b + (end.b - start.b) * ratio);

            const intensity = Math.round(ratio * 4);
            const formats = ['', '*', '**', '***', '~~**'];
            result += `${formats[intensity]}${text[i]}${formats[intensity].split('').reverse().join('')}`;
        }
        return result;
    },

    hexToRgb(hex) {
        const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    },

    isValidHex(hex) {
        return /^[0-9A-Fa-f]{6}$/.test(hex);
    }
};

