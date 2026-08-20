const Vendor = require('../../src/models/Vendor');
const Product = require('../../src/models/Product');

let vendorCounter = 0;
let skuCounter = 0;

async function createVendor(overrides = {}) {
  vendorCounter += 1;
  return Vendor.create({
    name: `Test Vendor ${vendorCounter}`,
    contactEmail: 'vendor@example.com',
    status: 'active',
    ...overrides,
  });
}

async function createProduct(vendorId, overrides = {}) {
  skuCounter += 1;
  return Product.create({
    name: 'Test Product',
    sku: `SKU-TEST-${String(skuCounter).padStart(4, '0')}`,
    price: 9.99,
    vendor: vendorId,
    ...overrides,
  });
}

module.exports = { createVendor, createProduct };
