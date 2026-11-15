const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { fontRegister } = require("./fonts/fontRegister");

class BirthdayCardGenerator {
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
            hero: { size: 54, weight: '800', lineHeight: 1.1 },
            primary: { size: 42, weight: '700', lineHeight: 1.2 },
            secondary: { size: 28, weight: '600', lineHeight: 1.3 },
            body: { size: 18, weight: '500', lineHeight: 1.5 },
            caption: { size: 14, weight: '400', lineHeight: 1.4 }
        };
    }

    async generateBirthdayCard(options) {
        const {
            username = 'Distinguished Individual',
            age = null,
            avatarURL = null,
            customMessage = null,
            requesterName = 'Your Elite Team',
            width = 1200,
            height = 600,
            fontPath = null,
            title = null
        } = options;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        try {
            if (fontPath) {
                await fontRegister(fontPath, "CustomFont");
            }

            this.drawBackground(ctx, width, height);
            this.drawAccents(ctx, width, height);
            
            if (avatarURL) {
                await this.drawAvatar(ctx, avatarURL, width, height);
            }
            
            this.drawMainContent(ctx, username, age, title, width, height, fontPath);
            
            if (customMessage) {
                this.drawMessage(ctx, customMessage, width, height, fontPath);
            }
            
            this.drawSignature(ctx, requesterName, width, height, fontPath);
            this.drawBorder(ctx, width, height);

            return canvas.toBuffer("image/png");
        } catch (error) {
            console.error('Card generation error:', error);
            return await this.generateFallback(username, age, width, height);
        }
    }

    drawBackground(ctx, width, height) {
        
        const gradient = ctx.createRadialGradient(width * 0.3, height * 0.4, 0, width * 0.7, height * 0.8, width);
        gradient.addColorStop(0, this.theme.gradient[0]);
        gradient.addColorStop(0.5, this.theme.gradient[1]);
        gradient.addColorStop(1, this.theme.gradient[2]);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        
        ctx.save();
        ctx.globalAlpha = 0.02;
        ctx.fillStyle = this.theme.text;
        
        const size = 60;
        for (let x = 0; x < width; x += size) {
            for (let y = 0; y < height; y += size) {
                if ((x / size + y / size) % 2 === 0) {
                    ctx.fillRect(x, y, size/2, size/2);
                }
            }
        }
        ctx.restore();
    }

    drawAccents(ctx, width, height) {
        ctx.save();
        
        
        const leftGradient = ctx.createLinearGradient(0, 0, 12, height);
        leftGradient.addColorStop(0, this.theme.accentGradient[0]);
        leftGradient.addColorStop(0.5, this.theme.accentGradient[1]);
        leftGradient.addColorStop(1, this.theme.accentGradient[2]);
        
        ctx.fillStyle = leftGradient;
        ctx.fillRect(0, 0, 12, height);
        
        
        const topGradient = ctx.createLinearGradient(0, 0, width, 8);
        topGradient.addColorStop(0, this.theme.accentGradient[0]);
        topGradient.addColorStop(0.6, this.theme.accentGradient[1]);
        topGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = topGradient;
        ctx.fillRect(0, 0, width, 8);
        
        
        ctx.fillStyle = `${this.theme.highlight}15`;
        ctx.beginPath();
        ctx.moveTo(width - 250, 0);
        ctx.bezierCurveTo(width - 125, 0, width, 40, width, 160);
        ctx.lineTo(width, 0);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }

    async drawAvatar(ctx, avatarURL, width, height) {
        try {
            const avatar = await loadImage(avatarURL);
            const avatarSize = 220; 
            const avatarX = width - avatarSize - 60;
            const avatarY = 60;
            
            ctx.save();
            
            
            ctx.shadowColor = this.theme.highlight;
            ctx.shadowBlur = 25;
            
            
            const frameGradient = ctx.createRadialGradient(
                avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 - 15,
                avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 10
            );
            frameGradient.addColorStop(0, 'transparent');
            frameGradient.addColorStop(0.8, this.theme.accentGradient[0]);
            frameGradient.addColorStop(1, this.theme.accentGradient[2]);
            
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 8, 0, Math.PI * 2);
            ctx.fillStyle = frameGradient;
            ctx.fill();
            
            
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            
            ctx.restore();
        } catch (error) {
            console.warn('Avatar loading failed');
        }
    }

    drawMainContent(ctx, username, age, title, width, height, fontPath) {
        const leftMargin = 60;
        const startY = 120; 
        
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        
        const titleGradient = ctx.createLinearGradient(leftMargin, startY, leftMargin + 500, startY + 60);
        titleGradient.addColorStop(0, this.theme.text);
        titleGradient.addColorStop(0.7, this.theme.highlight);
        titleGradient.addColorStop(1, this.theme.text);
        
        ctx.fillStyle = titleGradient;
        ctx.font = fontPath ? 
            `${this.typography.hero.weight} ${this.typography.hero.size}px 'CustomFont'` :
            `${this.typography.hero.weight} ${this.typography.hero.size}px 'Segoe UI', 'Arial Black', sans-serif`;
        
        ctx.shadowColor = `${this.theme.highlight}60`;
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillText('BIRTHDAY', leftMargin, startY);
        ctx.fillText('CELEBRATION', leftMargin, startY + 70);
        
        
        const lineGradient = ctx.createLinearGradient(leftMargin, startY + 150, leftMargin + 400, startY + 150);
        lineGradient.addColorStop(0, this.theme.accentGradient[0]);
        lineGradient.addColorStop(0.5, this.theme.accentGradient[1]);
        lineGradient.addColorStop(1, 'transparent');
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = lineGradient;
        ctx.fillRect(leftMargin, startY + 150, 400, 4);
        
        
        ctx.fillStyle = this.theme.text;
        ctx.font = fontPath ? 
            `${this.typography.primary.weight} ${this.typography.primary.size}px 'CustomFont'` :
            `${this.typography.primary.weight} ${this.typography.primary.size}px 'Segoe UI', Arial, sans-serif`;
        
        const honorific = title || 'Dear';
        ctx.fillText(`${honorific} ${username}`, leftMargin, startY + 180);
        
        
        if (age) {
            ctx.fillStyle = this.theme.subText;
            ctx.font = fontPath ? 
                `${this.typography.body.weight} ${this.typography.body.size}px 'CustomFont'` :
                `${this.typography.body.weight} ${this.typography.body.size}px 'Segoe UI', Arial, sans-serif`;
            
            ctx.fillText(`Celebrating ${age} Years of Distinguished Excellence`, leftMargin, startY + 230);
        }
        
        
        this.drawDecorations(ctx, leftMargin, startY);
        
        ctx.restore();
    }

    drawDecorations(ctx, x, y) {
        ctx.save();
        
        
        const accentGradient = ctx.createLinearGradient(x - 40, y, x - 20, y + 40);
        accentGradient.addColorStop(0, this.theme.accentGradient[0]);
        accentGradient.addColorStop(1, this.theme.accentGradient[2]);
        
        ctx.fillStyle = accentGradient;
        ctx.save();
        ctx.translate(x - 30, y + 20);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
        
        
        ctx.strokeStyle = this.theme.highlight;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.theme.highlight;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x - 45, y);
        ctx.lineTo(x - 45, y + 280);
        ctx.stroke();
        
        ctx.restore();
    }

    drawMessage(ctx, message, width, height, fontPath) {
        const leftMargin = 60;
        const messageY = height - 140; 
        
        ctx.save();
        
        
        const containerGradient = ctx.createLinearGradient(leftMargin - 20, messageY - 30, leftMargin + 500, messageY + 30);
        containerGradient.addColorStop(0, `${this.theme.accent}25`);
        containerGradient.addColorStop(0.5, `${this.theme.highlight}10`);
        containerGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = containerGradient;
        ctx.fillRect(leftMargin - 20, messageY - 30, width - 400, 70);
        
        
        ctx.fillStyle = this.theme.text;
        ctx.font = fontPath ? 
            `${this.typography.body.weight} ${this.typography.body.size}px 'CustomFont'` :
            `${this.typography.body.weight} ${this.typography.body.size}px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        const lines = this.wrapText(ctx, message, width - 420);
        lines.forEach((line, index) => {
            ctx.fillText(line, leftMargin, messageY + (index * 22));
        });
        
        ctx.restore();
    }

    drawSignature(ctx, requesterName, width, height, fontPath) {
        ctx.save();
        
        
        ctx.fillStyle = this.theme.subText;
        ctx.font = fontPath ? 
            `${this.typography.caption.weight} ${this.typography.caption.size}px 'CustomFont'` :
            `${this.typography.caption.weight} ${this.typography.caption.size}px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        ctx.fillText(`With Distinguished Regards`, width - 60, height - 40);
        ctx.fillText(`${requesterName}`, width - 60, height - 20);
        
        
        const lineGradient = ctx.createLinearGradient(width - 250, height - 65, width - 60, height - 95); 
        lineGradient.addColorStop(0, 'transparent');
        lineGradient.addColorStop(0.4, this.theme.highlight);
        lineGradient.addColorStop(1, this.theme.accent);
        
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width - 250, height - 58);
        ctx.lineTo(width - 60, height - 58);
        ctx.stroke();
        
        ctx.restore();
    }

    drawBorder(ctx, width, height) {
        ctx.save();
        
        const borderGradient = ctx.createLinearGradient(0, 0, width, height);
        borderGradient.addColorStop(0, this.theme.highlight);
        borderGradient.addColorStop(0.5, this.theme.accent);
        borderGradient.addColorStop(1, this.theme.highlight);
        
        ctx.strokeStyle = borderGradient;
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, width - 4, height - 4);
        
        ctx.restore();
    }

    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
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
    }

    async generateFallback(username, age, width, height) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2);
        gradient.addColorStop(0, '#0a0a0a');
        gradient.addColorStop(1, '#2a2a2a');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BIRTHDAY CELEBRATION', width / 2, height / 2 - 30);
        
        ctx.font = '28px Arial';
        ctx.fillText(`Dear ${username}`, width / 2, height / 2 + 20);
        
        return canvas.toBuffer("image/png");
    }

    
    async generateCard(username, age = null, title = 'Dear', requester = 'Your Team', message = null, avatarURL = null) {
        return await this.generateBirthdayCard({
            username,
            age,
            title,
            requesterName: requester,
            customMessage: message || 'May your special day be filled with joy, laughter, and all your favorite things!',
            avatarURL,
            width: 1200,
            height: 600
        });
    }
}

module.exports = { BirthdayCardGenerator };
