const { SyncLog } = require('../models/SyncLog');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { Order } = require('../models/Order');
const { resolveAdapter } = require('../integrations/adapters/adapterFactory');
const withRetry = require('../utils/retry');

async function upsertProduct(external, integration, counts) {
  const existing = await Product.findOne({ externalSource: integration.provider, externalId: external.externalId });

  if (existing) {
    existing.name = external.name;
    existing.price = external.price;
    existing.category = external.category;
    existing.description = external.description;
    await existing.save();
    counts.productsUpdated += 1;
    return;
  }

  await Product.create({
    name: external.name,
    sku: external.sku,
    price: external.price,
    category: external.category,
    description: external.description,
    vendor: integration.config.defaultVendor,
    externalSource: integration.provider,
    externalId: external.externalId,
  });
  counts.productsCreated += 1;
}

async function upsertInventory(external, integration, counts) {
  const product = await Product.findOne({ externalSource: integration.provider, externalId: external.externalId });
  if (!product) {
    counts.inventorySkipped += 1;
    return;
  }

  const existing = await Inventory.findOne({ product: product._id });
  if (existing) {
    existing.quantity = external.quantity;
    if (external.reorderThreshold !== undefined) existing.reorderThreshold = external.reorderThreshold;
    await existing.save();
    counts.inventoryUpdated += 1;
    return;
  }

  await Inventory.create({
    product: product._id,
    quantity: external.quantity,
    reorderThreshold: external.reorderThreshold ?? 0,
  });
  counts.inventoryCreated += 1;
}

async function upsertOrder(external, integration, triggeredByUserId, counts) {
  const existing = await Order.findOne({ externalSource: integration.provider, externalId: external.externalId });
  if (existing) {
    if (external.status && external.status !== existing.status) {
      existing.status = external.status;
      await existing.save();
    }
    counts.ordersUpdated += 1;
    return;
  }

  const items = [];
  for (const item of external.items) {
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findOne({ externalSource: integration.provider, externalId: item.externalProductId });
    if (!product) {
      counts.ordersSkipped += 1;
      return;
    }
    const unitPrice = product.price;
    const subtotal = Number((unitPrice * item.quantity).toFixed(2));
    items.push({ product: product._id, quantity: item.quantity, unitPrice, subtotal });
  }

  const totalAmount = Number(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));

  await Order.create({
    vendor: integration.config.defaultVendor,
    items,
    totalAmount,
    status: external.status || 'pending',
    createdBy: triggeredByUserId,
    externalSource: integration.provider,
    externalId: external.externalId,
  });
  counts.ordersCreated += 1;
}

/**
 * Runs a full sync (products -> inventory -> orders, in that order so orders can
 * always resolve their line items to already-synced products) and always resolves
 * with the SyncLog document, whether the run succeeded or failed. Failures never
 * throw out of this function; the caller is expected to inspect syncLog.status.
 */
async function runSync(integration, triggeredByUserId) {
  const syncLog = await SyncLog.create({
    integration: integration._id,
    type: 'full',
    status: 'running',
    triggeredBy: triggeredByUserId,
  });

  const counts = {
    productsCreated: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    inventoryCreated: 0,
    inventoryUpdated: 0,
    inventorySkipped: 0,
    ordersCreated: 0,
    ordersUpdated: 0,
    ordersSkipped: 0,
  };

  try {
    const adapter = resolveAdapter(integration.provider, integration.config);
    const fetchOptions = { pageSize: integration.config.pageSize };

    const externalProducts = await withRetry(() => adapter.fetchProducts(fetchOptions));
    for (const external of externalProducts) {
      // eslint-disable-next-line no-await-in-loop
      await upsertProduct(external, integration, counts);
    }

    const externalInventory = await withRetry(() => adapter.fetchInventory(fetchOptions));
    for (const external of externalInventory) {
      // eslint-disable-next-line no-await-in-loop
      await upsertInventory(external, integration, counts);
    }

    const externalOrders = await withRetry(() => adapter.fetchOrders(fetchOptions));
    for (const external of externalOrders) {
      // eslint-disable-next-line no-await-in-loop
      await upsertOrder(external, integration, triggeredByUserId, counts);
    }

    syncLog.status = 'success';
    syncLog.counts = counts;
    syncLog.completedAt = new Date();
    await syncLog.save();

    integration.lastSyncAt = new Date();
    integration.lastSyncStatus = 'success';
    await integration.save();
  } catch (err) {
    syncLog.status = 'failed';
    syncLog.counts = counts;
    syncLog.error = err.message;
    syncLog.completedAt = new Date();
    await syncLog.save();

    integration.lastSyncAt = new Date();
    integration.lastSyncStatus = 'failed';
    await integration.save();
  }

  return syncLog;
}

module.exports = { runSync };
