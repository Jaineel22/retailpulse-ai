const { Anomaly } = require('../models/Anomaly');
const productService = require('./product.service');
const mlServiceClient = require('../utils/mlServiceClient');
const { mlAnomalyResponseSchema } = require('../validators/anomaly.validator');
const ApiError = require('../utils/ApiError');

async function runAnomalyDetection(productId, userId) {
  await productService.getProductById(productId); // throws 404 if the product doesn't exist

  const raw = await mlServiceClient.getAnomalies(productId);

  const parsed = mlAnomalyResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw ApiError.badGateway('ML service returned an invalid anomaly response');
  }
  const data = parsed.data;

  const persisted = [];
  for (const point of data.anomalies) {
    // Upsert by (product, timestamp) — re-running detection for the same day
    // updates that day's record instead of creating a duplicate.
    // eslint-disable-next-line no-await-in-loop
    const doc = await Anomaly.findOneAndUpdate(
      { product: productId, timestamp: new Date(point.timestamp) },
      {
        product: productId,
        timestamp: new Date(point.timestamp),
        score: point.score,
        reason: point.reason,
        severity: point.severity,
        triggeredBy: userId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    persisted.push(doc);
  }

  return persisted;
}

async function listAnomalies(filters = {}) {
  const query = {};
  if (filters.productId) query.product = filters.productId;
  if (filters.severity) query.severity = filters.severity;
  return Anomaly.find(query).sort({ timestamp: -1 }).limit(100).populate('product', 'name sku');
}

module.exports = { runAnomalyDetection, listAnomalies };
