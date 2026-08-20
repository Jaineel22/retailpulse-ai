const mongoose = require('mongoose');

const SEVERITY_LEVELS = ['low', 'medium', 'high'];

const anomalySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: SEVERITY_LEVELS,
      required: true,
    },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Re-running anomaly detection for the same product/day upserts rather than duplicating.
anomalySchema.index({ product: 1, timestamp: 1 }, { unique: true });
anomalySchema.index({ severity: 1 });

const Anomaly = mongoose.model('Anomaly', anomalySchema);

module.exports = { Anomaly, SEVERITY_LEVELS };
