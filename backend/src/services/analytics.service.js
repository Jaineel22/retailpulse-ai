/**
 * All four endpoints compute their results via MongoDB aggregation pipelines
 * ($match/$group/$sort/$project/$lookup) rather than pulling raw documents
 * into Node and reducing them in JavaScript — analytical computation should
 * happen close to the data, not after transferring it into application memory.
 */
const { Order } = require('../models/Order');
const Inventory = require('../models/Inventory');
const Vendor = require('../models/Vendor');

async function getSummary() {
  const [orderStats] = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        nonCancelledOrders: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } },
        totalSales: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$totalAmount', 0] } },
      },
    },
  ]);

  const [inventoryStats] = await Inventory.aggregate([
    {
      $group: {
        _id: null,
        lowStockCount: {
          $sum: {
            $cond: [{ $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$reorderThreshold'] }] }, 1, 0],
          },
        },
        outOfStockCount: { $sum: { $cond: [{ $lte: ['$quantity', 0] }, 1, 0] } },
      },
    },
  ]);

  const totalSales = orderStats?.totalSales || 0;
  const nonCancelledOrders = orderStats?.nonCancelledOrders || 0;

  return {
    totalSales: Number(totalSales.toFixed(2)),
    totalOrders: orderStats?.totalOrders || 0,
    averageOrderValue: nonCancelledOrders > 0 ? Number((totalSales / nonCancelledOrders).toFixed(2)) : 0,
    lowStockProductCount: inventoryStats?.lowStockCount || 0,
    outOfStockProductCount: inventoryStats?.outOfStockCount || 0,
  };
}

async function getSalesTrend(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return Order.aggregate([
    { $match: { createdAt: { $gte: cutoff }, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        sales: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', sales: { $round: ['$sales', 2] }, orders: 1 } },
  ]);
}

async function getTopProducts(limit = 10) {
  return Order.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        quantitySold: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.subtotal' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: '$product.name',
        quantitySold: 1,
        revenue: { $round: ['$revenue', 2] },
      },
    },
  ]);
}

async function getVendorPerformance() {
  return Vendor.aggregate([
    { $lookup: { from: 'orders', localField: '_id', foreignField: 'vendor', as: 'orders' } },
    { $lookup: { from: 'products', localField: '_id', foreignField: 'vendor', as: 'products' } },
    {
      $project: {
        name: 1,
        status: 1,
        productCount: { $size: '$products' },
        orderCount: { $size: '$orders' },
        // Same non-cancelled filter feeds both the count and the sales value,
        // so averageOrderValue (below) divides by the count of orders that
        // actually contributed to salesValue — not the total order volume.
        nonCancelledOrders: { $filter: { input: '$orders', as: 'o', cond: { $ne: ['$$o.status', 'cancelled'] } } },
      },
    },
    {
      $addFields: {
        nonCancelledOrderCount: { $size: '$nonCancelledOrders' },
        salesValue: { $sum: { $map: { input: '$nonCancelledOrders', as: 'o', in: '$$o.totalAmount' } } },
      },
    },
    {
      $addFields: {
        averageOrderValue: {
          $cond: [
            { $eq: ['$nonCancelledOrderCount', 0] },
            0,
            { $round: [{ $divide: ['$salesValue', '$nonCancelledOrderCount'] }, 2] },
          ],
        },
        salesValue: { $round: ['$salesValue', 2] },
      },
    },
    { $sort: { salesValue: -1 } },
    {
      $project: {
        _id: 0,
        vendorId: '$_id',
        name: 1,
        status: 1,
        productCount: 1,
        orderCount: 1,
        nonCancelledOrderCount: 1,
        salesValue: 1,
        averageOrderValue: 1,
      },
    },
  ]);
}

module.exports = { getSummary, getSalesTrend, getTopProducts, getVendorPerformance };
