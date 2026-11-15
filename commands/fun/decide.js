
const { SlashCommandBuilder } = require('discord.js');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');
const aiManager = require('../../utils/AIManager');
const { sendV2AIResponse } = require('../../utils/v2ContainerHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('decide')
        .setDescription('Intelligent decision making and thought experiments!')

        .addSubcommand(subcommand =>
            subcommand
                .setName('options')
                .setDescription('Choose from a list of options')
                .addStringOption(option =>
                    option.setName('choices')
                        .setDescription('Options separated by commas (e.g., pizza, burger, tacos)')
                        .setRequired(true)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('yesno')
                .setDescription('Simple yes/no decision')
                .addStringOption(option =>
                    option.setName('question')
                        .setDescription('Your yes/no question')
                        .setRequired(true)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('percentage')
                .setDescription('Get a random percentage chance')
                .addStringOption(option =>
                    option.setName('event')
                        .setDescription('What event to calculate percentage for')
                        .setRequired(true)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('wheel')
                .setDescription('Spin a wheel of options')
                .addStringOption(option =>
                    option.setName('options')
                        .setDescription('Options separated by commas')
                        .setRequired(true)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('tier')
                .setDescription('Rank options into tier lists')
                .addStringOption(option =>
                    option.setName('items')
                        .setDescription('Items to rank, separated by commas')
                        .setRequired(true)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('pairs')
                .setDescription('Create random pairs from people')
                .addStringOption(option =>
                    option.setName('people')
                        .setDescription('Names separated by commas')
                        .setRequired(true)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('scenario')
                .setDescription('Generate "What would you do if..." scenarios')
                .addStringOption(option =>
                    option.setName('theme')
                        .setDescription('Optional theme for the scenario')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('apocalypse')
                .setDescription('Random end-of-world survival scenarios')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of apocalypse (zombie, alien, natural, etc.)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('superpower')
                .setDescription('Grant random superpowers with descriptions')
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Power category (mental, physical, elemental, etc.)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('villain')
                .setDescription('Create random villain backstories')
                .addStringOption(option =>
                    option.setName('genre')
                        .setDescription('Genre (superhero, fantasy, sci-fi, etc.)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('dimension')
                .setDescription('Describe alternate reality dimensions')
                .addStringOption(option =>
                    option.setName('aspect')
                        .setDescription('What aspect is different (physics, society, technology)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('paradox')
                .setDescription('Generate philosophical paradoxes with analysis')
                .addStringOption(option =>
                    option.setName('field')
                        .setDescription('Field of paradox (logic, time, ethics, existence)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('thought_experiment')
                .setDescription('Create mind-bending thought experiments')
                .addStringOption(option =>
                    option.setName('topic')
                        .setDescription('Topic area (ethics, consciousness, reality, identity)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('debate_topic')
                .setDescription('Generate debate topics with arguments')
                .addStringOption(option =>
                    option.setName('domain')
                        .setDescription('Domain (technology, society, ethics, politics)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('conspiracy_theory')
                .setDescription('Create hilarious fictional conspiracy theories')
                .addStringOption(option =>
                    option.setName('subject')
                        .setDescription('Subject to create conspiracy about')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('moral_dilemma')
                .setDescription('Present complex ethical scenarios')
                .addStringOption(option =>
                    option.setName('context')
                        .setDescription('Context (medical, business, personal, societal)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('future_prediction')
                .setDescription('Generate plausible future scenarios')
                .addStringOption(option =>
                    option.setName('timeframe')
                        .setDescription('Time period (10 years, 50 years, 100 years)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('invention')
                .setDescription('Create impossible inventions with explanations')
                .addStringOption(option =>
                    option.setName('purpose')
                        .setDescription('What problem should it solve?')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('alternate_history')
                .setDescription('Explore "what if" historical scenarios')
                .addStringOption(option =>
                    option.setName('period')
                        .setDescription('Historical period or event')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('philosophy_question')
                .setDescription('Generate deep philosophical questions')
                .addStringOption(option =>
                    option.setName('branch')
                        .setDescription('Philosophy branch (metaphysics, epistemology, ethics)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('scientific_theory')
                .setDescription('Create fictional scientific theories')
                .addStringOption(option =>
                    option.setName('field')
                        .setDescription('Scientific field (physics, biology, psychology)')
                        .setRequired(false))),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Decide] Defer failed:', err.message);
                return;
            }
        }

        
        const guildId = interaction.guild?.id;
        let prefix = '!';
        if (guildId) {
            try {
                const { getServerConfig } = require('../../utils/cacheHelpers');
                const serverConfig = await getServerConfig(guildId);
                if (serverConfig?.prefix) {
                    prefix = serverConfig.prefix;
                }
            } catch (_) { }
        }
        interaction.guildPrefix = prefix;

        const VALID_SUBS = new Set([
            'options', 'yesno', 'percentage', 'wheel', 'tier', 'pairs',
            'scenario', 'apocalypse', 'superpower', 'villain', 'dimension',
            'paradox', 'thought_experiment', 'debate_topic', 'conspiracy_theory',
            'moral_dilemma', 'future_prediction', 'invention', 'alternate_history',
            'philosophy_question', 'scientific_theory'
        ]);

        let subcommand = 'yesno';
        let customInput = '';

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            const rawSub = args?.[0]?.toLowerCase();
            if (rawSub && VALID_SUBS.has(rawSub)) {
                subcommand = rawSub;
                customInput = args.slice(1).join(' ');
            } else if (args && args.length > 0) {
                const fullText = args.join(' ');
                if (fullText.includes(',')) {
                    subcommand = 'options';
                    customInput = fullText;
                } else {
                    subcommand = 'yesno';
                    customInput = fullText;
                }
            } else {
                subcommand = 'yesno';
                customInput = 'Should I make a decision today?';
            }
        }

        if (!isSlash) {
            interaction.options = {
                getSubcommand: () => subcommand,
                getString: (name) => customInput.trim() || null,
                getInteger: (name) => null,
                getBoolean: (name) => null,
                getUser: (name) => null
            };
        }

        const sendReply = async (card) => {
            return await sendV2(interaction, card);
        };

        try {
            switch (subcommand) {
                case 'options':
                    await this.handleBasicDecision(interaction, sendReply);
                    break;
                case 'yesno':
                    await this.handleYesNo(interaction, sendReply);
                    break;
                case 'percentage':
                    await this.handlePercentage(interaction, sendReply);
                    break;
                case 'wheel':
                    await this.handleWheel(interaction, sendReply);
                    break;
                case 'tier':
                    await this.handleTier(interaction, sendReply);
                    break;
                case 'pairs':
                    await this.handlePairs(interaction, sendReply);
                    break;
                default:
                    await this.handleAICommand(interaction, subcommand, sendReply);
                    break;
            }
        } catch (error) {
            console.error('Decision command error:', error);
            const errCard = cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.common.genericError
            );
            await sendReply(errCard).catch(() => { });
        }
    },

    async handleBasicDecision(interaction, sendReply) {
        const choicesStr = interaction.options.getString('choices');
        if (!choicesStr) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needChoices
            ));
        }

        const options = choicesStr.split(',').map(opt => opt.trim()).filter(Boolean);

        if (options.length < 2) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needMoreChoices
            ));
        }

        
        try {
            const serverId = interaction.guild?.id || 'global_user';
            const prompt = `You are a decisive, witty assistant. Choose the BEST option from this list:
Options: ${options.join(', ')}

Respond ONLY in valid JSON matching this schema:
{
  "chosen": "the winning option verbatim from the list",
  "reason": "1 brief sentence witty or logical justification for this choice"
}`;

            const response = await aiManager.generateContent(serverId, prompt, { timeout: 15000 });
            const rawText = response.text().trim();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.chosen && options.some(opt => opt.toLowerCase() === parsed.chosen.toLowerCase())) {
                    const matched = options.find(opt => opt.toLowerCase() === parsed.chosen.toLowerCase()) || parsed.chosen;
                    const card = buildCard({
                        title: lang.fun.decide.decisionMadeTitle.replace('{emoji}', getEmoji('sparkles')),
                        description: lang.fun.decide.consideringChoices.replace('{count}', options.length).replace('{choice}', matched) +
                            (parsed.reason ? `\n> *${parsed.reason}*` : '') +
                            `\n\n**${lang.fun.decide.optionsConsidered}**\n` +
                            options.map(opt => `• ${opt}`).join('\n'),
                        footer: lang.fun.decide.aiDecisionFooter || 'AI-Powered Decision',
                        accentColor: ACCENT.primary
                    });
                    return await sendReply(card);
                }
            }
        } catch (_) {}

        
        const chosen = options[Math.floor(Math.random() * options.length)];

        const card = buildCard({
            title: lang.fun.decide.decisionMadeTitle.replace('{emoji}', getEmoji('sparkles')),
            description: lang.fun.decide.consideringChoices.replace('{count}', options.length).replace('{choice}', chosen) +
                `\n\n**${lang.fun.decide.optionsConsidered}**\n` +
                options.map(opt => `• ${opt}`).join('\n'),
            footer: lang.fun.decide.randomNote,
            accentColor: ACCENT.primary
        });

        await sendReply(card);
    },

    async handleYesNo(interaction, sendReply) {
        const question = interaction.options.getString('question');
        if (!question) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needQuestion
            ));
        }

        
        try {
            const serverId = interaction.guild?.id || 'global_user';
            const prompt = `You are a decisive, wise, and slightly humorous advisor. Answer this yes/no question:
Question: "${question}"

Respond ONLY in valid JSON matching this schema:
{
  "answer": "Yes" or "No" or "Probably" or "Definitely Not" or "Without a doubt",
  "reason": "1 brief sentence witty or helpful explanation"
}`;

            const response = await aiManager.generateContent(serverId, prompt, { timeout: 15000 });
            const rawText = response.text().trim();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.answer) {
                    const ans = parsed.answer.toLowerCase();
                    const isPositive = ans.includes('yes') || ans.includes('doubt') || ans.includes('prob') || ans.includes('definitely');
                    const tone = isPositive ? 'success' : 'danger';
                    const icon = isPositive ? (getEmoji('tick') || '✅') : (getEmoji('cross') || '❌');

                    const card = buildCard({
                        title: lang.fun.decide.yesNoTitle.replace('{emoji}', getEmoji('help')),
                        description: `**${lang.fun.decide.questionLabel}:** ${question}\n\n` +
                            `**${lang.fun.decide.answerLabel}:** ${icon} \`${parsed.answer}\`` +
                            (parsed.reason ? `\n> *${parsed.reason}*` : ''),
                        footer: lang.fun.decide.aiDecisionFooter || 'AI-Powered Decision',
                        tone
                    });
                    return await sendReply(card);
                }
            }
        } catch (_) {}

        
        const a = lang.fun?.decide?.answers || {};
        const answers = [
            { text: a.yes || 'Yes', tone: 'success', emojiKey: 'tick' },
            { text: a.no || 'No', tone: 'danger', emojiKey: 'cross' },
            { text: a.maybe || 'Maybe', tone: 'warning', emojiKey: 'help' },
            { text: a.absolutely || 'Absolutely!', tone: 'success', emojiKey: 'tick' },
            { text: a.notAChance || 'Not a chance', tone: 'danger', emojiKey: 'cross' },
            { text: a.askLater || 'Ask again later', tone: 'warning', emojiKey: 'time' },
            { text: a.definitelyNot || 'Definitely not', tone: 'danger', emojiKey: 'cross' },
            { text: a.withoutADoubt || 'Without a doubt', tone: 'success', emojiKey: 'tick' }
        ];

        const chosen = answers[Math.floor(Math.random() * answers.length)];

        const card = buildCard({
            title: lang.fun.decide.yesNoTitle.replace('{emoji}', getEmoji('help')),
            description: `**${lang.fun.decide.questionLabel}:** ${question}\n\n` +
                `**${lang.fun.decide.answerLabel}:** ${getEmoji(chosen.emojiKey) || chosen.emojiFb} \`${chosen.text}\``,
            footer: lang.fun.decide.magicBallFooter,
            tone: chosen.tone
        });

        await sendReply(card);
    },

    async handlePercentage(interaction, sendReply) {
        const event = interaction.options.getString('event');
        if (!event) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needEvent
            ));
        }

        const percentage = Math.floor(Math.random() * 101);

        let interpretation = '';
        let tone = 'info';

        if (percentage >= 90) {
            interpretation = lang.fun.decide.almostCertain;
            tone = 'success';
        } else if (percentage >= 70) {
            interpretation = lang.fun.decide.veryLikely;
            tone = 'success';
        } else if (percentage >= 50) {
            interpretation = lang.fun.decide.goodChances;
            tone = 'warning';
        } else if (percentage >= 30) {
            interpretation = lang.fun.decide.unlikely;
            tone = 'warning';
        } else if (percentage >= 10) {
            interpretation = lang.fun.decide.notVeryLikely;
            tone = 'danger';
        } else {
            interpretation = lang.fun.decide.extremelyUnlikely;
            tone = 'danger';
        }

        const card = buildCard({
            title: lang.fun.decide.percentageTitle.replace('{emoji}', getEmoji('analytics')),
            description: `**${lang.fun.decide.eventLabel}:** ${event}\n\n` +
                `**${lang.fun.decide.probabilityLabel}:** \`${percentage}%\`\n` +
                `*${interpretation}*`,
            footer: lang.fun.decide.quantumFooter,
            tone
        });

        await sendReply(card);
    },

    async handleWheel(interaction, sendReply) {
        const optionsStr = interaction.options.getString('options');
        if (!optionsStr) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needWheelOptions
            ));
        }

        const options = optionsStr.split(',').map(opt => opt.trim()).filter(Boolean);

        if (options.length < 2) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needMoreWheelOptions
            ));
        }

        const chosen = options[Math.floor(Math.random() * options.length)];
        const percent = Math.round(100 / options.length);

        const card = buildCard({
            title: lang.fun.decide.wheelResultTitle.replace('{emoji}', getEmoji('games')),
            description: `${lang.fun.decide.wheelSpinning}\n\n` +
                `**\`${chosen}\`**\n\n` +
                `**${lang.fun.decide.allOptionsLabel}:** ${options.join(' • ')}\n` +
                `${lang.fun.decide.wheelStats.replace('{count}', options.length).replace('{percent}', percent)}`,
            footer: lang.fun.decide.wheelFooter,
            accentColor: 0x9b59b6
        });

        await sendReply(card);
    },

    async handleTier(interaction, sendReply) {
        const itemsStr = interaction.options.getString('items');
        if (!itemsStr) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needTierItems
            ));
        }

        const items = itemsStr.split(',').map(item => item.trim()).filter(Boolean);

        if (items.length < 3) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needMoreTierItems
            ));
        }

        const tierBadge = {
            'S': getEmoji('games') || '🏆',
            'A': getEmoji('games') || '🥇',
            'B': getEmoji('games') || '🥈',
            'C': getEmoji('games') || '🥉',
            'D': getEmoji('games') || '🎖️'
        };

        
        try {
            const serverId = interaction.guild?.id || 'global_user';
            const prompt = `You are an expert judge and tier list creator.
Intelligently rank the following items into tiers (S, A, B, C, D) based on power, quality, skill, prestige, or general consensus:
Items to rank: ${items.join(', ')}

Output must be ONLY valid JSON matching this schema:
{
  "S": ["item name"],
  "A": ["item name"],
  "B": ["item name"],
  "C": ["item name"],
  "D": ["item name"],
  "reasoning": "1-2 sentence explanation of the ranking logic"
}
Ensure every item is categorized and names match the input list.`;

            const response = await aiManager.generateContent(serverId, prompt, { timeout: 20000 });
            const rawText = response.text().trim();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const tierLines = [];
                const entryTemplate = lang.fun?.decide?.tierEntry || '**{emoji} {tier} Tier:** {items}';
                for (const t of ['S', 'A', 'B', 'C', 'D']) {
                    const list = Array.isArray(parsed[t]) ? parsed[t] : [];
                    if (list.length > 0) {
                        tierLines.push(
                            entryTemplate
                                .replace('{emoji}', tierBadge[t])
                                .replace('{tier}', t)
                                .replace('{items}', list.join(', '))
                        );
                    }
                }

                if (tierLines.length > 0) {
                    if (parsed.reasoning) {
                        tierLines.push(`\n*${parsed.reasoning}*`);
                    }

                    const card = buildCard({
                        title: lang.fun.decide.tierListTitle.replace('{emoji}', getEmoji('list')),
                        description: tierLines.join('\n'),
                        footer: lang.fun.decide.aiTierFooter || 'AI-Powered Intelligent Tier Ranking',
                        accentColor: 0xf1c40f
                    });

                    return await sendReply(card);
                }
            }
        } catch (aiErr) {
            console.warn('[Decide Tier] AI tier ranking failed, falling back to random distribution:', aiErr.message);
        }

        
        const tiers = {
            'S': { emoji: tierBadge['S'], items: [] },
            'A': { emoji: tierBadge['A'], items: [] },
            'B': { emoji: tierBadge['B'], items: [] },
            'C': { emoji: tierBadge['C'], items: [] },
            'D': { emoji: tierBadge['D'], items: [] }
        };

        const shuffled = [...items].sort(() => Math.random() - 0.5);
        const tierKeys = Object.keys(tiers);

        shuffled.forEach(item => {
            const tierIndex = Math.floor(Math.random() * tierKeys.length);
            const tierKey = tierKeys[tierIndex];
            tiers[tierKey].items.push(item);
        });

        const tierLines = [];
        const entryTemplate = lang.fun?.decide?.tierEntry || '**{emoji} {tier} Tier:** {items}';
        for (const [tier, data] of Object.entries(tiers)) {
            if (data.items.length > 0) {
                tierLines.push(
                    entryTemplate
                        .replace('{emoji}', data.emoji)
                        .replace('{tier}', tier)
                        .replace('{items}', data.items.join(', '))
                );
            }
        }

        const card = buildCard({
            title: lang.fun.decide.tierListTitle.replace('{emoji}', getEmoji('list')),
            description: tierLines.join('\n'),
            footer: lang.fun.decide.tierFooter,
            accentColor: 0xf1c40f
        });

        await sendReply(card);
    },

    async handlePairs(interaction, sendReply) {
        const peopleStr = interaction.options.getString('people');
        if (!peopleStr) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needPairPeople
            ));
        }

        const people = peopleStr.split(',').map(person => person.trim()).filter(Boolean);

        if (people.length < 2) {
            return await sendReply(cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.needMorePairPeople
            ));
        }

        const shuffled = [...people].sort(() => Math.random() - 0.5);
        const pairs = [];
        let leftOver = null;

        for (let i = 0; i < shuffled.length - 1; i += 2) {
            pairs.push([shuffled[i], shuffled[i + 1]]);
        }

        if (shuffled.length % 2 === 1) {
            leftOver = shuffled[shuffled.length - 1];
        }

        let pairText = pairs.map((pair, index) =>
            `**${lang.fun.decide.pairLabel.replace('{number}', index + 1)}:** \`${pair[0]}\` & \`${pair[1]}\``
        ).join('\n');

        if (leftOver) {
            pairText += `\n\n**${lang.fun.decide.oddOneOut.replace('{person}', leftOver)}**`;
        }

        const card = buildCard({
            title: lang.fun.decide.pairsTitle.replace('{emoji}', getEmoji('groupusers')),
            description: pairText + `\n\n${lang.fun.decide.pairsSummary.replace('{people}', people.length).replace('{pairs}', pairs.length)}`,
            footer: lang.fun.decide.pairsFooter,
            accentColor: 0x34495e
        });

        await sendReply(card);
    },

    async handleAICommand(interaction, commandType, sendReply) {
        try {
            const prompt = this.getAIPrompt(commandType, interaction);
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 30000 });

            const content = response.text();
            const config = this.getAIConfig(commandType);

            await sendV2AIResponse(interaction, {
                title: config.title,
                headerEmoji: config.emojiKey,
                accentColor: config.color,
                text: content
            });

        } catch (error) {
            console.error(`AI command error (${commandType}):`, error);
            const card = cards.error(
                lang.fun.decide.errorTitle.replace('{emoji}', getEmoji('cross')),
                lang.fun.decide.aiError
            );
            await sendReply(card);
        }
    },

    getAIPrompt(commandType, interaction) {
        const prompts = {
            scenario: `Generate a thought-provoking "What would you do if..." scenario. ${this.getOptionalTheme(interaction, 'theme')}
Make it interesting, realistic, and engaging. Include enough detail to spark discussion.
Format: Present the scenario clearly and end with the question "What would you do?"`,

            apocalypse: `Create an end-of-world survival scenario. ${this.getOptionalTheme(interaction, 'type')}
Include:
1. The apocalyptic event/situation
2. Your current resources and location
3. Immediate dangers and challenges
4. A strategic decision you must make
Make it engaging and realistic, not too dark or disturbing.`,

            superpower: `Generate a unique superpower with detailed description. ${this.getOptionalTheme(interaction, 'category')}
Include:
1. Power name and core ability
2. How it works mechanically
3. Practical applications
4. Potential drawbacks or limitations
5. Creative uses most people wouldn't think of
Make it original and interesting!`,

            villain: `Create an original villain character with compelling backstory. ${this.getOptionalTheme(interaction, 'genre')}
Include:
1. Villain name and appearance
2. Origin story/what made them evil
3. Powers/abilities and methods
4. Ultimate goal or motivation
5. Fatal flaw or weakness
Make them complex and interesting, not just "evil for evil's sake."` ,

            dimension: `Describe a fascinating alternate reality dimension. ${this.getOptionalTheme(interaction, 'aspect')}
Include:
1. Key differences from our reality
2. How daily life works there
3. Unique laws of physics or society
4. What visitors from our world would notice first
5. An interesting inhabitant or culture
Be creative and mind-bending!`,

            paradox: `Generate a fascinating philosophical paradox with analysis. ${this.getOptionalTheme(interaction, 'field')}
Include:
1. Clear statement of the paradox
2. Why it's paradoxical/contradictory
3. Real-world examples or applications
4. Different approaches to resolving it
5. Why it matters philosophically
Make it accessible but intellectually stimulating.`,

            thought_experiment: `Create a mind-bending thought experiment. ${this.getOptionalTheme(interaction, 'topic')}
Include:
1. The scenario setup
2. The key question or dilemma
3. Why it's philosophically important
4. Different possible conclusions
5. What it reveals about reality/consciousness/ethics
Think Trolley Problem or Ship of Theseus level!`,

            debate_topic: `Generate a compelling debate topic with starting arguments. ${this.getOptionalTheme(interaction, 'domain')}
Include:
1. Clear debate statement/proposition
2. Strong argument FOR the position
3. Strong argument AGAINST the position
4. Key evidence or examples for both sides
5. Why this topic matters
Make it thought-provoking and balanced!`,

            conspiracy_theory: `Create a hilarious fictional conspiracy theory. ${this.getOptionalTheme(interaction, 'subject')}
Include:
1. The absurd conspiracy claim
2. "Evidence" that supports it
3. Who's supposedly behind it and why
4. How "they" keep it secret
5. What "they" don't want you to know
Make it obviously fake but entertainingly ridiculous!`,

            moral_dilemma: `Present a complex ethical dilemma requiring difficult choices. ${this.getOptionalTheme(interaction, 'context')}
Include:
1. The situation and key players
2. The difficult choice that must be made
3. Arguments for different options
4. What values/principles are in conflict
5. Why there's no clearly "right" answer
Make it genuinely challenging and thought-provoking.`,

            future_prediction: `Generate a plausible future scenario. ${this.getOptionalTheme(interaction, 'timeframe')}
Include:
1. What has changed from today
2. Key technological or social developments
3. How daily life is different
4. New challenges or opportunities
5. What surprised people the most
Base it on current trends but be creative!`,

            invention: `Create an impossible but detailed invention. ${this.getOptionalTheme(interaction, 'purpose')}
Include:
1. Invention name and what it does
2. How it supposedly works (pseudo-science OK)
3. Materials needed and construction
4. Practical applications
5. Unexpected side effects or uses
Make it creative and slightly absurd but detailed!`,

            alternate_history: `Explore a "what if" historical scenario. ${this.getOptionalTheme(interaction, 'period')}
Include:
1. The key historical change/event
2. Immediate consequences
3. How the world developed differently
4. What life is like in this timeline
5. One surprising butterfly effect
Make it plausible and fascinating!`,

            philosophy_question: `Generate a deep philosophical question with exploration. ${this.getOptionalTheme(interaction, 'branch')}
Include:
1. The central question
2. Why this question is important
3. Different philosophical approaches
4. What's at stake in the answer
5. How it relates to everyday life
Make it genuinely thought-provoking!`,

            scientific_theory: `Create a fictional scientific theory with explanation. ${this.getOptionalTheme(interaction, 'field')}
Include:
1. Theory name and core principle
2. Scientific explanation (can be fictional)
3. Evidence that "supports" it
4. Practical applications or implications
5. What experiments could test it
Make it sound scientific but be creative!`
        };

        return prompts[commandType] || 'Generate something interesting and creative!';
    },

    getOptionalTheme(interaction, optionName) {
        const theme = interaction.options.getString(optionName);
        return theme ? `Focus on: ${theme}.` : 'Choose any theme.';
    },

    getAIConfig(commandType) {
        const t = lang.fun?.decide?.titles || {};
        const configs = {
            scenario: { title: t.scenario || 'Hypothetical Scenario', color: 0x9b59b6, emojiKey: 'help' },
            apocalypse: { title: t.apocalypse || 'Apocalypse Survival', color: 0xe74c3c, emojiKey: 'cross' },
            superpower: { title: t.superpower || 'Superpower Granted!', color: 0xf1c40f, emojiKey: 'sparkles' },
            villain: { title: t.villain || 'Villain Profile', color: 0xc0392b, emojiKey: 'cross' },
            dimension: { title: t.dimension || 'Alternate Dimension', color: 0x5865f2, emojiKey: 'world' },
            paradox: { title: t.paradox || 'Philosophical Paradox', color: 0x1f3c73, emojiKey: 'help' },
            thought_experiment: { title: t.thought_experiment || 'Thought Experiment', color: 0x1a237e, emojiKey: 'document' },
            debate_topic: { title: t.debate_topic || 'Debate Topic', color: 0xe67e22, emojiKey: 'smile' },
            conspiracy_theory: { title: t.conspiracy_theory || 'Conspiracy Theory', color: 0xf1c40f, emojiKey: 'warning' },
            moral_dilemma: { title: t.moral_dilemma || 'Moral Dilemma', color: 0x27ae60, emojiKey: 'help' },
            future_prediction: { title: t.future_prediction || 'Future Prediction', color: 0x00ffff, emojiKey: 'rocket' },
            invention: { title: t.invention || 'Impossible Invention', color: 0xe91e63, emojiKey: 'settings' },
            alternate_history: { title: t.alternate_history || 'Alternate History', color: 0xb7950b, emojiKey: 'calendar' },
            philosophy_question: { title: t.philosophy_question || 'Philosophical Question', color: 0x4a148c, emojiKey: 'help' },
            scientific_theory: { title: t.scientific_theory || 'Scientific Theory', color: 0x2ecc71, emojiKey: 'sparkles' }
        };
        return configs[commandType] || { title: t.default || 'AI Recommendation', color: 0x3498db, emojiKey: 'help' };
    }
};

