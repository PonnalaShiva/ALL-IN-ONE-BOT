const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const colors = require('../UI/colors/colors');
const { axiosWithRetry } = require('./apiHelper');

dotenv.config();

let botClient = null;

function setBotClient(client) {
    botClient = client || null;
}

function getBotId() {
    return botClient?.user?.id || process.env.DISCORD_CLIENT_ID || 'AIO @2.0.0';
}

const BACKEND = (process.env.BACKEND || process.env.VALIDATOR_URL || 'https://aio.fluenosity.com').replace(/\/+$/, '');
const BOT_API = process.env.BOT_API;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;

const CACHE_TTL_MS = Number(process.env.ENTITLEMENT_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const GRACE_TTL_MS = Number(process.env.ENTITLEMENT_GRACE_TTL_MS || 24 * 60 * 60 * 1000);
const RETRY_MIN_INTERVAL_MS = Number(process.env.ENTITLEMENT_RETRY_MIN_INTERVAL_MS || 10 * 60 * 1000);

const cacheFilePath = path.join(__dirname, '../temp/entitlement-cache.json');

let inMemoryCache = null;
let inFlightPromise = null;
let lastFailedAttemptAt = 0;
let periodicTimer = null;

function fingerprint({ apiKey, discordId, botId }) {
    return crypto
        .createHash('sha256')
        .update(`${apiKey || ''}|${discordId || ''}|${botId || ''}`)
        .digest('hex');
}

function safeReadCache() {
    try {
        if (!fs.existsSync(cacheFilePath)) return null;
        const raw = fs.readFileSync(cacheFilePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function safeWriteCache(data) {
    try {
        const dir = path.dirname(cacheFilePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(cacheFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch {
        
    }
}

function isFresh(cache, now) {
    return !!cache && !!cache.verifiedAt && now - cache.verifiedAt <= CACHE_TTL_MS;
}

function isGrace(cache, now) {
    return !!cache && !!cache.verifiedAt && now - cache.verifiedAt <= GRACE_TTL_MS;
}

async function attestRuntimeEntitlement(options = {}) {
    const {
        force = false,
        allowGrace = true,
        reason = 'runtime',
        quiet = false
    } = options;

    const botId = getBotId();

    if (!BOT_API || !DISCORD_USER_ID) {
        return {
            success: false,
            fatal: true,
            message: 'Missing BOT_API or DISCORD_USER_ID in .env file'
        };
    }

    const now = Date.now();
    const currentFp = fingerprint({ apiKey: BOT_API, discordId: DISCORD_USER_ID, botId });

    if (!inMemoryCache) {
        inMemoryCache = safeReadCache();
    }

    const cache = inMemoryCache;
    const cacheMatches = cache && cache.fingerprint === currentFp;

    if (!force && cacheMatches && isFresh(cache, now)) {
        return {
            success: true,
            fromCache: true,
            graceMode: false,
            user: cache.user || null,
            message: 'Entitlement check served from cache'
        };
    }

    if (!force && now - lastFailedAttemptAt < RETRY_MIN_INTERVAL_MS && cacheMatches && allowGrace && isGrace(cache, now)) {
        return {
            success: true,
            fromCache: true,
            graceMode: true,
            user: cache.user || null,
            message: 'Using grace cache during backend cooldown'
        };
    }

    if (inFlightPromise) return inFlightPromise;

    inFlightPromise = (async () => {
        try {
            const response = await axiosWithRetry(
                `${BACKEND}/api/verify-key`,
                {
                    method: 'POST',
                    data: {
                        apiKey: BOT_API,
                        discordId: DISCORD_USER_ID,
                        botId
                    }
                },
                {
                    maxRetries: 1,
                    timeout: 7000,
                    retryDelay: 1500,
                    exponentialBackoff: true,
                    retryableErrors: [429, 500, 502, 503, 504]
                }
            );

            if (response?.data?.success) {
                const payload = {
                    verifiedAt: now,
                    fingerprint: currentFp,
                    source: 'live',
                    graceMode: false,
                    user: {
                        username: response.data.user?.username || DISCORD_USER_ID,
                        discordId: DISCORD_USER_ID,
                        botId
                    }
                };

                inMemoryCache = payload;
                safeWriteCache(payload);

                if (!quiet) {
                    console.log(`${colors.green}[ ENTITLEMENT ]${colors.reset} Verified (${reason})`);
                }

                return {
                    success: true,
                    fromCache: false,
                    graceMode: false,
                    user: payload.user,
                    message: response.data.message || 'Entitlement verified'
                };
            }

            lastFailedAttemptAt = Date.now();
            const fallback = cacheMatches && allowGrace && isGrace(cache, now);

            if (fallback) {
                if (!quiet) {
                    console.log(`${colors.yellow}[ ENTITLEMENT ]${colors.reset} Backend rejected check; using grace cache (${reason})`);
                }
                return {
                    success: true,
                    fromCache: true,
                    graceMode: true,
                    user: cache.user || null,
                    message: response?.data?.message || 'Verification fallback to grace cache'
                };
            }

            return {
                success: false,
                fatal: true,
                message: response?.data?.message || 'Entitlement verification failed'
            };
        } catch (error) {
            lastFailedAttemptAt = Date.now();
            const fallback = cacheMatches && allowGrace && isGrace(cache, now);

            if (fallback) {
                if (!quiet) {
                    console.log(`${colors.yellow}[ ENTITLEMENT ]${colors.reset} Backend unreachable; using grace cache (${reason})`);
                }
                return {
                    success: true,
                    fromCache: true,
                    graceMode: true,
                    user: cache.user || null,
                    message: error.response?.data?.message || error.message
                };
            }

            return {
                success: false,
                fatal: true,
                message: error.response?.data?.message || error.message
            };
        } finally {
            inFlightPromise = null;
        }
    })();

    return inFlightPromise;
}

function loadCacheSnapshot() {
    if (!inMemoryCache) {
        inMemoryCache = safeReadCache();
    }
    return inMemoryCache;
}

function getRuntimeEntitlementSnapshot() {
    const cache = loadCacheSnapshot();
    if (!cache) {
        return {
            active: false,
            user: null,
            verifiedAt: null,
            source: 'none',
            graceMode: false
        };
    }

    const now = Date.now();
    const fresh = isFresh(cache, now);
    const grace = !fresh && isGrace(cache, now);

    return {
        active: fresh || grace,
        user: cache.user || null,
        verifiedAt: cache.verifiedAt || null,
        source: fresh ? 'cache' : (grace ? 'grace-cache' : 'stale'),
        graceMode: grace
    };
}

async function performStartupHandshake(options = {}) {
    return attestRuntimeEntitlement({
        reason: 'startup_handshake',
        ...options
    });
}

async function verifyControlPlaneSession(options = {}) {
    return attestRuntimeEntitlement({
        reason: 'control_plane_session',
        ...options
    });
}

async function enforceRuntimeSeal(options = {}) {
    return attestRuntimeEntitlement({
        reason: 'runtime_seal',
        ...options
    });
}

function startPeriodicEntitlementAttestation(options = {}) {
    if (periodicTimer) return;

    const minMs = Number(options.minIntervalMs || process.env.ENTITLEMENT_PERIODIC_MIN_MS || 35 * 60 * 1000);
    const maxMs = Number(options.maxIntervalMs || process.env.ENTITLEMENT_PERIODIC_MAX_MS || 55 * 60 * 1000);
    const allowGrace = options.allowGrace !== false;

    const scheduleNext = () => {
        const jitter = Math.floor(Math.random() * Math.max(1, maxMs - minMs));
        const waitMs = minMs + jitter;

        periodicTimer = setTimeout(async () => {
            try {
                await attestRuntimeEntitlement({
                    force: true,
                    allowGrace,
                    reason: 'periodic_attestation',
                    quiet: true
                });
            } finally {
                periodicTimer = null;
                scheduleNext();
            }
        }, waitMs);
    };

    scheduleNext();
}

function stopPeriodicEntitlementAttestation() {
    if (!periodicTimer) return;
    clearTimeout(periodicTimer);
    periodicTimer = null;
}

module.exports = {
    setBotClient,
    attestRuntimeEntitlement,
    performStartupHandshake,
    verifyControlPlaneSession,
    enforceRuntimeSeal,
    startPeriodicEntitlementAttestation,
    stopPeriodicEntitlementAttestation,
    getRuntimeEntitlementSnapshot
};
