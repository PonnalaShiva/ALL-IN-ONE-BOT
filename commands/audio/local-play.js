


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
const fs = require('fs');
const path = require('path');
const { buildCard, cards, sendV2, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    audio: {
        ...rawLang.audio,
        common: createInterpolatableProxy(rawLang.audio?.common),
        localPlay: createInterpolatableProxy(rawLang.audio?.localPlay)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('local-play')
        .setDescription('Upload and play MP3 files in voice channel')
        .addSubcommand(sub =>
            sub.setName('upload')
                .setDescription('Upload an MP3 file to library')
                .addAttachmentOption(opt =>
                    opt.setName('file')
                        .setDescription('MP3 file to upload')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Name for this audio')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all uploaded audio files'))
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Play audio in your voice channel')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Audio name')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Stop playing and disconnect'))
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete an uploaded audio')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Audio name')
                        .setRequired(true)
                        .setAutocomplete(true))),

    async autocomplete(interaction) {
        const audioDir = path.join(__dirname, '../../audio_library');

        if (!fs.existsSync(audioDir)) {
            return interaction.respond([]);
        }

        const files = fs.readdirSync(audioDir)
            .filter(f => f.endsWith('.mp3'))
            .map(f => ({
                name: f.replace('.mp3', ''),
                value: f.replace('.mp3', '')
            }));

        await interaction.respond(files.slice(0, 25));
    },

    async execute(interaction) {
        await deferReply(interaction);

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'upload':
                    return await this.handleUpload(interaction);
                case 'list':
                    return await this.handleList(interaction);
                case 'play':
                    return await this.handlePlay(interaction);
                case 'stop':
                    return await this.handleStop(interaction);
                case 'delete':
                    return await this.handleDelete(interaction);
            }
        } catch (error) {
            console.error('[Local Play Error]', error);
            return this.sendError(interaction, error.message);
        }
    },

    async handleUpload(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return this.sendError(interaction, lang.audio.common.manageServerRequired);
        }

        const file = interaction.options.getAttachment('file');
        const rawName = interaction.options.getString('name') || '';
        const name = path.basename(rawName).replace(/[^a-zA-Z0-9_-]/g, '');

        if (!name) {
            return this.sendError(interaction, 'Invalid file name. Please use alphanumeric characters, dashes, or underscores.');
        }

        if (!file.name.endsWith('.mp3')) {
            return this.sendError(interaction, lang.audio.localPlay.onlyMp3);
        }

        if (file.size > 8 * 1024 * 1024) {
            return this.sendError(interaction, lang.audio.localPlay.fileTooLarge);
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const audioDir = path.join(__dirname, '../../audio_library');
        if (!fs.existsSync(audioDir)) {
            await fs.promises.mkdir(audioDir, { recursive: true });
        }

        const filePath = path.join(audioDir, `${name}.mp3`);

        if (fs.existsSync(filePath)) {
            return this.sendError(interaction, lang.audio.localPlay.alreadyExists({ name }));
        }

        const response = await fetch(file.url);
        if (!response.ok) {
            return this.sendError(interaction, lang.audio.localPlay.downloadFailed({ status: response.status }));
        }
        const buffer = await response.arrayBuffer();
        await fs.promises.writeFile(filePath, Buffer.from(buffer));

        const card = cards.success(
            lang.audio.localPlay.uploadSuccessTitle,
            lang.audio.localPlay.uploadSuccess({
                name,
                size: (file.size / 1024).toFixed(2),
                duration: Math.floor(file.size / 32000),
                prefix: '/'
            })
        );

        return sendV2(interaction, card);
    },

    async handleList(interaction) {
        const audioDir = path.join(__dirname, '../../audio_library');

        if (!fs.existsSync(audioDir)) {
            return sendV2(interaction, cards.info(lang.audio.localPlay.title, lang.audio.localPlay.noFiles));
        }

        const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3'));

        if (files.length === 0) {
            return sendV2(interaction, cards.info(lang.audio.localPlay.title, lang.audio.localPlay.noFiles));
        }

        let fileList = '';
        files.forEach((file, idx) => {
            const name = file.replace('.mp3', '');
            const stats = fs.statSync(path.join(audioDir, file));
            const size = (stats.size / 1024).toFixed(2);
            fileList += `${idx + 1}. **${name}** • ${size} KB\n`;
        });

        const card = buildCard({ accent: ACCENT.primary })
            .addText(`**${lang.audio.localPlay.libraryTitle}**`)
            .addSeparator()
            .addText(lang.audio.localPlay.libraryDesc({ count: files.length }))
            .addSeparator()
            .addText(fileList.trim())
            .addSeparator()
            .addText(`*${lang.audio.localPlay.libraryFooter}*`);

        return sendV2(interaction, card);
    },

    async handlePlay(interaction) {
        const name = path.basename(interaction.options.getString('name') || '').replace(/[^a-zA-Z0-9_-]/g, '');

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

        const audioDir = path.join(__dirname, '../../audio_library');
        const filePath = path.join(audioDir, `${name}.mp3`);

        if (!fs.existsSync(filePath)) {
            return this.sendError(interaction, lang.audio.localPlay.notFound);
        }

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
            const resource = createAudioResource(filePath);

            connection.subscribe(player);
            player.play(resource);

            const stats = fs.statSync(filePath);

            const card = buildCard({ accent: ACCENT.success })
                .addText(`**${lang.audio.localPlay.nowPlayingTitle}**`)
                .addSeparator()
                .addText(lang.audio.localPlay.nowPlaying({
                    name,
                    channel: voiceChannel.name,
                    size: (stats.size / 1024).toFixed(2),
                    duration: Math.floor(stats.size / 32000)
                }));

            await sendV2(interaction, card);

            player.on(AudioPlayerStatus.Idle, () => {
                setTimeout(() => {
                    connection.destroy();
                }, 1000);
            });

            player.on('error', error => {
                console.error('[Audio Player Error]:', error);
                connection.destroy();
            });

        } catch (error) {
            console.error('[Playback Error]:', error);
            return this.sendError(interaction, lang.audio.common.playbackFailed);
        }
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

    async handleDelete(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return this.sendError(interaction, lang.audio.common.manageServerRequired);
        }

        const name = path.basename(interaction.options.getString('name') || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const audioDir = path.join(__dirname, '../../audio_library');
        const filePath = path.join(audioDir, `${name}.mp3`);

        if (!fs.existsSync(filePath)) {
            return this.sendError(interaction, lang.audio.localPlay.notFound);
        }

        await fs.promises.unlink(filePath);

        return sendV2(interaction, cards.success(
            lang.audio.localPlay.deletedTitle,
            lang.audio.localPlay.deletedSuccess({ name })
        ));
    },

    sendError(interaction, message) {
        const card = cards.error(
            lang.audio.localPlay.title,
            message
        );
        return sendV2(interaction, card);
    }
};