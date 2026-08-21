/**
 * Retrieval layer for the AI assistant. Classifies the user's question into
 * one of a small, fixed set of intents (plain keyword matching — no
 * embeddings/vector DB, per the approved architecture), then fetches ONLY
 * the data relevant to that intent and shapes it into a small, LLM-ready
 * JSON object.
 *
 * This is the one place responsible for keeping the LLM's input minimal and
 * safe: nothing here ever includes a password hash, a JWT, a raw MongoDB
 * _id, or an unrelated collection's data. If a question doesn't match a
 * known intent, buildContext() returns null and the caller (ai.service.js)
 * must never call the LLM at all for that question.
 */
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const { Order } = require('../models/Order');
const { Prediction } = require('../models/Prediction');
const analyticsService = require('./analytics.service');
const recommendationService = require('./recommendation.service');
const anomalyService = require('./anomaly.service');

const MAX_ITEMS = 10;

// Checked in this order; the first intent whose keywords appear in the
// question wins. More specific/actionable intents are listed before the
// generic ones they'd otherwise be swallowed by (e.g. a stockout question
// usually also mentions "products", so `stockout` must be checked first).
const INTENT_KEYWORDS = [
  ['stockout', ['stockout', 'stock out', 'out of stock', 'run out', 'running out']],
  ['reorder', ['reorder', 're-order', 'how much should i order', 'purchase order', 'restock']],
  ['vendor_performance', ['vendor', 'supplier']],
  ['anomalies', ['anomaly', 'anomalies', 'unusual', 'suspicious', 'irregular']],
  ['predictions', ['forecast', 'predict', 'prediction']],
  ['inventory', ['inventory', 'stock level', 'low stock', 'stock status']],
  ['sales', ['sales', 'revenue']],
  ['orders', ['order', 'orders']],
  ['products', ['product', 'catalog', 'sku']],
];

function classifyIntent(question) {
  const normalized = question.toLowerCase();
  for (const [intent, keywords] of INTENT_KEYWORDS) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return intent;
    }
  }
  return null;
}

async function buildContext(intent) {
  switch (intent) {
    case 'stockout': {
      const risks = await recommendationService.getStockoutRisks();
      const items = risks
        .filter((r) => r.riskLevel !== 'LOW')
        .slice(0, MAX_ITEMS)
        .map((r) => ({
          productName: r.productName,
          sku: r.sku,
          currentStock: r.currentStock,
          forecastDailyDemand: r.forecastDailyDemand,
          daysOfCover: r.daysOfCover,
          riskLevel: r.riskLevel,
          reason: r.reason,
        }));
      return { type: 'stockout_risks', items };
    }

    case 'reorder': {
      const recs = await recommendationService.getReorderRecommendations();
      const items = recs
        .filter((r) => r.recommendedQuantity > 0)
        .slice(0, MAX_ITEMS)
        .map((r) => ({ productName: r.productName, sku: r.sku, recommendedQuantity: r.recommendedQuantity, riskLevel: r.riskLevel, reason: r.reason }));
      return { type: 'reorder_recommendations', items };
    }

    case 'vendor_performance': {
      const vendorRecs = await recommendationService.getVendorRecommendations();
      const performance = await analyticsService.getVendorPerformance();
      return {
        type: 'vendor_performance',
        concerns: vendorRecs.map((v) => ({ vendorName: v.vendorName, severity: v.severity, reason: v.reason })),
        performance: performance.slice(0, MAX_ITEMS).map((v) => ({
          vendorName: v.name,
          orderCount: v.orderCount,
          nonCancelledOrderCount: v.nonCancelledOrderCount,
          salesValue: v.salesValue,
          averageOrderValue: v.averageOrderValue,
        })),
      };
    }

    case 'anomalies': {
      const anomalies = await anomalyService.listAnomalies({});
      const items = anomalies.slice(0, MAX_ITEMS).map((a) => ({
        productName: a.product?.name,
        sku: a.product?.sku,
        timestamp: a.timestamp,
        severity: a.severity,
        reason: a.reason,
        score: a.score,
      }));
      return { type: 'anomalies', items };
    }

    case 'predictions': {
      const predictions = await Prediction.find({}).sort({ generatedAt: -1 }).limit(MAX_ITEMS).populate('product', 'name sku');
      const items = predictions.map((p) => ({
        productName: p.product?.name,
        sku: p.product?.sku,
        horizonDays: p.horizonDays,
        mae: p.mae,
        rmse: p.rmse,
        modelBeatsBaseline: p.modelBeatsBaseline,
        generatedAt: p.generatedAt,
      }));
      return { type: 'predictions', items };
    }

    case 'inventory': {
      const inventory = await Inventory.find({}).populate('product', 'name sku isActive').limit(MAX_ITEMS * 2);
      const items = inventory
        .filter((i) => i.product && i.product.isActive)
        .slice(0, MAX_ITEMS)
        .map((i) => ({
          productName: i.product.name,
          sku: i.product.sku,
          quantity: i.quantity,
          reservedQuantity: i.reservedQuantity,
          reorderThreshold: i.reorderThreshold,
          status: i.status,
        }));
      return { type: 'inventory', items };
    }

    case 'sales': {
      const summary = await analyticsService.getSummary();
      const trend = await analyticsService.getSalesTrend(30);
      return { type: 'sales_summary', summary, recentTrend: trend.slice(-14) };
    }

    case 'orders': {
      const summary = await analyticsService.getSummary();
      const orders = await Order.find({}).sort({ createdAt: -1 }).limit(MAX_ITEMS).populate('vendor', 'name');
      const items = orders.map((o) => ({
        orderNumber: o.orderNumber,
        vendorName: o.vendor?.name,
        status: o.status,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
      }));
      return { type: 'orders', totalOrders: summary.totalOrders, totalSales: summary.totalSales, recentOrders: items };
    }

    case 'products': {
      const products = await Product.find({ isActive: true }).populate('vendor', 'name').limit(MAX_ITEMS);
      const items = products.map((p) => ({ name: p.name, sku: p.sku, category: p.category, price: p.price, vendorName: p.vendor?.name }));
      return { type: 'products', items };
    }

    default:
      return null;
  }
}

module.exports = { classifyIntent, buildContext };
