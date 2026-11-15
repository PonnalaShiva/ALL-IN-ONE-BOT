'use strict';

function normalizeMetricLabel(value) {
    return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64) || 'unknown';
}

function renderPrometheusMetrics(interactionMetrics, cacheStats) {
    const lines = [
        '# HELP bot_interaction_handler_calls_total Completed interaction handlers by feature and interaction type.',
        '# TYPE bot_interaction_handler_calls_total counter',
        '# HELP bot_interaction_handler_errors_total Interaction handlers that threw before completing.',
        '# TYPE bot_interaction_handler_errors_total counter',
        '# HELP bot_interaction_handler_duration_ms_sum Total handler duration in milliseconds.',
        '# TYPE bot_interaction_handler_duration_ms_sum counter',
        '# HELP bot_interaction_handler_duration_ms_max Maximum observed handler duration in milliseconds.',
        '# TYPE bot_interaction_handler_duration_ms_max gauge',
        '# HELP bot_interaction_handler_duration_ms_last Most recent handler duration in milliseconds.',
        '# TYPE bot_interaction_handler_duration_ms_last gauge',
        '# HELP bot_cache_hits_total Successful cache reads.',
        '# TYPE bot_cache_hits_total counter',
        '# HELP bot_cache_misses_total Unsuccessful or expired cache reads.',
        '# TYPE bot_cache_misses_total counter',
        '# HELP bot_cache_entries Current number of entries in a cache.',
        '# TYPE bot_cache_entries gauge',
        '# HELP bot_cache_capacity Maximum number of entries configured for a cache.',
        '# TYPE bot_cache_capacity gauge'
    ];

    for (const metric of interactionMetrics || []) {
        const feature = normalizeMetricLabel(metric.feature);
        const kind = normalizeMetricLabel(metric.kind);
        const labels = `feature="${feature}",kind="${kind}"`;
        lines.push(`bot_interaction_handler_calls_total{${labels}} ${metric.count}`);
        lines.push(`bot_interaction_handler_errors_total{${labels}} ${metric.errors}`);
        lines.push(`bot_interaction_handler_duration_ms_sum{${labels}} ${metric.durationTotalMs}`);
        lines.push(`bot_interaction_handler_duration_ms_max{${labels}} ${metric.durationMaxMs}`);
        lines.push(`bot_interaction_handler_duration_ms_last{${labels}} ${metric.durationLastMs}`);
    }

    for (const [name, stats] of Object.entries(cacheStats || {})) {
        const cache = normalizeMetricLabel(name);
        lines.push(`bot_cache_hits_total{cache="${cache}"} ${stats.hits}`);
        lines.push(`bot_cache_misses_total{cache="${cache}"} ${stats.misses}`);
        lines.push(`bot_cache_entries{cache="${cache}"} ${stats.currentSize}`);
        lines.push(`bot_cache_capacity{cache="${cache}"} ${stats.maxSize}`);
    }

    return `${lines.join('\n')}\n`;
}

module.exports = { renderPrometheusMetrics };
