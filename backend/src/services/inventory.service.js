const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');

async function assertProductExists(productId) {
  const product = await Product.findById(productId);
  if (!product) {
    throw ApiError.badRequest('Referenced product does not exist');
  }
  return product;
}

async function createInventory(data) {
  await assertProductExists(data.product);

  const existing = await Inventory.findOne({ product: data.product });
  if (existing) {
    throw ApiError.conflict('Inventory record already exists for this product');
  }

  const record = await Inventory.create(data);
  return record.populate('product', 'name sku price');
}

async function listInventory() {
  return Inventory.find().populate('product', 'name sku price').sort({ createdAt: -1 });
}

async function getInventoryById(id) {
  const record = await Inventory.findById(id).populate('product', 'name sku price');
  if (!record) {
    throw ApiError.notFound('Inventory record not found');
  }
  return record;
}

async function updateInventory(id, data) {
  const record = await Inventory.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate('product', 'name sku price');
  if (!record) {
    throw ApiError.notFound('Inventory record not found');
  }
  return record;
}

async function deleteInventory(id) {
  const record = await Inventory.findByIdAndDelete(id);
  if (!record) {
    throw ApiError.notFound('Inventory record not found');
  }
  return record;
}

module.exports = { createInventory, listInventory, getInventoryById, updateInventory, deleteInventory };
