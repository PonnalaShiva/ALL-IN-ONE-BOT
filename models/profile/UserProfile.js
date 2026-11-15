
const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    
    
    bio: {
        type: String,
        maxlength: 500,
        default: null
    },
    customBanner: {
        type: String,
        default: null
    },
    
    
    gaming: {
        steam: { username: String, profileUrl: String },
        epic: { username: String, profileUrl: String },
        riot: { riotId: String, region: String },
        minecraft: { username: String, uuid: String },
        xbox: { gamertag: String, profileUrl: String },
        playstation: { psnId: String, profileUrl: String },
        nintendo: { friendCode: String, username: String },
        battlenet: { battleTag: String, profileUrl: String },
        origin: { username: String, profileUrl: String },
        uplay: { username: String, profileUrl: String },
        fortnite: { epicName: String, stats: Object }
    },
    
    
    social: {
        youtube: { channelUrl: String, channelName: String, subscribers: String },
        twitch: { username: String, profileUrl: String },
        instagram: { username: String, profileUrl: String },
        twitter: { username: String, profileUrl: String },
        facebook: { profileUrl: String, displayName: String },
        tiktok: { username: String, profileUrl: String },
        linkedin: { profileUrl: String, displayName: String },
        github: { username: String, profileUrl: String },
        reddit: { username: String, profileUrl: String },
        snapchat: { username: String, profileUrl: String }
    },
    
    
    content: {
        website: { url: String, title: String },
        portfolio: { url: String, title: String },
        blog: { url: String, title: String },
        medium: { username: String, profileUrl: String },
        devto: { username: String, profileUrl: String },
        codepen: { username: String, profileUrl: String }
    },
    
    
    other: {
        spotify: { profileUrl: String, displayName: String },
        soundcloud: { username: String, profileUrl: String },
        pinterest: { username: String, profileUrl: String },
        telegram: { username: String, profileUrl: String },
        whatsapp: { number: String, displayName: String }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('UserProfile', userProfileSchema);
