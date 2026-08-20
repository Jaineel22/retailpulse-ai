const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const predictionService = require('../services/prediction.service');

const run = asyncHandler(async (req, res) => {
  const { productId, horizonDays } = req.body;
  const prediction = await predictionService.runPrediction(productId, horizonDays, req.user.id);
  sendSuccess(res, 201, { prediction }, 'Prediction generated successfully');
});

const list = asyncHandler(async (req, res) => {
  const predictions = await predictionService.listPredictions(req.params.productId);
  sendSuccess(res, 200, { predictions });
});

module.exports = { run, list };
