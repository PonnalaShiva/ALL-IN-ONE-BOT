'use strict';

const MAX_EMOJI_BYTES = 512 * 1024;
const DOWNLOAD_TIMEOUT_MS = 8000;
const DISCORD_EMOJI_PATH = /^\/emojis\/\d+\.(?:png|gif)$/;

async function downloadDiscordEmoji(url, fetchImpl) {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'cdn.discordapp.com' || !DISCORD_EMOJI_PATH.test(parsedUrl.pathname)) {
        throw new TypeError('Emoji downloads must use a Discord CDN emoji URL.');
    }
    if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');

    const response = await fetchImpl(parsedUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Failed to download emoji: ${response.statusText || response.status}`);

    const declaredLength = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_EMOJI_BYTES) {
        await response.body?.cancel?.().catch?.(() => {});
        throw new RangeError('Emoji download exceeds the configured size limit.');
    }

    if (!response.body || typeof response.body[Symbol.asyncIterator] !== 'function') {
        throw new Error('Emoji download returned no readable body.');
    }

    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > MAX_EMOJI_BYTES) {
            await response.body.destroy?.();
            throw new RangeError('Emoji download exceeds the configured size limit.');
        }
        chunks.push(buffer);
    }
    return Buffer.concat(chunks, totalBytes);
}

module.exports = { downloadDiscordEmoji, MAX_EMOJI_BYTES, DOWNLOAD_TIMEOUT_MS };
