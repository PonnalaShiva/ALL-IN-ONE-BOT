

'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');
const aiManager = require('../../utils/AIManager');
const { sendV2AIResponse } = require('../../utils/v2ContainerHelper');
const rawLang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const lang = { ...rawLang, word: createInterpolatableProxy(rawLang.word) };

function truncateText(text, maxLength = 3800) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

async function callGeminiAPI(serverId, prompt) {
    try {
        const targetServer = serverId || 'global';
        const response = await aiManager.generateContent(targetServer, prompt);
        return response.text();
    } catch (error) {
        console.error('AI Manager Error:', error.message);

        if (error.name === 'AIContentBlockedError') {
            return lang.word.error.aiBlocked;
        }

        return lang.word.error.aiServiceError;
    }
}

async function analyzeWord(serverId, word, analysisType) {
    const prompts = {
        etymology: `Provide detailed etymology and origin of the word "${word}". Include historical development, root languages, and how the meaning evolved over time. Format the response clearly with sections.`,

        usage: `Provide comprehensive usage examples for the word "${word}". Include: 1) Common usage in sentences, 2) Formal vs informal contexts, 3) Different meanings in various contexts, 4) Collocations and phrases. Make it detailed and educational.`,

        grammar: `Provide detailed grammatical analysis of the word "${word}". Include: 1) Part of speech variations, 2) Conjugations/declensions if applicable, 3) Grammatical rules, 4) Common grammatical mistakes, 5) Usage in different tenses/forms.`,

        advanced: `Provide advanced linguistic analysis of the word "${word}". Include: 1) Semantic field and related concepts, 2) Connotations and register, 3) Stylistic usage, 4) Literary examples, 5) Regional variations, 6) Frequency of use.`,

        rhyme: `Find words that rhyme with "${word}". Provide: 1) Perfect rhymes, 2) Near rhymes/slant rhymes, 3) Words organized by syllable count, 4) Example sentences using rhyming words. Make it comprehensive for creative writing.`,

        antonyms: `Provide comprehensive antonyms for "${word}". Include: 1) Direct antonyms, 2) Contextual opposites, 3) Gradable antonyms (if applicable), 4) Example sentences showing contrasts, 5) Nuanced opposites in different contexts.`,

        context: `Analyze how the word "${word}" is used in different contexts. Include: 1) Technical/professional usage, 2) Casual conversation, 3) Academic writing, 4) Creative writing, 5) Historical contexts, 6) Cultural significance.`
    };

    return await callGeminiAPI(serverId, prompts[analysisType]);
}

async function translateWithContext(serverId, text, targetLanguage, sourceLanguage = 'auto') {
    const prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}: "${text}". 
    Provide: 1) Direct translation, 2) Alternative translations with different nuances, 3) Cultural context if relevant, 4) Usage notes for the target language.`;

    return await callGeminiAPI(serverId, prompt);
}

async function compareWords(serverId, word1, word2) {
    const prompt = `Compare and contrast these two words: "${word1}" and "${word2}". 
    Include: 1) Similarities in meaning, 2) Key differences, 3) Usage contexts for each, 4) Examples showing the distinction, 5) When to use each word appropriately.`;

    return await callGeminiAPI(serverId, prompt);
}

async function wordFamily(serverId, word) {
    const prompt = `Analyze the word family of "${word}". Include: 1) Root word and base forms, 2) Related words (same root), 3) Derived words (prefixes/suffixes), 4) Word formations, 5) Semantic relationships within the family.`;

    return await callGeminiAPI(serverId, prompt);
}

async function handlePrefixCommand(message, args) {
    const subcommand = args[0]?.toLowerCase();
    const word = args[1];

    if (!subcommand) {
        const helpCard = buildCard({
            title: lang.word.help.title,
            description: lang.word.help.desc,
            sections: [lang.word.help.available],
            accentColor: ACCENT.warning
        });

        return await sendV2(message, helpCard);
    }

    if (!word && !['translate', 'compare'].includes(subcommand)) {
        return await sendV2(message, cards.error(
            lang.word.error.missingWordTitle,
            lang.word.error.missingWord
        ));
    }

    try {
        switch (subcommand) {
            case 'define':
            case 'dictionary':
                await handleDefinition(message, word);
                break;
            case 'translate':
                await handleTranslation(message, args);
                break;
            case 'etymology':
                await handleEtymology(message, word);
                break;
            case 'usage':
                await handleUsage(message, word);
                break;
            case 'grammar':
                await handleGrammar(message, word);
                break;
            case 'advanced':
                await handleAdvanced(message, word);
                break;
            case 'rhyme':
                await handleRhyme(message, word);
                break;
            case 'antonyms':
                await handleAntonyms(message, word);
                break;
            case 'context':
                await handleContext(message, word);
                break;
            case 'compare':
                await handleCompare(message, args);
                break;
            case 'family':
                await handleFamily(message, word);
                break;
            default:
                await sendV2(message, cards.error(
                    lang.word.error.invalidSubcommandTitle,
                    lang.word.help.available
                ));
        }
    } catch (error) {
        console.error('Error in prefix command:', error);
        await sendV2(message, cards.error(
            lang.word.error.commandErrorTitle,
            lang.word.error.commandErrorDesc
        ));
    }
}

async function handleDefinition(interaction, word) {
    const dictBase = (process.env.DICTIONARY_API_URL || 'https://api.dictionaryapi.dev/api/v2/entries/en').replace(/\/+$/, '');
    const apiUrl = `${dictBase}/${encodeURIComponent(word)}`;

    try {
        const response = await axios.get(apiUrl);
        const data = response.data[0];

        if (!data) {
            return await sendV2(interaction, cards.error(
                lang.word.define.noDefTitle,
                lang.word.define.noDefDesc({ word })
            ));
        }

        const phonetic = data.phonetic || 'N/A';
        const meanings = data.meanings.map(meaning => ({
            partOfSpeech: meaning.partOfSpeech,
            definitions: meaning.definitions.slice(0, 2).map(def => ({
                definition: def.definition,
                example: def.example || lang.word.define.noExample,
            })),
        }));

        let definitionContent = '';
        meanings.forEach(meaning => {
            definitionContent += `**${meaning.partOfSpeech.toUpperCase()}**\n`;
            definitionContent += meaning.definitions.map(def => `• ${def.definition}\n*Example: ${def.example}*`).join('\n\n');
            definitionContent += '\n\n';
        });

        const defCard = buildCard({
            title: lang.word.define.title({ word }),
            description: lang.word.define.subtitle,
            sections: [
                `**${lang.word.define.phonetic}** ${phonetic}`,
                truncateText(definitionContent)
            ],
            thumbnailURL: interaction.user?.displayAvatarURL({ dynamic: true, size: 128 }) || interaction.author?.displayAvatarURL({ dynamic: true, size: 128 }),
            footer: lang.word.define.apiFooter({ time: new Date().toLocaleString() }),
            accentColor: ACCENT.info
        });

        await sendV2(interaction, defCard);
    } catch (error) {
        console.log('Dictionary API failed, falling back to AI Manager');
        const serverId = interaction.guild?.id || 'global';
        const result = await callGeminiAPI(serverId, `Provide a comprehensive definition of the word "${word}" with examples, pronunciation, and different meanings.`);

        await sendV2AIResponse(interaction, {
            title: lang.word.define.aiTitle({ word }),
            subtitle: lang.word.define.aiSubtitle,
            accentColor: ACCENT.primary,
            headerEmoji: 'book',
            text: result
        });
    }
}

async function handleTranslation(interaction, args) {
    let text, targetLanguage;

    if (Array.isArray(args)) {
        text = args.slice(1, -1).join(' ');
        targetLanguage = args[args.length - 1];
    } else {
        text = interaction.options.getString('text');
        targetLanguage = interaction.options.getString('target_language');
    }

    if (!text || !targetLanguage) {
        return await sendV2(interaction, cards.warning(
            lang.word.error.invalidUsageTitle,
            lang.word.error.invalidUsageTranslate
        ));
    }

    const serverId = interaction.guild?.id || 'global';
    const result = await translateWithContext(serverId, text, targetLanguage);

    const transCard = buildCard({
        title: lang.word.translate.title,
        description: lang.word.translate.subtitle,
        sections: [
            `**${lang.word.translate.original}** ${truncateText(text, 500)}\n**${lang.word.translate.targetLang}** ${targetLanguage}`,
            truncateText(result)
        ],
        thumbnailURL: interaction.user?.displayAvatarURL({ dynamic: true, size: 128 }) || interaction.author?.displayAvatarURL({ dynamic: true, size: 128 }),
        footer: lang.word.translate.footer({ time: new Date().toLocaleString() }),
        accentColor: ACCENT.success
    });

    await sendV2(interaction, transCard);
}

async function handleEtymology(interaction, word) {
    const serverId = interaction.guild?.id || 'global';
    const result = await analyzeWord(serverId, word, 'etymology');
    await sendV2AIResponse(interaction, {
        title: lang.word.etymology.title({ word }),
        subtitle: lang.word.etymology.subtitle,
        accentColor: 0x8B4513,
        headerEmoji: 'document',
        text: result
    });
}

async function handleUsage(interaction, word) {
    const serverId = interaction.guild?.id || 'global';
    const result = await analyzeWord(serverId, word, 'usage');
    await sendV2AIResponse(interaction, {
        title: lang.word.usage.title({ word }),
        subtitle: lang.word.usage.subtitle,
        accentColor: 0x32CD32,
        headerEmoji: 'document',
        text: result
    });
}

async function handleGrammar(interaction, word) {
    const serverId = interaction.guild?.id || 'global';
    const result = await analyzeWord(serverId, word, 'grammar');
    await sendV2AIResponse(interaction, {
        title: lang.word.grammar.title({ word }),
        subtitle: lang.word.grammar.subtitle,
        accentColor: 0xFF6347,
        headerEmoji: 'document',
        text: result
    });
}

async function handleAdvanced(interaction, word) {
    const serverId = interaction.guild?.id || 'global';
    const result = await analyzeWord(serverId, word, 'advanced');
    await sendV2AIResponse(interaction, {
        title: lang.word.advanced.title({ word }),
        subtitle: lang.word.advanced.subtitle,
        accentColor: 0x4169E1,
        headerEmoji: 'document',
        text: result
    });
}

async function handleRhyme(interaction, word) {
    const serverId = interaction.guild?.id || 'global';
    const result = await analyzeWord(serverId, word, 'rhyme');
    await sendV2AIResponse(interaction, {
        title: lang.word.rhyme.title({ word }),
        subtitle: lang.word.rhyme.subtitle,
        accentColor: 0xFF1493,
        headerEmoji: 'sparkles',
        text: result
    });
}

async function handleAntonyms(interaction, word) {
    const serverId = interaction.guild?.id || 'global';
    const result = await analyzeWord(serverId, word, 'antonyms');
    await sendV2AIResponse(interaction, {
        title: lang.word.antonyms.title({ word }),
        subtitle: lang.word.antonyms.subtitle,
        accentColor: 0xFF8C00,
        headerEmoji: 'loop',
        text: result
    });
}

async function handleContext(interaction, word) {
    const serverId = interaction.guild?.id || 'global';
    const result = await analyzeWord(serverId, word, 'context');

    await sendV2AIResponse(interaction, {
        title: lang.word.context.title({ word }),
        subtitle: lang.word.context.subtitle,
        accentColor: ACCENT.info,
        headerEmoji: 'search',
        text: result
    });
}

async function handleCompare(interaction, args) {
    let word1, word2;

    if (Array.isArray(args)) {
        word1 = args[1];
        word2 = args[2];
    } else {
        word1 = interaction.options.getString('word1');
        word2 = interaction.options.getString('word2');
    }

    if (!word1 || !word2) {
        return await sendV2(interaction, cards.warning(
            lang.word.error.invalidUsageTitle,
            lang.word.error.invalidUsageCompare
        ));
    }

    const serverId = interaction.guild?.id || 'global';
    const result = await compareWords(serverId, word1, word2);

    await sendV2AIResponse(interaction, {
        title: lang.word.compare.title({ word1, word2 }),
        subtitle: lang.word.compare.subtitle,
        accentColor: ACCENT.primary,
        headerEmoji: 'document',
        text: result
    });
}

async function handleFamily(interaction, word) {
    const serverId = interaction.guild?.id || 'global';
    const result = await wordFamily(serverId, word);

    await sendV2AIResponse(interaction, {
        title: lang.word.family.title({ word }),
        subtitle: lang.word.family.subtitle,
        accentColor: ACCENT.danger,
        headerEmoji: 'tree',
        text: result
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('word')
        .setDescription('Comprehensive word analysis and language tools.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('define')
                .setDescription('Get detailed definition of a word.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to define.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('dictionary')
                .setDescription('Look up a word in the dictionary.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to look up.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('translate')
                .setDescription('Translate text with context and alternatives.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to translate.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('target_language')
                        .setDescription('Target language (e.g., Spanish, French, German).')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('source_language')
                        .setDescription('Source language (auto-detect if not specified).')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('etymology')
                .setDescription('Get detailed etymology and origin of a word.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to analyze.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('usage')
                .setDescription('Get comprehensive usage examples and contexts.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to analyze.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('grammar')
                .setDescription('Get detailed grammatical analysis.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to analyze.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('advanced')
                .setDescription('Get advanced linguistic analysis.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to analyze.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rhyme')
                .setDescription('Find words that rhyme with the given word.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to find rhymes for.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('antonyms')
                .setDescription('Get comprehensive antonyms and opposites.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to find antonyms for.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('context')
                .setDescription('Analyze word usage in different contexts.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to analyze.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('compare')
                .setDescription('Compare and contrast two words.')
                .addStringOption(option =>
                    option.setName('word1')
                        .setDescription('First word to compare.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('word2')
                        .setDescription('Second word to compare.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('family')
                .setDescription('Analyze word family and related words.')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to analyze.')
                        .setRequired(true))),

    async execute(interaction) {
        if (!(typeof interaction.isChatInputCommand === 'function' ? interaction.isChatInputCommand() : interaction.isCommand?.())) return;

        try {
            await deferReply(interaction);

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'define':
                case 'dictionary':
                    await handleDefinition(interaction, interaction.options.getString('word'));
                    break;

                case 'translate':
                    await handleTranslation(interaction);
                    break;

                case 'etymology':
                    await handleEtymology(interaction, interaction.options.getString('word'));
                    break;

                case 'usage':
                    await handleUsage(interaction, interaction.options.getString('word'));
                    break;

                case 'grammar':
                    await handleGrammar(interaction, interaction.options.getString('word'));
                    break;

                case 'advanced':
                    await handleAdvanced(interaction, interaction.options.getString('word'));
                    break;

                case 'rhyme':
                    await handleRhyme(interaction, interaction.options.getString('word'));
                    break;

                case 'antonyms':
                    await handleAntonyms(interaction, interaction.options.getString('word'));
                    break;

                case 'context':
                    await handleContext(interaction, interaction.options.getString('word'));
                    break;

                case 'compare':
                    await handleCompare(interaction);
                    break;

                case 'family':
                    await handleFamily(interaction, interaction.options.getString('word'));
                    break;

                default:
                    await sendV2(interaction, cards.error(
                        lang.word.error.unknownSubcommandTitle,
                        lang.word.error.unknownSubcommandDesc
                    ));
            }
        } catch (error) {
            console.error('Slash Command Error:', error);
            await sendV2(interaction, cards.error(
                lang.word.error.commandErrorTitle,
                lang.word.error.slashCommandErrorDesc
            ));
        }
    },

    async executePrefix(message, args) {
        await handlePrefixCommand(message, args);
    }
};

