const { Order } = require('../models/Order');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');

async function buildOrderItems(vendorId, items) {
  const productIds = items.map((item) => item.product);
  const products = await Product.find({ _id: { $in: productIds } });

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  return items.map((item) => {
    const product = productMap.get(item.product);
    if (!product) {
      throw ApiError.badRequest(`Referenced product does not exist: ${item.product}`);
    }
    if (product.vendor.toString() !== vendorId) {
      throw ApiError.badRequest(`Product "${product.name}" does not belong to the specified vendor`);
    }
    const unitPrice = product.price;
    const subtotal = Number((unitPrice * item.quantity).toFixed(2));
    return {
      product: product._id,
      quantity: item.quantity,
      unitPrice,
      subtotal,
    };
  });
}

async function createOrder(data, userId) {
  const vendor = await Vendor.findById(data.vendor);
  if (!vendor) {
    throw ApiError.badRequest('Referenced vendor does not exist');
  }

  const items = await buildOrderItems(data.vendor, data.items);
  const totalAmount = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));

  return Order.create({
    vendor: data.vendor,
    items,
    totalAmount,
    createdBy: userId,
  });
}

async function listOrders(filters = {}) {
  const query = {};
  if (filters.vendor) query.vendor = filters.vendor;
  if (filters.status) query.status = filters.status;
  return Order.find(query)
    .populate('vendor', 'name status')
    .populate('items.product', 'name sku')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
}

async function getOrderById(id) {
  const order = await Order.findById(id)
    .populate('vendor', 'name status')
    .populate('items.product', 'name sku')
    .populate('createdBy', 'name email');
  if (!order) {
    throw ApiError.notFound('Order not found');
  }
  return order;
}

async function updateOrderStatus(id, status) {
  const order = await Order.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  )
    .populate('vendor', 'name status')
    .populate('items.product', 'name sku')
    .populate('createdBy', 'name email');
  if (!order) {
    throw ApiError.notFound('Order not found');
  }
  return order;
}

async function deleteOrder(id) {
  const order = await Order.findByIdAndDelete(id);
  if (!order) {
    throw ApiError.notFound('Order not found');
  }
  return order;
}

module.exports = { createOrder, listOrders, getOrderById, updateOrderStatus, deleteOrder };
