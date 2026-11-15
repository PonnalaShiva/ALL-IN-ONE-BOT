
const { SlashCommandBuilder } = require('discord.js');
const {
    TextDisplayBuilder,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MediaGalleryBuilder,
    StringSelectMenuBuilder
} = require('discord.js');
const ytsr = require('ytsr');
const ytpl = require('ytpl');
const play = require('play-dl');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { btn, linkBtn } = require('../../UI');


const searchCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; 

function getCached(key) {
    const cached = searchCache.get(key);
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }
    return null;
}

function setCached(key, data) {
    searchCache.set(key, {
        expires: Date.now() + CACHE_TTL,
        data
    });
}


async function safeGetVideoDetails(url) {
    try {
        const info = await play.video_basic_info(url);
        return info.video_details;
    } catch (err) {
        console.error('[YouTube Video Details Error]', err.message);
        return null;
    }
}


async function editResponse(interaction, payload) {
    const isSlash = Boolean(interaction.isChatInputCommand?.() || interaction.isButton?.() || interaction.isStringSelectMenu?.());
    if (isSlash) {
        return await interaction.editReply(payload);
    } else {
        if (interaction.responseMessage) {
            return await interaction.responseMessage.edit(payload);
        } else {
            const msg = await interaction.reply(payload);
            interaction.responseMessage = msg;
            return msg;
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('youtube')
        .setDescription('Complete YouTube browsing suite')
        
        .addSubcommand(sub =>
            sub.setName('search')
                .setDescription('Search for videos')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results per page').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('trending')
                .setDescription('Show trending videos')
                .addStringOption(o => o.setName('category').setDescription('Category').addChoices(
                    { name: 'All', value: 'all' },
                    { name: 'Music', value: 'music' },
                    { name: 'Gaming', value: 'gaming' },
                    { name: 'News', value: 'news' }
                ))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('popular')
                .setDescription('Most popular videos right now')
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('new')
                .setDescription('Latest uploaded videos')
                .addStringOption(o => o.setName('topic').setDescription('Topic').setRequired(false))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        
        .addSubcommand(sub =>
            sub.setName('channel')
                .setDescription('Get channel info')
                .addStringOption(o => o.setName('query').setDescription('Channel name or URL').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Recent videos').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('channel-videos')
                .setDescription('Browse channel videos')
                .addStringOption(o => o.setName('query').setDescription('Channel name').setRequired(true))
                .addStringOption(o => o.setName('sort').setDescription('Sort by').addChoices(
                    { name: 'Latest', value: 'latest' },
                    { name: 'Popular', value: 'popular' },
                    { name: 'Oldest', value: 'oldest' }
                ))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('channel-playlists')
                .setDescription('Browse channel playlists')
                .addStringOption(o => o.setName('query').setDescription('Channel name').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('channel-shorts')
                .setDescription('Browse channel shorts')
                .addStringOption(o => o.setName('query').setDescription('Channel name').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        
        .addSubcommand(sub =>
            sub.setName('playlist')
                .setDescription('Browse playlist videos')
                .addStringOption(o => o.setName('url').setDescription('Playlist URL or ID').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Videos').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('playlist-info')
                .setDescription('Get playlist details')
                .addStringOption(o => o.setName('url').setDescription('Playlist URL or ID').setRequired(true)))
        
        .addSubcommand(sub =>
            sub.setName('music')
                .setDescription('Search music videos')
                .addStringOption(o => o.setName('query').setDescription('Artist or song').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('gaming')
                .setDescription('Search gaming videos')
                .addStringOption(o => o.setName('query').setDescription('Game name').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('live')
                .setDescription('Find live streams')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(false))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('shorts')
                .setDescription('Search YouTube Shorts')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('movie')
                .setDescription('Search movies')
                .addStringOption(o => o.setName('query').setDescription('Movie name').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        
        .addSubcommand(sub =>
            sub.setName('today')
                .setDescription('Videos uploaded today')
                .addStringOption(o => o.setName('topic').setDescription('Topic').setRequired(false))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('this-week')
                .setDescription('Videos uploaded this week')
                .addStringOption(o => o.setName('topic').setDescription('Topic').setRequired(false))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('this-month')
                .setDescription('Videos uploaded this month')
                .addStringOption(o => o.setName('topic').setDescription('Topic').setRequired(false))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        
        .addSubcommand(sub =>
            sub.setName('short-videos')
                .setDescription('Videos under 4 minutes')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('long-videos')
                .setDescription('Videos over 20 minutes')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        
        .addSubcommand(sub =>
            sub.setName('hd')
                .setDescription('Search HD videos only')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('4k')
                .setDescription('Search 4K videos only')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        
        .addSubcommand(sub =>
            sub.setName('vr')
                .setDescription('Search VR/360° videos')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(false))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('subtitles')
                .setDescription('Videos with subtitles')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('creative-commons')
                .setDescription('Creative Commons licensed videos')
                .addStringOption(o => o.setName('query').setDescription('Search term').setRequired(true))
                .addIntegerOption(o => o.setName('limit').setDescription('Results').setMinValue(1).setMaxValue(10))),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        
        if (isSlash) {
            try {
                await interaction.deferReply();
            } catch (err) {
                console.error('[YouTube] Defer failed:', err.message);
                return interaction.reply({ content: lang.youtube.error.deferFailed, flags: MessageFlags.Ephemeral }).catch(() => { });
            }
        }

        
        const guildId = interaction.guild?.id;
        let prefix = '!';
        if (guildId) {
            try {
                const { getServerConfig } = require('../../utils/cacheHelpers');
                const serverConfig = await getServerConfig(guildId);
                if (serverConfig?.prefix) {
                    prefix = serverConfig.prefix;
                }
            } catch (_) { }
        }
        interaction.guildPrefix = prefix;

        const VALID_SUBS = new Set([
            'search', 'trending', 'popular', 'new', 'channel', 'channel-videos',
            'channel-playlists', 'channel-shorts', 'playlist', 'playlist-info',
            'music', 'gaming', 'live', 'shorts', 'movie', 'today', 'this-week',
            'this-month', 'short-videos', 'long-videos', 'hd', '4k', 'vr',
            'subtitles', 'creative-commons'
        ]);

        let sub = 'search';
        let limit = 5;
        let query = '';
        let url = '';
        let category = 'all';
        let topic = '';
        let sort = 'latest';

        if (isSlash) {
            sub = interaction.options.getSubcommand();
            limit = interaction.options.getInteger('limit') || 5;
        } else {
            
            const rawSub = args?.[0]?.toLowerCase();
            if (rawSub && VALID_SUBS.has(rawSub)) {
                sub = rawSub;
                const remainingArgs = args.slice(1);
                
                const lastArg = remainingArgs[remainingArgs.length - 1];
                if (lastArg && /^\d+$/.test(lastArg)) {
                    const parsedLimit = parseInt(lastArg, 10);
                    if (parsedLimit >= 1 && parsedLimit <= 10) {
                        limit = parsedLimit;
                        remainingArgs.pop();
                    }
                }

                const joined = remainingArgs.join(' ');
                query = joined;
                url = joined;
                topic = joined;
                category = joined || 'all';

                if (sub === 'channel-videos') {
                    const lastWord = remainingArgs[remainingArgs.length - 1]?.toLowerCase();
                    if (['latest', 'popular', 'oldest'].includes(lastWord)) {
                        sort = lastWord;
                        remainingArgs.pop();
                        query = remainingArgs.join(' ');
                    }
                } else if (sub === 'trending') {
                    const lastWord = remainingArgs[remainingArgs.length - 1]?.toLowerCase();
                    if (['all', 'music', 'gaming', 'news'].includes(lastWord)) {
                        category = lastWord;
                        remainingArgs.pop();
                    }
                }
            } else {
                sub = 'search';
                const remainingArgs = [...(args || [])];
                const lastArg = remainingArgs[remainingArgs.length - 1];
                if (lastArg && /^\d+$/.test(lastArg)) {
                    const parsedLimit = parseInt(lastArg, 10);
                    if (parsedLimit >= 1 && parsedLimit <= 10) {
                        limit = parsedLimit;
                        remainingArgs.pop();
                    }
                }
                query = remainingArgs.join(' ');
            }

            
            interaction.options = {
                getSubcommand: () => sub,
                getInteger: (name) => name === 'limit' ? limit : null,
                getString: (name) => {
                    if (name === 'query') return query;
                    if (name === 'url') return url;
                    if (name === 'category') return category;
                    if (name === 'topic') return topic;
                    if (name === 'sort') return sort;
                    return null;
                },
                getBoolean: (name) => null,
                getUser: (name) => null
            };
        }

        
        const updateStatus = async (messageText) => {
            try {
                const statusContainer = new ContainerBuilder().setAccentColor(0xFFA500);
                statusContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        lang.youtube.status.loadingTitle
                            .replace('{emoji}', getEmoji('time'))
                            .replace('{message}', messageText)
                    )
                );
                await editResponse(interaction, {
                    components: [statusContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (err) {
                
            }
        };

        try {
            switch (sub) {
                case 'search':
                    await updateStatus(lang.youtube.status.searching);
                    return await this.handleSearch(interaction, limit);
                case 'trending':
                    await updateStatus(lang.youtube.status.trending);
                    return await this.handleTrending(interaction, limit);
                case 'popular':
                    await updateStatus(lang.youtube.status.popular);
                    return await this.handlePopular(interaction, limit);
                case 'new':
                    await updateStatus(lang.youtube.status.newVideos);
                    return await this.handleNew(interaction, limit);
                case 'channel':
                    await updateStatus(lang.youtube.status.channel);
                    return await this.handleChannel(interaction, limit);
                case 'channel-videos':
                    await updateStatus(lang.youtube.status.channelVideos);
                    return await this.handleChannelVideos(interaction, limit);
                case 'channel-playlists':
                    await updateStatus(lang.youtube.status.channelPlaylists);
                    return await this.handleChannelPlaylists(interaction);
                case 'channel-shorts':
                    await updateStatus(lang.youtube.status.channelShorts);
                    return await this.handleChannelShorts(interaction, limit);
                case 'playlist':
                    await updateStatus(lang.youtube.status.playlist);
                    return await this.handlePlaylist(interaction, limit);
                case 'playlist-info':
                    await updateStatus(lang.youtube.status.playlistInfo);
                    return await this.handlePlaylistInfo(interaction);
                case 'music':
                    await updateStatus(lang.youtube.status.music);
                    return await this.handleMusic(interaction, limit);
                case 'gaming':
                    await updateStatus(lang.youtube.status.gaming);
                    return await this.handleGaming(interaction, limit);
                case 'live':
                    await updateStatus(lang.youtube.status.live);
                    return await this.handleLive(interaction, limit);
                case 'shorts':
                    await updateStatus(lang.youtube.status.shorts);
                    return await this.handleShorts(interaction, limit);
                case 'movie':
                    await updateStatus(lang.youtube.status.movie);
                    return await this.handleMovie(interaction, limit);
                case 'today':
                    await updateStatus(lang.youtube.status.today);
                    return await this.handleToday(interaction, limit);
                case 'this-week':
                    await updateStatus(lang.youtube.status.thisWeek);
                    return await this.handleThisWeek(interaction, limit);
                case 'this-month':
                    await updateStatus(lang.youtube.status.thisMonth);
                    return await this.handleThisMonth(interaction, limit);
                case 'short-videos':
                    await updateStatus(lang.youtube.status.shortVideos);
                    return await this.handleShortVideos(interaction, limit);
                case 'long-videos':
                    await updateStatus(lang.youtube.status.longVideos);
                    return await this.handleLongVideos(interaction, limit);
                case 'hd':
                    await updateStatus(lang.youtube.status.hd);
                    return await this.handleHD(interaction, limit);
                case '4k':
                    await updateStatus(lang.youtube.status.fourK);
                    return await this.handle4K(interaction, limit);
                case 'vr':
                    await updateStatus(lang.youtube.status.vr);
                    return await this.handleVR(interaction, limit);
                case 'subtitles':
                    await updateStatus(lang.youtube.status.subtitles);
                    return await this.handleSubtitles(interaction, limit);
                case 'creative-commons':
                    await updateStatus(lang.youtube.status.creativeCommons);
                    return await this.handleCreativeCommons(interaction, limit);
            }
        } catch (err) {
            console.error('[YouTube Error]', err.message);
            return this.sendError(interaction, lang.youtube.error.fetchFailed);
        }
    },

    
    async handleSearch(interaction, limit) {
        const query = interaction.options.getString('query');
        if (!query?.trim()) return this.sendError(interaction, lang.youtube.error.provideQuery);
        const results = await safeYTSearch(query, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `Search: ${query}`, limit);
    },

    async handleTrending(interaction, limit) {
        const category = interaction.options.getString('category') || 'all';
        const results = await safeYTSearch(`trending ${category}`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noTrending);
        return this.renderPaginatedResults(interaction, results, `Trending: ${category}`, limit);
    },

    async handlePopular(interaction, limit) {
        const results = await safeYTSearch('most popular', 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noPopular);
        return this.renderPaginatedResults(interaction, results, 'Popular Videos', limit);
    },

    async handleNew(interaction, limit) {
        const topic = interaction.options.getString('topic') || '';
        const results = await safeYTSearch(`${topic} latest`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noNew);
        return this.renderPaginatedResults(interaction, results, 'Latest Videos', limit);
    },

    async handleChannel(interaction, limit) {
        const query = interaction.options.getString('query');
        if (!query?.trim()) return this.sendError(interaction, lang.youtube.error.provideChannelQuery);
        const { info, videos } = await safeGetChannel(query, limit);
        return this.renderChannel(interaction, info, videos);
    },

    async handleChannelVideos(interaction, limit) {
        const query = interaction.options.getString('query');
        if (!query?.trim()) return this.sendError(interaction, lang.youtube.error.provideChannelQuery);
        const sort = interaction.options.getString('sort') || 'latest';
        const { videos } = await safeGetChannel(query, 50);
        if (!videos.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, videos, `${query} - ${sort}`, limit);
    },

    async handleChannelPlaylists(interaction) {
        return this.sendError(interaction, lang.youtube.error.playlistsUnavailable);
    },

    async handleChannelShorts(interaction, limit) {
        const query = interaction.options.getString('query');
        if (!query?.trim()) return this.sendError(interaction, lang.youtube.error.provideChannelQuery);
        const results = await safeYTSearch(`${query} shorts`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noShorts);
        return this.renderPaginatedResults(interaction, results, `${query} Shorts`, limit);
    },

    async handlePlaylist(interaction, limit) {
        const url = interaction.options.getString('url');
        if (!url?.trim()) return this.sendError(interaction, lang.youtube.error.providePlaylistUrl);
        const videos = await safeGetPlaylist(url, 50);
        if (!videos.length) return this.sendError(interaction, lang.youtube.error.playlistEmpty);
        return this.renderPaginatedResults(interaction, videos, 'Playlist Videos', limit);
    },

    async handlePlaylistInfo(interaction) {
        const url = interaction.options.getString('url');
        if (!url?.trim()) return this.sendError(interaction, lang.youtube.error.providePlaylistUrl);
        const videos = await safeGetPlaylist(url, 50);
        if (!videos.length) return this.sendError(interaction, lang.youtube.error.playlistNotFound);

        const prefix = interaction.guildPrefix || '!';
        const container = new ContainerBuilder().setAccentColor(0xFF0000);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                lang.youtube.render.playlistInfoTitle
                    .replace('{emoji}', getEmoji('folder'))
                    .replace('{listEmoji}', getEmoji('list'))
                    .replace('{count}', videos.length)
                    .replace('{musicEmoji}', getEmoji('music'))
                    .replace('{track}', videos[0].title)
                    .replace('{linkEmoji}', getEmoji('link'))
                    .replace('{url}', url)
                    .replace('{prefix}', prefix)
            )
        );

        if (videos[0]?.thumbnail) {
            container.addSeparatorComponents(new SeparatorBuilder());
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    item => item.setURL(videos[0].thumbnail).setDescription(lang.youtube.media.firstVideoThumbnail)
                )
            );
        }

        const linkButton = new ActionRowBuilder().addComponents(
            linkBtn(lang.youtube.buttons.viewOnYouTube, 'link', url)
        );

        return editResponse(interaction, { components: [container, linkButton], flags: MessageFlags.IsComponentsV2 });
    },

    async handleMusic(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} music`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `Music: ${query}`, limit);
    },

    async handleGaming(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} gaming`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `Gaming: ${query}`, limit);
    },

    async handleLive(interaction, limit) {
        const query = interaction.options.getString('query') || 'live';
        const results = await safeYTSearch(`${query} live`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, 'Live Streams', limit);
    },

    async handleShorts(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} shorts`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noShorts);
        return this.renderPaginatedResults(interaction, results, `Shorts: ${query}`, limit);
    },

    async handleMovie(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} movie`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `Movie: ${query}`, limit);
    },

    async handleToday(interaction, limit) {
        const topic = interaction.options.getString('topic') || '';
        const results = await safeYTSearch(`${topic} today`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, 'Today\'s Videos', limit);
    },

    async handleThisWeek(interaction, limit) {
        const topic = interaction.options.getString('topic') || '';
        const results = await safeYTSearch(`${topic} this week`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, 'This Week', limit);
    },

    async handleThisMonth(interaction, limit) {
        const topic = interaction.options.getString('topic') || '';
        const results = await safeYTSearch(`${topic} this month`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, 'This Month', limit);
    },

    async handleShortVideos(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} short`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `Short: ${query}`, limit);
    },

    async handleLongVideos(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} long`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `Long: ${query}`, limit);
    },

    async handleHD(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} HD`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `HD: ${query}`, limit);
    },

    async handle4K(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} 4K`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `4K: ${query}`, limit);
    },

    async handleVR(interaction, limit) {
        const query = interaction.options.getString('query') || 'VR';
        const results = await safeYTSearch(`${query} 360`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, 'VR/360°', limit);
    },

    async handleSubtitles(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} subtitles`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `Subtitled: ${query}`, limit);
    },

    async handleCreativeCommons(interaction, limit) {
        const query = interaction.options.getString('query');
        const results = await safeYTSearch(`${query} creative commons`, 50);
        if (!results.length) return this.sendError(interaction, lang.youtube.error.noVideos);
        return this.renderPaginatedResults(interaction, results, `CC: ${query}`, limit);
    },

    
    async renderPaginatedResults(interaction, results, title, pageSize) {
        let page = 0;
        const totalPages = Math.ceil(results.length / pageSize);
        const sessionId = Date.now().toString(36);
        let currentVideo = null;

        const isSlash = Boolean(interaction.isChatInputCommand?.());

        const buildContainer = () => {
            const start = page * pageSize;
            const end = Math.min(start + pageSize, results.length);
            const slice = results.slice(start, end);

            const container = new ContainerBuilder().setAccentColor(0xFF0000);

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${getEmoji('search')} ${title}\n\n` +
                    lang.youtube.render.pageInfo
                        .replace('{page}', page + 1)
                        .replace('{total}', totalPages)
                        .replace('{count}', results.length)
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder());

            
            if (slice[0]?.thumbnail) {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        item => item.setURL(slice[0].thumbnail).setDescription(lang.youtube.media.videoThumbnail)
                    )
                );
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            }

            
            slice.forEach((v, i) => {
                const globalIdx = start + i + 1;
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${globalIdx}.** [${v.title.substring(0, 80)}](${v.url})\n` +
                        ` ${getEmoji('time')} ${v.duration || 'N/A'} • ${getEmoji('trend')} ${v.views?.toLocaleString() || '–'} views`
                    )
                );
                if (i < slice.length - 1) {
                    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                }
            });

            return container;
        };

        const buildButtons = (disabled = false) => {
            return new ActionRowBuilder().addComponents(
                btn(null, `yt_prev_${sessionId}`, 'arrleft', ButtonStyle.Primary, page === 0 || disabled),
                btn(null, `yt_home_${sessionId}`, 'home', ButtonStyle.Success, page === 0 || disabled),
                btn(null, `yt_next_${sessionId}`, 'arrright', ButtonStyle.Primary, page === totalPages - 1 || disabled),
                btn(null, `yt_close_${sessionId}`, 'stop', ButtonStyle.Danger, disabled)
            );
        };

        const buildMenuRow = (disabled = false) => {
            const start = page * pageSize;
            const end = Math.min(start + pageSize, results.length);
            const slice = results.slice(start, end);

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`yt_select_${sessionId}`)
                .setPlaceholder(lang.youtube.select.placeholder)
                .setDisabled(disabled)
                .addOptions(
                    slice.map((v, i) => {
                        const opt = {
                            label: `${start + i + 1}. ${v.title.substring(0, 70)}`,
                            description: `${v.duration} | ${v.views?.toLocaleString() || '–'} views`,
                            value: v.url
                        };
                        const playEmoji = getButtonEmoji('play');
                        if (playEmoji) opt.emoji = playEmoji;
                        return opt;
                    })
                );

            return new ActionRowBuilder().addComponents(menu);
        };

        const buildDetailedView = (video) => {
            const container = new ContainerBuilder().setAccentColor(0xFF0000);

            const channelStr = lang.youtube.details.channel
                .replace('{emoji}', getEmoji('user'))
                .replace('{name}', video.channel?.name || lang.youtube.details.unknownChannel)
                .replace('{url}', video.channel?.url || '');
            const durationStr = lang.youtube.details.duration
                .replace('{emoji}', getEmoji('time'))
                .replace('{duration}', video.durationRaw || 'N/A');
            const viewsStr = lang.youtube.details.views
                .replace('{emoji}', getEmoji('trend'))
                .replace('{views}', video.views?.toLocaleString() || '–');
            const likesStr = lang.youtube.details.likes
                .replace('{emoji}', getEmoji('heart'))
                .replace('{likes}', video.likes?.toLocaleString() || '–');
            const uploadedStr = lang.youtube.details.uploaded
                .replace('{emoji}', getEmoji('calendar'))
                .replace('{date}', video.uploadedAt ? new Date(video.uploadedAt).toLocaleDateString() : lang.youtube.details.unknownDate);
            const descContent = video.description ? video.description.substring(0, 300) + '...' : lang.youtube.details.noDescription;
            const descStr = lang.youtube.details.description
                .replace('{emoji}', getEmoji('document'))
                .replace('{description}', descContent);

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${getEmoji('music')} ${video.title}\n\n` +
                    `${channelStr}\n` +
                    `${durationStr}\n` +
                    `${viewsStr}\n` +
                    `${likesStr}\n` +
                    `${uploadedStr}\n\n` +
                    `${descStr}`
                )
            );

            const thumb = video.thumbnails?.[0]?.url || video.thumbnail?.url;
            if (thumb) {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        item => item.setURL(thumb).setDescription(lang.youtube.media.thumbnail)
                    )
                );
            }

            return container;
        };

        const buildDetailedButtons = (video) => {
            return new ActionRowBuilder().addComponents(
                btn(lang.youtube.buttons.backToList, `yt_back_${sessionId}`, 'back', ButtonStyle.Secondary),
                linkBtn(lang.youtube.buttons.watch, 'link', video.url)
            );
        };

        const initialPayload = {
            components: [buildContainer(), buildButtons(), buildMenuRow()],
            flags: MessageFlags.IsComponentsV2
        };

        const msg = await editResponse(interaction, initialPayload);
        if (!msg) return;

        const collector = msg.createMessageComponentCollector({
            time: 180000,
            dispose: true
        });

        collector.on('collect', async i => {
            try {
                await i.deferUpdate();
            } catch (err) {
                return;
            }

            try {
                const initiatorId = isSlash ? interaction.user.id : interaction.author.id;
                if (i.user.id !== initiatorId) {
                    return i.followUp({
                        content: lang.youtube.render.unauthorized.replace('{user}', initiatorId),
                        flags: MessageFlags.Ephemeral
                    }).catch(() => { });
                }

                if (i.customId === `yt_prev_${sessionId}` && page > 0) {
                    page--;
                    currentVideo = null;
                } else if (i.customId === `yt_next_${sessionId}` && page < totalPages - 1) {
                    page++;
                    currentVideo = null;
                } else if (i.customId === `yt_home_${sessionId}`) {
                    page = 0;
                    currentVideo = null;
                } else if (i.customId === `yt_back_${sessionId}`) {
                    currentVideo = null;
                } else if (i.customId === `yt_close_${sessionId}`) {
                    collector.stop('user_closed');
                    return;
                } else if (i.customId === `yt_select_${sessionId}`) {
                    const videoUrl = i.values[0];
                    const statusContainer = new ContainerBuilder().setAccentColor(0xFFA500);
                    statusContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            lang.youtube.status.loadingDetails
                                .replace('{emoji}', getEmoji('time'))
                                .replace('{url}', videoUrl)
                        )
                    );
                    await editResponse(interaction, {
                        components: [statusContainer],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => { });

                    currentVideo = await safeGetVideoDetails(videoUrl);
                }

                if (currentVideo) {
                    await editResponse(interaction, {
                        components: [buildDetailedView(currentVideo), buildDetailedButtons(currentVideo)],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => { });
                } else {
                    await editResponse(interaction, {
                        components: [buildContainer(), buildButtons(), buildMenuRow()],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => { });
                }
            } catch (error) {
                console.error('[YouTube] Component action failed:', error);
                await i.followUp({
                    content: lang.youtube.error?.requestFailed || 'Could not update this YouTube panel. Please try again.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => { });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'user_closed') {
                const closed = new ContainerBuilder().setAccentColor(0xFF0000);
                closed.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        lang.youtube.render.sessionClosedTitle.replace('{emoji}', getEmoji('warning'))
                    )
                );
                editResponse(interaction, {
                    components: [closed],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => { });
                setTimeout(() => {
                    if (isSlash) {
                        interaction.deleteReply().catch(() => { });
                    } else if (interaction.responseMessage) {
                        interaction.responseMessage.delete().catch(() => { });
                    }
                }, 2000);
                return;
            }

            
            if (currentVideo) {
                const backBtn = btn(lang.youtube.buttons.backToList, `yt_back_${sessionId}`, 'back', ButtonStyle.Secondary, true);
                const lBtn = linkBtn(lang.youtube.buttons.watch, 'link', currentVideo.url);

                editResponse(interaction, {
                    components: [buildDetailedView(currentVideo), new ActionRowBuilder().addComponents(backBtn, lBtn)],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => { });
            } else {
                editResponse(interaction, {
                    components: [buildContainer(), buildButtons(true), buildMenuRow(true)],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => { });
            }
        });
    },

    async renderChannel(interaction, info, videos) {
        const container = new ContainerBuilder().setAccentColor(0xFF0000);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${getEmoji('basic')} [${info.name}](${info.url})\n\n${lang.youtube.render.profileSubtitle}`
            )
        );

        container.addSeparatorComponents(new SeparatorBuilder());

        if (info.avatar) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    item => item
                        .setURL(info.avatar)
                        .setDescription(`${info.name} Avatar`)
                )
            );
            container.addSeparatorComponents(new SeparatorBuilder());
        }

        const subCount = info.subscribers;
        let subDisplay = 'Not available';

        if (typeof subCount === 'number') {
            subDisplay = subCount.toLocaleString();
        } else if (typeof subCount === 'string') {
            if (!subCount.startsWith('@') && (subCount.match(/\d/) || subCount.includes('M') || subCount.includes('K'))) {
                subDisplay = subCount;
            }
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                lang.youtube.render.statsTitle.replace('{emoji}', getEmoji('analytics')) + '\n\n' +
                lang.youtube.render.subscribers.replace('{emoji}', getEmoji('groupusers')).replace('{count}', subDisplay) + '\n' +
                lang.youtube.render.loadedVideos.replace('{emoji}', getEmoji('playlist')).replace('{count}', videos.length) + '\n' +
                lang.youtube.render.url.replace('{emoji}', getEmoji('link')).replace('{url}', info.url)
            )
        );

        if (videos.length > 0) {
            container.addSeparatorComponents(new SeparatorBuilder());

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(lang.youtube.render.latestUploads.replace('{emoji}', getEmoji('fire')))
            );

            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

            videos.slice(0, 5).forEach((v, i) => {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${i + 1}.** [${v.title.substring(0, 80)}](${v.url})\n` +
                        ` ${getEmoji('time')} ${v.duration || 'N/A'} • ${getEmoji('trend')} ${v.views?.toLocaleString() || '–'} views`
                    )
                );
                if (i < 4 && i < videos.length - 1) {
                    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                }
            });
        }

        const linkButton = new ActionRowBuilder().addComponents(
            linkBtn(lang.youtube.buttons.openChannel, 'basic', info.url),
            linkBtn(lang.youtube.buttons.viewMoreVideos, 'play', `${info.url}/videos`)
        );

        return editResponse(interaction, {
            components: [container, linkButton],
            flags: MessageFlags.IsComponentsV2
        });
    },

    sendError(interaction, message) {
        const container = new ContainerBuilder().setAccentColor(0xFF0000);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                lang.youtube.error.title
                    .replace('{emoji}', getEmoji('cross'))
                    .replace('{message}', message)
            )
        );
        return editResponse(interaction, { components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};


async function safeYTSearch(query, limit) {
    const cacheKey = `search_${query}_${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    
    try {
        const filters = await ytsr.getFilters(query);
        const videoFilter = filters.get('Type')?.get('Video');
        if (videoFilter) {
            const res = await ytsr(videoFilter.url, { limit });
            const results = res.items
                .filter(i => i.type === 'video')
                .map(v => ({
                    title: v.title || lang.youtube.details.untitled,
                    url: v.url || '',
                    duration: v.duration || 'N/A',
                    views: v.views || 0,
                    thumbnail: v.bestThumbnail?.url || null
                }));

            if (results.length > 0) {
                setCached(cacheKey, results);
                return results;
            }
        }
    } catch (err) {
        console.warn('[YouTube Search ytsr Error, trying fallback play-dl]', err.message);
    }

    
    try {
        const res = await play.search(query, { limit: limit, source: { youtube: 'video' } });
        if (res && res.length > 0) {
            const results = res.map(v => ({
                title: v.title || lang.youtube.details.untitled,
                url: v.url || '',
                duration: v.durationRaw || 'N/A',
                views: v.views || 0,
                thumbnail: v.thumbnails?.[0]?.url || null
            }));
            setCached(cacheKey, results);
            return results;
        }
    } catch (fallbackErr) {
        console.error('[YouTube Search play-dl Fallback Error]', fallbackErr.message);
    }

    return [];
}

async function safeGetChannel(query, limit) {
    const cacheKey = `channel_${query}_${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const filters = await ytsr.getFilters(query);
        const channelFilter = filters.get('Type')?.get('Channel');
        if (!channelFilter) throw new Error('Channel filter not found');

        const chRes = await ytsr(channelFilter.url, { limit: 1 });
        const ch = chRes.items.find(i => i.type === 'channel');
        if (!ch) throw new Error('Channel not found');

        let subCount = 'Not available';
        const possibleFields = [ch.subscribers, ch.subscriberCount, ch.subCount, ch.subscriberText];

        for (const field of possibleFields) {
            if (field && typeof field === 'string' && !field.startsWith('@')) {
                if (field.match(/\d/) || field.includes('M') || field.includes('K') || field.includes('subscribers')) {
                    subCount = field.replace('subscribers', '').trim();
                    break;
                }
            } else if (typeof field === 'number') {
                subCount = field;
                break;
            }
        }

        const info = {
            name: ch.name || ch.channelName || lang.youtube.details.unknownChannel,
            url: ch.url || '',
            avatar: ch.bestAvatar?.url || ch.thumbnail?.url || ch.thumbnails?.[0]?.url || null,
            subscribers: subCount
        };

        const vidFilters = await ytsr.getFilters(ch.url);
        const videoFilter = vidFilters.get('Type')?.get('Video');
        if (!videoFilter) {
            const data = { info, videos: [] };
            setCached(cacheKey, data);
            return data;
        }

        const vidRes = await ytsr(videoFilter.url, { limit });
        const videos = vidRes.items
            .filter(i => i.type === 'video')
            .map(v => ({
                title: v.title || lang.youtube.details.untitled,
                url: v.url || '',
                duration: v.duration || 'N/A',
                views: v.views || 0,
                thumbnail: v.bestThumbnail?.url || null
            }));

        const data = { info, videos };
        setCached(cacheKey, data);
        return data;
    } catch (err) {
        console.error('[Channel Error]', err.message);

        try {
            const searchRes = await ytsr(query, { limit: 20 });
            const channel = searchRes.items.find(i => i.type === 'channel');

            if (channel) {
                let subCount = 'Not available';
                const possibleFields = [channel.subscribers, channel.subscriberCount, channel.subCount];

                for (const field of possibleFields) {
                    if (field && typeof field === 'string' && !field.startsWith('@') && field.match(/\d/)) {
                        subCount = field;
                        break;
                    } else if (typeof field === 'number') {
                        subCount = field;
                        break;
                    }
                }

                const info = {
                    name: channel.name || lang.youtube.details.unknownChannel,
                    url: channel.url || '',
                    avatar: channel.bestAvatar?.url || channel.thumbnail?.url || null,
                    subscribers: subCount
                };

                const videos = searchRes.items
                    .filter(i => i.type === 'video' && i.author?.name === channel.name)
                    .slice(0, limit)
                    .map(v => ({
                        title: v.title || lang.youtube.details.untitled,
                        url: v.url || '',
                        duration: v.duration || 'N/A',
                        views: v.views || 0,
                        thumbnail: v.bestThumbnail?.url || null
                    }));

                const data = { info, videos };
                setCached(cacheKey, data);
                return data;
            }
        } catch (fallbackErr) {
            console.error('[Channel Fallback Error]', fallbackErr.message);
        }

        const fallbackData = {
            info: {
                name: query,
                url: `https://youtube.com/results?search_query=${encodeURIComponent(query)}`,
                avatar: null,
                subscribers: 'Not available'
            },
            videos: []
        };
        setCached(cacheKey, fallbackData);
        return fallbackData;
    }
}

async function safeGetPlaylist(url, limit) {
    const cacheKey = `playlist_${url}_${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    
    try {
        const id = await ytpl.getPlaylistID(url);
        const playlist = await ytpl(id, { limit });

        const results = playlist.items.map(item => ({
            title: item.title || lang.youtube.details.untitled,
            url: item.shortUrl || '',
            duration: item.duration || 'N/A',
            views: item.views || 0,
            thumbnail: item.bestThumbnail?.url || null
        }));

        setCached(cacheKey, results);
        return results;
    } catch (err) {
        console.warn('[Playlist ytpl Error, trying fallback play-dl]', err.message);
    }

    
    try {
        const playlist = await play.playlist_info(url, { incomplete: true });
        if (playlist) {
            const videos = await playlist.all_videos();
            const results = videos.slice(0, limit).map(item => ({
                title: item.title || lang.youtube.details.untitled,
                url: item.url || '',
                duration: item.durationRaw || 'N/A',
                views: item.views || 0,
                thumbnail: item.thumbnails?.[0]?.url || null
            }));
            setCached(cacheKey, results);
            return results;
        }
    } catch (fallbackErr) {
        console.error('[Playlist play-dl Fallback Error]', fallbackErr.message);
    }

    return [];
}
