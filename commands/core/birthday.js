const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const moment = require('moment');
const birthdayController = require('../../models/birthday/Controller');
const lang = require('../../events/loadLanguage');
const { btn, buildCard, editV2 } = require('../../UI');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');

const ZODIAC_EMOJIS = {
    aries: getEmoji('fire'), taurus: getEmoji('sparkles'), gemini: getEmoji('chat'), cancer: getEmoji('heart'),
    leo: getEmoji('crown'), virgo: getEmoji('star'), libra: getEmoji('scales'), scorpio: getEmoji('security'),
    sagittarius: getEmoji('darts'), capricorn: getEmoji('trend'), aquarius: getEmoji('world'), pisces: getEmoji('sparkles')
};

const CELEBRATION_STYLES = {
    simple: lang.birthday.styles.simple,
    party: lang.birthday.styles.party,
    quiet: lang.birthday.styles.quiet,
    none: lang.birthday.styles.none
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Advanced birthday management system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set your birthday with advanced options')
                .addStringOption(option =>
                    option.setName('date')
                        .setDescription('Birthday (MM-DD-YYYY, MM-DD, DD/MM/YYYY, etc.)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('timezone')
                        .setDescription('Your timezone (e.g., America/New_York)')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('private')
                        .setDescription('Keep your birthday private')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Check birthday information')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check (leave empty for yourself)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('upcoming')
                .setDescription('View upcoming birthdays')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Days ahead to check (1-365)')
                        .setMinValue(1)
                        .setMaxValue(365)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('today')
                .setDescription('Check today\'s birthdays'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('wish')
                .setDescription('Send a birthday wish')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to wish happy birthday')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Your birthday message')
                        .setMaxLength(1024)
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('anonymous')
                        .setDescription('Send wish anonymously')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('settings')
                .setDescription('Manage your birthday settings'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View server birthday statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('zodiac')
                .setDescription('View birthdays by zodiac sign')
                .addStringOption(option =>
                    option.setName('sign')
                        .setDescription('Zodiac sign to filter by')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Aries', value: 'aries' },
                            { name: 'Taurus', value: 'taurus' },
                            { name: 'Gemini', value: 'gemini' },
                            { name: 'Cancer', value: 'cancer' },
                            { name: 'Leo', value: 'leo' },
                            { name: 'Virgo', value: 'virgo' },
                            { name: 'Libra', value: 'libra' },
                            { name: 'Scorpio', value: 'scorpio' },
                            { name: 'Sagittarius', value: 'sagittarius' },
                            { name: 'Capricorn', value: 'capricorn' },
                            { name: 'Aquarius', value: 'aquarius' },
                            { name: 'Pisces', value: 'pisces' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('View birthday leaderboard (most wishes received)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove your birthday from the system')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'settings') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } else {
            await interaction.deferReply();
        }
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            switch (subcommand) {
                case 'set':
                    await this.handleSetBirthday(interaction, userId, guildId);
                    break;
                case 'check':
                    await this.handleCheckBirthday(interaction, userId, guildId);
                    break;
                case 'upcoming':
                    await this.handleUpcomingBirthdays(interaction, guildId);
                    break;
                case 'today':
                    await this.handleTodaysBirthdays(interaction, guildId);
                    break;
                case 'wish':
                    await this.handleBirthdayWish(interaction, userId, guildId);
                    break;
                case 'settings':
                    await this.handleSettings(interaction, userId, guildId);
                    break;
                case 'stats':
                    await this.handleStats(interaction, guildId);
                    break;
                case 'zodiac':
                    await this.handleZodiac(interaction, guildId);
                    break;
                case 'leaderboard':
                    await this.handleLeaderboard(interaction, guildId);
                    break;
                case 'remove':
                    await this.handleRemoveBirthday(interaction, userId, guildId);
                    break;
            }
        } catch (error) {
            console.error('[Birthday] Command error:', error);
            try {
                await editV2(interaction, this.createErrorCard(lang.birthday?.error?.unexpected || 'An unexpected error occurred.'));
            } catch (err) {
                
            }
        }
    },

    async handleSetBirthday(interaction, userId, guildId) {
        const date = interaction.options.getString('date');
        const timezone = interaction.options.getString('timezone') || 'UTC';
        const isPrivate = interaction.options.getBoolean('private') || false;

        const options = {
            settings: {
                allowPublicView: !isPrivate,
                allowMentions: true,
                allowDMs: false,
                celebrationStyle: 'simple'
            }
        };

        const result = await birthdayController.setBirthday(userId, guildId, date, timezone, options);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(result.error));
        }

        const card = buildCard({
            title: lang.birthday.set.title,
            description: lang.birthday.set.desc.replace('{date}', moment(result.birthday.birthday).format('MMMM Do')),
            fields: [
                { name: lang.birthday.set.age, value: result.birthday.age ? lang.birthday.set.ageValue.replace('{age}', result.birthday.age) : lang.birthday.set.notCalculated },
                { name: lang.birthday.set.timezone, value: result.birthday.timezone },
                { name: lang.birthday.set.zodiac, value: `${ZODIAC_EMOJIS[result.birthday.zodiacSign] || getEmoji('help')} ${result.birthday.zodiacSign ? (result.birthday.zodiacSign.charAt(0).toUpperCase() + result.birthday.zodiacSign.slice(1)) : lang.unknown}` },
                { name: lang.birthday.set.daysUntil, value: lang.birthday.set.daysValue.replace('{days}', result.birthday.daysUntilBirthday) },
                { name: lang.birthday.set.privacy, value: isPrivate ? lang.birthday.set.private : lang.birthday.set.public }
            ],
            footer: lang.birthday.set.footer,
            tone: 'success'
        });

        await editV2(interaction, card);
    },

    async handleCheckBirthday(interaction, userId, guildId) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const result = await birthdayController.getBirthday(targetUser.id, guildId);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(result.error));
        }

        const birthday = result.birthday;
        if (targetUser.id !== userId && birthday.settings?.allowPublicView === false) {
            const privacyError = lang.birthday.error.private;
            return editV2(interaction, this.createErrorCard(privacyError && privacyError !== 'Private' ? privacyError : 'This birthday is private.'));
        }
        const birthdayDate = moment(birthday.birthday);

        const fields = [
            { name: lang.birthday.check.birthday, value: birthdayDate.format('MMMM Do') },
            { name: lang.birthday.set.age, value: result.age ? lang.birthday.set.ageValue.replace('{age}', result.age) : lang.birthday.set.notCalculated },
            { name: lang.birthday.set.timezone, value: birthday.timezone },
            { name: lang.birthday.set.zodiac, value: `${ZODIAC_EMOJIS[result.zodiacSign] || getEmoji('help')} ${result.zodiacSign ? (result.zodiacSign.charAt(0).toUpperCase() + result.zodiacSign.slice(1)) : lang.unknown}` },
            { name: lang.birthday.set.daysUntil, value: lang.birthday.set.daysValue.replace('{days}', result.daysUntil) },
            { name: lang.birthday.check.totalWishes, value: `${birthday.stats.totalWishes}` }
        ];

        if (birthday.wishes.length > 0 && targetUser.id === userId) {
            const recentWishes = birthday.wishes.slice(-3).map(wish =>
                `${wish.isAnonymous ? lang.birthday.check.anonymous : `<@${wish.fromUserId}>`}: ${wish.message}`
            ).join('\n');
            fields.push({ name: lang.birthday.check.recentWishes, value: recentWishes || lang.birthday.check.noWishes });
        }

        const card = buildCard({
            title: lang.birthday.check.title.replace('{user}', targetUser.username),
            fields,
            footer: lang.birthday.check.lastCelebrated.replace('{date}', birthday.stats.lastCelebrated ? moment(birthday.stats.lastCelebrated).format('MMMM Do, YYYY') : lang.birthday.check.never),
            thumbnailURL: targetUser.displayAvatarURL({ dynamic: true }),
            accentColor: 0xFFD700
        });

        await editV2(interaction, card);
    },

    async handleUpcomingBirthdays(interaction, guildId) {
        const days = interaction.options.getInteger('days') || 30;
        const result = await birthdayController.getUpcomingBirthdays(guildId, days);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(result.error));
        }

        const publicBirthdays = result.birthdays.filter(birthday => birthday.settings?.allowPublicView !== false);
        if (publicBirthdays.length === 0) {
            const emptyCard = buildCard({
                title: lang.birthday.upcoming.emptyTitle,
                description: lang.birthday.upcoming.emptyDesc.replace('{days}', days),
                tone: 'warning'
            });
            return editV2(interaction, emptyCard);
        }

        const fields = [];
        for (const birthday of publicBirthdays.slice(0, 10)) {
            try {
                const user = await interaction.client.users.fetch(birthday.userId);
                const birthdayMoment = moment(birthday.adjustedBirthday);
                const daysUntil = Math.ceil(moment(birthday.adjustedBirthday).diff(moment(), 'days', true));
                const dayWord = daysUntil !== 1 ? lang.birthday.upcoming.days : lang.birthday.upcoming.day;

                fields.push({
                    name: `${ZODIAC_EMOJIS[birthday.zodiacSign] || getEmoji('gift')} ${user.username}`,
                    value: `${getEmoji('calendar')} ${birthdayMoment.format('MMMM Do')} (${daysUntil} ${dayWord})`
                });
            } catch (error) {
                
            }
        }

        const card = buildCard({
            title: lang.birthday.upcoming.title.replace('{days}', days),
            description: lang.birthday.upcoming.desc.replace('{count}', publicBirthdays.length).replace('{plural}', publicBirthdays.length > 1 ? 's' : ''),
            fields,
            footer: publicBirthdays.length > 10 ? lang.birthday.upcoming.footer.replace('{count}', publicBirthdays.length) : null,
            accentColor: 0xFF69B4
        });

        await editV2(interaction, card);
    },

    async handleTodaysBirthdays(interaction, guildId) {
        const result = await birthdayController.getTodaysBirthdays(guildId);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(result.error));
        }

        const publicBirthdays = result.birthdays.filter(birthday => birthday.settings?.allowPublicView !== false);
        if (publicBirthdays.length === 0) {
            const emptyCard = buildCard({
                title: lang.birthday.today.emptyTitle,
                description: lang.birthday.today.emptyDesc,
                tone: 'warning'
            });
            return editV2(interaction, emptyCard);
        }

        const fields = [];
        for (const birthday of publicBirthdays) {
            try {
                const user = await interaction.client.users.fetch(birthday.userId);
                const age = birthday.age;

                fields.push({
                    name: `${getEmoji('gift')} ${user.username}`,
                    value: `${age ? lang.birthday.today.turning.replace('{age}', age) : lang.birthday.today.birthdayToday} ${ZODIAC_EMOJIS[birthday.zodiacSign] || getEmoji('sparkles')}`
                });

                await birthdayController.celebrateBirthday(birthday.userId, guildId);
            } catch (error) {
                
            }
        }

        const celebrateButton = new ActionRowBuilder()
            .addComponents(
                btn({
                    customId: 'birthday_celebrate',
                    label: lang.birthday.buttons.celebrate,
                    emoji: getButtonEmoji('sparkles') || '✨',
                    style: ButtonStyle.Primary
                })
            );

        const card = buildCard({
            title: lang.birthday.today.title,
            description: lang.birthday.today.desc.replace('{count}', publicBirthdays.length).replace('{plural}', publicBirthdays.length > 1 ? 's' : ''),
            fields,
            rows: [celebrateButton],
            accentColor: 0xFF1493
        });

        await editV2(interaction, card);
    },

    async handleBirthdayWish(interaction, userId, guildId) {
        const targetUser = interaction.options.getUser('user');
        const message = interaction.options.getString('message');
        const isAnonymous = interaction.options.getBoolean('anonymous') || false;

        if (targetUser.id === userId) {
            return editV2(interaction, this.createErrorCard(lang.birthday.error.wishSelf));
        }

        const result = await birthdayController.addWish(targetUser.id, guildId, userId, message, isAnonymous);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(result.error));
        }

        const card = buildCard({
            title: lang.birthday.wish.sentTitle,
            description: lang.birthday.wish.sentDesc.replace('{anonymous}', isAnonymous ? `${lang.birthday.check.anonymous} ` : '').replace('{user}', targetUser.username),
            fields: [{ name: lang.birthday.wish.yourMessage, value: message }],
            accentColor: 0xFF69B4
        });

        await editV2(interaction, card);

        try {
            const birthdayResult = await birthdayController.getBirthday(targetUser.id, guildId);
            if (birthdayResult.success && birthdayResult.birthday.settings.allowDMs) {
                const dmCard = buildCard({
                    title: lang.birthday.wish.dmTitle,
                    description: lang.birthday.wish.dmDesc.replace('{guild}', interaction.guild.name),
                    fields: [
                        { name: lang.birthday.wish.message, value: message },
                        { name: lang.birthday.wish.from, value: isAnonymous ? lang.birthday.check.anonymous : interaction.user.username }
                    ],
                    accentColor: 0xFF69B4
                });

                await targetUser.send({ components: [dmCard], flags: MessageFlags.IsComponentsV2 });
            }
        } catch (error) {
            
        }
    },

    async handleSettings(interaction, userId, guildId) {
        const result = await birthdayController.getBirthday(userId, guildId);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(lang.birthday.error.notSet));
        }

        const birthday = result.birthday;
        const settings = birthday.settings;

        const settingsMenu = new StringSelectMenuBuilder()
            .setCustomId(`birthday_settings_${userId}`)
            .setPlaceholder(lang.birthday.settings.placeholder)
            .addOptions([
                {
                    label: lang.birthday.settings.privacy,
                    description: lang.birthday.settings.privacyDesc.replace('{status}', settings.allowPublicView ? lang.birthday.status.public : lang.birthday.status.private),
                    value: 'privacy',
                    emoji: settings.allowPublicView ? (getButtonEmoji('world') || '🌍') : (getButtonEmoji('lock') || '🔒')
                },
                {
                    label: lang.birthday.settings.mentions,
                    description: lang.birthday.settings.mentionsDesc.replace('{status}', settings.allowMentions ? lang.birthday.status.enabled : lang.birthday.status.disabled),
                    value: 'mentions',
                    emoji: settings.allowMentions ? (getButtonEmoji('info') || 'ℹ️') : (getButtonEmoji('cross') || '❌')
                },
                {
                    label: lang.birthday.settings.dms,
                    description: lang.birthday.settings.dmsDesc.replace('{status}', settings.allowDMs ? lang.birthday.status.enabled : lang.birthday.status.disabled),
                    value: 'dms',
                    emoji: settings.allowDMs ? (getButtonEmoji('chat') || '💬') : (getButtonEmoji('cross') || '❌')
                },
                {
                    label: lang.birthday.settings.celebration,
                    description: lang.birthday.settings.celebrationDesc.replace('{style}', CELEBRATION_STYLES[settings.celebrationStyle]),
                    value: 'celebration',
                    emoji: getButtonEmoji('sparkles') || '✨'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(settingsMenu);

        const card = buildCard({
            title: lang.birthday.settings.title,
            description: lang.birthday.settings.description,
            fields: [
                { name: lang.birthday.settings.fieldPrivacy, value: settings.allowPublicView ? lang.birthday.status.public : lang.birthday.status.private },
                { name: lang.birthday.settings.fieldMentions, value: settings.allowMentions ? lang.birthday.status.enabled : lang.birthday.status.disabled },
                { name: lang.birthday.settings.fieldDms, value: settings.allowDMs ? lang.birthday.status.enabled : lang.birthday.status.disabled },
                { name: lang.birthday.settings.fieldCelebration, value: CELEBRATION_STYLES[settings.celebrationStyle] }
            ],
            footer: lang.birthday.settings.footer,
            rows: [row],
            accentColor: 0x4A90E2
        });

        await editV2(interaction, card);
    },

    async handleStats(interaction, guildId) {
        const result = await birthdayController.getGuildStats(guildId);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(result.error));
        }

        const stats = result.stats;

        const card = buildCard({
            title: lang.birthday.stats.title.replace('{guild}', interaction.guild.name),
            fields: [
                { name: lang.birthday.stats.totalBirthdays, value: `${stats.totalBirthdays || 0}` },
                { name: lang.birthday.stats.totalWishes, value: `${stats.totalWishes || 0}` },
                { name: lang.birthday.stats.totalCelebrations, value: `${stats.totalCelebrations || 0}` },
                { name: lang.birthday.stats.thisMonth, value: `${stats.birthdaysThisMonth || 0}` },
                { name: lang.birthday.stats.mostCommonZodiac, value: stats.mostCommonZodiac ? `${ZODIAC_EMOJIS[stats.mostCommonZodiac]} ${stats.mostCommonZodiac.charAt(0).toUpperCase() + stats.mostCommonZodiac.slice(1)}` : lang.birthday.stats.none }
            ],
            footer: lang.birthday.stats.footer.replace('{date}', new Date().toLocaleDateString()),
            accentColor: 0x9370DB
        });

        await editV2(interaction, card);
    },

    async handleZodiac(interaction, guildId) {
        const zodiacSign = interaction.options.getString('sign');
        const result = await birthdayController.getBirthdaysByZodiac(guildId, zodiacSign);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(result.error));
        }

        const zodiacEmoji = ZODIAC_EMOJIS[zodiacSign] || getEmoji('help');
        const formattedSign = zodiacSign.charAt(0).toUpperCase() + zodiacSign.slice(1);

        const publicBirthdays = result.birthdays.filter(birthday => birthday.settings?.allowPublicView !== false);
        if (publicBirthdays.length === 0) {
            const emptyCard = buildCard({
                title: lang.birthday.zodiac.emptyTitle.replace('{emoji}', zodiacEmoji).replace('{sign}', formattedSign),
                description: lang.birthday.zodiac.emptyDesc.replace('{sign}', zodiacSign),
                tone: 'warning'
            });
            return editV2(interaction, emptyCard);
        }

        const fields = [];
        for (const birthday of publicBirthdays.slice(0, 10)) {
            try {
                const user = await interaction.client.users.fetch(birthday.userId);
                const birthdayDate = moment(birthday.birthday);
                const ageText = birthday.age ? lang.birthday.zodiac.ageYears.replace('{age}', birthday.age) : lang.birthday.zodiac.ageUnknown;

                fields.push({
                    name: `${getEmoji('gift')} ${user.username}`,
                    value: `${getEmoji('calendar')} ${birthdayDate.format('MMMM Do')} (${ageText})`
                });
            } catch (error) {
                
            }
        }

        const card = buildCard({
            title: lang.birthday.zodiac.title.replace('{emoji}', zodiacEmoji).replace('{sign}', formattedSign),
            description: lang.birthday.zodiac.desc.replace('{count}', publicBirthdays.length).replace('{plural}', publicBirthdays.length > 1 ? 's' : ''),
            fields,
            footer: publicBirthdays.length > 10 ? lang.birthday.zodiac.footer.replace('{count}', publicBirthdays.length) : null,
            accentColor: 0xDA70D6
        });

        await editV2(interaction, card);
    },

    async handleLeaderboard(interaction, guildId) {
        const result = await birthdayController.getBirthdayLeaderboard(guildId);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(result.error));
        }

        const publicLeaderboard = result.leaderboard.filter(birthday => birthday.settings?.allowPublicView !== false);
        if (publicLeaderboard.length === 0) {
            const emptyCard = buildCard({
                title: lang.birthday.leaderboard.emptyTitle,
                description: lang.birthday.leaderboard.emptyDesc,
                tone: 'warning'
            });
            return editV2(interaction, emptyCard);
        }

        const fields = [];
        const medals = [getEmoji('crown'), getEmoji('medal'), getEmoji('star')];

        for (let i = 0; i < publicLeaderboard.length && i < 10; i++) {
            const birthday = publicLeaderboard[i];
            try {
                const user = await interaction.client.users.fetch(birthday.userId);
                const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
                const zodiacEmoji = ZODIAC_EMOJIS[birthday.zodiacSign] || getEmoji('gift');
                const wishText = lang.birthday.leaderboard.wishes
                    .replace('{count}', birthday.stats.totalWishes)
                    .replace('{plural}', birthday.stats.totalWishes !== 1 ? 'es' : '');

                fields.push({
                    name: `${medal} ${user.username}`,
                    value: `${zodiacEmoji} ${wishText}`
                });
            } catch (error) {
                console.error(`[Birthday] Error fetching user ${birthday.userId}:`, error);
            }
        }

        const card = buildCard({
            title: lang.birthday.leaderboard.title,
            description: lang.birthday.leaderboard.desc,
            fields,
            accentColor: 0xFFD700
        });

        await editV2(interaction, card);
    },

    async handleRemoveBirthday(interaction, userId, guildId) {
        const result = await birthdayController.removeBirthday(userId, guildId);

        if (!result.success) {
            return editV2(interaction, this.createErrorCard(result.error));
        }

        const card = buildCard({
            title: lang.birthday.remove.title,
            description: lang.birthday.remove.desc,
            footer: lang.birthday.remove.footer,
            tone: 'danger'
        });

        await editV2(interaction, card);
    },

    createErrorCard(message) {
        return buildCard({
            title: lang.birthday.error.title,
            description: message,
            tone: 'danger'
        });
    }
};
