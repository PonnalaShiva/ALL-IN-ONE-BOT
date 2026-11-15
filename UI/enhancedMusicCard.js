const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { fontRegister } = require("./fonts/fontRegister");
const axios = require("axios");

const THEME = {
    cardA: "#f6f4ef",
    cardB: "#ece8e3",
    cardBorder: "rgba(255, 255, 255, 0.70)",
    cardInnerBorder: "rgba(0, 0, 0, 0.06)",
    cardEdge: "rgba(0, 0, 0, 0.20)",
    title: "#161616",
    artist: "#2e2e2e",
    requester: "#5f5f5f",
    rail: "rgba(0, 0, 0, 0.14)",
    fill: "#111111",
    knob: "#111111",
};

function tryExtractYouTubeId(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
        if (u.hostname === "youtu.be") return u.pathname.slice(1);
    } catch (_) {
        if (/^[\w-]{11}$/.test(url)) return url;
    }
    return null;
}

async function fetchImageBuffer(url, timeout = 2500) {
    try {
        const resp = await axios.get(url, {
            responseType: "arraybuffer",
            timeout,
            maxContentLength: 5 * 1024 * 1024,
            headers: { "User-Agent": "Mozilla/5.0" },
            validateStatus: (status) => status >= 200 && status < 400,
        });
        return Buffer.from(resp.data);
    } catch (_) {
        return null;
    }
}

async function getYouTubeThumbnail(videoId) {
    if (!videoId) return null;
    const candidates = [
        `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`,
        `https://i.ytimg.com/vi_webp/${videoId}/hqdefault.webp`,
        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    ];
    for (const url of candidates) {
        const buffer = await fetchImageBuffer(url);
        if (buffer && buffer.length > 5000) return buffer;
    }
    return null;
}

function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "0:00";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
}

class EnhancedMusicCard {
    async generateCard(options) {
        
        const config = {
            width: 900,
            height: 300,
            thumbnailURL: options.thumbnailURL || "",
            trackURI: options.trackURI || options.thumbnailURL || "",
            songTitle: options.songTitle || "Unknown Track",
            songArtist: options.songArtist || "Unknown Artist",
            songAlbum: options.songAlbum || "",
            trackRequester: options.trackRequester || "Unknown",
            isPlaying: options.isPlaying !== undefined ? options.isPlaying : true,
            volume: options.volume !== undefined ? options.volume : 100,
            quality: options.quality || "HD",
            platform: options.platform || "Lavalink",
            showVisualizer: options.showVisualizer !== undefined ? options.showVisualizer : true,
            showWatermark: options.showWatermark !== undefined ? options.showWatermark : true,
            currentPositionMs: Number.isFinite(options.currentPositionMs) ? options.currentPositionMs : 0,
            totalDurationMs: Number.isFinite(options.totalDurationMs) ? options.totalDurationMs : 0,
            customElements: options.customElements || [],
            fonts: options.fonts || null,
        };

        
        if (config.fonts) {
            for (const [name, fontPath] of Object.entries(config.fonts)) {
                try {
                    await fontRegister(fontPath, name);
                } catch (error) {
                    console.warn(`Failed to register font ${name}:`, error);
                }
            }
        }

        try {
            const canvas = createCanvas(config.width, config.height);
            const ctx = canvas.getContext("2d");

            const card = this.drawMainCard(ctx, config);
            const thumb = await this.drawThumbnail(ctx, config, card);
            this.drawTrackMeta(ctx, config, card, thumb);

            return canvas.toBuffer("image/png");
        } catch (_) {
            return this.generateErrorCard(config.width, config.height);
        }
    }

    drawMainCard(ctx, config) {
        const cardX = 22;
        const cardY = 22;
        const cardW = config.width - 44;
        const cardH = config.height - 44;
        const radius = 34;

        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.36)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 12;
        const base = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
        base.addColorStop(0, THEME.cardA);
        base.addColorStop(1, THEME.cardB);
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, radius);
        ctx.fill();
        ctx.restore();

        const glow = ctx.createRadialGradient(
            cardX + cardW * 0.45,
            cardY + cardH * 0.5,
            20,
            cardX + cardW * 0.45,
            cardY + cardH * 0.5,
            cardW * 0.65
        );
        glow.addColorStop(0, "rgba(255, 255, 255, 0.32)");
        glow.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, radius);
        ctx.fill();

        ctx.strokeStyle = THEME.cardBorder;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, radius);
        ctx.stroke();

        ctx.strokeStyle = THEME.cardEdge;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cardX - 1, cardY - 1, cardW + 2, cardH + 2, radius + 1);
        ctx.stroke();

        ctx.strokeStyle = THEME.cardInnerBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cardX + 3, cardY + 3, cardW - 6, cardH - 6, radius - 2);
        ctx.stroke();

        return { x: cardX, y: cardY, w: cardW, h: cardH };
    }

    async drawThumbnail(ctx, config, card) {
        const size = card.h - 32;
        const x = card.x + 16;
        const y = card.y + 16;
        const radius = 26;

        let buffer = null;
        const ytId = tryExtractYouTubeId(config.trackURI) || tryExtractYouTubeId(config.thumbnailURL);
        if (ytId) buffer = await getYouTubeThumbnail(ytId);

        if (!buffer && config.thumbnailURL && config.thumbnailURL.startsWith("http")) {
            const candidates = [config.thumbnailURL];
            if (ytId) {
                candidates.push(`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`);
                candidates.push(`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`);
            }
            for (const url of candidates) {
                buffer = await fetchImageBuffer(url);
                if (buffer && buffer.length > 5000) break;
            }
        }

        if (buffer && buffer.length > 5000) {
            try {
                const img = await loadImage(buffer);
                const srcW = img.width;
                const srcH = img.height;
                const scale = Math.max(size / srcW, size / srcH);
                const sw = Math.min(srcW, size / scale);
                const sh = Math.min(srcH, size / scale);
                const sx = Math.max(0, (srcW - sw) / 2);
                const sy = Math.max(0, (srcH - sh) / 2);

                ctx.save();
                ctx.beginPath();
                ctx.roundRect(x, y, size, size, radius);
                ctx.clip();
                ctx.drawImage(img, sx, sy, sw, sh, x, y, size, size);
                ctx.restore();

                ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(x, y, size, size, radius);
                ctx.stroke();

                return { x, y, size };
            } catch (_) {}
        }

        if (config.thumbnailURL && config.thumbnailURL.startsWith("http")) {
            try {
                const img = await loadImage(config.thumbnailURL);
                const srcW = img.width;
                const srcH = img.height;
                const scale = Math.max(size / srcW, size / srcH);
                const sw = Math.min(srcW, size / scale);
                const sh = Math.min(srcH, size / scale);
                const sx = Math.max(0, (srcW - sw) / 2);
                const sy = Math.max(0, (srcH - sh) / 2);

                ctx.save();
                ctx.beginPath();
                ctx.roundRect(x, y, size, size, radius);
                ctx.clip();
                ctx.drawImage(img, sx, sy, sw, sh, x, y, size, size);
                ctx.restore();

                ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(x, y, size, size, radius);
                ctx.stroke();

                return { x, y, size };
            } catch (_) {}
        }

        ctx.fillStyle = "#101522";
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, radius);
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, radius);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.90)";
        const px = x + size * 0.42;
        const py = y + size * 0.34;
        const pz = size * 0.28;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + pz);
        ctx.lineTo(px + pz * 0.85, py + pz * 0.5);
        ctx.closePath();
        ctx.fill();

        return { x, y, size };
    }

    drawTrackMeta(ctx, config, card, thumb) {
        const textX = thumb.x + thumb.size + 34;
        const textRight = card.x + card.w - 34;
        const maxTextW = textRight - textX;

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        
        const badgeText = config.isPlaying ? "NOW PLAYING" : "PAUSED";
        const topBadgeY = card.y + 24;
        ctx.font = "700 14px Segoe UI, Arial, sans-serif";
        const topBadgePadX = 12;
        const topBadgeH = 22;
        const topBadgeW = ctx.measureText(badgeText).width + topBadgePadX * 2;
        const topBadgeGradient = ctx.createLinearGradient(textX, topBadgeY, textX + topBadgeW, topBadgeY + topBadgeH);
        topBadgeGradient.addColorStop(0, "#1f2937");
        topBadgeGradient.addColorStop(1, "#111827");
        ctx.fillStyle = topBadgeGradient;
        ctx.beginPath();
        ctx.roundRect(textX, topBadgeY, topBadgeW, topBadgeH, 11);
        ctx.fill();
        ctx.fillStyle = "#f8fafc";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeText, textX + topBadgePadX, topBadgeY + topBadgeH / 2 + 0.5);
        ctx.textBaseline = "alphabetic";

        const titleY = topBadgeY + 62;
        ctx.fillStyle = THEME.title;
        ctx.font = "700 34px Segoe UI, Arial, sans-serif";
        const title = this.truncateText(ctx, config.songTitle, maxTextW);
        ctx.fillText(title, textX, titleY);

        const artistY = titleY + 44;
        const artistBadgeSize = 18;
        ctx.fillStyle = "#161616";
        ctx.beginPath();
        ctx.roundRect(textX, artistY - 14, artistBadgeSize, artistBadgeSize, 5);
        ctx.fill();
        ctx.fillStyle = "#f5f5f5";
        ctx.font = "700 12px Segoe UI, Arial, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText("S", textX + 5, artistY - 5);
        ctx.textBaseline = "alphabetic";

        ctx.fillStyle = THEME.artist;
        ctx.font = "600 24px Segoe UI, Arial, sans-serif";
        const artist = this.truncateText(ctx, config.songArtist, maxTextW - 30);
        ctx.fillText(artist, textX + 28, artistY);

        if (config.trackRequester && config.trackRequester !== "Unknown") {
            ctx.fillStyle = THEME.requester;
            ctx.font = "500 17px Segoe UI, Arial, sans-serif";
            const req = this.truncateText(ctx, `Requested by ${config.trackRequester}`, maxTextW);
            ctx.fillText(req, textX, artistY + 34);
        }

        const totalText = config.totalDurationMs > 0 ? formatDuration(config.totalDurationMs) : "LIVE";
        const progress = config.totalDurationMs > 0
            ? clamp(config.currentPositionMs / config.totalDurationMs, 0, 1)
            : 0;
        const visibleProgress = progress > 0 ? Math.max(progress, 0.08) : 0.18;

        const bottomY = card.y + card.h - 28;
        const cx = textX + 10;
        const cy = bottomY - 4;
        const r = 10;

        
        ctx.lineWidth = 4;
        ctx.strokeStyle = THEME.rail;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        const ringGradient = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        ringGradient.addColorStop(0, "#111111");
        ringGradient.addColorStop(0.5, "#1f1f1f");
        ringGradient.addColorStop(1, "#3b3b3b");
        ctx.strokeStyle = ringGradient;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * visibleProgress);
        ctx.stroke();

        
        const centerGradient = ctx.createRadialGradient(cx, cy, 1, cx, cy, 5);
        centerGradient.addColorStop(0, "rgba(17, 17, 17, 0.95)");
        centerGradient.addColorStop(1, "rgba(17, 17, 17, 0.70)");
        ctx.fillStyle = centerGradient;
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();

        
        ctx.font = "500 20px Segoe UI, Arial, sans-serif";
        const totalW = ctx.measureText(totalText).width;
        const timeChipPadX = 12;
        const timeChipH = 30;
        const clockSize = 12;
        const timeChipW = totalW + timeChipPadX * 2 + clockSize + 8;
        const timeChipX = textRight - timeChipW;
        const timeChipY = cy - timeChipH / 2;

        const chipGradient = ctx.createLinearGradient(timeChipX, timeChipY, timeChipX + timeChipW, timeChipY + timeChipH);
        chipGradient.addColorStop(0, "rgba(230, 226, 219, 0.92)");
        chipGradient.addColorStop(1, "rgba(214, 209, 201, 0.92)");
        ctx.fillStyle = chipGradient;
        ctx.beginPath();
        ctx.roundRect(timeChipX, timeChipY, timeChipW, timeChipH, 15);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.10)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(timeChipX, timeChipY, timeChipW, timeChipH, 15);
        ctx.stroke();

        
        const clockX = timeChipX + timeChipPadX + clockSize / 2;
        const clockY = cy;
        const clockGradient = ctx.createLinearGradient(clockX - 6, clockY - 6, clockX + 6, clockY + 6);
        clockGradient.addColorStop(0, "#111111");
        clockGradient.addColorStop(1, "#3a3a3a");
        ctx.strokeStyle = clockGradient;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(clockX, clockY, clockSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(clockX, clockY);
        ctx.lineTo(clockX, clockY - 3.2);
        ctx.moveTo(clockX, clockY);
        ctx.lineTo(clockX + 2.8, clockY + 1.8);
        ctx.stroke();

        ctx.fillStyle = THEME.artist;
        ctx.textBaseline = "middle";
        ctx.fillText(totalText, timeChipX + timeChipPadX + clockSize + 8, cy);
    }

    truncateText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let out = text;
        while (out.length > 0 && ctx.measureText(`${out}...`).width > maxWidth) {
            out = out.slice(0, -1);
        }
        return `${out}...`;
    }

    generateErrorCard(width, height) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#1c1c1c";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "700 28px Arial";
        ctx.fillText("Music card render failed", width / 2, height / 2);
        return canvas.toBuffer("image/png");
    }
}

module.exports = { EnhancedMusicCard };