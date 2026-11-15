

const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const os = require('os');
const moment = require('moment');
require('moment-duration-format');

const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const {
    buildCard,
    cards,
    btn,
    linkBtn,
    closeBtn,
    createSessionManager,
    replyUnauthorized,
    replyEphemeral,
    deferUpdate,
    deferReply,
    sendV2,
    editV2,
    closeAndAutoDelete,
    formatCommandLink,
    getRandomCategorySuggestions,
    cacheCommandIds,
} = require('../../UI');

const sessionManager = createSessionManager({
    onExpire: () => cards.expired(formatCommandLink('bot')),
});

function tabsRow(active) {
    const s = m => active === m ? ButtonStyle.Danger : ButtonStyle.Secondary;
    return new ActionRowBuilder().addComponents(
        btn(lang.bot.nav.overview, 'bot_tab_overview', 'home', s('overview')),
        btn(lang.bot.nav.stats, 'bot_tab_stats', 'analytics', s('stats')),
        btn(lang.bot.nav.status, 'bot_tab_status', 'security', s('status'))
    );
}

function allSubcommandSelect(current = null) {
    const opts = [
        { label: lang.bot.select.pingLabel, description: lang.bot.select.pingDesc, value: 'ping', emoji: getButtonEmoji('rocket'), default: current === 'ping' },
        { label: lang.bot.select.inviteLabel, description: lang.bot.select.inviteDesc, value: 'invite', emoji: getButtonEmoji('world'), default: current === 'invite' },
        { label: lang.bot.select.supportLabel, description: lang.bot.select.supportDesc, value: 'support', emoji: getButtonEmoji('chat'), default: current === 'support' },
        { label: lang.bot.select.statsLabel, description: lang.bot.select.statsDesc, value: 'stats', emoji: getButtonEmoji('analytics'), default: current === 'stats' },
        { label: lang.bot.select.uptimeLabel, description: lang.bot.select.uptimeDesc, value: 'uptime', emoji: getButtonEmoji('time'), default: current === 'uptime' },
        { label: lang.bot.select.versionLabel, description: lang.bot.select.versionDesc, value: 'version', emoji: getButtonEmoji('settings'), default: current === 'version' },
        { label: lang.bot.select.statusLabel, description: lang.bot.select.statusDesc, value: 'status', emoji: getButtonEmoji('security'), default: current === 'status' },
        { label: lang.bot.select.changelogLabel, description: lang.bot.select.changelogDesc, value: 'changelog', emoji: getButtonEmoji('list'), default: current === 'changelog' },
        { label: lang.bot.select.feedbackLabel, description: lang.bot.select.feedbackDesc, value: 'feedback', emoji: getButtonEmoji('smile'), default: current === 'feedback' },
        { label: lang.bot.select.privacyLabel, description: lang.bot.select.privacyDesc, value: 'privacy', emoji: getButtonEmoji('lock'), default: current === 'privacy' },
        { label: lang.bot.select.reportLabel, description: lang.bot.select.reportDesc, value: 'report', emoji: getButtonEmoji('warning'), default: current === 'report' }
    ];
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('bot_subcommand_select').setPlaceholder(lang.selectPlaceholder).addOptions(opts)
    );
}

function buildSubNavigationRow() {
    return new ActionRowBuilder().addComponents(
        linkBtn(lang.bot.nav.support, 'chat', 'https://discord.gg/xQF9f9yUEM'),
        linkBtn(lang.bot.nav.invite, 'world', 'https://discord.com/oauth2/authorize?client_id=1270691569225433150&permissions=8&integration_type=0&scope=bot+applications.commands'),
        closeBtn('bot', lang.bot.nav.close)
    );
}


function overviewSections(client, interaction) {
    const statusEmoji = client.presence?.status === 'online' ? getEmoji('tick') :
        client.presence?.status === 'idle' ? getEmoji('time') :
            client.presence?.status === 'dnd' ? getEmoji('cross') : getEmoji('mute');
    const up = process.uptime();
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
    const tips = getRandomCategorySuggestions(client, 'basic');

    return [
        `### ${getEmoji('bot')} ${lang.bot.content.overviewHeader}\n• ${lang.bot.content.overviewStatus}: ${statusEmoji} **${lang.bot.content.overviewOperational}**\n• ${lang.bot.content.overviewUptime}: **${h}h ${m}m ${s}s**\n• ${lang.bot.content.overviewPrefix}: \`!\` | ${lang.bot.content.overviewSlash}: \`/\``,
        `> ${lang.bot.content.overviewPrompt}`,
        `> **${getEmoji('help')} ${lang.categorySuggestions}:** ${tips}`
    ];
}

function pingSections(client, interaction) {
    const botLatency = interaction ? (Date.now() - interaction.createdTimestamp) : 50;
    const apiLatency = client.ws.ping;
    const tips = getRandomCategorySuggestions(client, 'basic');

    const botEval = botLatency < 100 ? lang.bot.content.pingExcellent : botLatency < 200 ? lang.bot.content.pingGood : lang.bot.content.pingNeedsOpt;
    const apiEval = apiLatency < 100 ? lang.bot.content.pingOptimal : apiLatency < 200 ? lang.bot.content.pingNormal : lang.bot.content.pingSlow;

    return [
        `### ${getEmoji('rocket')} ${lang.bot.content.pingHeader}\n${lang.bot.content.pingSub}`,
        `**${lang.bot.content.pingBot}**\n\`${botLatency}ms\` - ${botEval}`,
        `**${lang.bot.content.pingApi}**\n\`${apiLatency}ms\` - ${apiEval}`,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function inviteSections(client) {
    const inviteURL = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&integration_type=0&scope=bot+applications.commands`;
    const tips = getRandomCategorySuggestions(client, 'basic');
    return [
        `### ${getEmoji('world')} ${lang.bot.content.inviteHeader}\n${lang.bot.content.inviteSub}`,
        `**${lang.bot.content.inviteLinkHeader}**\n${inviteURL}`,
        `**${lang.bot.content.inviteIncludedHeader}**\n${lang.bot.content.inviteIncludedDetails}`,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function supportSections(client) {
    const tips = getRandomCategorySuggestions(client, 'basic');
    return [
        `### ${getEmoji('chat')} ${lang.bot.content.supportHeader}\n${lang.bot.content.supportSub}`,
        `• **${lang.bot.content.supportServer}**: https://discord.gg/xQF9f9yUEM\n• **${lang.bot.content.supportRepo}**: https://github.com/PonnalaShiva\n• **${lang.bot.content.supportSite}**: https://fluenosity.com`,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function statsSections(client) {
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const uptime = moment.duration(client.uptime).format("D[d] H[h] m[m] s[s]");
    const servers = client.guilds.cache.size;
    const users = client.users.cache.size;
    const channels = client.channels.cache.size;
    const tips = getRandomCategorySuggestions(client, 'basic');

    return [
        `### ${getEmoji('analytics')} ${lang.bot.content.statsHeader}\n${lang.bot.content.statsSub}`,
        `**${lang.bot.content.statsMemory}**: \`${memoryUsage} MB\` / \`${totalMemory} GB\`\n**${lang.bot.content.statsUptime}**: \`${uptime}\`\n**${lang.bot.content.statsNode}**: \`${process.version}\` on \`${os.platform()}\``,
        `**${lang.bot.content.statsReach}**\n• ${lang.bot.content.statsServers}: \`${servers.toLocaleString()}\` | ${lang.bot.content.statsUsers}: \`${users.toLocaleString()}\` | ${lang.bot.content.statsChannels}: \`${channels.toLocaleString()}\``,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function uptimeSections(client) {
    const uptimeMs = client.uptime;
    const uptime = moment.duration(uptimeMs).format("D[d] H[h] m[m] s[s]");
    const startTime = new Date(Date.now() - uptimeMs);
    const tips = getRandomCategorySuggestions(client, 'basic');
    return [
        `### ${getEmoji('time')} ${lang.bot.content.uptimeHeader}\n${lang.bot.content.uptimeSub}`,
        `**${lang.bot.content.uptimeSession}**: \`${uptime}\`\n**${lang.bot.content.uptimeInit}**: \`${startTime.toLocaleString()}\``,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function versionSections(client) {
    const tips = getRandomCategorySuggestions(client, 'basic');
    return [
        `### ${getEmoji('settings')} ${lang.bot.content.versionHeader}\n${lang.bot.content.versionSub}`,
        `• **${lang.bot.content.versionBot}**: \`v2.0.0\` (${lang.bot.content.versionReleaseType})\n• **${lang.bot.content.versionDiscord}**: \`v14.14.1\`\n• **${lang.bot.content.versionNode}**: \`${process.version}\` (${lang.bot.content.versionLts})\n• **${lang.bot.content.versionPlatform}**: \`${os.type()} (${os.arch()})\``,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function statusSections(client) {
    const statusMap = {
        online: { emoji: getEmoji('tick'), label: lang.bot.content.statusOnline },
        idle: { emoji: getEmoji('time'), label: lang.bot.content.statusIdle },
        dnd: { emoji: getEmoji('cross'), label: lang.bot.content.statusDnd },
        offline: { emoji: getEmoji('mute'), label: lang.bot.content.statusOffline }
    };
    const currentStatus = client.presence?.status || 'online';
    const statusInfo = statusMap[currentStatus] || statusMap.online;
    const tips = getRandomCategorySuggestions(client, 'basic');
    return [
        `### ${getEmoji('security')} ${lang.bot.content.statusHeader}\n${lang.bot.content.statusSub}`,
        `• ${lang.bot.content.overviewStatus}: ${statusInfo.emoji} **${statusInfo.label}**\n• ${lang.bot.content.statusDb}: ${getEmoji('tick')} **${lang.bot.content.statusConnected}**\n• ${lang.bot.content.statusLavalink}: ${getEmoji('tick')} **${lang.bot.content.statusLavalinkNodes}**\n• ${lang.bot.content.statusMusic}: ${getEmoji('tick')} **${lang.statusOperational}**\n• ${lang.bot.content.statusSecurity}: ${getEmoji('tick')} **${lang.bot.content.statusArmed}**`,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function changelogSections(client) {
    const tips = getRandomCategorySuggestions(client, 'basic');
    return [
        `### ${getEmoji('list')} ${lang.bot.content.changelogHeader}\n${lang.bot.content.changelogSub}`,
        `**${lang.bot.content.changelogUpgrades}**\n${lang.bot.content.changelogItems}`,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function feedbackSections(client) {
    const tips = getRandomCategorySuggestions(client, 'basic');
    return [
        `### ${getEmoji('smile')} ${lang.bot.content.feedbackHeader}\n${lang.bot.content.feedbackSub}`,
        `• **${lang.bot.content.feedbackPortal}**: https://discord.gg/xQF9f9yUEM\n• **${lang.bot.content.feedbackGuidelines}**: ${lang.bot.content.feedbackDetails}`,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function privacySections(client) {
    const tips = getRandomCategorySuggestions(client, 'basic');
    return [
        `### ${getEmoji('lock')} ${lang.bot.content.privacyHeader}\n${lang.bot.content.privacySub}`,
        `• **${lang.bot.content.privacyCollected}**: ${lang.bot.content.privacyCollectedVal}\n• **${lang.bot.content.privacyExclusions}**: ${lang.bot.content.privacyExclusionsVal}\n• **${lang.bot.content.privacyCompliance}**: ${lang.bot.content.privacyComplianceVal}`,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}

function reportSections(client) {
    const tips = getRandomCategorySuggestions(client, 'basic');
    return [
        `### ${getEmoji('warning')} ${lang.bot.content.reportHeader}\n${lang.bot.content.reportSub}`,
        `• **${lang.bot.content.reportTracker}**: https://github.com/PonnalaShiva/issues\n• **${lang.bot.content.reportReqs}**: ${lang.bot.content.reportReqsVal}\n• **${lang.bot.content.reportHunter}**: ${lang.bot.content.reportHunterVal}`,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
    ];
}


function renderState(client, state, isSlashCommand = true) {
    let title = '';
    let sections = [];
    let componentsList = [];

    switch (state.mode) {
        case 'ping':
            title = lang.bot.panel.pingTitle;
            sections = pingSections(client, state.interaction);
            componentsList = [tabsRow('overview'), allSubcommandSelect('ping'), buildSubNavigationRow()];
            break;
        case 'invite':
            title = lang.bot.panel.inviteTitle;
            sections = inviteSections(client);
            componentsList = [tabsRow('overview'), allSubcommandSelect('invite'), buildSubNavigationRow()];
            break;
        case 'support':
            title = lang.bot.panel.supportTitle;
            sections = supportSections(client);
            componentsList = [tabsRow('overview'), allSubcommandSelect('support'), buildSubNavigationRow()];
            break;
        case 'stats':
            title = lang.bot.panel.statsTitle;
            sections = statsSections(client);
            componentsList = [tabsRow('stats'), allSubcommandSelect('stats'), buildSubNavigationRow()];
            break;
        case 'uptime':
            title = lang.bot.panel.uptimeTitle;
            sections = uptimeSections(client);
            componentsList = [tabsRow('overview'), allSubcommandSelect('uptime'), buildSubNavigationRow()];
            break;
        case 'version':
            title = lang.bot.panel.versionTitle;
            sections = versionSections(client);
            componentsList = [tabsRow('overview'), allSubcommandSelect('version'), buildSubNavigationRow()];
            break;
        case 'status':
            title = lang.bot.panel.statusTitle;
            sections = statusSections(client);
            componentsList = [tabsRow('status'), allSubcommandSelect('status'), buildSubNavigationRow()];
            break;
        case 'changelog':
            title = lang.bot.panel.changelogTitle;
            sections = changelogSections(client);
            componentsList = [tabsRow('overview'), allSubcommandSelect('changelog'), buildSubNavigationRow()];
            break;
        case 'feedback':
            title = lang.bot.panel.feedbackTitle;
            sections = feedbackSections(client);
            componentsList = [tabsRow('overview'), allSubcommandSelect('feedback'), buildSubNavigationRow()];
            break;
        case 'privacy':
            title = lang.bot.panel.privacyTitle;
            sections = privacySections(client);
            componentsList = [tabsRow('overview'), allSubcommandSelect('privacy'), buildSubNavigationRow()];
            break;
        case 'report':
            title = lang.bot.panel.reportTitle;
            sections = reportSections(client);
            componentsList = [tabsRow('overview'), allSubcommandSelect('report'), buildSubNavigationRow()];
            break;
        default: 
            title = lang.bot.panel.overviewTitle;
            sections = overviewSections(client, state.interaction);
            componentsList = [
                tabsRow('overview'),
                allSubcommandSelect(),
                buildSubNavigationRow()
            ];
            break;
    }

    return [buildCard(title, sections, componentsList)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot')
        .setDescription('Bot related commands.')
        .addSubcommand(sub => sub.setName('ping').setDescription('Check bot latency and response time'))
        .addSubcommand(sub => sub.setName('invite').setDescription('Get invitation link to add bot to your server'))
        .addSubcommand(sub => sub.setName('support').setDescription('Join our support server for help and updates'))
        .addSubcommand(sub => sub.setName('stats').setDescription('View comprehensive bot statistics'))
        .addSubcommand(sub => sub.setName('uptime').setDescription('Check how long the bot has been running'))
        .addSubcommand(sub => sub.setName('version').setDescription('Display bot and environment version information'))
        .addSubcommand(sub => sub.setName('status').setDescription('Check current operational status'))
        .addSubcommand(sub => sub.setName('changelog').setDescription('View latest updates and changes'))
        .addSubcommand(sub => sub.setName('feedback').setDescription('Learn how to send feedback and suggestions'))
        .addSubcommand(sub => sub.setName('privacy').setDescription('View privacy policy and data handling'))
        .addSubcommand(sub => sub.setName('report').setDescription('Report bugs or issues')),

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('bot_')) return false;

        const messageId = interaction.message.id;
        const clickerId = interaction.user.id;
        const client = interaction.client;

        if (interaction.customId === 'bot_close') {
            const session = sessionManager.get(messageId);
            if (session && clickerId !== session.state.userId) {
                await replyUnauthorized(interaction, session.state.userId, 'bot');
                return true;
            }

            sessionManager.close(messageId);
            const closedCard = cards.closed(formatCommandLink('bot'));
            await closeAndAutoDelete(interaction, closedCard);
            return true;
        }

        const session = sessionManager.get(messageId);
        if (!session) {
            await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.sessionExpired}`);
            return true;
        }

        if (clickerId !== session.state.userId) {
            await replyUnauthorized(interaction, session.state.userId, 'bot');
            return true;
        }

        await deferUpdate(interaction);
        sessionManager.touch(client, interaction.channelId, messageId);
        await cacheCommandIds(client, interaction).catch(() => { });

        const { state } = session;
        const customId = interaction.customId;

        if (customId === 'bot_tab_overview') {
            state.mode = 'overview';
        } else if (customId === 'bot_tab_stats') {
            state.mode = 'stats';
        } else if (customId === 'bot_tab_status') {
            state.mode = 'status';
        } else if (customId === 'bot_subcommand_select') {
            state.mode = interaction.values[0] || 'overview';
        }

        try {
            const components = renderState(client, state, true);
            await editV2(interaction, components);
        } catch (err) {
            console.error('[Bot Component Error]:', err.message);
        }

        return true;
    },

    async execute(interaction) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        if (isSlash) {
            await deferReply(interaction);
        }

        const client = interaction.client;
        await cacheCommandIds(client, interaction).catch(() => { });

        const rawInput = isSlash
            ? (interaction.options.getSubcommand(false) || 'overview')
            : (String(interaction.content || '').split(' ').slice(1)[0] || 'overview');

        const userId = isSlash ? interaction.user.id : interaction.author.id;
        const state = {
            mode: rawInput.toLowerCase(),
            userId,
            interaction
        };

        try {
            const components = renderState(client, state, isSlash);
            const message = await sendV2(interaction, components);

            if (message?.id) {
                sessionManager.open(client, interaction.channelId, message.id, state);
            }
        } catch (err) {
            console.error('[Bot Initial Render Error]:', err.message);
            const errPayload = { content: lang.bot.error.loadFailed, components: [] };
            if (interaction.deferred || interaction.replied) {
                interaction.editReply(errPayload).catch(() => { });
            } else {
                interaction.reply(errPayload).catch(() => { });
            }
        }
    }
};