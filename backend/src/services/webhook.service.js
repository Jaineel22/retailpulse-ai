const { WebhookEvent } = require('../models/WebhookEvent');
const { Integration } = require('../models/Integration');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { Order } = require('../models/Order');
const ApiError = require('../utils/ApiError');

async function getActiveIntegration(provider) {
  const integration = await Integration.findOne({ provider, isActive: true });
  if (!integration) {
    throw ApiError.badRequest(`No active "${provider}" integration is configured to receive this webhook`);
  }
  return integration;
}

async function applyProductUpdated(data, integration) {
  const product = await Product.findOne({ externalSource: integration.provider, externalId: data.externalId });
  if (!product) {
    throw ApiError.notFound(`No synced product found for externalId "${data.externalId}"`);
  }
  if (data.name !== undefined) product.name = data.name;
  if (data.price !== undefined) product.price = data.price;
  if (data.category !== undefined) product.category = data.category;
  if (data.description !== undefined) product.description = data.description;
  await product.save();
  return product;
}

async function applyInventoryUpdated(data, integration) {
  const product = await Product.findOne({ externalSource: integration.provider, externalId: data.externalId });
  if (!product) {
    throw ApiError.notFound(`No synced product found for externalId "${data.externalId}"`);
  }

  let inventory = await Inventory.findOne({ product: product._id });
  if (inventory) {
    inventory.quantity = data.quantity;
    if (data.reorderThreshold !== undefined) inventory.reorderThreshold = data.reorderThreshold;
  } else {
    inventory = new Inventory({
      product: product._id,
      quantity: data.quantity,
      reorderThreshold: data.reorderThreshold ?? 0,
    });
  }
  await inventory.save();
  return inventory;
}

async function applyOrderCreated(data, integration) {
  const existing = await Order.findOne({ externalSource: integration.provider, externalId: data.externalId });
  if (existing) {
    return existing;
  }

  const items = [];
  for (const item of data.items) {
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findOne({ externalSource: integration.provider, externalId: item.externalProductId });
    if (!product) {
      throw ApiError.notFound(`No synced product found for externalId "${item.externalProductId}"`);
    }
    const unitPrice = product.price;
    const subtotal = Number((unitPrice * item.quantity).toFixed(2));
    items.push({ product: product._id, quantity: item.quantity, unitPrice, subtotal });
  }

  const totalAmount = Number(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));

  return Order.create({
    vendor: integration.config.defaultVendor,
    items,
    totalAmount,
    status: data.status || 'pending',
    createdBy: integration.createdBy,
    externalSource: integration.provider,
    externalId: data.externalId,
  });
}

async function applyOrderUpdated(data, integration) {
  const order = await Order.findOne({ externalSource: integration.provider, externalId: data.externalId });
  if (!order) {
    throw ApiError.notFound(`No synced order found for externalId "${data.externalId}"`);
  }
  order.status = data.status;
  await order.save();
  return order;
}

const HANDLERS = {
  'product.updated': applyProductUpdated,
  'inventory.updated': applyInventoryUpdated,
  'order.created': applyOrderCreated,
  'order.updated': applyOrderUpdated,
};

/**
 * Idempotently processes a webhook event.
 *
 * Idempotency is enforced by the (provider, eventId) unique index on WebhookEvent
 * (see the model), not just the findOne fast-path below — the fast-path only avoids
 * a redundant write in the common case; the unique-index catch is what makes this
 * safe under concurrent duplicate deliveries.
 *
 * Once an (provider, eventId) pair has been recorded — success or failure — it is
 * considered permanently seen. A failed event is not silently retried on replay; the
 * provider would need to send a new eventId. This is a deliberate Phase 2
 * simplification, documented in docs/API.md.
 */
async function processMockCommerceWebhook({ eventId, type, provider, data }) {
  const existing = await WebhookEvent.findOne({ provider, eventId });
  if (existing) {
    return { duplicate: true, event: existing };
  }

  let eventDoc;
  try {
    eventDoc = await WebhookEvent.create({ provider, eventId, type, payload: data, status: 'received' });
  } catch (err) {
    if (err.code === 11000) {
      const dup = await WebhookEvent.findOne({ provider, eventId });
      return { duplicate: true, event: dup };
    }
    throw err;
  }

  try {
    const integration = await getActiveIntegration(provider);
    const handler = HANDLERS[type];
    await handler(data, integration);
    eventDoc.status = 'processed';
    eventDoc.processedAt = new Date();
    await eventDoc.save();
  } catch (err) {
    eventDoc.status = 'failed';
    eventDoc.error = err.message;
    await eventDoc.save();
  }

  return { duplicate: false, event: eventDoc };
}

module.exports = { processMockCommerceWebhook };
