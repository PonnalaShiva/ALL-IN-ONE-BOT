'use strict';

const MAX_METRIC_SERIES = 512;
const metrics = new Map();

function normalizeLabel(value) {
    return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64) || 'unknown';
}

function recordInteractionDuration(feature, kind, durationMs, failed = false) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const normalizedFeature = normalizeLabel(feature);
    const normalizedKind = normalizeLabel(kind);
    const key = `${normalizedKind}:${normalizedFeature}`;
    let metric = metrics.get(key);
    if (!metric) {
        if (metrics.size >= MAX_METRIC_SERIES) return;
        metric = {
            feature: normalizedFeature,
            kind: normalizedKind,
            count: 0,
            errors: 0,
            durationTotalMs: 0,
            durationMaxMs: 0,
            durationLastMs: 0
        };
        metrics.set(key, metric);
    }

    metric.count++;
    if (failed) metric.errors++;
    metric.durationTotalMs += durationMs;
    metric.durationMaxMs = Math.max(metric.durationMaxMs, durationMs);
    metric.durationLastMs = durationMs;
}

function getInteractionMetrics() {
    return Array.from(metrics.values(), metric => ({ ...metric }));
}

function resetInteractionMetrics() {
    metrics.clear();
}

module.exports = {
    recordInteractionDuration,
    getInteractionMetrics,
    resetInteractionMetrics,
    MAX_METRIC_SERIES
};
