const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const vendorService = require('../services/vendor.service');

const create = asyncHandler(async (req, res) => {
  const vendor = await vendorService.createVendor(req.body);
  sendSuccess(res, 201, { vendor }, 'Vendor created successfully');
});

const list = asyncHandler(async (req, res) => {
  const vendors = await vendorService.listVendors();
  sendSuccess(res, 200, { vendors });
});

const getById = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getVendorById(req.params.id);
  sendSuccess(res, 200, { vendor });
});

const update = asyncHandler(async (req, res) => {
  const vendor = await vendorService.updateVendor(req.params.id, req.body);
  sendSuccess(res, 200, { vendor }, 'Vendor updated successfully');
});

const remove = asyncHandler(async (req, res) => {
  await vendorService.deleteVendor(req.params.id);
  sendSuccess(res, 200, null, 'Vendor deleted successfully');
});

module.exports = { create, list, getById, update, remove };
