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

const SALT_ROUNDS = 10;

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

  console.log('Clearing existing Phase 1 collections...');
  await Promise.all([
    User.deleteMany({}),
    Vendor.deleteMany({}),
    Product.deleteMany({}),
    Inventory.deleteMany({}),
    Order.deleteMany({}),
  ]);

  console.log('Seeding users...');
  const users = [];
  for (const u of SEED_USERS) {
    const password = await bcrypt.hash(u.password, SALT_ROUNDS);
    const user = await User.create({ name: u.name, email: u.email, password, role: u.role });
    users.push(user);
  }
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

  console.log('\nSeed complete:');
  console.log(`  Users:     ${SEED_USERS.length}`);
  console.log(`  Vendors:   ${SEED_VENDORS.length}`);
  console.log(`  Products:  ${Object.keys(productsBySku).length}`);
  console.log(`  Inventory: ${Object.keys(SEED_INVENTORY_BY_SKU).length}`);
  console.log(`  Orders:    ${SEED_ORDERS.length}`);
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
