

class CacheManager {
    constructor() {
        this.caches = new Map();
        this.statistics = new Map();
        this.cleanupInterval = null;
        this.isInitialized = false;
        this.verbose = process.env.CACHE_VERBOSE === 'true';
    }

    log(message) {
        if (this.verbose) {
            console.log(message);
        }
    }

    warn(message) {
        if (this.verbose) {
            console.warn(message);
        }
    }

    initialize() {
        if (this.isInitialized) {
            this.warn('[CACHE] Cache manager already initialized');
            return;
        }

        
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, 30 * 1000);

        this.isInitialized = true;
        this.log('[CACHE] ✅ Cache manager initialized');
    }

    createCache(cacheName, options = {}) {
        if (this.caches.has(cacheName)) {
            this.warn(`[CACHE] Cache '${cacheName}' already exists`);
            return this.caches.get(cacheName);
        }

        const config = {
            ttl: options.ttl || 5 * 60 * 1000, 
            maxSize: options.maxSize || 1000,
            enableLRU: options.enableLRU !== false,
            ...options
        };

        const cache = {
            data: new Map(),
            accessOrder: [], 
            config,
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };

        this.caches.set(cacheName, cache);
        this.statistics.set(cacheName, {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0,
            size: 0,
            maxSize: config.maxSize
        });

        return cache;
    }

    ensureCache(cacheName) {
        if (this.caches.has(cacheName)) {
            return this.caches.get(cacheName);
        }

        return this.createCache(cacheName, {
            ttl: 5 * 60 * 1000,
            maxSize: 2000,
            enableLRU: true
        });
    }


    get(cacheName, key) {
        const cache = this.ensureCache(cacheName);
        if (!cache) return null;

        const entry = cache.data.get(key);
        
     
        if (!entry) {
            cache.misses++;
            this.updateStats(cacheName, 'misses');
            return null;
        }

        const now = Date.now();
        if (now > entry.expiresAt) {

            cache.data.delete(key);
            this.removeFromLRU(cache, key);
            cache.misses++;
            this.updateStats(cacheName, 'misses');
            return null;
        }

        
        if (cache.config.enableLRU) {
            this.updateLRU(cache, key);
        }

        cache.hits++;
        this.updateStats(cacheName, 'hits');
        return entry.value;
    }

    set(cacheName, key, value, customTTL = null) {
        const cache = this.ensureCache(cacheName);
        if (!cache) return false;

        const ttl = customTTL || cache.config.ttl;
        const expiresAt = Date.now() + ttl;

  
        if (cache.config.enableLRU && cache.data.size >= cache.config.maxSize) {
            if (!cache.data.has(key)) {
            
                this.evictLRU(cache, cacheName);
            }
        }


        cache.data.set(key, {
            value,
            expiresAt,
            createdAt: Date.now()
        });


        if (cache.config.enableLRU) {
            this.updateLRU(cache, key);
        }

        cache.sets++;
        this.updateStats(cacheName, 'sets');
        return true;
    }

    delete(cacheName, key) {
        const cache = this.caches.get(cacheName);
        if (!cache) return false;

        const deleted = cache.data.delete(key);
        if (deleted) {
            this.removeFromLRU(cache, key);
            cache.deletes++;
            this.updateStats(cacheName, 'deletes');
        }
        return deleted;
    }

    clear(cacheName) {
        const cache = this.caches.get(cacheName);
        if (!cache) return false;

        const size = cache.data.size;
        cache.data.clear();
        cache.accessOrder = [];
        
        this.updateStats(cacheName, 'size', 0);
        this.log(`[CACHE] Cleared cache '${cacheName}' (${size} entries removed)`);
        return true;
    }


    has(cacheName, key) {
        const cache = this.caches.get(cacheName);
        if (!cache) return false;

        const entry = cache.data.get(key);
        if (!entry) return false;

        if (Date.now() > entry.expiresAt) {
            cache.data.delete(key);
            this.removeFromLRU(cache, key);
            return false;
        }

        return true;
    }


    size(cacheName) {
        const cache = this.caches.get(cacheName);
        return cache ? cache.data.size : 0;
    }


    getStats(cacheName = null) {
        if (cacheName) {
            const stats = this.statistics.get(cacheName);
            const cache = this.caches.get(cacheName);
            if (!stats || !cache) return null;

            const total = stats.hits + stats.misses;
            const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(2) : 0;

            return {
                ...stats,
                hitRate: `${hitRate}%`,
                currentSize: cache.data.size,
                maxSize: cache.config.maxSize,
                ttl: cache.config.ttl
            };
        }

       
        const allStats = {};
        for (const [name, cache] of this.caches.entries()) {
            allStats[name] = this.getStats(name);
        }
        return allStats;
    }

    updateLRU(cache, key) {
        const index = cache.accessOrder.indexOf(key);
        if (index > -1) {
            cache.accessOrder.splice(index, 1);
        }
        cache.accessOrder.push(key);
    }

    removeFromLRU(cache, key) {
        const index = cache.accessOrder.indexOf(key);
        if (index > -1) {
            cache.accessOrder.splice(index, 1);
        }
    }


    evictLRU(cache, cacheName) {
        if (cache.accessOrder.length === 0) return;

        const oldestKey = cache.accessOrder.shift();
        cache.data.delete(oldestKey);
        cache.evictions++;
        this.updateStats(cacheName, 'evictions');
    }


    updateStats(cacheName, type, value = null) {
        const stats = this.statistics.get(cacheName);
        if (!stats) return;

        if (value !== null) {
            stats[type] = value;
        } else {
            stats[type]++;
        }

        const cache = this.caches.get(cacheName);
        if (cache) {
            stats.size = cache.data.size;
        }
    }


    cleanupExpired() {
        const now = Date.now();
        let totalCleaned = 0;

        for (const [cacheName, cache] of this.caches.entries()) {
            let cleaned = 0;
            for (const [key, entry] of cache.data.entries()) {
                if (now > entry.expiresAt) {
                    cache.data.delete(key);
                    this.removeFromLRU(cache, key);
                    cleaned++;
                }
            }
            totalCleaned += cleaned;
            
            if (cleaned > 0) {
                this.updateStats(cacheName, 'size', cache.data.size);
            }
        }

        if (totalCleaned > 0) {
            if (totalCleaned > 10) {
                this.log(`[CACHE] Cleaned ${totalCleaned} expired entries`);
            }
        }
    }


    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        
        for (const cacheName of this.caches.keys()) {
            this.clear(cacheName);
        }

        this.caches.clear();
        this.statistics.clear();
        this.isInitialized = false;
        this.log('[CACHE] Cache manager shut down');
    }


    printStats() {

        const allStats = this.getStats();
        for (const [name, stats] of Object.entries(allStats)) {
            if (!stats) continue;

            if (this.verbose && stats.evictions > 0) {
                console.log(`  Evictions: ${stats.evictions}`);
            }
        }

        if (this.verbose) {
            console.log('─'.repeat(60) + '\n');
        }
    }
}


const cacheManager = new CacheManager();

module.exports = cacheManager;

