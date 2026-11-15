'use strict';

const { ActivityType } = require('discord.js');
const { botStatusCollection } = require('../mongodb');
const colors = require('../UI/colors/colors');
const config = require('../config');

let statusTimeout = null;
let isStopping = false;

function stop() {
    isStopping = true;
    if (statusTimeout) {
        clearTimeout(statusTimeout);
        statusTimeout = null;
    }
}

module.exports = {
    name: 'clientReady',
    once: true,
    stop,
    shutdown: stop,
    async execute(client) {
        isStopping = false;
        let defaultIndex = 0;
        let customIndex = 0;
        let currentInterval = 10000;

        async function getCustomStatus() {
            if (isStopping) return null;
            try {
                const statusDoc = await botStatusCollection.findOne({}).catch(() => null);
                if (!statusDoc || !statusDoc.useCustom || !statusDoc.customRotation || statusDoc.customRotation.length === 0) {
                    return null;
                }

                if (statusDoc.interval) {
                    currentInterval = statusDoc.interval * 1000;
                }

                const status = statusDoc.customRotation[customIndex];
                customIndex = (customIndex + 1) % statusDoc.customRotation.length;

                const placeholders = {
                    '{members}': client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
                    '{servers}': client.guilds.cache.size,
                    '{channels}': client.channels.cache.size,
                };

                const resolvedActivity = Object.entries(placeholders).reduce(
                    (text, [key, val]) => text.replace(new RegExp(key, 'g'), val),
                    status.activity
                );

                const activity = {
                    name: resolvedActivity,
                    type: ActivityType[status.type],
                };

                if (status.type === 'Streaming' && status.url) {
                    activity.url = status.url;
                }

                return { activity, status: status.status };
            } catch (_) {
                return null;
            }
        }

        async function getCurrentSongActivity() {
            if (isStopping) return null;
            try {
                if (!client.riffy || !client.riffy.players) return null;

                const activePlayers = Array.from(client.riffy.players.values()).filter(p => p.playing);
                if (!activePlayers.length) return null;

                const player = activePlayers[0];
                if (!player.current?.info?.title) return null;

                return {
                    name: player.current.info.title,
                    type: ActivityType.Playing
                };
            } catch (err) {
                console.warn(`[STATUS] Error while checking song activity: ${err.message}`);
                return null;
            }
        }

        async function updateStatus() {
            if (isStopping || !client?.isReady?.()) return;

            try {
                const customStatus = await getCustomStatus();
                if (isStopping || !client?.isReady?.()) return;

                if (customStatus) {
                    client.user.setPresence({
                        activities: [customStatus.activity],
                        status: customStatus.activity.type === ActivityType.Streaming ? undefined : customStatus.status
                    });
                    console.log(`${colors.cyan}[STATUS]${colors.reset} Using custom status: ${customStatus.activity.name}`);
                    return;
                }

                if (config.status?.songStatus) {
                    const songActivity = await getCurrentSongActivity();
                    if (isStopping || !client?.isReady?.()) return;
                    if (songActivity) {
                        client.user.setActivity(songActivity);
                        return;
                    }
                }

                if (!config.status?.rotateDefault?.length) return;
                const next = config.status.rotateDefault[defaultIndex % config.status.rotateDefault.length];
                client.user.setPresence({
                    activities: [next],
                    status: next.type === ActivityType.Streaming ? undefined : 'online'
                });
                defaultIndex++;
            } catch (_) {
                
            }
        }

        client.invites = new Map();
        for (const [guildId, guild] of client.guilds.cache) {
            if (isStopping) break;
            try {
                await new Promise(res => setTimeout(res, 500));
                if (isStopping) break;
                const invites = await guild.invites.fetch();
                client.invites.set(
                    guildId,
                    new Map(invites.map(inv => [
                        inv.code,
                        {
                            inviterId: inv.inviter?.id || null,
                            uses: inv.uses
                        }
                    ]))
                );
            } catch (_) {
                
            }
        }

        if (!isStopping) {
            updateStatus().catch(() => {});
        }

        async function checkAndUpdateInterval() {
            if (isStopping) return;

            try {
                const statusDoc = await botStatusCollection.findOne({}).catch(() => null);
                const newInterval = statusDoc?.interval ? statusDoc.interval * 1000 : 10000;

                if (newInterval !== currentInterval) {
                    console.log(`${colors.cyan}[STATUS]${colors.reset} Updating interval to ${newInterval / 1000} seconds`);
                    currentInterval = newInterval;
                }
            } catch (_) {
                
            }

            if (isStopping) return;
            if (statusTimeout) clearTimeout(statusTimeout);
            statusTimeout = setTimeout(async () => {
                if (isStopping) return;
                try {
                    await updateStatus();
                } catch (_) {}
                if (!isStopping) {
                    checkAndUpdateInterval();
                }
            }, currentInterval);
        }

        if (!isStopping) {
            checkAndUpdateInterval();
        }
    }
};
