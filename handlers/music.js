const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const lavalinkConfig = require('../lavalink');
const { dynamicCard } = require("../UI/dynamicCard");
const path = require("path");
const axios = require('axios');
const musicIcons = require('../UI/icons/musicicons');
const { Riffy } = require('riffy');
const { autoplayCollection } = require('../mongodb');
const NodeManager = require('../utils/nodeManager');
const { registerInteractionHandler } = require('../utils/interactionRouter');


const activeLyricsMessages = new Map();
const musicTimers = new Set();

function scheduleMusicTimeout(callback, delay) {
    const timer = setTimeout(() => {
        musicTimers.delete(timer);
        callback();
    }, delay);
    timer.unref?.();
    musicTimers.add(timer);
    return timer;
}

function canUseRequesterControls(session, userId, requesterId) {
    return userId === requesterId || Boolean(session && session.userId === userId);
}

function clearActiveLyricsMessage(activeMessages, guildId, message) {
    if (activeMessages.get(guildId) !== message) return false;
    activeMessages.delete(guildId);
    return true;
}

function registerMusicListener(registrations, emitter, eventName, listener, once = false) {
    (once ? emitter.once : emitter.on).call(emitter, eventName, listener);
    const registration = { emitter, eventName, listener };
    registrations.add(registration);
    return registration;
}

const advancedMessageManager = {
    trackMessages: new Map(),
    lyricsMessages: new Map(),
    queueMessages: new Map(),
    lastEmbeds: new Map(),
    controlPanels: new Map(),
    cleanupTimeouts: new Map(),

    getAutoDeleteTime: function (type, context = {}) {
        const times = {
            'track': 600000,        
            'lyrics': 0,            
            'queue': 45000,         
            'control': 300000,      
            'success': 3000,        
            'error': 3000,          
            'warning': 3000,        
            'info': 3000,           
            'session_end': 3000,    
            'autoplay': 3000,       
            'autoplay_success': 3000, 
            'autoplay_fail': 3000,  
            'volume': 3000,         
            'pause_resume': 5000,   
            'skip': 3000,           
            'stop': 3000,           
            'loop': 3000,           
            'shuffle': 3000,        
            'queue_cleared': 3000   
        };

        if (context.isImportant) return times[type] * 1.5;
        if (context.isQuick) return Math.max(times[type] * 0.5, 3000);
        if (context.queueSize && context.queueSize > 10) return times[type] * 1.2;

        return times[type] || 3000;
    },

    addMessage: function (guildId, messageId, channelId, type, context = {}) {
        const autoDeleteTime = this.getAutoDeleteTime(type, context);
        const messageData = {
            messageId,
            channelId,
            type,
            timestamp: Date.now(),
            autoDelete: autoDeleteTime,
            context
        };

        const collections = {
            'track': this.trackMessages,
            'lyrics': this.lyricsMessages,
            'queue': this.queueMessages,
            'lastEmbed': this.lastEmbeds,
            'control': this.controlPanels
        };

        if (collections[type]) {
            collections[type].set(guildId, messageData);

            if (autoDeleteTime > 0) {
                const timeoutId = scheduleMusicTimeout(async () => {
                    await this.deleteMessage(null, messageData);
                    collections[type].delete(guildId);
                    this.cleanupTimeouts.delete(guildId + '_' + type);
                }, autoDeleteTime);

                this.cleanupTimeouts.set(guildId + '_' + type, timeoutId);
            }
        }
    },

    addQuickDeleteMessage: function (client, message, type = 'info') {
        if (!message || !message.id) return;
        scheduleMusicTimeout(() => {
            message.delete().catch(() => { });
        }, 3000);
        return message;
    },

    async cleanupGuildMessages(client, guildId, types = ['track', 'lyrics', 'queue', 'lastEmbed', 'control']) {
        const promises = [];
        const collections = {
            'track': this.trackMessages,
            'lyrics': this.lyricsMessages,
            'queue': this.queueMessages,
            'lastEmbed': this.lastEmbeds,
            'control': this.controlPanels
        };

        for (const type of types) {
            if (collections[type] && collections[type].has(guildId)) {
                const msgData = collections[type].get(guildId);
                promises.push(this.deleteMessage(client, msgData));
                collections[type].delete(guildId);

                const timeoutKey = guildId + '_' + type;
                if (this.cleanupTimeouts.has(timeoutKey)) {
                    clearTimeout(this.cleanupTimeouts.get(timeoutKey));
                    this.cleanupTimeouts.delete(timeoutKey);
                }
            }
        }

        await Promise.allSettled(promises);
    },

    async deleteMessage(client, messageData) {
        if (!messageData) return;

        const { messageId, channelId } = messageData;

        try {
            const channel = client ? client.channels.cache.get(channelId) : null;
            if (!channel) return;

            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (!message) return;

            await message.delete().catch(() => {
                if (message.components && message.components.length > 0) {
                    const disabledComponents = message.components.map(row =>
                        new ActionRowBuilder().addComponents(
                            row.components.map(component =>
                                ButtonBuilder.from(component).setDisabled(true)
                            )
                        )
                    );
                    message.edit({ components: disabledComponents }).catch(() => { });
                }
            });
        } catch (err) {
            console.warn(`V2 Message cleanup warning: ${err.message}`);
        }
    },

    createV2Container(type, data = {}) {
        const colors = {
            success: 0x00ff7f,
            error: 0xff4757,
            info: 0x3498db,
            warning: 0xffa500,
            music: 0xdc92ff,
            lyrics: 0xff69b4,
            queue: 0x9b59b6,
            session_end: 0x95a5a6,
            volume: 0x2196f3,
            autoplay: 0x17a2b8
        };

        return new ContainerBuilder()
            .setAccentColor(colors[type] || colors.info);
    }
};

const sessionManager = {
    activeSessions: new Map(),

    createSession(guildId, userId, data) {
        this.activeSessions.set(guildId, {
            userId,
            startTime: Date.now(),
            lastActivity: Date.now(),
            ...data
        });
    },

    updateActivity(guildId) {
        if (this.activeSessions.has(guildId)) {
            this.activeSessions.get(guildId).lastActivity = Date.now();
        }
    },

    isAuthorized(guildId, userId) {
        const session = this.activeSessions.get(guildId);
        return Boolean(session && session.userId === userId);
    },

    endSession(guildId) {
        this.activeSessions.delete(guildId);
    }
};

const queueDisplayTimeouts = new Map();

module.exports = (client) => {
    let stopping = false;
    let cleanupInterval = null;
    let unregisterInteractionRoute = null;
    const musicListeners = new Set();
    const lyricsCollectors = new Set();
    if (lavalinkConfig.enabled) {
        
        client.nodeManager = new NodeManager(client, lavalinkConfig);

        
        client.nodeManager.initializeRiffy().then((riffy) => {
            if (stopping) {
                client.nodeManager?.shutdown?.();
                return;
            }
            client.riffy = riffy;

            
            setupRiffyEventListeners(client);
        }).catch((error) => {
            console.error(`\x1b[31m[ V2 LAVALINK ]\x1b[0m Failed to initialize:`, error);
        });

        
        registerMusicListener(musicListeners, client, 'voiceStateUpdate', async (oldState, newState) => {
            try {
                if (!client.riffy) return; 

                if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
                    const player = client.riffy.players.get(oldState.guild.id);
                    if (player) {
                        await handlePlayerCleanup(client, oldState.guild.id, player, 'Bot disconnected');
                    }
                }

                if (
                    oldState.channelId &&
                    oldState.channelId === newState.guild.me?.voice?.channelId &&
                    newState.guild.channels.cache.get(oldState.channelId)?.members.size === 1 &&
                    newState.guild.channels.cache.get(oldState.channelId)?.members.has(client.user.id)
                ) {
                    const player = client.riffy.players.get(oldState.guild.id);
                    if (player) {
                        await handlePlayerCleanup(client, oldState.guild.id, player, 'Channel empty - Auto disconnect');

                        const channel = client.channels.cache.get(player.textChannel);
                        if (channel) {
                            const disconnectContainer = advancedMessageManager.createV2Container('session_end')
                                .addTextDisplayComponents(
                                    textDisplay => {
                                    const lang = loadLanguage(oldState.guild.id);
                                    const h = lang.lavalink?.handler || {};
                                    return textDisplay.setContent(`**${getEmoji('warning')} ${h.autoDisconnectTitle}**\n${h.autoDisconnectDesc}`);
                                }
                                );

                            const msg = await channel.send({
                                components: [disconnectContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            advancedMessageManager.addQuickDeleteMessage(client, msg, 'session_end');
                        }
                    }
                }
            } catch (error) {
                console.error('V2 Voice state update error:', error);
            }
        });

        
        function setupRiffyEventListeners(client) {
            if (!client.riffy) return;

            registerMusicListener(musicListeners, client.riffy, 'trackStart', async (player, track) => {
                try {
                    const channel = client.channels.cache.get(player.textChannel);
                    const guildId = player.guildId;

                    if (!channel) return;

                    await advancedMessageManager.cleanupGuildMessages(client, guildId);
                    sessionManager.updateActivity(guildId);

                    function formatTime(ms) {
                        if (!ms || ms === 0) return "0:00";
                        const totalSeconds = Math.floor(ms / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        return `${hours > 0 ? hours + ":" : ""}${minutes.toString().padStart(hours > 0 ? 2 : 1, "0")}:${seconds.toString().padStart(2, "0")}`;
                    }

                    let cardBuffer = null;
                    let attachment = null;

                    try {


                        cardBuffer = await dynamicCard({
                            thumbnailURL: track.info.thumbnail || track.info.artworkUrl || 'https://via.placeholder.com/300x300/DC92FF/FFFFFF?text=Music',
                            songTitle: track.info.title || 'Unknown Title',
                            songArtist: track.info.author || 'Unknown Artist',
                            trackRequester: track.requester ? track.requester.username : "All In One",
                            fontPath: path.join(__dirname, "../UI", "fonts", "AfacadFlux-Regular.ttf"),
                            backgroundColor: "#DC92FF",
                        });

                        if (cardBuffer) {
                            attachment = new AttachmentBuilder(cardBuffer, { name: 'song-banner.png' });
                        }

                    } catch (cardError) {
                        
                    }

                    const lang = loadLanguage(guildId);
                    const h = lang.lavalink?.handler || {};
                    let containerBuilder = advancedMessageManager.createV2Container('music')
                        .addTextDisplayComponents(
                            textDisplay => {
                            const lang = loadLanguage(guildId);
                            const h = lang.lavalink?.handler || {};
                            return textDisplay.setContent(`**${getEmoji('music')} ${h.nowPlaying}**`);
                        }
                        )
                        .addSeparatorComponents(separator => separator)
                        .addSectionComponents(
                            section => section
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent([
                                        `**${getEmoji('music')} ${track.info.title}**`,
                                        `**${getEmoji('mic')} ${h.artist}:** ${track.info.author}`,
                                        `**${getEmoji('time')} ${h.duration}:** ${formatTime(track.info.length)}`,
                                        `**${getEmoji('world')} ${h.source}:** ${track.info.sourceName || 'YouTube'}`,
                                        `**${getEmoji('sparkles')} ${h.quality}:** ${track.info.stream ? (h.liveStream) : (h.highDefinition)}`
                                    ].join('\n'))
                                )
                                .setThumbnailAccessory(
                                    thumbnail => thumbnail
                                        .setURL(track.requester?.avatarURL ?? client.user.displayAvatarURL({ dynamic: true, size: 128 }))
                                        .setDescription(`Requested by ${track.requester ? track.requester.username : 'Unknown'}`)
                                )
                        );

                    containerBuilder
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent([
                                `**${getEmoji('user')} ${h.requestedBy}:** ${track.requester ? `<@${track.requester.id}>` : 'All In One'}`,
                                `**${getEmoji('music')} ${h.queuePosition}:** ${h.playingNow}`,
                                `**${getEmoji('volume_high')} ${h.volume}:** ${player.volume}%`,
                                `**${getEmoji('loop')} ${h.loop}:** ${player.loop || 'None'}`,
                                `**${getEmoji('play')} ${h.status}:** ${player.playing ? (h.active) : player.paused ? (h.paused) : (h.stopped)}`
                            ].join('\n'))
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent([
                                `**${getEmoji('analytics')} ${h.trackStats}**`,
                                `**${getEmoji('trend')} ${h.bitrate}:** High Quality Audio`,
                                `**${getEmoji('star')} ${h.seekable}:** ${track.info.seekable ? 'Yes' : 'No'}`,
                                `**${getEmoji('world')} ${h.platform}:** ${track.info.sourceName || 'YouTube Music'}`,
                                track.info.uri ? `**${getEmoji('link')} [${h.openOriginal}](${track.info.uri})**` : ''
                            ].filter(Boolean).join('\n'))
                        );

                    if (attachment) {
                        containerBuilder
                            .addSeparatorComponents(separator => separator)
                            .addMediaGalleryComponents(
                                mediaGallery => mediaGallery
                                    .addItems(
                                        mediaItem => mediaItem
                                            .setURL('attachment://song-banner.png')
                                            .setDescription(`${track.info.title} - ${track.info.author}`)
                                    )
                            );
                    }

                    const requesterId = track.requester?.id || 'system';
                    const controlRow1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`v2_volume_down_${requesterId}`)
                            .setEmoji(getButtonEmoji('volume_low'))
                            .setLabel(h.btnVolDown)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`v2_pause_${requesterId}`)
                            .setEmoji(getButtonEmoji('pause'))
                            .setLabel(h.btnPause)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`v2_resume_${requesterId}`)
                            .setEmoji(getButtonEmoji('play'))
                            .setLabel(h.btnResume)
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`v2_skip_${requesterId}`)
                            .setEmoji(getButtonEmoji('nextsong'))
                            .setLabel(h.btnSkip)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`v2_volume_up_${requesterId}`)
                            .setEmoji(getButtonEmoji('volume_high'))
                            .setLabel(h.btnVolUp)
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const controlRow2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`v2_queue_${requesterId}`)
                            .setEmoji(getButtonEmoji('list'))
                            .setLabel(h.btnQueue)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`v2_lyrics_${requesterId}`)
                            .setEmoji(getButtonEmoji('mic'))
                            .setLabel(h.btnLyrics)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`v2_loop_${requesterId}`)
                            .setEmoji(getButtonEmoji('loop'))
                            .setLabel(h.btnLoop)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`v2_shuffle_${requesterId}`)
                            .setEmoji(getButtonEmoji('loop'))
                            .setLabel(h.btnShuffle)
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`v2_stop_${requesterId}`)
                            .setEmoji(getButtonEmoji('stop'))
                            .setLabel(h.btnStop)
                            .setStyle(ButtonStyle.Danger)
                    );

                    const messageOptions = {
                        components: [containerBuilder],
                        flags: MessageFlags.IsComponentsV2
                    };

                    if (attachment) {
                        messageOptions.files = [attachment];
                    }

                    messageOptions.components.push(controlRow1, controlRow2);

                    const message = await channel.send(messageOptions);

                    advancedMessageManager.addMessage(guildId, message.id, channel.id, 'track', {
                        isImportant: true,
                        queueSize: player.queue.length
                    });

                    player.currentMessageId = message.id;

                    if (track.requester && track.requester.id) {
                        sessionManager.createSession(guildId, track.requester.id, {
                            trackTitle: track.info.title,
                            startedAt: Date.now()
                        });
                    }

                } catch (error) {
                    console.error('V2 Track start error:', error);

                    try {
                        const channel = client.channels.cache.get(player.textChannel);
                        if (channel) {
                            const errorContainer = advancedMessageManager.createV2Container('error')
                                .addTextDisplayComponents(
                                    textDisplay => { const h = loadLanguage(player.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('cross')} ${h.playbackErrorTitle}**\\n${h.playbackErrorDesc}`); }
                                );

                            const errorMsg = await channel.send({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            advancedMessageManager.addMessage(player.guildId, errorMsg.id, channel.id, 'error');
                        }
                    } catch (fallbackError) {
                        console.error('V2 Fallback error message failed:', fallbackError);
                    }
                }
            });

            registerMusicListener(musicListeners, client.riffy, 'trackEnd', async (player) => {
                try {
                    const guildId = player.guildId;

                    if (activeLyricsMessages.has(guildId)) {
                        const lyricsMsg = activeLyricsMessages.get(guildId);
                        try {
                            await lyricsMsg.delete().catch(() => { });
                        } catch (err) { }
                        activeLyricsMessages.delete(guildId);
                    }

                    await advancedMessageManager.cleanupGuildMessages(client, guildId, ['track']);
                    sessionManager.updateActivity(guildId);
                } catch (error) {
                    console.error('V2 Track end error:', error);
                }
            });

            async function resolveAutoplayTrack(client, player, previousTrack) {
                try {
                    if (typeof client.riffy?.autoplay === 'function') {
                        return await client.riffy.autoplay(player);
                    }
                    const track = previousTrack || player.previous || player.current;
                    if (!track?.info?.title) return false;
                    const query = `${track.info.author || ''} ${track.info.title}`.trim();
                    const res = await client.riffy.resolve({ query: `ytmsearch:${query}`, requester: client.user });
                    if (res?.tracks?.length > 1) {
                        player.queue.add(res.tracks[1]);
                        if (!player.playing && !player.paused) player.play();
                        return true;
                    }
                    return false;
                } catch {
                    return false;
                }
            }

            registerMusicListener(musicListeners, client.riffy, 'queueEnd', async (player) => {
                try {
                    const channel = client.channels.cache.get(player.textChannel);
                    const guildId = player.guildId;

                    if (!channel) {
                        await handlePlayerCleanup(client, guildId, player, 'Queue ended - no channel');
                        return;
                    }

                    const result = await autoplayCollection.findOne({ guildId }).catch(() => null);
                    const autoplay = result ? result.autoplay : false;

                    if (autoplay) {
                        if (!player) {
                            console.error('V2 Autoplay: Player not found');
                            await handlePlayerCleanup(client, guildId, player, 'Queue ended - no player');
                            return;
                        }

                        const autoplayContainer = advancedMessageManager.createV2Container('autoplay')
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`**${getEmoji('loop')} ${(loadLanguage(guildId)?.lavalink?.handler || {}).autoplayActiveTitle}**\n${(loadLanguage(guildId)?.lavalink?.handler || {}).autoplayActiveDesc}`)
                            );

                        const autoplayMsg = await channel.send({
                            components: [autoplayContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        advancedMessageManager.addQuickDeleteMessage(client, autoplayMsg, 'autoplay_active');

                        
                        const previousTrack = player.previous || player.current || null;
                        const resolved = await resolveAutoplayTrack(client, player, previousTrack);
                        if (resolved) {
                            const successContainer = advancedMessageManager.createV2Container('autoplay_success')
                                .addTextDisplayComponents(
                                    textDisplay => { const h = loadLanguage(guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('tick')} ${h.autoplaySuccessTitle}**\n${h.autoplaySuccessDesc}`); }
                                );

                            const successMsg = await channel.send({
                                components: [successContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            advancedMessageManager.addQuickDeleteMessage(client, successMsg, 'autoplay_success');
                        } else {
                            
                            const failContainer = advancedMessageManager.createV2Container('autoplay_fail')
                                .addTextDisplayComponents(
                                    textDisplay => { const h = loadLanguage(guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('warning')} ${h.autoplayFailedTitle}**\n${h.autoplayFailedDesc}`); }
                                );

                            const failMsg = await channel.send({
                                components: [failContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            advancedMessageManager.addQuickDeleteMessage(client, failMsg, 'autoplay_fail');
                        }

                    } else {
                        await handlePlayerCleanup(client, guildId, player, 'Queue ended');
                        player.destroy();

                        const queueEndContainer = advancedMessageManager.createV2Container('session_end')
                            .addTextDisplayComponents(
                                textDisplay => { const h = loadLanguage(guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('music')} ${h.sessionCompletedTitle}**`); }
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => { const h = loadLanguage(guildId)?.lavalink?.handler || {}; textDisplay.setContent(h.sessionCompletedSummary); }
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => { const h = loadLanguage(guildId)?.lavalink?.handler || {}; textDisplay.setContent(h.sessionQuickActions); }
                            );

                        const queueEndMsg = await channel.send({
                            components: [queueEndContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        advancedMessageManager.addQuickDeleteMessage(client, queueEndMsg, 'session_end');
                    }

                    sessionManager.endSession(guildId);

                } catch (error) {
                    console.error('V2 Queue end error:', error);
                }
            });

            
        }

        unregisterInteractionRoute = registerInteractionHandler(client, {
            name: 'music-player-controls',
            prefixes: ['v2_'],
            excludeCustomIds: ['v2_lyrics_close'],
            types: ['button'],
            handler: async (interaction) => {
            if (!interaction.isButton()) return;

            if (interaction.customId === 'v2_lyrics_close') {
                return;
            }

            try {
                const match = interaction.customId.match(/^v2_(volume_up|volume_down|pause|resume|skip|stop|queue|lyrics|loop|shuffle|clear)_(\w+)$/);
                if (!match) return;

                const [, action, userId] = match;
                const lang = loadLanguage(interaction.guildId);
                const h = lang.lavalink?.handler || {};

                const player = client.riffy.players.get(interaction.guildId);
                if (!player) {
                    const noPlayerContainer = advancedMessageManager.createV2Container('warning')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent(`**${getEmoji('warning')} ${h.noPlayerTitle}**\n${h.noPlayerDesc}`)
                        );

                    return interaction.reply({
                        components: [noPlayerContainer],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                    });
                }

                const botVoiceChannel = interaction.guild.members.me?.voice?.channel;
                const userVoiceChannel = interaction.member?.voice?.channel;

                const isInSameChannel = botVoiceChannel && userVoiceChannel && botVoiceChannel.id === userVoiceChannel.id;
                const isOriginalRequester = canUseRequesterControls(
                    sessionManager.activeSessions.get(interaction.guildId),
                    interaction.user.id,
                    userId
                );

                if (!isInSameChannel && !isOriginalRequester && userId !== 'system') {
                    const authContainer = advancedMessageManager.createV2Container('error')
                        .addTextDisplayComponents(
                            textDisplay => {
                        const desc = (h.voiceRequiredDesc || '')
                            .replace('{botChannel}', botVoiceChannel ? botVoiceChannel.name : 'None')
                            .replace('{userChannel}', userVoiceChannel ? userVoiceChannel.name : 'None');
                        return textDisplay.setContent(`**${getEmoji('cross')} ${h.voiceRequiredTitle}**\n\n${desc}`);
                    }
                        );

                    return interaction.reply({
                        components: [authContainer],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply();
                sessionManager.updateActivity(interaction.guildId);

                switch (action) {
                    case 'volume_up':
                        const newVolumeUp = Math.min(player.volume + 10, 100);
                        player.setVolume(newVolumeUp);

                        const volumeUpContainer = advancedMessageManager.createV2Container('volume')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${getEmoji('volume_high')} ${h.volUpTitle}**\n\n${(h.volUpDesc).replace('{volume}', newVolumeUp)}\n${getVolumeBar(newVolumeUp)}`)
                            );

                        const volUpReply = await interaction.editReply({
                            components: [volumeUpContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        scheduleMusicTimeout(() => volUpReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('volume'));
                        break;

                    case 'volume_down':
                        const newVolumeDown = Math.max(player.volume - 10, 0);
                        player.setVolume(newVolumeDown);

                        const volumeDownContainer = advancedMessageManager.createV2Container('volume')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${getEmoji('volume_low')} ${h.volDownTitle}**\n\n${(h.volDownDesc).replace('{volume}', newVolumeDown).replace('{status}', newVolumeDown === 0 ? (h.volMuted) : (h.volQuieter))}\n${getVolumeBar(newVolumeDown)}`)
                            );

                        const volDownReply = await interaction.editReply({
                            components: [volumeDownContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        scheduleMusicTimeout(() => volDownReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('volume'));
                        break;

                    case 'pause':
                        player.pause(true);

                        const pauseContainer = advancedMessageManager.createV2Container('warning')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${getEmoji('pause')} ${h.pausedTitle}**\n\n${h.pausedDesc}`)
                            );

                        const pauseReply = await interaction.editReply({
                            components: [pauseContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        scheduleMusicTimeout(() => pauseReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('pause_resume'));
                        break;

                    case 'resume':
                        player.pause(false);

                        const resumeContainer = advancedMessageManager.createV2Container('success')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${getEmoji('play')} ${h.resumedTitle}**\n\n${h.resumedDesc}`)
                            );

                        const resumeReply = await interaction.editReply({
                            components: [resumeContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        scheduleMusicTimeout(() => resumeReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('pause_resume'));
                        break;

                    case 'skip':
                        const currentTrack = player.current;
                        await advancedMessageManager.cleanupGuildMessages(client, interaction.guildId, ['track']);
                        player.stop();

                        const skipContainer = advancedMessageManager.createV2Container('info')
                            .addTextDisplayComponents(
                                textDisplay => {
                                const trackName = currentTrack ? currentTrack.info.title : (h.currentTrackSkipped);
                                const statusText = player.queue.length > 0 ? (h.movingNext) : (h.queueEmptyEnd);
                                return textDisplay.setContent(`**${getEmoji('nextsong')} ${h.skippedTitle}**\n\n${(h.skippedDesc).replace('{title}', trackName).replace('{status}', statusText)}`);
                            }
                            );

                        const skipReply = await interaction.editReply({
                            components: [skipContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        scheduleMusicTimeout(() => skipReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('skip'));
                        break;

                    case 'stop':
                        if (activeLyricsMessages.has(interaction.guildId)) {
                            const lyricsMsg = activeLyricsMessages.get(interaction.guildId);
                            try {
                                await lyricsMsg.delete().catch(() => { });
                            } catch (err) { }
                            activeLyricsMessages.delete(interaction.guildId);
                        }

                        await handlePlayerCleanup(client, interaction.guildId, player, 'Manual stop by user');
                        player.destroy();
                        sessionManager.endSession(interaction.guildId);

                        const stopContainer = advancedMessageManager.createV2Container('error')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${getEmoji('stop')} ${h.terminatedTitle}**\n\n${h.terminatedDesc}`)
                            );

                        const stopReply = await interaction.editReply({
                            components: [stopContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        const channel = client.channels.cache.get(player.textChannel);
                        if (channel) {
                            const channelStopContainer = advancedMessageManager.createV2Container('session_end')
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**${getEmoji('music')} ${h.sessionEndedTitle}**\n\n${h.sessionEndedDesc}`)
                                );

                            const stopMsg = await channel.send({
                                components: [channelStopContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            advancedMessageManager.addQuickDeleteMessage(client, stopMsg, 'session_end');
                        }

                        scheduleMusicTimeout(() => stopReply.delete().catch(() => { }), 3000);
                        break;

                    case 'shuffle':
                        if (!player.queue || player.queue.length === 0) {
                            const emptyContainer = advancedMessageManager.createV2Container('warning')
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**${getEmoji('warning')} ${h.emptyQueueTitle}**\n${h.emptyQueueShuffleDesc}`)
                                );

                            const emptyReply = await interaction.editReply({
                                components: [emptyContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            scheduleMusicTimeout(() => emptyReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('warning'));
                            return;
                        }

                        player.queue.shuffle();

                        const shuffleContainer = advancedMessageManager.createV2Container('success')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${getEmoji('loop')} ${h.shuffledTitle}**\n${(h.shuffledDesc).replace('{count}', player.queue.length).replace('{next}', player.queue[0]?.info.title || 'None')}`)
                            );

                        const shuffleReply = await interaction.editReply({
                            components: [shuffleContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        scheduleMusicTimeout(() => shuffleReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('shuffle'));
                        break;

                    case 'loop':
                        const loopMode = player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none';
                        player.setLoop(loopMode);

                        const loopContainer = advancedMessageManager.createV2Container('info')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${getEmoji('loop')} ${h.loopUpdatedTitle}**\n\n${(h.loopUpdatedDesc).replace('{mode}', loopMode.toUpperCase()).replace('{desc}', getLoopDescription(loopMode))}`)
                            );

                        const loopReply = await interaction.editReply({
                            components: [loopContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        scheduleMusicTimeout(() => loopReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('loop'));
                        break;

                    case 'queue':
                        if (!player.queue || player.queue.length === 0) {
                            const emptyQueueContainer = advancedMessageManager.createV2Container('warning')
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**${getEmoji('list')} ${h.emptyQueueTitle}**\n\n${h.emptyQueueDesc}`)
                                );

                            const emptyQueueReply = await interaction.editReply({
                                components: [emptyQueueContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            scheduleMusicTimeout(() => emptyQueueReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('warning'));
                        } else {
                            await showV2Queue(client, player, interaction);
                        }
                        break;

                    case 'lyrics':
                        await showV2Lyrics(client, player, interaction);
                        break;

                    default:
                        const unknownContainer = advancedMessageManager.createV2Container('error')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${getEmoji('cross')} ${h.unknownActionTitle}**\n\n${h.unknownActionDesc}`)
                            );

                        const unknownReply = await interaction.editReply({
                            components: [unknownContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        scheduleMusicTimeout(() => unknownReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
                        break;
                }
            } catch (error) {
                console.error('V2 Button interaction error:', error);

                try {
                    const errorContainer = advancedMessageManager.createV2Container('error')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent(`**${getEmoji('cross')} ${h.interactionErrorTitle}**\n\n${h.interactionErrorDesc}`)
                        );

                    if (interaction.deferred) {
                        const errorReply = await interaction.editReply({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                        scheduleMusicTimeout(() => errorReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
                    } else {
                        await interaction.reply({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }
                } catch (fallbackError) {
                    console.error('V2 Interaction fallback error:', fallbackError);
                }
            }
            }
        });

        async function showV2Queue(client, player, interaction) {
            try {
                const h = loadLanguage(interaction?.guildId || player?.guildId)?.lavalink?.handler || {};
                const channel = client.channels.cache.get(player.textChannel);
                if (!channel) {
                    const channelErrorContainer = advancedMessageManager.createV2Container('error')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent(`**${getEmoji('cross')} ${h.channelErrorTitle}**\n\n${h.channelErrorDesc}`)
                        );

                    const errorReply = await interaction.editReply({
                        components: [channelErrorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    scheduleMusicTimeout(() => errorReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
                    return;
                }

                await advancedMessageManager.cleanupGuildMessages(client, interaction.guildId, ['queue']);

                const queue = player.queue;
                const currentTrack = player.current;

                const queueItems = queue.slice(0, 15).map((track, i) =>
                    `**${i + 1}.** **${track.info.title}**\n> *${getEmoji('mic')} ${track.info.author} • ${getEmoji('user')} ${track.requester?.username} • ${getEmoji('time')} ${formatTime(track.info.length)}*`
                );

                const queueContainer = advancedMessageManager.createV2Container('queue')
                    .addTextDisplayComponents(
                        textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('music')} ${h.queueTitle}**`); }
                    )
                    .addSeparatorComponents(separator => separator);

                if (currentTrack) {
                    queueContainer.addSectionComponents(
                        section => section
                            .addTextDisplayComponents(
                                textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('music')} ${h.currentlyPlayingLabel}**\\n**${currentTrack.info.title}**\\n*${currentTrack.info.author} • ${formatTime(currentTrack.info.length)}*`); }
                            )
                            .setThumbnailAccessory(
                                thumbnail => thumbnail
                                    .setURL(currentTrack.info.thumbnail || 'https://via.placeholder.com/300x300/DC92FF/FFFFFF?text=Music')
                                    .setDescription('Now Playing')
                            )
                    ).addSeparatorComponents(separator => separator);
                }

                queueContainer.addTextDisplayComponents(
                    textDisplay => textDisplay.setContent([
                        `**${getEmoji('analytics')} ${loadLanguage(interaction.guildId)?.lavalink?.handler?.queueStatsTitle}**`,
                        `• **Total Tracks:** ${queue.length}`,
                        `• **Estimated Time:** ~${Math.round(queue.length * 3.5)} minutes`,
                        `• **Loop Mode:** ${player.loop || 'None'}`,
                        `• **Shuffle:** ${queue.shuffled ? 'Enabled' : 'Disabled'}`,
                        `• **Volume:** ${player.volume}%`
                    ].join('\n'))
                ).addSeparatorComponents(separator => separator);

                if (queueItems.length > 0) {
                    queueContainer.addTextDisplayComponents(
                        textDisplay => textDisplay.setContent([
                            `**${getEmoji('list')} ${loadLanguage(interaction.guildId)?.lavalink?.handler?.upNextTitle}**`,
                            '',
                            queueItems.join('\n\n'),
                            queue.length > 15 ? `\n\n*...and ${queue.length - 15} more tracks*` : ''
                        ].join('\n'))
                    );
                } else {
                    queueContainer.addTextDisplayComponents(
                        textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('sfolder1')} ${h.emptyQueueMsg}**`); }
                    );
                }

                const queueMessage = await channel.send({
                    components: [queueContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                const context = { queueSize: queue.length };
                advancedMessageManager.addMessage(interaction.guildId, queueMessage.id, channel.id, 'queue', context);

                const successContainer = advancedMessageManager.createV2Container('success')
                    .addTextDisplayComponents(
                        textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('document')} ${h.queueDisplayedTitle}**\\n\\n${h.queueDisplayedDesc}`); }
                    );

                const successReply = await interaction.editReply({
                    components: [successContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                scheduleMusicTimeout(() => successReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('success'));

            } catch (error) {
                console.error('V2 Queue display error:', error);

                const errorContainer = advancedMessageManager.createV2Container('error')
                    .addTextDisplayComponents(
                        textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('cross')} ${h.queueDisplayErrorTitle}**\\n\\n${h.queueDisplayErrorDesc}`); }
                    );

                const errorReply = await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                scheduleMusicTimeout(() => errorReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
            }
        }


        async function showV2Lyrics(client, player, interaction) {
            try {
                const channel = client.channels.cache.get(player.textChannel);
                if (!channel) {
                    const errorContainer = advancedMessageManager.createV2Container('error')
                        .addTextDisplayComponents(
                            textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('cross')} ${h.channelErrorTitle}**\\n\\n${h.channelErrorDesc}`); }
                        );

                    const errorReply = await interaction.editReply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    scheduleMusicTimeout(() => errorReply.delete().catch(() => { }), 5000);
                    return;
                }

                if (!player.current) {
                    const noTrackContainer = advancedMessageManager.createV2Container('warning')
                        .addTextDisplayComponents(
                            textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('music')} ${h.lyricsNoTrackTitle}**\n\n${h.lyricsNoTrackDesc}`); }
                        );

                    const noTrackReply = await interaction.editReply({
                        components: [noTrackContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    scheduleMusicTimeout(() => noTrackReply.delete().catch(() => { }), 5000);
                    return;
                }

                if (activeLyricsMessages.has(interaction.guildId)) {
                    const existingMsg = activeLyricsMessages.get(interaction.guildId);
                    try {
                        await existingMsg.delete().catch(() => { });
                    } catch (err) { }
                    activeLyricsMessages.delete(interaction.guildId);
                }

                const track = player.current.info;

                const loadingContainer = advancedMessageManager.createV2Container('info')
                    .addTextDisplayComponents(
                        textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('mic')} ${h.lyricsLoadingTitle}**\\n\\n${h.lyricsLoadingDesc}`); }
                    );

                const loadingReply = await interaction.editReply({
                    components: [loadingContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                const lyrics = await getLyrics(track.title, track.author, Math.floor(track.length / 1000));

                if (!lyrics) {
                    const noLyricsContainer = advancedMessageManager.createV2Container('warning')
                        .addTextDisplayComponents(
                            textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('cross')} ${h.lyricsNotFoundTitle}**\\n\\n**No lyrics available for:**\\n**${track.title}** - *${track.author}*\\n\\n**Possible reasons:**\\n• Song not in lyrics database\\n• Instrumental track\\n• Very new/obscure song\\n• Title/artist mismatch`); }
                        );

                    await loadingReply.edit({
                        components: [noLyricsContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    scheduleMusicTimeout(() => loadingReply.delete().catch(() => { }), 8000);
                    return;
                }

                const lines = lyrics.split('\n').map(line => line.trim()).filter(Boolean);
                const maxLength = 4000;
                let lyricsText = lines.join('\n');
                let isShortened = false;

                if (lyricsText.length > maxLength) {
                    const cutPoint = lyricsText.lastIndexOf('\n', maxLength);
                    if (cutPoint > maxLength * 0.7) {
                        lyricsText = lyricsText.substring(0, cutPoint);
                        isShortened = true;
                    } else {
                        const lastSpace = lyricsText.lastIndexOf(' ', maxLength);
                        lyricsText = lyricsText.substring(0, lastSpace > 0 ? lastSpace : maxLength);
                        isShortened = true;
                    }
                }

                const lyricsContainer = advancedMessageManager.createV2Container('lyrics')
                    .addTextDisplayComponents(
                        textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('mic')} ${h.lyricsTitle}**`); }
                    )
                    .addSeparatorComponents(separator => separator)
                    .addSectionComponents(
                        section => section
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent([
                                    `**${track.title}**`,
                                    `*${track.author}*`,
                                    '',
                                    lyricsText || 'No lyrics available',
                                    isShortened ? '\n\n*...lyrics truncated due to length*' : ''
                                ].filter(Boolean).join('\n'))
                            )
                            .setThumbnailAccessory(
                                thumbnail => thumbnail
                                    .setURL(track.thumbnail || 'https://via.placeholder.com/300x300/FF69B4/FFFFFF?text=Lyrics')
                                    .setDescription('Song Lyrics')
                            )
                    )
                    .addSeparatorComponents(separator => separator)
                    .addTextDisplayComponents(
                        textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('analytics')} ${(h.lyricsTotalLines).replace('{count}', lines.length)}${isShortened ? ' (shortened)' : ''}`); }
                    );

                const closeButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('v2_lyrics_close')
                        .setLabel(loadLanguage(interaction.guildId)?.lavalink?.handler?.btnCloseLyrics)
                        .setEmoji(getButtonEmoji('cross'))
                        .setStyle(ButtonStyle.Danger)
                );

                lyricsContainer.addActionRowComponents(closeButton);
                const lyricsMessage = await channel.send({
                    components: [lyricsContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                activeLyricsMessages.set(interaction.guildId, lyricsMessage);

                const collector = lyricsMessage.createMessageComponentCollector({
                    time: 600000,
                    filter: (i) => i.customId === 'v2_lyrics_close'
                });
                lyricsCollectors.add(collector);

                collector.on('collect', async (i) => {
                    try {
                        if (i.deferred || i.replied) {
                            await lyricsMessage.delete().catch(() => { });
                        } else {
                            try {
                                await i.deferUpdate();
                            } catch (deferErr) {
                                if (deferErr.code !== 10062) {
                                    console.error('Lyrics close defer error:', deferErr);
                                }
                            }
                            await lyricsMessage.delete().catch(() => { });
                        }
                        clearActiveLyricsMessage(activeLyricsMessages, i.guildId, lyricsMessage);
                        collector.stop('closed');
                    } catch (err) {
                        if (err.code !== 10062) {
                            console.error('Lyrics close error:', err);
                        }
                        try {
                            await lyricsMessage.delete().catch(() => { });
                            clearActiveLyricsMessage(activeLyricsMessages, i.guildId, lyricsMessage);
                        } catch (deleteErr) { }
                        collector.stop('error');
                    }
                });

                collector.on('end', () => {
                    lyricsCollectors.delete(collector);
                    clearActiveLyricsMessage(activeLyricsMessages, interaction.guildId, lyricsMessage);
                });

                const successContainer = advancedMessageManager.createV2Container('success')
                    .addTextDisplayComponents(
                        textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('tick')} ${h.lyricsDisplayedTitle}**\\n\\n${h.lyricsDisplayedDesc}`); }
                    );

                await loadingReply.edit({
                    components: [successContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                scheduleMusicTimeout(() => loadingReply.delete().catch(() => { }), 5000);

            } catch (error) {
                console.error('V2 Lyrics error:', error);

                const errorContainer = advancedMessageManager.createV2Container('error')
                    .addTextDisplayComponents(
                        textDisplay => { const h = loadLanguage(interaction.guildId)?.lavalink?.handler || {}; textDisplay.setContent(`**${getEmoji('cross')} ${h.lyricsErrorTitle}**\\n\\n${h.lyricsErrorDesc}`); }
                    );

                const errorReply = await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                scheduleMusicTimeout(() => errorReply.delete().catch(() => { }), 5000);
            }
        }


        async function handlePlayerCleanup(client, guildId, player, reason) {
            try {
                if (activeLyricsMessages.has(guildId)) {
                    const lyricsMsg = activeLyricsMessages.get(guildId);
                    try {
                        await lyricsMsg.delete().catch(() => { });
                    } catch (err) { }
                    activeLyricsMessages.delete(guildId);
                }

                await advancedMessageManager.cleanupGuildMessages(client, guildId);

                if (queueDisplayTimeouts.has(guildId)) {
                    clearTimeout(queueDisplayTimeouts.get(guildId));
                    queueDisplayTimeouts.delete(guildId);
                }

                sessionManager.endSession(guildId);
            } catch (error) {
                console.error('V2 Player cleanup error:', error);
            }
        }

        function formatTime(ms) {
            if (!ms || ms === 0) return "0:00";
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${hours > 0 ? hours + ":" : ""}${minutes.toString().padStart(hours > 0 ? 2 : 1, "0")}:${seconds.toString().padStart(2, "0")}`;
        }

        async function getLyrics(trackName, artistName, duration) {
            try {
                trackName = trackName
                    .replace(/\b(Official|Audio|Video|Lyrics|Theme|Soundtrack|Music|Full Version|HD|4K|Visualizer|Radio Edit|Live|Remix|Mix|Extended|Cover|Parody|Performance|Version|Unplugged|Reupload)\b/gi, "")
                    .replace(/\s*[-_/|]\s*/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                artistName = artistName
                    .replace(/\b(Topic|VEVO|Records|Label|Productions|Entertainment|Ltd|Inc|Band|DJ|Composer|Performer)\b/gi, "")
                    .replace(/ x /gi, " & ")
                    .replace(/\s+/g, " ")
                    .trim();

                const lrclibBase = (process.env.LRCLIB_API_URL || 'https://lrclib.net').replace(/\/+$/, '');
                let response = await axios.get(`${lrclibBase}/api/get`, {
                    params: { track_name: trackName, artist_name: artistName, duration },
                    timeout: 5000
                });

                if (response.data.syncedLyrics || response.data.plainLyrics) {
                    return response.data.syncedLyrics || response.data.plainLyrics;
                }

                response = await axios.get(`${lrclibBase}/api/get`, {
                    params: { track_name: trackName, artist_name: artistName },
                    timeout: 5000
                });

                return response.data.syncedLyrics || response.data.plainLyrics;
            } catch (error) {
                console.error("V2 Lyrics fetch error:", error.response?.data?.message || error.message);
                return null;
            }
        }

        function getVolumeBar(volume) {
            const barLength = 20;
            const filledLength = Math.round((volume / 100) * barLength);
            const emptyLength = barLength - filledLength;
            return '█'.repeat(filledLength) + '░'.repeat(emptyLength) + ' ${volume}%';
        }

        function getLoopDescription(mode) {
            const descriptions = {
                'none': '*No looping - plays through queue once*',
                'track': '*Current track repeats indefinitely*',
                'queue': '*Entire queue repeats when finished*'
            };
            return descriptions[mode] || '*Unknown loop mode*';
        }

        let isCleaningOrphaned = false;
        const cleanupOrphanedResources = async () => {
            if (isCleaningOrphaned) return;
            isCleaningOrphaned = true;
            try {
                const guildsWithResources = new Set([
                    ...advancedMessageManager.trackMessages.keys(),
                    ...advancedMessageManager.lyricsMessages.keys(),
                    ...advancedMessageManager.queueMessages.keys(),
                    ...advancedMessageManager.lastEmbeds.keys(),
                    ...activeLyricsMessages.keys(),
                    ...queueDisplayTimeouts.keys(),
                    ...sessionManager.activeSessions.keys()
                ]);

                for (const guildId of guildsWithResources) {
                    if (client.riffy && !client.riffy.players.has(guildId)) {
                        await handlePlayerCleanup(client, guildId, null, 'Orphaned resource cleanup');
                    }
                }
            } catch (error) {
                console.error("V2 Cleanup routine error:", error);
            } finally {
                isCleaningOrphaned = false;
            }
        };

        cleanupInterval = setInterval(cleanupOrphanedResources, 3 * 60 * 1000);
        cleanupInterval.unref?.();

        registerMusicListener(musicListeners, client, 'error', async (error) => {
            

            if (client.riffy && (error.message.includes('voice') || error.message.includes('connection'))) {
                for (const [guildId, player] of client.riffy.players) {
                    await handlePlayerCleanup(client, guildId, player, 'Client error recovery');
                    player.destroy();
                }
            }
        });

        if (!process._v2MusicHandlersRegistered) {
            process._v2MusicHandlersRegistered = true;
            registerMusicListener(musicListeners, process, 'unhandledRejection', (reason, promise) => {
                console.error('V2 Unhandled Rejection at:', promise, 'reason:', reason);
            });

            registerMusicListener(musicListeners, process, 'uncaughtException', (error) => {
                console.error('V2 Uncaught Exception:', error);
            });
        }

        registerMusicListener(musicListeners, client, 'raw', async d => {
            if (client.riffy) {
                await client.riffy.updateVoiceState(d);
            }
        });

        const initializeRiffy = async () => {
            try {
                if (stopping) return;
                if (!client.isReady()) {
                    await new Promise(resolve => registerMusicListener(musicListeners, client, 'clientReady', resolve, true));
                }
                if (stopping) return;

                
                if (!client.riffy) {
                    await new Promise((resolve) => {
                        const checkInterval = setInterval(() => {
                            if (client.riffy) {
                                clearInterval(checkInterval);
                                resolve();
                            }
                        }, 100);

                        
                        scheduleMusicTimeout(() => {
                            clearInterval(checkInterval);
                            resolve();
                        }, 30000);
                    });
                }

                if (stopping) return;
                if (client.riffy) {
                    client.riffy.init(client.user.id);

                    
                    await Promise.race([
                        new Promise((resolve) => {
                            registerMusicListener(musicListeners, client.riffy, 'nodeConnect', resolve, true);
                        }),
                        new Promise((_, reject) =>
                            scheduleMusicTimeout(() => reject(new Error('Node connection timeout after 15 seconds')), 15000)
                        )
                    ]);

                    console.log('\x1b[35m[ V2 MUSIC ]\x1b[0m', '\x1b[32mAdvanced V2 Music System Active\x1b[0m');

                    
                    if (client.nodeManager) {
                        const status = client.nodeManager.getNodeStatus();
                        console.log(`\x1b[34m[ NODE MANAGER ]\x1b[0m Status: ${status.online}/${status.total} nodes online`);
                    }

                    scheduleMusicTimeout(async () => {
                        try {
                            for (const guild of client.guilds.cache.values()) {
                                await advancedMessageManager.cleanupGuildMessages(client, guild.id);
                            }
                        } catch (cleanupError) {
                            console.error('\x1b[33m[ V2 LAVALINK ]\x1b[0m Cleanup error:', cleanupError.message);
                        }
                    }, 5000);
                } else {
                    throw new Error('Riffy not initialized by NodeManager');
                }

            } catch (error) {

                if (client.nodeManager) {
                    const status = client.nodeManager.getNodeStatus();
                    

                    if (status.online === 0) {
                        
                    }
                } else {
                    console.error('\x1b[31m[ V2 LAVALINK ]\x1b[0m NodeManager not available. Check your lavalink config.');
                }
            }
        };

        
        scheduleMusicTimeout(() => {
            if (!stopping) initializeRiffy();
        }, 2000);
    } else {
        console.log('\x1b[31m[ V2 MUSIC ]\x1b[0m Lavalink Music System Disabled');
    }

    return {
        stop() {
            if (stopping) return;
            stopping = true;
            if (cleanupInterval) clearInterval(cleanupInterval);
            cleanupInterval = null;
            unregisterInteractionRoute?.();
            unregisterInteractionRoute = null;

            for (const collector of lyricsCollectors) collector.stop('shutdown');
            lyricsCollectors.clear();
            const ownsProcessHandlers = [...musicListeners].some(({ emitter }) => emitter === process);
            for (const { emitter, eventName, listener } of musicListeners) {
                emitter.off(eventName, listener);
            }
            musicListeners.clear();
            for (const timer of musicTimers) clearTimeout(timer);
            musicTimers.clear();
            for (const timer of advancedMessageManager.cleanupTimeouts.values()) clearTimeout(timer);
            advancedMessageManager.cleanupTimeouts.clear();
            advancedMessageManager.trackMessages.clear();
            advancedMessageManager.lyricsMessages.clear();
            advancedMessageManager.queueMessages.clear();
            advancedMessageManager.lastEmbeds.clear();
            advancedMessageManager.controlPanels.clear();
            activeLyricsMessages.clear();
            queueDisplayTimeouts.clear();
            sessionManager.activeSessions.clear();
            client.nodeManager?.shutdown?.();
            client.riffy = null;
            if (ownsProcessHandlers && process._v2MusicHandlersRegistered) {
                process._v2MusicHandlersRegistered = false;
            }
        }
    };
};

module.exports.canUseRequesterControls = canUseRequesterControls;
module.exports.clearActiveLyricsMessage = clearActiveLyricsMessage;
