const axios = require('axios');
const { Riffy } = require('riffy');
const logger = require('./logger');

class NodeManager {
    constructor(client, lavalinkConfig) {
        this.client = client;
        this.config = lavalinkConfig;
        this.riffy = null;
        this.nodes = new Map(); 
        this.nodeStatus = new Map(); 
        this.healthCheckInterval = null;
        this.reconnectInterval = null;
        this.activeNodes = []; 
        this.playerNodeMap = new Map(); 

        
        this.initializeNodes();
    }

    initializeNodes() {
        
        if (this.config.nodes && Array.isArray(this.config.nodes) && this.config.nodes.length > 0) {
            this.config.nodes.forEach((node, index) => {
                const nodeId = node.name || `node-${index}`;
                this.nodes.set(nodeId, {
                    ...node,
                    id: nodeId
                });
                this.nodeStatus.set(nodeId, {
                    online: false,
                    lastCheck: null,
                    reconnectAttempts: 0,
                    lastError: null
                });
            });
        }
        
        else if (this.config.lavalink) {
            const nodeId = this.config.lavalink.name || 'default-node';
            this.nodes.set(nodeId, {
                name: nodeId,
                password: this.config.lavalink.password,
                host: this.config.lavalink.host,
                port: this.config.lavalink.port,
                secure: this.config.lavalink.secure || false,
                id: nodeId
            });
            this.nodeStatus.set(nodeId, {
                online: false,
                lastCheck: null,
                reconnectAttempts: 0,
                lastError: null
            });
        }

        
    }

    async initializeRiffy() {
        try {
            
            this.activeNodes = Array.from(this.nodes.values()).map(node => ({
                host: node.host,
                password: node.password,
                port: node.port,
                secure: node.secure,
                name: node.name || node.id
            }));

            
            this.riffy = new Riffy(this.client, this.activeNodes, {
                send: (payload) => {
                    const guild = this.client.guilds.cache.get(payload.d.guild_id);
                    if (guild) guild.shard.send(payload);
                },
                defaultSearchPlatform: "ytmsearch",
                restVersion: "v4",
            });

            
            this.setupEventListeners();

            
            this.startHealthMonitoring();

            
            if (this.config.nodeManager?.autoReconnect) {
                this.startAutoReconnect();
            }

            logger.info('LAVALINK', `Riffy node manager initialized (${this.activeNodes.length} node configured)`);

            return this.riffy;
        } catch (error) {
            logger.error('LAVALINK', 'Failed to initialize Riffy', error);
            throw error;
        }
    }

    setupEventListeners() {
        
        this.riffy.on('nodeConnect', (node) => {
            const nodeId = this.findNodeIdByName(node.name);
            if (nodeId) {
                this.nodeStatus.set(nodeId, {
                    online: true,
                    lastCheck: new Date(),
                    reconnectAttempts: 0,
                    lastError: null
                });
                logger.setStatus('lavalink', `● Connected (${node.name})`);
                logger.success('LAVALINK', `Node ${node.name} connected`);
            }
        });

        
        this.riffy.on('nodeDisconnect', (node) => {
            const nodeId = this.findNodeIdByName(node.name);
            if (nodeId) {
                const status = this.nodeStatus.get(nodeId) || {};
                this.nodeStatus.set(nodeId, {
                    ...status,
                    online: false,
                    lastCheck: new Date(),
                    lastError: 'Disconnected'
                });
                logger.setStatus('lavalink', `● Reconnecting (${node.name})`);

                this.handleNodeFailover(nodeId);
            }
        });

        
        this.riffy.on('nodeError', (node, error) => {
            const nodeId = this.findNodeIdByName(node.name);
            if (nodeId) {
                const status = this.nodeStatus.get(nodeId) || {};
                const errMsg = error?.message || 'Connection failed';
                this.nodeStatus.set(nodeId, {
                    ...status,
                    online: false,
                    lastCheck: new Date(),
                    lastError: errMsg,
                    reconnectAttempts: (status.reconnectAttempts || 0) + 1
                });
                logger.setStatus('lavalink', `● Offline (${node.name})`);

                this.handleNodeFailover(nodeId);
            }
        });
    }

    findNodeIdByName(nodeName) {
        for (const [nodeId, node] of this.nodes.entries()) {
            if (node.name === nodeName || node.id === nodeName) {
                return nodeId;
            }
        }
        return null;
    }

    async checkNodeHealth(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;

        try {
            const protocol = node.secure ? 'https' : 'http';
            const url = `${protocol}://${node.host}:${node.port}/version`;

            const response = await axios.get(url, {
                headers: node.password ? { 'Authorization': node.password } : {},
                timeout: 5000
            });

            const status = this.nodeStatus.get(nodeId) || {};
            this.nodeStatus.set(nodeId, {
                ...status,
                online: true,
                lastCheck: new Date(),
                lastError: null
            });

            return true;
        } catch (error) {
            const status = this.nodeStatus.get(nodeId) || {};
            this.nodeStatus.set(nodeId, {
                ...status,
                online: false,
                lastCheck: new Date(),
                lastError: error.message
            });

            return false;
        }
    }

    async checkAllNodesHealth() {
        const healthChecks = Array.from(this.nodes.keys()).map(nodeId =>
            this.checkNodeHealth(nodeId).then(online => ({ nodeId, online }))
        );

        const results = await Promise.allSettled(healthChecks);

        
        const onlineNodes = [];
        const offlineNodes = [];

        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { nodeId, online } = result.value;
                const node = this.nodes.get(nodeId);

                if (online) {
                    onlineNodes.push({
                        host: node.host,
                        password: node.password,
                        port: node.port,
                        secure: node.secure,
                        name: node.name || node.id
                    });
                } else {
                    offlineNodes.push(nodeId);
                }
            }
        }

        
        if (this.config.nodeManager?.removeOfflineNodes && offlineNodes.length > 0) {
            await this.removeOfflineNodes(offlineNodes);
        }

        
        if (this.config.nodeManager?.addOnlineNodes && onlineNodes.length > 0) {
            await this.addOnlineNodes(onlineNodes);
        }

        return { online: onlineNodes.length, offline: offlineNodes.length };
    }

    async removeOfflineNodes(offlineNodeIds) {
        
        
        if (!this.riffy || !this.riffy.nodeMap) return;

        for (const nodeId of offlineNodeIds) {
            const node = this.nodes.get(nodeId);
            if (!node) continue;

            try {
                
                const riffyNode = this.riffy.nodeMap.get(node.name || node.id);

                if (riffyNode && !riffyNode.connected) {
                    
                }
            } catch (error) {
                
            }
        }
    }

    async addOnlineNodes(onlineNodes) {
        
        
        if (!this.riffy || !this.riffy.nodeMap) return;

        for (const nodeConfig of onlineNodes) {
            try {
                
                const riffyNode = this.riffy.nodeMap.get(nodeConfig.name);

                if (riffyNode && !riffyNode.connected) {
                    
                  
                }
            } catch (error) {
                
            }
        }
    }

    async handleNodeFailover(offlineNodeId) {
        
        const affectedPlayers = [];

        for (const [guildId, nodeId] of this.playerNodeMap.entries()) {
            if (nodeId === offlineNodeId) {
                const player = this.riffy.players.get(guildId);
                if (player && player.playing) {
                    affectedPlayers.push({ guildId, player });
                }
            }
        }

        if (affectedPlayers.length === 0) return;

        
        const availableNode = await this.getAvailableNode();
        if (!availableNode) {
            console.error(`\x1b[31m[ NODE MANAGER ]\x1b[0m No available nodes for failover`);
            return;
        }

        
        for (const { guildId, player } of affectedPlayers) {
            try {
                
                this.playerNodeMap.set(guildId, availableNode.id);
                console.log(`\x1b[36m[ NODE MANAGER ]\x1b[0m Migrated player ${guildId} to node ${availableNode.name}`);
            } catch (error) {
                console.error(`\x1b[31m[ NODE MANAGER ]\x1b[0m Failed to migrate player ${guildId}:`, error.message);
            }
        }
    }

    async getAvailableNode() {
        
        if (this.riffy && this.riffy.nodeMap) {
            try {
                for (const [nodeName, node] of this.riffy.nodeMap.entries()) {
                    if (node.connected) {
                        const nodeId = this.findNodeIdByName(nodeName);
                        if (nodeId) {
                            const nodeData = this.nodes.get(nodeId);
                            return {
                                id: nodeId,
                                name: nodeName,
                                config: {
                                    host: nodeData.host,
                                    password: nodeData.password,
                                    port: nodeData.port,
                                    secure: nodeData.secure,
                                    name: nodeName
                                }
                            };
                        }
                    }
                }
            } catch (error) {
                
            }
        }

        
        for (const [nodeId, status] of this.nodeStatus.entries()) {
            if (status.online) {
                const node = this.nodes.get(nodeId);
                return {
                    id: nodeId,
                    name: node.name || node.id,
                    config: {
                        host: node.host,
                        password: node.password,
                        port: node.port,
                        secure: node.secure,
                        name: node.name || node.id
                    }
                };
            }
        }

        return null;
    }

    async ensureNodeAvailable() {
        const availableNode = await this.getAvailableNode();
        if (!availableNode) {
            throw new Error('No Lavalink nodes are currently available. Please check your node configuration.');
        }
        return availableNode;
    }

    startHealthMonitoring() {
        const interval = this.config.nodeManager?.healthCheckInterval || 30000;

        let isCheckingHealth = false;
        this.healthCheckInterval = setInterval(async () => {
            if (isCheckingHealth) return;
            isCheckingHealth = true;
            try {
                await this.checkAllNodesHealth();
            } catch (error) {
                console.error(`\x1b[31m[ NODE MANAGER ]\x1b[0m Health check error:`, error.message);
            } finally {
                isCheckingHealth = false;
            }
        }, interval);

        
        setTimeout(() => this.checkAllNodesHealth(), 5000);
    }

    startAutoReconnect() {
        const interval = this.config.nodeManager?.reconnectInterval || 10000;
        const maxAttempts = this.config.nodeManager?.maxReconnectAttempts || 5;

        let isReconnecting = false;
        this.reconnectInterval = setInterval(async () => {
            if (isReconnecting) return;
            isReconnecting = true;
            try {
                for (const [nodeId, status] of this.nodeStatus.entries()) {
                    if (!status.online && status.reconnectAttempts < maxAttempts) {
                        const node = this.nodes.get(nodeId);
                        const isOnline = await this.checkNodeHealth(nodeId);

                        if (isOnline) {
                            
                            
                            const nodeName = node.name || node.id;
                            
                            const riffyNode = this.riffy?.nodeMap?.get(nodeName);
                            if (!riffyNode || !riffyNode.connected) {
                                
                                this.nodeStatus.set(nodeId, {
                                    ...status,
                                    online: true,
                                    reconnectAttempts: 0,
                                    lastError: null
                                });
                              
                            }
                        } else {
                            
                            this.nodeStatus.set(nodeId, {
                                ...status,
                                reconnectAttempts: (status.reconnectAttempts || 0) + 1
                            });
                        }
                    }
                }
            } finally {
                isReconnecting = false;
            }
        }, interval);
    }

    getNodeStatus() {
        const status = {
            total: this.nodes.size,
            online: 0,
            offline: 0,
            nodes: []
        };

        for (const [nodeId, node] of this.nodes.entries()) {
            const nodeStatus = this.nodeStatus.get(nodeId) || { online: false };
            status.nodes.push({
                id: nodeId,
                name: node.name || node.id,
                host: node.host,
                port: node.port,
                online: nodeStatus.online,
                lastCheck: nodeStatus.lastCheck,
                lastError: nodeStatus.lastError,
                reconnectAttempts: nodeStatus.reconnectAttempts || 0
            });

            if (nodeStatus.online) {
                status.online++;
            } else {
                status.offline++;
            }
        }

        return status;
    }

    shutdown() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        if (this.riffy) {
            for (const player of this.riffy.players?.values?.() || []) {
                try {
                    player.destroy();
                } catch (error) {
                    console.warn(`[ NODE MANAGER ] Failed to destroy a player during shutdown: ${error.message}`);
                }
            }
            for (const node of this.riffy.nodeMap?.values?.() || []) {
                try {
                    node.destroy(true);
                } catch (error) {
                    console.warn(`[ NODE MANAGER ] Failed to destroy a node during shutdown: ${error.message}`);
                }
            }
            this.riffy.removeAllListeners();
            this.riffy = null;
        }
        console.log(`\x1b[34m[ NODE MANAGER ]\x1b[0m Shutdown complete`);
    }
}

module.exports = NodeManager;

