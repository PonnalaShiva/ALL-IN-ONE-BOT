const axios = require('axios');
const dotenv = require('dotenv');
const client = require('./main');
const aiManager = require('./utils/AIManager');
const messageMiddleware = require('./utils/messageMiddleware');
const cacheManager = require('./utils/cacheManager');
const { enforceRuntimeSeal } = require('./utils/entitlementService');
const { AttachmentBuilder, MessageFlags } = require('discord.js');
const { buildCard } = require('./UI');
const { getEmoji } = require('./UI/emojis/emoji');
dotenv.config();

const dashboardInitializer = require('./dashboard/initializer');
const AiChat = require('./models/aichat/aiModel');

const BACKEND = (process.env.BACKEND || process.env.VALIDATOR_URL || 'https://aio.fluenosity.com').replace(/\/+$/, '');
const BOT_API = process.env.BOT_API;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;
const BOT_ID = client.user?.id || 'UNKNOWN_BOT';
const CACHE_VERBOSE = process.env.CACHE_VERBOSE === 'true';

const MESSAGE_HISTORY_SIZE = 10;
const CONVERSATION_TTL = 30 * 60 * 1000; 
const MAX_CONVERSATION_HISTORY = 1000; 
const conversationHistory = new Map();
const conversationTimestamps = new Map(); 
const processingChannels = new Set(); 
let conversationCleanupInterval = null;
let unregisterShivaMiddleware = null;
let shivaStopping = false;

function getConversationContext(channelId) {
    if (!conversationHistory.has(channelId)) {
        conversationHistory.set(channelId, []);
    }
    
    conversationTimestamps.set(channelId, Date.now());
    return conversationHistory.get(channelId);
}

function addToConversationHistory(channelId, role, text) {
    const history = getConversationContext(channelId);
    history.push({ role, text });
    if (history.length > MESSAGE_HISTORY_SIZE) {
        history.shift();
    }
    
    conversationTimestamps.set(channelId, Date.now());
}

function cleanupConversationHistory() {
    const now = Date.now();
    const entriesToDelete = [];
    
    
    for (const [channelId, timestamp] of conversationTimestamps.entries()) {
        if (now - timestamp > CONVERSATION_TTL) {
            entriesToDelete.push(channelId);
        }
    }
    
    
    if (conversationHistory.size > MAX_CONVERSATION_HISTORY) {
        const sortedEntries = Array.from(conversationTimestamps.entries())
            .sort((a, b) => a[1] - b[1]); 
        
        const toRemove = conversationHistory.size - MAX_CONVERSATION_HISTORY;
        for (let i = 0; i < toRemove; i++) {
            entriesToDelete.push(sortedEntries[i][0]);
        }
    }
    
    
    for (const channelId of entriesToDelete) {
        conversationHistory.delete(channelId);
        conversationTimestamps.delete(channelId);
    }
    
    if (CACHE_VERBOSE && entriesToDelete.length > 0) {
        console.log(`[Shiva] Cleaned up ${entriesToDelete.length} old conversation histories`);
    }
}

function detectImageRequest(text) {
    const lowerText = text.toLowerCase();
    const imagePatterns = [
        /(?:show|send|get|give|find|display)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:pic(?:ture)?|img|image|photo)\s+(?:of\s+)?(.+)/i,
        /(.+?)\s+(?:pic(?:ture)?|img|image|photo)$/i,
        /(?:pic(?:ture)?|img|image|photo)\s+(?:of\s+)?(.+)/i
    ];
    
    for (const pattern of imagePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            
            return match[1].trim().replace(/[?.!]+$/, '');
        }
    }
    return null;
}

async function fetchUnsplashImage(keywords) {
    try {
        const searchTerms = keywords.split(/\s+/).slice(0, 3).join(',');
        const unsplashBase = (process.env.UNSPLASH_SOURCE_URL || 'https://source.unsplash.com/1280x720').replace(/\/+$/, '');
        const url = `${unsplashBase}/?${encodeURIComponent(searchTerms)}`;
        
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000,
            maxRedirects: 5
        });
        
        return {
            success: true,
            buffer: Buffer.from(response.data)
        };
    } catch (error) {
        console.error('[Shiva] Unsplash fetch error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

async function isAIChatChannel(channelId, guildId) {
    const cacheKey = `${guildId}_${channelId}`;
    
    
    const cached = cacheManager.get('aiChatConfig', cacheKey);
    if (cached !== null) {
        return cached === true;
    }

    try {
        const config = await AiChat.findActiveChannel(guildId, channelId);
        const isActive = !!config;
        
        
        cacheManager.set('aiChatConfig', cacheKey, isActive);
        
        return isActive;
    } catch (error) {
        console.error(`[Shiva] Error checking AI chat status for ${channelId}:`, error);
        
        cacheManager.set('aiChatConfig', cacheKey, false);
        return false;
    }
}

async function getGeminiResponse(prompt, channelId, guildId) {
    try {
        const history = getConversationContext(channelId);
        const contents = [];
        contents.push({
            role: "user",
            parts: [{ text: "You are a helpful Discord bot assistant. Keep your responses concise and friendly. Don't use markdown formatting." }]
        });
        contents.push({
            role: "model",
            parts: [{ text: "Understood. I'll keep responses concise and friendly." }]
        });

        for (const msg of history) {
            contents.push({
                role: msg.role === "bot" ? "model" : "user",
                parts: [{ text: msg.text }]
            });
        }

        contents.push({ role: "user", parts: [{ text: prompt }] });

        
        const response = await aiManager.generateContent(guildId, contents, {
            timeout: 30000,
            thinkingLevel: 'low' 
        });

        return response.text();

    } catch (error) {
        console.error('Error getting Gemini response:', error.message);
        if (error.message.includes('blocked') || error.message.includes('safety')) {
            return "Sorry, I can't respond to that due to content guidelines.";
        } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
            return "High demand right now — please try again later.";
        } else if (error.message.includes('No active Gemini API keys')) {
            return "AI services are temporarily unavailable. Please contact the admin.";
        }
        return "Sorry, I encountered an error while processing your request.";
    }
}

const shivaReadyListener = async () => {
    if (shivaStopping) return;
    const entitlementSeal = await enforceRuntimeSeal({
        force: false,
        allowGrace: true,
        reason: 'shiva_runtime',
        quiet: true
    });

    if (!entitlementSeal.success) {
        console.error(`[Shiva] Entitlement seal failed: ${entitlementSeal.message}`);
        process.exit(1);
        return;
    }

    const payload = {
        name: client.user.tag,
        avatar: client.user.displayAvatarURL({ format: 'png', size: 128 }),
        timestamp: new Date().toISOString()
    };

    try {
        await axios.post(`${BACKEND}/api/bot-info`, payload);
    } catch (_) {}

    try {
        const stats = await aiManager.getStats();
        console.log(`🧠 AI Manager: ${stats.activeKeys}/${stats.totalKeys} keys active, ${stats.successRate} success rate`);
    } catch (error) {
        console.error('Failed to get AI manager stats:', error.message);
    }
    
    
    if (shivaStopping) return;
    conversationCleanupInterval = setInterval(() => {
        cleanupConversationHistory();
    }, 10 * 60 * 1000);
    conversationCleanupInterval.unref?.();
    
    console.log('[Shiva] ✅ AI chat system initialized with middleware pattern');
};
client.once('clientReady', shivaReadyListener);


unregisterShivaMiddleware = messageMiddleware.use(async (message, next) => {
    
    if (message.author.bot || !message.guild) {
        await next();
        return false;
    }

    
    const isActive = await isAIChatChannel(message.channel.id, message.guild.id);
    if (!isActive) {
        await next();
        return false;
    }

    
    const channelKey = `${message.guild.id}_${message.channel.id}`;
    if (processingChannels.has(channelKey)) {
        
        await next();
        return false;
    }

    
    processingChannels.add(channelKey);

    try {
        
        await message.channel.sendTyping().catch(() => {});

        
        const imageSubject = detectImageRequest(message.content);
        if (imageSubject) {
            
            const imageResult = await fetchUnsplashImage(imageSubject);
            
            if (imageResult.success) {
                const attachment = new AttachmentBuilder(imageResult.buffer, { name: 'image.jpg' });
                const card = buildCard({
                    title: `${getEmoji('media')} Here's your ${imageSubject}!`,
                    bannerURL: 'attachment://image.jpg',
                    accentColor: 0x26a7de,
                    _footer: 'Image from Unsplash'
                });
                
                await message.reply({ components: [card], files: [attachment], flags: MessageFlags.IsComponentsV2 }).catch(err => {
                    console.error('[Shiva] Error sending image:', err);
                });
                
                
                addToConversationHistory(message.channel.id, "user", message.content);
                addToConversationHistory(message.channel.id, "bot", `Here's an image of ${imageSubject}!`);
                
                return true;
            }
            
        }

        
        addToConversationHistory(message.channel.id, "user", message.content);

        
        const aiResponse = await getGeminiResponse(message.content, message.channel.id, message.guild.id);
        
        
        addToConversationHistory(message.channel.id, "bot", aiResponse);

        
        if (aiResponse.length > 2000) {
            for (let i = 0; i < aiResponse.length; i += 2000) {
                await message.reply(aiResponse.substring(i, i + 2000)).catch(err => {
                    console.error('[Shiva] Error sending split message:', err);
                });
            }
        } else {
            await message.reply(aiResponse).catch(err => {
                console.error('[Shiva] Error sending message:', err);
            });
        }

        
        return true;
    } catch (error) {
        console.error('[Shiva] Error in AI chat response:', error);
        let msg = "Sorry, I encountered an error processing your message.";
        if (error.message.includes('rate limit')) {
            msg = "I'm overloaded. Please wait a bit.";
        } else if (error.message.includes('blocked')) {
            msg = "That request violates my safety rules.";
        }
        
        try {
            await message.reply(msg).catch(() => {});
        } catch (replyError) {
            console.error('[Shiva] Error sending error message:', replyError);
        }
        
        return true; 
    } finally {
        
        setTimeout(() => {
            processingChannels.delete(channelKey);
        }, 1000); 
    }
}, 40); 

module.exports = {
    isServerOnline: () => true,
    getAIStats: async () => {
        try {
            return await aiManager.getStats();
        } catch (error) {
            return { error: error.message };
        }
    },
    stop() {
        shivaStopping = true;
        client.off('clientReady', shivaReadyListener);
        unregisterShivaMiddleware?.();
        unregisterShivaMiddleware = null;
        if (conversationCleanupInterval) clearInterval(conversationCleanupInterval);
        conversationCleanupInterval = null;
        dashboardInitializer.stop?.();
        aiManager.stop?.();
    }
};
