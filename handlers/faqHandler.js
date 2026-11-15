
const FaqConfig = require('../models/faq/faqModel');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const loadLanguage = require('../events/loadLanguage');
const { buildCard, cards, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const aiManager = require('../utils/AIManager');


const userCooldowns = new Map(); 
const userInfo = new Map(); 


const RATE_LIMIT_CONFIG = {
    cooldownTime: 10000,    
    
    
    lowViolationTimeout: 30000, 
    
    
    discordTimeoutDuration: 300000, 
    extremeTimeoutDuration: 600000, 
    
    maxViolationsBeforeDiscordTimeout: 3, 
    maxViolationsBeforeExtreme: 5, 
    
    cleanupInterval: 600000, 
    
    
    timeoutReasons: {
        moderate: "FAQ spam protection - Rate limit violations",
        severe: "FAQ spam protection - Repeated violations",
        extreme: "FAQ spam protection - Excessive violations"
    }
};


const BASE_AI_PROMPT = `You are an advanced multilingual AI assistant for this Discord server. CRITICAL INSTRUCTIONS:

LANGUAGE DETECTION & RESPONSE:
- AUTOMATICALLY detect the language of the user's question
- Respond in the SAME language the user used (supports 100+ languages including English, Spanish, French, German, Hindi, Japanese, Korean, Chinese, Arabic, Portuguese, Russian, and many more)
- If the user mixes languages, respond in the primary language detected
- Maintain natural, conversational tone in the detected language

FORMATTING RULES (Apply to ALL languages):
- NEVER respond with JSON, code blocks, or structured data formats
- ALWAYS respond in natural, conversational language using Discord markdown
- Use **bold text** for important headings and key information
- Use bullet points with • for lists
- Use proper Discord formatting: <#channelId> for channels (ONLY if channel exists), @RoleName for roles (without <@&> to avoid pinging)
- Keep your main response under 1800 characters for the description
- Structure information with clear **section headers** when needed

RESPONSE STRUCTURE (Universal across all languages):
- Start with a brief, engaging introduction (2-3 sentences)
- Provide helpful, accurate information based on the server context
- Use appropriate formatting for the detected language
- End with an offer for further assistance if needed

SPECIAL INSTRUCTIONS:
- For channels: Use <#channelId> format ONLY if the channel exists in the server, otherwise use #channelName
- For roles: Use @RoleName format (without <@&>) to avoid pinging members
- NEVER ping users or roles - use role names like @Moderator instead of <@&roleId>
- Be welcoming, helpful, and informative in the detected language
- Adapt cultural context appropriately for the detected language

Remember: Detect the user's language automatically and respond naturally in that language while following all formatting rules above.`;


const EMBED_COLORS = {
    info: 0x3498db,      
    success: 0x2ecc71,   
    warning: 0xf39c12,   
    error: 0xe74c3c,     
    features: 0x9b59b6,  
    links: 0x1abc9c,     
    server: 0x34495e,    
    welcome: 0x00ff7f,   
    tutorial: 0xff69b4,  
    rateLimit: 0xff6b6b, 
    timeout: 0x8e44ad,   
    discordTimeout: 0xdc143c, 
    extreme: 0x800000,   
    default: 0x5865f2    
};


function updateUserInfo(user) {
    const userId = user.id;
    const currentInfo = userInfo.get(userId);
    
    const newInfo = {
        username: user.username,
        tag: user.tag,
        displayName: user.displayName || user.username,
        avatarURL: user.displayAvatarURL({ dynamic: true, size: 256 }),
        joinedAt: user.joinedTimestamp ? new Date(user.joinedTimestamp) : null,
        firstSeen: currentInfo?.firstSeen || new Date(),
        lastSeen: new Date(),
        totalRequests: (currentInfo?.totalRequests || 0) + 1
    };
    
    userInfo.set(userId, newInfo);
    return newInfo;
}

async function checkRateLimit(userId, member, guild) {
    const now = Date.now();
    const userData = userCooldowns.get(userId);
    
    if (!userData) {
        userCooldowns.set(userId, {
            lastUsed: now,
            blockedUntil: 0,
            requestCount: 1,
            violations: 0,
            firstRequest: now,
            discordTimeoutApplied: false
        });
        return { allowed: true, timeLeft: 0 };
    }
    
    
    if (userData.blockedUntil > now) {
        const timeLeft = Math.ceil((userData.blockedUntil - now) / 1000);
        return { 
            allowed: false, 
            timeLeft, 
            reason: userData.discordTimeoutApplied ? 'DISCORD_TIMEOUT' : 'VIRTUAL_TIMEOUT',
            violations: userData.violations
        };
    }
    
    
    const timeSinceLastRequest = now - userData.lastUsed;
    if (timeSinceLastRequest < RATE_LIMIT_CONFIG.cooldownTime) {
        const violations = userData.violations + 1;
        
        
        let timeoutDuration;
        let applyDiscordTimeout = false;
        let timeoutReason = '';
        
        if (violations >= RATE_LIMIT_CONFIG.maxViolationsBeforeExtreme) {
            
            timeoutDuration = RATE_LIMIT_CONFIG.extremeTimeoutDuration;
            applyDiscordTimeout = true;
            timeoutReason = 'EXTREME';
        } else if (violations >= RATE_LIMIT_CONFIG.maxViolationsBeforeDiscordTimeout) {
            
            timeoutDuration = RATE_LIMIT_CONFIG.discordTimeoutDuration;
            applyDiscordTimeout = true;
            timeoutReason = 'SEVERE';
        } else {
            
            timeoutDuration = RATE_LIMIT_CONFIG.lowViolationTimeout;
            applyDiscordTimeout = false;
            timeoutReason = 'MODERATE';
        }
        
        
        let discordTimeoutSuccess = false;
        if (applyDiscordTimeout && member && guild) {
            discordTimeoutSuccess = await applyDiscordTimeout(member, timeoutDuration, timeoutReason, guild);
        }
        
        
        userCooldowns.set(userId, {
            ...userData,
            violations,
            blockedUntil: now + timeoutDuration,
            requestCount: userData.requestCount + 1,
            discordTimeoutApplied: discordTimeoutSuccess
        });
        
        const timeLeft = Math.ceil(timeoutDuration / 1000);
        return { 
            allowed: false, 
            timeLeft, 
            reason: discordTimeoutSuccess ? 'DISCORD_TIMEOUT' : (applyDiscordTimeout ? 'DISCORD_TIMEOUT_FAILED' : 'VIRTUAL_TIMEOUT'),
            violations,
            timeoutType: timeoutReason
        };
    }
    
    
    userCooldowns.set(userId, {
        ...userData,
        lastUsed: now,
        requestCount: userData.requestCount + 1,
        blockedUntil: 0,
        discordTimeoutApplied: false
    });
    
    return { allowed: true, timeLeft: 0 };
}


async function applyDiscordTimeout(member, duration, severity, guild) {
    try {
        
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            console.log(`[FAQHandler] Missing permissions to timeout members in ${guild.name}`);
            return false;
        }
        
        
        if (member.roles.highest.position >= botMember.roles.highest.position) {
            console.log(`[FAQHandler] Cannot timeout ${member.user.tag} - Higher role hierarchy`);
            return false;
        }
        
        
        if (member.isCommunicationDisabled()) {
            console.log(`[FAQHandler] ${member.user.tag} is already timed out`);
            return true; 
        }
        
        
        const timeoutReason = RATE_LIMIT_CONFIG.timeoutReasons[severity.toLowerCase()] || 
                            RATE_LIMIT_CONFIG.timeoutReasons.moderate;
        
        await member.timeout(duration, timeoutReason);
        
            console.log(`[FAQHandler] Successfully timed out ${member.user.tag} for ${Math.ceil(duration / 1000)}s. Reason: ${severity}`);
        return true;
        
    } catch (error) {
        console.error(`[FAQHandler] Failed to timeout ${member.user.tag}:`, error);
        return false;
    }
}

function getRemainingCooldown(userId) {
    const userData = userCooldowns.get(userId);
    if (!userData) return 0;
    
    const now = Date.now();
    const timeSinceLastRequest = now - userData.lastUsed;
    const remainingCooldown = RATE_LIMIT_CONFIG.cooldownTime - timeSinceLastRequest;
    
    return Math.max(0, Math.ceil(remainingCooldown / 1000));
}


function createRateLimitCard(user, rateLimitInfo) {
    const userInfoData = userInfo.get(user.id);
    const lang = loadLanguage();
    const h = lang.faq?.handler || {};
    let tone = 'warning';
    let title = `${getEmoji('alert')} ${h.virtualTimeoutTitle}`;
    let description = (h.virtualTimeoutDesc).replace('{user}', user.displayName);
    const fields = [];

    if (rateLimitInfo.reason === 'DISCORD_TIMEOUT') {
        if (rateLimitInfo.timeoutType === 'EXTREME') {
            tone = 'danger';
            title = `${getEmoji('lock')} ${h.extremeTimeoutTitle}`;
            description = (h.extremeTimeoutDesc).replace('{user}', user.displayName);
            fields.push(`**${getEmoji('timer')} ${h.timeoutDurationLabel}:** ${rateLimitInfo.timeLeft}s`);
            fields.push(`**${getEmoji('alert')} ${h.violationLevelLabel}:** ${(h.extremeLevelDesc).replace('{count}', rateLimitInfo.violations)}`);
            fields.push(`**${getEmoji('shield')} ${h.punishmentLabel}:** ${h.realTimeoutApplied}`);
            fields.push(`> ${h.warningVoiceText}`);
        } else {
            tone = 'danger';
            title = `${getEmoji('warn')} ${h.discordTimeoutTitle}`;
            description = (h.discordTimeoutDesc).replace('{user}', user.displayName);
            fields.push(`**${getEmoji('timer')} ${h.timeoutDurationLabel}:** ${rateLimitInfo.timeLeft}s`);
            fields.push(`**${getEmoji('alert')} ${h.violationLevelLabel}:** ${(h.highLevelDesc).replace('{count}', rateLimitInfo.violations)}`);
            fields.push(`**${getEmoji('shield')} ${h.punishmentLabel}:** ${h.realTimeoutApplied}`);
            fields.push(`> ${h.timeoutNote}`);
        }
    } else if (rateLimitInfo.reason === 'DISCORD_TIMEOUT_FAILED') {
        tone = 'danger';
        title = `${getEmoji('warn')} ${h.timeoutFailedTitle}`;
        description = (h.timeoutFailedDesc).replace('{user}', user.displayName);
        fields.push(`**${getEmoji('timer')} ${h.virtualTimeoutLabel}:** ${rateLimitInfo.timeLeft}s`);
        fields.push(`**${getEmoji('alert')} ${h.violationLevelLabel}:** ${(h.highLevelDesc).replace('{count}', rateLimitInfo.violations)}`);
        fields.push(`> ${h.failedIssueDesc}`);
    } else {
        fields.push(`**${getEmoji('timer')} ${h.cooldownPeriodLabel}:** ${rateLimitInfo.timeLeft}s`);
        fields.push(`**${getEmoji('refresh')} ${h.nextRequestLabel}:** <t:${Math.floor((Date.now() + rateLimitInfo.timeLeft * 1000) / 1000)}:R>`);
        fields.push(`**${getEmoji('settings')} ${h.rateLimitLabel}:** ${(h.rateLimitRule).replace('{seconds}', RATE_LIMIT_CONFIG.cooldownTime / 1000)}`);
        const remaining = RATE_LIMIT_CONFIG.maxViolationsBeforeDiscordTimeout - rateLimitInfo.violations;
        fields.push(`> ${(h.warningNextLevel).replace('{count}', remaining)}`);
    }

    if (userInfoData) {
        fields.push(`**${getEmoji('chart')} ${h.userStatsLabel}:**\nTotal FAQ Requests: ${userInfoData.totalRequests}\nFirst Seen: <t:${Math.floor(userInfoData.firstSeen.getTime() / 1000)}:R>`);
    }

    const sections = [description];
    if (fields.length > 0) sections.push(fields.join('\n'));

    return buildCard({
        title,
        tone,
        sections,
        thumbnailURL: user.displayAvatarURL({ dynamic: true, size: 256 }),
        _footer: h.footerTimeout
    });
}

const createRateLimitEmbed = createRateLimitCard;


const cleanupIntervalTimer = setInterval(() => {
    const now = Date.now();
    const cutoffTime = now - (24 * 60 * 60 * 1000);
    
    for (const [userId, userData] of userCooldowns.entries()) {
        if (userData.blockedUntil < now && userData.lastUsed < cutoffTime) {
            userCooldowns.delete(userId);
        }
    }
    
    const userInfoCutoff = now - (7 * 24 * 60 * 60 * 1000);
    for (const [userId, userInfoData] of userInfo.entries()) {
        if (userInfoData.lastSeen.getTime() < userInfoCutoff) {
            userInfo.delete(userId);
        }
    }
}, RATE_LIMIT_CONFIG.cleanupInterval);
if (cleanupIntervalTimer?.unref) cleanupIntervalTimer.unref();

function stop() {
    if (cleanupIntervalTimer) clearInterval(cleanupIntervalTimer);
}


function buildEnhancedContext(config, prompt, guild, user) {
    
    let contextPrompt = BASE_AI_PROMPT + "\n\n";
    
    
    const userInfoData = userInfo.get(user.id);
    if (userInfoData) {
        contextPrompt += `**USER CONTEXT:**\n`;
        contextPrompt += `• User: ${userInfoData.displayName} (${userInfoData.tag})\n`;
        contextPrompt += `• Total FAQ Requests: ${userInfoData.totalRequests}\n`;
        contextPrompt += `• Member since: ${userInfoData.firstSeen.toLocaleDateString()}\n`;
        if (userInfoData.joinedAt) {
            contextPrompt += `• Joined server: ${userInfoData.joinedAt.toLocaleDateString()}\n`;
        }
        contextPrompt += "\n";
    }
    
    
    if (config.context?.serverDescription) {
        contextPrompt += `**SERVER CONTEXT:**\n${config.context.serverDescription}\n\n`;
    }
    
    
    if (config.context?.customInstructions) {
        contextPrompt += `**CUSTOM INSTRUCTIONS:**\n${config.context.customInstructions}\n\n`;
    }
    
    
    if (config.serverMetadata) {
        contextPrompt += `**SERVER DETAILS:**\n`;
        contextPrompt += `• Server: ${config.serverMetadata.serverName}\n`;
        contextPrompt += `• Members: ${config.serverMetadata.memberCount}\n`;
        contextPrompt += `• Channels: ${config.serverMetadata.channelCount}\n`;
        contextPrompt += `• Roles: ${config.serverMetadata.roleCount}\n\n`;
        
        
        if (config.serverMetadata.channels?.length > 0) {
            const channelsByType = {};
            config.serverMetadata.channels.forEach(channel => {
                const type = getChannelTypeForContext(channel.type);
                if (!channelsByType[type]) channelsByType[type] = [];
                channelsByType[type].push(channel);
            });
            
            contextPrompt += `**IMPORTANT CHANNELS:**\n`;
            Object.entries(channelsByType).forEach(([type, channels]) => {
                if (channels.length > 0) {
                    
                    const channelList = channels.slice(0, 8).map(ch => {
                        const guildChannel = guild?.channels?.cache?.get(ch.id);
                        if (guildChannel) {
                            return `<#${ch.id}>`; 
                        }
                        return `#${ch.name}`; 
                    }).join(', ');
                    contextPrompt += `${type}: ${channelList}\n`;
                }
            });
            contextPrompt += "\n";
        }
        
        
        if (config.serverMetadata.roles?.length > 0) {
            const importantRoles = config.serverMetadata.roles
                .filter(role => role.name !== '@everyone' && !role.name.toLowerCase().includes('bot'))
                .slice(0, 12);
            
            if (importantRoles.length > 0) {
                
                const roleList = importantRoles.map(role => {
                    const guildRole = guild?.roles?.cache?.get(role.id);
                    if (guildRole) {
                        return `@${role.name}`; 
                    }
                    return role.name; 
                }).join(', ');
                contextPrompt += `**KEY ROLES:** ${roleList}\n\n`;
            }
        }
    }
    
    
    if (config.links?.length > 0) {
        contextPrompt += `**AVAILABLE RESOURCES:**\n`;
        const linksByType = {};
        config.links.forEach(link => {
            const type = link.type.charAt(0).toUpperCase() + link.type.slice(1);
            if (!linksByType[type]) linksByType[type] = [];
            linksByType[type].push(link);
        });
        
        Object.entries(linksByType).forEach(([type, links]) => {
            contextPrompt += `${type}: `;
            links.forEach((link, index) => {
                contextPrompt += `[${link.name}](${link.url})`;
                if (index < links.length - 1) contextPrompt += ', ';
            });
            contextPrompt += '\n';
        });
        contextPrompt += "\n";
    }
    
    
    contextPrompt += `**USER QUESTION:** "${prompt}"\n\n`;
    
    
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('welcome') || lowerPrompt.includes('getting started')) {
        contextPrompt += `**SPECIAL CONTEXT:** This appears to be a welcome/getting started question. Provide a warm, comprehensive welcome with key channels, roles, and resources.\n\n`;
    } else if (lowerPrompt.includes('tutorial') || lowerPrompt.includes('guide') || lowerPrompt.includes('how to')) {
        contextPrompt += `**SPECIAL CONTEXT:** This is a tutorial request. Focus on step-by-step guidance and relevant links.\n\n`;
    } else if (lowerPrompt.includes('channel') || lowerPrompt.includes('where')) {
        contextPrompt += `**SPECIAL CONTEXT:** User is looking for specific channels or locations. Emphasize channel mentions and navigation.\n\n`;
    } else if (lowerPrompt.includes('feature') || lowerPrompt.includes('bot') || lowerPrompt.includes('aio')) {
        contextPrompt += `**SPECIAL CONTEXT:** This is about bot features. Focus on AIO Bot capabilities and relevant setup information.\n\n`;
    }
    
    contextPrompt += `**RESPONSE REQUIREMENTS:**
- Write in natural, conversational language (NO JSON or code blocks!)
- Use Discord markdown formatting appropriately
- Keep your main response under 1800 characters
- Structure information clearly with **bold headers**
- For channels: Use <#channelId> format ONLY if the channel exists in the server
- For roles: Use @RoleName format (without <@&>) to avoid pinging members
- NEVER ping users or roles - use role names like @Moderator instead of <@&roleId>
- Be welcoming, helpful, and informative
- End with an offer for further assistance if needed`;
    
    return contextPrompt;
}

function getChannelTypeForContext(type) {
    const typeMap = {
        '0': 'Text',
        '2': 'Voice', 
        '4': 'Category',
        '5': 'Announcement',
        '13': 'Stage',
        '15': 'Forum'
    };
    return typeMap[type] || 'Other';
}


function createAdvancedResponseCard(aiResponse, config, guild, prompt, user) {
    const userInfoData = userInfo.get(user.id);
    let embedColor = EMBED_COLORS.default;
    let embedTitle = 'FAQ Response';
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('welcome') || lowerPrompt.includes('getting started')) {
        embedColor = EMBED_COLORS.welcome;
        embedTitle = `Welcome to ${guild.name}!`;
    } else if (lowerPrompt.includes('tutorial') || lowerPrompt.includes('guide') || lowerPrompt.includes('how to')) {
        embedColor = EMBED_COLORS.tutorial;
        embedTitle = 'Tutorial & Guide';
    } else if (lowerPrompt.includes('link') || lowerPrompt.includes('resource')) {
        embedColor = EMBED_COLORS.links;
        embedTitle = 'Server Resources';
    } else if (lowerPrompt.includes('channel') || lowerPrompt.includes('where')) {
        embedColor = EMBED_COLORS.server;
        embedTitle = 'Server Navigation';
    } else if (lowerPrompt.includes('feature') || lowerPrompt.includes('aio') || lowerPrompt.includes('bot')) {
        embedColor = EMBED_COLORS.features;
        embedTitle = 'AIO Bot Features';
    } else if (lowerPrompt.includes('help') || lowerPrompt.includes('support')) {
        embedColor = EMBED_COLORS.info;
        embedTitle = 'Help & Support';
    }
    
    
    let processedResponse;
    if (isJsonResponse(aiResponse)) {
        const convertedResponse = convertJsonToNatural(aiResponse, guild, user);
        processedResponse = parseAdvancedResponse(convertedResponse);
    } else {
        processedResponse = parseAdvancedResponse(aiResponse);
    }
    
    let description = processedResponse.description || 'No response generated.';
    description = fixMentionsInText(description, guild);
    const sections = [description];
    
    if (processedResponse.fields && processedResponse.fields.length > 0) {
        const fieldsText = processedResponse.fields
            .slice(0, 25)
            .map(field => `**${field.name.substring(0, 256)}**\n${fixMentionsInText(field.value || '', guild).substring(0, 1024)}`)
            .join('\n\n');
        if (fieldsText) sections.push(fieldsText);
    }
    
    const nextRequestTime = Math.floor((Date.now() + RATE_LIMIT_CONFIG.cooldownTime) / 1000);
    let footerText = `Query #${config.usage?.totalQueries || 0}`;
    if (userInfoData) {
        footerText += ` • ${user.displayName}'s request #${userInfoData.totalRequests}`;
    }
    footerText += ` • Next request <t:${nextRequestTime}:R>`;
    
    return buildCard({
        title: `${getEmoji('bulb')} ${embedTitle}`,
        sections,
        thumbnailURL: guild?.iconURL({ dynamic: true, size: 256 }) || null,
        accentColor: embedColor,
        _footer: footerText
    });
}

const createAdvancedResponseEmbed = createAdvancedResponseCard;


function parseAdvancedResponse(response) {
    const result = {
        description: '',
        fields: []
    };
    
    if (!response || typeof response !== 'string') {
        return result;
    }
    
    
    let cleanResponse = response
        .replace(/```json\s*[\s\S]*?```/gi, '') 
        .replace(/```[\s\S]*?```/g, '') 
        .replace(/``````/g, '') 
        .trim();
    
    
    const sections = cleanResponse.split(/\n\s*\n/);
    let mainContent = '';
    let currentField = null;
    
    for (let section of sections) {
        section = section.trim();
        if (!section) continue;
        
        
        const boldHeaderMatch = section.match(/^\*\*([^*]+)\*\*\s*\n?([\s\S]*)/);
        if (boldHeaderMatch && boldHeaderMatch[1].length < 100 && boldHeaderMatch[2].trim()) {
            
            if (currentField && currentField.value.trim()) {
                result.fields.push(currentField);
            }
            
            currentField = {
                name: boldHeaderMatch[1],
                value: boldHeaderMatch[2].trim(),
                inline: false
            };
        } else if (section.match(/^[•\-\*]\s/)) {
            
            if (currentField) {
                currentField.value += '\n' + section;
            } else {
                mainContent += section + '\n';
            }
        } else if (section.length > 0) {
            
            if (!currentField && mainContent.length < 1500) {
                mainContent += section + '\n\n';
            } else if (currentField) {
                currentField.value += '\n' + section;
            } else {
                
                if (currentField) result.fields.push(currentField);
                currentField = {
                    name: 'Additional Information',
                    value: section,
                    inline: false
                };
            }
        }
    }
    
    
    if (currentField && currentField.value.trim()) {
        result.fields.push(currentField);
    }
    
    result.description = mainContent.trim();
    
    
    if (result.description.length > 2048) {
        const overflow = result.description.substring(2048);
        result.description = result.description.substring(0, 2045) + '...';
        
        if (result.fields.length < 25) {
            result.fields.unshift({
                name: 'Additional Information',
                value: overflow.substring(0, 1024),
                inline: false
            });
        }
    }
    
    return result;
}


function isJsonResponse(response) {
    try {
        const trimmed = response.trim();
        return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
               (trimmed.startsWith('[') && trimmed.endsWith(']'));
    } catch {
        return false;
    }
}

function convertJsonToNatural(jsonResponse, guild, user) {
    try {
        const data = JSON.parse(jsonResponse);
        
        let naturalResponse = '';
        
        if (data.title) {
            naturalResponse += `**${data.title}**\n\n`;
        }
        
        if (data.description) {
            naturalResponse += data.description + '\n\n';
        }
        
        if (data.fields && Array.isArray(data.fields)) {
            data.fields.forEach(field => {
                if (field.name && field.value) {
                    naturalResponse += `**${field.name}**\n${field.value}\n\n`;
                }
            });
        }
        
        if (!naturalResponse.trim()) {
            naturalResponse = `Hello ${user.displayName}! Welcome to ${guild.name}. I'd be happy to help you get started. What would you like to know about our server?`;
        }
        
        return naturalResponse.trim();
    } catch (error) {
        console.error('[FAQHandler] Error converting JSON to natural language:', error);
        return `Hello ${user.displayName}! I encountered an issue processing your request, but I'm here to help! What would you like to know about our server?`;
    }
}


function fixMentionsInText(text, guild) {
    if (!text || typeof text !== 'string' || !guild) return text;

    text = text.replace(/<@(\d{17,19})>/g, (match, id) => {
        
        const channel = guild.channels.cache.get(id);
        if (channel) {
            return `<#${id}>`; 
        }
        
        const role = guild.roles.cache.get(id);
        if (role && role.name !== '@everyone') {
            return `@${role.name}`; 
        }
        
        const member = guild.members.cache.get(id);
        if (member) {
            return `@${member.displayName}`; 
        }
        return match; 
    });
    
    
    text = text.replace(/<#(\d{17,19})>/g, (match, id) => {
        const channel = guild.channels.cache.get(id);
        if (channel) {
            return match; 
        }
        
        
        return `#channel-${id.slice(-6)}`; 
    });
    
    
    text = text.replace(/<@&(\d{17,19})>/g, (match, id) => {
        const role = guild.roles.cache.get(id);
        if (role && role.name !== '@everyone') {
            return `@${role.name}`; 
        }
        return match; 
    });
    
    
    text = text.replace(/<@!?(\d{17,19})>/g, (match, id) => {
        const member = guild.members.cache.get(id);
        if (member) {
            return `@${member.displayName}`; 
        }
        return match; 
    });
    
    return text;
}


async function getFaqResponse(prompt, guildId, channelId, guild, user) {
    try {
        
        const { getFaqConfig } = require('../utils/cacheHelpers');
        const config = await getFaqConfig(guildId);
        if (!config) return null;

        
        const contextPrompt = buildEnhancedContext(config, prompt, guild, user);

        
        const startTime = Date.now();
        
        try {
            const response = await aiManager.generateContent(guildId, contextPrompt, {
                timeout: 30000 
            });

            const responseTime = Date.now() - startTime;

            
            const aiResponse = response.text();
            
            if (!aiResponse || aiResponse.trim().length === 0) {
                console.warn('[FAQHandler] Empty response from AI for guild:', guildId);
                return createErrorEmbed("No Response Generated", "Please try rephrasing your question.", guild);
            }

            
            if (responseTime > 5000) {
                console.log(`[FAQHandler] Slow response: ${responseTime}ms for guild ${guildId}`);
            }

            
            config.incrementUsage().catch(err => {
                console.error('[FAQHandler] Error incrementing usage stats:', err);
            });

            
            return createAdvancedResponseEmbed(aiResponse, config, guild, prompt, user);
        } catch (aiError) {
            const responseTime = Date.now() - startTime;
            console.error(`[FAQHandler] AI generation failed after ${responseTime}ms:`, aiError.message);
            throw aiError; 
        }

    } catch (error) {
        console.error('[FAQHandler] Error getting FAQ response:', error.message);
        
        
        let errorCode = null;
        let errorStatus = null;
        try {
            
            const jsonMatch = error.message.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const errorObj = JSON.parse(jsonMatch[0]);
                if (errorObj.error) {
                    errorCode = errorObj.error.code;
                    errorStatus = errorObj.error.status;
                }
            }
        } catch (parseError) {
            
        }
        
        
        if (error.message.includes('No active Gemini API keys')) {
            return createErrorEmbed(
                "FAQ System Unavailable", 
                "No API keys are currently available. Please contact an administrator.", 
                guild
            );
        }
        
        
        if (errorCode === 503 || errorStatus === 'UNAVAILABLE' || 
            error.message.includes('overloaded') || error.message.includes('503') ||
            error.message.includes('UNAVAILABLE')) {
            return createErrorEmbed(
                "AI Service Temporarily Overloaded", 
                "The AI service is currently experiencing high load. Please try again in a few moments. The system will automatically retry with other keys.", 
                guild
            );
        }
        
        if (error.message.includes('rate limited') || error.message.includes('quota') || 
            error.message.includes('limit') || errorCode === 429) {
            return createErrorEmbed(
                "High Demand", 
                "The FAQ system is experiencing high demand. Please try again in a moment.", 
                guild
            );
        }
        
        if (error.message.includes('Content blocked') || error.message.includes('safety')) {
            return createErrorEmbed(
                "Content Filtered", 
                "Your question was filtered by safety systems. Please rephrase your question.", 
                guild
            );
        }
        
        if (error.message.includes('Timeout') || errorCode === 408) {
            return createErrorEmbed(
                "Request Timeout", 
                "The AI response took too long. Please try again with a shorter question.", 
                guild
            );
        }
        
        
        return createErrorEmbed(
            "Error Processing Request", 
            "An error occurred while processing your question. Please try again in a moment or contact support if the issue persists.", 
            guild
        );
    }
}


function createErrorCard(title, description, guild) {
    return buildCard({
        title: `${getEmoji('cross')} ${title}`,
        tone: 'danger',
        sections: [description],
        thumbnailURL: guild?.iconURL({ dynamic: true, size: 256 }) || null,
        _footer: guild ? `${guild.name} FAQ Assistant` : null
    });
}

const createErrorEmbed = createErrorCard;


async function handleFaqMessage(message) {
    if (message.author.bot || !message.guild) return false;
    
    
    const { getFaqConfig } = require('../utils/cacheHelpers');
    const config = await getFaqConfig(message.guild.id);
    if (!config || !config.enabled) return false;
    
    const isChannelEnabled = await FaqConfig.isChannelEnabled(message.guild.id, message.channel.id);
    if (!isChannelEnabled) return false;
    
    const prefix = config.prefix || '?';
    if (!message.content.startsWith(prefix)) return false;
    
    const question = message.content.slice(prefix.length).trim();
    if (!question || question.length < 3) {
        const lang = loadLanguage(message.guild.id);
        const helpCard = buildCard({
            title: `${getEmoji('bulb')} ${lang.faq?.handler?.helpTitle}`,
            tone: 'warning',
            sections: [
                (lang.faq?.handler?.helpDesc).replace('{prefix}', prefix)
            ],
            thumbnailURL: message.guild.iconURL({ dynamic: true, size: 256 }) || null,
            _footer: (lang.faq?.handler?.helpFooter).replace('{guild}', message.guild.name)
        });
        
        await message.reply({ 
            components: [helpCard],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        }).catch(err => {
            console.error('[FAQHandler] Error sending help card:', err);
        });
        return true;
    }
    
    
    updateUserInfo(message.author);
    const member = message.member;
    const rateLimitCheck = await checkRateLimit(message.author.id, member, message.guild);
    
    if (!rateLimitCheck.allowed) {
        const rateLimitCard = createRateLimitCard(message.author, rateLimitCheck);
        await message.reply({ 
            components: [rateLimitCard],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        }).catch(err => {
            console.error('[FAQHandler] Error sending rate limit card:', err);
        });
        
        
        const timeoutType = rateLimitCheck.reason === 'DISCORD_TIMEOUT' ? 'Discord Timeout' : 'Virtual Timeout';
        console.log(`[FAQHandler] ${timeoutType.toUpperCase()} - User ${message.author.tag} (${message.author.id}) blocked for ${rateLimitCheck.timeLeft}s. Violations: ${rateLimitCheck.violations}, Type: ${rateLimitCheck.timeoutType || 'moderate'}`);
        
        return true;
    }
    
    await message.channel.sendTyping();
    
    try {
        const responseCard = await getFaqResponse(question, message.guild.id, message.channel.id, message.guild, message.author);
        
        if (responseCard) {
            await message.reply({ 
                components: [responseCard],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            }).catch(err => {
                console.error('[FAQHandler] Error replying to FAQ message:', err);
            });
            console.log(`[FAQ] ${message.author.tag} asked: "${question.substring(0, 50)}${question.length > 50 ? '...' : ''}"`);
        } else {
            const lang = loadLanguage(message.guild.id);
            const noResponseCard = createErrorCard(
                lang.faq?.handler?.unableToGenerateTitle, 
                lang.faq?.handler?.unableToGenerateDesc, 
                message.guild
            );
            await message.reply({ 
                components: [noResponseCard],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            }).catch(err => {
                console.error('[FAQHandler] Error sending no response card:', err);
            });
        }
        
        return true;
    } catch (error) {
        console.error('[FAQHandler] Error handling FAQ message:', error);
        const lang = loadLanguage(message.guild.id);
        const errorCard = createErrorCard(
            lang.faq?.handler?.errorProcessingTitle, 
            lang.faq?.handler?.errorProcessingDesc, 
            message.guild
        );
        await message.reply({ 
            components: [errorCard],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        }).catch(err => {
            console.error('[FAQHandler] Error sending error card:', err);
        });
        return true;
    }
}


function getUserStats(userId) {
    const cooldownData = userCooldowns.get(userId);
    const userInfoData = userInfo.get(userId);
    
    return {
        cooldown: cooldownData,
        info: userInfoData,
        nextRequestIn: getRemainingCooldown(userId),
        isDiscordTimedOut: cooldownData?.discordTimeoutApplied || false
    };
}

function getAllActiveUsers() {
    const stats = {
        totalUsers: userInfo.size,
        virtualTimeouts: 0,
        discordTimeouts: 0,
        timedOutUsers: 0,
        activeRequests: 0
    };
    
    const now = Date.now();
    for (const [userId, data] of userCooldowns.entries()) {
        if (data.blockedUntil > now) {
            stats.timedOutUsers++;
            if (data.discordTimeoutApplied) {
                stats.discordTimeouts++;
            } else {
                stats.virtualTimeouts++;
            }
        }
        stats.activeRequests += data.requestCount;
    }
    
    return stats;
}


function clearUserCooldown(userId) {
    const userData = userCooldowns.get(userId);
    if (userData) {
        userCooldowns.set(userId, {
            ...userData,
            blockedUntil: 0,
            violations: 0,
            discordTimeoutApplied: false
        });
        return true;
    }
    return false;
}

function getUserViolations(userId) {
    const userData = userCooldowns.get(userId);
    return userData ? userData.violations : 0;
}

function setUserViolations(userId, violations) {
    const userData = userCooldowns.get(userId);
    if (userData) {
        userCooldowns.set(userId, {
            ...userData,
            violations: Math.max(0, violations)
        });
        return true;
    }
    return false;
}

function getRateLimitStats() {
    const now = Date.now();
    const stats = {
        totalTrackedUsers: userCooldowns.size,
        currentlyBlocked: 0,
        virtualTimeouts: 0,
        discordTimeouts: 0,
        highViolationUsers: 0,
        totalViolations: 0,
        averageViolations: 0
    };
    
    let totalViolations = 0;
    let userCount = 0;
    
    for (const [userId, data] of userCooldowns.entries()) {
        totalViolations += data.violations;
        userCount++;
        
        if (data.violations >= RATE_LIMIT_CONFIG.maxViolationsBeforeDiscordTimeout) {
            stats.highViolationUsers++;
        }
        
        if (data.blockedUntil > now) {
            stats.currentlyBlocked++;
            if (data.discordTimeoutApplied) {
                stats.discordTimeouts++;
            } else {
                stats.virtualTimeouts++;
            }
        }
    }
    
    stats.totalViolations = totalViolations;
    stats.averageViolations = userCount > 0 ? (totalViolations / userCount).toFixed(2) : 0;
    
    return stats;
}


function createAdminStatsCard(guild) {
    const stats = getRateLimitStats();
    const globalStats = getAllActiveUsers();
    const lang = loadLanguage(guild?.id);
    const h = lang.faq?.handler || {};
    
    return buildCard({
        title: `${getEmoji('chart')} ${h.adminStatsTitle}`,
        tone: 'info',
        sections: [
            h.adminStatsDesc,
            [
                `**${getEmoji('user')} ${h.totalUsersLabel}:** ${globalStats.totalUsers} tracked users`,
                `**${getEmoji('cross')} ${h.currentlyBlockedLabel}:** ${stats.currentlyBlocked} users`,
                `**${getEmoji('timer')} ${h.virtualTimeoutsLabel}:** ${stats.virtualTimeouts} users`,
                `**${getEmoji('lock')} ${h.discordTimeoutsLabel}:** ${stats.discordTimeouts} users`,
                `**${getEmoji('warn')} ${h.highViolationUsersLabel}:** ${stats.highViolationUsers} users (3+ violations)`,
                `**${getEmoji('analytics')} ${h.totalViolationsLabel}:** ${stats.totalViolations} violations`,
                `**${getEmoji('chart')} ${h.averageViolationsLabel}:** ${stats.averageViolations} per user`,
                `**${getEmoji('chat')} ${h.totalRequestsLabel}:** ${globalStats.activeRequests} FAQ requests`
            ].join('\n'),
            (h.settingsDesc)
                .replace('{cooldown}', String(RATE_LIMIT_CONFIG.cooldownTime / 1000))
                .replace('{threshold}', String(RATE_LIMIT_CONFIG.maxViolationsBeforeDiscordTimeout))
        ],
        thumbnailURL: guild?.iconURL({ dynamic: true, size: 256 }) || null,
        _footer: `FAQ Rate Limiting System • ${guild?.name || 'Fluenosity'}`
    });
}

const createAdminStatsEmbed = createAdminStatsCard;

module.exports = {
    handleFaqMessage,
    getFaqResponse,
    getUserStats,
    getAllActiveUsers,
    RATE_LIMIT_CONFIG,
    applyDiscordTimeout,
    clearUserCooldown,
    getUserViolations,
    setUserViolations,
    getRateLimitStats,
    createAdminStatsEmbed,
    createAdminStatsCard,
    createRateLimitCard,
    createErrorCard,
    createAdvancedResponseCard,
    stop
};
