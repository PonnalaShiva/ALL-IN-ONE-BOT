'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    ChannelType,
    GuildVerificationLevel,
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
    paginationRow,
    createSessionManager,
    replyUnauthorized,
    replyEphemeral,
    deferUpdate,
    deferReply,
    sendV2,
    editV2,
    closeAndAutoDelete,
    getRandomCategorySuggestions,
    chunkArray,
    formatCommandLink,
    cacheCommandIds
} = require('../../UI');

const sessionManager = createSessionManager({
    onExpire: () => cards.expired(formatCommandLink('server')),
});


function tabsRow(active) {
    const s = m => active === m ? ButtonStyle.Danger : ButtonStyle.Secondary;
    return new ActionRowBuilder().addComponents(
        btn(lang.server.nav.overview, 'server_tab_info', 'home', s('info')),
        btn(lang.server.nav.roles, 'server_tab_roles', 'list', s('roles')),
        btn(lang.server.nav.emojis, 'server_tab_emojis', 'smile', s('emojis'))
    );
}

function allSubcommandSelect(current = null) {
    const opts = [
        { label: lang.server.select.infoLabel, description: lang.server.select.infoDesc, value: 'info', emoji: getButtonEmoji('home'), default: current === 'info' },
        { label: lang.server.select.iconLabel, description: lang.server.select.iconDesc, value: 'icon', emoji: getButtonEmoji('star'), default: current === 'icon' },
        { label: lang.server.select.bannerLabel, description: lang.server.select.bannerDesc, value: 'banner', emoji: getButtonEmoji('sparkles'), default: current === 'banner' },
        { label: lang.server.select.membercountLabel, description: lang.server.select.membercountDesc, value: 'membercount', emoji: getButtonEmoji('groupusers'), default: current === 'membercount' },
        { label: lang.server.select.rolesLabel, description: lang.server.select.rolesDesc, value: 'roles', emoji: getButtonEmoji('list'), default: current === 'roles' },
        { label: lang.server.select.emojisLabel, description: lang.server.select.emojisDesc, value: 'emojis', emoji: getButtonEmoji('smile'), default: current === 'emojis' },
        { label: lang.server.select.channelsLabel, description: lang.server.select.channelsDesc, value: 'channels', emoji: getButtonEmoji('folder'), default: current === 'channels' },
        { label: lang.server.select.boostsLabel, description: lang.server.select.boostsDesc, value: 'boosts', emoji: getButtonEmoji('rocket'), default: current === 'boosts' },
        { label: lang.server.select.regionLabel, description: lang.server.select.regionDesc, value: 'region', emoji: getButtonEmoji('world'), default: current === 'region' },
        { label: lang.server.select.verificationLabel, description: lang.server.select.verificationDesc, value: 'verification', emoji: getButtonEmoji('security'), default: current === 'verification' },
        { label: lang.server.select.featuresLabel, description: lang.server.select.featuresDesc, value: 'features', emoji: getButtonEmoji('settings'), default: current === 'features' }
    ];
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('server_subcommand_select').setPlaceholder(lang.selectPlaceholder).addOptions(opts)
    );
}

function buildSubNavigationRow() {
    return new ActionRowBuilder().addComponents(
        linkBtn(lang.server.nav.support, 'chat', 'https://discord.gg/xQF9f9yUEM'),
        linkBtn(lang.server.nav.invite, 'world', 'https://discord.com/oauth2/authorize?client_id=1270691569225433150&permissions=8&integration_type=0&scope=bot+applications.commands'),
        closeBtn('server', lang.server.nav.close)
    );
}


function infoSections(server) {
    const ownerId = server.ownerId;
    const emojisCount = server.emojis?.cache?.size || 0;
    const rolesCount = typeof server.roles?.cache?.filter === 'function' ? server.roles.cache.filter(role => role.id !== server.id).size : (server.roles?.cache?.size || 0);
    const channelsCount = server.channels?.cache?.size || 0;
    const textChannels = server.channels?.cache ? server.channels.cache.filter(c => c.type === ChannelType.GuildText).size : 0;
    const voiceChannels = server.channels?.cache ? server.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size : 0;
    const categoriesCount = server.channels?.cache ? server.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size : 0;

    const boostCount = server.premiumSubscriptionCount || 0;
    const boostLevel = server.premiumTier || 0;

    return [
        `### ${getEmoji('home')} ${lang.server.content.analyticsHeader}\n• ${lang.server.content.name}: **${server.name}**\n• ${lang.server.content.owner}: <@${ownerId}>\n• ${lang.server.content.members}: **${(server.memberCount || 0).toLocaleString()}**\n• ${lang.server.content.boostLevel}: **${lang.server.content.tier} ${boostLevel}** (${boostCount} ${lang.server.content.boosts})\n• ${lang.server.content.created}: <t:${Math.floor((server.createdTimestamp || Date.now()) / 1000)}:R>`,
        `### ${getEmoji('folder')} ${lang.server.content.architectureHeader}\n• ${lang.server.content.channels}: **${channelsCount}** (${categoriesCount} ${lang.server.content.categories}, ${textChannels} ${lang.server.content.text}, ${voiceChannels} ${lang.server.content.voice})\n• ${lang.server.content.roles}: **${rolesCount}** ${lang.server.content.customRoles}\n• ${lang.server.content.emojis}: **${emojisCount}** ${lang.server.content.expressions}\n• ${lang.server.content.verification}: **${server.verificationLevel}**`
    ];
}

function iconSections(server) {
    const iconURL = typeof server.iconURL === 'function' ? server.iconURL({ format: 'png', dynamic: true, size: 1024 }) : null;
    if (!iconURL) {
        return [`### ${getEmoji('warning')} ${lang.server.content.iconHeader}\n${lang.server.content.iconNone}`];
    }
    const isAnimated = typeof server.iconURL === 'function' ? server.iconURL({ dynamic: true }) !== server.iconURL({ dynamic: false }) : false;
    const pngUrl = typeof server.iconURL === 'function' ? server.iconURL({ format: 'png', size: 1024 }) : '#';
    const webpUrl = typeof server.iconURL === 'function' ? server.iconURL({ format: 'webp', size: 1024 }) : '#';
    const gifUrl = (isAnimated && typeof server.iconURL === 'function') ? server.iconURL({ format: 'gif', size: 1024 }) : '#';
    return [
        `### ${getEmoji('star')} ${lang.server.content.iconHeader}\n• ${lang.server.content.resolution}: **1024x1024 px**\n• ${lang.server.content.format}: **${isAnimated ? lang.server.content.animatedGif : lang.server.content.staticPng}**\n\n**${lang.server.content.downloads}**\n[${lang.server.content.pngFormat}](${pngUrl}) | [${lang.server.content.webpFormat}](${webpUrl}) ${isAnimated ? `| [${lang.server.content.gifFormat}](${gifUrl})` : ''}`
    ];
}

function bannerSections(server) {
    const bannerURL = typeof server.bannerURL === 'function' ? server.bannerURL({ format: 'png', dynamic: true, size: 1024 }) : null;
    if (!bannerURL) {
        const boostsNeeded = server.premiumTier < 2 ? (15 - (server.premiumSubscriptionCount || 0)) : 0;
        return [
            `### ${getEmoji('warning')} ${lang.server.content.bannerHeader}\n${lang.server.content.bannerNone}\n• ${lang.server.content.requirements}: **${lang.server.content.boostTier2}**\n• ${lang.server.content.currentLevel}: **${lang.server.content.tier} ${server.premiumTier}**\n• ${lang.server.content.boostsNeeded}: **${boostsNeeded}**`
        ];
    }
    const pngBanner = typeof server.bannerURL === 'function' ? server.bannerURL({ format: 'png', size: 1024 }) : '#';
    const webpBanner = typeof server.bannerURL === 'function' ? server.bannerURL({ format: 'webp', size: 1024 }) : '#';
    const jpgBanner = typeof server.bannerURL === 'function' ? server.bannerURL({ format: 'jpg', size: 1024 }) : '#';
    return [
        `### ${getEmoji('sparkles')} ${lang.server.content.bannerHeader}\n• ${lang.server.content.resolution}: **1920x1080 px**\n• ${lang.server.content.bannerStatus}\n\n**${lang.server.content.downloads}**\n[${lang.server.content.pngFormat}](${pngBanner}) | [${lang.server.content.webpFormat}](${webpBanner}) | [${lang.server.content.jpgFormat}](${jpgBanner})`
    ];
}

function membercountSections(server) {
    const cachedMembers = server.members?.cache || new Map();
    const totalCount = server.memberCount || cachedMembers.size || 0;
    const humans = typeof cachedMembers.filter === 'function' ? cachedMembers.filter(m => !m.user?.bot).size : 0;
    const bots = typeof cachedMembers.filter === 'function' ? cachedMembers.filter(m => m.user?.bot).size : 0;

    const statuses = {
        online: typeof cachedMembers.filter === 'function' ? cachedMembers.filter(m => m.presence?.status === 'online').size : 0,
        idle: typeof cachedMembers.filter === 'function' ? cachedMembers.filter(m => m.presence?.status === 'idle').size : 0,
        dnd: typeof cachedMembers.filter === 'function' ? cachedMembers.filter(m => m.presence?.status === 'dnd').size : 0,
        offline: typeof cachedMembers.filter === 'function' ? cachedMembers.filter(m => !m.presence || m.presence.status === 'offline').size : 0
    };

    return [
        `### ${getEmoji('groupusers')} ${lang.server.content.memberAnalyticsHeader}\n• ${lang.server.content.totalMembers}: **${totalCount.toLocaleString()}**\n• ${lang.server.content.humans}: **${humans.toLocaleString()}** (${totalCount > 0 ? ((humans / totalCount) * 100).toFixed(1) : 0}%)\n• ${lang.server.content.bots}: **${bots.toLocaleString()}** (${totalCount > 0 ? ((bots / totalCount) * 100).toFixed(1) : 0}%)`,
        `### ${getEmoji('time')} ${lang.server.content.presenceHeader}\n• ${getEmoji('tick')} ${lang.server.content.online}: **${statuses.online.toLocaleString()}**\n• ${getEmoji('time')} ${lang.server.content.idle}: **${statuses.idle.toLocaleString()}**\n• ${getEmoji('cross')} ${lang.server.content.dnd}: **${statuses.dnd.toLocaleString()}**\n• ${getEmoji('mute')} ${lang.server.content.offline}: **${statuses.offline.toLocaleString()}**`
    ];
}

function rolesSections(server, pageState) {
    const rolesCache = server.roles?.cache;
    const roles = rolesCache && typeof rolesCache.filter === 'function'
        ? rolesCache.filter(role => role.id !== server.id).sort((a, b) => b.position - a.position)
        : [];

    const roleList = roles.map ? roles.map(role => {
        const colorHex = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#000000';
        return `• ${role} (\`${colorHex}\`) - **${role.members?.size || 0}** ${lang.server.content.members}`;
    }) : [];

    const pages = chunkArray(roleList, 12);
    const maxPage = Math.max(1, pages.length);
    const pg = Math.max(0, Math.min(pageState.page, maxPage - 1));
    pageState.page = pg;
    pageState.totalPages = maxPage;

    const pageContent = pages[pg]?.join('\n') || lang.server.content.rolesNone;

    return [
        `### ${getEmoji('list')} ${lang.server.content.rolesHeader} (${lang.server.content.rolesPage} ${pg + 1}/${maxPage})\n${pageContent}`,
        `### ${getEmoji('analytics')} ${lang.server.content.rolesTotal}\n• ${lang.server.content.roles}: **${roles.size || roles.length || 0}**\n• ${lang.server.content.rolesNotice}`
    ];
}

function emojisSections(server, pageState) {
    const emojisCache = server.emojis?.cache;
    const emojis = emojisCache ? Array.from(emojisCache.values()) : [];
    const animated = emojis.filter(e => e.animated);
    const staticEmojis = emojis.filter(e => !e.animated);

    const emojiStrings = emojis.map(e => e.toString());
    const pages = chunkArray(emojiStrings, 25);
    const maxPage = Math.max(1, pages.length);
    const pg = Math.max(0, Math.min(pageState.page, maxPage - 1));
    pageState.page = pg;
    pageState.totalPages = maxPage;

    const pageContent = pages[pg]?.join(' ') || lang.server.content.emojisNone;

    return [
        `### ${getEmoji('smile')} ${lang.server.content.emojisHeader} (${lang.server.content.rolesPage} ${pg + 1}/${maxPage})\n${pageContent}`,
        `### ${getEmoji('analytics')} ${lang.server.content.emojisTotal}\n• ${lang.server.content.emojis}: **${emojis.length}**\n• ${lang.server.content.static}: **${staticEmojis.length}** | ${lang.server.content.animated}: **${animated.length}**`
    ];
}

function channelsSections(server) {
    const channels = server.channels?.cache || new Map();
    const categories = typeof channels.filter === 'function' ? channels.filter(c => c.type === ChannelType.GuildCategory).size : 0;
    const text = typeof channels.filter === 'function' ? channels.filter(c => c.type === ChannelType.GuildText).size : 0;
    const voice = typeof channels.filter === 'function' ? channels.filter(c => c.type === ChannelType.GuildVoice).size : 0;
    const news = typeof channels.filter === 'function' ? channels.filter(c => c.type === ChannelType.GuildNews).size : 0;
    const forum = typeof channels.filter === 'function' ? channels.filter(c => c.type === ChannelType.GuildForum).size : 0;

    return [
        `### ${getEmoji('folder')} ${lang.server.content.channelsHeader}\n• ${lang.server.content.channels}: **${channels.size || 0}**\n• ${lang.server.content.categoryChannels}: **${categories}**\n• ${lang.server.content.textChannels}: **${text}**\n• ${lang.server.content.voiceChannels}: **${voice}**\n• ${lang.server.content.announcementChannels}: **${news}**\n• ${lang.server.content.forumChannels}: **${forum}**`
    ];
}

function boostsSections(server) {
    const boostCount = server.premiumSubscriptionCount || 0;
    const boostLevel = server.premiumTier;
    const nextLevelBoosts = boostLevel < 3 ? [7, 14, 30][boostLevel] : null;
    const boostsNeeded = nextLevelBoosts ? Math.max(0, nextLevelBoosts - boostCount) : 0;

    return [
        `### ${getEmoji('rocket')} ${lang.server.panel.boostsTitle}\n• ${lang.server.content.currentLevel}: **${lang.server.content.tier} ${boostLevel}**\n• ${lang.server.content.subscriptionCount}: **${boostCount}**\n• ${nextLevelBoosts ? `**${boostsNeeded}** ${lang.server.content.boostsNeeded} (${nextLevelBoosts})` : lang.server.content.maxTierAchieved}`,
        `### ${getEmoji('gift')} ${lang.server.content.tierBenefitsHeader.replace('{tier}', lang.server.content.tier)}\n• ${lang.server.content.tier1Benefits}\n• ${lang.server.content.tier2Benefits}\n• ${lang.server.content.tier3Benefits}`
    ];
}

function regionSections(server) {
    return [
        `### ${getEmoji('world')} ${lang.server.panel.regionTitle}\n• ${lang.server.content.preferredLocale}: **${server.preferredLocale || 'en-US'}**\n• ${lang.server.content.systemBenefits}`
    ];
}

function verificationSections(server) {
    return [
        `### ${getEmoji('security')} ${lang.server.panel.verificationTitle}\n• ${lang.server.content.verificationLevel}: **${server.verificationLevel}**\n\n**${lang.server.content.securityDefinitionsHeader}**\n• ${lang.server.content.securityNone}\n• ${lang.server.content.securityLow}\n• ${lang.server.content.securityMedium}\n• ${lang.server.content.securityHigh}\n• ${lang.server.content.securityVeryHigh}`
    ];
}

function featuresSections(server) {
    const featureDescriptions = lang.server.content.featureDescriptions || {};
    const activeList = server.features.map(f => featureDescriptions[f] || `• ${f.replace(/_/g, ' ').toLowerCase()}`);
    return [
        `### ${getEmoji('settings')} ${lang.server.panel.featuresTitle}\n• ${lang.server.content.featuresHeader}: **${server.features.length}**\n\n${activeList.length > 0 ? activeList.join('\n') : lang.server.content.featuresNone}`
    ];
}


function renderState(client, server, state, isSlashCommand = true) {
    let title = '';
    let sections = [];
    let componentsList = [];
    let thumbnailURL = null;
    let isPaginated = false;

    state.totalPages = 1;

    switch (state.mode) {
        case 'icon':
            title = lang.server.panel.iconTitle;
            sections = iconSections(server);
            thumbnailURL = server.iconURL?.({ dynamic: true, size: 256 }) || null;
            break;
        case 'banner':
            title = lang.server.panel.bannerTitle;
            sections = bannerSections(server);
            thumbnailURL = server.bannerURL?.({ dynamic: true, size: 256 }) || null;
            break;
        case 'membercount':
            title = lang.server.panel.membercountTitle;
            sections = membercountSections(server);
            break;
        case 'roles':
            title = lang.server.panel.rolesTitle;
            sections = rolesSections(server, state);
            isPaginated = true;
            break;
        case 'emojis':
            title = lang.server.panel.emojisTitle;
            sections = emojisSections(server, state);
            isPaginated = true;
            break;
        case 'channels':
            title = lang.server.panel.channelsTitle;
            sections = channelsSections(server);
            break;
        case 'boosts':
            title = lang.server.panel.boostsTitle;
            sections = boostsSections(server);
            break;
        case 'region':
            title = lang.server.panel.regionTitle;
            sections = regionSections(server);
            break;
        case 'verification':
            title = lang.server.panel.verificationTitle;
            sections = verificationSections(server);
            break;
        case 'features':
            title = lang.server.panel.featuresTitle;
            sections = featuresSections(server);
            break;
        default: 
            title = lang.server.panel.infoTitle;
            sections = infoSections(server);
            thumbnailURL = server.iconURL?.({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
            break;
    }

    let bottomRow;
    if (isPaginated && state.totalPages > 1) {
        bottomRow = paginationRow('server', state.page, state.totalPages, {
            previous: lang.previous,
            next: lang.next,
            close: lang.server.nav.close
        });
    } else {
        bottomRow = buildSubNavigationRow();
    }

    componentsList = [
        tabsRow(state.mode),
        allSubcommandSelect(state.mode),
        bottomRow
    ];

    return [buildCard(title, sections, componentsList, thumbnailURL)];
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Comprehensive server information and management commands')
        .addSubcommand(sub => sub.setName('info').setDescription('Show detailed server information with advanced pagination'))
        .addSubcommand(sub => sub.setName('icon').setDescription('Display the server icon in high quality'))
        .addSubcommand(sub => sub.setName('banner').setDescription('Show the server banner if available'))
        .addSubcommand(sub => sub.setName('membercount').setDescription('Detailed member statistics and analytics'))
        .addSubcommand(sub => sub.setName('roles').setDescription('Complete list of server roles with details'))
        .addSubcommand(sub => sub.setName('emojis').setDescription('Display all server emojis categorized'))
        .addSubcommand(sub => sub.setName('channels').setDescription('Comprehensive channel summary and statistics'))
        .addSubcommand(sub => sub.setName('boosts').setDescription('Server boost information and perks'))
        .addSubcommand(sub => sub.setName('region').setDescription('Server region and locale information'))
        .addSubcommand(sub => sub.setName('verification').setDescription('Current verification level details'))
        .addSubcommand(sub => sub.setName('features').setDescription('All enabled server features and capabilities')),

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('server_')) return false;

        const messageId = interaction.message.id;
        const clickerId = interaction.user.id;
        const client = interaction.client;
        const server = interaction.guild;

        if (!server) {
            return replyEphemeral(interaction, `${getEmoji('cross')} ${lang.serverRequired}`);
        }

        if (interaction.customId === 'server_close') {
            const session = sessionManager.get(messageId);
            if (session && clickerId !== session.state.userId) {
                await replyUnauthorized(interaction, session.state.userId, 'server');
                return true;
            }

            sessionManager.close(messageId);
            const closedCard = cards.closed(formatCommandLink('server'));
            await closeAndAutoDelete(interaction, closedCard);
            return true;
        }

        const session = sessionManager.get(messageId);
        if (!session) {
            await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.sessionExpired}`);
            return true;
        }

        if (clickerId !== session.state.userId) {
            await replyUnauthorized(interaction, session.state.userId, 'server');
            return true;
        }

        await deferUpdate(interaction);
        sessionManager.touch(client, interaction.channelId, messageId);
        await cacheCommandIds(client, interaction).catch(() => { });

        const { state } = session;
        const customId = interaction.customId;

        if (customId === 'server_tab_info') {
            state.mode = 'info';
            state.page = 0;
        } else if (customId === 'server_tab_roles') {
            state.mode = 'roles';
            state.page = 0;
        } else if (customId === 'server_tab_emojis') {
            state.mode = 'emojis';
            state.page = 0;
        } else if (customId === 'server_subcommand_select') {
            state.mode = interaction.values[0] || 'info';
            state.page = 0;
        } else if (customId === 'server_prev') {
            state.page = Math.max(0, state.page - 1);
        } else if (customId === 'server_next') {
            state.page = state.page + 1;
        }

        try {
            const components = renderState(client, server, state, true);
            await editV2(interaction, components);
        } catch (err) {
            console.error('[Server Component Error]:', err.message);
        }

        return true;
    },

    async execute(interaction) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        if (isSlash) {
            await deferReply(interaction);
        }

        const client = interaction.client;
        const server = interaction.guild;

        if (!server) {
            const errorContainer = buildCard(lang.serverRequiredTitle, [lang.serverRequired], []);
            await sendV2(interaction, errorContainer).catch(() => { });
            return;
        }

        await cacheCommandIds(client, interaction).catch(() => { });

        const rawInput = isSlash
            ? (interaction.options.getSubcommand(false) || 'info')
            : (String(interaction.content || '').split(' ').slice(1)[0] || 'info');

        const userId = isSlash ? interaction.user.id : interaction.author.id;
        const state = {
            mode: rawInput.toLowerCase(),
            userId,
            page: 0,
            totalPages: 1,
            interaction
        };

        try {
            const components = renderState(client, server, state, isSlash);
            const message = await sendV2(interaction, components);

            if (message?.id) {
                sessionManager.open(client, interaction.channelId, message.id, state);
            }
        } catch (err) {
            console.error('[Server Initial Render Error]:', err.message);
            const errPayload = { content: lang.server.error.loadFailed, components: [] };
            if (interaction.deferred || interaction.replied) {
                interaction.editReply(errPayload).catch(() => { });
            } else {
                interaction.reply(errPayload).catch(() => { });
            }
        }
    }
};