const fs = require('fs').promises;
const path = require('path');
const { MessageFlags } = require('discord.js');
const { buildCard } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const CountingConfig = require('../models/counting/Schema');
const lang = require('./loadLanguage');
const afkHandlerFactory = require('../handlers/afkManager');
const stickyTimers = new Map();
const countingMessageQueues = new Map();
let cachedAfkHandler = null;


const stickyTimerCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of stickyTimers.entries()) {
        
        if (now - timestamp > 5 * 60 * 1000) {
            stickyTimers.delete(key);
        }
    }
}, 60 * 1000); 
stickyTimerCleanup.unref?.();
const { handleFaqMessage, stop: stopFaqHandler } = require('../handlers/faqHandler');
const messageMiddleware = require('../utils/messageMiddleware');
const { handleMessage: handleExcessCommand } = require('./excessCommands');
const { createCommandInteractionAdapter } = require('../utils/commandAdapter');


const {
    getServerConfig,
    getCountingConfig,
    getStickyMessage,
    getAutoResponders,
    getUserCustomCommands,
    getCustomCommands,
    isCommandDisabled,
    invalidateCountingConfig,
    invalidateStickyMessage
} = require('../utils/cacheHelpers');


let cachedConfig = null;
try {
    cachedConfig = require('../config.js');
} catch (err) {
    console.error('[CONFIG] Failed to load config.js:', err);
}


const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];


const unregisterCoreMessageMiddleware = messageMiddleware.use(async (message, next) => {
    
    if (message.author.bot || !message.guild) return true; 

    const guildId = message.guild.id;
    const channelId = message.channel.id;
    const content = message.content.toLowerCase().trim();

    
    const [faqHandled, serverConfig] = await Promise.allSettled([
        handleFaqMessage(message).catch(err => {
            console.error('FAQ handler error:', err);
            return false;
        }),
        getServerConfig(guildId)
    ]);

    
    if (faqHandled.status === 'fulfilled' && faqHandled.value) {
        return true; 
    }

    
    try {
        if (!cachedAfkHandler) {
            cachedAfkHandler = afkHandlerFactory(message.client);
        }
        const { handleAFKRemoval, handleMentions } = cachedAfkHandler;
        
        Promise.allSettled([
            handleAFKRemoval(message),
            handleMentions(message)
        ]).catch(err => console.error('AFK handler error:', err));
    } catch (afkError) {
        console.error('AFK handler error:', afkError);
    }

    
    const serverConfigValue = serverConfig.status === 'fulfilled' ? serverConfig.value : null;
    const prefix = serverConfigValue?.prefix || cachedConfig?.prefix;

    
    const [countingData, stickyMessage, autoResponders] = await Promise.allSettled([
        getCountingConfig(guildId, channelId),
        getStickyMessage(guildId, channelId),
        getAutoResponders(guildId)
    ]);

    
    if (countingData.status === 'fulfilled' && countingData.value) {
        
        if (/^\d+$/.test(message.content.trim())) {
            console.log(`[Counting] Processing: "${message.content.trim()}" in channel ${channelId} | Expected: ${countingData.value.currentCount + 1} | Config channelId: ${countingData.value.channelId}`);
        }
        try {
            await processCountingSystem(message, countingData.value, guildId, channelId);
        } catch (countingError) {
            console.error('[MessageCreate] Advanced counting system error:', countingError);
        }
    } else if (countingData.status === 'rejected') {
        console.error('[Counting] Config fetch rejected:', countingData.reason?.message || countingData.reason);
    }

    
    if (stickyMessage.status === 'fulfilled' && stickyMessage.value) {
        try {
            await processStickyMessage(message, stickyMessage.value);
        } catch (stickyError) {
            console.error('Enhanced sticky message error:', stickyError);
        }
    }

    
    if (autoResponders.status === 'fulfilled' && autoResponders.value && autoResponders.value.length > 0) {
        try {
            const handled = await processAutoResponders(message, autoResponders.value, channelId, content);
            if (handled) return true; 
        } catch (autoResponderError) {
            console.error('AutoResponder error:', autoResponderError);
        }
    }

    
    if (prefix && message.content.startsWith(prefix)) {
        try {
            const commandHandled = await processCommands(message, message.client, prefix);
            if (commandHandled) return true;
            const excessCommandHandled = await handleExcessCommand(message, message.client);
            if (excessCommandHandled) return true;
        } catch (commandError) {
            console.error('Command system error:', commandError);
            return true;
        }
    }

    await next(); 
    return false;
}, 10); 

module.exports = {
    name: 'messageCreate',
    stop: async () => {
        unregisterCoreMessageMiddleware();
        clearInterval(stickyTimerCleanup);
        stickyTimers.clear();
        stopFaqHandler();
        await Promise.allSettled(Array.from(countingMessageQueues.values()));
        countingMessageQueues.clear();
    },
    async execute(message, client) {
        
        
        if (message.guild && !message.author.bot && /^\d+$/.test(message.content.trim())) {
            const key = `${message.guild.id}:${message.channel.id}`;
            const previous = countingMessageQueues.get(key) || Promise.resolve();
            let queued;
            queued = previous.catch(() => {}).then(() => messageMiddleware.execute(message));
            countingMessageQueues.set(key, queued);
            try {
                await queued;
            } catch (error) {
                console.error(`[MessageCreate] Ordered numeric-message processing failed in ${key}:`, error);
            } finally {
                if (countingMessageQueues.get(key) === queued) countingMessageQueues.delete(key);
            }
            return;
        }
        await messageMiddleware.execute(message);
    },
};

async function processCountingSystem(message, countingData, guildId, channelId) {
    const userId = message.author.id;
    const content = message.content.trim();

    
    const errorDuration = (countingData.errorMessageDuration && countingData.errorMessageDuration >= 1000)
        ? countingData.errorMessageDuration
        : (countingData.errorMessageDuration > 0 ? countingData.errorMessageDuration * 1000 : 5000);

    const sendTempError = async (text) => {
        try {
            const errorMsg = await message.channel.send(text);
            setTimeout(() => errorMsg.delete().catch(() => { }), errorDuration);
        } catch (sendErr) {
            console.error('[Counting] Failed to send error message:', sendErr.message);
        }
    };

    
    if (!/^\d+$/.test(content)) {
        if (countingData.deleteWrongMessages) {
            await message.delete().catch(() => { });
        }
        if (countingData.showErrorMessages) {
            const cLang = lang(guildId)?.setups?.counting || {};
            await sendTempError(`${getEmoji('cross')} ${(cLang.numbersOnly || '{user}, please only send numbers!').replace('{user}', message.author.toString())}`);
        }
        return;
    }

    const userNumber = Number(content);
    if (!Number.isSafeInteger(userNumber)) {
        if (countingData.deleteWrongMessages) await message.delete().catch(() => {});
        if (countingData.showErrorMessages) {
            const expected = (Number(countingData.currentCount) || 0) + 1;
            await sendTempError(`${getEmoji('cross')} ${(lang(guildId)?.setups?.counting?.wrongNumber || '{user}, wrong number! Expected **{expected}** but got **{got}**.').replace('{user}', message.author.toString()).replace('{expected}', String(expected)).replace('{got}', content)}`);
        }
        return;
    }

    const outcome = await CountingConfig.applyCountMessage({
        serverId: guildId,
        channelId,
        userId,
        count: userNumber,
        messageId: message.id
    });
    if (outcome.error === 'duplicate') return;
    if (outcome.error === 'disabled') return;
    const currentConfig = outcome.config || countingData;
    if (!outcome.success) {
        if (currentConfig.deleteWrongMessages) await message.delete().catch(() => {});
        if (!currentConfig.showErrorMessages) return;
        const cLang = lang(guildId)?.setups?.counting || {};
        if (outcome.error === 'same_user_not_allowed') {
            await sendTempError(`${getEmoji('warning')} ${(cLang.countTwice || "{user}, you can't count twice in a row! Let someone else count.").replace('{user}', message.author.toString())}`);
        } else if (outcome.error === 'wrong_number' || outcome.error === 'contention') {
            await sendTempError(`${getEmoji('cross')} ${(cLang.wrongNumber || '{user}, wrong number! Expected **{expected}** but got **{got}**.').replace('{user}', message.author.toString()).replace('{expected}', String(outcome.expected ?? 1)).replace('{got}', String(userNumber))}`);
        } else if (outcome.error !== 'disabled') {
            console.error(`[Counting] Count update rejected: ${outcome.error}`);
        }
        return;
    }

    
    invalidateCountingConfig(guildId, channelId);

    
    if (MILESTONES.includes(userNumber)) {
        try {
            const milestone = await outcome.config.addMilestone(userNumber, userId);
            if (!milestone) throw Object.assign(new Error('milestone_already_recorded'), { alreadyRecorded: true });

            const cLang = lang(guildId)?.setups?.counting || {};
            const milestoneCard = buildCard({
                title: `${getEmoji('crown')} ${cLang.milestoneAchievedTitle || 'Milestone Achieved!'}` ,
                description: (cLang.milestoneAchievedDesc || 'Congratulations! The server reached **{number}** counts!').replace('{number}', userNumber),
                fields: [
                    { name: `${getEmoji('medal')} ${cLang.achievedByLabel || 'Achieved by'}`, value: `<@${userId}>`, inline: true },
                    { name: `${getEmoji('analytics')} ${cLang.totalMessagesLabel || 'Total Messages'}`, value: `${outcome.config.totalMessages}`, inline: true },
                    { name: `${getEmoji('loop')} ${cLang.timesResetLabel || 'Times Reset'}`, value: `${outcome.config.resetCount}`, inline: true }
                ],
                tone: 'success'
            });

            await message.channel.send({ components: [milestoneCard], flags: MessageFlags.IsComponentsV2 });
        } catch (milestoneErr) {
            if (!milestoneErr.alreadyRecorded) console.error('[Counting] Milestone handling error:', milestoneErr.message);
        }
    }

    
    const tickId = getEmoji('tick').match(/:(\d+)>/)?.[1]; if (tickId) await message.react(tickId).catch(() => { });
    if (userNumber % 100 === 0) {
        const crownId = getEmoji('crown').match(/:(\d+)>/)?.[1]; if (crownId) await message.react(crownId).catch(() => { });
    } else if (userNumber % 50 === 0) {
        const starId = getEmoji('star').match(/:(\d+)>/)?.[1]; if (starId) await message.react(starId).catch(() => { });
    } else if (userNumber % 25 === 0) {
        const starReactId = getEmoji('star').match(/:(\d+)>/)?.[1]; if (starReactId) await message.react(starReactId).catch(() => { });
    }
}

async function processStickyMessage(message, stickyMessage) {
    if (stickyMessage.ignoreBots && message.author.bot) return;

    
    const timerKey = `${stickyMessage.serverId}_${message.channel.id}`;
    if (stickyTimers.has(timerKey)) {
        
        return;
    }

    if (stickyMessage.timerMode === 'message') {
        await handleMessageBasedSticky(message, stickyMessage);
    } else if (stickyMessage.timerMode === 'time') {
        await handleTimeBasedSticky(message, stickyMessage);
    }
}

async function processAutoResponders(message, autoResponders, channelId, content) {

    for (const responder of autoResponders) {
        if (!responder.status) continue;
        if (!responder.channels.includes('all') && !responder.channels.includes(channelId)) continue;

        let match = false;
        const triggerLower = responder.trigger.toLowerCase();
        const contentLower = content.toLowerCase();

        if (responder.matchType === 'exact' && contentLower === triggerLower) match = true;
        else if (responder.matchType === 'partial' && contentLower.includes(triggerLower)) match = true;
        else if (responder.matchType === 'whole' && contentLower.trim() === triggerLower) match = true;

        if (!match) continue;

        if (responder.embedData) {
            try {
                const embedData = responder.embedData;

                
                const parseColor = (color) => {
                    if (!color) return '#2f3136';
                    if (typeof color === 'number') return color;
                    if (typeof color === 'string') {
                        if (color.startsWith('#')) return color;
                        
                        const num = parseInt(color, 10);
                        if (!isNaN(num)) return num;
                    }
                    return '#2f3136';
                };

                const card = buildCard({
                    title: embedData.title || undefined,
                    description: embedData.description || undefined,
                    fields: (Array.isArray(embedData.fields) && embedData.fields.length > 0) ? embedData.fields.map(field => ({
                        name: field.name,
                        value: field.value,
                        inline: field.inline ?? false
                    })) : undefined,
                    bannerURL: (typeof embedData.image === 'string' ? embedData.image : embedData.image?.url) || undefined,
                    _footer: embedData.footer?.text || undefined,
                    accentColor: embedData.color ? parseInt(String(embedData.color).replace('#', ''), 16) : undefined
                });

                await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            } catch (embedError) {
                console.error('AutoResponder Embed Error:', embedError);
                await message.reply(`${getEmoji('cross')} Invalid embed format in AutoResponder.`);
            }
        } else {
            await message.reply(responder.textResponse || `${getEmoji('tick')} AutoResponder triggered!`);
        }

        return true; 
    }
    return false; 
}

async function processCommands(message, client, prefix) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    
    const guildId = message.guild?.id;
    if (guildId) {
        const customCommands = await getCustomCommands(guildId);
        const customCommand = customCommands.find(cmd => cmd.commandName === commandName);

        if (customCommand) {
            await message.reply(customCommand.response);
            return true;
        }
    }

    
    let command = client.commands.get(commandName);
    if (!command) {
        command = client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    }
    if (command) {

        const canonicalCommandName = command.data?.name || command.name || commandName;
        if (await isCommandDisabled(guildId, canonicalCommandName)) {
            const guildLang = lang(guildId);
            const disabledMessage = (guildLang?.commandDisabledInServer ||
                'The `{command}` command is disabled in this server.')
                .replace('{command}', `${prefix}${commandName}`);
            const card = buildCard({
                title: `${getEmoji('cross')} ${disabledMessage}`,
                tone: 'danger'
            });
            await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            return true;
        }
        const interactionAdapter = createCommandInteractionAdapter(message, args, command);
        try {
            const secondArg = command.execute.length === 2 ? client : args;
            await command.execute(interactionAdapter, secondArg, client);
            return true;
        } catch (commandExecErr) {
            console.error(`[MessageCreate] Error executing command ${commandName}:`, commandExecErr);
            const card = buildCard({
                title: `${getEmoji('cross')} Command Execution Error`,
                description: `An unexpected error occurred while executing \`${prefix}${commandName}\`.`,
                tone: 'danger'
            });
            await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return true;
        }
    }
    return false;
}


async function handleMessageBasedSticky(message, stickyMessage) {
    const channelId = message.channel.id;
    const timerKey = `${stickyMessage.serverId}_${channelId}`;

    
    if (stickyTimers.has(timerKey)) return;

    stickyMessage.currentMessageCount += 1;
    await stickyMessage.save();

    if (stickyMessage.currentMessageCount >= stickyMessage.messageCount) {
        stickyMessage.currentMessageCount = 0;
        await stickyMessage.save();

        
        stickyTimers.set(timerKey, Date.now());

        try {
            
            invalidateStickyMessage(stickyMessage.serverId, channelId);
            await sendAdvancedStickyMessage(message.channel, stickyMessage);
        } finally {
            
            setTimeout(() => stickyTimers.delete(timerKey), 5000);
        }
    }
}

async function handleTimeBasedSticky(message, stickyMessage) {
    const channelId = message.channel.id;
    const timerKey = `${stickyMessage.serverId}_${channelId}`;

    
    if (stickyTimers.has(timerKey)) return;

    const now = new Date();
    const timeDiff = (now - stickyMessage.lastSent) / 1000;

    if (timeDiff >= stickyMessage.timerInterval) {
        
        stickyTimers.set(timerKey, Date.now());

        try {
            stickyMessage.lastSent = now;
            await stickyMessage.save();

            
            invalidateStickyMessage(stickyMessage.serverId, channelId);
            await sendAdvancedStickyMessage(message.channel, stickyMessage);
        } finally {
            
            setTimeout(() => stickyTimers.delete(timerKey), 5000);
        }
    }
}

async function sendAdvancedStickyMessage(channel, stickyMessage) {
    try {
        
        if (stickyMessage.deleteOldMessage && stickyMessage.lastMessageId) {
            try {
                const oldMessage = await channel.messages.fetch(stickyMessage.lastMessageId);
                if (oldMessage) {
                    await oldMessage.delete();
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (err) {
                
                if (err.code !== 10008) { 
                    console.warn(`Could not delete old sticky message: ${err.message}`);
                }
            }
        }

        
        const messagePayload = {};

        if (stickyMessage.messageType === 'text') {
            if (stickyMessage.textContent) {
                messagePayload.content = stickyMessage.textContent;
            }
        } else if (stickyMessage.messageType === 'embed' || stickyMessage.messageType === 'both') {
            const card = buildAdvancedCard(stickyMessage);
            if (card) {
                messagePayload.components = [card];
                messagePayload.flags = MessageFlags.IsComponentsV2;
            } else if (stickyMessage.textContent) {
                messagePayload.content = stickyMessage.textContent;
            }
        }

        
        if (messagePayload.content || messagePayload.components) {
            const sentMessage = await channel.send(messagePayload);
            
            
            stickyMessage.lastMessageId = sentMessage.id;
            await stickyMessage.save();
            
            
            invalidateStickyMessage(stickyMessage.serverId, channel.id);
        }

    } catch (error) {
        console.error('Error sending advanced sticky message:', error);
    }
}

function buildAdvancedCard(stickyMessage) {
    try {
        const embedData = stickyMessage.embed || {};
        let description = embedData.description || undefined;
        if (stickyMessage.messageType === 'both' && stickyMessage.textContent) {
            description = description ? `${stickyMessage.textContent}\n\n${description}` : stickyMessage.textContent;
        }

        return buildCard({
            title: embedData.title || undefined,
            description,
            fields: (Array.isArray(embedData.fields) && embedData.fields.length > 0) ? embedData.fields.filter(f => f.name && f.value).map(f => ({
                name: f.name,
                value: f.value,
                inline: f.inline ?? false
            })) : undefined,
            bannerURL: (typeof embedData.image === 'string' ? embedData.image : embedData.image?.url) || undefined,
            _footer: embedData.footer?.text || undefined,
            accentColor: embedData.color ? parseInt(String(embedData.color).replace('#', ''), 16) : undefined
        });
    } catch (error) {
        console.error('Error building advanced sticky card:', error);
        return null;
    }
}
