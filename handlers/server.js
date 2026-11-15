
const path = require('path');
const express = require("express");
const logger = require('../utils/logger');
const app = express();
const port = Number(process.env.STATUS_PORT || 8688);
const host = process.env.STATUS_HOST || '127.0.0.1';
const loaders = require('../loaders');
const { evaluateReadiness } = require('../utils/readiness');
const { getInteractionMetrics } = require('../utils/runtimeMetrics');
const { renderPrometheusMetrics } = require('../utils/metricsRenderer');
const cacheManager = require('../utils/cacheManager');
let client = null;
app.get('/', (req, res) => {
    const imagePath = path.join(__dirname, 'index.html');
    res.sendFile(imagePath);
});
app.get('/healthz', (req, res) => {
    let isDbConnected = true;
    try {
        const mongoose = require('mongoose');
        isDbConnected = mongoose.connection?.readyState === 1;
    } catch (_) {}
    const health = evaluateReadiness(client?.isReady?.(), loaders.getLoaderHealth(), isDbConnected);
    res.status(health.ready ? 200 : 503).json(health);
});
app.get('/metrics', (req, res) => {
    const requiredToken = process.env.METRICS_AUTH_TOKEN || process.env.METRICS_TOKEN;
    if (requiredToken) {
        const authHeader = req.headers.authorization || '';
        const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
        if (providedToken !== requiredToken && req.query.token !== requiredToken) {
            return res.status(401).send('Unauthorized: Invalid or missing metrics token\n');
        }
    }
    const body = renderPrometheusMetrics(getInteractionMetrics(), cacheManager.getStats());
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.set('Cache-Control', 'no-store');
    res.send(body);
});
let activeServer = null;

function start(customPort = port, customHost = host) {
    if (activeServer && activeServer.listening) return activeServer;
    activeServer = app.listen(customPort, customHost, () => {
        const address = activeServer.address();
        const boundPort = address && typeof address === 'object' ? address.port : customPort;
        
    });
    activeServer.unref?.();
    activeServer.on('error', error => {
        console.error(`[STATUS SERVER] Listener failed on ${customHost}:${customPort}:`, error.message);
    });
    return activeServer;
}

function close() {
    return new Promise((resolve, reject) => {
        if (!activeServer || !activeServer.listening) return resolve();
        activeServer.close(error => {
            activeServer = null;
            error ? reject(error) : resolve();
        });
    });
}

module.exports = {
    start,
    close,
    get server() {
        if (!activeServer) start();
        return activeServer;
    },
    setClient(discordClient) { client = discordClient || null; }
};
