const { Client, GatewayIntentBits, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const NqnConfig = require('../models/nqn/nqnSchema');
const messageMiddleware = require('../utils/messageMiddleware');
const cacheManager = require('../utils/cacheManager');
const { downloadDiscordEmoji } = require('../utils/nqnEmojiDownload');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => global.fetch(...args)); 


async function getNqnConfig(guildId) {
    
    const cached = cacheManager.get('nqnConfig', guildId);
    if (cached !== null) {
        return cached;
    }

    if (mongoose.connection?.readyState !== 1) return false;
    try {
        const config = await NqnConfig.findOne({ serverId: guildId, status: true });
        
        
        const result = config ? {
            status: config.status,
            ownerId: config.ownerId,
            updatedAt: config.updatedAt
        } : false;
        
        cacheManager.set('nqnConfig', guildId, result);
        return result;
    } catch (error) {
        console.error(`[NQN] Error loading config for ${guildId}:`, error);
        
        cacheManager.set('nqnConfig', guildId, false);
        return false;
    }
}

async function getUniqueEmojiName(guild, baseName) {
    if (!guild.emojis.cache.some(emoji => emoji.name === baseName)) {
        return baseName; 
    }
    
    let counter = 1;
    let newName;
    
    do {
        newName = `${baseName}${counter}`;
        counter++;
    } while (guild.emojis.cache.some(emoji => emoji.name === newName));
    
    return newName;
}

function hasNitro(member) {
    if (!member) return false;

    if (member.premiumSince !== null) {
        return true;
    }

    return false;
}

module.exports = async (client) => {
    
    const unregisterMiddleware = messageMiddleware.use(async (message, next) => {
        
        if (message.author.bot || !message.guild) {
            await next();
            return false;
        }

        const guildId = message.guild.id;
        
        
        const settings = await getNqnConfig(guildId);
        if (!settings || !settings.status) {
            await next();
            return false;
        }

        console.log(`\x1b[36m[NQN]\x1b[0m Processing message in server ${guildId} - NQN is ${settings.status ? 'enabled' : 'disabled'}`);

        
        let userHasNitro = false;
        try {
            userHasNitro = hasNitro(message.member);
            console.log(`\x1b[36m[NQN]\x1b[0m User ${message.author.tag} Nitro status: ${userHasNitro ? 'HAS NITRO' : 'NO NITRO'}`);
        } catch (error) {
            console.error('[NQN] Error checking Nitro status:', error);
        }

 
        if (message.content.toLowerCase().startsWith('nqnlist')) {
            
            const otherServerEmojis = [];
            const currentServerEmojiNames = new Set(message.guild.emojis.cache.map(e => e.name));
            
            client.guilds.cache.forEach(guild => {
                if (guild.id !== message.guild.id) {
                    guild.emojis.cache.forEach(emoji => {
                        if (!currentServerEmojiNames.has(emoji.name)) {
                            otherServerEmojis.push({
                                name: emoji.name,
                                emoji: emoji.toString(),
                                serverName: guild.name,
                                animated: emoji.animated
                            });
                        }
                    });
                }
            });
            
            if (otherServerEmojis.length === 0) {
                return message.reply('No emojis found from other servers that you don\'t already have!');
            }
            
            
            const sample = otherServerEmojis.slice(0, 20);
            let response = '**Available emojis from other servers:**\n\n';
            sample.forEach(e => {
                response += `${e.emoji} \`:${e.name}:\` from ${e.serverName}\n`;
            });
            
            if (otherServerEmojis.length > 20) {
                response += `\n... and ${otherServerEmojis.length - 20} more!`;
            }
            
            return message.reply(response);
        }

        if (message.content.toLowerCase().startsWith('nqnadd ')) {
            if (!message.member.permissions.has('ManageEmojisAndStickers')) {
                return message.reply('You need the "Manage Emojis and Stickers" permission to add emojis.');
            }
            
            const customEmojiRegex = /<(a)?:([^:]+):(\d+)>/;
            const emojiMatch = message.content.match(customEmojiRegex);
            
            if (emojiMatch) {
                try {
                    const isAnimated = emojiMatch[1] === 'a';
                    const emojiName = emojiMatch[2];
                    const emojiId = emojiMatch[3];
                    
                    const fileExtension = isAnimated ? 'gif' : 'png';
                    const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${fileExtension}`;
                    
                    const uniqueEmojiName = await getUniqueEmojiName(message.guild, emojiName);
                    
                    const buffer = await downloadDiscordEmoji(emojiUrl, fetch);
                    
                    
                    const newEmoji = await message.guild.emojis.create({
                        attachment: buffer,
                        name: uniqueEmojiName
                    }, `Added by ${message.author.tag} via NQN`);
                    
                    return message.reply(`Successfully added emoji ${newEmoji} with name \`:${uniqueEmojiName}:\``);
                } catch (error) {
                    console.error('[NQN] Error adding emoji:', error);
                    return message.reply('Failed to add the emoji. Check the bot permissions and try again.').catch(() => {});
                }
            } else {
                const textEmojiRegex = /:(\w+):/;
                const textMatch = message.content.match(textEmojiRegex);
                
                if (textMatch) {
                    const emojiName = textMatch[1];
                    
                    const emojiGuilds = client.guilds.cache;
                    const foundEmoji = emojiGuilds
                        .map(guild => guild.emojis.cache.find(e => e.name === emojiName))
                        .find(e => e);
                    
                    if (foundEmoji) {
                        try {
                            const uniqueEmojiName = await getUniqueEmojiName(message.guild, emojiName);
                            
                            const isAnimated = foundEmoji.animated;
                            
                            const fileExtension = isAnimated ? 'gif' : 'png';
                            const emojiUrl = `https://cdn.discordapp.com/emojis/${foundEmoji.id}.${fileExtension}`;
                            
                            const buffer = await downloadDiscordEmoji(emojiUrl, fetch);
                            
                            
                            const newEmoji = await message.guild.emojis.create({
                                attachment: buffer,
                                name: uniqueEmojiName
                            }, `Added by ${message.author.tag} via NQN`);
                            
                            return message.reply(`Successfully added emoji ${newEmoji} with name \`:${uniqueEmojiName}:\``);
                        } catch (error) {
                            console.error('Error adding emoji:', error);
                        }
                    } else {
                        
                    }
                } else {
                   
                }
            }
        }
        
 
        if (message.content.toLowerCase().startsWith('nqnreact ')) {
            const emojiRegex = /:(\w+):/g;
            const matches = [...message.content.matchAll(emojiRegex)];
            
            if (matches.length > 0 && message.reference && message.reference.messageId) {
                try {
                    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    
                    let reactSuccess = false;
                    
                    for (const [_, emojiName] of matches) {
                        const emoji = client.guilds.cache
                            .map(guild => guild.emojis.cache.find(e => e.name === emojiName))
                            .find(e => e);
                        
                        if (emoji) {
                            await repliedMessage.react(emoji.id);
                            reactSuccess = true;
                        }
                    }
                    
                    if (reactSuccess) {
                        try {
                            await message.delete();
                        } catch (deleteError) {
                            console.error('Failed to delete the reaction command message:', deleteError);
                        }
                    } else {
                        const lang = loadLanguage(message.guild?.id);
                        const card = buildCard({
                            title: `${getEmoji('cross')} ${lang.setups?.nqn?.notFound || lang.nqn?.notFound }`,
                            tone: 'danger'
                        });
                        await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                    }
                } catch (error) {
                    console.error('Failed to process reaction command:', error);
                    const lang = loadLanguage(message.guild?.id);
                    const card = buildCard({
                        title: `${getEmoji('cross')} Reaction Error`,
                        tone: 'danger',
                        sections: [lang.errorGeneric || 'An error occurred while processing this reaction.']
                    });
                    await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                }
                
                return;
            }
        }

        if (userHasNitro) {
            console.log(`\x1b[33m[NQN]\x1b[0m Skipping NQN for Nitro user ${message.author.tag}`);
            await next();
            return false;
        }

        const textEmojiRegex = /:(\w+):/g;
        const discordEmojiRegex = /<(a)?:([^:]+):(\d+)>/g;
        
        const textMatches = [...message.content.matchAll(textEmojiRegex)];
        const discordMatches = [...message.content.matchAll(discordEmojiRegex)];
        
        console.log(`\x1b[36m[NQN]\x1b[0m Found ${textMatches.length} text emojis and ${discordMatches.length} discord emojis`);
        
        let shouldReplaceMessage = false;
        let newContent = message.content;
        
        
        if ((textMatches.length > 0 || discordMatches.length > 0) && !userHasNitro) {
            const guildEmojis = message.guild.emojis.cache;
            const emojiGuilds = client.guilds.cache;
            
            
            for (const [fullMatch, emojiName] of textMatches) {
                console.log(`\x1b[36m[NQN]\x1b[0m Checking emoji :${emojiName}:`);
                
                
                if (message.content.includes(`<:${emojiName}:`) || message.content.includes(`<a:${emojiName}:`)) {
                    console.log(`\x1b[33m[NQN]\x1b[0m Skipping :${emojiName}: - already in Discord format`);
                    continue;
                }
                
                
                let emoji = guildEmojis.find(e => e.name === emojiName);
                let emojiSource = 'current server';
                
                
                if (!emoji) {
                    console.log(`\x1b[36m[NQN]\x1b[0m Searching for :${emojiName}: across ${emojiGuilds.size} servers...`);
                    emoji = emojiGuilds
                        .map(guild => guild.emojis.cache.find(e => e.name === emojiName))
                        .find(e => e);
                    emojiSource = emoji ? `other server "${emoji.guild.name}"` : null;
                }
                
                if (emoji) {
                    
                    console.log(`\x1b[32m[NQN]\x1b[0m ✅ Found emoji :${emojiName}: in ${emojiSource} (ID: ${emoji.id}, animated: ${emoji.animated})`);
                    newContent = newContent.replace(new RegExp(`:${emojiName}:`, 'g'), emoji.toString());
                    shouldReplaceMessage = true;
                } else {
                    console.log(`\x1b[33m[NQN]\x1b[0m ❌ Emoji :${emojiName}: not found in any server bot has access to`);
                }
            }

            if (discordMatches.length > 0) {
                for (const [fullMatch, isAnimated, emojiName, emojiId] of discordMatches) {
                    
                    const emoji = emojiGuilds
                        .map(guild => guild.emojis.cache.find(e => e.id === emojiId))
                        .find(e => e);
                    
                    if (emoji) {
                        
                        newContent = newContent.replace(fullMatch, emoji.toString());
                        shouldReplaceMessage = true;
                    }
                }
            }
            
            
            if (shouldReplaceMessage) {
                try {
                    console.log(`\x1b[32m[NQN]\x1b[0m Creating webhook to replace message...`);
                    
                    const webhook = await message.channel.createWebhook({
                        name: message.member.displayName,
                        avatar: message.author.displayAvatarURL(),
                    });
                    
                    
                    const webhookOptions = {
                        content: newContent,
                        username: message.member.displayName,
                        avatarURL: message.author.displayAvatarURL()
                    };
                    
                    
                    if (message.reference?.messageId) {
                        try {
                            await message.channel.messages.fetch(message.reference.messageId);
                            webhookOptions.reply = {
                                messageReference: message.reference.messageId,
                                failIfNotExists: false
                            };
                        } catch {
                            
                        }
                    }
                    
                    await webhook.send(webhookOptions);
                    await webhook.delete();
                    
                    try {
                        await message.delete();
                        console.log(`\x1b[32m[NQN]\x1b[0m ✅ Successfully replaced message with external emojis`);
                    } catch (deleteError) {
                        
                    }
                } catch (error) {
                    
                    if (!error.message?.includes('resolveId')) {
                        console.error('[NQN] Failed to create or send webhook message:', error);
                    }
                }
            } else {
                console.log(`\x1b[33m[NQN]\x1b[0m No emojis needed replacing`);
            }
        }
        
        
        await next();
        return false; 
    }, 35); 


    const configUpdatedListener = async (serverId) => {
        try {
            
            cacheManager.delete('nqnConfig', serverId);
        } catch (error) {
            console.error('[NQN] Error updating NQN config cache:', error);
        }
    };
    client.on('nqnConfigUpdated', configUpdatedListener);

    const readyListener = () => {
        console.log('[NQN] NQN Module Active with Enhanced Features');
    };
    client.once('clientReady', readyListener);

    const errorListener = (error) => {
        
    };
    client.on('error', errorListener);

    const unhandledRejectionListener = (reason, promise) => {
        
    };
    client.on('unhandledRejection', unhandledRejectionListener);

    return {
        stop() {
            unregisterMiddleware();
            client.off('nqnConfigUpdated', configUpdatedListener);
            client.off('clientReady', readyListener);
            client.off('error', errorListener);
            client.off('unhandledRejection', unhandledRejectionListener);
        }
    };
};
