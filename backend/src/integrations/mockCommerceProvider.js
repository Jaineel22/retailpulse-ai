/**
 * Simulated third-party commerce platform.
 *
 * This module stands in for an external system RetailPulse does not control —
 * think "the Shopify/BigCommerce REST API" from the adapter's point of view.
 * It intentionally does NOT touch Mongoose models or the RetailPulse database;
 * it only returns plain, paginated, provider-shaped data, exactly like a real
 * HTTP API response would. MockCommerceAdapter is the only thing allowed to
 * depend on this module.
 *
 * Data is fixed and deterministic so syncs are repeatable across test runs.
 */

const PRODUCTS = [
  { externalId: 'mock-prod-001', name: 'External Wireless Mouse', sku: 'EXT-MOUSE-001', category: 'Electronics', price: 25.99, description: 'Ergonomic wireless mouse' },
  { externalId: 'mock-prod-002', name: 'External Mechanical Keyboard', sku: 'EXT-KEYB-001', category: 'Electronics', price: 79.99, description: 'Tactile mechanical keyboard' },
  { externalId: 'mock-prod-003', name: 'External USB-C Hub', sku: 'EXT-HUB-001', category: 'Electronics', price: 34.5, description: '7-in-1 USB-C hub' },
  { externalId: 'mock-prod-004', name: 'External Laptop Stand', sku: 'EXT-STAND-001', category: 'Office', price: 42.0, description: 'Aluminum adjustable laptop stand' },
  { externalId: 'mock-prod-005', name: 'External Desk Lamp', sku: 'EXT-LAMP-001', category: 'Office', price: 29.99, description: 'LED desk lamp with USB port' },
];

const INVENTORY = [
  { externalId: 'mock-prod-001', quantity: 80, reorderThreshold: 15 },
  { externalId: 'mock-prod-002', quantity: 12, reorderThreshold: 20 },
  { externalId: 'mock-prod-003', quantity: 0, reorderThreshold: 10 },
  { externalId: 'mock-prod-004', quantity: 45, reorderThreshold: 10 },
  { externalId: 'mock-prod-005', quantity: 6, reorderThreshold: 12 },
];

const ORDERS = [
  { externalId: 'mock-order-001', status: 'confirmed', items: [{ externalProductId: 'mock-prod-001', quantity: 3 }, { externalProductId: 'mock-prod-003', quantity: 1 }] },
  { externalId: 'mock-order-002', status: 'pending', items: [{ externalProductId: 'mock-prod-002', quantity: 1 }] },
  { externalId: 'mock-order-003', status: 'shipped', items: [{ externalProductId: 'mock-prod-004', quantity: 2 }, { externalProductId: 'mock-prod-005', quantity: 2 }] },
];

function paginate(records, { page = 1, pageSize = 2 } = {}) {
  const start = (page - 1) * pageSize;
  const data = records.slice(start, start + pageSize);
  return {
    data,
    page,
    pageSize,
    total: records.length,
    hasMore: start + pageSize < records.length,
  };
}

async function getProducts(options) {
  return paginate(PRODUCTS, options);
}

async function getInventory(options) {
  return paginate(INVENTORY, options);
}

async function getOrders(options) {
  return paginate(ORDERS, options);
}

module.exports = { getProducts, getInventory, getOrders };
