const fs = require('fs').promises;
const path = require('path');

module.exports = async function loadLogHandlers(client) {
    const logHandlersPath = path.join(__dirname);
    const cleanupHandlers = [];

    const captureNewListeners = before => {
        for (const eventName of client.eventNames()) {
            const previousListeners = before.get(eventName) || new Set();
            for (const listener of client.listeners(eventName)) {
                if (!previousListeners.has(listener)) {
                    cleanupHandlers.push(() => client.off(eventName, listener));
                }
            }
        }
    };

    try {
        const files = await fs.readdir(logHandlersPath);
        
        for (const file of files) {
            if (file === 'index.js') continue; 

            try {
                const handler = require(path.join(logHandlersPath, file));

                if (typeof handler === 'function') {
                    const before = new Map(client.eventNames().map(eventName => [
                        eventName,
                        new Set(client.listeners(eventName))
                    ]));
                    try {
                        const result = await handler(client);
                        if (typeof result?.stop === 'function') cleanupHandlers.push(() => result.stop());
                        else if (typeof result?.shutdown === 'function') cleanupHandlers.push(() => result.shutdown());
                    } catch (err) {
                        console.error(`[LogHandlers] Error loading ${file}:`, err);
                    } finally {
                        captureNewListeners(before);
                    }
                }
            } catch (error) {
                console.error(`[LogHandlers] Error loading handler ${file}:`, error);
            }
        }
    } catch (error) {
        console.error('[LogHandlers] Error reading log handlers directory:', error);
    }

    return {
        stop() {
            for (const cleanup of cleanupHandlers.splice(0).reverse()) cleanup();
        }
    };
};
