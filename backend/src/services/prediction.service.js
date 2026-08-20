const { Prediction } = require('../models/Prediction');
const productService = require('./product.service');
const mlServiceClient = require('../utils/mlServiceClient');
const { mlForecastResponseSchema } = require('../validators/prediction.validator');
const ApiError = require('../utils/ApiError');

const DEFAULT_HORIZON_DAYS = 7;

async function runPrediction(productId, horizonDays, userId) {
  await productService.getProductById(productId); // throws 404 if the product doesn't exist

  const horizon = horizonDays || DEFAULT_HORIZON_DAYS;
  const raw = await mlServiceClient.getForecast(productId, horizon);

  const parsed = mlForecastResponseSchema.safeParse(raw);
  if (!parsed.success) {
    // Never persist a malformed/unexpected ML response.
    throw ApiError.badGateway('ML service returned an invalid forecast response');
  }
  const data = parsed.data;

  return Prediction.create({
    product: productId,
    horizonDays: data.horizonDays,
    modelName: data.modelName,
    predictedDemand: data.forecast,
    baselineForecast: data.baselineForecast,
    mae: data.metrics.model.mae,
    rmse: data.metrics.model.rmse,
    baselineMae: data.metrics.baseline.mae,
    baselineRmse: data.metrics.baseline.rmse,
    modelBeatsBaseline: data.modelBeatsBaseline,
    generatedAt: new Date(data.generatedAt),
    triggeredBy: userId,
  });
}

async function listPredictions(productId) {
  await productService.getProductById(productId);
  return Prediction.find({ product: productId }).sort({ generatedAt: -1 }).limit(20);
}

module.exports = { runPrediction, listPredictions };
