'use strict';

const mongoose = require('mongoose');

const applicationDecisionSchema = new mongoose.Schema({
    reviewMessageId: { type: String, required: true },
    targetUserId: { type: String, required: true },
    appName: { type: String, required: true },
    action: { type: String, enum: ['accept', 'deny'], required: true },
    moderatorId: { type: String, required: true },
    claimToken: { type: String, default: null },
    completed: { type: Boolean, default: false },
    leaseUntil: { type: Date, default: () => new Date(0) },
    decidedAt: { type: Date, default: null }
}, { timestamps: true });

applicationDecisionSchema.index({ reviewMessageId: 1 }, { unique: true });

module.exports = mongoose.models.ApplicationDecision ||
    mongoose.model('ApplicationDecision', applicationDecisionSchema);
