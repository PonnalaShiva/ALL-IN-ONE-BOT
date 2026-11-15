'use strict';

const { ActivityType } = require('discord.js');

module.exports = {
  // Authentication & Core Defaults
  token: process.env.DISCORD_TOKEN || '',
  prefix: process.env.PREFIX || '!',
  language: process.env.LANGUAGE || 'default',
  mongodbUri: process.env.MONGODB_URI || '',
  ownerId: process.env.OWNER_ID || '1004206704994566164', // Your Discord User ID
  helpBannerUrl: 'https://i.ibb.co/DPN5VkB2/ad0acd6f-be7e-40ea-bff5-34278a865115.png',
  // UI & Emoji Configuration
  customEmoji: true,

  // Presence & Bot Status
  status: {
    rotateDefault: [
      { name: 'Netflix', type: ActivityType.Watching },
      { name: 'GTA VI', type: ActivityType.Playing },
      { name: 'on YouTube', type: ActivityType.Streaming, url: 'https://www.twitch.tv/fluenosity' },
      { name: 'Spotify', type: ActivityType.Custom },
    ],
    songStatus: true
  },

  // Spotify API Credentials (environment variable fallback)
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',

  // Dashboard & Middleware Connection
  dashboard: {
    enabled: process.env.DASHBOARD_ENABLED !== undefined
      ? process.env.DASHBOARD_ENABLED === 'true'
      : false // Set to true to connect websocket to middleware, false to disable
  },

  // Excess Command Groups
  excessCommands: {
    other: true,
    nsfw: true,
    economy: true
  },

  // Slash Command Categories Enabled
  categories: {
    media: true,
    basic: true,
    utility: true,
    moderation: true,
    core: true,
    lavalink: true,
    fun: true,
    distube: true,
    setups: true,
    audio: true
  }
};
