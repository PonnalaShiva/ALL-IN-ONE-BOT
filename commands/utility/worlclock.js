 

'use strict';

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const {
    createSessionManager,
    buildCard,
    cards,
    btn,
    closeBtn,
    deferUpdate,
    deferReply,
    sendV2,
    editV2,
    closeAndAutoDelete,
    replyUnauthorized,
    replyEphemeral,
    ACCENT,
    createInterpolatableProxy,
    formatCommandLink,
    cacheCommandIds
} = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = { ...rawLang, worldclock: createInterpolatableProxy(rawLang.worldclock) };
const sessions = createSessionManager({
    ttlMs: 10 * 60 * 1000,
    buildExpiredCard: () => cards.expired(formatCommandLink('world-clock')),
});

const timeZones = {
    "Europe": {
        color: 0x3498DB,
        cities: [
            { name: "London", country: "United Kingdom", flag: "🇬🇧", tz: "Europe/London", offset: "GMT+0/+1" },
            { name: "Berlin", country: "Germany", flag: "🇩🇪", tz: "Europe/Berlin", offset: "GMT+1/+2" },
            { name: "Paris", country: "France", flag: "🇫🇷", tz: "Europe/Paris", offset: "GMT+1/+2" },
            { name: "Madrid", country: "Spain", flag: "🇪🇸", tz: "Europe/Madrid", offset: "GMT+1/+2" },
            { name: "Moscow", country: "Russia", flag: "🇷🇺", tz: "Europe/Moscow", offset: "GMT+3" },
            { name: "Rome", country: "Italy", flag: "🇮🇹", tz: "Europe/Rome", offset: "GMT+1/+2" },
            { name: "Stockholm", country: "Sweden", flag: "🇸🇪", tz: "Europe/Stockholm", offset: "GMT+1/+2" },
            { name: "Amsterdam", country: "Netherlands", flag: "🇳🇱", tz: "Europe/Amsterdam", offset: "GMT+1/+2" },
            { name: "Zurich", country: "Switzerland", flag: "🇨🇭", tz: "Europe/Zurich", offset: "GMT+1/+2" },
            { name: "Vienna", country: "Austria", flag: "🇦🇹", tz: "Europe/Vienna", offset: "GMT+1/+2" }
        ]
    },
    "Americas": {
        color: 0xE74C3C,
        cities: [
            { name: "New York", country: "United States", flag: "🇺🇸", tz: "America/New_York", offset: "GMT-5/-4" },
            { name: "Los Angeles", country: "United States", flag: "🇺🇸", tz: "America/Los_Angeles", offset: "GMT-8/-7" },
            { name: "Chicago", country: "United States", flag: "🇺🇸", tz: "America/Chicago", offset: "GMT-6/-5" },
            { name: "Mexico City", country: "Mexico", flag: "🇲🇽", tz: "America/Mexico_City", offset: "GMT-6" },
            { name: "São Paulo", country: "Brazil", flag: "🇧🇷", tz: "America/Sao_Paulo", offset: "GMT-3" },
            { name: "Toronto", country: "Canada", flag: "🇨🇦", tz: "America/Toronto", offset: "GMT-5/-4" },
            { name: "Buenos Aires", country: "Argentina", flag: "🇦🇷", tz: "America/Argentina/Buenos_Aires", offset: "GMT-3" },
            { name: "Lima", country: "Peru", flag: "🇵🇪", tz: "America/Lima", offset: "GMT-5" },
            { name: "Vancouver", country: "Canada", flag: "🇨🇦", tz: "America/Vancouver", offset: "GMT-8/-7" },
            { name: "Miami", country: "United States", flag: "🇺🇸", tz: "America/New_York", offset: "GMT-5/-4" }
        ]
    },
    "Asia": {
        color: 0xF39C12,
        cities: [
            { name: "Beijing", country: "China", flag: "🇨🇳", tz: "Asia/Shanghai", offset: "GMT+8" },
            { name: "Tokyo", country: "Japan", flag: "🇯🇵", tz: "Asia/Tokyo", offset: "GMT+9" },
            { name: "Seoul", country: "South Korea", flag: "🇰🇷", tz: "Asia/Seoul", offset: "GMT+9" },
            { name: "Mumbai", country: "India", flag: "🇮🇳", tz: "Asia/Kolkata", offset: "GMT+5:30" },
            { name: "Jakarta", country: "Indonesia", flag: "🇮🇩", tz: "Asia/Jakarta", offset: "GMT+7" },
            { name: "Bangkok", country: "Thailand", flag: "🇹🇭", tz: "Asia/Bangkok", offset: "GMT+7" },
            { name: "Singapore", country: "Singapore", flag: "🇸🇬", tz: "Asia/Singapore", offset: "GMT+8" },
            { name: "Hong Kong", country: "Hong Kong", flag: "🇭🇰", tz: "Asia/Hong_Kong", offset: "GMT+8" },
            { name: "Manila", country: "Philippines", flag: "🇵🇭", tz: "Asia/Manila", offset: "GMT+8" },
            { name: "Kuala Lumpur", country: "Malaysia", flag: "🇲🇾", tz: "Asia/Kuala_Lumpur", offset: "GMT+8" }
        ]
    },
    "Australia & Pacific": {
        color: 0x9B59B6,
        cities: [
            { name: "Sydney", country: "Australia", flag: "🇦🇺", tz: "Australia/Sydney", offset: "GMT+11/+10" },
            { name: "Melbourne", country: "Australia", flag: "🇦🇺", tz: "Australia/Melbourne", offset: "GMT+11/+10" },
            { name: "Perth", country: "Australia", flag: "🇦🇺", tz: "Australia/Perth", offset: "GMT+8" },
            { name: "Auckland", country: "New Zealand", flag: "🇳🇿", tz: "Pacific/Auckland", offset: "GMT+13/+12" },
            { name: "Fiji", country: "Fiji", flag: "🇫🇯", tz: "Pacific/Fiji", offset: "GMT+12" },
            { name: "Honolulu", country: "Hawaii, USA", flag: "🇺🇸", tz: "Pacific/Honolulu", offset: "GMT-10" },
            { name: "Adelaide", country: "Australia", flag: "🇦🇺", tz: "Australia/Adelaide", offset: "GMT+10:30/+9:30" },
            { name: "Brisbane", country: "Australia", flag: "🇦🇺", tz: "Australia/Brisbane", offset: "GMT+10" }
        ]
    },
    "Middle East & Africa": {
        color: 0x1ABC9C,
        cities: [
            { name: "Dubai", country: "United Arab Emirates", flag: "🇦🇪", tz: "Asia/Dubai", offset: "GMT+4" },
            { name: "Riyadh", country: "Saudi Arabia", flag: "🇸🇦", tz: "Asia/Riyadh", offset: "GMT+3" },
            { name: "Istanbul", country: "Turkey", flag: "🇹🇷", tz: "Europe/Istanbul", offset: "GMT+3" },
            { name: "Cape Town", country: "South Africa", flag: "🇿🇦", tz: "Africa/Johannesburg", offset: "GMT+2" },
            { name: "Cairo", country: "Egypt", flag: "🇪🇬", tz: "Africa/Cairo", offset: "GMT+2" },
            { name: "Nairobi", country: "Kenya", flag: "🇰🇪", tz: "Africa/Nairobi", offset: "GMT+3" },
            { name: "Lagos", country: "Nigeria", flag: "🇳🇬", tz: "Africa/Lagos", offset: "GMT+1" },
            { name: "Tel Aviv", country: "Israel", flag: "🇮🇱", tz: "Asia/Jerusalem", offset: "GMT+2/+3" }
        ]
    }
};


const getTimeIcon = (hour) => {
    return hour >= 21 || hour < 6 ? getEmoji('star') : getEmoji('time');
};

const getTimeStatus = (hour) => {
    if (hour >= 6 && hour < 9) return lang.worldclock.content.timeEarlyMorning;
    if (hour >= 9 && hour < 12) return lang.worldclock.content.timeMorning;
    if (hour >= 12 && hour < 17) return lang.worldclock.content.timeAfternoon;
    if (hour >= 17 && hour < 21) return lang.worldclock.content.timeEvening;
    if (hour >= 21 || hour < 6) return lang.worldclock.content.timeNight;
    return lang.worldclock.content.timeDawn;
};

const getCurrentTimes = (regionData, format) => {
    return regionData.cities.map(place => {
        const date = new Date();
        const timeOptions = {
            timeZone: place.tz,
            hour12: format === '12',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };

        const time = date.toLocaleString("en-US", timeOptions);

        const localHour = parseInt(date.toLocaleString("en-US", {
            timeZone: place.tz,
            hour12: false,
            hour: 'numeric'
        }), 10);

        const timeIcon = getTimeIcon(localHour);
        const timeStatus = getTimeStatus(localHour);

        return `${timeIcon} ${place.flag} **${place.name}** (${place.country}) • \`${time}\` (${timeStatus}) • \`${place.offset}\``;
    }).join('\n');
};

function regionSelect(activeRegion) {
    const opts = [
        { label: lang.worldclock.select.europe, description: lang.worldclock.select.europeDesc, value: 'Europe', emoji: getButtonEmoji('world'), default: activeRegion === 'Europe' },
        { label: lang.worldclock.select.americas, description: lang.worldclock.select.americasDesc, value: 'Americas', emoji: getButtonEmoji('world'), default: activeRegion === 'Americas' },
        { label: lang.worldclock.select.asia, description: lang.worldclock.select.asiaDesc, value: 'Asia', emoji: getButtonEmoji('world'), default: activeRegion === 'Asia' },
        { label: lang.worldclock.select.pacific, description: lang.worldclock.select.pacificDesc, value: 'Australia & Pacific', emoji: getButtonEmoji('world'), default: activeRegion === 'Australia & Pacific' },
        { label: lang.worldclock.select.mea, description: lang.worldclock.select.meaDesc, value: 'Middle East & Africa', emoji: getButtonEmoji('world'), default: activeRegion === 'Middle East & Africa' }
    ];
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('worldclock_region_select')
            .setPlaceholder(lang.worldclock.select.placeholder)
            .addOptions(opts)
    );
}

function controlsRow(format) {
    return new ActionRowBuilder().addComponents(
        btn(lang.worldclock.nav.refresh, 'worldclock_refresh', 'loop', ButtonStyle.Success),
        btn(lang.worldclock.nav.switchTo({ format: format === '12' ? '24h' : '12h' }), 'worldclock_format', 'time', ButtonStyle.Secondary),
        closeBtn(lang.worldclock.nav.close, 'worldclock_close')
    );
}


function renderState(client, state) {
    const regionData = timeZones[state.mode] || timeZones.Europe;
    const pageIndex = Object.keys(timeZones).indexOf(state.mode);
    const totalPages = Object.keys(timeZones).length;

    const headerTitle = `${getEmoji('world')} **World Clock** — ${state.mode}`;
    const infoSection = `${lang.worldclock.content.region({ region: state.mode })}\n${lang.worldclock.content.format({ format: state.format === '12' ? lang.worldclock.content.format12 : lang.worldclock.content.format24 })}\n${lang.worldclock.content.syncTime({ time: Math.floor(Date.now() / 1000) })}`;
    const liveSection = `### ${getEmoji('time')} **Live Time Display**\n\n${getCurrentTimes(regionData, state.format)}`;
    const navSection = lang.worldclock.panel.navigation({ page: pageIndex + 1, totalPages, count: regionData.cities.length });

    return buildCard({
        title: headerTitle,
        accentColor: regionData.color,
        thumbnailURL: client.user.displayAvatarURL(),
        sections: [
            infoSection,
            liveSection,
            navSection,
        ],
        rows: [
            regionSelect(state.mode),
            controlsRow(state.format),
        ],
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('world-clock')
        .setDescription('Advanced world time display with interactive navigation')
        .addStringOption(option =>
            option.setName('region')
                .setDescription('Select a specific region to view')
                .setRequired(false)
                .addChoices(
                    { name: 'Europe', value: 'europe' },
                    { name: 'Americas', value: 'americas' },
                    { name: 'Asia', value: 'asia' },
                    { name: 'Australia & Pacific', value: 'pacific' },
                    { name: 'Middle East & Africa', value: 'mea' }
                )
        )
        .addStringOption(option =>
            option.setName('format')
                .setDescription('Choose time format')
                .setRequired(false)
                .addChoices(
                    { name: '12-hour (AM/PM)', value: '12' },
                    { name: '24-hour', value: '24' }
                )
        ),

    aliases: ['wc', 'clock', 'worldtime', 'worldclock'],
    category: 'utility',
    description: 'Advanced world time display with interactive navigation',
    usage: 'worldclock [region] [format]',

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('worldclock_')) return false;

        const messageId = interaction.message.id;
        const clickerId = interaction.user.id;
        const client = interaction.client;

        if (interaction.customId === 'worldclock_close') {
            const session = sessions.get(messageId);
            if (session && clickerId !== session.state.userId) {
                await replyUnauthorized(interaction, lang.worldclock.session.unauthorized({
                    emoji: getEmoji('cross'),
                    userId: session.state.userId,
                    command: formatCommandLink('world-clock')
                }));
                return true;
            }

            sessions.delete(messageId);
            const closed = cards.closed(formatCommandLink('world-clock'));
            await closeAndAutoDelete(interaction, closed, 2000);
            return true;
        }

        const session = sessions.get(messageId);
        if (!session) {
            await replyEphemeral(interaction, lang.worldclock.session.expired({
                emoji: getEmoji('warning'),
                command: formatCommandLink('world-clock')
            }));
            return true;
        }

        if (clickerId !== session.state.userId) {
            await replyUnauthorized(interaction, lang.worldclock.session.unauthorized({
                emoji: getEmoji('cross'),
                userId: session.state.userId,
                command: formatCommandLink('world-clock')
            }));
            return true;
        }

        await deferUpdate(interaction);
        sessions.touch(client, interaction.channelId, messageId);
        await cacheCommandIds(client, interaction).catch(() => { });

        const { state } = session;
        const customId = interaction.customId;

        if (customId === 'worldclock_region_select') {
            state.mode = interaction.values[0];
        } else if (customId === 'worldclock_tab_europe') {
            state.mode = 'Europe';
        } else if (customId === 'worldclock_tab_americas') {
            state.mode = 'Americas';
        } else if (customId === 'worldclock_tab_asia') {
            state.mode = 'Asia';
        } else if (customId === 'worldclock_tab_pacific') {
            state.mode = 'Australia & Pacific';
        } else if (customId === 'worldclock_tab_mea') {
            state.mode = 'Middle East & Africa';
        } else if (customId === 'worldclock_format') {
            state.format = state.format === '12' ? '24' : '12';
        } else if (customId === 'worldclock_refresh') {
            
        }

        try {
            const card = renderState(client, state);
            await editV2(interaction, card);
        } catch (err) {
            console.error('[WorldClock Component Error]:', err.message);
        }

        return true;
    },

    async execute(interaction, args = []) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await deferReply(interaction);
            }
        } catch (err) {
            console.error('[WorldClock] deferReply failed:', err.message);
            return;
        }

        const client = interaction.client;
        await cacheCommandIds(client, interaction).catch(() => { });

        let regionOption = null;
        let formatOption = '12';

        if (isSlash) {
            const rOpt = interaction.options.getString('region');
            const fOpt = interaction.options.getString('format');

            const regionMap = {
                'europe': 'Europe',
                'americas': 'Americas',
                'asia': 'Asia',
                'pacific': 'Australia & Pacific',
                'mea': 'Middle East & Africa'
            };

            if (rOpt) regionOption = regionMap[rOpt];
            if (fOpt) formatOption = fOpt;
        } else {
            const regionArg = args[0]?.toLowerCase();
            const formatArg = args[1];

            const regionMap = {
                'europe': 'Europe',
                'americas': 'Americas',
                'asia': 'Asia',
                'pacific': 'Australia & Pacific',
                'mea': 'Middle East & Africa'
            };

            if (regionArg) {
                if (regionMap[regionArg]) {
                    regionOption = regionMap[regionArg];
                } else {
                    const available = Object.keys(regionMap).map(r => `\`${r}\``).join(', ');
                    const helpCard = cards.error(
                        lang.worldclock.panel.invalidRegionTitle({ emoji: '' }).trim(),
                        lang.worldclock.panel.invalidRegionDesc({ available })
                    );

                    const replyMsg = await sendV2(interaction, helpCard);
                    if (replyMsg) {
                        setTimeout(() => {
                            replyMsg.delete().catch(() => { });
                            interaction.delete?.().catch(() => { });
                        }, 15000);
                    }
                    return;
                }
            }

            if (formatArg === '24' || formatArg === '12') {
                formatOption = formatArg;
            }
        }

        const userId = isSlash ? interaction.user.id : interaction.author.id;
        const state = {
            mode: regionOption || 'Europe',
            format: formatOption,
            userId
        };

        try {
            const card = renderState(client, state);
            const message = await sendV2(interaction, card);

            if (!isSlash && interaction.delete) {
                await interaction.delete().catch(() => { });
            }

            if (message) {
                sessions.open(client, interaction.channelId, message.id, state);
            }
        } catch (err) {
            console.error('[WorldClock Execute Error]:', err.message);
        }
    }
};
