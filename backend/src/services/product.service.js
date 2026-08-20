const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const ApiError = require('../utils/ApiError');

async function assertVendorExists(vendorId) {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    throw ApiError.badRequest('Referenced vendor does not exist');
  }
  return vendor;
}

async function createProduct(data) {
  await assertVendorExists(data.vendor);
  const product = await Product.create(data);
  return product.populate('vendor', 'name status');
}

async function listProducts(filters = {}) {
  const query = {};
  if (filters.vendor) query.vendor = filters.vendor;
  if (filters.category) query.category = filters.category;
  return Product.find(query).populate('vendor', 'name status').sort({ createdAt: -1 });
}

async function getProductById(id) {
  const product = await Product.findById(id).populate('vendor', 'name status');
  if (!product) {
    throw ApiError.notFound('Product not found');
  }
  return product;
}

async function updateProduct(id, data) {
  if (data.vendor) {
    await assertVendorExists(data.vendor);
  }
  const product = await Product.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate('vendor', 'name status');
  if (!product) {
    throw ApiError.notFound('Product not found');
  }
  return product;
}

async function deleteProduct(id) {
  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }
  return product;
}

module.exports = { createProduct, listProducts, getProductById, updateProduct, deleteProduct };
