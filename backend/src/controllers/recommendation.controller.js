const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const recommendationService = require('../services/recommendation.service');

const all = asyncHandler(async (req, res) => {
  const data = await recommendationService.getAllRecommendations();
  sendSuccess(res, 200, data);
});

const stockout = asyncHandler(async (req, res) => {
  const stockoutRisks = await recommendationService.getStockoutRisks();
  sendSuccess(res, 200, { stockoutRisks });
});

const reorder = asyncHandler(async (req, res) => {
  const reorderRecommendations = await recommendationService.getReorderRecommendations();
  sendSuccess(res, 200, { reorderRecommendations });
});

const vendors = asyncHandler(async (req, res) => {
  const vendorRecommendations = await recommendationService.getVendorRecommendations();
  sendSuccess(res, 200, { vendorRecommendations });
});

module.exports = { all, stockout, reorder, vendors };
