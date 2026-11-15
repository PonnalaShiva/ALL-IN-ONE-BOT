
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { autoplayCollection, playlistCollection } = require('../../mongodb');
const SpotifyWebApi = require('spotify-web-api-node');
const { getData } = require('spotify-url-info')(fetch);
const config = require('../../config.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');

const spotifyApi = new SpotifyWebApi({
    clientId: config.spotifyClientId,
    clientSecret: config.spotifyClientSecret,
});

async function replyAndAutoDelete(interaction, card, timeout = 6000) {
    const reply = await sendV2(interaction, card);
    if (timeout > 0 && reply && typeof reply.delete === 'function') {
        setTimeout(() => reply.delete().catch(() => { }), timeout);
    }
    return reply;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Advanced music player with V2 components')
        .addSubcommand(subcommand =>
            subcommand
                .setName('play')
                .setDescription('Play a song or playlist in the voice channel.')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Enter the song name or URL.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('nowplaying')
                .setDescription('Get information about the currently playing song.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('loop')
                .setDescription('Toggle looping mode for the current track or the entire queue.')
                .addStringOption(option =>
                    option.setName('mode')
                        .setDescription('Select loop mode: none, track, or queue.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Disable Loop', value: 'none' },
                            { name: 'Track Loop', value: 'track' },
                            { name: 'Queue Loop', value: 'queue' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('pause')
                .setDescription('Pause the currently playing song.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resume')
                .setDescription('Resume the paused song.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('shuffle')
                .setDescription('Shuffle the queue.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('skip')
                .setDescription('Skip the current song.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the music and clear the queue.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('queue')
                .setDescription('View the current music queue.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a specific song from the queue.')
                .addIntegerOption(option =>
                    option.setName('track')
                        .setDescription('Track number to remove.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('createplaylist')
                .setDescription('Create a new playlist.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('visibility')
                        .setDescription('Choose if the playlist is public or private.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Public', value: 'public' },
                            { name: 'Private', value: 'private' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('playplaylist')
                .setDescription('Play a saved playlist.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('viewmyplaylists')
                .setDescription('View your saved playlists.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('viewmyplaylistsongs')
                .setDescription('View songs in your playlist.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('allplaylists')
                .setDescription('View all public playlists.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deletesong')
                .setDescription('Remove a song from your playlist.')
                .addStringOption(option =>
                    option.setName('playlist')
                        .setDescription('Playlist name.')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('index')
                        .setDescription('Song index to remove.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deleteplaylist')
                .setDescription('Delete your playlist.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('autoplay')
                .setDescription('Enable or disable autoplay.')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable autoplay.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addsong')
                .setDescription('Add a song to a playlist.')
                .addStringOption(option =>
                    option.setName('playlist')
                        .setDescription('The playlist name.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('song')
                        .setDescription('Enter song name or URL.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('volume')
                .setDescription('Set the music volume (0-100).')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Volume level (0-100).')
                        .setRequired(true))),

    async execute(interaction) {
        try {
            await deferReply(interaction);
            const subcommand = interaction.options.getSubcommand();
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;
            const { channel } = member.voice;
            const client = interaction.client;

            const checkVoiceChannel = async () => {
                if (!channel) {
                    const title = (lang.lavalink.common.voiceRequiredTitle)
                        .replace('{emoji}', getEmoji('cross'));
                    const desc = lang.lavalink.common.voiceRequiredDesc;
                    await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    return false;
                }

                const botVoiceChannel = interaction.guild.members.me?.voice.channel;
                if (botVoiceChannel && botVoiceChannel.id !== channel.id) {
                    const title = (lang.lavalink.common.channelConflictTitle)
                        .replace('{emoji}', getEmoji('cross'));
                    const desc = lang.lavalink.common.channelConflictDesc;
                    await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    return false;
                }

                const permissions = channel.permissionsFor(client.user);
                if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
                    const title = (lang.lavalink.common.insufficientPermsTitle)
                        .replace('{emoji}', getEmoji('cross'));
                    const desc = lang.lavalink.common.insufficientPermsDesc;
                    await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    return false;
                }

                return true;
            };

            const getOrCreatePlayer = async () => {
                if (client.nodeManager) {
                    try {
                        await client.nodeManager.ensureNodeAvailable();
                    } catch (error) {
                        const title = (lang.lavalink.common.lavalinkUnavailableTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.common.lavalinkUnavailableDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                        return null;
                    }
                }

                let player = client.riffy.players.get(guildId);
                if (!player) {
                    try {
                        player = await client.riffy.createConnection({
                            guildId,
                            voiceChannel: channel.id,
                            textChannel: interaction.channel.id,
                            deaf: true
                        });
                    } catch (error) {
                        console.error('Error creating player:', error);
                        if (client.nodeManager && error.message.includes('node')) {
                            try {
                                await client.nodeManager.ensureNodeAvailable();
                                player = await client.riffy.createConnection({
                                    guildId,
                                    voiceChannel: channel.id,
                                    textChannel: interaction.channel.id,
                                    deaf: true
                                });
                            } catch (retryError) {
                                const title = (lang.lavalink.common.connectionFailedTitle)
                                    .replace('{emoji}', getEmoji('cross'));
                                const desc = lang.lavalink.common.connectionFailedDesc;
                                await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                                return null;
                            }
                        } else {
                            const title = (lang.lavalink.common.connectionFailedTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = lang.lavalink.common.connectionFailedDesc;
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return null;
                        }
                    }
                }
                return player;
            };

            const checkPlayerExists = async () => {
                const player = client.riffy.players.get(guildId);
                if (!player) {
                    const title = (lang.lavalink.common.noActivePlayerTitle)
                        .replace('{emoji}', getEmoji('cross'));
                    const desc = lang.lavalink.common.noActivePlayerDesc;
                    const tips = lang.lavalink.common.noActivePlayerTips;
                    const card = buildCard({
                        title,
                        description: desc,
                        sections: tips ? [tips] : [],
                        accentColor: ACCENT.danger
                    });
                    await replyAndAutoDelete(interaction, card, 6000);
                    return false;
                }
                return player;
            };

            switch (subcommand) {
                case 'play': {
                    try {
                        if (!await checkVoiceChannel()) return;

                        const query = interaction.options.getString('query');
                        const user = interaction.user;
                        let player = await getOrCreatePlayer();
                        if (!player) return;

                        if (query.includes('spotify.com')) {
                            try {
                                const spotifyData = await getData(query);
                                const token = await spotifyApi.clientCredentialsGrant();
                                spotifyApi.setAccessToken(token.body.access_token);

                                let trackList = [];
                                if (spotifyData.type === 'track') {
                                    const searchQuery = `${spotifyData.name} - ${spotifyData.artists.map(a => a.name).join(', ')}`;
                                    trackList.push(searchQuery);
                                } else if (spotifyData.type === 'playlist') {
                                    const playlistId = query.split('/playlist/')[1].split('?')[0];
                                    let offset = 0;
                                    const limit = 100;
                                    let fetched = [];

                                    do {
                                        const data = await spotifyApi.getPlaylistTracks(playlistId, { limit, offset });
                                        fetched = data.body.items.filter(item => item.track).map(item =>
                                            `${item.track.name} - ${item.track.artists.map(a => a.name).join(', ')}`
                                        );
                                        trackList.push(...fetched);
                                        offset += limit;
                                    } while (fetched.length === limit);
                                }

                                if (trackList.length === 0) {
                                    const title = (lang.lavalink.play.spotifyNoTracksTitle)
                                        .replace('{emoji}', getEmoji('cross'));
                                    const desc = lang.lavalink.play.spotifyNoTracksDesc;
                                    await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                                    return;
                                }

                                let added = 0;
                                for (const trackQuery of trackList) {
                                    const result = await client.riffy.resolve({ query: trackQuery, requester: user });
                                    if (result && result.tracks && result.tracks.length > 0) {
                                        const resolvedTrack = result.tracks[0];
                                        resolvedTrack.requester = {
                                            id: user.id,
                                            username: user.username,
                                            avatarURL: user.displayAvatarURL()
                                        };
                                        player.queue.add(resolvedTrack);
                                        added++;
                                    }
                                }

                                const title = (lang.lavalink.play.spotifyTitle)
                                    .replace('{emoji}', getEmoji('music'));
                                const successDesc = (lang.lavalink.play.spotifySuccess)
                                    .replace('{type}', spotifyData.type === 'track' ? 'Track' : 'Playlist')
                                    .replace('{added}', added)
                                    .replace('{plural}', added !== 1 ? 's' : '')
                                    .replace('{source}', spotifyData.name || 'Spotify Content');
                                const statusSection = (lang.lavalink.play.spotifyStatus)
                                    .replace('{queueLength}', player.queue.length)
                                    .replace('{nowPlaying}', player.current ? 'Active' : 'Starting...')
                                    .replace('{estimatedTime}', Math.round(added * 3.5));

                                const card = buildCard({
                                    title,
                                    description: successDesc,
                                    sections: [statusSection],
                                    thumbnailURL: user.displayAvatarURL({ dynamic: true }),
                                    accentColor: 0x1db954
                                });

                                await replyAndAutoDelete(interaction, card, 8000);
                                if (!player.playing && !player.paused) player.play();
                            } catch (spotifyError) {
                                console.error('Spotify error:', spotifyError);
                                const title = (lang.lavalink.play.spotifyErrorTitle)
                                    .replace('{emoji}', getEmoji('cross'));
                                const desc = lang.lavalink.play.spotifyErrorDesc;
                                const solutions = lang.lavalink.play.spotifyErrorSolutions;
                                const card = buildCard({
                                    title,
                                    description: desc,
                                    sections: solutions ? [solutions] : [],
                                    accentColor: ACCENT.danger
                                });
                                await replyAndAutoDelete(interaction, card, 10000);
                                return;
                            }
                        } else if (query.includes('youtube.com') || query.includes('youtu.be')) {
                            const isPlaylist = query.includes('list=');
                            const isMix = query.includes('list=RD');

                            if (isMix) {
                                const title = (lang.lavalink.play.unsupportedMixTitle)
                                    .replace('{emoji}', getEmoji('cross'));
                                const desc = lang.lavalink.play.unsupportedMixDesc;
                                await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                                return;
                            }

                            const resolve = await client.riffy.resolve({ query, requester: user });
                            if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
                                const title = (lang.lavalink.play.noResultsTitle)
                                    .replace('{emoji}', getEmoji('cross'));
                                const desc = lang.lavalink.play.noResultsDesc;
                                await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                                return;
                            }

                            if (isPlaylist) {
                                for (const track of resolve.tracks) {
                                    track.requester = {
                                        id: user.id,
                                        username: user.username,
                                        avatarURL: user.displayAvatarURL()
                                    };
                                    player.queue.add(track);
                                }

                                const title = (lang.lavalink.play.youtubePlaylistTitle)
                                    .replace('{emoji}', getEmoji('music'));
                                const desc = (lang.lavalink.play.youtubePlaylistSuccess)
                                    .replace('{count}', resolve.tracks.length)
                                    .replace('{queueLength}', player.queue.length)
                                    .replace('{duration}', Math.round(resolve.tracks.length * 3.5));

                                const card = buildCard({
                                    title,
                                    description: desc,
                                    thumbnailURL: user.displayAvatarURL({ dynamic: true }),
                                    accentColor: ACCENT.music || 0xdc92ff
                                });

                                await replyAndAutoDelete(interaction, card, 6000);
                            } else {
                                const track = resolve.tracks[0];
                                track.requester = {
                                    id: user.id,
                                    username: user.username,
                                    avatarURL: user.displayAvatarURL()
                                };
                                player.queue.add(track);

                                const title = (lang.lavalink.play.trackAddedTitle)
                                    .replace('{emoji}', getEmoji('music'));
                                const desc = (lang.lavalink.play.trackAddedSuccess)
                                    .replace('{title}', track.info.title)
                                    .replace('{duration}', this.formatDuration(track.info.length))
                                    .replace('{position}', player.queue.length);

                                const card = buildCard({
                                    title,
                                    description: desc,
                                    thumbnailURL: user.displayAvatarURL({ dynamic: true }),
                                    accentColor: ACCENT.music || 0xdc92ff
                                });

                                await replyAndAutoDelete(interaction, card, 6000);
                            }

                            if (!player.playing && !player.paused) player.play();
                        } else {
                            const resolve = await client.riffy.resolve({ query, requester: user });
                            if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
                                const title = (lang.lavalink.play.noSearchResultsTitle)
                                    .replace('{emoji}', getEmoji('cross'));
                                const desc = lang.lavalink.play.noSearchResultsDesc;
                                await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                                return;
                            }

                            const track = resolve.tracks[0];
                            track.requester = {
                                id: user.id,
                                username: user.username,
                                avatarURL: user.displayAvatarURL()
                            };
                            player.queue.add(track);

                            const title = (lang.lavalink.play.searchResultTitle)
                                .replace('{emoji}', getEmoji('music'));
                            const desc = (lang.lavalink.play.searchResultSuccess)
                                .replace('{title}', track.info.title)
                                .replace('{position}', player.queue.length)
                                .replace('{duration}', this.formatDuration(track.info.length));

                            const card = buildCard({
                                title,
                                description: desc,
                                thumbnailURL: user.displayAvatarURL({ dynamic: true }),
                                accentColor: ACCENT.music || 0xdc92ff
                            });

                            await replyAndAutoDelete(interaction, card, 6000);
                            if (!player.playing && !player.paused) player.play();
                        }
                    } catch (error) {
                        console.error('Error resolving query:', error);
                        const title = (lang.lavalink.play.playbackErrorTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.play.playbackErrorDesc;
                        const troubleshooting = lang.lavalink.play.playbackErrorTroubleshooting;
                        const card = buildCard({
                            title,
                            description: desc,
                            sections: troubleshooting ? [troubleshooting] : [],
                            accentColor: ACCENT.danger
                        });
                        await replyAndAutoDelete(interaction, card, 10000);
                    }
                    break;
                }

                case 'nowplaying': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    const currentTrack = player.current;
                    if (!currentTrack) {
                        const title = (lang.lavalink.nowplaying.noTrackTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.nowplaying.noTrackDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                        return;
                    }

                    const title = (lang.lavalink.nowplaying.nowPlayingTitle)
                        .replace('{emoji}', getEmoji('music'));
                    const platformLink = currentTrack.info.uri
                        ? (lang.lavalink.nowplaying.listenOnPlatform).replace('{url}', currentTrack.info.uri)
                        : '';
                    const desc = (lang.lavalink.nowplaying.nowPlayingDetails)
                        .replace('{title}', currentTrack.info.title)
                        .replace('{link}', platformLink)
                        .replace('{duration}', this.formatDuration(currentTrack.info.length))
                        .replace('{position}', this.formatDuration(player.position))
                        .replace('{totalDuration}', this.formatDuration(currentTrack.info.length))
                        .replace('{volume}', player.volume)
                        .replace('{loop}', player.loop || 'None')
                        .replace('{requester}', currentTrack.requester?.username || 'Unknown');

                    const card = buildCard({
                        title,
                        description: desc,
                        thumbnailURL: currentTrack.info.artwork || currentTrack.requester?.avatarURL || interaction.user.displayAvatarURL(),
                        accentColor: ACCENT.music || 0xdc92ff
                    });

                    await replyAndAutoDelete(interaction, card, 12000);
                    break;
                }

                case 'pause': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    player.pause(true);
                    const title = (lang.lavalink.pause.title)
                        .replace('{emoji}', getEmoji('time'));
                    const desc = lang.lavalink.pause.desc;
                    const card = buildCard({
                        title,
                        description: desc,
                        accentColor: ACCENT.warning
                    });
                    await replyAndAutoDelete(interaction, card, 5000);
                    break;
                }

                case 'resume': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    player.pause(false);
                    const title = (lang.lavalink.resume.title)
                        .replace('{emoji}', getEmoji('tick'));
                    const desc = lang.lavalink.resume.desc;
                    const card = buildCard({
                        title,
                        description: desc,
                        accentColor: ACCENT.success
                    });
                    await replyAndAutoDelete(interaction, card, 5000);
                    break;
                }

                case 'shuffle': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    if (player.queue.length === 0) {
                        const title = (lang.lavalink.shuffle.emptyTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.shuffle.emptyDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                        return;
                    }

                    player.queue.shuffle();
                    const title = (lang.lavalink.shuffle.title)
                        .replace('{emoji}', getEmoji('sparkles'));
                    const desc = (lang.lavalink.shuffle.desc)
                        .replace('{count}', player.queue.length)
                        .replace('{next}', player.queue[0]?.info.title || 'None');

                    const card = buildCard({
                        title,
                        description: desc,
                        accentColor: ACCENT.primary
                    });
                    await replyAndAutoDelete(interaction, card, 6000);
                    break;
                }

                case 'skip': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    const currentTrack = player.current;
                    player.stop();

                    const title = (lang.lavalink.skip.title)
                        .replace('{emoji}', getEmoji('forward'));
                    const desc = currentTrack
                        ? (lang.lavalink.skip.desc).replace('{title}', currentTrack.info.title)
                        : (lang.lavalink.skip.noTrackDesc);

                    const card = buildCard({
                        title,
                        description: desc,
                        accentColor: ACCENT.info
                    });
                    await replyAndAutoDelete(interaction, card, 5000);
                    break;
                }

                case 'stop': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    const queueLength = player.queue.length;
                    player.destroy();

                    const title = (lang.lavalink.stop.title)
                        .replace('{emoji}', getEmoji('cross'));
                    const desc = (lang.lavalink.stop.desc)
                        .replace('{count}', queueLength);

                    const card = buildCard({
                        title,
                        description: desc,
                        accentColor: ACCENT.danger
                    });
                    await replyAndAutoDelete(interaction, card, 8000);
                    break;
                }

                case 'queue': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    const queue = player.queue;
                    if (!queue || queue.length === 0) {
                        const title = (lang.lavalink.queue.emptyQueueTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.queue.emptyQueueDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                        return;
                    }

                    const formattedQueue = queue.slice(0, 15).map((track, i) =>
                        `**${i + 1}.** ${track.info.title}\n> *Requested by ${track.requester?.username || 'Unknown'}*`
                    ).join('\n\n');

                    const title = (lang.lavalink.queue.queueTitle)
                        .replace('{emoji}', getEmoji('music'));
                    const queueInfo = (lang.lavalink.queue.queueInfo)
                        .replace('{count}', queue.length)
                        .replace('{duration}', Math.round(queue.length * 3.5))
                        .replace('{loop}', player.loop || 'None')
                        .replace('{shuffle}', player.queue.shuffled ? 'Active' : 'Inactive');

                    const moreTracksText = queue.length > 15
                        ? `\n\n${(lang.lavalink.queue.moreTracks).replace('{count}', queue.length - 15)}`
                        : '';

                    const card = buildCard({
                        title,
                        description: queueInfo,
                        sections: [`${lang.lavalink.queue.upNext}\n\n${formattedQueue}${moreTracksText}`],
                        accentColor: ACCENT.music || 0xdc92ff
                    });

                    await replyAndAutoDelete(interaction, card, 15000);
                    break;
                }

                case 'loop': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    const mode = interaction.options.getString('mode');

                    try {
                        player.setLoop(mode);

                        const title = (lang.lavalink.loop.title)
                            .replace('{emoji}', getEmoji('refresh'));
                        const desc = (lang.lavalink.loop.desc)
                            .replace('{mode}', mode.toUpperCase())
                            .replace('{details}', this.getLoopModeDescription(mode))
                            .replace('{active}', mode !== 'none' ? 'Active' : 'Inactive')
                            .replace('{type}', mode === 'track' ? 'Single Track' : mode === 'queue' ? 'Entire Queue' : 'No Loop');

                        const card = buildCard({
                            title,
                            description: desc,
                            accentColor: ACCENT.primary
                        });
                        await replyAndAutoDelete(interaction, card, 8000);
                    } catch (error) {
                        console.error('Error setting loop mode:', error);
                        const title = (lang.lavalink.loop.errorTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.loop.errorDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    }
                    break;
                }

                case 'remove': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    const trackNumber = interaction.options.getInteger('track');
                    if (trackNumber < 1 || trackNumber > player.queue.length) {
                        const title = (lang.lavalink.remove.invalidTrackTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = (lang.lavalink.remove.invalidTrackDesc)
                            .replace('{max}', player.queue.length);
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                        return;
                    }

                    const removedTrack = player.queue[trackNumber - 1];
                    player.queue.remove(trackNumber - 1);

                    const title = (lang.lavalink.remove.title)
                        .replace('{emoji}', getEmoji('delete'));
                    const desc = (lang.lavalink.remove.desc)
                        .replace('{title}', removedTrack.info.title)
                        .replace('{position}', trackNumber)
                        .replace('{requester}', removedTrack.requester?.username || 'Unknown')
                        .replace('{remaining}', player.queue.length);

                    const card = buildCard({
                        title,
                        description: desc,
                        accentColor: ACCENT.danger
                    });
                    await replyAndAutoDelete(interaction, card, 7000);
                    break;
                }

                case 'volume': {
                    const player = await checkPlayerExists();
                    if (!player) return;

                    const volume = interaction.options.getInteger('level');
                    if (volume < 0 || volume > 100) {
                        const title = (lang.lavalink.volume.invalidVolumeTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.volume.invalidVolumeDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                        return;
                    }

                    const oldVolume = player.volume;
                    player.setVolume(volume);

                    const title = (lang.lavalink.volume.title)
                        .replace('{emoji}', getEmoji('sound'));
                    const desc = (lang.lavalink.volume.desc)
                        .replace('{oldVolume}', oldVolume)
                        .replace('{newVolume}', volume)
                        .replace('{bar}', this.getVolumeBar(volume))
                        .replace('{volume}', volume)
                        .replace('{quality}', volume > 80 ? 'High' : volume > 40 ? 'Medium' : 'Low')
                        .replace('{iconText}', volume === 0 ? 'Muted' : volume > 75 ? 'Loud' : volume > 25 ? 'Medium' : 'Quiet');

                    const card = buildCard({
                        title,
                        description: desc,
                        accentColor: ACCENT.primary
                    });
                    await replyAndAutoDelete(interaction, card, 8000);
                    break;
                }

                case 'createplaylist': {
                    try {
                        const name = interaction.options.getString('name');
                        const visibility = interaction.options.getString('visibility');

                        const existingPlaylist = await playlistCollection.findOne({ name, owner: userId });
                        if (existingPlaylist) {
                            const title = (lang.lavalink.playlist.existsTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = (lang.lavalink.playlist.existsDesc)
                                .replace('{name}', name);
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        await playlistCollection.insertOne({
                            name,
                            owner: userId,
                            visibility,
                            songs: [],
                            createdAt: new Date()
                        });

                        const title = (lang.lavalink.playlist.createdTitle)
                            .replace('{emoji}', getEmoji('tick'));
                        const desc = (lang.lavalink.playlist.createdDesc)
                            .replace('{name}', name)
                            .replace('{visibility}', visibility.toUpperCase())
                            .replace('{owner}', interaction.user.username);

                        const card = buildCard({
                            title,
                            description: desc,
                            thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
                            accentColor: ACCENT.success
                        });

                        await replyAndAutoDelete(interaction, card, 10000);
                    } catch (error) {
                        console.error('Error creating playlist:', error);
                        const title = (lang.lavalink.playlist.createFailedTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.playlist.createFailedDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    }
                    break;
                }

                case 'playplaylist': {
                    if (!await checkVoiceChannel()) return;

                    try {
                        const name = interaction.options.getString('name');
                        const playlist = await playlistCollection.findOne({ name });

                        if (!playlist) {
                            const title = (lang.lavalink.playlist.notFoundTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = (lang.lavalink.playlist.notFoundDesc)
                                .replace('{name}', name);
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        if (playlist.visibility === 'private' && playlist.owner !== userId) {
                            const title = (lang.lavalink.playlist.privateTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = lang.lavalink.playlist.privateDesc;
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        if (playlist.songs.length === 0) {
                            const title = (lang.lavalink.playlist.emptyTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = (lang.lavalink.playlist.emptyDesc)
                                .replace('{name}', name);
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        let player = await getOrCreatePlayer();
                        if (!player) return;

                        const loadingTitle = (lang.lavalink.playlist.loadingTitle)
                            .replace('{emoji}', getEmoji('refresh'));
                        const loadingDesc = (lang.lavalink.playlist.loadingDesc)
                            .replace('{count}', playlist.songs.length)
                            .replace('{name}', name);

                        await sendV2(interaction, buildCard({
                            title: loadingTitle,
                            description: loadingDesc,
                            accentColor: ACCENT.warning
                        }));

                        let addedTracks = 0;
                        let failedTracks = 0;

                        for (const song of playlist.songs) {
                            try {
                                const resolve = await client.riffy.resolve({ query: song, requester: interaction.user });
                                if (resolve.tracks.length > 0) {
                                    const track = resolve.tracks[0];
                                    track.requester = {
                                        id: interaction.user.id,
                                        username: interaction.user.username,
                                        avatarURL: interaction.user.displayAvatarURL()
                                    };
                                    player.queue.add(track);
                                    addedTracks++;
                                } else {
                                    failedTracks++;
                                }
                            } catch (error) {
                                console.warn(`Failed to resolve track: ${song}`, error);
                                failedTracks++;
                            }
                        }

                        if (addedTracks === 0) {
                            const title = (lang.lavalink.playlist.loadFailedTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = (lang.lavalink.playlist.loadFailedDesc)
                                .replace('{name}', name);
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 8000);
                            return;
                        }

                        const title = (lang.lavalink.playlist.loadedTitle)
                            .replace('{emoji}', getEmoji('music'));
                        const desc = (lang.lavalink.playlist.loadedDesc)
                            .replace('{name}', name)
                            .replace('{added}', addedTracks)
                            .replace('{failedInfo}', failedTracks > 0 ? `• Failed to load: **${failedTracks}** tracks\n` : '')
                            .replace('{queueLength}', player.queue.length)
                            .replace('{duration}', Math.round(addedTracks * 3.5))
                            .replace('{status}', player.playing ? 'Playing' : 'Starting playback...');

                        const card = buildCard({
                            title,
                            description: desc,
                            thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
                            accentColor: ACCENT.success
                        });

                        await replyAndAutoDelete(interaction, card, 12000);
                        if (!player.playing && !player.paused) {
                            player.play();
                        }
                    } catch (error) {
                        console.error('Error playing playlist:', error);
                        const title = (lang.lavalink.playlist.loadErrorTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.playlist.loadErrorDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                    }
                    break;
                }

                case 'viewmyplaylists': {
                    try {
                        const playlists = await playlistCollection.find({ owner: userId }).toArray();
                        if (playlists.length === 0) {
                            const title = (lang.lavalink.playlist.noPlaylistsTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = lang.lavalink.playlist.noPlaylistsDesc;
                            await replyAndAutoDelete(interaction, cards.warning(title, desc), 6000);
                            return;
                        }

                        const playlistList = playlists.map(p =>
                            `**${getEmoji('document')} ${p.name}**\n> *${p.visibility === 'public' ? getEmoji('world') + ' Public' : getEmoji('lock') + ' Private'} • ${p.songs.length} songs*`
                        ).join('\n\n');

                        const title = (lang.lavalink.playlist.myPlaylistsTitle)
                            .replace('{emoji}', getEmoji('music'));
                        const summary = (lang.lavalink.playlist.myPlaylistsSummary)
                            .replace('{count}', playlists.length)
                            .replace('{plural}', playlists.length !== 1 ? 's' : '')
                            .replace('{list}', playlistList);

                        const card = buildCard({
                            title,
                            description: summary,
                            sections: [lang.lavalink.playlist.myPlaylistsActions],
                            accentColor: ACCENT.info
                        });

                        await replyAndAutoDelete(interaction, card, 15000);
                    } catch (error) {
                        console.error('Error viewing playlists:', error);
                        const title = (lang.lavalink.playlist.notFoundTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.common.genericError;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    }
                    break;
                }

                case 'viewmyplaylistsongs': {
                    try {
                        const playlistName = interaction.options.getString('name');
                        const playlist = await playlistCollection.findOne({ name: playlistName });

                        if (!playlist) {
                            const title = (lang.lavalink.playlist.notFoundTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = (lang.lavalink.playlist.notFoundDesc)
                                .replace('{name}', playlistName);
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        if (playlist.visibility === 'private' && playlist.owner !== userId) {
                            const title = (lang.lavalink.playlist.accessDeniedTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = lang.lavalink.playlist.accessDeniedDesc;
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        if (playlist.songs.length === 0) {
                            const title = (lang.lavalink.playlist.emptyTitle)
                                .replace('{emoji}', getEmoji('warning'));
                            const desc = (lang.lavalink.playlist.emptySongsDesc)
                                .replace('{name}', playlistName);
                            await replyAndAutoDelete(interaction, cards.warning(title, desc), 6000);
                            return;
                        }

                        const songList = playlist.songs.slice(0, 15).map((song, index) =>
                            `**${index + 1}.** ${song}`
                        ).join('\n');

                        const title = (lang.lavalink.playlist.songsTitle)
                            .replace('{emoji}', getEmoji('music'))
                            .replace('{name}', playlistName.toUpperCase());

                        const details = (lang.lavalink.playlist.songsDetails)
                            .replace('{count}', playlist.songs.length)
                            .replace('{owner}', playlist.owner === userId ? 'You' : '<@' + playlist.owner + '>')
                            .replace('{visibility}', playlist.visibility === 'public' ? 'Public' : 'Private')
                            .replace('{created}', playlist.createdAt ? new Date(playlist.createdAt).toLocaleDateString() : 'Unknown');

                        const moreSongs = playlist.songs.length > 15
                            ? `\n\n*...and ${playlist.songs.length - 15} more songs*`
                            : '';

                        const card = buildCard({
                            title,
                            description: details,
                            sections: [`${lang.lavalink.playlist.trackListTitle}\n\n${songList}${moreSongs}`],
                            accentColor: ACCENT.info
                        });

                        await replyAndAutoDelete(interaction, card, 20000);
                    } catch (error) {
                        console.error('Error viewing playlist songs:', error);
                        const title = (lang.lavalink.playlist.notFoundTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.common.genericError;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    }
                    break;
                }

                case 'allplaylists': {
                    try {
                        const playlists = await playlistCollection.find({ visibility: 'public' }).toArray();
                        if (playlists.length === 0) {
                            const title = (lang.lavalink.playlist.noPublicTitle)
                                .replace('{emoji}', getEmoji('warning'));
                            const desc = lang.lavalink.playlist.noPublicDesc;
                            await replyAndAutoDelete(interaction, cards.warning(title, desc), 6000);
                            return;
                        }

                        const publicList = playlists.slice(0, 20).map(p =>
                            `**${getEmoji('document')} ${p.name}**\n> *Owner: <@${p.owner}> • ${p.songs.length} songs*`
                        ).join('\n\n');

                        const title = (lang.lavalink.playlist.allPlaylistsTitle)
                            .replace('{emoji}', getEmoji('globe'));
                        const summary = (lang.lavalink.playlist.allPlaylistsSummary)
                            .replace('{count}', playlists.length)
                            .replace('{plural}', playlists.length !== 1 ? 's' : '');

                        const morePlaylists = playlists.length > 20
                            ? `\n\n*...and ${playlists.length - 20} more playlists*`
                            : '';

                        const card = buildCard({
                            title,
                            description: summary,
                            sections: [`${publicList}${morePlaylists}`],
                            accentColor: ACCENT.success
                        });

                        await replyAndAutoDelete(interaction, card, 25000);
                    } catch (error) {
                        console.error('Error retrieving public playlists:', error);
                        const title = (lang.lavalink.playlist.notFoundTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.common.genericError;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    }
                    break;
                }

                case 'deletesong': {
                    try {
                        const playlistName = interaction.options.getString('playlist');
                        const songIndex = interaction.options.getInteger('index') - 1;

                        const playlist = await playlistCollection.findOne({ name: playlistName });
                        if (!playlist) {
                            const title = (lang.lavalink.playlist.notFoundTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = (lang.lavalink.playlist.notFoundDesc)
                                .replace('{name}', playlistName);
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        if (playlist.owner !== userId) {
                            const title = (lang.lavalink.playlist.noPermissionTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = lang.lavalink.playlist.noPermissionDesc;
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        if (songIndex < 0 || songIndex >= playlist.songs.length) {
                            const title = (lang.lavalink.playlist.invalidIndexTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = (lang.lavalink.playlist.invalidIndexDesc)
                                .replace('{count}', playlist.songs.length);
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 7000);
                            return;
                        }

                        const removedSong = playlist.songs[songIndex];
                        playlist.songs.splice(songIndex, 1);

                        await playlistCollection.updateOne(
                            { name: playlistName, owner: userId },
                            { $set: { songs: playlist.songs } }
                        );

                        const title = (lang.lavalink.playlist.songRemovedTitle)
                            .replace('{emoji}', getEmoji('delete'));
                        const desc = (lang.lavalink.playlist.songRemovedDesc)
                            .replace('{song}', removedSong)
                            .replace('{playlist}', playlistName)
                            .replace('{count}', playlist.songs.length)
                            .replace('{position}', songIndex + 1);

                        const card = buildCard({
                            title,
                            description: desc,
                            accentColor: ACCENT.danger
                        });
                        await replyAndAutoDelete(interaction, card, 8000);
                    } catch (error) {
                        console.error('Error deleting song from playlist:', error);
                        const title = (lang.lavalink.playlist.deleteErrorTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.playlist.deleteErrorDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    }
                    break;
                }

                case 'deleteplaylist': {
                    try {
                        const playlistName = interaction.options.getString('name');
                        const playlist = await playlistCollection.findOne({ name: playlistName });

                        if (!playlist) {
                            const title = (lang.lavalink.playlist.notFoundTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = (lang.lavalink.playlist.notFoundDesc)
                                .replace('{name}', playlistName);
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        if (playlist.owner !== userId) {
                            const title = (lang.lavalink.playlist.noPermissionTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = lang.lavalink.playlist.deletePlaylistPermissionDesc;
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        await playlistCollection.deleteOne({ name: playlistName, owner: userId });

                        const title = (lang.lavalink.playlist.playlistDeletedTitle)
                            .replace('{emoji}', getEmoji('delete'));
                        const desc = (lang.lavalink.playlist.playlistDeletedDesc)
                            .replace('{name}', playlistName)
                            .replace('{count}', playlist.songs.length)
                            .replace('{visibility}', playlist.visibility);

                        const card = buildCard({
                            title,
                            description: desc,
                            accentColor: ACCENT.danger
                        });
                        await replyAndAutoDelete(interaction, card, 10000);
                    } catch (error) {
                        console.error('Error deleting playlist:', error);
                        const title = (lang.lavalink.playlist.deleteErrorTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.playlist.deleteErrorDesc;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    }
                    break;
                }

                case 'autoplay': {
                    if (!await checkVoiceChannel()) return;

                    try {
                        const enable = interaction.options.getBoolean('enabled');
                        await autoplayCollection.updateOne(
                            { guildId },
                            { $set: { autoplay: enable, updatedAt: new Date() } },
                            { upsert: true }
                        );

                        const title = (lang.lavalink.playlist.autoplayTitle)
                            .replace('{emoji}', getEmoji('refresh'));
                        const desc = (lang.lavalink.playlist.autoplayDesc)
                            .replace('{status}', enable ? 'ENABLED' : 'DISABLED')
                            .replace('{explanation}', enable ? lang.lavalink.playlist.autoplayEnabledDesc : lang.lavalink.playlist.autoplayDisabledDesc)
                            .replace('{statusIcon}', enable ? 'Active' : 'Inactive');

                        const card = buildCard({
                            title,
                            description: desc,
                            accentColor: enable ? ACCENT.success : ACCENT.danger
                        });

                        await replyAndAutoDelete(interaction, card, 8000);

                        const player = client.riffy.players.get(guildId);
                        if (player) {
                            player.autoplay = enable;
                        }
                    } catch (error) {
                        console.error('Error setting autoplay:', error);
                        const title = (lang.lavalink.common.criticalErrorTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.common.genericError;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    }
                    break;
                }

                case 'addsong': {
                    try {
                        const playlistName = interaction.options.getString('playlist');
                        const songInput = interaction.options.getString('song');

                        const playlist = await playlistCollection.findOne({ name: playlistName });
                        if (!playlist) {
                            const title = (lang.lavalink.playlist.notFoundTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = (lang.lavalink.playlist.notFoundDesc)
                                .replace('{name}', playlistName);
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 6000);
                            return;
                        }

                        if (playlist.owner !== userId && playlist.visibility === 'private') {
                            const title = (lang.lavalink.playlist.accessDeniedTitle)
                                .replace('{emoji}', getEmoji('cross'));
                            const desc = lang.lavalink.playlist.accessDeniedDesc;
                            await replyAndAutoDelete(interaction, cards.error(title, desc), 7000);
                            return;
                        }

                        await playlistCollection.updateOne(
                            { name: playlistName },
                            {
                                $push: { songs: songInput },
                                $set: { updatedAt: new Date() }
                            }
                        );

                        const title = (lang.lavalink.playlist.songAddedTitle)
                            .replace('{emoji}', getEmoji('tick'));
                        const desc = (lang.lavalink.playlist.songAddedDesc)
                            .replace('{song}', songInput)
                            .replace('{name}', playlistName)
                            .replace('{count}', playlist.songs.length + 1)
                            .replace('{user}', interaction.user.username);

                        const card = buildCard({
                            title,
                            description: desc,
                            accentColor: ACCENT.success
                        });

                        await replyAndAutoDelete(interaction, card, 10000);
                    } catch (error) {
                        console.error('Error adding song to playlist:', error);
                        const title = (lang.lavalink.playlist.createFailedTitle)
                            .replace('{emoji}', getEmoji('cross'));
                        const desc = lang.lavalink.common.genericError;
                        await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    }
                    break;
                }

                default: {
                    const title = (lang.lavalink.common.unknownCommandTitle)
                        .replace('{emoji}', getEmoji('cross'));
                    const desc = (lang.lavalink.common.unknownCommandDesc)
                        .replace('{subcommand}', subcommand);
                    await replyAndAutoDelete(interaction, cards.error(title, desc), 5000);
                    break;
                }
            }
        } catch (error) {
            console.error('Music command error:', error);
            const title = (lang.lavalink.common.criticalErrorTitle)
                .replace('{emoji}', getEmoji('cross'));
            const desc = lang.lavalink.common.criticalErrorDesc;
            const actions = lang.lavalink.common.criticalErrorActions;
            const card = buildCard({
                title,
                description: desc,
                sections: actions ? [actions] : [],
                accentColor: ACCENT.danger
            });

            try {
                await sendV2(interaction, card);
            } catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        }
    },

    formatDuration(ms) {
        if (!ms || isNaN(ms)) return '0:00';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
        }
    },

    getLoopModeDescription(mode) {
        const descriptions = {
            'none': lang.lavalink.loop.noneDesc,
            'track': lang.lavalink.loop.trackDesc,
            'queue': lang.lavalink.loop.queueDesc
        };
        return descriptions[mode] || 'Unknown loop mode';
    },

    getVolumeBar(volume) {
        const barLength = 20;
        const clamped = Math.max(0, Math.min(100, volume));
        const filledLength = Math.round((clamped / 100) * barLength);
        const emptyLength = barLength - filledLength;
        return '█'.repeat(filledLength) + '░'.repeat(emptyLength) + ' ${volume}%';
    }
};
