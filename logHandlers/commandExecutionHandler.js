const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const CommandLogsConfig = require('../models/commandLogs/commandlogs');
const { buildCard, ACCENT } = require('../UI');
const cacheManager = require('../utils/cacheManager');
const { registerInteractionObserver } = require('../utils/interactionRouter');
const logHandlersIcons = require('../UI/icons/loghandlers');

module.exports = async function commandExecutionHandler(client) {
    if (!cacheManager.caches.has('commandLogConfig')) {
        cacheManager.createCache('commandLogConfig', { ttl: 60000, maxSize: 500 });
    }

    const unregister = registerInteractionObserver(client, 'command-execution-logging', async (interaction) => {
        if (!interaction?.isChatInputCommand?.()) return;

        const { commandName } = interaction;
        const user = interaction.user;
        const guild = interaction.guild;
        const channel = interaction.channel;

        if (!guild?.id || !user) return;

        try {
            let config = cacheManager.get('commandLogConfig', guild.id);
            if (config === null) {
                config = await CommandLogsConfig.findOne({ guildId: guild.id });
                cacheManager.set('commandLogConfig', guild.id, config || false);
            }
            if (!config || !config.enabled || !config.channelId) return;

            const logChannel = client.channels.cache.get(config.channelId)
                || await client.channels.fetch(config.channelId).catch(() => null);
            if (!logChannel) return;

            const lang = await loadLanguage(guild.id);
            const s = lang?.serverlogs || {};

            let fullCommandName = `/${commandName}`;
            try {
                const subcommand = interaction.options.getSubcommand(false);
                if (subcommand) {
                    fullCommandName += ` ${subcommand}`;
                }
            } catch (_) {
                
            }

            const options = interaction.options.data || [];
            const optionsText = options.length > 0
                ? options.map(opt => {
                    if (opt.type === 1) return null; 
                    const rawVal = opt.value ?? opt.user?.tag ?? opt.channel?.name ?? opt.role?.name ?? (s.unknown || 'N/A');
                    const cleanVal = String(rawVal).replace(/`/g, "'");
                    const truncatedVal = cleanVal.length > 200 ? cleanVal.slice(0, 197) + '...' : cleanVal;
                    return `• **${opt.name}:** \`${truncatedVal}\``;
                }).filter(Boolean).join('\n')
                : `*${s.noOptionsProvided || 'No options provided'}*`;

            const executionStatus = interaction.replied
                ? (s.responded || 'Responded')
                : interaction.deferred
                    ? (s.deferred || 'Deferred')
                    : (s.executed || 'Executed');

            const userAvatar = user.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.staffIcon;

            const card = buildCard({
                title: `${getEmoji('document')} ${s.commandExecutedTitle || 'Command Executed'}`,
                accentColor: ACCENT.info,
                thumbnailURL: userAvatar,
                sections: [
                    `> **${s.commandExecutedDesc || 'User interaction detected'}**\n\n• **${s.userLabel || 'User'}:** ${user.toString()} (\`${user.tag || user.username}\`)\n• **${s.userIdLabel || 'User ID'}:** \`${user.id}\`\n• **${s.accountCreatedLabel || 'Account Created'}:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n• **${s.channelLabel || 'Channel'}:** ${channel?.id ? `<#${channel.id}>` : `\`${s.directOrThread || 'Direct / Thread'}\``}\n• **${s.serverLabel || 'Server'}:** \`${guild.name}\``,
                    `### ${getEmoji('settings')} ${s.commandDetailsTitle || 'Command Details'}\n• **${s.commandLabel || 'Command'}:** \`${fullCommandName}\`\n• **${s.responseStatusLabel || 'Status'}:** \`${executionStatus}\`\n• **${s.executedLabel || 'Executed At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)\n\n**${s.optionsLabel || 'Options'}:**\n${optionsText}`
                ],
                footer: (s.footers?.commandLogs || 'Command Audit • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
            });

            await logChannel.send({
                components: [card],
                flags: MessageFlags.IsComponentsV2
            }).catch(err => {
                console.error('[CommandExecutionHandler] Error sending log:', err);
            });
        } catch (error) {
            console.error('[CommandExecutionHandler] Error in command log handler:', error);
        }
    });

    return { stop: unregister };
};
