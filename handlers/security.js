
const AntiSpamModule = require('../antimodules/antiSpam');
const AntiLinkModule = require('../antimodules/antiLink');
const AntiNukeModule = require('../antimodules/antiNuke');
const AntiRaidModule = require('../antimodules/antiRaid');
const { destroyActionQueue } = require('../utils/actionQueue');

module.exports = (client) => {
    const modules = [];
    try {
        modules.push(new AntiSpamModule(client));
        modules.push(new AntiLinkModule(client));
        modules.push(new AntiNukeModule(client));
        modules.push(new AntiRaidModule(client));
    } catch (error) {
        for (const module of modules.reverse()) module.stop?.();
        destroyActionQueue();
        throw error;
    }

    return {
        stop() {
            for (const module of modules.reverse()) module.stop?.();
            modules.length = 0;
            destroyActionQueue();
        }
    };
};
