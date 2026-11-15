
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, replyEphemeral, ACCENT } = require('../../UI');

const userCooldowns = new Map();
const COOLDOWN_TIME = 5000;

const securityFilters = {
    blockedWords: [
        'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot'
    ],

    dangerousPatterns: [
        /@everyone|@here/i,
        /discord\.gg\/[\w-]+/i,
        /https?:\/\/[^\s]+/i,
        /[A-Z\s]{25,}/,
        /(.)\1{8,}/
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Make the bot say something with basic safety')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message you want the bot to say')
                .setRequired(true)
                .setMaxLength(1500))
        .addStringOption(option =>
            option.setName('style')
                .setDescription('How to display the message')
                .setRequired(false)
                .addChoices(
                    { name: 'Plain Text', value: 'plain' },
                    { name: 'Embed Style', value: 'embed' },
                    { name: 'Info Box', value: 'info' },
                    { name: 'Announcement', value: 'announcement' }
                )),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        const userId = isSlash ? interaction.user.id : interaction.author.id;
        const now = Date.now();
        const cooldownEnd = userCooldowns.get(userId);

        if (cooldownEnd && now < cooldownEnd) {
            const timeLeft = Math.ceil((cooldownEnd - now) / 1000);
            const cooldownMsg = lang.fun.say.cooldown
                .replace('{emoji}', getEmoji('time') || '⏳')
                .replace('{time}', timeLeft);

            if (isSlash) {
                return await replyEphemeral(interaction, cooldownMsg);
            } else {
                const replyMsg = await interaction.reply(cooldownMsg);
                setTimeout(() => {
                    replyMsg.delete().catch(() => { });
                    interaction.delete().catch(() => { });
                }, 4000);
                return;
            }
        }

        let message = '';
        let style = 'plain';

        if (isSlash) {
            message = interaction.options.getString('message');
            style = interaction.options.getString('style') || 'plain';
        } else {
            const remainingArgs = [];
            for (const arg of args || []) {
                if (arg.toLowerCase().startsWith('style:')) {
                    const candidateStyle = arg.slice(6).toLowerCase();
                    if (['plain', 'embed', 'info', 'announcement'].includes(candidateStyle)) {
                        style = candidateStyle;
                    }
                } else {
                    remainingArgs.push(arg);
                }
            }
            message = remainingArgs.join(' ');
        }

        if (!isSlash && message.trim().length === 0) {
            const guideCard = buildCard({
                title: lang.fun.say.guideTitle.replace('{emoji}', getEmoji('chat')),
                description: lang.fun.say.guideDesc,
                sections: [
                    `### ${lang.fun.say.safetyTitle}\n\n${lang.fun.say.safetyDesc}`
                ],
                accentColor: ACCENT.primary
            });

            const replyMsg = await interaction.reply({
                components: [guideCard],
                flags: MessageFlags.IsComponentsV2
            });
            setTimeout(() => {
                replyMsg.delete().catch(() => { });
                interaction.delete().catch(() => { });
            }, 10000);
            return;
        }

        if (!isSlash) {
            interaction.options = {
                getString: (name) => {
                    if (name === 'message') return message;
                    if (name === 'style') return style;
                    return null;
                }
            };
        }

        const securityResult = this.checkMessageSafety(message);

        if (!securityResult.safe) {
            const blockedText = lang.fun.say.blockedMsg
                .replace('{emoji}', getEmoji('cross'))
                .replace('{reason}', securityResult.reason);

            if (isSlash) {
                return await replyEphemeral(interaction, blockedText);
            } else {
                const replyMsg = await interaction.reply(blockedText);
                setTimeout(() => {
                    replyMsg.delete().catch(() => { });
                    interaction.delete().catch(() => { });
                }, 4000);
                return;
            }
        }

        userCooldowns.set(userId, now + COOLDOWN_TIME);

        if (isSlash) {
            try {
                await deferReply(interaction, true);
            } catch (err) {
                console.error('[Say] Defer failed:', err.message);
                return;
            }

            const authorName = interaction.user.displayName || interaction.user.username;
            const preview = message.length > 100 ? message.substring(0, 100) + '...' : message;
            const styleDisplay = style.charAt(0).toUpperCase() + style.slice(1);

            const successTitle = lang.fun.say.successTitle
                .replace('{emoji}', getEmoji('tick'));
            const successDesc = lang.fun.say.successDesc
                .replace('{style}', styleDisplay);

            const detailsTitle = lang.fun.say.detailsTitle
                .replace('{emoji}', getEmoji('document'));
            const detailsDesc = lang.fun.say.detailsDesc
                .replace('{preview}', preview)
                .replace('{length}', message.length)
                .replace('{author}', authorName)
                .replace('{channel}', interaction.channel?.name || 'current channel');

            const successCard = buildCard({
                title: successTitle,
                description: successDesc,
                sections: [
                    `### ${detailsTitle}\n\n${detailsDesc}`
                ],
                accentColor: ACCENT.success
            });

            await interaction.editReply({
                components: [successCard],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        } else {
            try {
                await interaction.delete().catch(() => { });
            } catch (_) { }
        }

        const author = isSlash ? interaction.user : interaction.author;
        await this.sendFormattedMessage(interaction.channel, message, style, author);
    },

    checkMessageSafety(message) {
        const lowerMessage = message.toLowerCase();

        for (const word of securityFilters.blockedWords) {
            if (lowerMessage.includes(word)) {
                return {
                    safe: false,
                    reason: lang.fun.say.reasonInappropriate
                };
            }
        }

        for (const pattern of securityFilters.dangerousPatterns) {
            if (pattern.test(message)) {
                return {
                    safe: false,
                    reason: lang.fun.say.reasonPatterns
                };
            }
        }

        if (message.trim().length < 1) {
            return {
                safe: false,
                reason: lang.fun.say.reasonEmpty
            };
        }

        if (message.length > 1500) {
            return {
                safe: false,
                reason: lang.fun.say.reasonTooLong
            };
        }

        return { safe: true };
    },

    async sendFormattedMessage(channel, message, style, author) {
        const authorName = author.displayName || author.username;

        switch (style) {
            case 'embed': {
                const title = lang.fun.say.messageTitle
                    .replace('{emoji}', getEmoji('chat'));
                const footer = lang.fun.say.footerEmbed
                    .replace('{emoji}', getEmoji('document'))
                    .replace('{author}', authorName);

                const embedCard = buildCard({
                    title,
                    description: message,
                    footer,
                    accentColor: ACCENT.primary
                });

                await channel.send({
                    components: [embedCard],
                    flags: MessageFlags.IsComponentsV2
                });
                break;
            }

            case 'info': {
                const title = lang.fun.say.messageTitle
                    .replace('{emoji}', getEmoji('info') || 'ℹ️');
                const fromText = lang.fun.say.fromAuthor.replace('{author}', authorName);

                const infoCard = buildCard({
                    title,
                    description: `### ${fromText}\n\n> ${message}`,
                    accentColor: ACCENT.info
                });

                await channel.send({
                    components: [infoCard],
                    flags: MessageFlags.IsComponentsV2
                });
                break;
            }

            case 'announcement': {
                const title = lang.fun.say.announcementTitle
                    .replace('{emoji}', getEmoji('warning'));
                const importantText = lang.fun.say.importantMessage;
                const footer = lang.fun.say.footerAnnouncement
                    .replace('{emoji}', getEmoji('warning'))
                    .replace('{author}', authorName)
                    .replace('{time}', new Date().toLocaleString());

                const announcementCard = buildCard({
                    title,
                    description: `### ${importantText}\n\n> ${message}`,
                    footer,
                    accentColor: ACCENT.warning
                });

                await channel.send({
                    components: [announcementCard],
                    flags: MessageFlags.IsComponentsV2
                });
                break;
            }

            default:
                await channel.send({ content: message });
                break;
        }
    }
};
