const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const inventoryService = require('../services/inventory.service');

const create = asyncHandler(async (req, res) => {
  const record = await inventoryService.createInventory(req.body);
  sendSuccess(res, 201, { inventory: record }, 'Inventory record created successfully');
});

const list = asyncHandler(async (req, res) => {
  const records = await inventoryService.listInventory();
  sendSuccess(res, 200, { inventory: records });
});

const getById = asyncHandler(async (req, res) => {
  const record = await inventoryService.getInventoryById(req.params.id);
  sendSuccess(res, 200, { inventory: record });
});

const update = asyncHandler(async (req, res) => {
  const record = await inventoryService.updateInventory(req.params.id, req.body);
  sendSuccess(res, 200, { inventory: record }, 'Inventory record updated successfully');
});

const remove = asyncHandler(async (req, res) => {
  await inventoryService.deleteInventory(req.params.id);
  sendSuccess(res, 200, null, 'Inventory record deleted successfully');
});

module.exports = { create, list, getById, update, remove };
