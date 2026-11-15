const { createCanvas, loadImage } = require("@napi-rs/canvas");
const path = require('path');

class ProfileCardGenerator {
    constructor() {
        this.theme = {
            primary: '#0a0a0a',
            secondary: '#1a1a1a',
            accent: '#2a2a2a',
            highlight: '#ff6b35',
            text: '#ffffff',
            subText: '#cccccc',
            gradient: ['#0a0a0a', '#1a1a1a', '#2a2a2a'],
            accentGradient: ['#ff6b35', '#ff8c42', '#ffa726']
        };

        this.typography = {
            hero: { size: 54, weight: '800' },
            primary: { size: 42, weight: '700' },
            secondary: { size: 28, weight: '600' },
            body: { size: 18, weight: '500' },
            caption: { size: 14, weight: '400' }
        };
    }

    
    getColor(colorPath, fallback = '#000000') {
        try {
            const pathParts = colorPath.split('.');
            let value = this.theme;
            
            for (const part of pathParts) {
                if (Array.isArray(value)) {
                    const index = parseInt(part);
                    value = value[index];
                } else {
                    value = value[part];
                }
                if (value === undefined || value === null) {
                    return fallback;
                }
            }
            
            return typeof value === 'string' ? value : fallback;
        } catch (error) {
            return fallback;
        }
    }

    async generateProfileCard(options) {
        const {
            username = 'Distinguished User',
            bio = null,
            avatarURL = null,
            customBannerURL = null,
            width = 1200,
            height = 600,
            fontPath = null
        } = options;

        
        const safeWidth = Number(width) || 1200;
        const safeHeight = Number(height) || 600;
        const safeUsername = String(username || 'User');

        const canvas = createCanvas(safeWidth, safeHeight);
        const ctx = canvas.getContext("2d");

        try {
            this.drawBackground(ctx, safeWidth, safeHeight);
            
            if (customBannerURL && typeof customBannerURL === 'string') {
                await this.drawCustomBanner(ctx, customBannerURL, safeWidth, safeHeight);
            }
            
            this.drawAccents(ctx, safeWidth, safeHeight);
            
            if (avatarURL && typeof avatarURL === 'string') {
                await this.drawAvatar(ctx, avatarURL, safeWidth, safeHeight);
            }
            
            this.drawMainContent(ctx, safeUsername, bio, safeWidth, safeHeight, fontPath);
            this.drawBorder(ctx, safeWidth, safeHeight);

            return canvas.toBuffer("image/png");
        } catch (error) {
            console.error('Profile card generation error:', error);
            return await this.generateFallback(safeUsername, safeWidth, safeHeight);
        }
    }

    drawBackground(ctx, width, height) {
        try {
            
            const color1 = this.getColor('gradient.0', '#0a0a0a');
            const color2 = this.getColor('gradient.1', '#1a1a1a');
            const color3 = this.getColor('gradient.2', '#2a2a2a');
            
            const gradient = ctx.createRadialGradient(
                width * 0.3, 
                height * 0.4, 
                0, 
                width * 0.7, 
                height * 0.8, 
                width
            );
            
            gradient.addColorStop(0, color1);
            gradient.addColorStop(0.5, color2);
            gradient.addColorStop(1, color3);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            
            ctx.save();
            ctx.globalAlpha = 0.02;
            ctx.fillStyle = this.getColor('text', '#ffffff');
            
            const size = 60;
            for (let x = 0; x < width; x += size) {
                for (let y = 0; y < height; y += size) {
                    if ((x / size + y / size) % 2 === 0) {
                        ctx.fillRect(x, y, size/2, size/2);
                    }
                }
            }
            ctx.restore();
        } catch (error) {
            console.error('Background drawing error:', error);
            
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);
        }
    }

    async drawCustomBanner(ctx, bannerURL, width, height) {
        try {
            const banner = await loadImage(bannerURL);
            
            ctx.save();
            
            
            const bannerAspectRatio = banner.width / banner.height;
            const availableWidth = width * 0.75;
            const availableHeight = height;
            
            let bannerWidth, bannerHeight;
            
            if (availableWidth / availableHeight > bannerAspectRatio) {
                bannerHeight = availableHeight;
                bannerWidth = bannerHeight * bannerAspectRatio;
            } else {
                bannerWidth = availableWidth;
                bannerHeight = bannerWidth / bannerAspectRatio;
            }
            
            const bannerX = width - bannerWidth;
            const bannerY = (height - bannerHeight) / 2;
            
            ctx.globalAlpha = 0.7;
            ctx.drawImage(banner, bannerX, bannerY, bannerWidth, bannerHeight);
            
            ctx.restore();
        } catch (error) {
            console.warn('Custom banner loading failed:', error);
        }
    }

    drawAccents(ctx, width, height) {
        try {
            ctx.save();
            
            
            const accent1 = this.getColor('accentGradient.0', '#ff6b35');
            const accent2 = this.getColor('accentGradient.1', '#ff8c42');
            const accent3 = this.getColor('accentGradient.2', '#ffa726');
            
            
            const leftGradient = ctx.createLinearGradient(0, 0, 12, height);
            leftGradient.addColorStop(0, accent1);
            leftGradient.addColorStop(0.5, accent2);
            leftGradient.addColorStop(1, accent3);
            
            ctx.fillStyle = leftGradient;
            ctx.fillRect(0, 0, 12, height);
            
            
            const topGradient = ctx.createLinearGradient(0, 0, width, 8);
            topGradient.addColorStop(0, accent1);
            topGradient.addColorStop(0.6, accent2);
            topGradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = topGradient;
            ctx.fillRect(0, 0, width, 8);
            
            ctx.restore();
        } catch (error) {
            console.error('Accent drawing error:', error);
        }
    }

    async drawAvatar(ctx, avatarURL, width, height) {
        try {
            const avatar = await loadImage(avatarURL);
            const avatarSize = 180;
            const avatarX = 60;
            const avatarY = 80;
            
            ctx.save();
            
            
            ctx.shadowColor = this.getColor('highlight', '#ff6b35');
            ctx.shadowBlur = 20;
            
            const frameGradient = ctx.createRadialGradient(
                avatarX + avatarSize/2, 
                avatarY + avatarSize/2, 
                avatarSize/2 - 10,
                avatarX + avatarSize/2, 
                avatarY + avatarSize/2, 
                avatarSize/2 + 8
            );
            frameGradient.addColorStop(0, 'transparent');
            frameGradient.addColorStop(0.8, this.getColor('accentGradient.0', '#ff6b35'));
            frameGradient.addColorStop(1, this.getColor('accentGradient.2', '#ffa726'));
            
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 6, 0, Math.PI * 2);
            ctx.fillStyle = frameGradient;
            ctx.fill();
            
            
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            
            ctx.restore();
        } catch (error) {
            console.warn('Avatar drawing failed:', error);
        }
    }

    drawMainContent(ctx, username, bio, width, height, fontPath) {
        try {
            const leftMargin = 60;
            const startY = 300;
            
            ctx.save();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            
            const titleGradient = ctx.createLinearGradient(leftMargin, startY, leftMargin + 500, startY + 60);
            titleGradient.addColorStop(0, this.getColor('text', '#ffffff'));
            titleGradient.addColorStop(0.7, this.getColor('highlight', '#ff6b35'));
            titleGradient.addColorStop(1, this.getColor('text', '#ffffff'));
            
            ctx.fillStyle = titleGradient;
            ctx.font = `800 54px 'Segoe UI', 'Arial Black', sans-serif`;
            
            ctx.shadowColor = this.getColor('highlight', '#ff6b35') + '60';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            ctx.fillText('PROFILE', leftMargin, startY);
            
            
            const lineGradient = ctx.createLinearGradient(leftMargin, startY + 70, leftMargin + 300, startY + 70);
            lineGradient.addColorStop(0, this.getColor('accentGradient.0', '#ff6b35'));
            lineGradient.addColorStop(0.5, this.getColor('accentGradient.1', '#ff8c42'));
            lineGradient.addColorStop(1, 'transparent');
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = lineGradient;
            ctx.fillRect(leftMargin, startY + 70, 300, 4);
            
            
            ctx.fillStyle = this.getColor('text', '#ffffff');
            ctx.font = '700 42px \'Segoe UI\', Arial, sans-serif';
            ctx.fillText(String(username), leftMargin, startY + 90);
        
            
            ctx.restore();
        } catch (error) {
            console.error('Main content drawing error:', error);
        }
    }

    drawBorder(ctx, width, height) {
        try {
            ctx.save();
            
            const borderGradient = ctx.createLinearGradient(0, 0, width, height);
            borderGradient.addColorStop(0, this.getColor('highlight', '#ff6b35'));
            borderGradient.addColorStop(0.5, this.getColor('accent', '#2a2a2a'));
            borderGradient.addColorStop(1, this.getColor('highlight', '#ff6b35'));
            
            ctx.strokeStyle = borderGradient;
            ctx.lineWidth = 3;
            ctx.strokeRect(2, 2, width - 4, height - 4);
            
            ctx.restore();
        } catch (error) {
            console.error('Border drawing error:', error);
        }
    }

    wrapText(ctx, text, maxWidth) {
        try {
            const words = String(text).split(' ');
            const lines = [];
            let currentLine = words[0] || '';

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine + ' ' + word;
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width > maxWidth) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            lines.push(currentLine);
            return lines;
        } catch (error) {
            return [String(text)];
        }
    }

    async generateFallback(username, width, height) {
        try {
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext("2d");
            
            
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 42px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PROFILE', width / 2, height / 2 - 30);
            
            ctx.font = '28px Arial';
            ctx.fillText(String(username), width / 2, height / 2 + 20);
            
            return canvas.toBuffer("image/png");
        } catch (error) {
            console.error('Fallback generation failed:', error);
            
            const canvas = createCanvas(800, 400);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 800, 400);
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Profile Generation Failed', 400, 200);
            return canvas.toBuffer("image/png");
        }
    }

    async generateCard(username, bio = null, avatarURL = null, customBannerURL = null, platformCount = 0, requester = '') {
        return await this.generateProfileCard({
            username: username || 'User',
            bio,
            avatarURL,
            customBannerURL,
            width: 1200,
            height: 600
        });
    }
}

module.exports = { ProfileCardGenerator };
