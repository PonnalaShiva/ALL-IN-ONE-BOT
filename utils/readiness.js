'use strict';

function evaluateReadiness(clientReady, loaderHealth, dbReady = true) {
    const groups = loaderHealth || {};
    const checks = {
        discord: Boolean(clientReady),
        database: Boolean(dbReady),
        gatewayEvents: groups.gatewayEvents?.status || 'not_started',
        systemHandlers: groups.systemHandlers?.status || 'not_started',
        services: groups.services?.status || 'not_started',
        commands: groups.commands?.status || 'not_started',
        postReady: groups.postReady?.status || 'not_started'
    };
    const isHealthy = status => status === 'ready' || status === 'degraded';
    const ready = checks.discord &&
        checks.database &&
        isHealthy(checks.gatewayEvents) &&
        isHealthy(checks.systemHandlers) &&
        isHealthy(checks.services) &&
        checks.commands === 'ready';

    return { ready, status: ready ? 'ready' : 'not_ready', checks };
}

module.exports = { evaluateReadiness };
