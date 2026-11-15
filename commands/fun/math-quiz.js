
const {
    SlashCommandBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const {
    buildCard,
    btn,
    replyUnauthorized,
    replyEphemeral,
    closeAndAutoDelete,
    deferUpdate,
    ACCENT,
} = require('../../UI');
const {
    buildMathQuizModalId,
    parseMathQuizCustomId,
    claimQuizQuestionAnswer,
    releaseQuizQuestionAnswer,
    parseMathQuizAnswer
} = require('../../utils/mathQuizSession');


const _sessions = new Map();

const _activeChannels = new Set();
const _scheduledTimers = new Set();

function scheduleQuizTimer(callback, delayMs) {
    let timer;
    timer = setTimeout(() => {
        _scheduledTimers.delete(timer);
        Promise.resolve().then(callback).catch(error => console.error('[MathQuiz] Scheduled task failed:', error));
    }, delayMs);
    timer.unref?.();
    _scheduledTimers.add(timer);
    return timer;
}

function clearQuizTimer(timer) {
    if (!timer) return;
    clearTimeout(timer);
    _scheduledTimers.delete(timer);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('math-quiz')
        .setDescription('Ultimate mathematics quiz system with 10 difficulty levels')
        .addSubcommand(subcommand =>
            subcommand.setName('basic')
                .setDescription('Basic math quiz (Addition, Subtraction)')
                .addIntegerOption(option =>
                    option.setName('questions')
                        .setDescription('Number of questions (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand.setName('intermediate')
                .setDescription('Intermediate math quiz (Multiplication, Division)')
                .addIntegerOption(option =>
                    option.setName('questions')
                        .setDescription('Number of questions (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand.setName('advanced')
                .setDescription('Advanced math quiz (Powers, Roots, Algebra)')
                .addIntegerOption(option =>
                    option.setName('questions')
                        .setDescription('Number of questions (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand.setName('prime')
                .setDescription('Prime Numbers & Number Theory')
                .addIntegerOption(option =>
                    option.setName('questions')
                        .setDescription('Number of questions (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand.setName('ultimate')
                .setDescription('Ultimate Algebra & Complex Numbers')
                .addIntegerOption(option =>
                    option.setName('questions')
                        .setDescription('Number of questions (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand.setName('trigonometry')
                .setDescription('Trigonometry & Identities')
                .addIntegerOption(option =>
                    option.setName('questions')
                        .setDescription('Number of questions (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand.setName('calculus')
                .setDescription('∫ Calculus & Differential Equations')
                .addIntegerOption(option =>
                    option.setName('questions')
                        .setDescription('Number of questions (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand.setName('statistics')
                .setDescription('Statistics & Probability')
                .addIntegerOption(option =>
                    option.setName('questions')
                        .setDescription('Number of questions (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand.setName('mixed')
                .setDescription('Mixed difficulty quiz (All operations)')
                .addIntegerOption(option =>
                    option.setName('questions')
                        .setDescription('Number of questions (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand.setName('speed')
                .setDescription('Speed quiz (Quick fire questions)')
                .addIntegerOption(option =>
                    option.setName('time')
                        .setDescription('Time limit per question (5-30 seconds)')
                        .setRequired(false)
                        .setMinValue(5)
                        .setMaxValue(30)))
        .addSubcommand(subcommand =>
            subcommand.setName('stop')
                .setDescription('Stop the active quiz'))
        .addSubcommand(subcommand =>
            subcommand.setName('leaderboard')
                .setDescription('View quiz leaderboard')),

    async execute(interaction) {
        if (!interaction.isChatInputCommand?.()) {
            return await this.sendSlashOnlyMessage(interaction);
        }

        await interaction.deferReply();

        const sendReply = async (card) => {
            return await interaction.editReply({
                components: [card],
                flags: MessageFlags.IsComponentsV2
            });
        };

        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'basic':
                case 'intermediate':
                case 'advanced':
                case 'prime':
                case 'ultimate':
                case 'trigonometry':
                case 'calculus':
                case 'statistics':
                case 'mixed':
                case 'speed':
                    return await this.startQuiz(interaction, sendReply, subcommand);
                case 'stop':
                    return await this.stopQuiz(interaction, sendReply);
                case 'leaderboard':
                    return await this.showLeaderboard(interaction, sendReply);
                default:
                    return await this.handleError(interaction, sendReply, 'Unknown subcommand');
            }

        } catch (error) {
            console.error('Error executing math quiz:', error);
            return await this.handleError(interaction, sendReply, error.message);
        }
    },

    async sendSlashOnlyMessage(interaction) {
        return replyEphemeral(interaction, 'This feature must be started with the /math-quiz command.');
    },

    async handleError(_interaction, sendReply) {
        const card = buildCard(
            `${getEmoji('cross')} Quiz Error`,
            ['The quiz could not continue. Please start a new quiz and try again.'],
            [],
            null,
            0xFF4757
        );
        return sendReply(card);
    },

    getDefaultTimeLimit(difficulty) {
        return ({
            basic: 20,
            intermediate: 25,
            advanced: 30,
            prime: 20,
            ultimate: 30,
            trigonometry: 30,
            calculus: 35,
            statistics: 25,
            mixed: 25,
            speed: 15
        })[difficulty] || 20;
    },

    getDifficultyIcon(difficulty) {
        return ({
            basic: getEmoji('tick'),
            intermediate: getEmoji('warning'),
            advanced: getEmoji('cross'),
            prime: getEmoji('list'),
            ultimate: getEmoji('sparkles'),
            trigonometry: getEmoji('settings'),
            calculus: '∫',
            statistics: getEmoji('analytics'),
            mixed: getEmoji('world'),
            speed: getEmoji('time')
        })[difficulty] || getEmoji('sparkles');
    },

    getDifficultyTitle(difficulty) {
        return ({
            basic: 'Basic Mathematics',
            intermediate: 'Intermediate Mathematics',
            advanced: 'Advanced Mathematics',
            prime: 'Prime Numbers',
            ultimate: 'Ultimate Algebra',
            trigonometry: 'Trigonometry',
            calculus: 'Calculus',
            statistics: 'Statistics',
            mixed: 'Mixed Mathematics',
            speed: 'Speed Mathematics'
        })[difficulty] || 'Mathematics';
    },

    getDifficultyDescription(difficulty) {
        return ({
            basic: 'Practice addition and subtraction.',
            intermediate: 'Solve multiplication and division problems.',
            advanced: 'Work through exponents, roots, and algebra.',
            prime: 'Explore prime numbers and factorization.',
            ultimate: 'Challenge yourself with algebra and complex numbers.',
            trigonometry: 'Solve angle and trigonometric identity questions.',
            calculus: 'Apply calculus and differential-equation concepts.',
            statistics: 'Use probability and statistical reasoning.',
            mixed: 'Questions are drawn from several difficulty levels.',
            speed: 'Answer quick-fire arithmetic and power questions.'
        })[difficulty] || 'Solve the questions before the timer runs out.';
    },

    getOperationsText(difficulty) {
        return ({
            basic: 'Addition, subtraction',
            intermediate: 'Multiplication, division',
            advanced: 'Exponents, square roots, linear algebra',
            prime: 'Primality, prime sequences, factorization',
            ultimate: 'Algebraic expansion, discriminants, complex numbers',
            trigonometry: 'Sine, cosine, tangent, identities',
            calculus: 'Derivatives, limits, integrals',
            statistics: 'Probability, averages, distributions',
            mixed: 'A mix of arithmetic, algebra, and number theory',
            speed: 'Quick addition, multiplication, and powers'
        })[difficulty] || 'Mathematics';
    },

    getBasePoints(difficulty) {
        return ({
            basic: 100,
            intermediate: 120,
            advanced: 150,
            prime: 150,
            ultimate: 180,
            trigonometry: 180,
            calculus: 220,
            statistics: 160,
            mixed: 150,
            speed: 130
        })[difficulty] || 100;
    },

    getDifficultyMultiplier(difficulty) {
        return ({
            basic: 1,
            intermediate: 1.2,
            advanced: 1.5,
            prime: 1.5,
            ultimate: 1.8,
            trigonometry: 1.8,
            calculus: 2.2,
            statistics: 1.6,
            mixed: 1.5,
            speed: 1.3
        })[difficulty] || 1;
    },

    getDifficultyColor(difficulty) {
        return ({
            basic: 0x22C55E,
            intermediate: 0x3B82F6,
            advanced: 0xEF4444,
            prime: 0x8B5CF6,
            ultimate: 0xF59E0B,
            trigonometry: 0x06B6D4,
            calculus: 0x6366F1,
            statistics: 0x14B8A6,
            mixed: 0xA855F7,
            speed: 0xF97316
        })[difficulty] || 0x8B5CF6;
    },

    calculateGrade(accuracy) {
        const value = Number(accuracy) || 0;
        if (value >= 97) return { letter: 'A+', title: 'Outstanding' };
        if (value >= 90) return { letter: 'A', title: 'Excellent' };
        if (value >= 80) return { letter: 'B', title: 'Very Good' };
        if (value >= 70) return { letter: 'C', title: 'Good' };
        if (value >= 60) return { letter: 'D', title: 'Keep Practicing' };
        return { letter: 'F', title: 'More Practice Needed' };
    },

    getComplexityLevel(difficulty) {
        return ({
            basic: 'Foundational',
            intermediate: 'Intermediate',
            advanced: 'Advanced',
            prime: 'Advanced Number Theory',
            ultimate: 'University Algebra',
            trigonometry: 'Precalculus',
            calculus: 'University Calculus',
            statistics: 'Applied Statistics',
            mixed: 'Comprehensive',
            speed: 'Rapid Recall'
        })[difficulty] || 'Foundational';
    },

    async startQuiz(interaction, sendReply, difficulty) {
        const channelId = interaction.channel.id;
        const userId = interaction.user.id;
        const questionCount = interaction.options.getInteger('questions') || 10;
        const timeLimit = interaction.options.getInteger('time') || this.getDefaultTimeLimit(difficulty);

        
        let isChannelActive = false;
        for (const session of _sessions.values()) {
            if (session.channelId === channelId) {
                isChannelActive = true;
                break;
            }
        }
        if (isChannelActive || _activeChannels.has(channelId)) {
            const errorContainer = buildCard(
                `${getEmoji('cross')} Quiz Already Active`,
                [
                    `There's already an active math quiz running in this channel.`,
                    `Use \`/math-quiz stop\` to terminate the current quiz before starting a new one.`
                ],
                [],
                null,
                0xFF4757
            );
            return sendReply(errorContainer);
        }

        const quizData = {
            difficulty,
            questionCount,
            timeLimit,
            currentQuestion: 0,
            correctAnswers: 0,
            totalScore: 0,
            streak: 0,
            maxStreak: 0,
            startTime: Date.now(),
            questions: this.generateQuestions(difficulty, questionCount),
            userId,
            channelId,
            message: null,
            timer: null,
            questionStartTime: null,
            answeredQuestionIndex: null
        };

        _activeChannels.add(channelId);

        const startContainer = buildCard(
            `${getEmoji('sparkles')} Math Quiz Started!`,
            [
                `### ${this.getDifficultyIcon(difficulty)} **Difficulty: ${this.getDifficultyTitle(difficulty)}**\n> ${this.getDifficultyDescription(difficulty)}`,
                `### **Quiz Specifications**\n• **Questions:** ${questionCount}\n• **Time limit:** ${timeLimit} seconds per question\n• **Operations:** ${this.getOperationsText(difficulty)}`,
                `### **Scoring Mechanics**\n• **Base Points:** ${this.getBasePoints(difficulty)} pts per correct answer\n• **Speed Bonus:** Up to 50% extra points for lightning-fast solves\n• **Multiplier:** x${this.getDifficultyMultiplier(difficulty)} difficulty scaling\n• **Streak Multiplier:** +10% bonus per consecutive solve\n• **Perfect Quiz:** ${this.getBasePoints(difficulty) * 5} pts completion bonus!`,
                `*The quiz is initializing... Get ready to solve!*`
            ],
            [],
            null,
            this.getDifficultyColor(difficulty)
        );

        let msg;
        try {
            msg = await interaction.editReply({
                components: [startContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            _activeChannels.delete(channelId);
            throw error;
        }

        quizData.message = msg;
        _sessions.set(msg.id, quizData);

        scheduleQuizTimer(() => this.askQuestion(interaction, msg.id), 3000);
    },

    async askQuestion(interaction, messageId) {
        const quizData = _sessions.get(messageId);
        if (!quizData) return;

        if (quizData.currentQuestion >= quizData.questions.length) {
            return await this.endQuiz(interaction, messageId);
        }

        const question = quizData.questions[quizData.currentQuestion];
        const questionNumber = quizData.currentQuestion + 1;
        const progress = Math.round((questionNumber / quizData.questions.length) * 100);

        const title = `${this.getDifficultyIcon(quizData.difficulty)} Question ${questionNumber}/${quizData.questions.length}`;
        const sections = [
            `### **Problem**\n# **${question.display}**\n\n• **Question Type:** ${question.type}\n• **Difficulty:** ${this.getDifficultyTitle(quizData.difficulty)}\n• **Time Limit:** ${quizData.timeLimit} seconds`,
            `### **Performance Summary**\n• **Current Score:** ${quizData.totalScore} pts\n• **Accuracy:** ${quizData.currentQuestion > 0 ? Math.round((quizData.correctAnswers / quizData.currentQuestion) * 100) : 0}%\n• **Current Streak:** ${quizData.streak} correct ${getEmoji('fire')}`
        ];

        const row = new ActionRowBuilder().addComponents(
            btn(lang.fun.mathQuiz.nav.solve, `math-quiz_solve_${messageId}`, 'sparkles', ButtonStyle.Primary),
            btn(lang.fun.mathQuiz.nav.stop, `math-quiz_stop_${messageId}`, 'stop', ButtonStyle.Danger)
        );

        const card = buildCard(
            title,
            sections,
            [row],
            'https://cdn-icons-png.flaticon.com/512/3094/3094837.png',
            this.getDifficultyColor(quizData.difficulty)
        );

        await quizData.message.edit({
            components: [card],
            files: [],
            flags: MessageFlags.IsComponentsV2
        }).catch(() => { });

        quizData.questionStartTime = Date.now();

        clearQuizTimer(quizData.timer);
        quizData.timer = scheduleQuizTimer(() => {
            this.handleTimeout(interaction, messageId);
        }, quizData.timeLimit * 1000);
    },

    async handleTimeout(interaction, messageId) {
        const quizData = _sessions.get(messageId);
        if (!quizData) return;
        if (quizData.answeredQuestionIndex === quizData.currentQuestion) return;
        quizData.answeredQuestionIndex = quizData.currentQuestion;

        clearQuizTimer(quizData.timer);
        quizData.timer = null;
        quizData.streak = 0;

        const question = quizData.questions[quizData.currentQuestion];
        await this.showResult(interaction, messageId, false, question.answer, 0, quizData.timeLimit * 1000, 0);

        quizData.currentQuestion++;
        scheduleQuizTimer(() => this.askQuestion(interaction, messageId), 2500);
    },

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('math-quiz_')) return false;

        const parsed = parseMathQuizCustomId(interaction.customId);
        if (!parsed) {
            await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.fun.mathQuiz.result.sessionExpired}`);
            return true;
        }
        const { action, messageId, questionIndex } = parsed;

        
        const quizData = _sessions.get(messageId);
        if (!quizData) {
            await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.fun.mathQuiz.result.sessionExpired}`);
            return true;
        }

        
        if (interaction.user.id !== quizData.userId) {
            await replyUnauthorized(interaction, quizData.userId, 'math-quiz');
            return true;
        }

        if (action === 'stop') {
            clearQuizTimer(quizData.timer);
            quizData.timer = null;
            _sessions.delete(messageId);
            _activeChannels.delete(quizData.channelId);

            const stopContainer = buildCard(
                `${getEmoji('warning')} ${lang.fun.mathQuiz.panel.terminatedTitle}`,
                [
                    lang.fun.mathQuiz.content.terminatedDesc,
                    `### **${lang.fun.mathQuiz.content.performanceSummary}**\n• **Questions Completed:** ${quizData.currentQuestion}/${quizData.questions.length}\n• **Correct Solves:** ${quizData.correctAnswers}\n• **Final Score:** ${quizData.totalScore} pts\n• **Best Streak:** ${quizData.maxStreak} solves ${getEmoji('fire')}`
                ],
                [],
                null,
                0xFF4757
            );

            await closeAndAutoDelete(interaction, stopContainer);
            return true;
        }

        if (action === 'solve') {
            if (quizData.answeredQuestionIndex === quizData.currentQuestion) {
                await replyEphemeral(interaction, `${getEmoji('warning')} This question has already been answered.`);
                return true;
            }
            
            const question = quizData.questions[quizData.currentQuestion];
            const modalTitle = lang.fun.mathQuiz.modal.questionTitle
                .replace('{current}', String(quizData.currentQuestion + 1))
                .replace('{total}', String(quizData.questions.length));

            const modal = new ModalBuilder()
                .setCustomId(buildMathQuizModalId(messageId, quizData.currentQuestion))
                .setTitle(modalTitle);

            const ansInput = new TextInputBuilder()
                .setCustomId('answer')
                .setLabel(lang.fun.mathQuiz.modal.solveLabel.replace('{equation}', question.display))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(quizData.difficulty === 'prime' ? lang.fun.mathQuiz.modal.primePlaceholder : lang.fun.mathQuiz.modal.numericPlaceholder)
                .setMaxLength(32)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(ansInput));
            await interaction.showModal(modal).catch(() => { });
            return true;
        }

        if (interaction.isModalSubmit() && action === 'modal') {
            if (!claimQuizQuestionAnswer(quizData, questionIndex)) {
                await replyEphemeral(interaction, `${getEmoji('warning')} This answer form has expired or was already used.`);
                return true;
            }
            try {
                await interaction.deferUpdate();
            } catch {
                releaseQuizQuestionAnswer(quizData, questionIndex);
                clearQuizTimer(quizData.timer);
                const elapsedMs = Date.now() - (quizData.questionStartTime || Date.now());
                const remainingMs = Math.max(0, quizData.timeLimit * 1000 - elapsedMs);
                quizData.timer = scheduleQuizTimer(() => this.handleTimeout(interaction, messageId), remainingMs);
                return true;
            }

            clearQuizTimer(quizData.timer);
            quizData.timer = null;

            const responseTime = Date.now() - quizData.questionStartTime;
            const answerText = interaction.fields.getTextInputValue('answer').trim();
            const question = quizData.questions[quizData.currentQuestion];

            const userAnswer = parseMathQuizAnswer(answerText, question.answer);

            const isCorrect = this.checkAnswer(userAnswer, question.answer, quizData.difficulty);

            if (isCorrect) {
                quizData.correctAnswers++;
                quizData.streak++;
                quizData.maxStreak = Math.max(quizData.maxStreak, quizData.streak);

                let points = this.getBasePoints(quizData.difficulty);
                const speedBonus = Math.max(0, Math.floor(points * 0.5) - Math.floor(responseTime / 1000) * 5);
                const difficultyMultiplier = this.getDifficultyMultiplier(quizData.difficulty);
                const streakMultiplier = 1 + (quizData.streak - 1) * 0.1;
                points = Math.round((points + speedBonus) * difficultyMultiplier * streakMultiplier);
                quizData.totalScore += points;

                await this.showResult(interaction, messageId, true, question.answer, points, responseTime, quizData.streak);
            } else {
                quizData.streak = 0;
                await this.showResult(interaction, messageId, false, question.answer, 0, responseTime, 0);
            }

            quizData.currentQuestion++;
            scheduleQuizTimer(() => this.askQuestion(interaction, messageId), 2500);
            return true;
        }

        return true;
    },

    async showResult(interaction, messageId, isCorrect, correctAnswer, pointsEarned, responseTime, streak) {
        const quizData = _sessions.get(messageId);
        if (!quizData) return;

        const title = `${isCorrect ? getEmoji('tick') : getEmoji('cross')} ${isCorrect ? lang.fun.mathQuiz.content.brilliantSolution : lang.fun.mathQuiz.content.incorrectAnswer}`;
        const sections = [
            `### **${lang.fun.mathQuiz.content.detailedAnalysis}**\n• **${lang.fun.mathQuiz.content.correctAnswer}** \`${correctAnswer}\`\n• **${lang.fun.mathQuiz.content.pointsAwarded}** ${pointsEarned} pts\n• **${lang.fun.mathQuiz.content.timeTaken}** ${(responseTime / 1000).toFixed(1)} seconds\n• **${lang.fun.mathQuiz.content.activeStreak}** ${streak} correct ${getEmoji('fire')}`,
            isCorrect ?
                (streak > 1 ? `${getEmoji('fire')} **${lang.fun.mathQuiz.content.streakNotice.replace('{streak}', String(streak))}**` : `${getEmoji('sparkles')} ${lang.fun.mathQuiz.content.perfectStreakNotice}`) :
                `${getEmoji('sparkles')} ${lang.fun.mathQuiz.content.encourageNotice}`
        ];

        const card = buildCard(
            title,
            sections,
            [],
            null,
            isCorrect ? 0x22C55E : 0xFF4757
        );

        await quizData.message.edit({
            components: [card],
            files: [],
            flags: MessageFlags.IsComponentsV2
        }).catch(() => { });
    },

    async endQuiz(interaction, messageId) {
        const quizData = _sessions.get(messageId);
        if (!quizData) return;

        clearQuizTimer(quizData.timer);
        quizData.timer = null;
        _sessions.delete(messageId);
        _activeChannels.delete(quizData.channelId);

        const totalTime = Date.now() - quizData.startTime;
        const accuracy = (quizData.correctAnswers / quizData.questions.length * 100).toFixed(1);
        const avgTimePerQuestion = (totalTime / quizData.questions.length / 1000).toFixed(1);
        const isPerfect = quizData.correctAnswers === quizData.questions.length;

        if (isPerfect) quizData.totalScore += this.getBasePoints(quizData.difficulty) * 5;

        const grade = this.calculateGrade(accuracy, quizData.totalScore, quizData.difficulty);

        const title = `${getEmoji('crown')} ${this.getDifficultyTitle(quizData.difficulty)} Quiz Complete!`;
        const sections = [
            `### **${lang.fun.mathQuiz.content.performanceSummary}**\n• **Final Score:** ${quizData.totalScore} points\n• **Accuracy:** ${quizData.correctAnswers}/${quizData.questions.length} (${accuracy}%)\n• **Best Streak:** ${quizData.maxStreak} correct solves ${getEmoji('fire')}\n• **Duration:** ${(totalTime / 1000).toFixed(1)}s (avg ${avgTimePerQuestion}s/question)`,
            `### **${lang.fun.mathQuiz.content.academicEvaluation}**\n• **${lang.fun.mathQuiz.content.letterGrade}** **${grade.letter}** (${grade.title})\n• **${lang.fun.mathQuiz.content.performanceIndex}** ${this.getComplexityLevel(quizData.difficulty)}`,
            `### **${lang.fun.mathQuiz.content.unlockedAccomplishments}**\n` +
            `${isPerfect ? `${getEmoji('crown')} **PERFECT MASTERY:** +${this.getBasePoints(quizData.difficulty) * 5} bonus points!\n` : ''}` +
            `${quizData.maxStreak >= 7 ? `${getEmoji('fire')} **STREAK LEGEND:** Achieved 7+ consecutive solves!\n` : quizData.maxStreak >= 5 ? `${getEmoji('fire')} **STREAK MASTER:** Achieved 5+ consecutive solves!\n` : ''}` +
            `${quizData.totalScore >= 2000 ? `${getEmoji('star')} **MATHEMATICAL GENIUS:** Scored 2000+ points!\n` : quizData.totalScore >= 1000 ? `${getEmoji('star')} **HIGH ACHIEVER:** Scored 1000+ points!\n` : ''}` +
            `${accuracy == 100 ? `${getEmoji('tick')} **PERFECTIONIST:** 100% accuracy attained!\n` : accuracy >= 90 ? `${getEmoji('sparkles')} **EXPERT ANALYST:** 90%+ accuracy!\n` : ''}` +
            `${quizData.difficulty === 'calculus' && accuracy >= 70 ? `∫ **CALCULUS COMMANDER:** Conquered university calculus!\n` : ''}` +
            `${quizData.difficulty === 'statistics' && accuracy >= 70 ? `${getEmoji('analytics')} **DATA SCIENTIST:** Proved statistical proficiency!\n` : ''}`
        ];

        const card = buildCard(
            title,
            sections,
            [],
            interaction.user.displayAvatarURL({ dynamic: true, size: 128 }),
            isPerfect ? 0xFFD700 : accuracy >= 80 ? 0x22C55E : accuracy >= 60 ? 0xF59E0B : 0xFF4757
        );

        await quizData.message.edit({
            components: [card],
            files: [],
            flags: MessageFlags.IsComponentsV2
        }).catch(() => { });
    },

    async stopQuiz(interaction, sendReply) {
        const channelId = interaction.channel.id;

        let activeMsgId = null;
        let activeQuiz = null;
        for (const [msgId, session] of _sessions.entries()) {
            if (session.channelId === channelId) {
                activeMsgId = msgId;
                activeQuiz = session;
                break;
            }
        }

        if (!activeQuiz) {
            const noQuizContainer = buildCard(
                `${getEmoji('info')} ${lang.fun.mathQuiz.panel.noQuizTitle}`,
                [lang.fun.mathQuiz.content.noQuizDesc],
                [],
                null,
                0xF59E0B
            );
            return sendReply(noQuizContainer);
        }

        if (activeQuiz.userId !== interaction.user.id) {
            const permissionContainer = buildCard(
                `${getEmoji('cross')} ${lang.fun.mathQuiz.panel.accessDeniedTitle}`,
                [lang.fun.mathQuiz.content.accessDeniedDesc],
                [],
                null,
                0xFF4757
            );
            return sendReply(permissionContainer);
        }

        clearQuizTimer(activeQuiz.timer);
        activeQuiz.timer = null;
        _sessions.delete(activeMsgId);
        _activeChannels.delete(channelId);

        const stopContainer = buildCard(
            `${getEmoji('warning')} ${lang.fun.mathQuiz.panel.terminatedTitle}`,
            [
                lang.fun.mathQuiz.content.terminatedDesc,
                `### **${lang.fun.mathQuiz.content.performanceSummary}**\n• **Questions Completed:** ${activeQuiz.currentQuestion}/${activeQuiz.questions.length}\n• **Correct Answers:** ${activeQuiz.correctAnswers}\n• **Final Score:** ${activeQuiz.totalScore} pts\n• **Best Streak:** ${activeQuiz.maxStreak} solves ${getEmoji('fire')}`
            ],
            [],
            null,
            0xFF4757
        );

        await activeQuiz.message.edit({
            components: [stopContainer],
            files: [],
            flags: MessageFlags.IsComponentsV2
        }).catch(() => { });

        scheduleQuizTimer(() => {
            activeQuiz.message.delete().catch(() => { });
        }, 2000);

        const confirmContainer = buildCard(
            `${getEmoji('tick')} ${lang.fun.mathQuiz.panel.stoppedTitle}`,
            [lang.fun.mathQuiz.content.stoppedDesc],
            [],
            null,
            0x22C55E
        );
        return sendReply(confirmContainer);
    },

    async showLeaderboard(interaction, sendReply) {
        const title = `${getEmoji('medal')} ${lang.fun.mathQuiz.panel.hallOfFameTitle}`;
        const sections = [
            `### **${lang.fun.mathQuiz.content.upcomingFeatures}**\n• **Persistent Score Database:** MongoDB integration\n• **Global Rankings:** Server-wide leaderboards\n• **Seasonal Competitions:** Weekly/Monthly champions`,
            `### **${lang.fun.mathQuiz.content.completeSpectrum}**\n` +
            `• ${getEmoji('tick')} **Basic:** Elementary arithmetic\n` +
            `• ${getEmoji('warning')} **Intermediate:** Pre-algebra\n` +
            `• ${getEmoji('cross')} **Advanced:** High school mathematics\n` +
            `• ${getEmoji('list')} **Prime:** Number theory\n` +
            `• ${getEmoji('sparkles')} **Ultimate:** College algebra\n` +
            `• ${getEmoji('settings')} **Trigonometry:** Pre-calculus\n` +
            `• ${getEmoji('document')} **Calculus:** University level\n` +
            `• ${getEmoji('analytics')} **Statistics:** Probability\n` +
            `• ${getEmoji('world')} **Mixed:** All combined\n` +
            `• ${getEmoji('time')} **Speed:** Quick fire`
        ];

        const card = buildCard(title, sections, [], null, 0xFFD700);
        return sendReply(card);
    },

    stop() {
        for (const timer of _scheduledTimers) clearTimeout(timer);
        _scheduledTimers.clear();
        for (const session of _sessions.values()) session.timer = null;
        _sessions.clear();
        _activeChannels.clear();
    },

    generateQuestions(difficulty, count) {
        const questions = [];
        for (let i = 0; i < count; i++) {
            questions.push(this.generateQuestion(difficulty));
        }
        return questions;
    },

    generateQuestion(difficulty) {
        switch (difficulty) {
            case 'basic': return this.generateBasicQuestion();
            case 'intermediate': return this.generateIntermediateQuestion();
            case 'advanced': return this.generateAdvancedQuestion();
            case 'prime': return this.generatePrimeQuestion();
            case 'ultimate': return this.generateUltimateQuestion();
            case 'trigonometry': return this.generateTrigonometryQuestion();
            case 'calculus': return this.generateCalculusQuestion();
            case 'statistics': return this.generateStatisticsQuestion();
            case 'mixed': return this.generateMixedQuestion();
            case 'speed': return this.generateSpeedQuestion();
            default: return this.generateBasicQuestion();
        }
    },

    generateBasicQuestion() {
        const operations = [
            () => {
                const a = Math.floor(Math.random() * 100) + 1;
                const b = Math.floor(Math.random() * 100) + 1;
                return { display: `${a} + ${b}`, answer: a + b, type: 'Addition' };
            },
            () => {
                const a = Math.floor(Math.random() * 100) + 50;
                const b = Math.floor(Math.random() * 49) + 1;
                return { display: `${a} - ${b}`, answer: a - b, type: 'Subtraction' };
            }
        ];
        return operations[Math.floor(Math.random() * operations.length)]();
    },

    generateIntermediateQuestion() {
        const operations = [
            () => {
                const a = Math.floor(Math.random() * 25) + 2;
                const b = Math.floor(Math.random() * 25) + 2;
                return { display: `${a} × ${b}`, answer: a * b, type: 'Multiplication' };
            },
            () => {
                const b = Math.floor(Math.random() * 12) + 2;
                const answer = Math.floor(Math.random() * 20) + 2;
                const a = b * answer;
                return { display: `${a} ÷ ${b}`, answer: answer, type: 'Division' };
            }
        ];
        return operations[Math.floor(Math.random() * operations.length)]();
    },

    generateAdvancedQuestion() {
        const operations = [
            () => {
                const base = Math.floor(Math.random() * 10) + 2;
                const exp = Math.floor(Math.random() * 4) + 2;
                return { display: `${base}^${exp}`, answer: Math.pow(base, exp), type: 'Exponents' };
            },
            () => {
                const perfect = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225];
                const num = perfect[Math.floor(Math.random() * perfect.length)];
                return { display: `√${num}`, answer: Math.sqrt(num), type: 'Square Root' };
            },
            () => {
                const x = Math.floor(Math.random() * 20) + 1;
                const a = Math.floor(Math.random() * 10) + 1;
                const b = Math.floor(Math.random() * 20) + 1;
                const result = a * x + b;
                return { display: `If ${a}x + ${b} = ${result}, what is x?`, answer: x, type: 'Linear Algebra' };
            }
        ];
        return operations[Math.floor(Math.random() * operations.length)]();
    },

    generatePrimeQuestion() {
        const operations = [
            () => {
                const num = Math.floor(Math.random() * 90) + 10;
                const isPrime = this.isPrime(num);
                return { display: `Is ${num} a prime number? (yes/no)`, answer: isPrime ? 'yes' : 'no', type: 'Prime Check' };
            },
            () => {
                const n = Math.floor(Math.random() * 8) + 3;
                const nthPrime = this.getNthPrime(n);
                return { display: `What is the ${n}th prime number?`, answer: nthPrime, type: 'Prime Sequence' };
            },
            () => {
                const num = Math.floor(Math.random() * 50) + 10;
                const factors = this.getPrimeFactors(num);
                const largestFactor = Math.max(...factors);
                return { display: `What is the largest prime factor of ${num}?`, answer: largestFactor, type: 'Prime Factorization' };
            }
        ];
        return operations[Math.floor(Math.random() * operations.length)]();
    },

    generateUltimateQuestion() {
        const operations = [
            () => {
                const a = Math.floor(Math.random() * 5) + 1;
                const b = Math.floor(Math.random() * 5) + 1;
                const c = Math.floor(Math.random() * 5) + 1;
                const answer = 4 * a * b + 2 * a * c;
                return { display: `Expand: (${a}x + ${b})(${a}x + ${c}) + (${a}x - ${b})(${a}x - ${c})\nWhat is the coefficient of x?`, answer: answer, type: 'Algebraic Expansion' };
            },
            () => {
                const a = Math.floor(Math.random() * 3) + 1;
                const b = Math.floor(Math.random() * 3) + 1;
                const discriminant = b * b - 4 * a;
                return { display: `For equation ${a}x² + ${b}x - 1 = 0, what is the discriminant?`, answer: discriminant, type: 'Quadratic Analysis' };
            },
            () => {
                const r = Math.floor(Math.random() * 5) + 2;
                const i = Math.floor(Math.random() * 5) + 1;
                const magnitude = Math.round(Math.sqrt(r * r + i * i) * 100) / 100;
                return { display: `What is the magnitude of the complex number ${r} + ${i}i? (round to 2 decimal places)`, answer: magnitude, type: 'Complex Numbers' };
            }
        ];
        return operations[Math.floor(Math.random() * operations.length)]();
    },

    generateTrigonometryQuestion() {
        const operations = [
            () => {
                const angles = [0, 30, 45, 60, 90, 120, 135, 150, 180];
                const funcs = ['sin', 'cos', 'tan'];
                const angle = angles[Math.floor(Math.random() * angles.length)];
                const func = funcs[Math.floor(Math.random() * funcs.length)];

                let answer;
                const rad = angle * Math.PI / 180;
                switch (func) {
                    case 'sin': answer = Math.round(Math.sin(rad) * 100) / 100; break;
                    case 'cos': answer = Math.round(Math.cos(rad) * 100) / 100; break;
                    case 'tan':
                        if (angle === 90) answer = 'undefined';
                        else answer = Math.round(Math.tan(rad) * 100) / 100;
                        break;
                }

                return { display: `Calculate ${func}(${angle}°). Round to 2 decimal places.`, answer: answer, type: `Trigonometric Values` };
            },
            () => {
                const a = Math.floor(Math.random() * 5) + 3;
                const b = Math.floor(Math.random() * 5) + 3;
                const c = Math.round(Math.sqrt(a * a + b * b) * 100) / 100;
                return { display: `In a right triangle, if legs are ${a} and ${b}, what is the hypotenuse? (round to 2 decimals)`, answer: c, type: 'Pythagorean Theorem' };
            },
            () => {
                const period = Math.floor(Math.random() * 4) + 2;
                const answer = 360 / period;
                return { display: `If sin(${period}θ) has period ${360 / period}°, what is the coefficient of θ?`, answer: period, type: 'Trigonometric Periods' };
            }
        ];
        return operations[Math.floor(Math.random() * operations.length)]();
    },

    generateCalculusQuestion() {
        const operations = [
            () => {
                const n = Math.floor(Math.random() * 6) + 2;
                const coeff = Math.floor(Math.random() * 5) + 1;
                const answer = n * coeff;
                return { display: `Find the derivative: f(x) = ${coeff}x^${n}\nWhat is the coefficient of x^${n - 1}?`, answer: answer, type: 'Power Rule Differentiation' };
            },
            () => {
                const a = Math.floor(Math.random() * 5) + 1;
                const b = Math.floor(Math.random() * 5) + 1;
                const answer = a;
                return { display: `Find f'(x) if f(x) = ${a}e^x + ${b}ln(x)\nWhat is the coefficient of e^x in f'(x)?`, answer: answer, type: 'Exponential Derivatives' };
            },
            () => {
                const n = Math.floor(Math.random() * 4) + 2;
                const coeff = Math.floor(Math.random() * 6) + 1;
                const upper = Math.floor(Math.random() * 3) + 2;
                const answer = Math.round((coeff * Math.pow(upper, n + 1)) / (n + 1) * 100) / 100;
                return { display: `Evaluate: ∫₀^${upper} ${coeff}x^${n} dx (round to 2 decimals)`, answer: answer, type: 'Definite Integration' };
            },
            () => {
                const a = Math.floor(Math.random() * 3) + 1;
                const b = Math.floor(Math.random() * 5) + 1;
                const c = Math.floor(Math.random() * 5) + 1;
                const answer = 2 * a;
                return { display: `Find the second derivative: f(x) = ${a}x³ + ${b}x² + ${c}x\nWhat is the coefficient of x in f''(x)?`, answer: answer, type: 'Second Derivatives' };
            }
        ];
        return operations[Math.floor(Math.random() * operations.length)]();
    },

    generateStatisticsQuestion() {
        const operations = [
            () => {
                const data = Array.from({ length: Math.floor(Math.random() * 5) + 4 }, () => Math.floor(Math.random() * 20) + 1);
                const mean = Math.round((data.reduce((sum, x) => sum + x, 0) / data.length) * 100) / 100;
                return { display: `Calculate the mean of: [${data.join(', ')}] (round to 2 decimals)`, answer: mean, type: 'Mean Calculation' };
            },
            () => {
                const data = Array.from({ length: 6 }, () => Math.floor(Math.random() * 15) + 1).sort((a, b) => a - b);
                const n = data.length;
                const median = n % 2 === 0 ? (data[n / 2 - 1] + data[n / 2]) / 2 : data[Math.floor(n / 2)];
                return { display: `Find the median of: [${data.join(', ')}]`, answer: median, type: 'Median Calculation' };
            },
            () => {
                const successes = Math.floor(Math.random() * 8) + 2;
                const trials = successes + Math.floor(Math.random() * 5) + 3;
                const probability = Math.round((successes / trials) * 100) / 100;
                return { display: `If ${successes} out of ${trials} trials succeed, what is the probability? (round to 2 decimals)`, answer: probability, type: 'Probability Calculation' };
            },
            () => {
                const data = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10) + 5);
                const mean = data.reduce((sum, x) => sum + x, 0) / data.length;
                const variance = Math.round((data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length) * 100) / 100;
                return { display: `Calculate the variance of: [${data.join(', ')}] (round to 2 decimals)`, answer: variance, type: 'Variance Calculation' };
            },
            () => {
                const n = Math.floor(Math.random() * 5) + 3;
                const k = Math.floor(Math.random() * n) + 1;
                const combinations = this.factorial(n) / (this.factorial(k) * this.factorial(n - k));
                return { display: `Calculate C(${n}, ${k}) - combinations of ${n} choose ${k}`, answer: combinations, type: 'Combinations' };
            }
        ];
        return operations[Math.floor(Math.random() * operations.length)]();
    },

    generateMixedQuestion() {
        const difficulties = ['basic', 'intermediate', 'advanced', 'prime', 'ultimate', 'trigonometry', 'calculus', 'statistics'];
        const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
        return this.generateQuestion(randomDifficulty);
    },

    generateSpeedQuestion() {
        const operations = [
            () => {
                const a = Math.floor(Math.random() * 20) + 1;
                const b = Math.floor(Math.random() * 20) + 1;
                return { display: `${a} + ${b}`, answer: a + b, type: 'Quick Addition' };
            },
            () => {
                const a = Math.floor(Math.random() * 12) + 1;
                const b = Math.floor(Math.random() * 12) + 1;
                return { display: `${a} × ${b}`, answer: a * b, type: 'Quick Multiplication' };
            },
            () => {
                const base = Math.floor(Math.random() * 5) + 2;
                const exp = Math.floor(Math.random() * 3) + 2;
                return { display: `${base}^${exp}`, answer: Math.pow(base, exp), type: 'Quick Powers' };
            }
        ];
        return operations[Math.floor(Math.random() * operations.length)]();
    },

    isPrime(n) {
        if (n <= 1) return false;
        if (n <= 3) return true;
        if (n % 2 === 0 || n % 3 === 0) return false;
        for (let i = 5; i * i <= n; i += 6) {
            if (n % i === 0 || n % (i + 2) === 0) return false;
        }
        return true;
    },

    getNthPrime(n) {
        const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
        return primes[n - 1];
    },

    getPrimeFactors(n) {
        const factors = [];
        for (let i = 2; i <= n; i++) {
            while (n % i === 0) {
                factors.push(i);
                n /= i;
            }
        }
        return factors;
    },

    factorial(n) {
        if (n <= 1) return 1;
        return n * this.factorial(n - 1);
    },

    checkAnswer(userAnswer, correctAnswer, difficulty) {
        if (difficulty === 'prime' && typeof correctAnswer === 'string') {
            return userAnswer === correctAnswer;
        }
        if (typeof correctAnswer === 'number') {
            return Math.abs(userAnswer - correctAnswer) < 0.01;
        }
        return userAnswer === correctAnswer;
    }
};
