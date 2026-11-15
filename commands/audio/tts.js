


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { buildCard, cards, sendV2, deferReply, ACCENT, createInterpolatableProxy, getEmoji } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    audio: {
        ...rawLang.audio,
        common: createInterpolatableProxy(rawLang.audio?.common),
        tts: createInterpolatableProxy(rawLang.audio?.tts)
    }
};

const activeSessions = new Map();
const messageQueue = new Map();
const userCooldowns = new Map();
const inactivityTimers = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tts-live')
        .setDescription('Live TTS - Bot reads messages in voice channel')
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Start live TTS session')
                .addStringOption(opt =>
                    opt.setName('language')
                        .setDescription('Default language for TTS')
                        .addChoices(
                            { name: 'English', value: 'en' },
                            { name: 'Spanish', value: 'es' },
                            { name: 'French', value: 'fr' },
                            { name: 'German', value: 'de' },
                            { name: 'Italian', value: 'it' },
                            { name: 'Japanese', value: 'ja' },
                            { name: 'Korean', value: 'ko' },
                            { name: 'Chinese', value: 'zh' },
                            { name: 'Russian', value: 'ru' },
                            { name: 'Hindi', value: 'hi' }
                        )))
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Stop live TTS session')),

    async execute(interaction) {
        await deferReply(interaction);

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'start') {
            return await this.handleStart(interaction, guildId);
        } else if (subcommand === 'stop') {
            return await this.handleStop(interaction, guildId);
        }
    },

    async handleStart(interaction, guildId) {
        if (activeSessions.has(guildId)) {
            return this.sendError(interaction, lang.audio.tts.alreadyActive);
        }

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return this.sendError(interaction, lang.audio.common.needVoiceChannel);
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            return this.sendError(interaction, lang.audio.common.needPermissions);
        }

        const selectedLang = interaction.options.getString('language') || 'en';

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 20000);

            const player = createAudioPlayer();
            connection.subscribe(player);

            activeSessions.set(guildId, {
                channelId: interaction.channel.id,
                voiceChannelId: voiceChannel.id,
                connection: connection,
                player: player,
                language: selectedLang,
                isPlaying: false,
                startedBy: interaction.user.id,
                messageHandler: null
            });

            messageQueue.set(guildId, []);

            this.setupMessageListener(interaction.client, guildId);
            this.startInactivityTimer(guildId, interaction.channel);

            const card = cards.success(
                lang.audio.tts.startedTitle,
                lang.audio.tts.startedDesc({
                    channelId: interaction.channel.id,
                    voiceChannel: voiceChannel.name,
                    language: this.getLanguageName(selectedLang)
                })
            );

            return sendV2(interaction, card);

        } catch (error) {
            console.error('[TTS Live Start Error]:', error);
            activeSessions.delete(guildId);
            return this.sendError(interaction, lang.audio.tts.startFailed);
        }
    },

    async handleStop(interaction, guildId) {
        const session = activeSessions.get(guildId);

        if (!session) {
            return this.sendError(interaction, lang.audio.tts.noActiveSession);
        }

        if (session.startedBy !== interaction.user.id && 
            !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return this.sendError(interaction, lang.audio.tts.onlyStarterOrMod);
        }

        try {
            this.cleanupSession(guildId, interaction.client);

            const card = cards.warning(
                lang.audio.tts.stoppedTitle,
                lang.audio.tts.stoppedDesc({ user: interaction.user.id })
            );

            return sendV2(interaction, card);

        } catch (error) {
            console.error('[TTS Live Stop Error]:', error);
            return this.sendError(interaction, lang.audio.tts.stopError);
        }
    },

    startInactivityTimer(guildId, channel) {
        if (inactivityTimers.has(guildId)) {
            clearTimeout(inactivityTimers.get(guildId));
        }

        const timer = setTimeout(async () => {
            const session = activeSessions.get(guildId);
            if (session) {
                this.cleanupSession(guildId, channel.client);

                try {
                    const card = cards.warning(
                        lang.audio.tts.endedInactivityTitle,
                        lang.audio.tts.endedInactivity
                    );
                    await sendV2(channel, card);
                } catch (err) {
                    console.error('[TTS Inactivity Notice Error]:', err);
                }
            }
        }, 30000);

        inactivityTimers.set(guildId, timer);
    },

    resetInactivityTimer(guildId, channel) {
        this.startInactivityTimer(guildId, channel);
    },

    cleanupSession(guildId, client) {
        const session = activeSessions.get(guildId);

        if (session) {
            if (session.messageHandler && client) {
                client.off('messageCreate', session.messageHandler);
            }
            if (session.connection) {
                session.connection.destroy();
            }
        }

        if (inactivityTimers.has(guildId)) {
            clearTimeout(inactivityTimers.get(guildId));
            inactivityTimers.delete(guildId);
        }

        activeSessions.delete(guildId);
        messageQueue.delete(guildId);
    },

    setupMessageListener(client, guildId) {
        const messageHandler = async (message) => {
            const session = activeSessions.get(guildId);
            if (!session) {
                client.off('messageCreate', messageHandler);
                return;
            }

            if (message.author.bot) return;
            if (message.channel.id !== session.channelId) return;
            if (!message.content.startsWith('!tts ')) return;

            
            const memberVoice = message.member?.voice?.channel;
            if (!memberVoice || memberVoice.id !== session.voiceChannelId) {
                return message.reply(lang.audio.tts.mustBeInSameVoice).then(m => {
                    setTimeout(() => m.delete().catch(() => {}), 5000);
                });
            }

            this.resetInactivityTimer(guildId, message.channel);

            const text = message.content.slice(5).trim();

            if (!text) {
                return message.reply(lang.audio.tts.provideText).then(m => {
                    setTimeout(() => m.delete().catch(() => {}), 5000);
                });
            }

            if (text.length > 200) {
                return message.reply(lang.audio.tts.textTooLong).then(m => {
                    setTimeout(() => m.delete().catch(() => {}), 5000);
                });
            }

            const userId = message.author.id;
            const cooldownKey = `${guildId}-${userId}`;
            const now = Date.now();

            if (userCooldowns.has(cooldownKey)) {
                const cooldownEnd = userCooldowns.get(cooldownKey);
                if (now < cooldownEnd) {
                    const remaining = Math.ceil((cooldownEnd - now) / 1000);
                    return message.reply(lang.audio.tts.rateLimited({ seconds: remaining })).then(m => {
                        setTimeout(() => m.delete().catch(() => {}), 3000);
                    });
                }
            }

            userCooldowns.set(cooldownKey, now + 5000);
            setTimeout(() => userCooldowns.delete(cooldownKey), 5000);

            const queue = messageQueue.get(guildId);
            queue.push({
                text: text,
                username: message.author.username,
                language: session.language
            });

            const vol = getEmoji('volume_high');
            const volId = vol && vol.match(/:(\d+)>/)?.[1];
            if (volId) await message.react(volId).catch(() => {});

            if (!session.isPlaying) {
                this.processQueue(guildId);
            }
        };

        client.on('messageCreate', messageHandler);

        
        const session = activeSessions.get(guildId);
        if (session) session.messageHandler = messageHandler;
    },

    async processQueue(guildId) {
        const session = activeSessions.get(guildId);
        const queue = messageQueue.get(guildId);

        if (!session || !queue || queue.length === 0) {
            if (session) session.isPlaying = false;
            return;
        }

        session.isPlaying = true;

        const item = queue.shift();
        const text = item.text;

        try {
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const filename = `tts_live_${Date.now()}.mp3`;
            const tempFile = path.join(tempDir, filename);

            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${item.language}&client=tw-ob&q=${encodeURIComponent(text)}`;

            await this.downloadFile(ttsUrl, tempFile);

            const resource = createAudioResource(tempFile);
            session.player.play(resource);

            await new Promise((resolve) => {
                session.player.once(AudioPlayerStatus.Idle, () => {
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {
                        console.error('Failed to delete temp file:', err);
                    }
                    resolve();
                });

                session.player.once('error', (error) => {
                    console.error('Player error:', error);
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {}
                    resolve();
                });
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            this.processQueue(guildId);

        } catch (error) {
            console.error('TTS processing error:', error);
            session.isPlaying = false;

            if (queue.length > 0) {
                setTimeout(() => this.processQueue(guildId), 1000);
            }
        }
    },

    downloadFile(url, dest, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            let finished = false;

            const cleanup = (err) => {
                if (finished) return;
                finished = true;
                file.destroy();
                fs.unlink(dest, () => {});
                reject(err);
            };

            const timer = setTimeout(() => cleanup(new Error('TTS download timed out')), timeoutMs);

            const doRequest = (reqUrl) => {
                const mod = reqUrl.startsWith('https') ? https : require('http');
                mod.get(reqUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
                        'Referer': 'https://translate.google.com/'
                    }
                }, (response) => {
                    
                    if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
                        const location = response.headers.location;
                        if (location) return doRequest(location);
                    }
                    if (response.statusCode !== 200) {
                        clearTimeout(timer);
                        cleanup(new Error(`Failed to download TTS: ${response.statusCode}`));
                        return;
                    }

                    response.pipe(file);

                    file.on('finish', () => {
                        if (finished) return;
                        finished = true;
                        clearTimeout(timer);
                        file.close();
                        resolve();
                    });

                    file.on('error', (err) => {
                        clearTimeout(timer);
                        cleanup(err);
                    });
                }).on('error', (err) => {
                    clearTimeout(timer);
                    cleanup(err);
                });
            };

            doRequest(url);
        });
    },

    getLanguageName(code) {
        const langs = {
            en: 'English', es: 'Spanish', fr: 'French', de: 'German',
            it: 'Italian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
            ru: 'Russian', hi: 'Hindi'
        };
        return langs[code] || code;
    },

    sendError(interaction, message) {
        const card = cards.error(
            lang.audio.tts.title,
            message
        );
        return sendV2(interaction, card);
    }
};