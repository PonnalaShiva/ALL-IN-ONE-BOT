


'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildCard, cards, linkBtn, buttonRow, sendV2, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');
const { getButtonEmoji } = require('../../UI/emojis/emoji');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    audio: {
        ...rawLang.audio,
        common: createInterpolatableProxy(rawLang.audio?.common),
        lyrics: createInterpolatableProxy(rawLang.audio?.lyrics)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('song-lyrics')
        .setDescription('Search and get song lyrics')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('Song name or artist (e.g., "shape of you" or "Ed Sheeran")')
                .setRequired(true)),

    async execute(interaction) {
        await deferReply(interaction);

        const query = interaction.options.getString('query');

        try {
            const lrclibBase = (process.env.LRCLIB_API_URL || 'https://lrclib.net').replace(/\/+$/, '');
            const searchUrl = `${lrclibBase}/api/search?q=${encodeURIComponent(query)}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            let searchResponse;
            try {
                searchResponse = await fetch(searchUrl, { signal: controller.signal });
            } finally {
                clearTimeout(timeout);
            }

            if (!searchResponse.ok) {
                return this.sendError(interaction, lang.audio.lyrics.serviceUnavailable);
            }

            const searchResults = await searchResponse.json();

            if (!searchResults || searchResults.length === 0) {
                return this.sendNotFound(interaction, query);
            }

            const song = searchResults[0];

            if (song.instrumental) {
                return this.sendInstrumental(interaction, song);
            }

            if (!song.plainLyrics && !song.syncedLyrics) {
                return this.sendNotFound(interaction, query);
            }

            const lyrics = (song.plainLyrics || song.syncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2}\] /g, '')).trim();

            const trackInfo = lang.audio.lyrics.trackDetails({
                artist: song.artistName,
                album: song.albumName || 'Unknown',
                duration: this.formatDuration(song.duration)
            });

            const buttons = buttonRow(
                linkBtn(
                    lang.audio.lyrics.geniusButton,
                    getButtonEmoji('music'),
                    `https://genius.com/search?q=${encodeURIComponent(song.trackName + ' ' + song.artistName)}`
                ),
                linkBtn(
                    lang.audio.lyrics.googleButton,
                    getButtonEmoji('search'),
                    `https://www.google.com/search?q=${encodeURIComponent(song.trackName + ' ' + song.artistName + ' lyrics')}`
                )
            );

            const chunks = this.chunkLyrics(lyrics, 3500);

            const primaryCard = buildCard({ accent: ACCENT.success })
                .addText(`**${lang.audio.lyrics.nowPlayingTitle({ track: song.trackName })}**`)
                .addSeparator()
                .addText(trackInfo)
                .addSeparator()
                .addText(chunks[0]);

            if (chunks.length > 2) {
                primaryCard.addSeparator().addText(lang.audio.lyrics.truncated);
            }

            await sendV2(interaction, [primaryCard, buttons]);

            if (chunks.length > 1) {
                const followUpCard = buildCard({ accent: ACCENT.success })
                    .addText(`**${lang.audio.lyrics.partHeader({ current: 2, max: Math.min(chunks.length, 2) })}**`)
                    .addSeparator()
                    .addText(chunks[1]);

                if (chunks.length > 2) {
                    followUpCard.addSeparator().addText(lang.audio.lyrics.truncated);
                }

                await interaction.followUp({
                    components: [followUpCard],
                    flags: MessageFlags.IsComponentsV2
                });
            }

        } catch (error) {
            console.error('[Lyrics Error]', error);
            return this.sendError(interaction, lang.audio.lyrics.failed);
        }
    },

    chunkLyrics(text, maxLength) {
        const lines = text.split('\n');
        const chunks = [];
        let currentChunk = '';

        for (const line of lines) {
            if ((currentChunk + line + '\n').length > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = line + '\n';
            } else {
                currentChunk += line + '\n';
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    },

    sendInstrumental(interaction, song) {
        const card = buildCard({ accent: ACCENT.primary })
            .addText(`**${lang.audio.lyrics.instrumentalTitle}**`)
            .addSeparator()
            .addText(`**${song.trackName}**`)
            .addSeparator()
            .addText(lang.audio.lyrics.instrumental({
                artist: song.artistName,
                album: song.albumName || 'Unknown',
                duration: this.formatDuration(song.duration)
            }));

        return sendV2(interaction, card);
    },

    sendNotFound(interaction, query) {
        const card = buildCard({ accent: ACCENT.danger })
            .addText(`**${lang.audio.lyrics.notFoundTitle}**`)
            .addSeparator()
            .addText(lang.audio.lyrics.notFound({ query }));

        const buttons = buttonRow(
            linkBtn(
                lang.audio.lyrics.searchGoogleButton,
                getButtonEmoji('search'),
                `https://www.google.com/search?q=${encodeURIComponent(query + ' lyrics')}`
            ),
            linkBtn(
                lang.audio.lyrics.searchGeniusButton,
                getButtonEmoji('music'),
                `https://genius.com/search?q=${encodeURIComponent(query)}`
            )
        );

        return sendV2(interaction, [card, buttons]);
    },

    formatDuration(seconds) {
        if (!seconds) return 'Unknown';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${String(secs).padStart(2, '0')}`;
    },

    sendError(interaction, message) {
        const card = cards.error(
            lang.audio.lyrics.title,
            message
        );
        return sendV2(interaction, card);
    }
};