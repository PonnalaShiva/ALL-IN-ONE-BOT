const { SlashCommandBuilder } = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, sendV2, deferReply, ACCENT } = require('../../UI');
const contentPatch = require('../../utils/contentPatch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('content')
        .setDescription('Access reliable free APIs for entertainment and knowledge')
        .addSubcommand(subcommand =>
            subcommand.setName('fact')
                .setDescription('Get a random interesting fact'))
        .addSubcommand(subcommand =>
            subcommand.setName('joke')
                .setDescription('Get a random joke'))
        .addSubcommand(subcommand =>
            subcommand.setName('meme')
                .setDescription('Get a random meme'))
        .addSubcommand(subcommand =>
            subcommand.setName('quote')
                .setDescription('Get an inspirational quote'))
        .addSubcommand(subcommand =>
            subcommand.setName('catfact')
                .setDescription('Get a random cat fact'))
        .addSubcommand(subcommand =>
            subcommand.setName('dogfact')
                .setDescription('Get a random dog fact'))
        .addSubcommand(subcommand =>
            subcommand.setName('chucknorris')
                .setDescription('Get a Chuck Norris fact'))
        .addSubcommand(subcommand =>
            subcommand.setName('dadjoke')
                .setDescription('Get a dad joke'))
        .addSubcommand(subcommand =>
            subcommand.setName('advice')
                .setDescription('Get life advice'))
        .addSubcommand(subcommand =>
            subcommand.setName('activity')
                .setDescription('Get a suggested activity'))
        .addSubcommand(subcommand =>
            subcommand.setName('riddle')
                .setDescription('Get a brain teaser'))
        .addSubcommand(subcommand =>
            subcommand.setName('trivia')
                .setDescription('Get a trivia question'))
        .addSubcommand(subcommand =>
            subcommand.setName('compliment')
                .setDescription('Get a random compliment'))
        .addSubcommand(subcommand =>
            subcommand.setName('pun')
                .setDescription('Get a pun'))
        .addSubcommand(subcommand =>
            subcommand.setName('wisdom')
                .setDescription('Get ancient wisdom'))
        .addSubcommand(subcommand =>
            subcommand.setName('programming')
                .setDescription('Get programming humor'))
        .addSubcommand(subcommand =>
            subcommand.setName('spacefact')
                .setDescription('Get a space fact'))
        .addSubcommand(subcommand =>
            subcommand.setName('history')
                .setDescription('Get a historical fact'))
        .addSubcommand(subcommand =>
            subcommand.setName('science')
                .setDescription('Get a science fact'))
        .addSubcommand(subcommand =>
            subcommand.setName('word')
                .setDescription('Get a random word with definition'))
        .addSubcommand(subcommand =>
            subcommand.setName('acronym')
                .setDescription('Get a random acronym'))
        .addSubcommand(subcommand =>
            subcommand.setName('fortune')
                .setDescription('Get a fortune cookie'))
        .addSubcommand(subcommand =>
            subcommand.setName('anime')
                .setDescription('Get an anime quote')),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Content] Defer failed:', err.message);
                return;
            }
        }

        const VALID_SUBS = new Set([
            'fact', 'joke', 'meme', 'quote', 'catfact', 'dogfact', 'chucknorris',
            'dadjoke', 'advice', 'activity', 'riddle', 'trivia',
            'compliment', 'pun', 'wisdom', 'programming', 'spacefact', 'history',
            'science', 'word', 'acronym', 'fortune', 'anime'
        ]);

        let subcommand = args?.[0]?.toLowerCase();
        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else if (!subcommand || !VALID_SUBS.has(subcommand)) {
            const list = Array.from(VALID_SUBS);
            subcommand = list[Math.floor(Math.random() * list.length)];
        }

        if (!isSlash) {
            interaction.options = {
                getSubcommand: () => subcommand,
                getString: () => null,
                getInteger: () => null,
                getBoolean: () => null,
                getUser: () => null
            };
        }

        const sendReply = async (card) => {
            return await sendV2(interaction, card);
        };

        try {
            switch (subcommand) {
                case 'fact': return await this.handleFact(interaction, sendReply);
                case 'joke': return await this.handleJoke(interaction, sendReply);
                case 'meme': return await this.handleMeme(interaction, sendReply);
                case 'quote': return await this.handleQuote(interaction, sendReply);
                case 'catfact': return await this.handleCatFact(interaction, sendReply);
                case 'dogfact': return await this.handleDogFact(interaction, sendReply);
                case 'chucknorris': return await this.handleChuckNorris(interaction, sendReply);
                case 'dadjoke': return await this.handleDadJoke(interaction, sendReply);
                case 'advice': return await this.handleAdvice(interaction, sendReply);
                case 'activity': return await this.handleActivity(interaction, sendReply);
                case 'riddle': return await this.handleRiddle(interaction, sendReply);
                case 'trivia': return await this.handleTrivia(interaction, sendReply);
                case 'compliment': return await this.handleCompliment(interaction, sendReply);
                case 'pun': return await this.handlePun(interaction, sendReply);
                case 'wisdom': return await this.handleWisdom(interaction, sendReply);
                case 'programming': return await this.handleProgramming(interaction, sendReply);
                case 'spacefact': return await this.handleSpaceFact(interaction, sendReply);
                case 'history': return await this.handleHistory(interaction, sendReply);
                case 'science': return await this.handleScience(interaction, sendReply);
                case 'word': return await this.handleWord(interaction, sendReply);
                case 'acronym': return await this.handleAcronym(interaction, sendReply);
                case 'fortune': return await this.handleFortune(interaction, sendReply);
                case 'anime': return await this.handleAnime(interaction, sendReply);
                default: return await this.handleError(interaction, sendReply, 'Unknown subcommand');
            }
        } catch (error) {
            console.error('Error executing content command:', error);
            return await this.handleError(interaction, sendReply, error.message);
        }
    },

    async handleFact(interaction, sendReply) {
        try {
            const data = await contentPatch.getFact();

            const card = buildCard({
                title: lang.fun.content.factTitle.replace('{emoji}', getEmoji('sparkles')),
                description: `> ${data.text}`,
                footer: lang.fun.content.factFooter,
                accentColor: 0x3498db
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'fact', error);
        }
    },

    async handleJoke(interaction, sendReply) {
        try {
            const joke = await contentPatch.getJoke();

            const description = joke.punchline
                ? `**${joke.setup}**\n\n*${joke.punchline}*`
                : `> **${joke.setup}**`;

            const card = buildCard({
                title: lang.fun.content.jokeTitle.replace('{emoji}', getEmoji('smile')),
                description,
                footer: lang.fun.content.jokeFooter.replace('{category}', joke.category || 'General'),
                accentColor: 0xf39c12
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'joke', error);
        }
    },

    async handleMeme(interaction, sendReply) {
        try {
            const randomMeme = await contentPatch.getMeme();

            const card = buildCard({
                title: lang.fun.content.memeTitle.replace('{emoji}', getEmoji('games')),
                description: `**${randomMeme.name}**`,
                bannerURL: randomMeme.url,
                footer: lang.fun.content.memeFooter,
                accentColor: 0xe74c3c
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'meme', error);
        }
    },

    async handleQuote(interaction, sendReply) {
        try {
            const quote = await contentPatch.getQuote();

            const card = buildCard({
                title: lang.fun.content.quoteTitle.replace('{emoji}', getEmoji('chat')),
                description: `> "${quote.content}"\n\n**— ${quote.author}**`,
                footer: lang.fun.content.quoteFooter.replace('{category}', (quote.tags && quote.tags.length > 0) ? quote.tags.join(', ') : 'Inspiration'),
                accentColor: 0x9b59b6
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'quote', error);
        }
    },

    async handleCatFact(interaction, sendReply) {
        try {
            const data = await contentPatch.getCatFact();

            const card = buildCard({
                title: lang.fun.content.catFactTitle.replace('{emoji}', getEmoji('heart')),
                description: `> ${data.fact}`,
                footer: lang.fun.content.catFactFooter,
                accentColor: 0xff69b4
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'catfact', error);
        }
    },

    async handleDogFact(interaction, sendReply) {
        try {
            const data = await contentPatch.getDogFact();

            const card = buildCard({
                title: lang.fun.content.dogFactTitle.replace('{emoji}', getEmoji('heart')),
                description: `> ${data.fact}`,
                footer: lang.fun.content.dogFactFooter,
                accentColor: 0xffa500
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'dogfact', error);
        }
    },

    async handleChuckNorris(interaction, sendReply) {
        try {
            const joke = await contentPatch.getChuckNorris();

            const card = buildCard({
                title: lang.fun.content.chuckTitle.replace('{emoji}', getEmoji('fire')),
                description: `> ${joke.joke}`,
                footer: lang.fun.content.chuckFooter,
                accentColor: 0x8b0000
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'chucknorris', error);
        }
    },

    async handleDadJoke(interaction, sendReply) {
        try {
            const joke = await contentPatch.getDadJoke();

            const card = buildCard({
                title: lang.fun.content.dadJokeTitle.replace('{emoji}', getEmoji('smile')),
                description: `> ${joke.joke}`,
                footer: lang.fun.content.dadJokeFooter,
                accentColor: 0x8b4513
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'dadjoke', error);
        }
    },

    async handleAdvice(interaction, sendReply) {
        try {
            const data = await contentPatch.getAdvice();

            const card = buildCard({
                title: lang.fun.content.adviceTitle.replace('{emoji}', getEmoji('sparkles')),
                description: `> "${data.advice}"`,
                footer: lang.fun.content.adviceFooter,
                accentColor: 0x2ecc71
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'advice', error);
        }
    },

    async handleActivity(interaction, sendReply) {
        try {
            const activity = await contentPatch.getActivity();

            const card = buildCard({
                title: lang.fun.content.activityTitle.replace('{emoji}', getEmoji('rocket')),
                description: `> **${activity.activity}**\n\n• **Type:** ${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}\n• **Participants:** ${activity.participants}`,
                footer: lang.fun.content.activityFooter.replace('{type}', activity.type).replace('{participants}', activity.participants),
                accentColor: 0xe67e22
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'activity', error);
        }
    },

    async handleRiddle(interaction, sendReply) {
        try {
            const r = await contentPatch.getRiddle();

            const card = buildCard({
                title: lang.fun.content.riddleTitle.replace('{emoji}', getEmoji('help')),
                description: `**Riddle:** ${r.riddle}\n\n${lang.fun.content.riddleAnswer.replace('{answer}', r.answer)}`,
                accentColor: 0x9c27b0
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'riddle', error);
        }
    },

    async handleTrivia(interaction, sendReply) {
        try {
            const trivia = await contentPatch.getTrivia();

            const card = buildCard({
                title: lang.fun.content.triviaTitle.replace('{emoji}', getEmoji('help')),
                description: `**Q:** ${trivia.question}\n\n**Options:**\n` + trivia.options.map((opt, idx) => `• **${String.fromCharCode(65 + idx)}.** ${opt}`).join('\n') + `\n\n**Answer:** ||${trivia.answer}||`,
                footer: lang.fun.content.triviaCategory.replace('{category}', trivia.category).replace('{difficulty}', trivia.difficulty),
                accentColor: 0x3f51b5
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'trivia', error);
        }
    },

    async handleCompliment(interaction, sendReply) {
        try {
            const item = await contentPatch.getCompliment();

            const card = buildCard({
                title: lang.fun.content.complimentTitle.replace('{emoji}', getEmoji('smile')),
                description: `> **${item.text}**`,
                accentColor: 0xff69b4
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'compliment', error);
        }
    },

    async handlePun(interaction, sendReply) {
        try {
            const item = await contentPatch.getPun();

            const card = buildCard({
                title: lang.fun.content.punTitle.replace('{emoji}', getEmoji('smile')),
                description: `> *"${item.pun}"*`,
                accentColor: 0x4caf50
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'pun', error);
        }
    },

    async handleWisdom(interaction, sendReply) {
        try {
            const w = await contentPatch.getWisdom();

            const card = buildCard({
                title: lang.fun.content.wisdomTitle.replace('{emoji}', getEmoji('document')),
                description: `> *"${w.text}"*\n\n**— ${w.author}**`,
                accentColor: 0x795548
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'wisdom', error);
        }
    },

    async handleProgramming(interaction, sendReply) {
        try {
            const item = await contentPatch.getProgramming();

            const card = buildCard({
                title: lang.fun.content.programmingTitle.replace('{emoji}', getEmoji('settings')),
                description: `> ${item.joke}`,
                accentColor: 0x607d8b
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'programming', error);
        }
    },

    async handleSpaceFact(interaction, sendReply) {
        try {
            const item = await contentPatch.getSpaceFact();

            const card = buildCard({
                title: lang.fun.content.spaceTitle.replace('{emoji}', getEmoji('world')),
                description: `> ${item.fact}`,
                accentColor: 0x1a237e
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'spacefact', error);
        }
    },

    async handleHistory(interaction, sendReply) {
        try {
            const item = await contentPatch.getHistory();

            const card = buildCard({
                title: lang.fun.content.historyTitle.replace('{emoji}', getEmoji('calendar')),
                description: `> ${item.fact}`,
                accentColor: 0x8bc34a
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'history', error);
        }
    },

    async handleScience(interaction, sendReply) {
        try {
            const item = await contentPatch.getScience();

            const card = buildCard({
                title: lang.fun.content.scienceTitle.replace('{emoji}', getEmoji('rocket')),
                description: `> ${item.fact}`,
                accentColor: 0x00bcd4
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'science', error);
        }
    },

    async handleWord(interaction, sendReply) {
        try {
            const w = await contentPatch.getWord();

            const card = buildCard({
                title: lang.fun.content.wordTitle.replace('{emoji}', getEmoji('document')),
                description: `• **Word:** **${w.word}**\n• **Definition:** ${w.definition}\n• **Origin:** ${w.origin}`,
                accentColor: 0xff5722
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'word', error);
        }
    },

    async handleAcronym(interaction, sendReply) {
        try {
            const a = await contentPatch.getAcronym();

            const card = buildCard({
                title: lang.fun.content.acronymTitle.replace('{emoji}', getEmoji('list')),
                description: `• **Acronym:** **${a.acronym}**\n• **Meaning:** ${a.meaning}\n• **Field:** ${a.field}`,
                accentColor: 0x673ab7
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'acronym', error);
        }
    },

    async handleFortune(interaction, sendReply) {
        try {
            const f = await contentPatch.getFortune();

            const card = buildCard({
                title: lang.fun.content.fortuneTitle.replace('{emoji}', getEmoji('sparkles')),
                description: `> *"${f.fortune}"*`,
                accentColor: 0xffc107
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'fortune', error);
        }
    },

    async handleAnime(interaction, sendReply) {
        try {
            const q = await contentPatch.getAnime();

            const card = buildCard({
                title: lang.fun.content.animeTitle.replace('{emoji}', getEmoji('star')),
                description: `> "${q.quote}"\n\n**— ${q.character}** (*${q.anime}*)`,
                accentColor: 0xe91e63
            });

            return sendReply(card);
        } catch (error) {
            return this.handleAPIError(interaction, sendReply, 'anime', error);
        }
    },

    handleAPIError(interaction, sendReply, commandType, error) {
        console.error(`Error fetching ${commandType}:`, error);

        const card = buildCard({
            title: lang.fun.content.errorTitle.replace('{emoji}', getEmoji('cross')),
            description: lang.fun.content.serviceUnavailable.replace('{emoji}', getEmoji('warning')).replace('{command}', commandType),
            tone: 'danger'
        });

        return sendReply(card);
    },

    handleError(interaction, sendReply, errorMessage) {
        const card = buildCard({
            title: lang.fun.content.errorTitle.replace('{emoji}', getEmoji('cross')),
            description: errorMessage || lang.fun.common.genericError,
            tone: 'danger'
        });

        return sendReply(card);
    }
};