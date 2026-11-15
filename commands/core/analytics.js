const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const {
    ContainerBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');

const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const {
    createSessionManager,
    buildCard,
    cards,
    btn,
    linkBtn,
    paginationRow,
    ACCENT,
    formatCommandLink,
    getRandomCategorySuggestions,
    cacheCommandIds,
} = require('../../UI');

const sessionManager = createSessionManager({
    ttl: 10 * 60 * 1000,
    onExpire: (client, channelId, messageId, state) => {
        return cards.expired(formatCommandLink('analytics'));
    }
});

function tabsRow(activeMode) {
    const isOverview = activeMode === 'overview';
    const isMembers = ['members', 'growth', 'activity'].includes(activeMode);
    const isRoles = ['roles', 'channels', 'user'].includes(activeMode);

    return new ActionRowBuilder().addComponents(
        btn(lang.analytics.tabs.overview, 'analytics_tab_overview', 'analytics', isOverview ? ButtonStyle.Danger : ButtonStyle.Secondary),
        btn(lang.analytics.tabs.members, 'analytics_tab_members', 'groupusers', isMembers ? ButtonStyle.Danger : ButtonStyle.Secondary),
        btn(lang.analytics.tabs.roles, 'analytics_tab_roles', 'list', isRoles ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );
}

function allSubcommandSelect(current = null) {
    const opts = [
        { label: lang.analytics.select.options.overview, description: lang.analytics.select.options.overviewDesc, value: 'overview', emoji: getButtonEmoji('analytics'), default: current === 'overview' },
        { label: lang.analytics.select.options.members, description: lang.analytics.select.options.membersDesc, value: 'members', emoji: getButtonEmoji('groupusers'), default: current === 'members' },
        { label: lang.analytics.select.options.channels, description: lang.analytics.select.options.channelsDesc, value: 'channels', emoji: getButtonEmoji('folder'), default: current === 'channels' },
        { label: lang.analytics.select.options.activity, description: lang.analytics.select.options.activityDesc, value: 'activity', emoji: getButtonEmoji('time'), default: current === 'activity' },
        { label: lang.analytics.select.options.growth, description: lang.analytics.select.options.growthDesc, value: 'growth', emoji: getButtonEmoji('trend'), default: current === 'growth' },
        { label: lang.analytics.select.options.roles, description: lang.analytics.select.options.rolesDesc, value: 'roles', emoji: getButtonEmoji('list'), default: current === 'roles' },
        { label: lang.analytics.select.options.user, description: lang.analytics.select.options.userDesc, value: 'user', emoji: getButtonEmoji('user'), default: current === 'user' }
    ];
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('analytics_subcommand_select').setPlaceholder(lang.analytics.select.placeholder).addOptions(opts)
    );
}

function buildSubNavigationRow() {
    return new ActionRowBuilder().addComponents(
        linkBtn(lang.analytics.buttons.support, 'chat', 'https://discord.gg/xQF9f9yUEM'),
        linkBtn(lang.analytics.buttons.invite, 'world', 'https://discord.com/oauth2/authorize?client_id=1270691569225433150&permissions=8&integration_type=0&scope=bot+applications.commands'),
        btn(lang.analytics.buttons.close, 'analytics_close', 'stop', ButtonStyle.Danger)
    );
}

function buildPaginationRowComponent(page, totalPages) {
    return paginationRow(page, totalPages, {
        prevId: 'analytics_prev',
        nextId: 'analytics_next',
        closeId: 'analytics_close',
        prevLabel: lang.analytics.buttons.prev,
        nextLabel: lang.analytics.buttons.next,
        closeLabel: lang.analytics.buttons.close,
    });
}


function overviewSections(client, guild) {
    const members = guild.members.cache;
    const channels = guild.channels.cache;
    const roles = guild.roles.cache;

    const totalMembers = members.size || 1;
    const humans = members.filter(m => !m.user.bot).size;
    const bots = members.filter(m => m.user.bot).size;

    const online = members.filter(m => m.presence?.status === 'online').size;
    const idle = members.filter(m => m.presence?.status === 'idle').size;
    const dnd = members.filter(m => m.presence?.status === 'dnd').size;

    const activityRate = ((online + idle + dnd) / totalMembers * 100).toFixed(1);
    const botRatio = (bots / totalMembers * 100).toFixed(1);
    const serverAge = Math.floor((Date.now() - guild.createdTimestamp) / (1000 * 60 * 60 * 24)) || 1;
    const growthRate = (totalMembers / serverAge).toFixed(2);

    let healthScore = 0;
    if (activityRate > 70) healthScore += 30;
    else if (activityRate > 40) healthScore += 20;
    else healthScore += 10;

    if (botRatio < 10) healthScore += 20;
    else if (botRatio < 20) healthScore += 10;

    if (totalMembers > 1000) healthScore += 25;
    else if (totalMembers > 100) healthScore += 15;
    else healthScore += 5;

    if (growthRate > 5) healthScore += 25;
    else if (growthRate > 1) healthScore += 15;
    else healthScore += 5;

    const healthEmoji = (score) => {
        if (score >= 80) return getEmoji('crown');
        if (score >= 60) return getEmoji('tick');
        if (score >= 40) return getEmoji('warning');
        return getEmoji('cross');
    };

    const healthStatus = (score) => {
        if (score >= 80) return lang.analytics.health.excellent;
        if (score >= 60) return lang.analytics.health.good;
        if (score >= 40) return lang.analytics.health.average;
        return lang.analytics.health.needsAttention;
    };

    const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
    const forums = channels.filter(c => c.type === ChannelType.GuildForum).size;

    const recommendations = [];
    if (activityRate < 40) recommendations.push(`• ${lang.analytics.content.recHostEvents}`);
    if (botRatio > 20) recommendations.push(`• ${lang.analytics.content.recReviewBots}`);
    if (channels.size / totalMembers > 0.1) recommendations.push(`• ${lang.analytics.content.recConsolidateChannels}`);
    if (growthRate < 1) recommendations.push(`• ${lang.analytics.content.recIncreasePromo}`);
    if (guild.premiumTier < 2 && totalMembers > 100) recommendations.push(`• ${lang.analytics.content.recEncourageBoosts}`);
    if (roles.size < 5) recommendations.push(`• ${lang.analytics.content.recCreateRoles}`);

    const tips = getRandomCategorySuggestions(client, 'core');

    return [
        `### ${getEmoji('analytics')} ${lang.analytics.content.serverHealthHeader}\n• ${lang.analytics.content.score}: **${healthScore}/100 ${healthEmoji(healthScore)}**\n• ${lang.analytics.content.status}: **${healthStatus(healthScore)}**\n• ${lang.analytics.content.age}: **${serverAge} ${lang.analytics.content.days}**\n• ${lang.analytics.content.created}: <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
        `### ${getEmoji('analytics')} ${lang.analytics.content.kpiHeader}\n• ${lang.analytics.content.totalMembers}: **${totalMembers.toLocaleString()}** (${getEmoji('user')} ${lang.analytics.content.humans}: ${humans} | ${getEmoji('bot')} ${lang.analytics.content.bots}: ${bots} - ${botRatio}%)\n• ${lang.analytics.content.activityRate}: **${activityRate}%** ${activityRate > 50 ? getEmoji('fire') : activityRate > 30 ? getEmoji('tick') : getEmoji('warning')}\n• ${lang.analytics.content.dailyGrowth}: **${growthRate} ${lang.analytics.content.membersPerDay}**\n• ${lang.analytics.content.presence}: ${lang.analytics.content.online}: **${online}** | ${lang.analytics.content.idle}: **${idle}** | ${lang.analytics.content.dnd}: **${dnd}**`,
        `### ${getEmoji('settings')} ${lang.analytics.content.infrastructureHeader}\n• ${lang.analytics.content.channels}: **${channels.size}** (${getEmoji('chat')} ${lang.analytics.content.text}: ${textChannels} | ${getEmoji('voice')} ${lang.analytics.content.voice}: ${voiceChannels} | ${getEmoji('folder')} ${lang.analytics.content.categories}: ${categories} | ${getEmoji('document')} ${lang.analytics.content.forums}: ${forums})\n• ${lang.analytics.content.roles}: **${roles.size}** ${lang.analytics.content.customRoles}\n• ${lang.analytics.content.boosts}: **${guild.premiumSubscriptionCount || 0}** (${lang.analytics.content.tier} ${guild.premiumTier})\n• ${lang.analytics.content.ratio}: **${(totalMembers / channels.size).toFixed(1)}** ${lang.analytics.content.membersPerChannel}`,
        `### ${getEmoji('sparkles')} ${lang.analytics.content.recommendationsHeader}\n${recommendations.length > 0 ? recommendations.join('\n') : `${getEmoji('tick')} ${lang.analytics.content.serverWellOptimized}`}\n\n*${getEmoji('warning')} ${lang.analytics.content.analyticsNotice}*\n\n> **${getEmoji('info')} ${lang.analytics.content.tip}:** ${tips}`
    ];
}

function membersSections(client, guild) {
    const members = guild.members.cache;
    const totalMembers = members.size || 1;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const joinedToday = members.filter(m => (now - m.joinedTimestamp) < day).size;
    const joinedWeek = members.filter(m => (now - m.joinedTimestamp) < 7 * day).size;
    const joinedMonth = members.filter(m => (now - m.joinedTimestamp) < 30 * day).size;

    const newAccounts = members.filter(m => (now - m.user.createdTimestamp) < 7 * day).size;
    const youngAccounts = members.filter(m => (now - m.user.createdTimestamp) < 30 * day).size;
    const oldAccounts = members.filter(m => (now - m.user.createdTimestamp) > 365 * day).size;

    const online = members.filter(m => m.presence?.status === 'online').size;
    const idle = members.filter(m => m.presence?.status === 'idle').size;
    const dnd = members.filter(m => m.presence?.status === 'dnd').size;

    const activityRate = ((online + idle + dnd) / totalMembers * 100).toFixed(1);

    return [
        `### ${getEmoji('groupusers')} ${lang.analytics.content.demographicsHeader}\n• ${lang.analytics.content.totalAccounts}: **${totalMembers.toLocaleString()}**\n• ${lang.analytics.content.humans}: **${members.filter(m => !m.user.bot).size}**\n• ${lang.analytics.content.bots}: **${members.filter(m => m.user.bot).size}**\n• ${lang.analytics.content.assignments}: **${(guild.roles.cache.size / totalMembers).toFixed(2)}** ${lang.analytics.content.rolesPerMember}`,
        `### ${getEmoji('trend')} ${lang.analytics.content.recentJoinMetricsHeader}\n• ${lang.analytics.content.today}: **+${joinedToday}** ${lang.analytics.content.newUsers}\n• ${lang.analytics.content.thisWeek}: **+${joinedWeek}**\n• ${lang.analytics.content.thisMonth}: **+${joinedMonth}**\n• ${lang.analytics.content.growthSpeed}: **${(joinedWeek / 7).toFixed(1)}/day** (${lang.analytics.content.monthlyRate}: **${((joinedMonth / totalMembers) * 100).toFixed(2)}%**)`,
        `### ${getEmoji('security')} ${lang.analytics.content.accountMaturityHeader}\n• ${lang.analytics.content.newAccounts}: **${newAccounts}** (${(newAccounts / totalMembers * 100).toFixed(1)}%)\n• ${lang.analytics.content.youngAccounts}: **${youngAccounts}**\n• ${lang.analytics.content.establishedUsers}: **${oldAccounts}**\n• ${lang.analytics.content.securityRiskLevel}: **${newAccounts > totalMembers * 0.1 ? `${getEmoji('warning')} ${lang.analytics.content.riskHigh}` : `${getEmoji('tick')} ${lang.analytics.content.riskLow}`}**\n• ${lang.analytics.content.maturityScore}: **${((oldAccounts / totalMembers) * 100).toFixed(1)}/100**`,
        `### ${getEmoji('sparkles')} ${lang.analytics.content.currentActivityStateHeader}\n• ${lang.analytics.content.active}: **${online + idle + dnd}** ${lang.analytics.content.usersOnline} (${lang.analytics.content.online}: ${online} | ${lang.analytics.content.idle}: ${idle} | ${lang.analytics.content.dnd}: ${dnd})\n• ${lang.analytics.content.offline}: **${totalMembers - online - idle - dnd}** ${lang.analytics.content.accounts}\n• ${lang.analytics.content.engagementLevel}: **${activityRate > 70 ? `${getEmoji('fire')} ${lang.analytics.content.ratingExcellent}` : activityRate > 50 ? `${getEmoji('tick')} ${lang.analytics.content.ratingGood}` : activityRate > 30 ? `${getEmoji('warning')} ${lang.analytics.content.ratingAverage}` : `${getEmoji('cross')} ${lang.analytics.content.ratingLow}`}**`
    ];
}

function channelsSections(client, guild) {
    const channels = guild.channels.cache;

    const text = channels.filter(c => c.type === ChannelType.GuildText);
    const voice = channels.filter(c => c.type === ChannelType.GuildVoice);
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory);
    const forums = channels.filter(c => c.type === ChannelType.GuildForum);
    const announcements = channels.filter(c => c.type === ChannelType.GuildAnnouncement);

    const activeVoice = voice.filter(c => c.members && c.members.size > 0);
    const totalVoiceUsers = activeVoice.reduce((acc, c) => acc + c.members.size, 0);

    const mainSections = [
        `### ${getEmoji('folder')} ${lang.analytics.content.channelDistributionHeader}\n• ${lang.analytics.content.totalChannels}: **${channels.size}**\n• ${lang.analytics.content.textChannels}: **${text.size}**\n• ${lang.analytics.content.voiceChannels}: **${voice.size}**\n• ${lang.analytics.content.categories}: **${categories.size}**\n• ${lang.analytics.content.announcementChannels}: **${announcements.size}**\n• ${lang.analytics.content.forumChannels}: **${forums.size}**`,
        `### ${getEmoji('voice')} ${lang.analytics.content.voiceUsageHeader}\n• ${lang.analytics.content.activeRooms}: **${activeVoice.size}/${voice.size}**\n• ${lang.analytics.content.usersInVoice}: **${totalVoiceUsers}**\n• ${lang.analytics.content.roomUtilization}: **${voice.size > 0 ? (activeVoice.size / voice.size * 100).toFixed(1) : 0}%**`
    ];

    if (activeVoice.size > 0) {
        const voiceList = activeVoice.map(c => `• ${getEmoji('mic')} **${c.name}** — **${c.members.size}** ${c.members.size > 1 ? lang.analytics.content.userPlural : lang.analytics.content.userSingle}').slice(0, 10).join('\n`);
        mainSections.push(`### ${getEmoji('mic')} ${lang.analytics.content.activeChannelsDetailHeader}\n${voiceList}`);
    }

    return mainSections;
}

function activitySections(client, guild) {
    const members = guild.members.cache;

    const online = members.filter(m => m.presence?.status === 'online');
    const idle = members.filter(m => m.presence?.status === 'idle');
    const dnd = members.filter(m => m.presence?.status === 'dnd');
    const offlineCount = members.size - online.size - idle.size - dnd.size;

    const createBar = (value, max, length = 20) => {
        const filled = Math.round((value / max) * length);
        return '█'.repeat(filled) + '░'.repeat(length - filled);
    };

    const maxStatus = Math.max(online.size, idle.size, dnd.size, offlineCount) || 1;
    const total = members.size || 1;

    const statusMap = [
        `${getEmoji('tick')} **${lang.analytics.content.online}:** ${online.size} (${(online.size / total * 100).toFixed(1)}%)\n\`${createBar(online.size, maxStatus)}\``,
        `${getEmoji('time')} **${lang.analytics.content.idle}:** ${idle.size} (${(idle.size / total * 100).toFixed(1)}%)\n\`${createBar(idle.size, maxStatus)}\``,
        `${getEmoji('cross')} **${lang.analytics.content.dnd}:** ${dnd.size} (${(dnd.size / total * 100).toFixed(1)}%)\n\`${createBar(dnd.size, maxStatus)}\``,
        `${getEmoji('mute')} **${lang.analytics.content.offline}:** ${offlineCount} (${(offlineCount / total * 100).toFixed(1)}%)\n\`${createBar(offlineCount, maxStatus)}\``
    ].join('\n\n');

    const activeMembers = online.size + idle.size + dnd.size;
    const activityRate = (activeMembers / total * 100).toFixed(1);

    return [
        `### ${getEmoji('time')} ${lang.analytics.content.statusDistributionHeader}\n\n${statusMap}`,
        `### ${getEmoji('sparkles')} ${lang.analytics.content.engagementInsightsHeader}\n• ${lang.analytics.content.activityRate}: **${activityRate}%**\n• ${lang.analytics.content.activeMembers}: **${activeMembers}/${members.size}**\n• ${lang.analytics.content.rating}: **${activityRate > 70 ? `${getEmoji('fire')} ${lang.analytics.content.ratingExcellent}` : activityRate > 50 ? `${getEmoji('tick')} ${lang.analytics.content.ratingGood}` : activityRate > 30 ? `${getEmoji('warning')} ${lang.analytics.content.ratingAverage}` : `${getEmoji('cross')} ${lang.analytics.content.ratingLow}`}**`
    ];
}

function growthSections(client, guild) {
    const members = guild.members.cache;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const periods = {
        '1d': members.filter(m => (now - m.joinedTimestamp) < day).size,
        '7d': members.filter(m => (now - m.joinedTimestamp) < 7 * day).size,
        '30d': members.filter(m => (now - m.joinedTimestamp) < 30 * day).size,
        '90d': members.filter(m => (now - m.joinedTimestamp) < 90 * day).size,
    };

    const dailyAvg = (periods['7d'] / 7).toFixed(1);
    const weeklyAvg = (periods['30d'] / 4.3).toFixed(1);
    const serverAge = Math.floor((now - guild.createdTimestamp) / day) || 1;

    const projection30 = Math.round(dailyAvg * 30);

    return [
        `### ${getEmoji('trend')} ${lang.analytics.content.historicalGrowthHeader}\n• ${lang.analytics.content.currentSize}: **${members.size.toLocaleString()}**\n• ${lang.analytics.content.serverAge}: **${serverAge} ${lang.analytics.content.days}**\n\n• ${lang.analytics.content.last24Hours}: **+${periods['1d']}**\n• ${lang.analytics.content.last7Days}: **+${periods['7d']}**\n• ${lang.analytics.content.last30Days}: **+${periods['30d']}**\n• ${lang.analytics.content.last90Days}: **+${periods['90d']}**`,
        `### ${getEmoji('analytics')} ${lang.analytics.content.averageRatesHeader}\n• ${lang.analytics.content.dailySpeed}: **${dailyAvg} ${lang.analytics.content.membersPerDay}**\n• ${lang.analytics.content.weeklySpeed}: **${weeklyAvg} ${lang.analytics.content.membersPerWeek}**\n• ${lang.analytics.content.monthlyGrowthRate}: **${((periods['30d'] / (members.size || 1)) * 100).toFixed(2)}%**`,
        `### ${getEmoji('sparkles')} ${lang.analytics.content.projectionsHeader}\n• ${lang.analytics.content.projectedJoins}: **+${projection30}** ${lang.analytics.content.membersCount}\n• ${lang.analytics.content.projectedTotalSize}: **${(members.size + projection30).toLocaleString()}**\n• ${lang.analytics.content.trend}: **${periods['7d'] > periods['1d'] * 7 ? `${getEmoji('trend')} ${lang.analytics.content.trendAccelerating}` : lang.analytics.content.trendSlowing}**`
    ];
}

function rolesSections(guild, state) {
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone').sort((a, b) => b.members.size - a.members.size);
    const totalAssignments = roles.reduce((acc, r) => acc + r.members.size, 0);
    const totalMembers = guild.members.cache.size || 1;
    const avgPerMember = (totalAssignments / totalMembers).toFixed(1);
    const coverage = (roles.size / totalMembers * 100).toFixed(2);

    const totalPages = Math.ceil(roles.size / 15) || 1;
    state.totalPages = totalPages;
    state.page = Math.min(Math.max(0, state.page), totalPages - 1);

    const start = state.page * 15;
    const pageRoles = Array.from(roles.values()).slice(start, start + 15);

    const createBar = (value, max, length = 15) => {
        const filled = Math.round((value / max) * length);
        return '█'.repeat(filled) + '░'.repeat(length - filled);
    };

    const roleList = pageRoles.map((role, i) => {
        const pct = (role.members.size / totalMembers * 100).toFixed(1);
        const bar = createBar(role.members.size, totalMembers, 15);
        return `${start + i + 1}. **${role.name}**\n   ├─ ${role.members.size} members (${pct}%)\n   └─ \`${bar}\``;
    }).join('\n\n');

    const headerTitle = lang.analytics.content.rolesListHeader.replace('{page}', state.page + 1).replace('{total}', totalPages);
    return [
        `### ${getEmoji('list')} ${lang.analytics.content.roleOverviewHeader}\n• ${lang.analytics.content.totalRoles}: **${roles.size}**\n• ${lang.analytics.content.totalAssignments}: **${totalAssignments.toLocaleString()}**\n• ${lang.analytics.content.avgPerMember}: **${avgPerMember}**\n• ${lang.analytics.content.coverage}: **${coverage}%**`,
        `### ${getEmoji('crown')} ${headerTitle}\n\n${roleList || lang.analytics.content.noRolesDefined}`
    ];
}

async function userSections(client, guild, state) {
    const targetId = state.targetUserId || state.userId;
    const target = await client.users.fetch(targetId).catch(() => null);
    if (!target) {
        return [`### ${getEmoji('warning')} ${lang.analytics.error.userNotFoundTitle}\n${lang.analytics.error.userNotFoundDesc.replace('{userId}', targetId)}`];
    }
    const member = guild.members.cache.get(targetId) || await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
        return [`### ${getEmoji('warning')} ${lang.analytics.error.userNotInServerTitle}\n${lang.analytics.error.userNotInServerDesc.replace('{username}', target.username)}`];
    }

    const joinPos = guild.members.cache
        .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
        .map(m => m.id)
        .indexOf(member.id) + 1;

    const daysSinceJoin = Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24));
    const accountAge = Math.floor((Date.now() - target.createdTimestamp) / (1000 * 60 * 60 * 24));

    const presenceStatus = member.presence?.status || 'offline';
    const statusMap = {
        online: lang.statusOnline,
        idle: lang.statusIdle,
        dnd: lang.statusDnd,
        offline: lang.statusOffline
    };
    const statusLabel = statusMap[presenceStatus] || presenceStatus;
    const activePresence = member.presence?.activities[0]?.name || lang.analytics.content.none;

    const targetTitle = lang.analytics.content.targetMemberHeader.replace('{member}', member.displayName);
    const createdAgo = lang.analytics.content.daysAgo.replace('{days}', accountAge);
    const joinedAgo = lang.analytics.content.daysAgo.replace('{days}', daysSinceJoin);

    return [
        `### ${getEmoji('user')} ${targetTitle}\n• ${lang.analytics.content.tag}: **${target.username}**\n• ${lang.analytics.content.userId}: \`${target.id}\`\n• ${lang.analytics.content.botAccount}: **${target.bot ? lang.analytics.content.yes : lang.analytics.content.no}**`,
        `### ${getEmoji('calendar')} ${lang.analytics.content.joinDetailsHeader}\n• ${lang.analytics.content.created}: **${target.createdAt.toLocaleDateString()}** (${createdAgo})\n• ${lang.analytics.content.joinedGuild}: **${member.joinedAt.toLocaleDateString()}** (${joinedAgo})\n• ${lang.analytics.content.joinPosition}: **#${joinPos}** ${lang.analytics.content.of} **${guild.members.cache.size}**`,
        `### ${getEmoji('list')} ${lang.analytics.content.rolesCapabilitiesHeader}\n• ${lang.analytics.content.highestRole}: **${member.roles.highest.name}**\n• ${lang.analytics.content.assignedRoles}: **${member.roles.cache.size - 1}**\n• ${lang.analytics.content.serverAdministrator}: **${member.permissions.has(PermissionFlagsBits.Administrator) ? `${getEmoji('tick')} ${lang.analytics.content.yes}` : `${getEmoji('cross')} ${lang.analytics.content.no}`}**\n• ${lang.analytics.content.moderatorPermissions}: **${member.permissions.has(PermissionFlagsBits.ManageMessages) ? `${getEmoji('tick')} ${lang.analytics.content.yes}` : `${getEmoji('cross')} ${lang.analytics.content.no}`}**`,
        `### ${getEmoji('time')} ${lang.analytics.content.presenceStatusHeader}\n• ${lang.analytics.content.currentStatus}: **${statusLabel}**\n• ${lang.analytics.content.activePresence}: **${activePresence}**`
    ];
}


async function renderState(client, guild, state, isSlashCommand = true) {
    let title = '';
    let sections = [];
    let componentsList = [];
    let thumbnailURL = null;
    let isPaginated = false;
    let accentColor = ACCENT.primary;

    state.totalPages = 1;

    switch (state.mode) {
        case 'members':
            title = lang.analytics.titles.members;
            sections = membersSections(client, guild);
            accentColor = ACCENT.success;
            break;
        case 'channels':
            title = lang.analytics.titles.channels;
            sections = channelsSections(client, guild);
            accentColor = ACCENT.warning;
            break;
        case 'activity':
            title = lang.analytics.titles.activity;
            sections = activitySections(client, guild);
            accentColor = ACCENT.primary;
            break;
        case 'growth':
            title = lang.analytics.titles.growth;
            sections = growthSections(client, guild);
            accentColor = ACCENT.success;
            break;
        case 'roles':
            title = lang.analytics.titles.roles;
            sections = rolesSections(guild, state);
            accentColor = 0x9B59B6;
            isPaginated = true;
            break;
        case 'user':
            title = lang.analytics.titles.user;
            sections = await userSections(client, guild, state);
            accentColor = ACCENT.primary;
            break;
        case 'overview':
        default:
            state.mode = 'overview';
            title = lang.analytics.titles.overview;
            sections = overviewSections(client, guild);
            thumbnailURL = guild.iconURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
            accentColor = ACCENT.primary;
            break;
    }

    let bottomRow;
    if (isPaginated && state.totalPages > 1) {
        bottomRow = buildPaginationRowComponent(state.page, state.totalPages);
    } else {
        bottomRow = buildSubNavigationRow();
    }

    componentsList = [
        tabsRow(state.mode),
        allSubcommandSelect(state.mode),
        bottomRow
    ];

    return [buildCard(title, sections, componentsList, accentColor, thumbnailURL)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analytics')
        .setDescription('Advanced server analytics and insights')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        
        .addSubcommand(sub => sub
            .setName('overview')
            .setDescription('Complete server overview with insights'))
        
        .addSubcommand(sub => sub
            .setName('members')
            .setDescription('Detailed member analytics'))
        
        .addSubcommand(sub => sub
            .setName('channels')
            .setDescription('Channel performance analysis'))
        
        .addSubcommand(sub => sub
            .setName('activity')
            .setDescription('Activity heatmap and patterns'))
        
        .addSubcommand(sub => sub
            .setName('growth')
            .setDescription('Growth tracking with predictions'))
        
        .addSubcommand(sub => sub
            .setName('roles')
            .setDescription('Complete role distribution'))
        
        .addSubcommand(sub => sub
            .setName('user')
            .setDescription('User profile analysis')
            .addUserOption(opt => opt
                .setName('target')
                .setDescription('User to analyze')
                .setRequired(false))),

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('analytics_')) return false;

        const messageId = interaction.message.id;
        const clickerId = interaction.user.id;
        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) {
            return interaction.reply({ content: lang.analytics.error.guildContextMissing, flags: MessageFlags.Ephemeral }).catch(() => { });
        }

        if (interaction.customId === 'analytics_close') {
            const session = sessionManager.get(messageId);
            if (session && clickerId !== session.state.userId) {
                await interaction.reply({
                    content: lang.analytics.error.unauthorized.replace('{userId}', session.state.userId),
                    flags: MessageFlags.Ephemeral,
                }).catch(() => { });
                return true;
            }

            try { await interaction.deferUpdate(); } catch { return true; }
            sessionManager.close(messageId);

            const closed = cards.closed(formatCommandLink('analytics'));
            await interaction.message.edit({ components: [closed], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
            setTimeout(() => {
                interaction.message.delete().catch(() => {});
            }, 2000);
            return true;
        }

        const session = sessionManager.get(messageId);
        if (!session) {
            await interaction.reply({
                content: lang.analytics.error.sessionExpiredNotice.replace('{emoji}', getEmoji('warning')),
                flags: MessageFlags.Ephemeral,
            }).catch(() => { });
            return true;
        }

        if (clickerId !== session.state.userId) {
            await interaction.reply({
                content: lang.analytics.error.unauthorized.replace('{userId}', session.state.userId),
                flags: MessageFlags.Ephemeral,
            }).catch(() => { });
            return true;
        }

        try {
            await interaction.deferUpdate();
        } catch {
            return true;
        }

        sessionManager.touch(client, interaction.channelId, messageId);
        await cacheCommandIds(client, interaction).catch(() => { });

        const { state } = session;
        const customId = interaction.customId;

        if (customId === 'analytics_tab_overview') {
            state.mode = 'overview';
            state.page = 0;
        } else if (customId === 'analytics_tab_members') {
            state.mode = 'members';
            state.page = 0;
        } else if (customId === 'analytics_tab_roles') {
            state.mode = 'roles';
            state.page = 0;
        } else if (customId === 'analytics_subcommand_select') {
            state.mode = interaction.values[0] || 'overview';
            state.page = 0;
        } else if (customId === 'analytics_prev') {
            state.page = Math.max(0, state.page - 1);
        } else if (customId === 'analytics_next') {
            state.page = state.page + 1;
        }

        try {
            const components = await renderState(client, guild, state, true);
            await interaction.message.edit({ components, flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error('[Analytics Component Error]:', err.message);
        }

        return true;
    },

    async execute(interaction) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
        } catch (err) {
            console.error('[Analytics] deferReply failed:', err.message);
            return;
        }

        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) {
            const errorContainer = cards.error(lang.analytics.error.serverRequiredTitle, lang.analytics.error.serverRequiredDesc);
            const payload = { components: [errorContainer], flags: MessageFlags.IsComponentsV2 };
            if (isSlash) {
                await interaction.editReply(payload).catch(() => { });
            } else {
                await interaction.reply(payload).catch(() => { });
            }
            return;
        }

        await cacheCommandIds(client, interaction).catch(() => { });

        const subcommand = isSlash ? (interaction.options.getSubcommand(false) || 'overview') : 'overview';
        const rawInput = isSlash
            ? subcommand
            : (String(interaction.content || '').split(' ').slice(1)[0] || 'overview');

        let targetUser = null;
        if (isSlash) {
            targetUser = interaction.options.getUser('target');
        } else {
            const args = String(interaction.content || '').split(' ').slice(2);
            if (args[0]) {
                const mentionMatch = args[0].match(/^<@!?(\d+)>$/);
                const targetId = mentionMatch ? mentionMatch[1] : args[0];
                targetUser = await client.users.fetch(targetId).catch(() => null);
            }
        }

        const userId = isSlash ? interaction.user.id : interaction.author.id;
        const state = {
            mode: rawInput.toLowerCase(),
            userId,
            targetUserId: targetUser ? targetUser.id : null,
            page: 0,
            totalPages: 1,
            interaction
        };

        try {
            const components = await renderState(client, guild, state, isSlash);
            const payload = { components, flags: MessageFlags.IsComponentsV2 };

            const message = (interaction.deferred || interaction.replied)
                ? await interaction.editReply(payload)
                : await interaction.reply({ ...payload, fetchReply: true });

            if (message) {
                sessionManager.open(client, interaction.channelId, message.id, state);
            }
        } catch (err) {
            console.error('[Analytics Initial Render Error]:', err.message);
            const errPayload = { content: lang.analytics.error.loadFailed, components: [] };
            if (interaction.deferred || interaction.replied) {
                interaction.editReply(errPayload).catch(() => { });
            } else {
                interaction.reply(errPayload).catch(() => { });
            }
        }
    }
};
