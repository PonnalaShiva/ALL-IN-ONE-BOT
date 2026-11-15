


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Notification = require('../../models/notifications/Schema');
const { resolveYouTubeChannelId, resolveTwitchLogin } = require('../../handlers/notificationHandler');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        notifications: createInterpolatableProxy(rawLang.setups?.notifications),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-notifications')
        .setDescription('Manage YouTube & Twitch notifications for your server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Set up notifications for a platform.')
                .addStringOption(opt =>
                    opt.setName('platform')
                        .setDescription('The platform to set up notifications for.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'YouTube', value: 'youtube' },
                            { name: 'Twitch', value: 'twitch' }
                        ))
                .addStringOption(opt =>
                    opt.setName('platform_id')
                        .setDescription('YouTube Channel ID/URL/@handle or Twitch username/URL.')
                        .setRequired(true))
                .addChannelOption(opt =>
                    opt.setName('discord_channel')
                        .setDescription('The Discord channel for notifications.')
                        .setRequired(true))
                .addRoleOption(opt =>
                    opt.setName('mention_role')
                        .setDescription('Role to mention when notifying.')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('custom_message')
                        .setDescription('Custom message. Use {role}, {title}, {url} as placeholders.')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View all notification setups.')
                .addStringOption(opt =>
                    opt.setName('platform')
                        .setDescription('Filter by platform (optional).')
                        .setRequired(false)
                        .addChoices(
                            { name: 'YouTube', value: 'youtube' },
                            { name: 'Twitch', value: 'twitch' }
                        )))
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a notification setup.')
                .addStringOption(opt =>
                    opt.setName('platform')
                        .setDescription('The platform.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'YouTube', value: 'youtube' },
                            { name: 'Twitch', value: 'twitch' }
                        ))
                .addStringOption(opt =>
                    opt.setName('platform_id')
                        .setDescription('The platform ID of the notification to delete.')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable a notification.')
                .addStringOption(opt =>
                    opt.setName('platform')
                        .setDescription('The platform.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'YouTube', value: 'youtube' },
                            { name: 'Twitch', value: 'twitch' }
                        ))
                .addStringOption(opt =>
                    opt.setName('platform_id')
                        .setDescription('The platform ID to toggle.')
                        .setRequired(true))
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Enable or disable.')
                        .setRequired(true))),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.notifications.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const serverId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        try {
            
            if (subcommand === 'setup') {
                const platform = interaction.options.getString('platform');
                const rawPlatformId = interaction.options.getString('platform_id');
                const discordChannel = interaction.options.getChannel('discord_channel');
                const mentionRole = interaction.options.getRole('mention_role');
                const customMessage = interaction.options.getString('custom_message');

                if (!discordChannel.isTextBased()) {
                    return sendV2(interaction, cards.error(lang.setups.notifications.title, lang.setups.notifications.invalidChannel));
                }

                let platformId;
                let platformName = null;

                if (platform === 'youtube') {
                    platformId = await resolveYouTubeChannelId(rawPlatformId);
                    if (!platformId) {
                        return sendV2(interaction, cards.error(lang.setups.notifications.title, lang.setups.notifications.resolveError));
                    }
                } else {
                    platformId = resolveTwitchLogin(rawPlatformId);
                    platformName = platformId;
                }

                await Notification.findOneAndUpdate(
                    { serverId, platform, platformId },
                    {
                        $set: {
                            channelId: discordChannel.id,
                            mentionRoleId: mentionRole ? mentionRole.id : null,
                            customMessage: customMessage || null,
                            platformName,
                            enabled: true
                        },
                        $setOnInsert: {
                            serverId,
                            platform,
                            platformId,
                            failCount: 0,
                            lastError: null,
                            notifiedIds: [],
                            lastNotifiedId: null,
                            lastChecked: null
                        }
                    },
                    { upsert: true, returnDocument: 'after', runValidators: true }
                );

                const card = cards.success(
                    lang.setups.notifications.title,
                    lang.setups.notifications.configured({
                        platform: platform.toUpperCase(),
                        name: platformName || platformId,
                        channel: `<#${discordChannel.id}>`
                    })
                );
                return sendV2(interaction, card);
            }

            
            if (subcommand === 'view') {
                const platform = interaction.options.getString('platform');
                const query = { serverId, ...(platform ? { platform } : {}) };
                const notifs = await Notification.find(query);

                if (notifs.length === 0) {
                    const desc = platform
                        ? lang.setups.notifications.noConfigPlatform({ platform: platform.toUpperCase() })
                        : lang.setups.notifications.noConfig;
                    return sendV2(interaction, cards.info(lang.setups.notifications.title, desc));
                }

                const list = notifs.map(n => {
                    const statusText = n.enabled ? lang.setups.notifications.enabled : lang.setups.notifications.disabled;
                    return `• **[${n.platform.toUpperCase()}]** \`${n.platformId}\` → <#${n.channelId}> (${statusText})`;
                }).join('\n');

                const card = buildCard({ accent: ACCENT.info })
                    .addText(`**${lang.setups.notifications.viewTitle}**`)
                    .addSeparator()
                    .addText(list);

                return sendV2(interaction, card);
            }

            
            if (subcommand === 'delete') {
                const platform = interaction.options.getString('platform');
                const rawPlatformId = interaction.options.getString('platform_id');

                let platformId;
                if (platform === 'youtube') {
                    platformId = await resolveYouTubeChannelId(rawPlatformId).catch(() => null) || rawPlatformId;
                } else {
                    platformId = resolveTwitchLogin(rawPlatformId);
                }

                const existing = await Notification.findOne({ serverId, platform, platformId });
                if (!existing) {
                    return sendV2(interaction, cards.warning(
                        lang.setups.notifications.title,
                        lang.setups.notifications.notFound({ platform: platform.toUpperCase(), id: platformId })
                    ));
                }

                await existing.deleteOne();
                return sendV2(interaction, cards.success(
                    lang.setups.notifications.title,
                    lang.setups.notifications.deleted({ platform: platform.toUpperCase(), id: platformId })
                ));
            }

            
            if (subcommand === 'toggle') {
                const platform = interaction.options.getString('platform');
                const rawPlatformId = interaction.options.getString('platform_id');
                const enabled = interaction.options.getBoolean('enabled');

                let platformId;
                if (platform === 'youtube') {
                    platformId = await resolveYouTubeChannelId(rawPlatformId).catch(() => null) || rawPlatformId;
                } else {
                    platformId = resolveTwitchLogin(rawPlatformId);
                }

                const config = await Notification.findOne({ serverId, platform, platformId });
                if (!config) {
                    return sendV2(interaction, cards.warning(
                        lang.setups.notifications.title,
                        lang.setups.notifications.notFound({ platform: platform.toUpperCase(), id: platformId })
                    ));
                }

                config.enabled = enabled;
                if (enabled) {
                    config.failCount = 0;
                    config.lastError = null;
                }
                await config.save();

                const statusText = enabled ? lang.setups.notifications.enabled : lang.setups.notifications.disabled;
                return sendV2(interaction, cards[enabled ? 'success' : 'warning'](
                    lang.setups.notifications.title,
                    lang.setups.notifications.toggled({ platform: platform.toUpperCase(), id: platformId, status: statusText })
                ));
            }

        } catch (error) {
            console.error('[Setup-Notifications] Error in setup-notifications command:', error);
            return sendV2(interaction, cards.error(lang.setups.notifications.title, lang.setups.notifications.error));
        }
    }
};
