const Vendor = require('../models/Vendor');
const ApiError = require('../utils/ApiError');

async function createVendor(data) {
  return Vendor.create(data);
}

async function listVendors() {
  return Vendor.find().sort({ createdAt: -1 });
}

async function getVendorById(id) {
  const vendor = await Vendor.findById(id);
  if (!vendor) {
    throw ApiError.notFound('Vendor not found');
  }
  return vendor;
}

async function updateVendor(id, data) {
  const vendor = await Vendor.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!vendor) {
    throw ApiError.notFound('Vendor not found');
  }
  return vendor;
}

async function deleteVendor(id) {
  const vendor = await Vendor.findByIdAndDelete(id);
  if (!vendor) {
    throw ApiError.notFound('Vendor not found');
  }
  return vendor;
}

module.exports = { createVendor, listVendors, getVendorById, updateVendor, deleteVendor };
