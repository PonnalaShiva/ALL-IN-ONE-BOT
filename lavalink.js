
module.exports = {
    enabled: process.env.LAVALINK_ENABLED !== undefined ? process.env.LAVALINK_ENABLED === 'true' : true,
    nodes: [
        {
            name: process.env.LAVALINK_NAME || "shiva - fluenosity",
            password: process.env.LAVALINK_PASSWORD || "glace",
            host: process.env.LAVALINK_HOST || "localhost",
            port: parseInt(process.env.LAVALINK_PORT, 10) || 2333,
            secure: process.env.LAVALINK_SECURE === 'true'
        }
    ],
    // Node management settings
    nodeManager: {
        healthCheckInterval: 30000,      // Check node health every 30 seconds
        reconnectInterval: 10000,         // Try to reconnect offline nodes every 10 seconds
        maxReconnectAttempts: 5,         // Max attempts before marking node as dead
        failoverTimeout: 5000,           // Timeout for failover operations
        autoReconnect: true,              // Automatically reconnect when nodes come back online
        removeOfflineNodes: true,        // Remove offline nodes from active pool
        addOnlineNodes: true              // Add nodes back when they come online
    }
};
