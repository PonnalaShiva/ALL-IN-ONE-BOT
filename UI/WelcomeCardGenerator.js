const { createCanvas, loadImage } = require("@napi-rs/canvas");
const data = require("../UI/banners/welcomecards");

class WelcomeCardGenerator {
  constructor() {
    this.width = 900;
    this.height = 360;
    this.dpi = 2;
    this.rw = this.width * this.dpi;
    this.rh = this.height * this.dpi;

    this.colors = {
      backgroundOverlay: "rgba(0,0,0,0.48)",
      accentBar: "#00e5ff",
      accentGlow: "rgba(0,229,255,0.6)",
      textPrimary: "#00e5ff",
      textWhite: "#ffffff",
      divider: "rgba(0,229,255,0.25)",
      vignette: "rgba(0,0,0,0.28)"
    };

    this.fonts = {
      welcome: `bold ${44 * this.dpi}px 'Segoe UI','Arial Black',Arial,sans-serif`,
      username: `bold ${30 * this.dpi}px 'Segoe UI',Arial,sans-serif`,
      server: `${21 * this.dpi}px 'Segoe UI',Arial,sans-serif`,
      memberCount: `bold ${32 * this.dpi}px 'Segoe UI',Arial,sans-serif`
    };

    this.avatar = {
      size: 88 * this.dpi,
      x: 55 * this.dpi,
      y: (this.rh / 2) - (88 * this.dpi) / 2
    };

    this.layout = {
      textX: 180 * this.dpi,
      welcomeY: this.avatar.y - 10 * this.dpi,
      usernameY: this.avatar.y + 40 * this.dpi,
      serverY: this.avatar.y + 75 * this.dpi,
      dividerY: this.avatar.y + 110 * this.dpi,
      bottomTextX: this.avatar.x,
      bottomTextY: this.avatar.y + this.avatar.size + 50 * this.dpi
    };

    this.barWidth = 11 * this.dpi;
  }

  getOrdinalSuffix(number) {
    const j = number % 10,
      k = number % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  }

  async generate({ username = "New Member", serverName = "Server", memberCount = 1, avatarURL = null, isLeave = false }) {
    const backgroundFile = data.welcomeImages[Math.floor(Math.random() * data.welcomeImages.length)];
    const canvas = createCanvas(this.rw, this.rh);
    const ctx = canvas.getContext("2d");

    
    try {
      const bg = await loadImage(backgroundFile);
      ctx.drawImage(bg, 0, 0, this.rw, this.rh);
    } catch {
      ctx.fillStyle = "#101821";
      ctx.fillRect(0, 0, this.rw, this.rh);
    }

    
    ctx.fillStyle = this.colors.backgroundOverlay;
    ctx.fillRect(0, 0, this.rw, this.rh);

    
    const vignette = ctx.createLinearGradient(0, this.rh - 130 * this.dpi, 0, this.rh);
    vignette.addColorStop(0, "transparent");
    vignette.addColorStop(1, this.colors.vignette);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, this.rh - 130 * this.dpi, this.rw, 130 * this.dpi);

    
    const grad = ctx.createLinearGradient(0, 0, 0, this.rh);
    grad.addColorStop(0, this.colors.accentGlow);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.barWidth, this.rh);

    
    if (avatarURL) {
      try {
        const avatar = await loadImage(avatarURL);
        const cx = this.avatar.x + this.avatar.size / 2;
        const cy = this.avatar.y + this.avatar.size / 2;

        
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, this.avatar.size / 2 + 10 * this.dpi, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.shadowColor = this.colors.accentBar;
        ctx.shadowBlur = 10 * this.dpi;
        ctx.fill();
        ctx.restore();

        
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, this.avatar.size / 2 + 4 * this.dpi, 0, Math.PI * 2);
        ctx.fillStyle = this.colors.accentBar;
        ctx.fill();
        ctx.restore();

        
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, this.avatar.size / 2, 0, Math.PI * 2);
        ctx.shadowColor = "rgba(0,0,0,0.38)";
        ctx.shadowBlur = 8 * this.dpi;
        ctx.fillStyle = "#111";
        ctx.fill();
        ctx.restore();

        
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, this.avatar.size / 2 - 2 * this.dpi, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, this.avatar.x, this.avatar.y, this.avatar.size, this.avatar.size);
        ctx.restore();
      } catch {}
    }

    ctx.textBaseline = "top";

    
    const mainTitle = isLeave ? "Goodbye" : "Welcome";
    const gradTitle = ctx.createLinearGradient(this.layout.textX, this.layout.welcomeY, this.layout.textX + 290 * this.dpi, this.layout.welcomeY);
    gradTitle.addColorStop(0, "#30fff6");
    gradTitle.addColorStop(0.5, "#00e5ff");
    gradTitle.addColorStop(1, "#2e84fc");
    ctx.save();
    ctx.font = this.fonts.welcome;
    ctx.shadowColor = "rgba(0,229,255,0.35)";
    ctx.shadowBlur = 22 * this.dpi;
    ctx.fillStyle = gradTitle;
    ctx.fillText(mainTitle, this.layout.textX, this.layout.welcomeY + 6 * this.dpi);
    ctx.restore();

    
    ctx.save();
    ctx.font = this.fonts.username;
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 8 * this.dpi;
    ctx.fillStyle = this.colors.textWhite;
    ctx.fillText(username, this.layout.textX, this.layout.usernameY);
    ctx.restore();

    
    ctx.save();
    ctx.font = this.fonts.server;
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.colors.textWhite;
    ctx.fillText(`to ${serverName}`, this.layout.textX, this.layout.serverY);
    ctx.restore();

    
    const neonLineGrad = ctx.createLinearGradient(this.layout.textX, this.layout.dividerY, this.layout.textX + 410 * this.dpi, this.layout.dividerY);
    neonLineGrad.addColorStop(0, "#00e9fc");
    neonLineGrad.addColorStop(0.6, "#55ffff");
    neonLineGrad.addColorStop(1, "#2e84fc");
    ctx.save();
    ctx.lineWidth = 3 * this.dpi;
    ctx.strokeStyle = neonLineGrad;
    ctx.shadowColor = this.colors.accentBar;
    ctx.shadowBlur = 8 * this.dpi;
    ctx.beginPath();
    ctx.moveTo(this.layout.textX, this.layout.dividerY);
    ctx.lineTo(this.layout.textX + (410 * this.dpi), this.layout.dividerY);
    ctx.stroke();
    ctx.restore();

    
    ctx.save();
    ctx.font = this.fonts.memberCount;
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 14 * this.dpi;
    ctx.fillStyle = this.colors.textPrimary;
    const bottomText = isLeave
      ? `We will miss you, ${username}!`
      : `You are the ${memberCount}${this.getOrdinalSuffix(memberCount)} member`;
    ctx.fillText(bottomText, this.layout.bottomTextX, this.layout.bottomTextY);
    ctx.restore();

    
    const outputCanvas = createCanvas(this.width, this.height);
    const outputCtx = outputCanvas.getContext("2d");
    outputCtx.drawImage(canvas, 0, 0, this.width, this.height);

    return outputCanvas.toBuffer("image/png");
  }
}

module.exports = { WelcomeCardGenerator };
