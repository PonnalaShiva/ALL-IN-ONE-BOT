'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const config = require('../../config.js');
const { getRuntimeEntitlementSnapshot } = require('../../utils/entitlementService');
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
    cacheCommandIds,
    formatCommandLink
} = require('../../UI');

const COMMANDS_DIR = path.join(__dirname, '../../commands');
const EXCESS_COMMANDS_DIR = path.join(__dirname, '../../excesscommands');
const CMD_CACHE_TTL = 5 * 60 * 1_000;

const HELP_BANNER_URL = (() => {
    const raw = String(config.helpBannerUrl || '').trim();
    try { new URL(raw); return raw; } catch { return null; }
})();


const DISCORD_TEXT_LIMIT = 4_000;
const SELECT_LABEL_LIMIT = 100;
const SELECT_DESC_LIMIT = 100;
const ITEM_DESC_LIMIT = 120;

const _cmdCache = { data: null, timestamp: 0 };
const COMMAND_MENTION_CACHE_TTL_MS = 5 * 60 * 1000;
const commandMentionCache = new Map();
const _cmdIds = new Map();

function formatCommandMention(command) {
    if (!command?.name || !command?.id) return null;

    const options = Array.isArray(command.options) ? command.options : [];
    const firstSubcommand = options.find((option) => option?.type === 1);

    if (firstSubcommand?.name) {
        return `</${command.name} ${firstSubcommand.name}:${command.id}>`;
    }

    return `</${command.name}:${command.id}>`;
}

async function getCommandMentionMap(client, interaction) {
    const guildId = interaction.guildId || 'global';
    const cache = commandMentionCache.get(guildId);
    const now = Date.now();

    if (cache && (now - cache.fetchedAt) < COMMAND_MENTION_CACHE_TTL_MS) {
        return cache.map;
    }

    const mentionMap = new Map();

    try {
        if (client.application?.commands) {
            const globalCommands = await client.application.commands.fetch();
            globalCommands.forEach((command) => {
                if (command.type === 1) {
                    _cmdIds.set(command.name.toLowerCase(), command.id);
                    mentionMap.set(command.name.toLowerCase(), formatCommandMention(command) || `/${command.name}`);
                }
            });
        }
    } catch (_) { }

    try {
        if (interaction.guild?.commands) {
            const guildCommands = await interaction.guild.commands.fetch();
            guildCommands.forEach((command) => {
                if (command.type === 1) {
                    _cmdIds.set(command.name.toLowerCase(), command.id);
                    mentionMap.set(command.name.toLowerCase(), formatCommandMention(command) || `/${command.name}`);
                }
            });
        }
    } catch (_) { }

    commandMentionCache.set(guildId, {
        fetchedAt: now,
        map: mentionMap
    });

    return mentionMap;
}


const sessionManager = createSessionManager({
    onExpire: () => cards.expired(formatCommandLink('help')),
});

function capitalize(s) {
    const v = String(s || '');
    return v.charAt(0).toUpperCase() + v.slice(1);
}

function trunc(text, max = 100) {
    const v = String(text || '').trim();
    return v.length <= max ? v : `${v.slice(0, max - 1)}\u2026`;
}

function getEnabledCategories() {
    return {
        slash: Object.entries(config.categories || {}).filter(([, v]) => v).map(([k]) => k),
        prefix: Object.entries(config.excessCommands || {}).filter(([, v]) => v).map(([k]) => k),
    };
}

function getCategoryType(name) {
    const e = getEnabledCategories();
    if (e.slash.includes(name)) return 'slash';
    if (e.prefix.includes(name)) return 'prefix';
    return null;
}

function cmdPrefix(type) { return type === 'prefix' ? (config.prefix || '!') : '/'; }

function loadFile(filePath) {
    try {
        delete require.cache[require.resolve(filePath)];
        return require(filePath);
    } catch (err) {
        console.error(`[Help] load error ${filePath}:`, err.message);
        return null;
    }
}

function extractSubcommands(cmd) {
    const out = [];

    if (cmd?.data?.toJSON) {
        for (const opt of (cmd.data.toJSON().options ?? [])) {
            if (opt.type === 1) {
                out.push({ name: opt.name, description: trunc(opt.description || lang.help.select.noDescription, 80) });
            } else if (opt.type === 2) {
                for (const sub of (opt.options ?? []).filter(o => o.type === 1))
                    out.push({ name: `${opt.name} ${sub.name}`, description: trunc(sub.description || lang.help.select.noDescription, 80) });
            }
        }
        return out;
    }

    if (Array.isArray(cmd?.subcommands)) {
        return cmd.subcommands.map(sub => ({
            name: String(sub.name || sub),
            description: trunc(sub.description || `${cmd.name} ${sub.name || sub}`, 80),
        }));
    }

    if (typeof cmd?.usage === 'string') {
        const pfx = config.prefix || '!';
        const cmdName = cmd.name || '';
        const usage = cmd.usage
            .replace(/\[([^\]]*\/[^\]]*)\]/g, (_, inner) => inner.split('/').map(s => s.trim()).join(' | '))
            .replace(/\[([^\]]*\|[^\]]*)\]/g, (_, inner) => inner);

        for (const part of usage.split('|').map(p => p.trim()).filter(Boolean)) {
            const cleaned = part.replace(/^[!?.]+/, '').replace(/^\[|\]$/g, '').trim();
            if (cleaned === cmdName) continue;

            let subPart;
            if (cleaned.startsWith(`${cmdName} `)) subPart = cleaned.slice(cmdName.length + 1).trim();
            else if (!cleaned.includes(' ') && !cleaned.startsWith('<')) subPart = cleaned;
            else continue;

            const [rawFirst, ...rest] = subPart.split(/\s+/);
            const stripped = rawFirst.replace(/^\[|\]$/g, '');
            if (stripped.startsWith('<') || stripped.startsWith('@')) continue;

            const subName = rawFirst.replace(/[<>[\]]/g, '');
            if (!subName || out.find(s => s.name === subName)) continue;

            const argHints = rest.join(' ').replace(/[<>[\]]/g, '').trim();
            out.push({
                name: subName,
                description: trunc(argHints ? `${pfx}${cmdName} ${subName} ${argHints}` : `${pfx}${cmdName} ${subName}`, 80),
            });
        }
    }

    return out;
}

function readCategoryGroup(basePath, categoryMap, type) {
    const grouped = {};
    for (const [catName, enabled] of Object.entries(categoryMap || {})) {
        if (!enabled) continue;
        const catPath = path.join(basePath, catName);
        if (!fs.existsSync(catPath)) continue;

        const cmds = fs.readdirSync(catPath)
            .filter(f => f.endsWith('.js'))
            .map(file => {
                const cmd = loadFile(path.join(catPath, file));
                if (!cmd) return null;
                return {
                    name: cmd.data?.name || cmd.name || path.basename(file, '.js'),
                    description: trunc(cmd.data?.description || cmd.description || lang.help.select.noDescription, 100),
                    subcommands: extractSubcommands(cmd),
                    type,
                    file,
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (cmds.length) grouped[catName] = cmds;
    }
    return grouped;
}

function getInventory() {
    const now = Date.now();
    if (_cmdCache.data && now - _cmdCache.timestamp < CMD_CACHE_TTL) return _cmdCache.data;
    _cmdCache.data = {
        slash: readCategoryGroup(COMMANDS_DIR, config.categories || {}, 'slash'),
        prefix: readCategoryGroup(EXCESS_COMMANDS_DIR, config.excessCommands || {}, 'prefix'),
    };
    _cmdCache.timestamp = now;
    return _cmdCache.data;
}

function invalidateCache() { _cmdCache.data = null; _cmdCache.timestamp = 0; }

function countStats(grouped) {
    let master = 0, sub = 0;
    for (const cmds of Object.values(grouped || {})) {
        master += cmds.length;
        for (const c of cmds) sub += c.subcommands.length;
    }
    return { master, sub, total: master + sub };
}

function chunkBy(items, maxW, wFn) {
    const pages = [];
    let cur = [], w = 0;
    for (const item of items) {
        const iw = Math.max(1, wFn(item));
        if (cur.length && w + iw > maxW) { pages.push(cur); cur = []; w = 0; }
        cur.push(item); w += iw;
    }
    if (cur.length) pages.push(cur);
    return pages.length ? pages : [[]];
}

const pageCmds = cmds => chunkBy(cmds, 10, () => 1);
const pageSubs = subs => chunkBy(subs, 10, () => 1);

function clamp(page, total) { return total <= 0 ? 0 : Math.max(0, Math.min(page, total - 1)); }
function pageLabel(cur, tot) { return lang.help.content.part.replace('{page}', cur + 1).replace('{total}', Math.max(tot, 1)); }

function tabsRow(active) {
    const s = m => active === m ? ButtonStyle.Danger : ButtonStyle.Secondary;
    return new ActionRowBuilder().addComponents(
        btn(lang.help.nav.overview, 'help_tab_overview', 'home', s('overview')),
        btn(lang.help.nav.slash, 'help_tab_slash', 'commands', s('slash')),
        btn(lang.help.nav.prefix, 'help_tab_prefix', 'folder', s('prefix')),
        btn(lang.help.nav.emoji, 'help_tab_emoji', 'tools', s('emoji')),
    );
}

function buildSubNavigationRow(backId) {
    return new ActionRowBuilder().addComponents(
        btn(lang.help.nav.back, backId, 'back', ButtonStyle.Secondary),
        linkBtn(lang.help.nav.support, 'support', 'https://discord.gg/xQF9f9yUEM'),
        linkBtn(lang.help.nav.docs, 'help', 'https://www.fluenosity.com/allinone'),
        closeBtn('help', lang.help.nav.close)
    );
}

function allCategorySelect(inventory, current = null) {
    const opts = [];
    for (const [n, cmds] of Object.entries(inventory.slash || {}))
        opts.push({ label: trunc(lang.help.select.slashCategoryLabel.replace('{category}', capitalize(n)), SELECT_LABEL_LIMIT), description: trunc(lang.help.select.commandsCount.replace('{count}', cmds.length), SELECT_DESC_LIMIT), value: `slash:${n}`, emoji: getButtonEmoji('commands'), default: current === `slash:${n}` });
    for (const [n, cmds] of Object.entries(inventory.prefix || {}))
        opts.push({ label: trunc(lang.help.select.prefixCategoryLabel.replace('{category}', capitalize(n)), SELECT_LABEL_LIMIT), description: trunc(lang.help.select.commandsCount.replace('{count}', cmds.length), SELECT_DESC_LIMIT), value: `prefix:${n}`, emoji: getButtonEmoji('folder'), default: current === `prefix:${n}` });
    if (!opts.length) return null;
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('help_category_select').setPlaceholder(lang.help.select.allPlaceholder).addOptions(opts.slice(0, 25)),
    );
}

function typeCategorySelect(type, grouped, current = null) {
    const opts = Object.entries(grouped || {})
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([n, cmds]) => ({
            label: trunc(`${capitalize(n)} ${type === 'prefix' ? 'Prefix' : 'Slash'}`, SELECT_LABEL_LIMIT),
            description: trunc(lang.help.select.commandsCount.replace('{count}', cmds.length), SELECT_DESC_LIMIT),
            value: n,
            emoji: getButtonEmoji(type === 'prefix' ? 'folder' : 'commands'),
            default: current === n,
        }));
    if (!opts.length) return null;
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`help_category_select:${type}`).setPlaceholder(lang.help.select.typePlaceholder.replace('{type}', type)).addOptions(opts.slice(0, 25)),
    );
}

function commandSelect(type, catName, cmds, current = null) {
    if (!cmds?.length) return null;
    const pre = cmdPrefix(type);
    const opts = cmds.slice(0, 25).map(c => ({
        label: trunc(`${pre}${c.name}`, SELECT_LABEL_LIMIT),
        description: trunc(c.description || lang.help.select.noDescription, SELECT_DESC_LIMIT),
        value: c.name,
        default: current === c.name,
    }));
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`help_command_select:${type}:${catName}`).setPlaceholder(lang.help.select.cmdPlaceholder).addOptions(opts),
    );
}

function getRandomSuggestions(inventory) {
    const safeLinks = [];

    if (inventory?.slash) {
        for (const cmds of Object.values(inventory.slash)) {
            for (const c of cmds) {
                const cmdName = c.name.toLowerCase();


                if (cmdName === 'help' || cmdName.includes('nsfw') || cmdName.includes('hentai')) {
                    continue;
                }


                const cmdId = _cmdIds.get(cmdName);
                if (!cmdId) continue;

                if (c.subcommands && c.subcommands.length > 0) {
                    for (const sub of c.subcommands) {
                        const subName = sub.name.toLowerCase();
                        if (subName.includes('nsfw') || subName.includes('hentai')) {
                            continue;
                        }
                        safeLinks.push(`</${cmdName} ${subName}:${cmdId}>`);
                    }
                } else {
                    safeLinks.push(`</${cmdName}:${cmdId}>`);
                }
            }
        }
    }


    if (safeLinks.length === 0) {
        const helpId = _cmdIds.get('help') || '1270691569225433150';
        const botId = _cmdIds.get('bot') || helpId;
        const afkId = _cmdIds.get('afk') || helpId;
        safeLinks.push(`</bot ping:${botId}>`, `</afk set:${afkId}>`, `</bot stats:${botId}>`);
    }

    const shuffled = [...safeLinks].sort(() => 0.5 - Math.random());
    const selected = [];
    const seen = new Set();

    for (const link of shuffled) {
        if (!seen.has(link)) {
            seen.add(link);
            selected.push(link);
            if (selected.length === 4) break;
        }
    }

    return selected.join('   ');
}

function overviewSections(client, inventory) {
    const ss = countStats(inventory.slash);
    const ps = countStats(inventory.prefix);
    const en = getRuntimeEntitlementSnapshot();
    const up = process.uptime();
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);

    const tip = getRandomSuggestions(inventory);

    return [
        `### ${getEmoji('commands')} ${lang.help.content.cmdSnapshot}\n• ${lang.help.content.slash}: **${ss.master}** ${lang.help.content.master} / **${ss.sub}** ${lang.help.content.sub}\n• ${lang.help.content.prefix}: **${ps.master}** ${lang.help.content.master} / **${ps.sub}** ${lang.help.content.sub}\n• ${lang.help.content.total}: **${ss.total + ps.total}**\n• ${lang.help.content.uptime}: **${h}h ${m}m ${s}s**`,
        `### ${getEmoji('folder')} ${lang.help.content.categories}\n• ${lang.help.content.slash}: **${Object.keys(inventory.slash || {}).length}**\n• ${lang.help.content.prefix}: **${Object.keys(inventory.prefix || {}).length}**`,
        `### ${getEmoji('security')} ${lang.help.content.runtime}\n${en.active ? lang.help.content.entitlementActive.replace('{source}', en.source).replace('{user}', en.user?.username || lang.help.content.unknownUser) : lang.help.content.entitlementPending}`,
        `> **${getEmoji('help')} ${lang.suggestions}:** ${tip}`,
        `${getEmoji('search')} ${lang.help.content.navPrompt}`,
    ];
}

function typeSections(type, grouped) {
    const st = countStats(grouped);
    const names = Object.keys(grouped || {}).sort((a, b) => a.localeCompare(b));
    const lines = names.length
        ? names.map(n => lang.help.content.categoryCommandsCount.replace('{category}', capitalize(n)).replace('{count}', (grouped[n] || []).length)).join('\n')
        : `\`${lang.help.content.noEnabledCategories}\``;
    return [
        `### ${getEmoji(type === 'prefix' ? 'folder' : 'commands')} ${capitalize(type)} ${lang.help.content.commands}\n• ${lang.help.content.master}: **${st.master}** | ${lang.help.content.sub}: **${st.sub}** | ${lang.help.content.total}: **${st.total}**`,
        `### ${getEmoji('folder')} ${lang.help.content.categories}\n${lines}`,
        `${getEmoji('home')} ${lang.help.content.selectCatBelow}`,
    ];
}

function categorySections(type, catName, cmds, page, total) {
    const pre = cmdPrefix(type);
    const label = type === 'prefix' ? lang.help.content.prefix : lang.help.content.slash;
    const subCnt = cmds.reduce((a, c) => a + c.subcommands.length, 0);

    const lines = cmds.length
        ? cmds.map((c, i) => {
            const subCountTemplate = c.subcommands.length === 1 ? lang.help.content.subCountSingle : lang.help.content.subCountPlural;
            const sub = c.subcommands.length ? ` ${subCountTemplate.replace('{count}', c.subcommands.length)}` : '';
            const link = (type === 'slash' && c.subcommands.length) ? formatCommandLink(c.name, c.subcommands[0].name) : formatCommandLink(c.name);
            return `**${i + 1}.** ${link}${sub}\n${trunc(c.description || lang.help.content.noDescriptionAvailable, ITEM_DESC_LIMIT)}`;
        })
        : [`\`${lang.help.content.noCommandsInCat}\``];

    const prefixInfoStr = lang.help.content.prefixInfo.replace('{prefix}', pre);
    return [
        `### ${getEmoji('commands')} ${lang.help.content.catHeader.replace('{catName}', capitalize(catName)).replace('{type}', label)}\n• ${lang.help.content.commands}: **${cmds.length}** | ${lang.help.content.subs}: **${subCnt}** | ${pageLabel(page, total)} | ${prefixInfoStr}`,
        lines.join('\n\n'),
        `${getEmoji('search')} ${lang.help.content.useSelectorForDetails}`,
    ];
}

function commandSections(type, catName, cmd, subs, page, total) {
    const label = type === 'prefix' ? lang.help.content.prefix : lang.help.content.slash;
    const ref = (type === 'slash' && cmd.subcommands.length) ? formatCommandLink(cmd.name, cmd.subcommands[0].name) : formatCommandLink(cmd.name);

    const sections = [
        `### ${getEmoji('info')} ${lang.help.content.cmdDetails}\n• ${ref} | **${capitalize(catName)}** | **${label}** | \`${cmd.file}\`\n• ${pageLabel(page, total)}`,
        `### ${getEmoji('commands')} ${lang.help.content.description}\n${trunc(cmd.description || lang.help.content.noDescriptionAvailable, 1_500)}`,
    ];

    if (subs.length) {
        const subLines = subs.map((s, i) => `**${i + 1}.** ${formatCommandLink(cmd.name, s.name)}\n${trunc(s.description || lang.help.select.noDescription, 110)}`);
        sections.push(`### ${getEmoji('folder')} ${lang.help.content.subcommands}\n${subLines.join('\n\n')}`);
    } else {
        sections.push(`### ${getEmoji('warning')} ${lang.help.content.subcommands}\n\`${lang.help.content.noSubcommands}\``);
    }

    return sections;
}

function emojiSections() {
    return [
        `### ${getEmoji('help')} ${lang.help.content.emojiRegistry}\n${lang.help.content.emojiRegistryDesc}`,
        `### ${getEmoji('tools')} ${lang.help.content.emojiExport}\n${lang.help.content.emojiExportDesc}`,
        `${getEmoji('success')} ${lang.help.content.emojiFooter}`,
    ];
}

function buildNavigationRow(backId, prevId, nextId, prevDisabled, nextDisabled, hasPages) {
    return new ActionRowBuilder().addComponents(
        btn(lang.help.nav.back, backId, 'back', ButtonStyle.Secondary),
        btn(lang.help.nav.previous, prevId, 'back', ButtonStyle.Secondary, !hasPages || prevDisabled),
        btn(lang.help.nav.next, nextId, 'next', ButtonStyle.Secondary, !hasPages || nextDisabled),
        closeBtn('help', lang.help.nav.close)
    );
}

function buildOverview(client, inventory) {
    return buildCard({
        title: `${getEmoji('help')} ${lang.help.panel.centerTitle.replace('{botName}', client.user?.username || lang.help.content.botFallback)}`,
        sections: overviewSections(client, inventory),
        rows: [
            tabsRow('overview'),
            allCategorySelect(inventory),
            new ActionRowBuilder().addComponents(
                linkBtn(lang.help.nav.support, 'support', 'https://discord.gg/xQF9f9yUEM'),
                linkBtn(lang.help.nav.github, 'github', 'https://github.com/PonnalaShiva'),
                linkBtn(lang.help.nav.docs, 'help', 'https://www.fluenosity.com/allinone'),
                closeBtn('help', lang.help.nav.close)
            ),
        ].filter(Boolean),
        bannerURL: HELP_BANNER_URL,
    });
}

function buildTypeView(type, inventory, selectedCat = null) {
    const grouped = type === 'prefix' ? inventory.prefix : inventory.slash;
    return buildCard({
        title: `${getEmoji('compass')} ${lang.help.panel.explorerTitle.replace('{type}', capitalize(type))}`,
        sections: typeSections(type, grouped),
        rows: [tabsRow(type), typeCategorySelect(type, grouped, selectedCat), buildSubNavigationRow('help_back_overview')].filter(Boolean),
        bannerURL: HELP_BANNER_URL,
    });
}

function buildCategoryView(type, catName, cmds, page, total, currentCmd = null) {
    const nav = buildNavigationRow(
        `help_back_type:${type}`,
        `help_prev:category`,
        `help_next:category`,
        page <= 0,
        page >= total - 1,
        total > 1
    );
    return buildCard({
        title: `${getEmoji('folder')} ${lang.help.panel.categoryTitle.replace('{catName}', capitalize(catName))}`,
        sections: categorySections(type, catName, cmds, page, total),
        rows: [tabsRow(type), commandSelect(type, catName, cmds, currentCmd), nav].filter(Boolean),
        bannerURL: HELP_BANNER_URL,
    });
}

function buildCommandView(type, catName, cmd, subs, page, total, allCmds) {
    const nav = buildNavigationRow(
        `help_back_category:${type}:${catName}`,
        `help_prev:command`,
        `help_next:command`,
        page <= 0,
        page >= total - 1,
        total > 1
    );
    return buildCard({
        title: `${getEmoji('info')} ${lang.help.panel.referenceTitle}`,
        sections: commandSections(type, catName, cmd, subs, page, total),
        rows: [tabsRow(type), commandSelect(type, catName, allCmds, cmd.name), nav].filter(Boolean),
        bannerURL: HELP_BANNER_URL,
    });
}

function buildEmojiView() {
    return buildCard({
        title: `${getEmoji('tools')} ${lang.help.panel.emojiTitle}`,
        sections: emojiSections(),
        rows: [tabsRow('emoji'), buildSubNavigationRow('help_back_overview')],
        bannerURL: HELP_BANNER_URL,
    });
}

function renderState(client, inventory, state) {
    switch (state.mode) {
        case 'emoji':
            return [buildEmojiView()];

        case 'slash':
        case 'prefix':
            return [buildTypeView(state.mode, inventory, state.category || null)];

        case 'category': {
            const grouped = state.type === 'prefix' ? inventory.prefix : inventory.slash;
            const all = grouped?.[state.category] || [];
            const pages = pageCmds(all);
            const pg = clamp(state.page || 0, pages.length);
            state.page = pg;
            return [buildCategoryView(state.type, state.category, pages[pg] || [], pg, pages.length, state.commandName || null)];
        }

        case 'command': {
            const grouped = state.type === 'prefix' ? inventory.prefix : inventory.slash;
            const all = grouped?.[state.category] || [];
            const cmd = all.find(c => c.name === state.commandName);

            if (!cmd) {
                state.mode = 'category';
                const pages = pageCmds(all);
                const pg = clamp(state.page || 0, pages.length);
                state.page = pg;
                return [buildCategoryView(state.type, state.category, pages[pg] || [], pg, pages.length)];
            }

            const subPages = pageSubs(cmd.subcommands || []);
            const sp = clamp(state.subPage || 0, subPages.length);
            state.subPage = sp;
            return [buildCommandView(state.type, state.category, cmd, subPages[sp] || [], sp, subPages.length, all)];
        }

        default:
            return [buildOverview(client, inventory)];
    }
}

function applyInteraction(customId, values, state, inventory) {

    if (customId === 'help_tab_overview') {
        return Object.assign(state, { mode: 'overview', type: null, category: null, commandName: null, page: 0, subPage: 0 });
    }
    if (customId === 'help_tab_slash') {
        return Object.assign(state, { mode: 'slash', type: 'slash', category: Object.keys(inventory.slash || {})[0] || null, commandName: null, page: 0, subPage: 0 });
    }
    if (customId === 'help_tab_prefix') {
        return Object.assign(state, { mode: 'prefix', type: 'prefix', category: Object.keys(inventory.prefix || {})[0] || null, commandName: null, page: 0, subPage: 0 });
    }
    if (customId === 'help_tab_emoji') {
        return Object.assign(state, { mode: 'emoji', type: null, category: null, commandName: null, page: 0, subPage: 0 });
    }


    if (customId === 'help_back_overview') {
        return Object.assign(state, { mode: 'overview', type: null, category: null, commandName: null, page: 0, subPage: 0 });
    }
    if (customId.startsWith('help_back_type:')) {
        const t = customId.split(':')[1];
        return Object.assign(state, { mode: t, type: t, category: Object.keys((t === 'prefix' ? inventory.prefix : inventory.slash) || {})[0] || null, commandName: null, page: 0, subPage: 0 });
    }
    if (customId.startsWith('help_back_category:')) {
        const parts = customId.split(':');
        const t = parts[1];
        const cat = parts.slice(2).join(':');
        return Object.assign(state, { mode: 'category', type: t, category: cat, commandName: null, subPage: 0 });
    }


    if (customId === 'help_category_select') {
        const raw = String(values[0] || '');
        const colon = raw.indexOf(':');
        const t = colon >= 0 ? raw.slice(0, colon) : 'slash';
        const cat = colon >= 0 ? raw.slice(colon + 1) : raw;
        return Object.assign(state, { mode: 'category', type: t, category: cat, commandName: null, page: 0, subPage: 0 });
    }
    if (customId.startsWith('help_category_select:')) {
        const t = customId.split(':')[1];
        return Object.assign(state, { mode: 'category', type: t, category: String(values[0] || ''), commandName: null, page: 0, subPage: 0 });
    }


    if (customId.startsWith('help_command_select:')) {
        const parts = customId.split(':');
        const t = parts[1];
        const cat = parts.slice(2).join(':');
        return Object.assign(state, { mode: 'command', type: t, category: cat, commandName: String(values[0] || ''), subPage: 0 });
    }


    if (customId.startsWith('help_prev:') || customId.startsWith('help_next:')) {
        const dirMode = customId.split(':')[1];
        const delta = customId.startsWith('help_prev:') ? -1 : 1;

        if (dirMode === 'category' && state.mode === 'category') {
            const grouped = state.type === 'prefix' ? inventory.prefix : inventory.slash;
            const pages = pageCmds(grouped?.[state.category] || []);
            state.page = clamp((state.page || 0) + delta, pages.length);
        }

        if (dirMode === 'command' && state.mode === 'command') {
            const grouped = state.type === 'prefix' ? inventory.prefix : inventory.slash;
            const cmd = (grouped?.[state.category] || []).find(c => c.name === state.commandName);
            if (cmd) {
                const pages = pageSubs(cmd.subcommands || []);
                state.subPage = clamp((state.subPage || 0) + delta, pages.length);
            }
        }
    }
}

async function handleComponent(interaction) {
    if (!interaction.customId?.startsWith('help_')) return false;

    const messageId = interaction.message.id;
    const clickerId = interaction.user.id;


    if (interaction.customId === 'help_close') {
        const session = sessionManager.get(messageId);
        if (session && clickerId !== session.state.userId) {
            await replyUnauthorized(interaction, session.state.userId, 'help');
            return true;
        }

        sessionManager.close(messageId);
        const closedCard = cards.closed(formatCommandLink('help'));
        await closeAndAutoDelete(interaction, closedCard);


        await getCommandMentionMap(interaction.client, interaction).catch(() => { });
        return true;
    }

    const session = sessionManager.get(messageId);

    if (!session) {
        await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.sessionExpired}`);
        return true;
    }

    if (clickerId !== session.state.userId) {
        await replyUnauthorized(interaction, session.state.userId, 'help');
        return true;
    }

    try {
        await deferUpdate(interaction);
    } catch {
        return true;
    }

    sessionManager.touch(interaction.client, interaction.channelId, messageId);
    await getCommandMentionMap(interaction.client, interaction).catch(() => { });

    const { state, inventory } = session;

    try {
        applyInteraction(interaction.customId, interaction.values ?? [], state, inventory);
    } catch (err) {
        console.error('[Help] applyInteraction threw:', err);
        return true;
    }

    try {
        const components = renderState(interaction.client, inventory, state);
        await editV2(interaction, components);
    } catch (err) {
        console.error('[Help] message.edit failed:', err.message);
        try {
            const errCard = cards.error(
                lang.help.panel.renderErrorTitle,
                lang.help.panel.renderErrorDesc.replace('{error}', trunc(err.message, 80))
            );
            await editV2(interaction, errCard);
        } catch { }
    }

    return true;
}

function buildInitialState(input) {
    if (!input) return { mode: 'overview' };
    const v = String(input).trim().toLowerCase();
    if (v === 'main' || v === 'overview') return { mode: 'overview' };
    if (v === 'emoji' || v === 'emojis') return { mode: 'emoji' };

    if (v.includes(':')) {
        const idx = v.indexOf(':');
        const type = v.slice(0, idx);
        const cat = v.slice(idx + 1);
        if ((type === 'slash' || type === 'prefix') && cat) return { mode: 'category', type, category: cat };
    }

    const type = getCategoryType(v);
    return type
        ? { mode: 'category', type, category: v }
        : { mode: 'overview' };
}

module.exports = {
    data: (() => {
        const enabled = getEnabledCategories();
        const choices = [
            { name: 'Main Menu', value: 'main' },
            { name: 'Emoji Tools', value: 'emoji' },
            ...[...enabled.slash, ...enabled.prefix].map(cat => ({ name: capitalize(cat), value: cat })),
        ];

        const builder = new SlashCommandBuilder()
            .setName('help')
            .setDescription('Displays the bot command hub');

        if (choices.length) {
            builder.addStringOption(o =>
                o.setName('category')
                    .setDescription('Select a category to browse')
                    .setRequired(false)
                    .addChoices(...choices.slice(0, 25)),
            );
        }
        return builder;
    })(),

    handleComponent,

    _invalidateCache: invalidateCache,

    async execute(interaction) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await deferReply(interaction);
            }
        } catch (err) {
            console.error('[Help] deferReply failed:', err.message);
            return;
        }

        await getCommandMentionMap(interaction.client, interaction);
        const inventory = getInventory();
        const rawInput = isSlash
            ? interaction.options.getString('category')
            : String(interaction.content || '').split(' ').slice(1)[0] || null;

        const initial = buildInitialState(rawInput);
        const userId = isSlash ? interaction.user.id : interaction.author.id;
        const state = {
            ...initial,
            userId,
            type: initial.type || null,
            category: initial.category || null,
            commandName: null,
            page: 0,
            subPage: 0,
        };

        try {
            const components = renderState(interaction.client, inventory, state);
            const message = await sendV2(interaction, components);
            if (message) {
                sessionManager.open(interaction.client, interaction.channelId, message.id, state, { inventory });
            }
        } catch (err) {
            console.error('[Help] Initial render failed:', err.message);
            await replyEphemeral(interaction, lang.help.error.loadFailed).catch(() => { });
        }
    },

    helpers: { getInventory, invalidateCache, renderState },
};
