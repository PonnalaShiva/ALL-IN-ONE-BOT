const { MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const Notification = require('../models/notifications/Schema');
const colors = require('../UI/colors/colors');

const YOUTUBE_POLL_INTERVAL = 5 * 60 * 1000;  
const TWITCH_POLL_INTERVAL = 60 * 1000;       
const BATCH_DELAY = 2000;                       


const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_TOKEN_URL = process.env.TWITCH_TOKEN_URL || 'https://id.twitch.tv/oauth2/token';
const TWITCH_API_BASE = (process.env.TWITCH_API_BASE_URL || 'https://api.twitch.tv').replace(/\/+$/, '');

let twitchAccessToken = null;
let twitchTokenExpiry = 0;
let client = null;
let running = false;
let youtubeTimer = null;
let twitchTimer = null;

function initialize(discordClient) {
    client = discordClient;
    running = true;

    pollYouTube();
    youtubeTimer = setInterval(pollYouTube, YOUTUBE_POLL_INTERVAL);
    if (youtubeTimer?.unref) youtubeTimer.unref();

    if (TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
        pollTwitch();
        twitchTimer = setInterval(pollTwitch, TWITCH_POLL_INTERVAL);
        if (twitchTimer?.unref) twitchTimer.unref();
    }

    return { shutdown };
}

function shutdown() {
    running = false;
    if (youtubeTimer) {
        clearInterval(youtubeTimer);
        youtubeTimer = null;
    }
    if (twitchTimer) {
        clearInterval(twitchTimer);
        twitchTimer = null;
    }
    console.log(`${colors.yellow}[Notifications] Handler shut down${colors.reset}`);
}
const stop = shutdown;

async function resolveYouTubeChannelId(input) {
    const trimmed = input.trim();

  
    if (trimmed.startsWith('UC') && trimmed.length >= 20) {
        return trimmed;
    }

    
    const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]+)/);
    if (channelMatch) return channelMatch[1];

    const handleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
    if (handleMatch) {
        return await resolveHandleToChannelId(handleMatch[1]);
    }

    
    if (trimmed.startsWith('@')) {
        return await resolveHandleToChannelId(trimmed.slice(1));
    }


    const resolved = await resolveHandleToChannelId(trimmed);
    if (resolved) return resolved;

    return null;
}


async function resolveHandleToChannelId(handle) {
    try {
        const res = await axios.get(`https://www.youtube.com/@${handle}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)' },
            timeout: 10000,
            maxRedirects: 5
        });
        const match = res.data.match(/"externalId":"(UC[\w-]+)"/);
        if (match) return match[1];

       
        const canonical = res.data.match(/youtube\.com\/channel\/(UC[\w-]+)/);
        if (canonical) return canonical[1];
    } catch (err) {
        
    }
    return null;
}


async function fetchYouTubeRSS(channelId) {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const res = await axios.get(url, { timeout: 15000 });
    const parsed = await parseStringPromise(res.data, { explicitArray: false });

    const feed = parsed.feed;
    if (!feed || !feed.entry) return { channelName: feed?.title || null, videos: [] };

    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    const videos = entries.map(entry => ({
        id: entry['yt:videoId'],
        title: entry.title,
        url: entry.link?.['$']?.href || `https://www.youtube.com/watch?v=${entry['yt:videoId']}`,
        published: new Date(entry.published),
        thumbnail: entry['media:group']?.['media:thumbnail']?.['$']?.url || null,
        description: entry['media:group']?.['media:description'] || '',
        channelName: entry.author?.name || feed.title || null
    }));

    return { channelName: feed.title || null, videos };
}

let isPollingYouTube = false;
async function pollYouTube() {
    if (isPollingYouTube || !running || !client || mongoose.connection?.readyState !== 1) return;
    isPollingYouTube = true;

    try {
        const configs = await Notification.findActive('youtube');
        if (!configs.length) return;

        for (const config of configs) {
            if (!running) break;

            try {
                const { channelName, videos } = await fetchYouTubeRSS(config.platformId);

                
                if (channelName && channelName !== config.platformName) {
                    config.platformName = channelName;
                }

                if (!videos.length) {
                    await config.markChecked(null);
                    continue;
                }

             
                const alreadyNotified = new Set([...(config.notifiedIds || []), config.lastNotifiedId].filter(Boolean));
                const newVideos = videos.filter(v => !alreadyNotified.has(v.id));

           
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const recentNew = newVideos.filter(v => v.published > oneDayAgo);

                if (!recentNew.length) {
                    
                    await config.markChecked(videos[0].id);
                    continue;
                }

             
                recentNew.sort((a, b) => a.published - b.published);

                const channel = client.channels.cache.get(config.channelId);
                if (!channel) {
                    await config.markFailed('Discord channel not found');
                    continue;
                }

                for (const video of recentNew) {
                    const lang = loadLanguage(channel.guild?.id);
                    const sn = lang.streamNotifications || {};
                    const card = buildCard({
                        title: `${getEmoji('play')} ${video.title}`,
                        sections: [
                            video.description ? video.description.substring(0, 200) + (video.description.length > 200 ? '...' : '') : '\u200b',
                            `[${sn.watchOnYouTube}](${video.url})`
                        ],
                        bannerURL: video.thumbnail || null,
                        accentColor: 0xFF0000,
                        _footer: `${video.channelName || 'YouTube'} • <t:${Math.floor(video.published.getTime() / 1000)}:R>`
                    });

                    const mentionText = config.mentionRoleId ? `<@&${config.mentionRoleId}>` : '';
                    const messageContent = config.customMessage
                        ? config.customMessage.replace('{role}', mentionText).replace('{title}', video.title).replace('{url}', video.url)
                        : mentionText;

                    if (messageContent) {
                        await channel.send({ content: messageContent }).catch(() => { });
                    }
                    await channel.send({
                        components: [card],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => { });
                    await config.markChecked(video.id);
                }

            } catch (err) {
                await config.markFailed(err.message).catch(() => { });
            }

         
            await sleep(BATCH_DELAY);
        }
    } catch (err) {
        console.error(`${colors.red}[Notifications] YouTube poll error:${colors.reset}`, err.message);
    } finally {
        isPollingYouTube = false;
    }
}

async function getTwitchToken() {
    if (twitchAccessToken && Date.now() < twitchTokenExpiry) {
        return twitchAccessToken;
    }

    const res = await axios.post(TWITCH_TOKEN_URL, null, {
        params: {
            client_id: TWITCH_CLIENT_ID,
            client_secret: TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials'
        },
        timeout: 10000
    });

    twitchAccessToken = res.data.access_token;
    twitchTokenExpiry = Date.now() + (res.data.expires_in * 1000) - 60000; 
    return twitchAccessToken;
}


function resolveTwitchLogin(input) {
    const trimmed = input.trim().toLowerCase();

 
    const urlMatch = trimmed.match(/twitch\.tv\/(\w+)/);
    if (urlMatch) return urlMatch[1];


    return trimmed.replace(/^@/, '');
}

let isPollingTwitch = false;
async function pollTwitch() {
    if (isPollingTwitch || !running || !client || !TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || mongoose.connection?.readyState !== 1) return;
    isPollingTwitch = true;

    try {
        const token = await getTwitchToken();
        const configs = await Notification.findActive('twitch');
        if (!configs.length) return;

      
        const batches = [];
        for (let i = 0; i < configs.length; i += 100) {
            batches.push(configs.slice(i, i + 100));
        }

        for (const batch of batches) {
            if (!running) break;

            const logins = batch.map(c => resolveTwitchLogin(c.platformId));
            const queryString = logins.map(l => `user_login=${l}`).join('&');

            try {
                const res = await axios.get(`${TWITCH_API_BASE}/helix/streams?${queryString}`, {
                    headers: {
                        'Client-ID': TWITCH_CLIENT_ID,
                        'Authorization': `Bearer ${token}`
                    },
                    timeout: 15000
                });

                const liveStreams = new Map();
                for (const stream of (res.data.data || [])) {
                    liveStreams.set(stream.user_login.toLowerCase(), stream);
                }

                for (const config of batch) {
                    const login = resolveTwitchLogin(config.platformId);
                    const stream = liveStreams.get(login);

                    if (!stream) {

                        if (config.lastNotifiedId) {
                            config.lastNotifiedId = null;
                            config.lastChecked = new Date();
                            config.failCount = 0;
                            config.lastError = null;
                            await config.save();
                        }
                        continue;
                    }

                 
                    if (config.lastNotifiedId === stream.id) {
                        continue;
                    }

                
                    if (stream.user_name !== config.platformName) {
                        config.platformName = stream.user_name;
                    }

                    const channel = client.channels.cache.get(config.channelId);
                    if (!channel) {
                        await config.markFailed('Discord channel not found');
                        continue;
                    }

                    const thumbnailUrl = stream.thumbnail_url
                        .replace('{width}', '440')
                        .replace('{height}', '248');

                    const lang = loadLanguage(channel.guild?.id);
                    const sn = lang.streamNotifications || {};
                    const card = buildCard({
                        title: `${getEmoji('broadcast')} ${(sn.streamLiveTitle).replace('{user}', stream.user_name)}`,
                        sections: [
                            `**${stream.title || sn.liveStream}**\n[${sn.watchOnTwitch}](https://www.twitch.tv/${stream.user_login})`,
                            `**${sn.gameLabel}:** ${stream.game_name || sn.unknownGame}\n**${sn.viewersLabel}:** ${String(stream.viewer_count || 0)}`
                        ],
                        bannerURL: thumbnailUrl ? `${thumbnailUrl}?t=${Date.now()}` : null,
                        accentColor: 0x9146FF,
                        _footer: `Twitch • <t:${Math.floor(Date.now() / 1000)}:R>`
                    });

                    const mentionText = config.mentionRoleId ? `<@&${config.mentionRoleId}>` : '';
                    const messageContent = config.customMessage
                        ? config.customMessage.replace('{role}', mentionText).replace('{title}', stream.title || '').replace('{url}', `https://www.twitch.tv/${stream.user_login}`)
                        : mentionText;

                    if (messageContent) {
                        await channel.send({ content: messageContent }).catch(() => { });
                    }
                    await channel.send({
                        components: [card],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => { });
                    await config.markChecked(stream.id);
                }

            } catch (apiErr) {
                
                if (apiErr.response?.status === 401) {
                    twitchAccessToken = null;
                    twitchTokenExpiry = 0;
                }
                console.error(`${colors.red}[Notifications] Twitch API error:${colors.reset}`, apiErr.message);
            }

            await sleep(BATCH_DELAY);
        }
    } catch (err) {
        console.error(`${colors.red}[Notifications] Twitch poll error:${colors.reset}`, err.message);
    } finally {
        isPollingTwitch = false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    initialize,
    shutdown,
    stop: shutdown,
    resolveYouTubeChannelId,
    resolveTwitchLogin
};
