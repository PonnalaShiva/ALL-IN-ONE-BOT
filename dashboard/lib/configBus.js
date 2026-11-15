

const colors = require('../../UI/colors/colors');

const SEEN_TTL_MS = 5 * 60 * 1000;
const SEEN_MAX = 500;

const HANDLER_HEARTBEAT_MS = 5000;

class ConfigBus {
    constructor() {
         
        this.handlers = new Map();

         
        this.seen = new Map();

        this.socket = null;

        this._sweepTimer = setInterval(() => this._sweepSeen(), 60000);
        if (this._sweepTimer.unref) this._sweepTimer.unref();
    }

    attach(socket) {
        if (this.socket) {
            this.socket.off('config:dispatch', this._onDispatch);
        }
        this.socket = socket;
        this._onDispatch = this._onDispatch.bind(this);
        socket.on('config:dispatch', this._onDispatch);
    }

    stop() {
        if (this.socket && this._onDispatch) this.socket.off('config:dispatch', this._onDispatch);
        this.socket = null;
        if (this._sweepTimer) clearInterval(this._sweepTimer);
        this._sweepTimer = null;
        this.seen.clear();
    }

    register(moduleName, action, handler) {
        const key = `${moduleName}:${action}`;
        this.handlers.set(key, handler);
    }

    async _onDispatch(envelope) {
        const { requestId, serverId, module: moduleName, action, payload } = envelope || {};
        if (!requestId || !moduleName || !action) return;
        if (typeof serverId !== 'string' || serverId.length < 5 || serverId.length > 64) {
            this._ack(envelope, { state: 'failed', error: 'invalid_server', message: 'Invalid server identifier' });
            return;
        }
        try {
            if (Buffer.byteLength(JSON.stringify(payload || {}), 'utf8') > 256 * 1024) {
                this._ack(envelope, { state: 'failed', error: 'payload_too_large', message: 'Configuration payload is too large' });
                return;
            }
        } catch {
            this._ack(envelope, { state: 'failed', error: 'invalid_payload', message: 'Configuration payload is invalid' });
            return;
        }

        if (this._isDuplicate(requestId)) {
            console.log(`${colors.yellow}⚠️ Duplicate config:dispatch ignored (requestId=${requestId})${colors.reset}`);
            return;
        }
        this._markSeen(requestId);

        const key = `${moduleName}:${action}`;
        const handler = this.handlers.get(key);

        this._ack(envelope, { state: 'received' });

        if (!handler) {
            this._ack(envelope, {
                state: 'failed',
                error: 'unknown_action',
                message: `No handler registered for ${key}`
            });
            return;
        }

        const ctx = {
            progress: (message) => this._ack(envelope, { state: 'processing', message })
        };

        const heartbeat = setInterval(() => {
            this._ack(envelope, { state: 'processing', message: 'Still working...' });
        }, HANDLER_HEARTBEAT_MS);
        if (heartbeat.unref) heartbeat.unref();

        try {
            this._ack(envelope, { state: 'processing', message: 'Applying configuration...' });
            const data = await handler(serverId, payload || {}, ctx);
            this._ack(envelope, {
                state: 'success',
                message: 'Completed successfully',
                data: this._serialize(data)
            });
        } catch (error) {
            console.error(`${colors.red}❌ ConfigBus handler error [${key}]:${colors.reset}`, error);
            this._ack(envelope, {
                state: 'failed',
                error: error.code || 'handler_error',
                message: error.message || 'Operation failed'
            });
        } finally {
            clearInterval(heartbeat);
        }
    }

    _ack(envelope, extra) {
        if (!this.socket) return;
        this.socket.emit('config:ack', {
            requestId: envelope.requestId,
            botId: envelope.botId,
            serverId: envelope.serverId,
            module: envelope.module,
            action: envelope.action,
            timestamp: Date.now(),
            ...extra
        });
    }

    emitRuntimeEvent(type, serverId, payload) {
        if (!this.socket) return;
        this.socket.emit('runtime:event', { type, serverId, payload, timestamp: Date.now() });
    }

    emitBulkSync(moduleName, entries) {
        if (!this.socket || !entries?.length) return;
        this.socket.emit('runtime:event', {
            type: 'module_state_bulk_sync',
            payload: { module: moduleName, entries: entries.map((e) => ({ serverId: e.serverId, data: this._serialize(e.data) })) },
            timestamp: Date.now()
        });
    }

    liveEventShim() {
        const emitRuntimeEvent = this.emitRuntimeEvent.bind(this);
        const serialize = this._serialize.bind(this);
        return {
            emit: (eventName, data) => {
                if (eventName !== 'bot_data_update' || !data?.type) return;
                const payload = serialize(data.payload);
                const serverId = payload?.serverId || payload?.guildId || null;
                emitRuntimeEvent(data.type, serverId, payload);
            }
        };
    }

    legacySyncShim(moduleName, guildIdKey = 'guildId') {
        const buffered = [];
        let flushScheduled = false;

        const flush = () => {
            flushScheduled = false;
            if (buffered.length) this.emitBulkSync(moduleName, buffered.splice(0, buffered.length));
        };

        return {
            emit: (eventName, data) => {
                if (eventName !== 'bot_data_update' || !data?.payload) return;
                const serverId = data.payload[guildIdKey] || data.payload.serverId || data.payload.guildId;
                if (!serverId) return;
                buffered.push({ serverId, data: data.payload });
                if (!flushScheduled) {
                    flushScheduled = true;
                    process.nextTick(flush);
                }
            }
        };
    }

    _serialize(value) {
        if (value === undefined || value === null) return null;
        if (typeof value?.toObject === 'function') {
            return this._serialize(value.toObject({ getters: true, virtuals: false }));
        }
        if (Array.isArray(value)) return value.map((v) => this._serialize(v));
        if (value instanceof Map) return Object.fromEntries(value);
        if (typeof value === 'object') {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch {
                return value;
            }
        }
        return value;
    }

    _isDuplicate(requestId) {
        return this.seen.has(requestId);
    }

    _markSeen(requestId) {
        this.seen.set(requestId, Date.now());
        if (this.seen.size > SEEN_MAX) {
            const oldestKey = this.seen.keys().next().value;
            this.seen.delete(oldestKey);
        }
    }

    _sweepSeen() {
        const now = Date.now();
        for (const [id, seenAt] of this.seen) {
            if (now - seenAt > SEEN_TTL_MS) this.seen.delete(id);
        }
    }
}

module.exports = new ConfigBus();
