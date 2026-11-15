

const mongoose = require('mongoose');
const TempVcMute = require('../models/moderation/tempVcMute');

const scheduledMutes = new Set();
const activeTimeouts = new Map();
let pollInterval = null;
let registeredClient = null;
let clientReadyListener = null;


let isCheckingMutes = false;
const checkExpiredMutes = async (client) => {
    if (isCheckingMutes || mongoose.connection?.readyState !== 1 || !client) return;
    isCheckingMutes = true;
    try {
        const now = Date.now();
        const expiredMutes = await TempVcMute.find({ endTime: { $lte: now } });

        for (const mute of expiredMutes) {
            try {
                const guild = client.guilds.cache.get(mute.guildId);
                if (!guild) {
                    await TempVcMute.deleteOne({ _id: mute._id });
                    scheduledMutes.delete(mute._id.toString());
                    continue;
                }

                const member = await guild.members.fetch(mute.userId).catch(() => null);
                if (member && member.voice.serverMute) {
                    await member.voice.setMute(false, 'Temp mute expired');
                    console.log(`[TempMuteHandler] Unmuted ${member.user.tag} (expired)`);
                }

                await TempVcMute.deleteOne({ _id: mute._id });
                scheduledMutes.delete(mute._id.toString());
            } catch (error) {
                console.error('[TempMuteHandler] Error processing mute:', error);
            }
        }

        
        const pendingMutes = await TempVcMute.find({ endTime: { $gt: now } });
        for (const mute of pendingMutes) {
            const muteId = mute._id.toString();
            if (scheduledMutes.has(muteId)) continue;

            const delay = mute.endTime - now;
            if (delay < 60 * 60 * 1000) {
                scheduledMutes.add(muteId);
                const timer = setTimeout(async () => {
                    try {
                        const guild = client.guilds.cache.get(mute.guildId);
                        if (!guild) return;

                        const member = await guild.members.fetch(mute.userId).catch(() => null);
                        if (member && member.voice.serverMute) {
                            await member.voice.setMute(false, 'Temp mute expired');
                            console.log(`[TempMuteHandler] Unmuted ${member.user.tag}`);
                        }

                        await TempVcMute.deleteOne({ _id: mute._id });
                    } catch (error) {
                        console.error('[TempMuteHandler] Scheduled unmute error:', error);
                    } finally {
                        scheduledMutes.delete(muteId);
                        activeTimeouts.delete(muteId);
                    }
                }, delay);
                if (timer?.unref) timer.unref();
                activeTimeouts.set(muteId, timer);
            }
        }
    } catch (error) {
        console.error('[TempMuteHandler] Check error:', error);
    } finally {
        isCheckingMutes = false;
    }
};

module.exports = (client) => {
    registeredClient = client;
    clientReadyListener = () => {
        checkExpiredMutes(client);
    };

    if (client) {
        client.once('clientReady', clientReadyListener);
    }

    
    pollInterval = setInterval(() => checkExpiredMutes(client), 5 * 60 * 1000);
    if (pollInterval?.unref) pollInterval.unref();
};

function stop(clientInstance) {
    const targetClient = clientInstance || registeredClient;
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    for (const [id, timer] of activeTimeouts.entries()) {
        clearTimeout(timer);
    }
    activeTimeouts.clear();
    scheduledMutes.clear();

    if (targetClient && clientReadyListener) {
        targetClient.off('clientReady', clientReadyListener);
        clientReadyListener = null;
    }
}

module.exports.checkExpiredMutes = checkExpiredMutes;
module.exports.stop = stop;