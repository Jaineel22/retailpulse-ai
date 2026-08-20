const mongoose = require('mongoose');

const SYNC_STATUSES = ['running', 'success', 'failed'];

const syncCountsSchema = new mongoose.Schema(
  {
    productsCreated: { type: Number, default: 0 },
    productsUpdated: { type: Number, default: 0 },
    productsSkipped: { type: Number, default: 0 },
    inventoryCreated: { type: Number, default: 0 },
    inventoryUpdated: { type: Number, default: 0 },
    inventorySkipped: { type: Number, default: 0 },
    ordersCreated: { type: Number, default: 0 },
    ordersUpdated: { type: Number, default: 0 },
    ordersSkipped: { type: Number, default: 0 },
  },
  { _id: false }
);

const syncLogSchema = new mongoose.Schema(
  {
    integration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Integration',
      required: true,
    },
    // Phase 2 only performs full syncs (products + inventory + orders in one run).
    // Kept as an explicit field so a future phase can add partial sync types without
    // a schema migration.
    type: {
      type: String,
      enum: ['full'],
      default: 'full',
    },
    status: {
      type: String,
      enum: SYNC_STATUSES,
      default: 'running',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    counts: {
      type: syncCountsSchema,
      default: () => ({}),
    },
    error: {
      type: String,
    },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

syncLogSchema.index({ integration: 1, createdAt: -1 });

const SyncLog = mongoose.model('SyncLog', syncLogSchema);

module.exports = { SyncLog, SYNC_STATUSES };
