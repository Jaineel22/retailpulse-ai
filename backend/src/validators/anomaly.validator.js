const { z } = require('zod');
const { objectId } = require('./common');
const { SEVERITY_LEVELS } = require('../models/Anomaly');

const runAnomalyDetectionSchema = z.object({
  productId: objectId('productId'),
});

const anomalyPointSchema = z.object({
  timestamp: z.string().min(1),
  score: z.number(),
  reason: z.string().min(1),
  severity: z.enum(SEVERITY_LEVELS),
});

// Validates the FastAPI /anomalies response BEFORE persisting — same rationale
// as mlForecastResponseSchema.
const mlAnomalyResponseSchema = z.object({
  productId: z.string().min(1),
  historyDays: z.number().int().nonnegative(),
  generatedAt: z.string().min(1),
  anomalies: z.array(anomalyPointSchema),
});

module.exports = { runAnomalyDetectionSchema, mlAnomalyResponseSchema };
