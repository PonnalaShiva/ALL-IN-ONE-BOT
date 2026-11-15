
const { createCanvas, loadImage } = require("@napi-rs/canvas");

class RankCardGenerator {
    constructor() {
        this.themes = {
            default: {
                primary: '#0a0b1e',
                secondary: '#1a1d3a',
                accent: '#3b82f6',
                text: '#ffffff',
                subText: '#94a3b8',
                background: ['#0a0b1e', '#1a1d3a', '#2d3748'],
                glow: '#3b82f6',
                particles: '#60a5fa',
                border: '#3b82f6',
                neonPrimary: '#00d4ff',
                neonSecondary: '#ff6b9d'
            },
            dark: {
                primary: '#0a0a0a',
                secondary: '#1a1a1a',
                accent: '#ff6b35',
                text: '#ffffff',
                subText: '#cccccc',
                background: ['#000000', '#111111', '#222222'],
                glow: '#ff6b35',
                particles: '#ff8c42',
                border: '#ff6b35',
                neonPrimary: '#ff6b35',
                neonSecondary: '#ffaa00'
            },
            neon: {
                primary: '#0f0f23',
                secondary: '#1a1a3e',
                accent: '#ff00ff',
                text: '#00ffff',
                subText: '#ff00ff',
                background: ['#0f0f23', '#1a1a3e', '#2d2d5e'],
                glow: '#00ffff',
                particles: '#ff00ff',
                border: '#00ffff',
                neonPrimary: '#00ffff',
                neonSecondary: '#ff00ff'
            },
            minimal: {
                primary: '#f8fafc',
                secondary: '#e2e8f0',
                accent: '#64748b',
                text: '#0f172a',
                subText: '#475569',
                background: ['#ffffff', '#f8fafc', '#f1f5f9'],
                glow: '#3b82f6',
                particles: '#94a3b8',
                border: '#cbd5e1',
                neonPrimary: '#3b82f6',
                neonSecondary: '#8b5cf6'
            },
            gaming: {
                primary: '#0d1117',
                secondary: '#161b22',
                accent: '#f85149',
                text: '#f0f6fc',
                subText: '#8b949e',
                background: ['#0d1117', '#161b22', '#21262d'],
                glow: '#f85149',
                particles: '#ff7b72',
                border: '#f85149',
                neonPrimary: '#f85149',
                neonSecondary: '#ffa657'
            }
        };
    }

    async generateRankCard(options) {
        const {
            username,
            discriminator,
            avatarURL,
            level,
            currentXP,
            requiredXP,
            totalXP,
            rank,
            theme = 'neon',
            customBackground = null,
            badge = null,
            width = 1200,
            height = 400
        } = options;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        const selectedTheme = this.themes[theme] || this.themes.neon;

        try {
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            
            await this.drawFuturisticBackground(ctx, width, height, selectedTheme, customBackground);
            
            
            this.drawNeonGrid(ctx, width, height, selectedTheme);
            
            
            this.drawEnhancedParticles(ctx, width, height, selectedTheme);
            
            
            if (avatarURL) {
                await this.drawHolographicAvatar(ctx, avatarURL, selectedTheme);
            }
            
            
            this.drawFuturisticUserInfo(ctx, username, discriminator, selectedTheme, width);
            
            
            this.drawEnhancedLevelDisplay(ctx, level, rank, selectedTheme, width);
            
            
            this.drawFuturisticXPBar(ctx, currentXP, requiredXP, selectedTheme, width, height);
            
            
            this.drawHolographicStatsPanel(ctx, totalXP, currentXP, requiredXP, selectedTheme, width, height);
            
            
            if (badge) {
                await this.drawHolographicBadge(ctx, badge, selectedTheme, width);
            }
            
            
            this.addFuturisticUIElements(ctx, selectedTheme, width, height);
            
            
            this.drawNeonBorderWithScanlines(ctx, selectedTheme, width, height);

            return canvas.toBuffer("image/png");
        } catch (error) {
            console.error('Futuristic rank card generation error:', error);
            return await this.generateFallback(username, level, rank, width, height);
        }
    }

    async drawFuturisticBackground(ctx, width, height, theme, customBg) {
        
        const spaceGradient = ctx.createRadialGradient(
            width * 0.3, height * 0.2, 0,
            width * 0.7, height * 0.8, Math.max(width, height)
        );
        spaceGradient.addColorStop(0, theme.background[0]);
        spaceGradient.addColorStop(0.4, theme.background[1]);
        spaceGradient.addColorStop(0.8, theme.background[2]);
        spaceGradient.addColorStop(1, theme.background[0]);
        
        ctx.fillStyle = spaceGradient;
        ctx.fillRect(0, 0, width, height);

        
        this.drawNebula(ctx, width, height, theme);
        
        
        this.drawCircuitPattern(ctx, width, height, theme);

        
        if (customBg) {
            try {
                const bg = await loadImage(customBg);
                ctx.save();
                ctx.globalAlpha = 0.2;
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(bg, 0, 0, width, height);
                ctx.restore();
            } catch (error) {
                console.warn('Custom background failed, using default');
            }
        }
    }

    drawNebula(ctx, width, height, theme) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.globalCompositeOperation = 'screen';

        
        const nebulaCount = 5;
        for (let i = 0; i < nebulaCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = 100 + Math.random() * 150;
            
            const nebula = ctx.createRadialGradient(x, y, 0, x, y, radius);
            nebula.addColorStop(0, theme.neonPrimary + '60');
            nebula.addColorStop(0.5, theme.neonSecondary + '30');
            nebula.addColorStop(1, 'transparent');
            
            ctx.fillStyle = nebula;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawCircuitPattern(ctx, width, height, theme) {
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = theme.neonPrimary;
        ctx.lineWidth = 1;

        const spacing = 60;
        
        
        for (let y = 0; y < height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        
        for (let x = 0; x < width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        
        ctx.fillStyle = theme.neonSecondary;
        for (let x = spacing; x < width; x += spacing) {
            for (let y = spacing; y < height; y += spacing) {
                if (Math.random() > 0.7) {
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }

    drawNeonGrid(ctx, width, height, theme) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = theme.glow;
        ctx.lineWidth = 0.5;

        const gridSize = 25;
        
        
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        
        ctx.fillStyle = theme.glow + '80';
        for (let x = 0; x <= width; x += gridSize) {
            for (let y = 0; y <= height; y += gridSize) {
                if (Math.random() > 0.95) {
                    ctx.save();
                    ctx.shadowColor = theme.glow;
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }
        }
        ctx.restore();
    }

    drawEnhancedParticles(ctx, width, height, theme) {
        ctx.save();
        const particleCount = 40;
        
        for (let i = 0; i < particleCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 2 + 0.5;
            const alpha = Math.random() * 0.8 + 0.2;
            
            
            const color = i % 2 === 0 ? theme.neonPrimary : theme.neonSecondary;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.shadowColor = color;
            ctx.shadowBlur = size * 4;
            ctx.fillStyle = color;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    async drawHolographicAvatar(ctx, avatarURL, theme) {
        try {
            const avatar = await loadImage(avatarURL);
            const size = 140;
            const x = 50;
            const y = (400 - size) / 2;

            
            this.drawHolographicFrame(ctx, x, y, size, theme);
            
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/2 - 8, 0, Math.PI * 2);
            ctx.clip();
            
            
            ctx.drawImage(avatar, x + 8, y + 8, size - 16, size - 16);
            
            
            const hologramGradient = ctx.createLinearGradient(x, y, x + size, y + size);
            hologramGradient.addColorStop(0, theme.neonPrimary + '20');
            hologramGradient.addColorStop(0.5, 'transparent');
            hologramGradient.addColorStop(1, theme.neonSecondary + '20');
            
            ctx.fillStyle = hologramGradient;
            ctx.fillRect(x, y, size, size);
            
            
            ctx.globalCompositeOperation = 'screen';
            ctx.strokeStyle = theme.neonPrimary + '30';
            ctx.lineWidth = 1;
            
            for (let i = y; i < y + size; i += 4) {
                ctx.beginPath();
                ctx.moveTo(x, i);
                ctx.lineTo(x + size, i);
                ctx.stroke();
            }
            
            ctx.restore();
            
        } catch (error) {
            console.warn('Avatar loading failed:', error);
            this.drawFallbackHolographicAvatar(ctx, theme, 50, 130, 140);
        }
    }

    drawHolographicFrame(ctx, x, y, size, theme) {
        const centerX = x + size/2;
        const centerY = y + size/2;
        
        
        ctx.save();
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 25;
        
        const outerGradient = ctx.createRadialGradient(
            centerX, centerY, size/2 + 5,
            centerX, centerY, size/2 + 20
        );
        outerGradient.addColorStop(0, theme.neonPrimary + '80');
        outerGradient.addColorStop(1, 'transparent');
        
        ctx.strokeStyle = outerGradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, size/2 + 12, 0, Math.PI * 2);
        ctx.stroke();
        
        
        ctx.shadowBlur = 15;
        ctx.strokeStyle = theme.neonSecondary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, size/2 + 5, 0, Math.PI * 2);
        ctx.stroke();
        
        
        ctx.shadowBlur = 10;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const startRadius = size/2 + 8;
            const endRadius = size/2 + 18;
            
            const startX = centerX + Math.cos(angle) * startRadius;
            const startY = centerY + Math.sin(angle) * startRadius;
            const endX = centerX + Math.cos(angle) * endRadius;
            const endY = centerY + Math.sin(angle) * endRadius;
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    drawFallbackHolographicAvatar(ctx, theme, x, y, size) {
        ctx.save();
        
        
        const gradient = ctx.createRadialGradient(x + size/2, y + size/2, 0, x + size/2, y + size/2, size/2);
        gradient.addColorStop(0, theme.neonPrimary + '60');
        gradient.addColorStop(1, theme.neonSecondary + '40');
        
        ctx.fillStyle = gradient;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
        ctx.fill();
        
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = theme.text;
        ctx.font = `${size/2.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◉', x + size/2, y + size/2);
        
        ctx.restore();
    }

    drawFuturisticUserInfo(ctx, username, rank, theme, width) {
        ctx.save();
        
        
        const textX = 220;
        const textY = 120;
        
        
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillText(username, textX - 2, textY + 2);
        ctx.restore();
        
        
        const usernameGradient = ctx.createLinearGradient(textX, textY - 20, textX + 400, textY + 20);
        usernameGradient.addColorStop(0, theme.neonPrimary);
        usernameGradient.addColorStop(0.5, theme.text);
        usernameGradient.addColorStop(1, theme.neonSecondary);
        
        ctx.fillStyle = usernameGradient;
        ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 15;
        ctx.fillText(username, textX +10, textY + 35);
        
        
        ctx.shadowBlur = 8;
        ctx.fillStyle = theme.subText;
        ctx.font = '16px "Segoe UI", Arial, monospace';

        this.drawTechLine(ctx, textX, textY + 120, 300, theme);
        
        ctx.restore();
    }

    drawTechLine(ctx, x, y, width, theme) {
        ctx.save();
        
        
        const lineGradient = ctx.createLinearGradient(x, y, x + width, y);
        lineGradient.addColorStop(0, theme.neonPrimary);
        lineGradient.addColorStop(0.5, theme.glow);
        lineGradient.addColorStop(1, 'transparent');
        
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 2;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y);
        ctx.stroke();
        
        
        const segments = 5;
        const segmentWidth = width / segments;
        
        ctx.shadowBlur = 4;
        for (let i = 0; i < segments; i++) {
            const segX = x + i * segmentWidth;
            ctx.beginPath();
            ctx.moveTo(segX, y - 3);
            ctx.lineTo(segX, y + 3);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    drawEnhancedLevelDisplay(ctx, level, rank, theme, width) {
        const panelX = width - 250;
        const panelY = 40;
        const panelWidth = 200;
        const panelHeight = 80;
        
        
        this.drawHolographicPanel(ctx, panelX, panelY, panelWidth, panelHeight, theme);
        
        ctx.save();
        
        
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 20;
        ctx.fillStyle = theme.neonPrimary;
        ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`LEVEL`, panelX + 120, panelY + 12);
        
        
        ctx.shadowBlur = 25;
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
        ctx.fillText(level.toString(), panelX + 120, panelY + 40);
        
        
        ctx.shadowBlur = 10;
        ctx.fillStyle = theme.subText;
        ctx.font = '16px "Segoe UI", Arial, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`RANK #${rank}`, width - 900, panelY + panelHeight + 82);
        
        
        this.drawCornerDecorations(ctx, panelX, panelY, panelWidth, panelHeight, theme);
        
        ctx.restore();
    }

    drawHolographicPanel(ctx, x, y, width, height, theme) {
        ctx.save();
        
        
        const panelGradient = ctx.createLinearGradient(x, y, x + width, y + height);
        panelGradient.addColorStop(0, theme.primary + '80');
        panelGradient.addColorStop(0.5, theme.secondary + '60');
        panelGradient.addColorStop(1, theme.primary + '80');
        
        ctx.fillStyle = panelGradient;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 20;
        
        this.drawTechRect(ctx, x, y, width, height, 12);
        ctx.fill();
        
        
        ctx.shadowBlur = 15;
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 2;
        this.drawTechRect(ctx, x, y, width, height, 12);
        ctx.stroke();
        
        
        ctx.shadowBlur = 8;
        ctx.strokeStyle = theme.neonPrimary + '60';
        ctx.lineWidth = 1;
        this.drawTechRect(ctx, x + 2, y + 2, width - 4, height - 4, 10);
        ctx.stroke();
        
        ctx.restore();
    }

    drawCornerDecorations(ctx, x, y, width, height, theme) {
        ctx.save();
        ctx.strokeStyle = theme.neonSecondary;
        ctx.lineWidth = 2;
        ctx.shadowColor = theme.neonSecondary;
        ctx.shadowBlur = 8;
        
        const cornerSize = 12;
        
        
        ctx.beginPath();
        ctx.moveTo(x - 5, y + cornerSize);
        ctx.lineTo(x - 5, y - 5);
        ctx.lineTo(x + cornerSize, y - 5);
        ctx.stroke();
        
        
        ctx.beginPath();
        ctx.moveTo(x + width - cornerSize, y - 5);
        ctx.lineTo(x + width + 5, y - 5);
        ctx.lineTo(x + width + 5, y + cornerSize);
        ctx.stroke();
        
        
        ctx.beginPath();
        ctx.moveTo(x + width + 5, y + height - cornerSize);
        ctx.lineTo(x + width + 5, y + height + 5);
        ctx.lineTo(x + width - cornerSize, y + height + 5);
        ctx.stroke();
        
        
        ctx.beginPath();
        ctx.moveTo(x + cornerSize, y + height + 5);
        ctx.lineTo(x - 5, y + height + 5);
        ctx.lineTo(x - 5, y + height - cornerSize);
        ctx.stroke();
        
        ctx.restore();
    }

    drawFuturisticXPBar(ctx, currentXP, requiredXP, theme, width, height) {
        const barWidth = width - 500;
        const barHeight = 25;
        const barX = 220;
        const barY = height - 100;
        const progress = Math.min(currentXP / requiredXP, 1);

        ctx.save();
        
        
        this.drawHolographicPanel(ctx, barX - 5, barY - 5, barWidth + 10, barHeight + 10, theme);
        
        
        ctx.fillStyle = theme.secondary;
        this.drawTechRect(ctx, barX, barY, barWidth, barHeight, 8);
        ctx.fill();
        
        
        if (progress > 0) {
            const progressWidth = barWidth * progress;
            
            
            const progressGradient = ctx.createLinearGradient(barX, barY, barX + progressWidth, barY);
            progressGradient.addColorStop(0, theme.neonPrimary);
            progressGradient.addColorStop(0.5, theme.glow);
            progressGradient.addColorStop(1, theme.neonSecondary);
            
            ctx.fillStyle = progressGradient;
            ctx.shadowColor = theme.glow;
            ctx.shadowBlur = 15;
            
            this.drawTechRect(ctx, barX, barY, progressWidth, barHeight, 8);
            ctx.fill();
            
            
            const sweepGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
            sweepGradient.addColorStop(0, 'rgba(255,255,255,0.6)');
            sweepGradient.addColorStop(0.3, 'rgba(255,255,255,0.3)');
            sweepGradient.addColorStop(1, 'transparent');
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = sweepGradient;
            this.drawTechRect(ctx, barX, barY, progressWidth, barHeight/2, 8);
            ctx.fill();
        }
        
        
        this.drawHolographicText(ctx, `${currentXP.toLocaleString()} / ${requiredXP.toLocaleString()} XP`, 
                                barX + barWidth/2, barY + barHeight/2, theme, '14px');
        
        
        const percentage = Math.round(progress * 100);
        this.drawHolographicText(ctx, `${percentage}%`, barX + barWidth + 25, barY + barHeight/2, theme, '12px');
        
        ctx.restore();
    }

    drawHolographicText(ctx, text, x, y, theme, fontSize = '16px') {
        ctx.save();
        
        
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = theme.neonSecondary;
        ctx.font = `bold ${fontSize} "Segoe UI", Arial, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 1, y - 1);
        
        ctx.fillStyle = theme.neonPrimary;
        ctx.fillText(text, x - 1, y + 1);
        ctx.restore();
        
        
        ctx.fillStyle = theme.text;
        ctx.font = `bold ${fontSize} "Segoe UI", Arial, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 10;
        ctx.fillText(text, x, y);
        
        ctx.restore();
    }

    drawHolographicStatsPanel(ctx, totalXP, currentXP, requiredXP, theme, width, height) {
        const panelX = width - 220;
        const panelY = height - 140;
        const panelWidth = 180;
        const panelHeight = 100;
        
        
        this.drawHolographicPanel(ctx, panelX, panelY, panelWidth, panelHeight, theme);
        
        const stats = [
            { label: 'TOTAL XP', value: totalXP.toLocaleString() },
            { label: 'REMAINING', value: (requiredXP - currentXP).toLocaleString()},
            { label: 'EFFICIENCY', value: `${Math.round((currentXP / requiredXP) * 100)}%`}
        ];
        
        ctx.save();
        
        stats.forEach((stat, index) => {
            const statY = panelY + 25 + (index * 30);

            ctx.shadowBlur = 20;
            ctx.fillStyle = theme.subText;
            ctx.font = 'bold 11px "Segoe UI", Arial, monospace';
            ctx.fillText(stat.label, panelX + 40, statY - 6);
            
            
            ctx.shadowColor = theme.glow;
            ctx.shadowBlur = 20;
            ctx.fillStyle = theme.text;
            ctx.font = 'bold 13px "Segoe UI", Arial, monospace';
            ctx.fillText(stat.value, panelX + 120, statY -6);
        });
        
        ctx.restore();
    }

    addFuturisticUIElements(ctx, theme, width, height) {
        ctx.save();
        
        
        this.drawCornerHUD(ctx, theme, width, height);
        
        
        this.drawFloatingIndicators(ctx, theme, width, height);
        
        
        this.drawTechDecorations(ctx, theme, width, height);
        
        ctx.restore();
    }

    drawCornerHUD(ctx, theme, width, height) {
        const hudSize = 40;
        
        
        ctx.save();
        ctx.strokeStyle = theme.neonPrimary;
        ctx.lineWidth = 2;
        ctx.shadowColor = theme.neonPrimary;
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.moveTo(20, hudSize);
        ctx.lineTo(20, 20);
        ctx.lineTo(hudSize, 20);
        ctx.stroke();
        
        
        ctx.beginPath();
        ctx.arc(30, 30, 3, 0, Math.PI * 2);
        ctx.stroke();
        
        
        ctx.beginPath();
        ctx.moveTo(width - 20, height - hudSize);
        ctx.lineTo(width - 20, height - 20);
        ctx.lineTo(width - hudSize, height - 20);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(width - 30, height - 30, 3, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }

    drawFloatingIndicators(ctx, theme, width, height) {
        const indicators = [
            { x: width * 0.82, y: height * 0.20, type: 'radar' },
            { x: width * 0.15, y: height * 0.80, type: 'signal' },
            { x: width * 0.9, y: height * 0.6, type: 'power' }
        ];
        
        ctx.save();
        ctx.globalAlpha = 0.6;
        
        indicators.forEach(indicator => {
            ctx.save();
            ctx.translate(indicator.x, indicator.y);
            
            switch (indicator.type) {
                case 'radar':
                    this.drawRadarIndicator(ctx, theme);
                    break;
                case 'signal':
                    this.drawSignalIndicator(ctx, theme);
                    break;
                case 'power':
                    this.drawPowerIndicator(ctx, theme);
                    break;
            }
            
            ctx.restore();
        });
        
        ctx.restore();
    }

    drawRadarIndicator(ctx, theme) {
        ctx.strokeStyle = theme.neonSecondary;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = theme.neonSecondary;
        ctx.shadowBlur = 8;
        
        
        for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, i * 8, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(20, -10);
        ctx.stroke();
    }

    drawSignalIndicator(ctx, theme) {
        ctx.strokeStyle = theme.neonPrimary;
        ctx.lineWidth = 2;
        ctx.shadowColor = theme.neonPrimary;
        ctx.shadowBlur = 6;
        
        
        for (let i = 0; i < 4; i++) {
            const height = (i + 1) * 4;
            ctx.beginPath();
            ctx.moveTo(i * 6, 0);
            ctx.lineTo(i * 6, -height);
            ctx.stroke();
        }
    }

    drawPowerIndicator(ctx, theme) {
        ctx.strokeStyle = theme.glow;
        ctx.lineWidth = 2;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 10;
        
        
        ctx.beginPath();
        ctx.arc(0, 0, 8, -Math.PI/4, Math.PI/4);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, -2);
        ctx.stroke();
    }

    drawTechDecorations(ctx, theme, width, height) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 1;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 5;
        
        
        const lineSpacing = 80;
        
        
        for (let x = lineSpacing; x < width - lineSpacing; x += lineSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 10);
            ctx.moveTo(x - 5, 5);
            ctx.lineTo(x + 5, 5);
            ctx.stroke();
        }
        
        
        for (let x = lineSpacing; x < width - lineSpacing; x += lineSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, height);
            ctx.lineTo(x, height - 10);
            ctx.moveTo(x - 5, height - 5);
            ctx.lineTo(x + 5, height - 5);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    drawNeonBorderWithScanlines(ctx, theme, width, height) {
        ctx.save();
        
        
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 25;
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 3;
        
        this.drawTechRect(ctx, 3, 3, width - 6, height - 6, 15);
        ctx.stroke();
        
        
        ctx.shadowBlur = 15;
        ctx.strokeStyle = theme.neonPrimary + '80';
        ctx.lineWidth = 1;
        
        this.drawTechRect(ctx, 6, 6, width - 12, height - 12, 12);
        ctx.stroke();
        
        
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = theme.neonSecondary;
        ctx.lineWidth = 1;
        
        for (let y = 0; y < height; y += 3) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.restore();
        
        
        this.drawCornerEnergy(ctx, theme, width, height);
        
        ctx.restore();
    }

    drawCornerEnergy(ctx, theme, width, height) {
        const energySize = 30;
        
        ctx.save();
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 20;
        
        
        const tlGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, energySize);
        tlGradient.addColorStop(0, theme.neonPrimary + '80');
        tlGradient.addColorStop(0.7, theme.neonSecondary + '40');
        tlGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = tlGradient;
        ctx.fillRect(0, 0, energySize, energySize);
        
        
        const trGradient = ctx.createRadialGradient(width, 0, 0, width, 0, energySize);
        trGradient.addColorStop(0, theme.neonSecondary + '80');
        trGradient.addColorStop(0.7, theme.neonPrimary + '40');
        trGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = trGradient;
        ctx.fillRect(width - energySize, 0, energySize, energySize);
        
        
        const blGradient = ctx.createRadialGradient(0, height, 0, 0, height, energySize);
        blGradient.addColorStop(0, theme.neonPrimary + '60');
        blGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = blGradient;
        ctx.fillRect(0, height - energySize, energySize, energySize);
        
        const brGradient = ctx.createRadialGradient(width, height, 0, width, height, energySize);
        brGradient.addColorStop(0, theme.neonSecondary + '60');
        brGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = brGradient;
        ctx.fillRect(width - energySize, height - energySize, energySize, energySize);
        
        ctx.restore();
    }

    drawTechRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        
        
        const cutSize = radius * 0.3;
        
        ctx.moveTo(x + cutSize, y);
        ctx.lineTo(x + width - cutSize, y);
        ctx.lineTo(x + width, y + cutSize);
        ctx.lineTo(x + width, y + height - cutSize);
        ctx.lineTo(x + width - cutSize, y + height);
        ctx.lineTo(x + cutSize, y + height);
        ctx.lineTo(x, y + height - cutSize);
        ctx.lineTo(x, y + cutSize);
        ctx.closePath();
    }

    async drawHolographicBadge(ctx, badge, theme, width) {
        try {
            const badgeImg = await loadImage(badge);
            const badgeSize = 50;
            const badgeX = width - badgeSize - 40;
            const badgeY = 140;
            
            
            ctx.save();
            ctx.shadowColor = theme.glow;
            ctx.shadowBlur = 20;
            
            
            const badgeGradient = ctx.createRadialGradient(
                badgeX + badgeSize/2, badgeY + badgeSize/2, 0,
                badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2
            );
            badgeGradient.addColorStop(0, theme.neonPrimary + '80');
            badgeGradient.addColorStop(1, theme.neonSecondary + '60');
            
            ctx.fillStyle = badgeGradient;
            ctx.beginPath();
            ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
            ctx.fill();
            
            
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
            ctx.stroke();
            
            
            ctx.shadowBlur = 0;
            ctx.save();
            ctx.beginPath();
            ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2 - 3, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(badgeImg, badgeX + 3, badgeY + 3, badgeSize - 6, badgeSize - 6);
            
            
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = theme.neonPrimary;
            ctx.fillRect(badgeX + 3, badgeY + 3, badgeSize - 6, badgeSize - 6);
            
            ctx.restore();
            ctx.restore();
        } catch (error) {
            console.warn('Badge loading failed:', error);
        }
    }

    async generateFallback(username, level, rank, width, height) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        const theme = this.themes.neon;
        
        
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
        gradient.addColorStop(0, theme.background[1]);
        gradient.addColorStop(1, theme.background[0]);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        
        this.drawHolographicText(ctx, username, width/2, height/2 - 30, theme, '24px');
        this.drawHolographicText(ctx, `Level ${level} • Rank #${rank}`, width/2, height/2 + 10, theme, '16px');
        
        
        ctx.fillStyle = theme.subText;
        ctx.font = '14px "Segoe UI", Arial, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HOLOGRAPHIC RANK CARD TEMPORARILY OFFLINE', width/2, height/2 + 50);
        
        
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 2;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 15;
        ctx.strokeRect(5, 5, width - 10, height - 10);
        
        return canvas.toBuffer("image/png");
    }
}

module.exports = { RankCardGenerator };