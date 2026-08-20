const Vendor = require('../../src/models/Vendor');
const Product = require('../../src/models/Product');
const { Integration } = require('../../src/models/Integration');

let vendorCounter = 0;
let skuCounter = 0;
let integrationCounter = 0;

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

async function createIntegration(defaultVendorId, createdByUserId, overrides = {}) {
  integrationCounter += 1;
  return Integration.create({
    name: `Test Integration ${integrationCounter}`,
    provider: 'mock-commerce',
    isActive: true,
    config: {
      defaultVendor: defaultVendorId,
      pageSize: 2,
      simulateFailure: false,
    },
    createdBy: createdByUserId,
    ...overrides,
  });
}

module.exports = { createVendor, createProduct, createIntegration };
