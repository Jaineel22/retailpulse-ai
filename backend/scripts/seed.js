/**
 * Deterministic seed script for local development.
 * Clears the known Phase 1 collections and recreates a fixed, reproducible
 * dataset (same data every run). Refuses to run against NODE_ENV=production.
 *
 * Usage: npm run seed
 */
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User } = require('../src/models/User');
const Vendor = require('../src/models/Vendor');
const Product = require('../src/models/Product');
const Inventory = require('../src/models/Inventory');
const { Order } = require('../src/models/Order');
const { Integration } = require('../src/models/Integration');
const { SyncLog } = require('../src/models/SyncLog');
const { WebhookEvent } = require('../src/models/WebhookEvent');
const { InventoryEvent } = require('../src/models/InventoryEvent');
const { Prediction } = require('../src/models/Prediction');
const { Anomaly } = require('../src/models/Anomaly');

const SALT_ROUNDS = 10;

// --- Deterministic PRNG (mulberry32) -----------------------------------------
// Math.random() would make the seed non-reproducible across runs. A seeded PRNG
// gives the exact same sequence of "random" values every time, which is what
// "deterministic synthetic historical data" requires (Phase 3 blueprint §7).
function mulberry32(seed) {
  let state = seed;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// --- Historical inventory events (for Phase 3 forecasting/anomaly detection) --
const HISTORY_DAYS = 60;

// One demand profile per SKU: a base daily level, a small linear trend, a
// weekend multiplier, and noise amplitude. This is what gives the RandomForest
// model something to actually learn (trend + weekly seasonality) beyond what a
// naive "repeat yesterday" baseline can capture.
const DEMAND_PROFILES = {
  'NWT-001': { base: 22, trend: 0.12, weekendMultiplier: 1.3, noise: 4 },
  'NWT-002': { base: 10, trend: 0.02, weekendMultiplier: 1.1, noise: 3 },
  'NWT-003': { base: 6, trend: -0.03, weekendMultiplier: 1.0, noise: 2 },
  'ALP-001': { base: 14, trend: 0.08, weekendMultiplier: 1.5, noise: 3 },
  'ALP-002': { base: 5, trend: 0.01, weekendMultiplier: 1.4, noise: 2 },
  'ALP-003': { base: 8, trend: -0.02, weekendMultiplier: 1.2, noise: 2 },
  'CGL-001': { base: 12, trend: 0.05, weekendMultiplier: 1.6, noise: 3 },
  'CGL-002': { base: 4, trend: 0.15, weekendMultiplier: 2.0, noise: 2 },
  'CGL-003': { base: 18, trend: 0.0, weekendMultiplier: 1.3, noise: 4 },
};

// A small number of intentionally abnormal days (fixed offsets, not random) so
// anomaly detection has real signal to find when exercised manually.
const ANOMALY_DAY_OFFSETS = {
  'NWT-001': [{ dayOffset: 30, type: 'spike', multiplier: 5 }],
  'CGL-002': [{ dayOffset: 45, type: 'drop', multiplier: 0 }],
};

function generateProductHistory(sku, productId, startDate) {
  const profile = DEMAND_PROFILES[sku];
  const rng = mulberry32(hashStringToInt(sku));
  const anomalies = ANOMALY_DAY_OFFSETS[sku] || [];
  const events = [];

  for (let day = 0; day < HISTORY_DAYS; day += 1) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + day);
    const dayOfWeek = date.getUTCDay(); // 0 = Sunday .. 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let demand = profile.base + profile.trend * day;
    if (isWeekend) demand *= profile.weekendMultiplier;
    demand += (rng() - 0.5) * 2 * profile.noise;

    const anomaly = anomalies.find((a) => a.dayOffset === day);
    if (anomaly) {
      demand = anomaly.type === 'spike' ? profile.base * anomaly.multiplier : anomaly.multiplier;
    }

    demand = Math.max(0, Math.round(demand));

    events.push({
      product: productId,
      type: 'sale',
      delta: -demand,
      source: 'seed',
      createdAt: date,
    });

    // Restock roughly every 10 days — gives inventory.updated-style variation
    // for anomaly features without touching Phase 1's Inventory snapshot values.
    if (day % 10 === 0) {
      const restockAmount = Math.round(profile.base * 8 + rng() * 10);
      events.push({
        product: productId,
        type: 'restock',
        delta: restockAmount,
        source: 'seed',
        createdAt: date,
      });
    }
  }

  return events;
}

const SEED_USERS = [
  { name: 'Admin User', email: 'admin@retailpulse.ai', password: 'Admin123!', role: 'admin' },
  { name: 'Store Operator', email: 'operator@retailpulse.ai', password: 'Operator123!', role: 'operator' },
  { name: 'Data Analyst', email: 'analyst@retailpulse.ai', password: 'Analyst123!', role: 'analyst' },
];

const SEED_VENDORS = [
  {
    name: 'Northwind Traders',
    contactEmail: 'sales@northwindtraders.com',
    contactPhone: '+1-555-0101',
    address: '123 Market St, Seattle, WA',
    status: 'active',
  },
  {
    name: 'Alpine Supply Co.',
    contactEmail: 'orders@alpinesupply.com',
    contactPhone: '+1-555-0102',
    address: '45 Ridge Rd, Denver, CO',
    status: 'active',
  },
  {
    name: 'Coastal Goods Ltd.',
    contactEmail: 'contact@coastalgoods.com',
    contactPhone: '+1-555-0103',
    address: '9 Harbor Ave, Miami, FL',
    status: 'active',
  },
];

const SEED_PRODUCTS_BY_VENDOR = {
  'Northwind Traders': [
    { sku: 'NWT-001', name: 'Organic Coffee Beans 1kg', category: 'Beverages', price: 18.99 },
    { sku: 'NWT-002', name: 'Stainless Steel Water Bottle', category: 'Home Goods', price: 24.5 },
    { sku: 'NWT-003', name: 'Bamboo Cutting Board', category: 'Kitchen', price: 32.0 },
  ],
  'Alpine Supply Co.': [
    { sku: 'ALP-001', name: 'Trail Running Shoes', category: 'Footwear', price: 89.99 },
    { sku: 'ALP-002', name: 'Insulated Hiking Jacket', category: 'Apparel', price: 149.0 },
    { sku: 'ALP-003', name: 'Aluminum Trekking Poles (Pair)', category: 'Outdoor Gear', price: 45.25 },
  ],
  'Coastal Goods Ltd.': [
    { sku: 'CGL-001', name: 'Polarized Sunglasses', category: 'Accessories', price: 39.99 },
    { sku: 'CGL-002', name: 'Beach Umbrella', category: 'Outdoor', price: 59.99 },
    { sku: 'CGL-003', name: 'Reusable Tote Bag', category: 'Accessories', price: 14.99 },
  ],
};

const SEED_INVENTORY_BY_SKU = {
  'NWT-001': { quantity: 120, reservedQuantity: 10, reorderThreshold: 30 },
  'NWT-002': { quantity: 15, reservedQuantity: 2, reorderThreshold: 20 },
  'NWT-003': { quantity: 0, reservedQuantity: 0, reorderThreshold: 10 },
  'ALP-001': { quantity: 60, reservedQuantity: 5, reorderThreshold: 15 },
  'ALP-002': { quantity: 8, reservedQuantity: 1, reorderThreshold: 10 },
  'ALP-003': { quantity: 45, reservedQuantity: 0, reorderThreshold: 10 },
  'CGL-001': { quantity: 5, reservedQuantity: 0, reorderThreshold: 10 },
  'CGL-002': { quantity: 0, reservedQuantity: 0, reorderThreshold: 5 },
  'CGL-003': { quantity: 200, reservedQuantity: 20, reorderThreshold: 50 },
};

const SEED_ORDERS = [
  { vendor: 'Northwind Traders', items: [{ sku: 'NWT-001', quantity: 10 }, { sku: 'NWT-002', quantity: 5 }], status: 'delivered' },
  { vendor: 'Alpine Supply Co.', items: [{ sku: 'ALP-001', quantity: 4 }], status: 'shipped' },
  { vendor: 'Coastal Goods Ltd.', items: [{ sku: 'CGL-003', quantity: 25 }, { sku: 'CGL-001', quantity: 3 }], status: 'pending' },
  { vendor: 'Northwind Traders', items: [{ sku: 'NWT-003', quantity: 8 }], status: 'cancelled' },
  { vendor: 'Alpine Supply Co.', items: [{ sku: 'ALP-002', quantity: 2 }, { sku: 'ALP-003', quantity: 6 }], status: 'confirmed' },
];

async function seed() {
  if (env.nodeEnv === 'production') {
    throw new Error('Refusing to run the destructive seed script against NODE_ENV=production');
  }

  await connectDB(env.mongodbUri);
  console.log(`Connected to ${env.mongodbUri}`);

  console.log('Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Vendor.deleteMany({}),
    Product.deleteMany({}),
    Inventory.deleteMany({}),
    Order.deleteMany({}),
    Integration.deleteMany({}),
    SyncLog.deleteMany({}),
    WebhookEvent.deleteMany({}),
    InventoryEvent.deleteMany({}),
    Prediction.deleteMany({}),
    Anomaly.deleteMany({}),
  ]);

  console.log('Seeding users...');
  const users = [];
  for (const u of SEED_USERS) {
    const password = await bcrypt.hash(u.password, SALT_ROUNDS);
    const user = await User.create({ name: u.name, email: u.email, password, role: u.role });
    users.push(user);
  }
  const adminUser = users.find((u) => u.role === 'admin');
  const operatorUser = users.find((u) => u.role === 'operator');

  console.log('Seeding vendors...');
  const vendorsByName = {};
  for (const v of SEED_VENDORS) {
    const vendor = await Vendor.create(v);
    vendorsByName[vendor.name] = vendor;
  }

  console.log('Seeding products...');
  const productsBySku = {};
  for (const [vendorName, products] of Object.entries(SEED_PRODUCTS_BY_VENDOR)) {
    const vendor = vendorsByName[vendorName];
    for (const p of products) {
      const product = await Product.create({ ...p, vendor: vendor._id });
      productsBySku[product.sku] = product;
    }
  }

  console.log('Seeding inventory...');
  for (const [sku, inv] of Object.entries(SEED_INVENTORY_BY_SKU)) {
    const product = productsBySku[sku];
    await Inventory.create({ product: product._id, ...inv });
  }

  console.log('Seeding historical inventory events (for Phase 3 forecasting)...');
  const historyStart = new Date();
  historyStart.setUTCHours(0, 0, 0, 0);
  historyStart.setUTCDate(historyStart.getUTCDate() - HISTORY_DAYS);
  let totalEvents = 0;
  for (const [sku, product] of Object.entries(productsBySku)) {
    const events = generateProductHistory(sku, product._id, historyStart);
    await InventoryEvent.insertMany(events);
    totalEvents += events.length;
  }

  console.log('Seeding orders...');
  for (const o of SEED_ORDERS) {
    const vendor = vendorsByName[o.vendor];
    const items = o.items.map((item) => {
      const product = productsBySku[item.sku];
      const unitPrice = product.price;
      const subtotal = Number((unitPrice * item.quantity).toFixed(2));
      return { product: product._id, quantity: item.quantity, unitPrice, subtotal };
    });
    const totalAmount = Number(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));
    await Order.create({
      vendor: vendor._id,
      items,
      totalAmount,
      status: o.status,
      createdBy: operatorUser._id,
    });
  }

  console.log('Seeding integration...');
  const integration = await Integration.create({
    name: 'Mock Commerce (Primary)',
    provider: 'mock-commerce',
    isActive: true,
    config: {
      defaultVendor: vendorsByName['Northwind Traders']._id,
      pageSize: 2,
      simulateFailure: false,
    },
    createdBy: adminUser._id,
  });

  console.log('\nSeed complete:');
  console.log(`  Users:            ${SEED_USERS.length}`);
  console.log(`  Vendors:          ${SEED_VENDORS.length}`);
  console.log(`  Products:         ${Object.keys(productsBySku).length}`);
  console.log(`  Inventory:        ${Object.keys(SEED_INVENTORY_BY_SKU).length}`);
  console.log(`  Orders:           ${SEED_ORDERS.length}`);
  console.log(`  Integration:      ${integration.name} (${integration._id})`);
  console.log(`  InventoryEvents:  ${totalEvents} (${HISTORY_DAYS} days x ${Object.keys(productsBySku).length} products)`);
  console.log('\nDev login credentials (local development only):');
  for (const u of SEED_USERS) {
    console.log(`  ${u.role.padEnd(8)} ${u.email} / ${u.password}`);
  }
}

seed()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await disconnectDB();
    process.exit(1);
  });
