

'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
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
} = require('../../UI');

const TEXT_LIMIT = 4_000;
const PAGE_SIZE = 12;

const sessionManager = createSessionManager({
    onExpire: () => cards.expired(),
});

function tr(text, max = TEXT_LIMIT) { const v = String(text || '').trim(); return v.length <= max ? v : v.slice(0, max - 1) + '\u2026'; }
function clamp(p, total) { return total <= 0 ? 0 : Math.max(0, Math.min(p, total - 1)); }

function collectServer(client, guild) {
    if (!guild?.emojis?.cache) return [];
    return guild.emojis.cache.map(e => ({
        id: e.id, name: e.name, animated: e.animated,
        url: e.imageURL(), str: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`,
        guildName: guild.name, guildId: guild.id, ts: e.createdTimestamp
    }));
}

function collectGlobal(client) {
    const out = [];
    if (!client?.guilds?.cache) return out;
    for (const g of client.guilds.cache.values()) {
        if (!g?.emojis?.cache) continue;
        for (const e of g.emojis.cache.values()) {
            out.push({
                id: e.id, name: e.name, animated: e.animated,
                url: e.imageURL(), str: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`,
                guildName: g.name, guildId: g.id, ts: e.createdTimestamp
            });
        }
    }
    return out;
}

function applyFilter(arr, type) {
    if (type === 'animated') return arr.filter(e => e.animated);
    if (type === 'static') return arr.filter(e => !e.animated);
    return arr;
}

function applySort(arr, sort) {
    const copy = [...arr];
    switch (sort) {
        case 'newest': return copy.sort((a, b) => b.ts - a.ts);
        case 'oldest': return copy.sort((a, b) => a.ts - b.ts);
        case 'random': return copy.sort(() => Math.random() - 0.5);
        default: return copy.sort((a, b) => a.name.localeCompare(b.name));
    }
}

function paginate(items, page, perPage) {
    const tp = Math.max(1, Math.ceil(items.length / perPage));
    const pg = clamp(page, tp);
    return { items: items.slice(pg * perPage, pg * perPage + perPage), page: pg, totalPages: tp };
}

function getSource(cache, scope) { return scope === 'global' ? cache.global : cache.server; }

function tabsRow(active) {
    const s = m => active === m ? ButtonStyle.Danger : ButtonStyle.Secondary;
    return new ActionRowBuilder().addComponents(
        btn(lang.emojis.nav.overview, 'emojis_tab_overview', 'home', s('overview')),
        btn(lang.emojis.nav.browse, 'emojis_tab_browse', 'folder', s('browse')),
        btn(lang.emojis.nav.ids, 'emojis_tab_ids', 'document', s('ids')),
        btn(lang.emojis.nav.stats, 'emojis_tab_stats', 'analytics', s('stats')),
    );
}

function overviewControlRow() {
    return new ActionRowBuilder().addComponents(
        linkBtn(lang.emojis.nav.support, 'support', 'https://discord.gg/xQF9f9yUEM'),
        linkBtn(lang.emojis.nav.docs, 'help', 'https://www.fluenosity.com/allinone'),
        closeBtn('emojis', lang.emojis.nav.close),
    );
}

function browseNavRow(page, totalPages) {
    return new ActionRowBuilder().addComponents(
        btn(lang.emojis.nav.first, 'emojis_nav_first', 'back', ButtonStyle.Secondary, page <= 0),
        btn(lang.emojis.nav.prev, 'emojis_nav_prev', 'arrleft', ButtonStyle.Secondary, page <= 0),
        btn(lang.emojis.nav.next, 'emojis_nav_next', 'arrright', ButtonStyle.Secondary, page >= totalPages - 1),
        btn(lang.emojis.nav.last, 'emojis_nav_last', 'next', ButtonStyle.Secondary, page >= totalPages - 1),
        closeBtn('emojis', lang.emojis.nav.close),
    );
}

function typeSelect(current) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('emojis_sel_type').setPlaceholder(lang.emojis.select.filterTypePlaceholder).addOptions([
            { label: lang.emojis.select.all, value: 'all', emoji: getButtonEmoji('sparkles'), default: current === 'all' },
            { label: lang.emojis.select.animated, value: 'animated', emoji: getButtonEmoji('play'), default: current === 'animated' },
            { label: lang.emojis.select.static, value: 'static', emoji: getButtonEmoji('folder'), default: current === 'static' },
        ])
    );
}

function sortSelectRow(current) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('emojis_sel_sort').setPlaceholder(lang.emojis.select.sortByPlaceholder).addOptions([
            { label: lang.emojis.select.sortName, value: 'name', emoji: getButtonEmoji('document'), default: current === 'name' },
            { label: lang.emojis.select.sortNewest, value: 'newest', emoji: getButtonEmoji('sparkles'), default: current === 'newest' },
            { label: lang.emojis.select.sortOldest, value: 'oldest', emoji: getButtonEmoji('time'), default: current === 'oldest' },
            { label: lang.emojis.select.sortRandom, value: 'random', emoji: getButtonEmoji('loop'), default: current === 'random' },
        ])
    );
}

function scopeSelectRow(current) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('emojis_sel_scope').setPlaceholder(lang.emojis.select.scopePlaceholder).addOptions([
            { label: lang.emojis.select.scopeServer, value: 'server', emoji: getButtonEmoji('home'), default: current === 'server' },
            { label: lang.emojis.select.scopeGlobal, value: 'global', emoji: getButtonEmoji('world'), default: current === 'global' },
        ])
    );
}

function emojiPickSelect(emojis, current) {
    if (!emojis?.length) return null;
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('emojis_sel_detail').setPlaceholder(lang.emojis.select.detailPlaceholder).addOptions(
            emojis.slice(0, 25).map(e => ({
                label: tr(e.name, 100),
                description: tr(`${e.animated ? lang.emojis.select.animated : lang.emojis.select.static} \u2022 ${e.id}`, 100),
                value: e.id,
                default: current === e.id,
            }))
        )
    );
}

function detailControlRow() {
    return new ActionRowBuilder().addComponents(
        btn(lang.emojis.nav.backToBrowse, 'emojis_back_browse', 'back', ButtonStyle.Secondary),
        closeBtn('emojis', lang.emojis.nav.close),
    );
}

function statsControlRow() {
    return new ActionRowBuilder().addComponents(
        linkBtn(lang.emojis.nav.support, 'support', 'https://discord.gg/xQF9f9yUEM'),
        closeBtn('emojis', lang.emojis.nav.close),
    );
}

function viewOverview(client, guild, cache) {
    const sv = cache.server;
    const gl = cache.global;
    const animated = sv.filter(e => e.animated).length;
    const staticC = sv.length - animated;
    const maxSlots = guild?.premiumTier >= 3 ? 500 : guild?.premiumTier >= 2 ? 150 : guild?.premiumTier >= 1 ? 100 : 50;
    const pct = sv.length > 0 ? ((sv.length / maxSlots) * 100).toFixed(1) : '0.0';
    const globalServers = new Set(gl.map(e => e.guildId)).size;

    const sample = [...sv].sort(() => Math.random() - 0.5).slice(0, 10).map(e => e.str).join(' ') || `\`${lang.emojis.content.noEmojis}\``;

    const title = `${getEmoji('smile')} ${lang.emojis.panel.overviewTitle.replace('{guildName}', guild?.name || lang.serverLabel)}`;
    const sections = [
        `### ${getEmoji('analytics')} ${lang.emojis.content.serverSnapshot}\n• ${lang.emojis.content.totalEmojis.replace('{total}', sv.length).replace('{animated}', animated).replace('{static}', staticC)}\n• ${lang.emojis.content.slotsUsage.replace('{total}', sv.length).replace('{maxSlots}', maxSlots).replace('{pct}', pct)}\n• ${lang.emojis.content.serverBoost.replace('{tier}', guild?.premiumTier || 0)}`,
        `### ${getEmoji('world')} ${lang.emojis.content.globalReach}\n• ${lang.emojis.content.globalTotal.replace('{total}', gl.length).replace('{servers}', globalServers)}\n• ${lang.emojis.content.botGuilds.replace('{guilds}', client?.guilds?.cache?.size || 0)}`,
        `### ${getEmoji('sparkles')} ${lang.emojis.content.randomPreview}\n${sample}`,
        `${getEmoji('search')} ${lang.emojis.content.navPrompt}`,
    ];

    return buildCard(title, sections, [tabsRow('overview'), scopeSelectRow('server'), overviewControlRow()], null, 0x5865F2);
}

function viewBrowse(cache, state) {
    const src = getSource(cache, state.scope);
    const filtered = applyFilter(src, state.type);
    const sorted = applySort(filtered, state.sort);
    const { items, page, totalPages } = paginate(sorted, state.browsePage, PAGE_SIZE);
    state.browsePage = page;

    const animated = filtered.filter(e => e.animated).length;
    const staticC = filtered.length - animated;
    const scopeL = state.scope === 'global' ? lang.emojis.select.scopeGlobal : lang.emojis.select.scopeServer;
    const typeL = state.type === 'all' ? lang.emojis.select.all : state.type === 'animated' ? lang.emojis.select.animated : lang.emojis.select.static;

    const list = items.length
        ? items.map((e, i) => {
            const idx = page * PAGE_SIZE + i + 1;
            return `**${idx}.** ${e.str} \`${e.name}\`${state.scope === 'global' ? ` \u2013 *${e.guildName}*` : ''}`;
        }).join('\n')
        : `\`${lang.emojis.content.noFilterMatches}\``;

    const title = `${getEmoji('folder')} ${lang.emojis.panel.browserTitle}`;
    const sections = [
        `### ${getEmoji('analytics')} ${scopeL} • ${typeL} • Sort: ${state.sort}\n• ${lang.emojis.content.filterSummary.replace('{count}', items.length).replace('{total}', filtered.length).replace('{animated}', animated).replace('{static}', staticC)}\n• ${lang.emojis.content.pageCount.replace('{page}', page + 1).replace('{totalPages}', totalPages)}`,
        `### ${getEmoji('smile')} ${lang.emojis.content.emojisHeader}\n${list}`,
    ];

    return buildCard(
        title,
        sections,
        [tabsRow('browse'), typeSelect(state.type), sortSelectRow(state.sort), emojiPickSelect(items, null), browseNavRow(page, totalPages)].filter(Boolean),
        null,
        0x2ECC71
    );
}

function viewIds(cache, state) {
    const src = getSource(cache, state.scope);
    const filtered = applyFilter(src, state.type);
    const sorted = applySort(filtered, state.sort);
    const { items, page, totalPages } = paginate(sorted, state.idsPage, PAGE_SIZE);
    state.idsPage = page;

    const scopeL = state.scope === 'global' ? lang.emojis.select.scopeGlobal : lang.emojis.select.scopeServer;

    const list = items.length
        ? items.map((e, i) => {
            const idx = page * PAGE_SIZE + i + 1;
            const formatLine = e.animated ? lang.emojis.content.formatAnimated.replace('{str}', e.str) : lang.emojis.content.formatStatic.replace('{str}', e.str);
            return `**${idx}.** ${e.str} • \`${e.name}\` • \`${e.id}\`\n\u2003\u2003${formatLine}`;
        }).join('\n')
        : `\`${lang.emojis.content.noEmojisFound}\``;

    const title = `${getEmoji('document')} ${lang.emojis.panel.idsTitle}`;
    const sections = [
        `### ${getEmoji('list')} ${lang.emojis.content.copyPasteReady.replace('{scope}', scopeL)}\n• ${lang.emojis.content.filterSummary.replace('{count}', items.length).replace('{total}', filtered.length).replace('{animated}', '').replace('{static}', '')}\n• ${lang.emojis.content.pageCount.replace('{page}', page + 1).replace('{totalPages}', totalPages)}`,
        `### ${getEmoji('settings')} ${lang.emojis.content.idRefHeader}\n${list}`,
    ];

    return buildCard(title, sections, [tabsRow('ids'), typeSelect(state.type), scopeSelectRow(state.scope), browseNavRow(page, totalPages)], null, 0x3498DB);
}

function viewStats(client, guild, cache, state) {
    const src = getSource(cache, state.scope);
    const animated = src.filter(e => e.animated).length;
    const staticC = src.length - animated;
    const total = src.length;
    const scopeL = state.scope === 'global' ? lang.emojis.select.scopeGlobal : lang.emojis.select.scopeServer;

    const names = src.map(e => e.name);
    const avgLen = names.length ? Math.round(names.reduce((s, n) => s + n.length, 0) / names.length) : 0;
    const longest = names.reduce((l, n) => n.length > l.length ? n : l, '') || 'N/A';
    const shortest = names.length ? names.reduce((s, n) => n.length < s.length ? n : s, names[0]) : 'N/A';

    let capacityText;
    if (state.scope === 'global') {
        const serverCounts = {};
        src.forEach(e => {
            serverCounts[e.guildId] = serverCounts[e.guildId] || { name: e.guildName, count: 0 };
            serverCounts[e.guildId].count++;
        });
        const top5 = Object.values(serverCounts).sort((a, b) => b.count - a.count).slice(0, 5);
        capacityText = `### ${getEmoji('crown')} ${lang.emojis.content.topServers}\n${top5.map((s, i) => `${i === 0 ? getEmoji('crown') : i === 1 ? getEmoji('medal') : i === 2 ? getEmoji('star') : `**${i + 1}.**`} **${s.name}** \u2013 ${s.count} emojis`).join('\n') || `\`${lang.emojis.content.none}\``}`;
    } else {
        const maxSlots = guild?.premiumTier >= 3 ? 500 : guild?.premiumTier >= 2 ? 150 : guild?.premiumTier >= 1 ? 100 : 50;
        capacityText = `### ${getEmoji('rocket')} ${lang.emojis.content.capacity}\n• ${lang.emojis.content.capacityDetails.replace('{total}', total).replace('{maxSlots}', maxSlots).replace('{pct}', total > 0 ? ((total / maxSlots) * 100).toFixed(1) : '0.0').replace('{remaining}', maxSlots - total).replace('{tier}', guild?.premiumTier || 0)}`;
    }

    const sorted = [...src].sort((a, b) => b.ts - a.ts);
    const newest = sorted[0];
    const oldest = sorted[sorted.length - 1];
    const timeText = newest
        ? `### ${getEmoji('calendar')} ${lang.emojis.content.timeline}\n• ${lang.emojis.content.timelineDetails.replace('{newestStr}', newest.str).replace('{newestName}', newest.name).replace('{newestTs}', Math.floor(newest.ts / 1000)).replace('{oldestStr}', oldest.str).replace('{oldestName}', oldest.name).replace('{oldestTs}', Math.floor(oldest.ts / 1000))}`
        : `### ${getEmoji('calendar')} ${lang.emojis.content.timeline}\n\`${lang.emojis.content.noData}\``;

    const title = `${getEmoji('analytics')} ${lang.emojis.panel.statsTitle.replace('{scope}', scopeL)}`;
    const sections = [
        `### ${getEmoji('trend')} ${lang.emojis.content.overviewHeader}\n• ${lang.emojis.content.overviewStats.replace('{total}', total).replace('{animated}', animated).replace('{animPct}', total > 0 ? ((animated / total) * 100).toFixed(1) : '0').replace('{static}', staticC).replace('{statPct}', total > 0 ? ((staticC / total) * 100).toFixed(1) : '0')}`,
        `### ${getEmoji('document')} ${lang.emojis.content.nameAnalysis}\n• ${lang.emojis.content.nameStats.replace('{avgLen}', avgLen).replace('{longest}', longest).replace('{longestLen}', longest.length).replace('{shortest}', shortest).replace('{shortestLen}', shortest.length)}`,
        capacityText,
        timeText,
    ];

    return buildCard(title, sections, [tabsRow('stats'), scopeSelectRow(state.scope), statsControlRow()], null, 0x9B59B6);
}

function viewDetail(cache, state) {
    const src = getSource(cache, state.scope);
    const emoji = src.find(e => e.id === state.detailId);

    if (!emoji) {
        return cards.error(lang.emojis.panel.notFoundTitle, lang.emojis.panel.notFoundDesc);
    }

    const title = `${getEmoji('info')} ${lang.emojis.panel.detailTitle.replace('{name}', emoji.name)}`;
    const sections = [
        `### ${getEmoji(emoji.animated ? 'play' : 'folder')} ${lang.emojis.content.preview}\n${emoji.str} ${emoji.str} ${emoji.str}`,
        `### ${getEmoji('document')} ${lang.emojis.content.properties}\n• **${lang.emojis.content.propName}:** \`${emoji.name}\`\n• **${lang.emojis.content.propId}:** \`${emoji.id}\`\n• **${lang.emojis.content.propType}:** ${emoji.animated ? lang.emojis.content.animatedGif : lang.emojis.content.staticPng}\n• **${lang.emojis.content.propFormat}:** \`${emoji.str}\`\n• **${lang.emojis.content.propServer}:** ${emoji.guildName || lang.emojis.content.unknown}\n• **${lang.emojis.content.propCreated}:** <t:${Math.floor(emoji.ts / 1000)}:F> (<t:${Math.floor(emoji.ts / 1000)}:R>)`,
        `### ${getEmoji('link')} ${lang.emojis.content.quickCopy}\n\`\`\`\n${emoji.str}\n\`\`\`\n• [${lang.emojis.content.imageUrl}](${emoji.url})`,
    ];

    return buildCard(title, sections, [tabsRow('browse'), detailControlRow()], null, emoji.animated ? 0xFF6B6B : 0x4ECDC4);
}

function renderState(client, guild, cache, state) {
    switch (state.mode) {
        case 'browse': return [viewBrowse(cache, state)];
        case 'ids': return [viewIds(cache, state)];
        case 'stats': return [viewStats(client, guild, cache, state)];
        case 'detail': return [viewDetail(cache, state)];
        default: return [viewOverview(client, guild, cache)];
    }
}

function applyInteraction(customId, values, state, cache) {
    
    if (customId === 'emojis_tab_overview') return Object.assign(state, { mode: 'overview' });
    if (customId === 'emojis_tab_browse') return Object.assign(state, { mode: 'browse', browsePage: 0 });
    if (customId === 'emojis_tab_ids') return Object.assign(state, { mode: 'ids', idsPage: 0 });
    if (customId === 'emojis_tab_stats') return Object.assign(state, { mode: 'stats' });

    
    if (customId === 'emojis_back_browse') return Object.assign(state, { mode: 'browse', detailId: null });

    
    if (customId === 'emojis_sel_scope') {
        state.scope = String(values[0] || 'server');
        state.browsePage = 0; state.idsPage = 0;
        return state;
    }

    
    if (customId === 'emojis_sel_type') {
        state.type = String(values[0] || 'all');
        state.browsePage = 0; state.idsPage = 0;
        return state;
    }

    
    if (customId === 'emojis_sel_sort') {
        state.sort = String(values[0] || 'name');
        state.browsePage = 0;
        return state;
    }

    
    if (customId === 'emojis_sel_detail') {
        state.mode = 'detail';
        state.detailId = String(values[0] || '');
        return state;
    }

    
    if (customId === 'emojis_nav_first' || customId === 'emojis_nav_prev' || customId === 'emojis_nav_next' || customId === 'emojis_nav_last') {
        const pageKey = state.mode === 'ids' ? 'idsPage' : 'browsePage';
        const src = getSource(cache, state.scope);
        const filtered = applyFilter(src, state.type);
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        const cur = state[pageKey] || 0;

        if (customId === 'emojis_nav_first') state[pageKey] = 0;
        else if (customId === 'emojis_nav_prev') state[pageKey] = clamp(cur - 1, totalPages);
        else if (customId === 'emojis_nav_next') state[pageKey] = clamp(cur + 1, totalPages);
        else if (customId === 'emojis_nav_last') state[pageKey] = totalPages - 1;
    }
}

async function handleComponent(interaction) {
    if (!interaction.customId?.startsWith('emojis_')) return false;

    const messageId = interaction.message.id;
    const clickerId = interaction.user.id;

    
    if (interaction.customId === 'emojis_close') {
        const session = sessionManager.get(messageId);
        if (session && clickerId !== session.state.userId) {
            await replyUnauthorized(interaction, session.state.userId, 'emojis');
            return true;
        }

        sessionManager.close(messageId);
        const closedCard = cards.closed();
        await closeAndAutoDelete(interaction, closedCard);
        return true;
    }

    
    const session = sessionManager.get(messageId);
    if (!session) {
        await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.emojis.session.expired}`);
        return true;
    }

    if (clickerId !== session.state.userId) {
        await replyUnauthorized(interaction, session.state.userId, 'emojis');
        return true;
    }

    
    try { await deferUpdate(interaction); } catch { return true; }
    sessionManager.touch(interaction.client, interaction.channelId, messageId);

    
    const { state, cache } = session;
    try { applyInteraction(interaction.customId, interaction.values ?? [], state, cache); }
    catch (err) { console.error('[Emojis] applyInteraction:', err); return true; }

    
    try {
        const components = renderState(interaction.client, interaction.guild, cache, state);
        await editV2(interaction, components);
    } catch (err) {
        console.error('[Emojis] message.edit failed:', err.message);
        try {
            const errCard = cards.error(
                lang.emojis.panel.renderErrorTitle,
                `\`${tr(err.message, 120)}\`\n${lang.emojis.panel.renderErrorSub}`
            );
            await editV2(interaction, errCard);
        } catch { }
    }

    return true;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emojis')
        .setDescription('Interactive emoji dashboard with browsing, IDs, stats, and details')
        .addStringOption(o =>
            o.setName('view')
                .setDescription('Starting view')
                .setRequired(false)
                .addChoices(
                    { name: 'Overview', value: 'overview' },
                    { name: 'Browse', value: 'browse' },
                    { name: 'IDs & Codes', value: 'ids' },
                    { name: 'Statistics', value: 'stats' },
                )),

    aliases: ['emoji', 'emotes', 'showemojis', 'emojilist'],
    category: 'utility',
    description: 'Interactive emoji dashboard with browsing, IDs, stats, and details',

    handleComponent,

    async execute(interaction) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await deferReply(interaction);
            }
        } catch (err) {
            console.error('[Emojis] deferReply failed:', err.message);
            return;
        }

        const guild = interaction.guild;
        const client = interaction.client;
        const cache = {
            server: collectServer(client, guild),
            global: collectGlobal(client),
        };

        const rawView = isSlash ? interaction.options.getString('view') : null;
        const userId = isSlash ? interaction.user.id : interaction.author.id;
        const state = {
            mode: rawView || 'overview',
            userId,
            scope: 'server',
            type: 'all',
            sort: 'name',
            browsePage: 0,
            idsPage: 0,
            detailId: null,
        };

        try {
            const components = renderState(client, guild, cache, state);
            const message = await sendV2(interaction, components);
            if (message) sessionManager.open(client, interaction.channelId, message.id, state, { cache });
        } catch (err) {
            console.error('[Emojis] Initial render failed:', err.message);
            await replyEphemeral(interaction, lang.emojis.error.loadFailed).catch(() => { });
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const all = collectGlobal(interaction.client);
        const filtered = all
            .filter(e => e.name.toLowerCase().includes(focusedValue.toLowerCase()))
            .slice(0, 25)
            .map(e => ({ name: `${e.animated ? '[GIF]' : '[IMG]'} ${e.name}${e.guildName ? ` (${e.guildName})` : ''}`, value: e.name }));
        await interaction.respond(filtered).catch(() => { });
    }
};
