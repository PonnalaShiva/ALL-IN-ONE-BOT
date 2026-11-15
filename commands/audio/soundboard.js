


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { buildCard, cards, sendV2, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    audio: {
        ...rawLang.audio,
        common: createInterpolatableProxy(rawLang.audio?.common),
        soundboard: createInterpolatableProxy(rawLang.audio?.soundboard)
    }
};

const SOUNDS = {
    airhorn: { url: 'https://www.myinstants.com/media/sounds/air-horn.mp3', name: 'Air Horn', duration: 2 },
    crickets: { url: 'https://www.myinstants.com/media/sounds/crickets-chirping.mp3', name: 'Crickets', duration: 3 },
    drumroll: { url: 'https://www.myinstants.com/media/sounds/drumroll-sound-effect.mp3', name: 'Drum Roll', duration: 5 },
    sadviolin: { url: 'https://www.myinstants.com/media/sounds/sad-violin.mp3', name: 'Sad Violin', duration: 4 },
    fart: { url: 'https://www.myinstants.com/media/sounds/dry-fart.mp3', name: 'Fart', duration: 1 },
    bruh: { url: 'https://www.myinstants.com/media/sounds/movie_1.mp3', name: 'Bruh', duration: 2 },
    wow: { url: 'https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3', name: 'Wow', duration: 1 },
    nope: { url: 'https://www.myinstants.com/media/sounds/nope.mp3', name: 'Nope', duration: 2 },
    yeet: { url: 'https://www.myinstants.com/media/sounds/yeet_1.mp3', name: 'Yeet', duration: 1 },
    bonk: { url: 'https://www.myinstants.com/media/sounds/bonk_7zPAD7C.mp3', name: 'Bonk', duration: 1 },
    oof: { url: 'https://www.myinstants.com/media/sounds/roblox-death-sound_1.mp3', name: 'Oof (Roblox)', duration: 1 },
    bruh2: { url: 'https://www.myinstants.com/media/sounds/sans-titre1.mp3', name: 'Vine Boom', duration: 5 },
    rickroll: { url: 'https://www.myinstants.com/media/sounds/rick-rolled-meme-aetrim1602054550919.mp3', name: 'Rick Roll', duration: 10 },
    drama: { url: 'https://www.myinstants.com/media/sounds/dramatic.swf.mp3', name: 'Dramatic', duration: 2 },
    mission: { url: 'https://www.myinstants.com/media/sounds/gta-san-andreas-abertura-oficial.mp3', name: 'Respect', duration: 10 },
    john: { url: 'https://www.myinstants.com/media/sounds/untitled_utIjZcq.mp3', name: 'John Cena', duration: 5 },
    error: { url: 'https://www.myinstants.com/media/sounds/erro.mp3', name: 'Error', duration: 2 },
    victory: { url: 'https://www.myinstants.com/media/sounds/victory_6.mp3', name: 'Victory (FF)', duration: 5 },
    clown: { url: 'https://www.myinstants.com/media/sounds/clown-horn-sound-effect_1.mp3', name: 'Clown Horn', duration: 2 },
    cash: { url: 'https://www.myinstants.com/media/sounds/audiojoiner120623175716.mp3', name: 'Cash Register', duration: 2 },
    applause: { url: 'https://www.myinstants.com/media/sounds/applause.mp3', name: 'Applause', duration: 5 },
    explosion: { url: 'https://www.myinstants.com/media/sounds/explosion-sound-effect.mp3', name: 'Explosion', duration: 2 },
    glass: { url: 'https://www.myinstants.com/media/sounds/glass-shattering.mp3', name: 'Glass Breaking', duration: 2 },
    horn: { url: 'https://www.myinstants.com/media/sounds/mlg-airhorn.mp3', name: 'Truck Horn', duration: 2 },
    scream: { url: 'https://www.myinstants.com/media/sounds/toms-screams.mp3', name: 'Wilhelm Scream', duration: 2 }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soundboard')
        .setDescription('Play sound effects in voice channel')
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Play a sound effect')
                .addStringOption(opt =>
                    opt.setName('sound')
                        .setDescription('Select sound')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Air Horn', value: 'airhorn' },
                            { name: 'Crickets', value: 'crickets' },
                            { name: 'Drum Roll', value: 'drumroll' },
                            { name: 'Sad Violin', value: 'sadviolin' },
                            { name: 'Fart', value: 'fart' },
                            { name: 'Bruh', value: 'bruh' },
                            { name: 'Wow', value: 'wow' },
                            { name: 'Nope', value: 'nope' },
                            { name: 'Yeet', value: 'yeet' },
                            { name: 'Bonk', value: 'bonk' },
                            { name: 'Oof (Roblox)', value: 'oof' },
                            { name: 'Vine Boom', value: 'bruh2' },
                            { name: 'Rick Roll', value: 'rickroll' },
                            { name: 'Dramatic', value: 'drama' },
                            { name: 'Respect', value: 'mission' },
                            { name: 'John Cena', value: 'john' },
                            { name: 'Error', value: 'error' },
                            { name: 'Victory (FF)', value: 'victory' },
                            { name: 'Clown Horn', value: 'clown' },
                            { name: 'Cash Register', value: 'cash' },
                            { name: 'Applause', value: 'applause' },
                            { name: 'Explosion', value: 'explosion' },
                            { name: 'Glass Breaking', value: 'glass' },
                            { name: 'Truck Horn', value: 'horn' },
                            { name: 'Wilhelm Scream', value: 'scream' }
                        )))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show all available sounds'))
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Stop playing and disconnect bot'))
        .addSubcommand(sub =>
            sub.setName('random')
                .setDescription('Play a random sound effect')),

    async execute(interaction) {
        await deferReply(interaction);

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'play':
                    return await this.handlePlay(interaction);
                case 'list':
                    return await this.handleList(interaction);
                case 'stop':
                    return await this.handleStop(interaction);
                case 'random':
                    return await this.handleRandom(interaction);
            }
        } catch (error) {
            console.error('[Soundboard Error]', error);
            return this.sendError(interaction, error.message);
        }
    },

    async handlePlay(interaction, overrideSoundKey = null) {
        const soundKey = overrideSoundKey || interaction.options.getString('sound');
        const sound = SOUNDS[soundKey];

        if (!sound) {
            return this.sendError(interaction, lang.audio.soundboard.soundNotFound);
        }

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return this.sendError(interaction, lang.audio.common.needVoiceChannel);
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            return this.sendError(interaction, lang.audio.common.needPermissions);
        }

        const existingConnection = interaction.guild.members.me.voice.channel;
        if (existingConnection && existingConnection.id !== voiceChannel.id) {
            return this.sendError(interaction, lang.audio.common.alreadyPlayingDifferentChannel);
        }

        try {
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempFile = path.join(tempDir, `${soundKey}_${Date.now()}.mp3`);
            await this.downloadFile(sound.url, tempFile);

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 20000);

            const player = createAudioPlayer();
            const resource = createAudioResource(tempFile);

            connection.subscribe(player);
            player.play(resource);

            const card = buildCard({ accent: ACCENT.success })
                .addText(`**${lang.audio.soundboard.nowPlayingTitle}**`)
                .addSeparator()
                .addText(lang.audio.soundboard.nowPlaying({
                    name: sound.name,
                    channel: voiceChannel.name,
                    duration: sound.duration
                }));

            await sendV2(interaction, card);

            player.on(AudioPlayerStatus.Idle, () => {
                setTimeout(() => {
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {
                        console.error('[Soundboard Cleanup Error]:', err);
                    }
                    connection.destroy();
                }, 1000);
            });

            player.on('error', error => {
                console.error('[Soundboard Player Error]:', error);
                try {
                    fs.unlinkSync(tempFile);
                } catch (err) {}
                connection.destroy();
            });

        } catch (error) {
            console.error('[Playback Error]:', error);
            return this.sendError(interaction, lang.audio.common.playbackFailed);
        }
    },

    async handleList(interaction) {
        let soundList = '';
        Object.entries(SOUNDS).forEach(([key, sound], idx) => {
            soundList += `${idx + 1}. **${sound.name}** • \`${sound.duration}s\`\n`;
        });

        const card = buildCard({ accent: ACCENT.primary })
            .addText(`**${lang.audio.soundboard.availableSoundsTitle}**`)
            .addSeparator()
            .addText(lang.audio.soundboard.availableSoundsDesc({ count: Object.keys(SOUNDS).length }))
            .addSeparator()
            .addText(soundList.trim())
            .addSeparator()
            .addText(`*${lang.audio.soundboard.availableSoundsFooter}*`);

        return sendV2(interaction, card);
    },

    async handleStop(interaction) {
        const existingConnection = getVoiceConnection(interaction.guild.id);

        if (!existingConnection) {
            return this.sendError(interaction, lang.audio.common.notInVoiceChannel);
        }

        existingConnection.destroy();

        return sendV2(interaction, cards.warning(
            lang.audio.common.stoppedTitle,
            lang.audio.common.stopped
        ));
    },

    async handleRandom(interaction) {
        const soundKeys = Object.keys(SOUNDS);
        const randomKey = soundKeys[Math.floor(Math.random() * soundKeys.length)];

        return await this.handlePlay(interaction, randomKey);
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

            const timer = setTimeout(() => cleanup(new Error('Download timed out')), timeoutMs);

            const doRequest = (reqUrl, redirectCount = 0) => {
                if (redirectCount > 5) {
                    clearTimeout(timer);
                    cleanup(new Error('Too many redirects'));
                    return;
                }
                const mod = reqUrl.startsWith('https') ? https : require('http');
                mod.get(reqUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
                        'Referer': 'https://www.myinstants.com/',
                        'Origin': 'https://www.myinstants.com'
                    }
                }, (response) => {
                    
                    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                        const location = response.headers.location;
                        if (location) return doRequest(location, redirectCount + 1);
                    }
                    if (response.statusCode !== 200) {
                        clearTimeout(timer);
                        cleanup(new Error(`Failed to download: ${response.statusCode}`));
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

    sendError(interaction, message) {
        const card = cards.error(
            lang.audio.soundboard.title,
            message
        );
        return sendV2(interaction, card);
    }
};