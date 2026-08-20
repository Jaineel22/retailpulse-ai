const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const analyticsService = require('../services/analytics.service');

const summary = asyncHandler(async (req, res) => {
  const data = await analyticsService.getSummary();
  sendSuccess(res, 200, data);
});

const salesTrend = asyncHandler(async (req, res) => {
  const days = req.query.days ? parseInt(req.query.days, 10) : 30;
  const trend = await analyticsService.getSalesTrend(Number.isNaN(days) ? 30 : days);
  sendSuccess(res, 200, { trend });
});

const topProducts = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  const products = await analyticsService.getTopProducts(Number.isNaN(limit) ? 10 : limit);
  sendSuccess(res, 200, { products });
});

const vendorPerformance = asyncHandler(async (req, res) => {
  const vendors = await analyticsService.getVendorPerformance();
  sendSuccess(res, 200, { vendors });
});

module.exports = { summary, salesTrend, topProducts, vendorPerformance };
