/**
 * Rule-based, deterministic operational recommendations. No LLM involvement —
 * every number here is computed from existing Inventory/Product/Vendor/
 * Prediction/analytics data via transparent, centrally-configured thresholds
 * (see config/recommendationThresholds.js), so every result is explainable.
 */
const Inventory = require('../models/Inventory');
const { Prediction } = require('../models/Prediction');
const analyticsService = require('./analytics.service');
const thresholds = require('../config/recommendationThresholds');

const RISK_ORDER = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function averageForecastDemand(predictedDemand) {
  if (!predictedDemand || predictedDemand.length === 0) return null;
  const sum = predictedDemand.reduce((acc, point) => acc + point.value, 0);
  return sum / predictedDemand.length;
}

async function getLatestPredictionsByProduct(productIds) {
  if (productIds.length === 0) return new Map();

  const results = await Prediction.aggregate([
    { $match: { product: { $in: productIds } } },
    { $sort: { generatedAt: -1 } },
    { $group: { _id: '$product', predictedDemand: { $first: '$predictedDemand' } } },
  ]);

  return new Map(results.map((r) => [r._id.toString(), r.predictedDemand]));
}

/**
 * Core stockout-risk classification. Prefers a demand forecast (the average
 * of the most recent Prediction's forecast points) when one exists; falls
 * back to a simpler reorder-threshold-only rule when it doesn't, so a product
 * that has never had a forecast run still gets a sensible, explained result.
 */
function classifyStockoutRisk({ availableStock, forecastDailyDemand, reorderThreshold }) {
  if (forecastDailyDemand !== null && forecastDailyDemand > 0) {
    const daysOfCover = Number((availableStock / forecastDailyDemand).toFixed(1));
    let riskLevel;
    if (availableStock <= 0 || daysOfCover <= thresholds.stockoutRisk.highRiskMaxDaysOfCover) {
      riskLevel = 'HIGH';
    } else if (daysOfCover <= thresholds.stockoutRisk.mediumRiskMaxDaysOfCover) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }
    const reason =
      availableStock <= 0
        ? `Product is out of stock; forecasted demand is ${forecastDailyDemand.toFixed(1)} units/day.`
        : `At the forecasted demand of ${forecastDailyDemand.toFixed(1)} units/day, current stock covers approximately ${daysOfCover} day(s).`;
    return { daysOfCover, riskLevel, reason };
  }

  let riskLevel;
  if (availableStock <= 0) riskLevel = 'HIGH';
  else if (availableStock <= reorderThreshold) riskLevel = 'MEDIUM';
  else riskLevel = 'LOW';

  let reason;
  if (availableStock <= 0) {
    reason = 'Product is out of stock. No demand forecast is available yet for this product.';
  } else if (availableStock <= reorderThreshold) {
    reason = `Current stock (${availableStock}) is at or below the reorder threshold (${reorderThreshold}). No demand forecast is available yet.`;
  } else {
    reason = `Current stock (${availableStock}) is above the reorder threshold (${reorderThreshold}). No demand forecast is available yet.`;
  }
  return { daysOfCover: null, riskLevel, reason };
}

async function getStockoutRisks() {
  const inventoryRecords = await Inventory.find({}).populate('product', 'name sku isActive');
  const activeRecords = inventoryRecords.filter((record) => record.product && record.product.isActive);

  const productIds = activeRecords.map((record) => record.product._id);
  const predictionsByProduct = await getLatestPredictionsByProduct(productIds);

  const risks = activeRecords.map((record) => {
    const availableStock = record.quantity - (record.reservedQuantity || 0);
    const predictedDemand = predictionsByProduct.get(record.product._id.toString());
    const forecastDailyDemand = predictedDemand ? averageForecastDemand(predictedDemand) : null;

    const { daysOfCover, riskLevel, reason } = classifyStockoutRisk({
      availableStock,
      forecastDailyDemand,
      reorderThreshold: record.reorderThreshold,
    });

    return {
      productId: record.product._id,
      productName: record.product.name,
      sku: record.product.sku,
      currentStock: availableStock,
      forecastDailyDemand: forecastDailyDemand !== null ? Number(forecastDailyDemand.toFixed(2)) : null,
      daysOfCover,
      reorderThreshold: record.reorderThreshold,
      riskLevel,
      reason,
    };
  });

  return risks.sort((a, b) => RISK_ORDER[b.riskLevel] - RISK_ORDER[a.riskLevel]);
}

function buildReorderRecommendations(risks) {
  return risks
    .map((risk) => {
      const forecast = risk.forecastDailyDemand || 0;
      const safetyBuffer = forecast * thresholds.reorder.safetyWindowDays;
      const targetStock = Math.ceil(risk.reorderThreshold + safetyBuffer);
      const recommendedQuantity = Math.max(targetStock - risk.currentStock, 0);

      const reason =
        recommendedQuantity > 0
          ? `Target stock is ${targetStock} (reorder threshold ${risk.reorderThreshold} + ${thresholds.reorder.safetyWindowDays}-day forecasted demand of ${safetyBuffer.toFixed(1)}). Current available stock is ${risk.currentStock}, so ${recommendedQuantity} unit(s) are recommended.`
          : `Current available stock (${risk.currentStock}) already meets or exceeds the target stock (${targetStock}); no reorder is currently needed.`;

      return {
        productId: risk.productId,
        productName: risk.productName,
        sku: risk.sku,
        recommendedQuantity,
        riskLevel: risk.riskLevel,
        reason,
      };
    })
    .sort((a, b) => b.recommendedQuantity - a.recommendedQuantity);
}

async function getReorderRecommendations() {
  const risks = await getStockoutRisks();
  return buildReorderRecommendations(risks);
}

function buildVendorRecommendations(vendorPerformance) {
  return vendorPerformance
    .map((vendor) => {
      const cancelledOrders = vendor.orderCount - vendor.nonCancelledOrderCount;
      const cancellationRate = vendor.orderCount > 0 ? cancelledOrders / vendor.orderCount : 0;
      const hasEnoughSignal = vendor.orderCount >= thresholds.vendorPerformance.minOrderCountForSignal;

      let severity = null;
      let reason = null;

      if (vendor.productCount > 0 && vendor.orderCount === 0) {
        severity = 'MEDIUM';
        reason = `Vendor has ${vendor.productCount} listed product(s) but no orders have ever been placed.`;
      } else if (hasEnoughSignal && cancellationRate >= thresholds.vendorPerformance.highCancellationRate) {
        severity = 'HIGH';
        reason = `${cancelledOrders} of ${vendor.orderCount} orders (${Math.round(cancellationRate * 100)}%) were cancelled.`;
      } else if (hasEnoughSignal && cancellationRate >= thresholds.vendorPerformance.mediumCancellationRate) {
        severity = 'MEDIUM';
        reason = `${cancelledOrders} of ${vendor.orderCount} orders (${Math.round(cancellationRate * 100)}%) were cancelled.`;
      }

      if (!severity) return null;

      return {
        vendorId: vendor.vendorId,
        vendorName: vendor.name,
        recommendationType: 'vendor_decline',
        severity,
        reason,
      };
    })
    .filter(Boolean);
}

async function getVendorRecommendations() {
  const vendorPerformance = await analyticsService.getVendorPerformance();
  return buildVendorRecommendations(vendorPerformance);
}

async function getAllRecommendations() {
  const [risks, vendorPerformance] = await Promise.all([getStockoutRisks(), analyticsService.getVendorPerformance()]);

  return {
    stockoutRisks: risks,
    reorderRecommendations: buildReorderRecommendations(risks),
    vendorRecommendations: buildVendorRecommendations(vendorPerformance),
  };
}

module.exports = { getStockoutRisks, getReorderRecommendations, getVendorRecommendations, getAllRecommendations };
