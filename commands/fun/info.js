
const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, sendLongV2, deferReply, ACCENT } = require('../../UI');

const POPCAT_API_URL = (process.env.POPCAT_API_URL || 'https://api.popcat.xyz').replace(/\/+$/, '');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Get real-time information')
        .addSubcommand(subcommand =>
            subcommand
                .setName('weather')
                .setDescription('Get weather info and 5-day forecast for any location')
                .addStringOption(option =>
                    option.setName('location')
                        .setDescription('City name or location')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('github')
                .setDescription('Get info on a GitHub user')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('GitHub username')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('npm')
                .setDescription('Get info on an NPM package')
                .addStringOption(option =>
                    option.setName('package')
                        .setDescription('NPM package name')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('imdb')
                .setDescription('Get movie / TV show info from IMDB')
                .addStringOption(option =>
                    option.setName('movie')
                        .setDescription('Movie or TV show name')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('lyrics')
                .setDescription('Get song lyrics')
                .addStringOption(option =>
                    option.setName('song')
                        .setDescription('Song name or artist + title')
                        .setRequired(true)
                )
        ),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        const VALID_SUBS = new Set([
            'weather', 'github', 'npm', 'imdb', 'lyrics'
        ]);

        let subcommand = '';
        let optionsMock = {};

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            const rawSub = args?.[0]?.toLowerCase();
            if (rawSub && VALID_SUBS.has(rawSub)) {
                subcommand = rawSub;
                const val = args.slice(1).join(' ');
                optionsMock.location = val;
                optionsMock.username = val;
                optionsMock.package = val;
                optionsMock.movie = val;
                optionsMock.song = val;
            } else {
                subcommand = 'help';
            }
        }

        if (!isSlash && subcommand === 'help') {
            const title = lang.fun.info.guideTitle.replace('{emoji}', getEmoji('info'));
            const helpCard = buildCard({
                title,
                description: lang.fun.info.guideDescription,
                sections: [
                    `**Usage:** \`!info <category> <query>\`\n\n` +
                    `**Categories & Examples:**\n` +
                    `• \`weather <location>\` - Weather + 5-day forecast (e.g. \`New York\`)\n` +
                    `• \`github <username>\` - GitHub user profile (e.g. \`octocat\`)\n` +
                    `• \`npm <package>\` - Node.js package info (e.g. \`express\`)\n` +
                    `• \`imdb <movie>\` - Movie/show info (e.g. \`Inception\`)\n` +
                    `• \`lyrics <song>\` - Song lyrics (e.g. \`Blinding Lights\`)`
                ],
                accentColor: ACCENT.primary
            });
            return await sendV2(interaction, helpCard);
        }

        if (!isSlash) {
            interaction.options = {
                getSubcommand: () => subcommand,
                getString: (name) => optionsMock[name] || null
            };
        }

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Info] Defer failed:', err.message);
                return;
            }
        }

        const sendReply = async (card) => {
            return await sendV2(interaction, card);
        };

        try {
            let response, card;

            switch (subcommand) {
                case 'weather': {
                    const location = interaction.options.getString('location');
                    if (!location) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.info.locationRequired
                        ));
                    }

                    response = await axios.get(`${POPCAT_API_URL}/v2/weather?q=${encodeURIComponent(location)}`);

                    
                    const raw = response.data?.message || response.data;
                    const weatherData = Array.isArray(raw) ? raw[0] : raw;

                    if (!weatherData || !weatherData.current) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.info.locationNotFound
                        ));
                    }

                    const cur = weatherData.current;
                    const loc = weatherData.location;

                    
                    const skycode = parseInt(cur.skycode || '0');
                    let weatherEmoji = getEmoji('world');

                    
                    const lines = [];
                    if (cur.skytext) lines.push(`> **Condition:** ${weatherEmoji} ${cur.skytext}`);
                    if (loc?.name) lines.push(`> **Location:** ${cur.observationpoint || loc.name}`);
                    if (cur.date && cur.observationtime) {
                        lines.push(`> **Observed:** ${cur.day}, ${cur.date} at ${cur.observationtime}`);
                    }
                    lines.push('');
                    if (cur.temperature) lines.push(`• **Temperature:** ${cur.temperature}°${loc?.degreetype || 'C'}`);
                    if (cur.feelslike) lines.push(`• **Feels Like:** ${cur.feelslike}°${loc?.degreetype || 'C'}`);
                    if (cur.humidity) lines.push(`• **Humidity:** ${cur.humidity}%`);
                    if (cur.winddisplay) lines.push(`• **Wind:** ${cur.winddisplay}`);

                    
                    const forecast = weatherData.forecast;
                    if (Array.isArray(forecast) && forecast.length > 0) {
                        lines.push('');
                        lines.push('**5-Day Forecast:**');
                        const skyEmoji = (code) => getEmoji('world');
                        for (const day of forecast.slice(0, 5)) {
                            const precip = day.precip && day.precip !== '0' ? ` ${day.precip}%` : '';
                            lines.push(`• **${day.shortday || day.day}:** ${skyEmoji(day.skycodeday)} ${day.skytextday} | ${day.low}–${day.high}°${loc?.degreetype || 'C'}${precip}`);
                        }
                    }

                    const titleStr = `${getEmoji('weather')} Weather — ${loc?.name || location}`;

                    card = buildCard({
                        title: titleStr,
                        description: lines.join('\n'),
                        accentColor: 0x87CEEB
                    });

                    await sendReply(card);
                    break;
                }

                case 'github': {
                    const username = interaction.options.getString('username');
                    if (!username) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.info.githubRequired
                        ));
                    }

                    response = await axios.get(`${POPCAT_API_URL}/v2/github/${username}`);
                    const gh = response.data?.message || response.data;

                    if (!gh || gh.error || !gh.name) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.info.githubNotFound
                        ));
                    }

                    const lines = [];
                    if (gh.bio && gh.bio !== 'No Bio') lines.push(`> *${gh.bio}*`);
                    lines.push('');
                    lines.push(`• **Followers:** ${gh.followers?.toLocaleString() || 0}`);
                    lines.push(`• **Following:** ${gh.following?.toLocaleString() || 0}`);
                    lines.push(`• **Public Repos:** ${gh.public_repos?.toLocaleString() || 0}`);
                    if (gh.company) lines.push(`• **Company:** ${gh.company}`);
                    if (gh.location) lines.push(`• **Location:** ${gh.location}`);
                    if (gh.blog && gh.blog !== 'null') lines.push(`• **Blog:** [${gh.blog}](${gh.blog})`);
                    if (gh.created_at) lines.push(`• **Joined:** ${new Date(gh.created_at).toLocaleDateString()}`);
                    lines.push(`• **Profile:** [Visit on GitHub](${gh.url || `https://github.com/${username}`})`);

                    card = buildCard({
                        title: `${getEmoji('github')} ${gh.name || username} (@${username})`,
                        description: lines.join('\n'),
                        thumbnailURL: (gh.avatar && typeof gh.avatar === 'string') ? gh.avatar : null,
                        accentColor: 0x333333
                    });

                    await sendReply(card);
                    break;
                }

                case 'npm': {
                    const packageName = interaction.options.getString('package');
                    if (!packageName) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.info.npmRequired
                        ));
                    }

                    response = await axios.get(`${POPCAT_API_URL}/v2/npm?q=${encodeURIComponent(packageName)}`);
                    const pkg = response.data?.message || response.data;

                    if (!pkg || !pkg.name) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.info.npmNotFound
                        ));
                    }

                    const lines = [];
                    if (pkg.description) lines.push(`> ${pkg.description}`);
                    lines.push('');
                    lines.push(`• **Version:** \`${pkg.version || 'N/A'}\``);
                    if (pkg.author) lines.push(`• **Author:** ${pkg.author}`);
                    if (pkg.keywords) lines.push(`• **Keywords:** ${pkg.keywords}`);
                    if (pkg.last_published) lines.push(`• **Last Published:** ${pkg.last_published}`);
                    if (pkg.maintainers) lines.push(`• **Maintainers:** ${Array.isArray(pkg.maintainers) ? pkg.maintainers.join(', ') : pkg.maintainers}`);
                    if (pkg.downloads_this_year) lines.push(`• **Downloads (This Year):** ${parseInt(pkg.downloads_this_year || 0).toLocaleString()}`);
                    if (pkg.repository) lines.push(`• **Repo:** [View on GitHub](${pkg.repository})`);
                    lines.push(`• **Package Link:** [View on npmjs.com](https://www.npmjs.com/package/${pkg.name})`);

                    card = buildCard({
                        title: `${getEmoji('npm')} ${pkg.name} — v${pkg.version || '?'}`,
                        description: lines.join('\n'),
                        accentColor: 0xCC3534
                    });

                    await sendReply(card);
                    break;
                }

                case 'imdb': {
                    const movie = interaction.options.getString('movie');
                    if (!movie) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.info.movieRequired
                        ));
                    }

                    response = await axios.get(`${POPCAT_API_URL}/v2/imdb?q=${encodeURIComponent(movie)}`);
                    const film = response.data?.message || response.data;

                    if (!film || !film.title) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            lang.fun.info.movieNotFound
                        ));
                    }

                    const genres = Array.isArray(film.genres) ? film.genres.join(', ') : (film.genres || 'N/A');

                    const lines = [];
                    if (film.plot) lines.push(`> ${film.plot}`);
                    lines.push('');
                    if (film.rating) lines.push(`• **Rating:** ⭐ ${film.rating}/10`);
                    if (film.year) lines.push(`• **Year:** ${film.year}`);
                    if (film.runtime) lines.push(`• **Runtime:** ${film.runtime}`);
                    if (genres !== 'N/A') lines.push(`• **Genre:** ${genres}`);
                    if (film.director) lines.push(`• **Director:** ${film.director}`);
                    if (film.actors) lines.push(`• **Cast:** ${film.actors}`);
                    if (film.awards && film.awards !== 'N/A') lines.push(`• **Awards:** ${film.awards}`);
                    if (film.boxoffice && film.boxoffice !== 'N/A') lines.push(`• **Box Office:** ${film.boxoffice}`);
                    if (film.imdburl) lines.push(`• **IMDB:** [View on IMDB](${film.imdburl})`);

                    card = buildCard({
                        title: `${getEmoji('movies')} ${film.title} ${film.year ? `(${film.year})` : ''}`,
                        description: lines.join('\n'),
                        thumbnailURL: (film.poster && typeof film.poster === 'string' && film.poster !== 'N/A') ? film.poster : null,
                        accentColor: 0xF5C518
                    });

                    await sendReply(card);
                    break;
                }

                case 'lyrics': {
                    const song = interaction.options.getString('song');
                    if (!song) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Song name is required.'
                        ));
                    }

                    response = await axios.get(`${POPCAT_API_URL}/v2/lyrics?song=${encodeURIComponent(song)}`);
                    const track = response.data?.message || response.data;

                    if (!track || !track.title || response.data?.error) {
                        return await sendReply(cards.error(
                            lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                            'Song not found. Try a different song name or include the artist.'
                        ));
                    }

                    
                    let lyricsText = (track.lyrics || 'No lyrics available.').trim();
                    lyricsText = lyricsText.replace(/^\d+ Contributors[\s\S]*?(?=\n\[|\n[A-Z"])/m, '').trim();

                    const songTitle = `${getEmoji('music')} ${track.title} — ${track.artist}`;
                    const thumbnailUrl = (track.image && typeof track.image === 'string') ? track.image : null;

                    
                    await sendLongV2(
                        interaction,
                        (chunkContent, partNum, total) => buildCard({
                            title: total > 1 ? `${songTitle}  *(${partNum}/${total})*` : songTitle,
                            description: chunkContent,
                            thumbnailURL: partNum === 1 ? thumbnailUrl : null,
                            accentColor: 0xFFD700
                        }),
                        lyricsText,
                        1800,
                        600
                    );
                    break;
                }

                default: {
                    await sendReply(cards.error(
                        lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                        lang.fun.common.genericError
                    ));
                    break;
                }
            }

        } catch (error) {
            console.error('Info command error:', error);
            let errMsg = lang.fun.info.error || lang.fun.common.genericError;
            if (error.response?.status === 404) {
                errMsg = 'Requested information was not found. Please check your query.';
            } else if (error.response?.status === 500) {
                errMsg = 'The information service is temporarily offline. Please try again later.';
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                errMsg = 'Unable to connect to the information service. Please try again later.';
            }

            await sendReply(cards.error(
                lang.fun.info.errorTitle.replace('{emoji}', getEmoji('cross')),
                errMsg
            ));
        }
    }
};