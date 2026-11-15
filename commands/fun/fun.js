
const { SlashCommandBuilder } = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fun')
        .setDescription('Ultimate fun and games command collection')
        .addSubcommand(subcommand =>
            subcommand.setName('8ball')
                .setDescription('Ask the magic 8-ball a question')
                .addStringOption(option =>
                    option.setName('question')
                        .setDescription('The question you want to ask')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('choose')
                .setDescription('Choose between multiple options')
                .addStringOption(option =>
                    option.setName('options')
                        .setDescription('Options separated by commas (e.g., pizza, burger, tacos)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('rate')
                .setDescription('Rate something from 0-10')
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('What do you want to rate?')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Rating category')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Cuteness', value: 'cuteness' },
                            { name: 'Intelligence', value: 'intelligence' },
                            { name: 'Strength', value: 'strength' },
                            { name: 'Humor', value: 'humor' },
                            { name: 'Creativity', value: 'creativity' },
                            { name: 'Speed', value: 'speed' },
                            { name: 'Overall', value: 'overall' }
                        )))
        .addSubcommand(subcommand =>
            subcommand.setName('roll')
                .setDescription('Roll a dice')
                .addIntegerOption(option =>
                    option.setName('sides')
                        .setDescription('Number of sides on the dice (default: 6)')
                        .setRequired(false)
                        .setMinValue(2)
                        .setMaxValue(100)))
        .addSubcommand(subcommand =>
            subcommand.setName('flip')
                .setDescription('Flip a coin'))
        .addSubcommand(subcommand =>
            subcommand.setName('rps')
                .setDescription('Play Rock Paper Scissors')
                .addStringOption(option =>
                    option.setName('choice')
                        .setDescription('Your choice')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Rock', value: 'rock' },
                            { name: 'Paper', value: 'paper' },
                            { name: 'Scissors', value: 'scissors' }
                        )))
        .addSubcommand(subcommand =>
            subcommand.setName('dice')
                .setDescription('Roll multiple dice')
                .addIntegerOption(option =>
                    option.setName('count')
                        .setDescription('Number of dice to roll (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20))
                .addIntegerOption(option =>
                    option.setName('sides')
                        .setDescription('Number of sides per dice (default: 6)')
                        .setRequired(false)
                        .setMinValue(2)
                        .setMaxValue(100)))
        .addSubcommand(subcommand =>
            subcommand.setName('compliment')
                .setDescription('Give someone a compliment')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to compliment')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('roast')
                .setDescription('Roast someone (friendly!)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to roast')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('fortune')
                .setDescription('Get your fortune told'))
        .addSubcommand(subcommand =>
            subcommand.setName('ship')
                .setDescription('Ship two users together')
                .addUserOption(option =>
                    option.setName('user1')
                        .setDescription('First person')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user2')
                        .setDescription('Second person')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('iq')
                .setDescription('Check someone\'s IQ (for fun!)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check IQ for')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('howgay')
                .setDescription('How gay is someone? (for fun!)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('slots')
                .setDescription('Play slot machine'))
        .addSubcommand(subcommand =>
            subcommand.setName('lottery')
                .setDescription('Play the lottery'))
        .addSubcommand(subcommand =>
            subcommand.setName('gender')
                .setDescription('Guess someone\'s gender (for fun!)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to guess gender for')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('age')
                .setDescription('Guess someone\'s age (for fun!)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to guess age for')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('kill')
                .setDescription('Kill someone (virtually and friendly!)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to kill')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('simp')
                .setDescription('How much of a simp is someone?')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check simp level')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('pp')
                .setDescription('Check pp size (for fun!)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('stupid')
                .setDescription('How stupid is someone?')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check stupidity level')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('smart')
                .setDescription('How smart is someone?')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check smartness level')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('sus')
                .setDescription('How sus is someone?')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check sus level')
                        .setRequired(false))),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Fun] Defer failed:', err.message);
                return;
            }
        }

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

        const VALID_SUBS = new Set([
            '8ball', 'choose', 'rate', 'roll', 'flip', 'rps', 'dice',
            'compliment', 'roast', 'fortune', 'ship', 'iq', 'howgay',
            'slots', 'lottery', 'gender', 'age', 'kill', 'simp', 'pp',
            'stupid', 'smart', 'sus'
        ]);

        let subcommand = '';
        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            const rawSub = args?.[0]?.toLowerCase();
            if (rawSub && VALID_SUBS.has(rawSub)) {
                subcommand = rawSub;
            } else {
                subcommand = 'help';
            }
        }

        if (!isSlash && subcommand !== 'help') {
            interaction.options = {
                getSubcommand: () => subcommand,
                getString: (name) => {
                    if (name === 'options') return args.slice(1).join(' ');
                    if (name === 'question') return args.slice(1).join(' ');
                    if (name === 'target') {
                        const remaining = args.slice(1).join(' ');
                        return remaining.includes(',') ? remaining.split(',')[0].trim() : remaining;
                    }
                    if (name === 'category') {
                        const remaining = args.slice(1).join(' ');
                        return remaining.includes(',') ? remaining.split(',')[1].trim() : 'overall';
                    }
                    if (name === 'choice') return args[1]?.toLowerCase() || 'rock';
                    return null;
                },
                getInteger: (name) => {
                    if (name === 'sides') return parseInt(args[2] || args[1], 10) || null;
                    if (name === 'count') return parseInt(args[1], 10) || null;
                    return null;
                },
                getUser: (name) => {
                    if (name === 'user' || name === 'user1') {
                        const input = args[1];
                        return resolveUser(input) || interaction.author;
                    }
                    if (name === 'user2') {
                        const input = args.slice(1).join(' ').includes(',')
                            ? args.slice(1).join(' ').split(',')[1].trim()
                            : args[2];
                        return resolveUser(input) || client.user;
                    }
                    return null;
                }
            };
        }

        const sendReply = async (card) => {
            return await sendV2(interaction, card);
        };

        if (subcommand === 'help') {
            const helpTitle = lang.fun.fun.guideTitle.replace('{emoji}', getEmoji('games'));
            const helpDesc = lang.fun.fun.guideDesc;
            const helpBody = [
                `### **${lang.fun.fun.subcommandsTitle}**`,
                `• **8ball**: Ask a question. \`!fun 8ball Will it rain today?\``,
                `• **choose**: Choose options. \`!fun choose pizza, burger, tacos\``,
                `• **rate**: Rate something. \`!fun rate Pizza\` or \`!fun rate Shiva, cuteness\``,
                `• **roll**: Roll dice. \`!fun roll\` or \`!fun roll 20\` (D20)`,
                `• **flip**: Flip a coin. \`!fun flip\``,
                `• **rps**: Rock Paper Scissors. \`!fun rps rock\``,
                `• **dice**: Roll multiple dice. \`!fun dice 3\` (3 dice)`,
                `• **compliment**: Compliment a user. \`!fun compliment @user\``,
                `• **roast**: Roast a user. \`!fun roast @user\``,
                `• **fortune**: Tell your fortune. \`!fun fortune\``,
                `• **ship**: Ship compatibility. \`!fun ship @user1, @user2\``,
                `• **iq**: Check IQ. \`!fun iq @user\``,
                `• **howgay**: Gay-o-Meter. \`!fun howgay @user\``,
                `• **slots**: Slot machine. \`!fun slots\``,
                `• **lottery**: Play lottery. \`!fun lottery\``,
                `• **gender**: Guess gender. \`!fun gender @user\``,
                `• **age**: Guess age. \`!fun age @user\``,
                `• **kill**: Eliminate a user. \`!fun kill @user\``,
                `• **simp**: Simp detector. \`!fun simp @user\``,
                `• **pp**: PP size check. \`!fun pp @user\``,
                `• **stupid**: Stupidity checker. \`!fun stupid @user\``,
                `• **smart**: Smartness checker. \`!fun smart @user\``,
                `• **sus**: Sus detector. \`!fun sus @user\``
            ].join('\n');

            const helpCard = buildCard({
                title: helpTitle,
                description: helpDesc,
                sections: [helpBody],
                accentColor: ACCENT.primary
            });

            return await sendReply(helpCard);
        }

        try {
            switch (subcommand) {
                case '8ball': return await this.handle8Ball(interaction, sendReply);
                case 'choose': return await this.handleChoose(interaction, sendReply);
                case 'rate': return await this.handleRate(interaction, sendReply);
                case 'roll': return await this.handleRoll(interaction, sendReply);
                case 'flip': return await this.handleFlip(interaction, sendReply);
                case 'rps': return await this.handleRPS(interaction, sendReply);
                case 'dice': return await this.handleDice(interaction, sendReply);
                case 'compliment': return await this.handleCompliment(interaction, sendReply);
                case 'roast': return await this.handleRoast(interaction, sendReply);
                case 'fortune': return await this.handleFortune(interaction, sendReply);
                case 'ship': return await this.handleShip(interaction, sendReply);
                case 'iq': return await this.handleIQ(interaction, sendReply);
                case 'howgay': return await this.handleHowGay(interaction, sendReply);
                case 'slots': return await this.handleSlots(interaction, sendReply);
                case 'lottery': return await this.handleLottery(interaction, sendReply);
                case 'gender': return await this.handleGender(interaction, sendReply);
                case 'age': return await this.handleAge(interaction, sendReply);
                case 'kill': return await this.handleKill(interaction, sendReply);
                case 'simp': return await this.handleSimp(interaction, sendReply);
                case 'pp': return await this.handlePP(interaction, sendReply);
                case 'stupid': return await this.handleStupid(interaction, sendReply);
                case 'smart': return await this.handleSmart(interaction, sendReply);
                case 'sus': return await this.handleSus(interaction, sendReply);
                default: return await this.handleError(interaction, sendReply, 'Unknown subcommand');
            }
        } catch (error) {
            console.error('Error executing fun command:', error);
            return await this.handleError(interaction, sendReply, error.message);
        }
    },

    async handle8Ball(interaction, sendReply) {
        const question = interaction.options.getString('question');
        const responses = [
            "It is certain.", "It is decidedly so.", "Without a doubt.", "Yes – definitely.",
            "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.",
            "Yes.", "Signs point to yes.", "Absolutely.", "Certainly.", "Sure thing.",
            "Of course.", "Definitely.", "For sure.", "Yes, indeed.", "You got it.",
            "Affirmative.", "Positively.", "Unquestionably.", "Indubitably.", "Sure.",
            "All signs say yes.", "The stars align for yes.", "Fortune favors your question with yes.",

            "Reply hazy, try again.", "Ask again later.", "Better not tell you now.",
            "Cannot predict now.", "Concentrate and ask again.", "The universe is undecided.",
            "Cosmic forces are in flux.", "The answer lies in mystery.", "Time will reveal all.",

            "Don't count on it.", "My reply is no.", "My sources say no.", "Outlook not so good.",
            "Very doubtful.", "No way.", "I don't think so.", "Definitely not.", "Not a chance.",
            "No.", "Absolutely not.", "Certainly not.", "No, indeed.", "No, for sure.",
            "The answer is clearly no.", "Not in this lifetime.", "Dream on.", "Forget about it."
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];
        const isPositive = response.toLowerCase().includes('yes') || response.toLowerCase().includes('certain') || response.toLowerCase().includes('definitely');
        const isNegative = response.toLowerCase().includes('no') || response.toLowerCase().includes('not') || response.toLowerCase().includes('doubtful');

        const accentColor = isPositive ? 0x00ff00 : isNegative ? 0xff0000 : 0x9b59b6;
        const title = lang.fun.fun.eightBallTitle.replace('{emoji}', getEmoji('games'));

        const sections = [
            `## ${getEmoji('help')} **${lang.fun.fun.question}**\n\n*"${question}"*`,
            `## ${getEmoji('sparkles')} **${lang.fun.fun.oracleAnswer}**\n\n**${response}**`,
            `## ${getEmoji('analytics')} **${lang.fun.fun.mysticalAnalysis}**\n\n**${lang.fun.fun.energyType}** ${isPositive ? `${getEmoji('tick')} ${lang.fun.fun.positiveVibrations}` : isNegative ? `${getEmoji('cross')} ${lang.fun.fun.negativeForces}` : `${getEmoji('loop')} ${lang.fun.fun.neutralBalance}`}\n\n**${lang.fun.fun.cosmicAlignment}** ${isPositive ? lang.fun.fun.starsFavor : isNegative ? lang.fun.fun.obstaclesAhead : lang.fun.fun.universeUndecided}\n\n**${lang.fun.fun.confidenceLevel}** ${Math.floor(Math.random() * 41) + 60}% certainty`
        ];

        const card = buildCard({
            title,
            description: `> The mystical sphere has gazed into the cosmic void\n> Your destiny has been revealed through ancient magic`,
            sections,
            accentColor,
            footer: `${getEmoji('games')} Mystical 8-Ball • ${isPositive ? 'Positive' : isNegative ? 'Negative' : 'Neutral'} energy detected • Ancient wisdom prevails`
        });

        return sendReply(card);
    },

    async handleChoose(interaction, sendReply) {
        const optionsString = interaction.options.getString('options');
        let options = optionsString.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);

        if (options.length === 1 && options[0].includes(' ')) {
            options = options[0].split(' ').filter(opt => opt.length > 0);
        }

        if (options.length < 2) {
            return this.handleError(interaction, sendReply, 'Please provide at least 2 options separated by commas or spaces');
        }

        const chosen = options[Math.floor(Math.random() * options.length)];
        const confidence = Math.floor(Math.random() * 31) + 70;

        const title = lang.fun.fun.chooseTitle.replace('{emoji}', getEmoji('sparkles'));
        const chosenText = lang.fun.fun.chooseResult.replace('{choice}', chosen);

        const sections = [
            `## ${getEmoji('list')} **Available Options**\n\n${options.map((opt, i) => `${i + 1}. **${opt}**`).join('\n')}`,
            `## ${getEmoji('crown')} **Final Decision**\n\n${chosenText}`,
            `## ${getEmoji('analytics')} **Analysis Report**\n\n**Selection Method:** Quantum randomness\n**Probability Distribution:** Equal (${(100 / options.length).toFixed(1)}% each)\n**Decision Confidence:** ${confidence}%\n**Algorithm Bias:** None detected\n**Cosmic Influence:** Minimal interference`
        ];

        const card = buildCard({
            title,
            description: `> Analyzing all possibilities through advanced algorithms\n> The universe has made its choice`,
            sections,
            accentColor: ACCENT.primary,
            footer: `${getEmoji('sparkles')} Decision engine • ${options.length} options analyzed • Winner: ${chosen} • ${confidence}% confidence`
        });

        return sendReply(card);
    },

    async handleRate(interaction, sendReply) {
        const target = interaction.options.getString('target');
        const category = interaction.options.getString('category') || 'overall';
        const rating = Math.floor(Math.random() * 11);

        const categoryData = {
            cuteness: { emoji: getEmoji('heart'), color: 0xff69b4, desc: 'Adorability Factor' },
            intelligence: { emoji: getEmoji('basic'), color: 0x3498db, desc: 'Brain Power Level' },
            strength: { emoji: getEmoji('fire'), color: 0xe74c3c, desc: 'Physical Prowess' },
            humor: { emoji: getEmoji('smile'), color: 0xf39c12, desc: 'Comedy Quotient' },
            creativity: { emoji: getEmoji('sparkles'), color: 0x9b59b6, desc: 'Artistic Vision' },
            speed: { emoji: getEmoji('trend'), color: 0xffff00, desc: 'Velocity Measurement' },
            overall: { emoji: getEmoji('star'), color: 0x00ff00, desc: 'General Assessment' }
        };

        const catData = categoryData[category] || categoryData.overall;
        const ratingColor = rating <= 3 ? 0xff0000 : rating <= 6 ? 0xffa500 : rating <= 8 ? 0xffff00 : 0x00ff00;
        const ratingBars = '█'.repeat(rating) + '░'.repeat(10 - rating);
        const percentile = Math.floor(Math.random() * 40) + (rating * 6);

        const title = lang.fun.fun.rateTitle.replace('{emoji}', catData.emoji);

        const sections = [
            `## ${getEmoji('analytics')} **Comprehensive Rating Report**\n\n**Subject:** ${target}\n**Category:** ${catData.emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}\n**Score:** ${rating}/10 ${getEmoji('star')}\n\n**Visual Rating**\n${ratingBars}\n\n**Performance Metrics**\n• **Grade:** ${rating <= 3 ? `${getEmoji('cross')} Needs Development` : rating <= 6 ? `${getEmoji('warning')} Satisfactory` : rating <= 8 ? `${getEmoji('tick')} Excellent` : `${getEmoji('crown')} Outstanding`}\n• **Percentile:** ${percentile}th percentile\n• **Standard Deviation:** ±${(Math.random() * 2).toFixed(1)}\n• **Confidence Interval:** 95%\n\n**Expert Commentary**\n${rating >= 8 ? 'Exceptional performance in this category' : rating >= 6 ? 'Solid results with room for growth' : rating >= 4 ? 'Average performance with potential' : 'Significant improvement opportunities exist'}`
        ];

        const card = buildCard({
            title,
            description: `> Advanced AI-powered assessment complete\n> Multi-dimensional evaluation finished`,
            sections,
            accentColor: ratingColor,
            footer: `${catData.emoji} Professional assessment • ${rating}/10 score • ${percentile}th percentile • Category: ${category}`
        });

        return sendReply(card);
    },

    async handleRoll(interaction, sendReply) {
        const sides = interaction.options.getInteger('sides') || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        const rollTime = new Date().toLocaleTimeString();

        const title = lang.fun.fun.rollTitle.replace('{emoji}', getEmoji('games'));
        const rollText = lang.fun.fun.rollResult
            .replace('{result}', result)
            .replace('{sides}', sides);

        const sections = [
            `## ${getEmoji('star')} **Roll Results & Analysis**\n\n**Die Configuration:** D${sides} (${sides}-sided)\n**Final Result:** ${rollText} ${getEmoji('games')}\n**Roll Time:** ${rollTime}\n\n**Statistical Analysis**\n• **Probability:** 1/${sides} (${(100 / sides).toFixed(2)}%)\n• **Expected Value:** ${((sides + 1) / 2).toFixed(1)}\n• **Variance:** ${((sides ** 2 - 1) / 12).toFixed(2)}\n• **Roll Quality:** ${result === 1 ? `${getEmoji('cross')} Critical Minimum` : result === sides ? `${getEmoji('crown')} Critical Maximum` : result > sides / 2 ? `${getEmoji('warning')} Above Average` : `${getEmoji('warning')} Below Average`}\n\n**Outcome Assessment**\n${result === 1 ? 'Snake eyes! The dice gods are not pleased.' : result === sides ? 'Maximum roll achieved! Fortune smiles upon you!' : result >= sides * 0.75 ? 'Excellent roll! Lady Luck is on your side.' : result >= sides * 0.5 ? 'Decent roll, could be worse!' : 'Below average, but that\'s how probability works!'}`
        ];

        const card = buildCard({
            title,
            description: `> Utilizing quantum randomness generators\n> Physics-based probability simulation active`,
            sections,
            accentColor: 0xffcc00,
            footer: `${getEmoji('games')} Digital dice simulator • D${sides} • Result: ${result} • ${rollTime}`
        });

        return sendReply(card);
    },

    async handleFlip(interaction, sendReply) {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const sideEmoji = result === 'Heads' ? (getEmoji('crown')) : (getEmoji('world'));
        const flipHeight = Math.floor(Math.random() * 8) + 3;
        const rotations = Math.floor(Math.random() * 15) + 5;

        const title = lang.fun.fun.flipTitle.replace('{emoji}', getEmoji('games'));
        const flipText = lang.fun.fun.flipResult.replace('{result}', result);

        const sections = [
            `## ${getEmoji('star')} **Flip Results & Physics**\n\n**Final Outcome:** ${flipText} ${sideEmoji}\n\n**Flight Data**\n• **Maximum Height:** ${flipHeight} feet\n• **Total Rotations:** ${rotations} full spins\n• **Flight Time:** ${(Math.random() * 2 + 1).toFixed(1)} seconds\n• **Landing Surface:** Flat ground\n• **Air Resistance:** Minimal\n\n**Probability Analysis**\n• **Heads Chance:** 50.000%\n• **Tails Chance:** 50.000%\n• **Edge Landing:** 0.001% (impossible)\n• **Fairness Index:** 100% unbiased\n\n**Historical Context**\n${result === 'Heads' ? ' The noble side prevails! Royalty wins the day.' : ' Freedom soars! The eagle side takes flight.'}\n\nThis result joins millions of coin flips throughout history, each one a perfect example of probability in action.`
        ];

        const card = buildCard({
            title,
            description: `> Simulating aerodynamic coin physics\n> Binary probability system engaged`,
            sections,
            accentColor: 0xc9b037,
            footer: `${getEmoji('games')} Coin physics simulator • Result: ${result} ${sideEmoji} • ${rotations} rotations • ${flipHeight}ft height`
        });

        return sendReply(card);
    },

    async handleRPS(interaction, sendReply) {
        const userChoice = interaction.options.getString('choice');
        const choices = ['rock', 'paper', 'scissors'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];

        const emojis = {
            rock: getEmoji('settings'),
            paper: getEmoji('document'),
            scissors: getEmoji('ticket')
        };
        const names = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

        let result;
        if (userChoice === botChoice) {
            result = 'tie';
        } else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
        ) {
            result = 'win';
        } else {
            result = 'lose';
        }

        const resultColor = result === 'win' ? 0x00ff00 : result === 'lose' ? 0xff0000 : 0xffff00;
        const resultText = result === 'win' ? 'Victory!' : result === 'lose' ? 'Defeat!' : 'Draw!';
        const battleTime = new Date().toLocaleTimeString();

        const title = lang.fun.fun.rpsTitle.replace('{emoji}', getEmoji('games'));

        const sections = [
            `## ${getEmoji('fire')} **Battle Report**\n\n**Combatants**\n• **${interaction.user.displayName || interaction.user.username}:** ${emojis[userChoice]} ${names[userChoice]}\n• **AI Opponent:** ${emojis[botChoice]} ${names[botChoice]}\n\n**Battle Time:** ${battleTime}\n\n**Combat Analysis**\n• **Your Strategy:** ${userChoice === 'rock' ? 'Brute force approach' : userChoice === 'paper' ? 'Tactical coverage' : 'Precise cutting technique'}\n• **AI Strategy:** ${botChoice === 'rock' ? 'Defensive positioning' : botChoice === 'paper' ? 'Adaptive shielding' : 'Aggressive striking'}\n\n**Final Outcome**\n${result === 'win' ? `${getEmoji('crown')} **CHAMPION!** Your superior tactics have prevailed!` : result === 'lose' ? `${getEmoji('cross')} **DEFEATED!** The AI's strategy proved superior this time.` : `${getEmoji('chat')} **STALEMATE!** Both warriors chose identical strategies!`}\n\n**Win Statistics**\n• **Historical Win Rate:** ${Math.floor(Math.random() * 20) + 40}%\n• **Streak Status:** ${result === 'win' ? 'Victory streak possible!' : 'Ready for redemption!'}\n• **Skill Rating:** ${result === 'win' ? 'Champion tier' : result === 'lose' ? 'Challenger tier' : 'Balanced fighter'}`
        ];

        const card = buildCard({
            title,
            description: `> Two warriors enter the digital colosseum\n> Only one strategy can reign supreme\n> **${resultText}**`,
            sections,
            accentColor: resultColor,
            footer: `${getEmoji('games')} RPS Championship • ${resultText} • ${userChoice} vs ${botChoice} • ${battleTime}`
        });

        return sendReply(card);
    },

    async handleDice(interaction, sendReply) {
        const count = interaction.options.getInteger('count') || 1;
        const sides = interaction.options.getInteger('sides') || 6;

        const results = [];
        for (let i = 0; i < count; i++) {
            results.push(Math.floor(Math.random() * sides) + 1);
        }

        const total = results.reduce((sum, roll) => sum + roll, 0);
        const average = (total / count).toFixed(1);
        const expectedTotal = count * ((sides + 1) / 2);

        const title = lang.fun.fun.diceTitle.replace('{emoji}', getEmoji('games'));
        const diceSummary = lang.fun.fun.diceResult
            .replace('{count}', count)
            .replace('{sides}', sides)
            .replace('{rolls}', results.join(', '))
            .replace('{total}', total);

        const sections = [
            `## ${getEmoji('analytics')} **Comprehensive Roll Analysis**\n\n**Individual Results**\n${results.map((roll, i) => `Die ${i + 1}: **${roll}**${roll === 1 ? ` ${getEmoji('cross')}` : roll === sides ? ` ${getEmoji('crown')}` : ''}`).join(' • ')}\n\n**Statistical Summary**\n• **Total Score:** ${total}\n• **Average Roll:** ${average}\n• **Expected Total:** ${expectedTotal.toFixed(1)}\n• **Deviation:** ${total > expectedTotal ? `${getEmoji('tick')} Above expected` : total < expectedTotal ? `${getEmoji('warning')} Below expected` : `${getEmoji('star')} Exactly expected`}\n• **Highest Roll:** ${Math.max(...results)}\n• **Lowest Roll:** ${Math.min(...results)}\n• **Range Spread:** ${Math.max(...results) - Math.min(...results)}\n\n**Performance Assessment**\n${average > sides / 2 ? `${getEmoji('tick')} **Excellent Performance!** Your dice are running hot today.` : `${getEmoji('warning')} **Average Performance** - Standard probability distribution in effect.`}\n\n**Probability Analysis**\n• **Perfect Rolls:** ${results.filter(r => r === sides).length}/${count}\n• **Minimum Rolls:** ${results.filter(r => r === 1).length}/${count}\n• **Success Rate:** ${Math.floor((total / (count * sides)) * 100)}% of maximum possible`
        ];

        const card = buildCard({
            title,
            description: `> Quantum probability engines engaged\n> Multiple dice synchronization active\n\n${diceSummary}`,
            sections,
            accentColor: 0x9b59b6,
            footer: `${getEmoji('games')} Multi-dice system • ${count}x D${sides} • Total: ${total} • Average: ${average}`
        });

        return sendReply(card);
    },

    async handleCompliment(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const compliments = [
            { text: "You're absolutely amazing and your presence lights up every room!", category: "Personality", intensity: "High" },
            { text: "Your creativity and unique perspective inspire everyone around you!", category: "Talents", intensity: "High" },
            { text: "You have such a wonderful energy that makes people feel comfortable and happy!", category: "Social", intensity: "High" },
            { text: "Your kindness and compassion make the world a genuinely better place!", category: "Character", intensity: "Maximum" },
            { text: "You're incredibly intelligent and your insights are always thoughtful and valuable!", category: "Intellect", intensity: "High" },
            { text: "Your sense of humor is fantastic and you always know how to make people smile!", category: "Humor", intensity: "High" },
            { text: "You're such a genuine person and your authenticity is refreshing in this world!", category: "Authenticity", intensity: "Maximum" },
            { text: "Your determination and perseverance are truly admirable and motivating!", category: "Character", intensity: "High" },
            { text: "You have an incredible talent for making others feel valued and appreciated!", category: "Social", intensity: "Maximum" },
            { text: "Your positive outlook on life is contagious and brightens everyone's day!", category: "Attitude", intensity: "High" }
        ];

        const compliment = compliments[Math.floor(Math.random() * compliments.length)];
        const positivityScore = Math.floor(Math.random() * 11) + 90;
        const heartEmojis = (getEmoji('heart')).repeat(5);

        const title = lang.fun.fun.complimentTitle.replace('{emoji}', getEmoji('heart'));

        const sections = [
            `## ${getEmoji('smile')} **Personal Appreciation Message**\n\n**Dear ${user.displayName || user.username},**\n\n${compliment.text}\n\n## ${getEmoji('analytics')} **Positivity Analysis**\n\n**Compliment Category:** ${compliment.category}\n**Intensity Level:** ${compliment.intensity}\n**Positivity Score:** ${positivityScore}/100\n**Sincerity Rating:** ${heartEmojis}\n**Mood Boost Potential:** Maximum\n\n## ${getEmoji('sparkles')} **Daily Affirmation**\n\nYou are worthy of love and respect. Your unique qualities make you irreplaceable. The world is brighter because you're in it.\n\n**Remember:** You matter, you're valued, and you make a difference every single day!`
        ];

        const card = buildCard({
            title,
            description: `> Analyzing wonderful qualities and generating heartfelt appreciation\n> Everyone deserves to feel truly valued`,
            sections,
            thumbnailURL: user.displayAvatarURL(),
            accentColor: 0xff69b4,
            footer: `${getEmoji('heart')} Personalized positivity • ${compliment.category} focus • ${positivityScore}/100 score • For ${user.displayName || user.username}`
        });

        return sendReply(card);
    },

    async handleRoast(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const roasts = [
            { text: "You're like a software update - nobody wants you, but you keep showing up anyway!", category: "Technology", severity: "Mild" },
            { text: "If you were a vegetable, you'd be a cute-cumber... wait, that's actually a compliment!", category: "Food", severity: "Wholesome" },
            { text: "You're so bright, you make the sun look like a disco ball!", category: "Intelligence", severity: "Backhanded" },
            { text: "You're like a participation trophy - everyone gets one, but yours is slightly more special!", category: "Achievement", severity: "Mild" },
            { text: "Your jokes are like a broken pencil... pointless, but we still love you anyway!", category: "Humor", severity: "Gentle" },
            { text: "You're proof that even random character generation can create something wonderful!", category: "Gaming", severity: "Wholesome" },
            { text: "You're like pizza - even when you're bad, you're still pretty good!", category: "Food", severity: "Compliment" },
            { text: "If sarcasm was a superpower, you'd be... well, you'd still need a cape!", category: "Personality", severity: "Mild" },
            { text: "You're like a dictionary - you add meaning to everything, but most people skip past you!", category: "Education", severity: "Clever" },
            { text: "You're the human equivalent of autocorrect - you try to help, but sometimes make things wonderfully weird!", category: "Technology", severity: "Endearing" }
        ];

        const roast = roasts[Math.floor(Math.random() * roasts.length)];
        const burnLevel = Math.floor(Math.random() * 3) + 1;
        const friendshipPoints = Math.floor(Math.random() * 11) + 90;

        const title = lang.fun.fun.roastTitle.replace('{emoji}', getEmoji('fire'));

        const sections = [
            `## ${getEmoji('smile')} **Friendly Roast Special**\n\n**Target:** ${user.displayName || user.username}\n\n**The Roast:**\n"${roast.text}"\n\n## ${getEmoji('analytics')} **Roast Analysis**\n\n**Category:** ${roast.category}\n**Severity Level:** ${roast.severity}\n**Burn Rating:** ${(getEmoji('fire')).repeat(burnLevel)} (${burnLevel}/10)\n**Friendship Damage:** 0% (actually increased by ${friendshipPoints}%)\n**Comedy Points:** ${Math.floor(Math.random() * 20) + 80}/100\n\n## ${getEmoji('heart')} **Disclaimer**\n\nThis roast is made with 100% love and 0% malice. You're actually awesome and this is just playful banter between friends!\n\n**Post-Roast Hug:** ${getEmoji('welcome')}`
        ];

        const card = buildCard({
            title,
            description: `> Preparing lighthearted friendly banter\n> 100% wholesome roasting guaranteed`,
            sections,
            thumbnailURL: user.displayAvatarURL(),
            accentColor: 0xff6b6b,
            footer: `${getEmoji('fire')} Friendly roasting • ${roast.category} category • ${burnLevel}/10 burn level • Made with love for ${user.displayName || user.username}`
        });

        return sendReply(card);
    },

    async handleFortune(interaction, sendReply) {
        const fortunes = [
            { prediction: "A great adventure awaits you in the coming weeks. Be ready to embrace new opportunities!", category: "Adventure", luck: "Very High" },
            { prediction: "Your creativity will lead to unexpected success. Trust your artistic instincts!", category: "Creativity", luck: "High" },
            { prediction: "Someone from your past will bring positive news that changes your perspective.", category: "Relationships", luck: "High" },
            { prediction: "A small act of kindness you perform will have ripple effects beyond your imagination.", category: "Karma", luck: "Very High" },
            { prediction: "The solution to a persistent problem will come to you in a moment of quiet reflection.", category: "Problem-solving", luck: "High" },
            { prediction: "You will discover a hidden talent that opens doors you never knew existed.", category: "Self-discovery", luck: "Very High" },
            { prediction: "Financial opportunities will present themselves through unexpected channels.", category: "Finance", luck: "High" },
            { prediction: "A new friendship will blossom from the most unlikely circumstances.", category: "Social", luck: "High" },
            { prediction: "Your patience with a difficult situation will soon be rewarded abundantly.", category: "Patience", luck: "Very High" },
            { prediction: "The universe is aligning to bring you exactly what you need, even if it's not what you expected.", category: "Destiny", luck: "Maximum" }
        ];

        const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
        const cosmicAlignment = Math.floor(Math.random() * 21) + 80;
        const energyOptions = [getEmoji('sparkles'), getEmoji('star'), getEmoji('sparkles'), getEmoji('star'), getEmoji('help')];
        const mysticalEnergy = energyOptions[Math.floor(Math.random() * energyOptions.length)];
        const timeframe = ['within 7 days', 'this month', 'within 3 weeks', 'in the near future', 'when you least expect it'][Math.floor(Math.random() * 5)];

        const title = lang.fun.fun.fortuneTitle.replace('{emoji}', getEmoji('sparkles'));

        const sections = [
            `## ${mysticalEnergy} **Your Fortune Reading**\n\n**Seeker:** ${interaction.user.displayName || interaction.user.username}\n**Reading Time:** ${new Date().toLocaleString()}\n\n### ${getEmoji('star')} **The Prophecy**\n\n*"${fortune.prediction}"*\n\n## ${getEmoji('analytics')} **Mystical Analysis**\n\n**Fortune Category:** ${fortune.category}\n**Luck Level:** ${fortune.luck}\n**Cosmic Alignment:** ${cosmicAlignment}% favorable\n**Estimated Timeframe:** ${timeframe}\n**Spiritual Energy:** ${mysticalEnergy} Powerful\n**Probability of Manifestation:** ${Math.floor(Math.random() * 20) + 75}%\n\n## ${getEmoji('world')} **Cosmic Guidance**\n\nThe stars suggest that your positive energy and open mindset will attract the circumstances needed for this fortune to unfold. Stay receptive to signs and opportunities.\n\n**Recommended Actions:**\n• Maintain a positive outlook\n• Be open to unexpected possibilities\n• Trust your intuition\n• Practice gratitude daily\n\n*Remember: You have the power to shape your destiny through your choices and actions.*`
        ];

        const card = buildCard({
            title,
            description: `> Consulting the ancient spirits of wisdom\n> Your future is being revealed...`,
            sections,
            accentColor: 0x9b59b6,
            footer: `${getEmoji('sparkles')} Mystical reading • ${fortune.category} focus • ${fortune.luck} luck • ${cosmicAlignment}% cosmic alignment`
        });

        return sendReply(card);
    },

    async handleShip(interaction, sendReply) {
        const user1 = interaction.options.getUser('user1');
        const user2 = interaction.options.getUser('user2');
        const compatibility = Math.floor(Math.random() * 101);

        const name1 = user1.displayName || user1.username;
        const name2 = user2.displayName || user2.username;
        const shipName = name1.slice(0, Math.ceil(name1.length / 2)) +
            name2.slice(Math.floor(name2.length / 2));

        const compatibilityColor = compatibility >= 80 ? 0xff69b4 : compatibility >= 60 ? 0xffa500 : compatibility >= 40 ? 0xffff00 : 0xff0000;
        const compatibilityBars = (getEmoji('heart')).repeat(Math.floor(compatibility / 10)) + (getEmoji('cross')).repeat(10 - Math.floor(compatibility / 10));
        const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
        const sign1 = zodiacSigns[Math.floor(Math.random() * zodiacSigns.length)];
        const sign2 = zodiacSigns[Math.floor(Math.random() * zodiacSigns.length)];

        const title = lang.fun.fun.shipTitle.replace('{emoji}', getEmoji('heart'));

        const verdict = compatibility >= 90 ? `${getEmoji('crown')} **Soulmates Detected!** The universe has crafted you for each other. Wedding bells are practically echoing through the cosmos!` :
            compatibility >= 70 ? `${getEmoji('heart')} **Perfect Match!** Your energies harmonize beautifully. This relationship has serious long-term potential!` :
                compatibility >= 50 ? `${getEmoji('heart')} **Great Chemistry!** With some effort and communication, this could blossom into something beautiful.` :
                    compatibility >= 30 ? `${getEmoji('warning')} **It's Complicated** Your differences could either clash or create fascinating dynamics. Proceed with curiosity!` :
                        `${getEmoji('cross')} **Better as Friends** Sometimes the best relationships are platonic. Your friendship could be legendary though!`;

        const shipSummary = lang.fun.fun.shipResult
            .replace('{user1}', name1)
            .replace('{user2}', name2)
            .replace('{percent}', compatibility)
            .replace('{verdict}', verdict);

        const sections = [
            `## ${getEmoji('heart')} **Comprehensive Relationship Report**\n\n**Couple:** ${name1} × ${name2}\n**Ship Name:**  ${shipName} \n**Analysis Date:** ${new Date().toLocaleDateString()}\n\n### ${getEmoji('analytics')} **Compatibility Metrics**\n\n**Overall Score:** ${compatibility}%\n**Visual Representation:** ${compatibilityBars}\n\n**Detailed Analysis:**\n• **Emotional Connection:** ${Math.floor(Math.random() * 20) + 70}%\n• **Intellectual Compatibility:** ${Math.floor(Math.random() * 25) + 65}%\n• **Physical Attraction:** ${Math.floor(Math.random() * 30) + 60}%\n• **Shared Interests:** ${Math.floor(Math.random() * 35) + 55}%\n• **Communication Style:** ${Math.floor(Math.random() * 25) + 70}%\n\n### ${getEmoji('sparkles')} **Astrological Influence**\n\n**${name1}:** ${sign1} energy\n**${name2}:** ${sign2} energy\n**Celestial Harmony:** ${sign1 === sign2 ? 'Perfect alignment!' : 'Complementary forces'}\n\n### ${getEmoji('star')} **Relationship Prediction**\n\n${verdict}\n\n**Love Forecast:** ${compatibility >= 80 ? 'Sunny with a chance of eternal happiness' : compatibility >= 60 ? 'Partly romantic with increasing passion' : compatibility >= 40 ? 'Variable conditions with potential for growth' : 'Friendship weather with occasional romantic showers'}`
        ];

        const card = buildCard({
            title,
            description: `> Analyzing electromagnetic love frequencies\n> Consulting the ancient algorithms of Cupid\n\n${shipSummary}`,
            sections,
            accentColor: compatibilityColor,
            footer: `${getEmoji('heart')} Love analytics • ${compatibility}% compatibility • Ship: ${shipName} • ${sign1} × ${sign2} cosmic energy`
        });

        return sendReply(card);
    },

    async handleIQ(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const iq = Math.floor(Math.random() * 180) + 70;
        const iqColor = iq >= 140 ? 0x00ff00 : iq >= 120 ? 0xffff00 : iq >= 100 ? 0xffa500 : 0xff0000;
        const iqCategory = iq >= 160 ? 'Genius' : iq >= 140 ? 'Gifted' : iq >= 120 ? 'Superior' : iq >= 110 ? 'High Average' : iq >= 90 ? 'Average' : 'Below Average';
        const percentile = iq >= 145 ? '99.9th' : iq >= 130 ? '98th' : iq >= 115 ? '84th' : iq >= 100 ? '50th' : iq >= 85 ? '16th' : '2nd';
        const brainPower = Math.floor((iq / 200) * 100);

        const title = lang.fun.fun.iqTitle.replace('{emoji}', getEmoji('basic'));
        const iqSummary = lang.fun.fun.iqResult
            .replace('{user}', user.displayName || user.username)
            .replace('{iq}', iq);

        const sections = [
            `## ${getEmoji('star')} **Comprehensive Intelligence Report**\n\n**Subject:** ${user.displayName || user.username}\n**Test Date:** ${new Date().toLocaleDateString()}\n**Analysis ID:** IQ-${Math.floor(Math.random() * 10000)}\n\n### ${getEmoji('analytics')} **Core Results**\n\n**IQ Score:** ${iq} points\n**Classification:** ${iqCategory}\n**Global Percentile:** ${percentile} percentile\n**Brain Power Utilization:** ${brainPower}%\n\n### ${getEmoji('basic')} **Cognitive Breakdown**\n\n• **Logical Reasoning:** ${Math.floor(Math.random() * 30) + (iq > 120 ? 85 : 70)}%\n• **Pattern Recognition:** ${Math.floor(Math.random() * 25) + (iq > 120 ? 80 : 75)}%\n• **Verbal Comprehension:** ${Math.floor(Math.random() * 20) + (iq > 120 ? 85 : 80)}%\n• **Mathematical Processing:** ${Math.floor(Math.random() * 35) + (iq > 120 ? 75 : 65)}%\n• **Spatial Intelligence:** ${Math.floor(Math.random() * 30) + (iq > 120 ? 80 : 70)}%\n• **Memory Capacity:** ${Math.floor(Math.random() * 25) + (iq > 120 ? 85 : 75)}%\n\n### ${getEmoji('sparkles')} **Intelligence Profile**\n\n${iq >= 160 ? `${getEmoji('basic')} **GENIUS LEVEL DETECTED!** Your cognitive abilities are extraordinary. You possess the intellectual capacity to solve complex problems and think in ways that few can match.` :
                iq >= 140 ? `${getEmoji('crown')} **GIFTED INTELLECT!** You have superior cognitive abilities and excel at complex reasoning. Your mind works at an advanced level.` :
                    iq >= 120 ? `${getEmoji('playlist')} **ABOVE AVERAGE INTELLIGENCE!** You have strong cognitive skills and can handle complex concepts with ease.` :
                        iq >= 100 ? `${getEmoji('help')} **SOLID COGNITIVE ABILITIES!** You have reliable thinking skills and can process information effectively.` :
                            `${getEmoji('commands')} **UNIQUE PERSPECTIVE!** Intelligence comes in many forms, and everyone has their own special way of understanding the world.`}\n\n**Recommended Activities:**\n${iq >= 140 ? '• Advanced mathematics and sciences\n• Complex strategic games\n• Research and development\n• Creative problem-solving challenges' :
                                iq >= 120 ? '• Analytical puzzles and brain games\n• Learning new languages\n• Strategy-based activities\n• Academic pursuits' :
                                    '• Reading and continuous learning\n• Creative hobbies and crafts\n• Social activities and teamwork\n• Exploring personal interests'}`
        ];

        const card = buildCard({
            title,
            description: `> Scanning neural pathways and synaptic connections\n> Quantum brain processing analysis complete\n\n${iqSummary}`,
            sections,
            thumbnailURL: user.displayAvatarURL(),
            accentColor: iqColor,
            footer: `${getEmoji('basic')} Cognitive assessment • ${iq} IQ points • ${iqCategory} level • ${percentile} percentile globally`
        });

        return sendReply(card);
    },

    async handleHowGay(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const gayLevel = Math.floor(Math.random() * 101);
        const rainbowBar = (getEmoji('world')).repeat(Math.floor(gayLevel / 20)) + '⬜'.repeat(5 - Math.floor(gayLevel / 20));

        const title = lang.fun.fun.howgayTitle.replace('{emoji}', getEmoji('sparkles'));
        const gaySummary = lang.fun.fun.howgayResult
            .replace('{user}', user.displayName || user.username)
            .replace('{percent}', gayLevel);

        const desc = [
            `**${gaySummary}**`,
            `**Rainbow Intensity:** ${rainbowBar}`,
            `**Analysis:** ${gayLevel >= 80 ? `Maximum rainbow energy detected! ${getEmoji('sparkles')}` : gayLevel >= 60 ? `Strong rainbow vibes! ${getEmoji('world')}` : gayLevel >= 40 ? `Moderate rainbow presence ${getEmoji('world')}` : gayLevel >= 20 ? `Subtle rainbow hints ${getEmoji('world')}` : `Minimal rainbow detected ${getEmoji('world')}`}`,
            `*Remember: Everyone is valid and loved exactly as they are! This is just for fun! ${getEmoji('heart')}*`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: 0xff69b4
        });

        return sendReply(card);
    },

    async handleSlots(interaction, sendReply) {
        const symbols = [getEmoji('heart'), getEmoji('star'), getEmoji('sparkles'), getEmoji('volume'), getEmoji('star'), getEmoji('owner'), getEmoji('games')];
        const results = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];

        const isJackpot = results[0] === results[1] && results[1] === results[2];
        const isWin = results[0] === results[1] || results[1] === results[2] || results[0] === results[2];
        const payout = isJackpot ? 1000 : isWin ? 100 : 0;

        const title = lang.fun.fun.slotsTitle.replace('{emoji}', getEmoji('games'));
        const verdictText = isJackpot ? `${getEmoji('crown')} INCREDIBLE! You hit the JACKPOT! ${getEmoji('crown')}` : isWin ? `${getEmoji('success')} Congratulations! You won!` : `${getEmoji('error')} Better luck next time!`;
        const slotsSummary = lang.fun.fun.slotsResult
            .replace('{slot1}', results[0])
            .replace('{slot2}', results[1])
            .replace('{slot3}', results[2])
            .replace('{verdict}', verdictText);

        const desc = [
            slotsSummary,
            `**Payout:** ${payout} coins`,
            `**Your Luck Today:** ${Math.floor(Math.random() * 100)}%`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: isJackpot ? 0xffd700 : isWin ? 0x00ff00 : 0xff0000
        });

        return sendReply(card);
    },

    async handleLottery(interaction, sendReply) {
        const userNumbers = Array.from({ length: 6 }, () => Math.floor(Math.random() * 49) + 1).sort((a, b) => a - b);
        const winningNumbers = Array.from({ length: 6 }, () => Math.floor(Math.random() * 49) + 1).sort((a, b) => a - b);
        const matches = userNumbers.filter(num => winningNumbers.includes(num)).length;
        const prize = matches >= 4 ? Math.pow(10, matches) : 0;

        const title = lang.fun.fun.lotteryTitle.replace('{emoji}', getEmoji('ticket'));
        const verdictText = matches === 6 ? `${getEmoji('crown')} JACKPOT WINNER! You're a millionaire!` : matches >= 4 ? `${getEmoji('success')} Big winner! Congratulations!` : matches >= 2 ? `${getEmoji('gift')} Small prize winner!` : `${getEmoji('error')} Better luck next week!`;
        const lotterySummary = lang.fun.fun.lotteryResult
            .replace('{numbers}', winningNumbers.join(' - '))
            .replace('{userNumbers}', userNumbers.join(' - '))
            .replace('{verdict}', verdictText);

        const desc = [
            lotterySummary,
            `**Matches:** ${matches}/6\n**Prize:** $${prize.toLocaleString()}`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: matches >= 4 ? 0xffd700 : 0x3498db
        });

        return sendReply(card);
    },

    async handleGender(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const genders = ['Male', 'Female', 'Non-binary', 'Fluid', 'Unknown Entity', 'Cosmic Being'];
        const guess = genders[Math.floor(Math.random() * genders.length)];
        const confidence = Math.floor(Math.random() * 30) + 20;

        const title = lang.fun.fun.genderTitle.replace('{emoji}', getEmoji('users'));
        const genderSummary = lang.fun.fun.genderResult
            .replace('{user}', user.displayName || user.username)
            .replace('{gender}', guess)
            .replace('{percent}', confidence);

        const desc = [
            genderSummary,
            `**Disclaimer:** This is completely random and for entertainment only! Gender identity is personal and only you can define yourself. Everyone is valid regardless of how they identify! ️‍️${getEmoji('heart')}`,
            `*Be yourself, love yourself, and respect others! ${getEmoji('world')}*`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: 0x9b59b6
        });

        return sendReply(card);
    },

    async handleAge(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const age = Math.floor(Math.random() * 50) + 13;
        const accuracy = Math.floor(Math.random() * 30) + 30;

        const title = lang.fun.fun.ageTitle.replace('{emoji}', getEmoji('user'));
        const ageSummary = lang.fun.fun.ageResult
            .replace('{user}', user.displayName || user.username)
            .replace('{age}', age);

        const desc = [
            ageSummary,
            `**Confidence:** ${accuracy}%`,
            `**Life Stage:** ${age < 18 ? `Young Explorer ${getEmoji('star')}` : age < 30 ? `Adventure Seeker ${getEmoji('rocket')}` : age < 50 ? `Wisdom Gatherer ${getEmoji('basic')}` : `Elder Sage ${getEmoji('crown')}`}`,
            `**Fun Fact:** Age is just a number! What matters is the energy and joy you bring to the world! ${getEmoji('sparkles')}`,
            `*Stay young at heart! ${getEmoji('heart')}*`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: 0xf39c12
        });

        return sendReply(card);
    },

    async handleKill(interaction, sendReply) {
        const user = interaction.options.getUser('user');
        const methods = [
            'death by dad jokes', 'tickled to death', 'defeated in rock-paper-scissors',
            'overwhelmed by compliments', 'died laughing', 'slain by kindness',
            'eliminated in a dance-off', 'defeated by superior memes', 'vanquished by pizza',
            'conquered by cute puppies'
        ];
        const method = methods[Math.floor(Math.random() * methods.length)];

        const title = lang.fun.fun.killTitle.replace('{emoji}', getEmoji('cross'));

        const desc = [
            `**Target:** ${user.displayName || user.username}`,
            `**Method:** ${method}`,
            `**Outcome:** Spectacularly silly demise! ${getEmoji('cross')}`,
            `**Memorial:** ${user.displayName || user.username} fought valiantly but was no match for ${method}. They will be remembered for their memes and good vibes. ${getEmoji('help')}`,
            `**Resurrection Timer:** 3... 2... 1... *POOF* ${getEmoji('cloud')}`,
            `**${user.displayName || user.username} has respawned!** ${getEmoji('games')}${getEmoji('sparkles')}`,
            `*No actual users were harmed in this simulation!*`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: 0x8b0000
        });

        return sendReply(card);
    },

    async handleSimp(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const simpLevel = Math.floor(Math.random() * 101);
        const simpBar = (getEmoji('heart')).repeat(Math.floor(simpLevel / 20)) + (getEmoji('cross')).repeat(5 - Math.floor(simpLevel / 20));

        const title = lang.fun.fun.simpTitle.replace('{emoji}', getEmoji('heart'));
        const simpSummary = lang.fun.fun.simpResult
            .replace('{user}', user.displayName || user.username)
            .replace('{percent}', simpLevel);

        const desc = [
            simpSummary,
            `**Devotion Meter:** ${simpBar}`,
            `**Analysis:** ${simpLevel >= 90 ? `ULTIMATE SIMP! Maximum devotion detected! ${getEmoji('heart')}` : simpLevel >= 70 ? `Major simp energy! Very devoted! ${getEmoji('heart')}` : simpLevel >= 50 ? `Moderate simp tendencies! ${getEmoji('heart')}` : simpLevel >= 30 ? `Mild simp vibes! ${getEmoji('heart')}` : 'Minimal simp energy!'}`,
            `**Simp Activities:** ${simpLevel >= 70 ? 'Writes poetry, buys flowers daily' : simpLevel >= 50 ? 'Always responds instantly to texts' : simpLevel >= 30 ? 'Gives genuine compliments' : 'Plays it cool'}`,
            `*Being caring and devoted is actually wonderful! ${getEmoji('heart')}*`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: 0xff1493
        });

        return sendReply(card);
    },

    async handlePP(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const size = Math.floor(Math.random() * 25) + 1;
        const measurement = '8' + '='.repeat(size) + 'D';

        const title = lang.fun.fun.ppTitle.replace('{emoji}', getEmoji('games'));
        const ppSummary = lang.fun.fun.ppResult
            .replace('{user}', user.displayName || user.username)
            .replace('{size}', '='.repeat(size));

        const desc = [
            ppSummary,
            `**Size:** ${size} inches`,
            `**Visual:** ${measurement}`,
            `**Classification:** ${size >= 20 ? ' Legendary!' : size >= 15 ? ' Impressive!' : size >= 10 ? ' Above Average!' : size >= 7 ? ' Average!' : ' Compact!'}`,
            `**Fun Fact:** Size doesn't matter - it's all about personality, humor, and kindness! The real big energy comes from having a good heart! ${getEmoji('heart')}`,
            `*This is completely random and just for laughs! ${getEmoji('smile')}*`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: 0xff6b6b
        });

        return sendReply(card);
    },

    async handleStupid(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const stupidLevel = Math.floor(Math.random() * 101);
        const smartLevel = 100 - stupidLevel;

        const title = lang.fun.fun.stupidTitle.replace('{emoji}', getEmoji('error'));
        const stupidSummary = lang.fun.fun.stupidResult
            .replace('{user}', user.displayName || user.username)
            .replace('{percent}', stupidLevel);

        const desc = [
            stupidSummary,
            `**Hidden Genius Level:** ${smartLevel}%`,
            `**Analysis:** ${stupidLevel >= 80 ? `Master of creative thinking! Your unique perspective is refreshing! ${getEmoji('sparkles')}` : stupidLevel >= 60 ? `Wonderfully innocent and pure! ${getEmoji('smile')}` : stupidLevel >= 40 ? 'Charmingly quirky!' : stupidLevel >= 20 ? 'Perfectly balanced!' : `Secret genius detected! ${getEmoji('basic')}`}`,
            `**Special Talent:** ${stupidLevel >= 70 ? 'Asking the questions others are afraid to ask!' : stupidLevel >= 50 ? 'Making everyone laugh!' : stupidLevel >= 30 ? 'Finding joy in simple things!' : 'Being effortlessly wise!'}`,
            `*Remember: Different minds work in beautiful ways! ${getEmoji('world')}*`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: 0xff6b6b
        });

        return sendReply(card);
    },

    async handleSmart(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const smartLevel = Math.floor(Math.random() * 101);
        const wisdomType = ['Street Smart', 'Book Smart', 'Emotionally Smart', 'Creatively Smart', 'Socially Smart'][Math.floor(Math.random() * 5)];

        const title = lang.fun.fun.smartTitle.replace('{emoji}', getEmoji('basic'));
        const smartSummary = lang.fun.fun.smartResult
            .replace('{user}', user.displayName || user.username)
            .replace('{percent}', smartLevel);

        const desc = [
            smartSummary,
            `**Intelligence Type:** ${wisdomType}`,
            `**Analysis:** ${smartLevel >= 90 ? `${getEmoji('basic')} MEGA GENIUS! Your intellect is off the charts!` : smartLevel >= 70 ? `${getEmoji('crown')} Highly intelligent! You see patterns others miss!` : smartLevel >= 50 ? `${getEmoji('playlist')} Smart cookie! You have great insights!` : smartLevel >= 30 ? `${getEmoji('sparkles')} Clever mind! You think outside the box!` : `${getEmoji('star')} Wisdom beyond measure!`}`,
            `**Special Abilities:**\n${smartLevel >= 80 ? '• Solves complex problems effortlessly\n• Sees connections others miss\n• Natural leader and innovator' : smartLevel >= 60 ? '• Quick learner and adapter\n• Great at giving advice\n• Excellent problem solver' : '• Unique perspective on life\n• Natural wisdom and intuition\n• Great emotional intelligence'}`,
            `*Intelligence comes in many forms - you're smart in your own special way! ${getEmoji('star')}*`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: 0x3498db
        });

        return sendReply(card);
    },

    async handleSus(interaction, sendReply) {
        const user = interaction.options.getUser('user') || interaction.user;
        const susLevel = Math.floor(Math.random() * 101);
        const impostor = susLevel >= 80;

        const title = lang.fun.fun.susTitle.replace('{emoji}', getEmoji('warning'));
        const susSummary = lang.fun.fun.susResult
            .replace('{user}', user.displayName || user.username)
            .replace('{percent}', susLevel);

        const desc = [
            susSummary,
            `**Status:** ${impostor ? `${getEmoji('cross')} HIGHLY SUSPICIOUS` : susLevel >= 60 ? `${getEmoji('warning')} SOMEWHAT SUS` : `${getEmoji('tick')} PROBABLY SAFE`}`,
            `**Evidence:**\n${susLevel >= 80 ? '• Seen venting in electrical\n• Was following others suspiciously\n• Acting way too helpful' : susLevel >= 60 ? '• Took a long time in medbay\n• Keeps asking about tasks\n• Slightly suspicious behavior' : susLevel >= 40 ? '• Completed all tasks normally\n• Good alibi for most incidents\n• Seems trustworthy' : '• Perfect crewmate behavior\n• Always helps others\n• Definitely not the impostor'}`,
            `**Emergency Meeting Called!** ${getEmoji('warning')}`,
            `**Verdict:** ${impostor ? `EJECT IMMEDIATELY! ${getEmoji('rocket')}` : susLevel >= 50 ? 'Keep watching them...' : `Innocent crewmate! ${getEmoji('tick')}`}`,
            `*${user.displayName || user.username} ${impostor ? 'was An Impostor' : 'was not An Impostor'}.*`
        ].join('\n\n');

        const card = buildCard({
            title,
            description: desc,
            accentColor: impostor ? 0xff0000 : 0x00ff00
        });

        return sendReply(card);
    },

    async handleError(interaction, sendReply, errorMessage) {
        const title = lang.fun.fun.errorTitle.replace('{emoji}', getEmoji('error'));
        const card = cards.error(title, errorMessage || lang.fun.common.genericError);
        return sendReply(card);
    }
};