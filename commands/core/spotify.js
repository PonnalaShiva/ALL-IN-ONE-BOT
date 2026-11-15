
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
    MediaGalleryBuilder
} = require('discord.js');
const { spotifyApiRequest } = require('../../utils/spotifyToken');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { linkBtn } = require('../../UI');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spotify')
        .setDescription('Complete Spotify browsing suite - 25 commands!')
        
        .addSubcommand(sub =>
            sub.setName('search')
                .setDescription('Search tracks, albums, artists, or playlists')
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('Item type')
                        .addChoices(
                            { name: 'Track', value: 'track' },
                            { name: 'Album', value: 'album' },
                            { name: 'Artist', value: 'artist' },
                            { name: 'Playlist', value: 'playlist' }
                        )
                        .setRequired(true))
                .addStringOption(opt => opt.setName('query').setDescription('Search term').setRequired(true))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Results (1-10)').setMinValue(1).setMaxValue(10)))
        
        .addSubcommand(sub =>
            sub.setName('featured')
                .setDescription('Featured playlists')
                .addStringOption(opt => opt.setName('country').setDescription('Country (US, GB, etc.)').setMaxLength(2)))
        .addSubcommand(sub =>
            sub.setName('newreleases')
                .setDescription('New album releases')
                .addStringOption(opt => opt.setName('country').setDescription('Country code').setMaxLength(2))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Results (1-20)').setMinValue(1).setMaxValue(20)))
        .addSubcommand(sub =>
            sub.setName('toptracks')
                .setDescription('Top tracks globally or by country')
                .addStringOption(opt => opt.setName('country').setDescription('global/us/gb').setMaxLength(10)))
        .addSubcommand(sub =>
            sub.setName('trending')
                .setDescription('Trending music now')
                .addStringOption(opt => opt.setName('country').setDescription('Country code').setMaxLength(2)))
        
        .addSubcommand(sub =>
            sub.setName('categories')
                .setDescription('List available categories')
                .addStringOption(opt => opt.setName('country').setDescription('Country code').setMaxLength(2)))
        .addSubcommand(sub =>
            sub.setName('category')
                .setDescription('Get playlists from category')
                .addStringOption(opt => opt.setName('id').setDescription('Category ID').setRequired(true))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Results (1-20)').setMinValue(1).setMaxValue(20)))
        
        .addSubcommand(sub =>
            sub.setName('artist')
                .setDescription('Artist info and top tracks')
                .addStringOption(opt => opt.setName('name').setDescription('Artist name').setRequired(true))
                .addStringOption(opt => opt.setName('market').setDescription('Market code').setMaxLength(2)))
        .addSubcommand(sub =>
            sub.setName('artistalbums')
                .setDescription('Artist albums')
                .addStringOption(opt => opt.setName('name').setDescription('Artist name').setRequired(true))
                .addStringOption(opt => opt.setName('type').setDescription('Album type').addChoices(
                    { name: 'Albums', value: 'album' },
                    { name: 'Singles', value: 'single' },
                    { name: 'All', value: 'album,single,compilation' }
                ))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Results (1-20)').setMinValue(1).setMaxValue(20)))
        .addSubcommand(sub =>
            sub.setName('artisttop')
                .setDescription('Artist top 10 songs')
                .addStringOption(opt => opt.setName('name').setDescription('Artist name').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('related')
                .setDescription('Related artists')
                .addStringOption(opt => opt.setName('name').setDescription('Artist name').setRequired(true)))
        
        .addSubcommand(sub =>
            sub.setName('album')
                .setDescription('Album details and tracks')
                .addStringOption(opt => opt.setName('name').setDescription('Album name').setRequired(true))
                .addStringOption(opt => opt.setName('artist').setDescription('Artist name (optional)')))
        .addSubcommand(sub =>
            sub.setName('track')
                .setDescription('Track info with audio features')
                .addStringOption(opt => opt.setName('name').setDescription('Track name').setRequired(true))
                .addStringOption(opt => opt.setName('artist').setDescription('Artist name (optional)')))
        .addSubcommand(sub =>
            sub.setName('trackanalysis')
                .setDescription('Detailed track audio analysis')
                .addStringOption(opt => opt.setName('name').setDescription('Track name').setRequired(true)))
        
        .addSubcommand(sub =>
            sub.setName('playlist')
                .setDescription('Playlist details')
                .addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true))
                .addStringOption(opt => opt.setName('user').setDescription('Owner username')))
        .addSubcommand(sub =>
            sub.setName('playlisttracks')
                .setDescription('All playlist tracks')
                .addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Tracks (1-50)').setMinValue(1).setMaxValue(50)))
        
        .addSubcommand(sub =>
            sub.setName('recommendations')
                .setDescription('Get recommendations')
                .addStringOption(opt => opt.setName('seed_artists').setDescription('Artist names (comma-separated)'))
                .addStringOption(opt => opt.setName('seed_tracks').setDescription('Track names (comma-separated)'))
                .addStringOption(opt => opt.setName('seed_genres').setDescription('Genres (comma-separated)')))
        .addSubcommand(sub =>
            sub.setName('random')
                .setDescription('Random tracks by genre')
                .addStringOption(opt => opt.setName('genre').setDescription('Genre name'))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Tracks (1-20)').setMinValue(1).setMaxValue(20)))
        
        .addSubcommand(sub =>
            sub.setName('genres')
                .setDescription('Available genre seeds'))
        .addSubcommand(sub =>
            sub.setName('genreplaylist')
                .setDescription('Top playlist for genre')
                .addStringOption(opt => opt.setName('genre').setDescription('Genre name').setRequired(true)))
        
        .addSubcommand(sub =>
            sub.setName('viral')
                .setDescription('Viral tracks')
                .addStringOption(opt => opt.setName('country').setDescription('Country code').setMaxLength(2)))
        .addSubcommand(sub =>
            sub.setName('topartists')
                .setDescription('Top artists globally')
                .addIntegerOption(opt => opt.setName('limit').setDescription('Results (1-20)').setMinValue(1).setMaxValue(20)))
        .addSubcommand(sub =>
            sub.setName('topalbums')
                .setDescription('Top albums')
                .addStringOption(opt => opt.setName('country').setDescription('Country code').setMaxLength(2)))
        
        .addSubcommand(sub =>
            sub.setName('user')
                .setDescription('User profile and playlists')
                .addStringOption(opt => opt.setName('username').setDescription('Spotify username').setRequired(true)))
        
        .addSubcommand(sub =>
            sub.setName('decade')
                .setDescription('Music from a decade')
                .addStringOption(opt => opt.setName('year').setDescription('Decade (1980s, 1990s, 2000s, etc.)').setRequired(true))),

    async execute(interaction) {
        
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        
        const updateStatus = async (message) => {
            try {
                const statusContainer = new ContainerBuilder().setAccentColor(0x1DB954);
                statusContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(lang.spotify.status.loadingTitle.replace('{message}', message))
                );
                await interaction.editReply({
                    components: [statusContainer],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => { });
            } catch (err) {
                
            }
        };

        try {
            switch (subcommand) {
                case 'search':
                    await updateStatus(lang.spotify.status.searching);
                    return await handleSearch(interaction);
                case 'featured':
                    await updateStatus(lang.spotify.status.featured);
                    return await handleFeatured(interaction);
                case 'newreleases':
                    await updateStatus(lang.spotify.status.newReleases);
                    return await handleNewReleases(interaction);
                case 'toptracks':
                    await updateStatus(lang.spotify.status.topTracks);
                    return await handleTopTracks(interaction);
                case 'trending':
                    await updateStatus(lang.spotify.status.trending);
                    return await handleTrending(interaction);
                case 'categories':
                    await updateStatus(lang.spotify.status.categories);
                    return await handleCategories(interaction);
                case 'category':
                    await updateStatus(lang.spotify.status.category);
                    return await handleCategory(interaction);
                case 'artist':
                    await updateStatus(lang.spotify.status.artist);
                    return await handleArtist(interaction);
                case 'artistalbums':
                    await updateStatus(lang.spotify.status.artistAlbums);
                    return await handleArtistAlbums(interaction);
                case 'artisttop':
                    await updateStatus(lang.spotify.status.artistTop);
                    return await handleArtistTop(interaction);
                case 'related':
                    await updateStatus(lang.spotify.status.related);
                    return await handleRelated(interaction);
                case 'album':
                    await updateStatus(lang.spotify.status.album);
                    return await handleAlbum(interaction);
                case 'track':
                    await updateStatus(lang.spotify.status.track);
                    return await handleTrack(interaction);
                case 'trackanalysis':
                    await updateStatus(lang.spotify.status.trackAnalysis);
                    return await handleTrackAnalysis(interaction);
                case 'playlist':
                    await updateStatus(lang.spotify.status.playlist);
                    return await handlePlaylist(interaction);
                case 'playlisttracks':
                    await updateStatus(lang.spotify.status.playlistTracks);
                    return await handlePlaylistTracks(interaction);
                case 'recommendations':
                    await updateStatus(lang.spotify.status.recommendations);
                    return await handleRecommendations(interaction);
                case 'random':
                    await updateStatus(lang.spotify.status.random);
                    return await handleRandom(interaction);
                case 'genres':
                    await updateStatus(lang.spotify.status.genres);
                    return await handleGenres(interaction);
                case 'genreplaylist':
                    await updateStatus(lang.spotify.status.genrePlaylist);
                    return await handleGenrePlaylist(interaction);
                case 'viral':
                    await updateStatus(lang.spotify.status.viral);
                    return await handleViral(interaction);
                case 'topartists':
                    await updateStatus(lang.spotify.status.topArtists);
                    return await handleTopArtists(interaction);
                case 'topalbums':
                    await updateStatus(lang.spotify.status.topAlbums);
                    return await handleTopAlbums(interaction);
                case 'user':
                    await updateStatus(lang.spotify.status.user);
                    return await handleUser(interaction);
                case 'decade':
                    await updateStatus(lang.spotify.status.decade);
                    return await handleDecade(interaction);
                default:
                    return sendError(interaction, lang.spotify.error.unknownSubcommand);
            }
        } catch (error) {
            console.error('[Spotify Error]', error.message);
            return sendError(interaction, lang.spotify.error.failedToFetch.replace('{error}', error.message));
        }
    }
};


function sendError(interaction, message) {
    const container = new ContainerBuilder().setAccentColor(0xFF0000);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('error')} Error\n\n${message}`)
    );
    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}


async function handleSearch(interaction) {
    const type = interaction.options.getString('type');
    const query = interaction.options.getString('query');
    const limit = interaction.options.getInteger('limit') || 5;

    const data = await spotifyApiRequest(`/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    let items = [];
    let icon = getEmoji('music');

    switch (type) {
        case 'track':
            items = data.tracks?.items || [];
            icon = getEmoji('music');
            break;
        case 'album':
            items = data.albums?.items || [];
            icon = getEmoji('playlist');
            break;
        case 'artist':
            items = data.artists?.items || [];
            icon = getEmoji('voice');
            break;
        case 'playlist':
            items = data.playlists?.items || [];
            icon = getEmoji('folder');
            break;
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${icon} ${type.charAt(0).toUpperCase() + type.slice(1)} Search\n\n` +
            `Query: **${query}** • Found: **${items.length}** results`
        )
    );

    if (items.length === 0) {
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('No results found. Try a different search term.')
        );
    } else {
        container.addSeparatorComponents(new SeparatorBuilder());

        
        if (items[0]?.images?.[0]?.url || items[0]?.album?.images?.[0]?.url) {
            const imgUrl = items[0]?.images?.[0]?.url || items[0]?.album?.images?.[0]?.url;
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    item => item.setURL(imgUrl).setDescription(`${type} thumbnail`)
                )
            );
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }

        items.forEach((item, idx) => {
            let text = '';
            switch (type) {
                case 'track':
                    text = `**${idx + 1}.** [${item.name}](${item.external_urls.spotify})\n` +
                        `Artist: ${item.artists.map(a => a.name).join(', ')}\n` +
                        `Album: ${item.album.name}`;
                    break;
                case 'album':
                    text = `**${idx + 1}.** [${item.name}](${item.external_urls.spotify})\n` +
                        `Artist: ${item.artists.map(a => a.name).join(', ')}\n` +
                        `Tracks: ${item.total_tracks}`;
                    break;
                case 'artist':
                    text = `**${idx + 1}.** [${item.name}](${item.external_urls.spotify})\n` +
                        `${lang.spotify.search.followers.replace('{count}', item.followers.total.toLocaleString())}\n` +
                        `${lang.spotify.search.popularity.replace('{popularity}', item.popularity)}`;
                    break;
                case 'playlist':
                    text = `**${idx + 1}.** [${item.name}](${item.external_urls.spotify})\n` +
                        `${lang.spotify.search.by.replace('{owner}', item.owner?.display_name || lang.spotify.details.unknownOwner)}\n` +
                        `${lang.spotify.search.tracks.replace('{count}', item.tracks.total)}`;
                    break;
            }

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
            if (idx < items.length - 1) {
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            }
        });
    }

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleFeatured(interaction) {
    try {
        const country = interaction.options.getString('country') || 'US';
        
        const data = await spotifyApiRequest(`/browse/featured-playlists?country=${country}&limit=20`);

        if (!data || !data.playlists || !data.playlists.items || data.playlists.items.length === 0) {
            
            const fallbackData = await spotifyApiRequest(`/search?q=playlist&type=playlist&limit=10&market=${country}`);
            if (!fallbackData.playlists?.items?.length) {
                return sendError(interaction, 'No featured playlists found. Try again later.');
            }

            const container = new ContainerBuilder().setAccentColor(0x1DB954);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${getEmoji('sparkles')} Popular Playlists\n\nTop playlists for ${country}`
                )
            );
            container.addSeparatorComponents(new SeparatorBuilder());

            fallbackData.playlists.items.forEach((playlist, idx) => {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${idx + 1}.** [${playlist.name}](${playlist.external_urls.spotify})\n` +
                        `By: ${playlist.owner.display_name} • Tracks: ${playlist.tracks.total || 'N/A'}`
                    )
                );
                if (idx < fallbackData.playlists.items.length - 1) {
                    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                }
            });

            return await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        const container = new ContainerBuilder().setAccentColor(0x1DB954);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${getEmoji('sparkles')} Featured Playlists\n\n${data.message || `Featured playlists for ${country}`}`
            )
        );

        container.addSeparatorComponents(new SeparatorBuilder());

        data.playlists.items.forEach((playlist, idx) => {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    lang.spotify.featured.item
                        .replace('{idx}', idx + 1)
                        .replace('{name}', playlist.name)
                        .replace('{url}', playlist.external_urls.spotify)
                        .replace('{owner}', playlist.owner?.display_name || lang.spotify.details.unknownOwner)
                        .replace('{tracks}', playlist.tracks?.total || 'N/A')
                )
            );
            if (idx < data.playlists.items.length - 1) {
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            }
        });

        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
        console.error('[Featured Error]', error);
        return sendError(interaction, `Failed to fetch featured playlists: ${error.message}`);
    }
}

async function handleNewReleases(interaction) {
    const country = interaction.options.getString('country') || 'US';
    const limit = interaction.options.getInteger('limit') || 10;
    const data = await spotifyApiRequest(`/browse/new-releases?country=${country}&limit=${limit}`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('sparkles')} New Releases\n\nLatest albums for ${country}`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    if (data.albums.items[0]?.images?.[0]?.url) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                item => item.setURL(data.albums.items[0].images[0].url).setDescription(lang.spotify.media.albumCover)
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }

    data.albums.items.forEach((album, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${album.name}](${album.external_urls.spotify})\n` +
                `Artist: ${album.artists.map(a => a.name).join(', ')}\n` +
                `Release: ${album.release_date}`
            )
        );
        if (idx < data.albums.items.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleTopTracks(interaction) {
    const country = (interaction.options.getString('country') || 'global').toLowerCase();

    const playlistIds = {
        global: '37i9dQZEVXbMDoHDwVN2tF',
        us: '37i9dQZEVXbLRQDuF5jeBp',
        gb: '37i9dQZEVXbLnolsZ8PSNw'
    };

    const playlistId = playlistIds[country] || playlistIds.global;
    const data = await spotifyApiRequest(`/playlists/${playlistId}/tracks?limit=10`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('trend')} Top Tracks - ${country.toUpperCase()}\n\nMost popular tracks right now`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    data.items.filter(item => item?.track).forEach((item, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${item.track.name}](${item.track.external_urls.spotify})\n` +
                `Artist: ${item.track.artists.map(a => a.name).join(', ')}`
            )
        );
        if (idx < data.items.filter(i => i?.track).length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleTrending(interaction) {
    try {
        const country = interaction.options.getString('country') || 'US';

        
        const playlistIds = {
            global: '37i9dQZEVXbMDoHDwVN2tF',
            us: '37i9dQZEVXbLRQDuF5jeBp',
            gb: '37i9dQZEVXbLnolsZ8PSNw'
        };

        const playlistId = playlistIds[country.toLowerCase()] || playlistIds.global;
        const tracks = await spotifyApiRequest(`/playlists/${playlistId}/tracks?limit=10&market=${country}`);

        if (!tracks || !tracks.items || tracks.items.length === 0) {
            return sendError(interaction, 'No trending tracks found');
        }

        const container = new ContainerBuilder().setAccentColor(0x1DB954);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${getEmoji('fire')} Trending Now\n\nHot tracks in ${country.toUpperCase()}`)
        );

        container.addSeparatorComponents(new SeparatorBuilder());

        tracks.items.forEach((item, idx) => {
            if (item.track) {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${idx + 1}.** [${item.track.name}](${item.track.external_urls.spotify})\n` +
                        `Artist: ${item.track.artists.map(a => a.name).join(', ')}`
                    )
                );
                if (idx < tracks.items.length - 1) {
                    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                }
            }
        });

        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
        console.error('[Trending Error]', error);
        return sendError(interaction, `Failed to fetch trending tracks: ${error.message}`);
    }
}

async function handleCategories(interaction) {
    try {
        const country = interaction.options.getString('country') || 'US';
        const data = await spotifyApiRequest(`/browse/categories?country=${country}&limit=50`);

        if (!data || !data.categories || !data.categories.items || data.categories.items.length === 0) {
            return sendError(interaction, 'No categories found');
        }

        const container = new ContainerBuilder().setAccentColor(0x1DB954);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${getEmoji('sfolder1')} Spotify Categories\n\nAvailable music categories`)
        );

        container.addSeparatorComponents(new SeparatorBuilder());

        let catText = '';
        data.categories.items.forEach(cat => {
            catText += `• \`${cat.id}\` - ${cat.name}\n`;
        });

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(catText + `\nUse \`/spotify category\` with an ID to explore`)
        );

        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
        console.error('[Categories Error]', error);
        return sendError(interaction, `Failed to fetch categories: ${error.message}`);
    }
}

async function handleCategory(interaction) {
    try {
        const categoryId = interaction.options.getString('id');
        const limit = interaction.options.getInteger('limit') || 10;
        const country = 'US'; 

        const data = await spotifyApiRequest(`/browse/categories/${categoryId}/playlists?limit=${limit}&country=${country}`);

        if (!data || !data.playlists || !data.playlists.items || data.playlists.items.length === 0) {
            return sendError(interaction, `No playlists found for category "${categoryId}". Make sure the category ID is correct.`);
        }

        const container = new ContainerBuilder().setAccentColor(0x1DB954);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${getEmoji('folder')} Category: ${categoryId}\n\nPlaylists in this category`)
        );

        container.addSeparatorComponents(new SeparatorBuilder());

        data.playlists.items.forEach((playlist, idx) => {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    lang.spotify.featured.item
                        .replace('{idx}', idx + 1)
                        .replace('{name}', playlist.name)
                        .replace('{url}', playlist.external_urls.spotify)
                        .replace('{owner}', playlist.owner?.display_name || lang.spotify.details.unknownOwner)
                        .replace('{tracks}', playlist.tracks?.total || 'N/A')
                )
            );
            if (idx < data.playlists.items.length - 1) {
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            }
        });

        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
        console.error('[Category Error]', error);
        return sendError(interaction, `Failed to fetch category playlists: ${error.message}`);
    }
}

async function handleArtist(interaction) {
    const artistName = interaction.options.getString('name');
    const market = interaction.options.getString('market') || 'US';

    const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`);
    const artist = searchData.artists.items[0];

    if (!artist) return sendError(interaction, 'Artist not found');

    const topTracksData = await spotifyApiRequest(`/artists/${artist.id}/top-tracks?market=${market}`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${getEmoji('voice')} ${artist.name}\n\n` +
            `${lang.spotify.artist.followers.replace('{count}', artist.followers.total.toLocaleString())}\n` +
            `${lang.spotify.artist.popularity.replace('{popularity}', artist.popularity)}\n` +
            `${lang.spotify.artist.genres.replace('{genres}', artist.genres.slice(0, 3).join(', ') || 'N/A')}`
        )
    );

    if (artist.images[0]?.url) {
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                item => item.setURL(artist.images[0].url).setDescription(lang.spotify.media.artistImage)
            )
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder());

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${getEmoji('fire')} Top Tracks**`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    topTracksData.tracks.slice(0, 10).forEach((track, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${track.name}](${track.external_urls.spotify})\n` +
                `Popularity: ${track.popularity}%`
            )
        );
        if (idx < 9) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    const openEmoji = getButtonEmoji('music');
    const linkButton = new ActionRowBuilder().addComponents(
        linkBtn({
            label: lang.spotify.buttons.openSpotify,
            url: artist.external_urls.spotify,
            emoji: openEmoji
        })
    );

    await interaction.editReply({ components: [container, linkButton], flags: MessageFlags.IsComponentsV2 });
}

async function handleArtistAlbums(interaction) {
    const artistName = interaction.options.getString('name');
    const albumType = interaction.options.getString('type') || 'album,single,compilation';
    const limit = interaction.options.getInteger('limit') || 10;

    const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`);
    const artist = searchData.artists.items[0];

    if (!artist) return sendError(interaction, 'Artist not found');

    const albumsData = await spotifyApiRequest(`/artists/${artist.id}/albums?include_groups=${albumType}&limit=${limit}`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('playlist')} ${artist.name} - Albums\n\nDiscography`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    albumsData.items.forEach((album, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${album.name}](${album.external_urls.spotify})\n` +
                `Release: ${album.release_date.split('-')[0]} • Tracks: ${album.total_tracks}`
            )
        );
        if (idx < albumsData.items.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleArtistTop(interaction) {
    const artistName = interaction.options.getString('name');

    const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`);
    const artist = searchData.artists.items[0];

    if (!artist) return sendError(interaction, 'Artist not found');

    const topTracksData = await spotifyApiRequest(`/artists/${artist.id}/top-tracks?market=US`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('music')} ${artist.name} - Top 10\n\nMost popular songs`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    topTracksData.tracks.forEach((track, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${track.name}](${track.external_urls.spotify})\n` +
                `Album: ${track.album.name} • Popularity: ${track.popularity}%`
            )
        );
        if (idx < topTracksData.tracks.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleRelated(interaction) {
    const artistName = interaction.options.getString('name');

    const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`);
    const artist = searchData.artists.items[0];

    if (!artist) return sendError(interaction, 'Artist not found');

    const relatedData = await spotifyApiRequest(`/artists/${artist.id}/related-artists`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('link')} Related to ${artist.name}\n\nSimilar artists`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    relatedData.artists.slice(0, 10).forEach((relArtist, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${relArtist.name}](${relArtist.external_urls.spotify})\n` +
                `Followers: ${relArtist.followers.total.toLocaleString()}`
            )
        );
        if (idx < 9) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleAlbum(interaction) {
    const albumName = interaction.options.getString('name');
    const artistName = interaction.options.getString('artist');

    let searchQuery = albumName;
    if (artistName) searchQuery += ` artist:${artistName}`;

    const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(searchQuery)}&type=album&limit=1`);
    const album = searchData.albums.items[0];

    if (!album) return sendError(interaction, 'Album not found');

    const tracksData = await spotifyApiRequest(`/albums/${album.id}/tracks?limit=20`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${getEmoji('playlist')} ${album.name}\n\n` +
            `${lang.spotify.details.artist.replace('{artist}', album.artists.map(a => a.name).join(', '))}\n` +
            `${lang.spotify.details.release.replace('{date}', album.release_date)}\n` +
            `${lang.spotify.details.tracks.replace('{count}', album.total_tracks)}\n` +
            `${lang.spotify.details.popularity.replace('{popularity}', album.popularity)}`
        )
    );

    if (album.images[0]?.url) {
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                item => item.setURL(album.images[0].url).setDescription(lang.spotify.media.albumCover)
            )
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder());

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${getEmoji('music')} Tracks**`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    tracksData.items.slice(0, 10).forEach((track, idx) => {
        const duration = `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}`;
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${track.name}](${track.external_urls.spotify}) • ${duration}`
            )
        );
        if (idx < 9) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    const linkButton = new ActionRowBuilder().addComponents(
        linkBtn({
            label: lang.spotify.buttons.play,
            url: album.external_urls.spotify,
            emoji: getButtonEmoji('play') || '▶️'
        })
    );

    await interaction.editReply({ components: [container, linkButton], flags: MessageFlags.IsComponentsV2 });
}

async function handleTrack(interaction) {
    const trackName = interaction.options.getString('name');
    const artistName = interaction.options.getString('artist');

    let searchQuery = trackName;
    if (artistName) searchQuery += ` artist:${artistName}`;

    const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=1`);
    const track = searchData.tracks.items[0];

    if (!track) return sendError(interaction, 'Track not found');

    const audioFeatures = await spotifyApiRequest(`/audio-features/${track.id}`);

    const duration = `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}`;

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${getEmoji('music')} ${track.name}\n\n` +
            `${lang.spotify.details.artist.replace('{artist}', track.artists.map(a => a.name).join(', '))}\n` +
            `${lang.spotify.details.album.replace('{album}', track.album.name)}\n` +
            `${lang.spotify.details.duration.replace('{duration}', duration)}\n` +
            `${lang.spotify.details.popularity.replace('{popularity}', track.popularity)}\n` +
            `${lang.spotify.details.release.replace('{date}', track.album.release_date)}`
        )
    );

    if (track.album.images[0]?.url) {
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                item => item.setURL(track.album.images[0].url).setDescription(lang.spotify.media.albumArt)
            )
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder());

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${lang.spotify.details.audioFeaturesHeader.replace('{emoji}', getEmoji('music'))}\n\n` +
            `${lang.spotify.details.energy.replace('{value}', Math.round(audioFeatures.energy * 100))}\n` +
            `${lang.spotify.details.danceability.replace('{value}', Math.round(audioFeatures.danceability * 100))}\n` +
            `${lang.spotify.details.valence.replace('{value}', Math.round(audioFeatures.valence * 100))}\n` +
            `${lang.spotify.details.tempo.replace('{value}', Math.round(audioFeatures.tempo))}\n` +
            `${lang.spotify.details.keyMode.replace('{key}', audioFeatures.key).replace('{mode}', audioFeatures.mode === 1 ? lang.spotify.details.major : lang.spotify.details.minor)}`
        )
    );

    const linkButton = new ActionRowBuilder().addComponents(
        linkBtn({
            label: lang.spotify.buttons.play,
            url: track.external_urls.spotify,
            emoji: getButtonEmoji('play') || '▶️'
        })
    );

    await interaction.editReply({ components: [container, linkButton], flags: MessageFlags.IsComponentsV2 });
}

async function handleTrackAnalysis(interaction) {
    const trackName = interaction.options.getString('name');

    const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(trackName)}&type=track&limit=1`);
    const track = searchData.tracks.items[0];

    if (!track) return sendError(interaction, 'Track not found');

    const audioFeatures = await spotifyApiRequest(`/audio-features/${track.id}`);
    const analysis = await spotifyApiRequest(`/audio-analysis/${track.id}`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${getEmoji('analytics')} Track Analysis: ${track.name}\n\n` +
            `Detailed audio analysis`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${lang.spotify.details.overviewHeader.replace('{emoji}', getEmoji('music'))}\n\n` +
            `${lang.spotify.details.sections.replace('{count}', analysis.sections.length)}\n` +
            `${lang.spotify.details.beats.replace('{count}', analysis.beats.length)}\n` +
            `${lang.spotify.details.bars.replace('{count}', analysis.bars.length)}\n` +
            `${lang.spotify.details.tatums.replace('{count}', analysis.tatums.length)}`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${lang.spotify.details.featuresHeader.replace('{emoji}', getEmoji('trend'))}\n\n` +
            `${lang.spotify.details.acousticness.replace('{value}', Math.round(audioFeatures.acousticness * 100))}\n` +
            `${lang.spotify.details.instrumentalness.replace('{value}', Math.round(audioFeatures.instrumentalness * 100))}\n` +
            `${lang.spotify.details.liveness.replace('{value}', Math.round(audioFeatures.liveness * 100))}\n` +
            `${lang.spotify.details.speechiness.replace('{value}', Math.round(audioFeatures.speechiness * 100))}\n` +
            `${lang.spotify.details.loudness.replace('{value}', audioFeatures.loudness.toFixed(2))}`
        )
    );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handlePlaylist(interaction) {
    const playlistName = interaction.options.getString('name');
    const userName = interaction.options.getString('user');

    let searchQuery = playlistName;
    if (userName) searchQuery += ` owner:${userName}`;

    const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(searchQuery)}&type=playlist&limit=1`);
    const playlist = searchData.playlists.items[0];

    if (!playlist) return sendError(interaction, 'Playlist not found');

    const tracksData = await spotifyApiRequest(`/playlists/${playlist.id}/tracks?limit=10`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${getEmoji('folder')} ${playlist.name}\n\n` +
            `${lang.spotify.details.owner.replace('{owner}', playlist.owner?.display_name || lang.spotify.details.unknownOwner)}\n` +
            `${lang.spotify.details.followers.replace('{count}', playlist.followers.total.toLocaleString())}\n` +
            `${lang.spotify.details.totalTracks.replace('{count}', playlist.tracks.total)}`
        )
    );

    if (playlist.images[0]?.url) {
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                item => item.setURL(playlist.images[0].url).setDescription(lang.spotify.media.playlistCover)
            )
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder());

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${getEmoji('music')} Recent Tracks**`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    tracksData.items.forEach((item, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${item.track.name}](${item.track.external_urls.spotify})\n` +
                `Artist: ${item.track.artists.map(a => a.name).join(', ')}`
            )
        );
        if (idx < tracksData.items.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    const linkButton = new ActionRowBuilder().addComponents(
        linkBtn({
            label: lang.spotify.buttons.openPlaylist,
            url: playlist.external_urls.spotify,
            emoji: getButtonEmoji('folder')
        })
    );

    await interaction.editReply({ components: [container, linkButton], flags: MessageFlags.IsComponentsV2 });
}

async function handlePlaylistTracks(interaction) {
    const playlistName = interaction.options.getString('name');
    const limit = interaction.options.getInteger('limit') || 20;

    const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(playlistName)}&type=playlist&limit=1`);
    const playlist = searchData.playlists.items[0];

    if (!playlist) return sendError(interaction, 'Playlist not found');

    const tracksData = await spotifyApiRequest(`/playlists/${playlist.id}/tracks?limit=${limit}`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('folder')} ${playlist.name} - All Tracks\n\nShowing ${tracksData.items.length} tracks`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    tracksData.items.forEach((item, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${item.track.name}](${item.track.external_urls.spotify})\n` +
                `Artist: ${item.track.artists.map(a => a.name).join(', ')}`
            )
        );
        if (idx < tracksData.items.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleRecommendations(interaction) {
    const seedArtists = interaction.options.getString('seed_artists');
    const seedTracks = interaction.options.getString('seed_tracks');
    const seedGenres = interaction.options.getString('seed_genres');

    if (!seedArtists && !seedTracks && !seedGenres) {
        return sendError(interaction, 'Provide at least one seed');
    }

    let seeds = [];

    if (seedArtists) {
        const artistNames = seedArtists.split(',').map(n => n.trim()).slice(0, 2);
        for (const name of artistNames) {
            const data = await spotifyApiRequest(`/search?q=${encodeURIComponent(name)}&type=artist&limit=1`);
            if (data.artists.items[0]) seeds.push(`seed_artists=${data.artists.items[0].id}`);
        }
    }

    if (seedTracks) {
        const trackNames = seedTracks.split(',').map(n => n.trim()).slice(0, 2);
        for (const name of trackNames) {
            const data = await spotifyApiRequest(`/search?q=${encodeURIComponent(name)}&type=track&limit=1`);
            if (data.tracks.items[0]) seeds.push(`seed_tracks=${data.tracks.items[0].id}`);
        }
    }

    if (seedGenres) {
        const genres = seedGenres.split(',').map(g => g.trim().toLowerCase()).slice(0, 2);
        genres.forEach(g => seeds.push(`seed_genres=${g}`));
    }

    if (seeds.length === 0) return sendError(interaction, 'No valid seeds found');

    const data = await spotifyApiRequest(`/recommendations?${seeds.join('&')}&limit=10`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('sparkles')} Recommendations\n\nBased on your seeds`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    data.tracks.forEach((track, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${track.name}](${track.external_urls.spotify})\n` +
                `Artist: ${track.artists.map(a => a.name).join(', ')}`
            )
        );
        if (idx < data.tracks.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleRandom(interaction) {
    const genre = interaction.options.getString('genre') || 'pop';
    const limit = interaction.options.getInteger('limit') || 5;

    const data = await spotifyApiRequest(`/recommendations?seed_genres=${genre}&limit=${limit}`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('sparkles')} Random Tracks\n\nGenre: **${genre}**`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    data.tracks.forEach((track, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${track.name}](${track.external_urls.spotify})\n` +
                `Artist: ${track.artists.map(a => a.name).join(', ')}`
            )
        );
        if (idx < data.tracks.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleGenres(interaction) {
    const data = await spotifyApiRequest(`/recommendations/available-genre-seeds`);

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('mic')} Available Genres\n\nUse these in recommendations or random commands`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    const genres = data.genres.sort().join(', ');
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(genres)
    );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleGenrePlaylist(interaction) {
    const genre = interaction.options.getString('genre');

    const data = await spotifyApiRequest(`/search?q=${encodeURIComponent(genre)}&type=playlist&limit=5`);

    if (!data.playlists.items.length) return sendError(interaction, 'No playlists found for genre');

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('folder')} ${genre} Playlists\n\nTop playlists for this genre`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    data.playlists.items.forEach((playlist, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                lang.spotify.featured.item
                    .replace('{idx}', idx + 1)
                    .replace('{name}', playlist.name)
                    .replace('{url}', playlist.external_urls.spotify)
                    .replace('{owner}', playlist.owner?.display_name || lang.spotify.details.unknownOwner)
                    .replace('{tracks}', playlist.tracks.total)
            )
        );
        if (idx < data.playlists.items.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}
async function handleTopArtists(interaction) {
    const limit = interaction.options.getInteger('limit') || 10;

    
    const genres = ['pop', 'rock', 'hip-hop', 'electronic', 'r-n-b'];
    const allArtists = [];

    for (const genre of genres.slice(0, 2)) {
        const data = await spotifyApiRequest(`/search?q=genre:${genre}&type=artist&limit=10`);
        allArtists.push(...data.artists.items);
    }

    
    const sorted = allArtists
        .sort((a, b) => b.followers.total - a.followers.total)
        .slice(0, limit);

    
    const unique = [];
    const seenIds = new Set();
    for (const artist of sorted) {
        if (!seenIds.has(artist.id)) {
            seenIds.add(artist.id);
            unique.push(artist);
        }
    }

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('voice')} Top Artists\n\nMost popular artists right now`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    unique.slice(0, limit).forEach((artist, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${artist.name}](${artist.external_urls.spotify})\n` +
                `Followers: ${artist.followers.total.toLocaleString()} • Popularity: ${artist.popularity}%`
            )
        );
        if (idx < unique.slice(0, limit).length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleTopAlbums(interaction) {
    const country = interaction.options.getString('country') || 'US';

    
    const data = await spotifyApiRequest(`/browse/new-releases?country=${country}&limit=10`);

    if (!data.albums?.items?.length) {
        return sendError(interaction, 'No albums found');
    }

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('playlist')} Top Albums - ${country}\n\nLatest popular releases`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    if (data.albums.items[0]?.images?.[0]?.url) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                item => item.setURL(data.albums.items[0].images[0].url).setDescription(lang.spotify.media.albumCover)
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }

    data.albums.items.forEach((album, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${album.name}](${album.external_urls.spotify})\n` +
                `Artist: ${album.artists.map(a => a.name).join(', ')} • ${album.total_tracks} tracks`
            )
        );
        if (idx < data.albums.items.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleViral(interaction) {
    const country = interaction.options.getString('country') || 'US';

    
    const searchTerms = ['viral', 'trending', 'hits'];
    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const data = await spotifyApiRequest(`/search?q=${randomTerm}&type=track&market=${country}&limit=10`);

    if (!data.tracks?.items?.length) {
        return sendError(interaction, 'No viral tracks found');
    }

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('trend')} Viral Tracks - ${country.toUpperCase()}\n\nTrending music right now`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    if (data.tracks.items[0]?.album?.images?.[0]?.url) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                item => item.setURL(data.tracks.items[0].album.images[0].url).setDescription(lang.spotify.media.trackCover)
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }

    data.tracks.items.forEach((track, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${track.name}](${track.external_urls.spotify})\n` +
                `Artist: ${track.artists.map(a => a.name).join(', ')} • Popularity: ${track.popularity}%`
            )
        );
        if (idx < data.tracks.items.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleUser(interaction) {
    const username = interaction.options.getString('username');

    try {
        const data = await spotifyApiRequest(`/users/${username}`);

        const container = new ContainerBuilder().setAccentColor(0x1DB954);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${getEmoji('user')} ${data.display_name || username}\n\n` +
                `${lang.spotify.details.username.replace('{user}', data.id)}\n` +
                `${lang.spotify.details.followers.replace('{count}', data.followers?.total?.toLocaleString() || 'N/A')}\n` +
                `${lang.spotify.details.profile.replace('{label}', lang.spotify.details.viewOnSpotify).replace('{url}', data.external_urls.spotify)}`
            )
        );

        if (data.images?.[0]?.url) {
            container.addSeparatorComponents(new SeparatorBuilder());
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    item => item.setURL(data.images[0].url).setDescription(lang.spotify.media.profilePicture)
                )
            );
        }

        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
        
        try {
            const searchData = await spotifyApiRequest(`/search?q=${encodeURIComponent(username)}&type=playlist&limit=5`);

            const userPlaylists = searchData.playlists.items.filter(p =>
                p.owner?.id?.toLowerCase() === username.toLowerCase() ||
                p.owner?.display_name?.toLowerCase()?.includes(username.toLowerCase())
            );

            if (userPlaylists.length === 0) {
                return sendError(interaction, `User "${username}" not found`);
            }

            const container = new ContainerBuilder().setAccentColor(0x1DB954);

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${getEmoji('user')} ${userPlaylists[0].owner.display_name || username}\n\nPublic playlists`)
            );

            container.addSeparatorComponents(new SeparatorBuilder());

            userPlaylists.forEach((playlist, idx) => {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${idx + 1}.** [${playlist.name}](${playlist.external_urls.spotify})\n` +
                        `Tracks: ${playlist.tracks.total}`
                    )
                );
                if (idx < userPlaylists.length - 1) {
                    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                }
            });

            await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (fallbackError) {
            return sendError(interaction, `User "${username}" not found`);
        }
    }
}

async function handleDecade(interaction) {
    const year = interaction.options.getString('year');

    
    const decadeMatch = year.match(/(\d{4})/);
    if (!decadeMatch) {
        return sendError(interaction, 'Invalid decade format. Use format like: 1980s, 1990s, 2000s');
    }

    const startYear = parseInt(decadeMatch[1]);
    const endYear = startYear + 9;

    
    const data = await spotifyApiRequest(`/search?q=year:${startYear}-${endYear}&type=track&limit=10`);

    if (!data.tracks?.items?.length) {
        return sendError(interaction, `No tracks found from ${year}`);
    }

    const container = new ContainerBuilder().setAccentColor(0x1DB954);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getEmoji('calendar')} Music from the ${year}\n\nClassic tracks from ${startYear}-${endYear}`)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    if (data.tracks.items[0]?.album?.images?.[0]?.url) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                item => item.setURL(data.tracks.items[0].album.images[0].url).setDescription(lang.spotify.media.albumCover)
            )
        );
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }

    data.tracks.items.forEach((track, idx) => {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${idx + 1}.** [${track.name}](${track.external_urls.spotify})\n` +
                `Artist: ${track.artists.map(a => a.name).join(', ')} • Album: ${track.album.name}`
            )
        );
        if (idx < data.tracks.items.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

