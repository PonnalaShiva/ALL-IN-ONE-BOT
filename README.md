# Fluenosity Discord Bot — Setup & Pterodactyl Hosting Guide

A modern, full-featured Discord bot featuring 100 slash commands, music playback, interactive setup dashboards, economy, leveling, and moderation systems.

- **Author:** shiva - fluenosity
- **Website:** [https://fluenosity.com](https://fluenosity.com)
- **GitHub:** [https://github.com/PonnalaShiva](https://github.com/PonnalaShiva)

---

## 📋 Prerequisites

Before setting up the bot, ensure you have:
1. **Discord Bot Token & Application ID:** From the [Discord Developer Portal](https://discord.com/developers/applications).
   - Ensure **Privileged Gateway Intents** are enabled:
     - `Presence Intent`
     - `Server Members Intent`
     - `Message Content Intent`
2. **MongoDB Database:** A free cluster from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) or a self-hosted MongoDB instance.
3. **Pterodactyl Panel:** With a **Node.js (v20 or v22)** Egg.

---

## 🚀 Pterodactyl Panel Hosting Guide

Follow these simple steps to deploy and run the bot on any Pterodactyl-based game or bot hosting server.

### Step 1: Upload Files
1. In your Pterodactyl control panel, go to the **File Manager**.
2. Upload all files and folders from the `bot` directory.
   > **Note:** Do NOT upload the `node_modules` folder. Pterodactyl will install dependencies cleanly on the server.

### Step 2: Configure Environment Variables (`.env`)
1. In the **File Manager**, locate `.env.example`.
2. Rename it to `.env` (or create a new file named `.env` and copy the contents).
3. Fill in your credentials:

```env
# ==============================================================================
# Discord Bot Credentials
# ==============================================================================
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
OWNER_ID=your_discord_user_id_here
PREFIX=!
LANGUAGE=default

# ==============================================================================
# Database Configuration
# ==============================================================================
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/fluenosity?retryWrites=true&w=majority

# ==============================================================================
# Music & Audio (Spotify Track Resolution)
# ==============================================================================
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# ==============================================================================
# Optional Lavalink Server (Default public node is already configured)
# ==============================================================================
LAVALINK_ENABLED=true
# LAVALINK_HOST=your_lavalink_host
# LAVALINK_PORT=2333
# LAVALINK_PASSWORD=your_password
# LAVALINK_SECURE=false

# ==============================================================================
# Optional Notifications (Twitch / YouTube / Socials)
# ==============================================================================
# TWITCH_CLIENT_ID=your_twitch_client_id
# TWITCH_CLIENT_SECRET=your_twitch_client_secret
# YOUTUBE_API_KEY=your_youtube_api_key
```

### Step 3: Configure Startup Settings
1. Go to the **Startup** tab in your Pterodactyl panel.
2. Verify or set the following options:
   - **Start Command:** `node index.js` (or `npm start`)
   - **Main File:** `index.js`
   - **Node.js Version:** `20` or `22` (recommended)
   - **Auto-Install Dependencies:** Toggle `Enabled` (or set `1`) if available.

### Step 4: Install Dependencies & Launch
1. Go to the **Console** tab.
2. If dependencies were not installed automatically, type:
   ```bash
   npm install --omit=dev
   ```
3. Click **Start** (or Restart).
4. Watch the console. You should see:
   - MongoDB database connection confirmation
   - Slash commands and prefix commands registered
   - Bot status displaying online and ready

---

## 🛠️ Local Machine Setup (Alternative)

If you wish to test the bot locally on your PC or VPS:

1. Clone or open the project:
   ```bash
   cd bot
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure your credentials:
   ```bash
   cp .env.example .env
   ```
4. Verify files and commands:
   ```bash
   npm run check:syntax
   npm run test:commands
   ```
5. Start the bot:
   ```bash
   npm start
   ```

---

## ❓ Common Issues & Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **`DisallowedIntents` error** | Privileged intents are disabled | Enable all 3 Gateway Intents in Discord Developer Portal under the **Bot** tab. |
| **`MongooseServerSelectionError`** | MongoDB connection failed | Check your `MONGODB_URI` password and ensure your IP is whitelisted (set to `0.0.0.0/0` in MongoDB Atlas Network Access). |
| **`TOKEN_INVALID`** | Bad or expired token | Reset your bot token in the Discord Developer Portal and paste it into `.env`. |
| **Commands not appearing** | Slash command sync delay | Discord global slash commands can take a few minutes to appear. Re-invite the bot with `applications.commands` scope if needed. |

---

## 📄 License & Credits

- Maintained by **shiva - fluenosity**
- Official Website: [fluenosity.com](https://fluenosity.com)
