const { Integration } = require('../models/Integration');
const { SyncLog } = require('../models/SyncLog');
const Vendor = require('../models/Vendor');
const ApiError = require('../utils/ApiError');

async function assertVendorExists(vendorId) {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    throw ApiError.badRequest('config.defaultVendor does not reference an existing vendor');
  }
  return vendor;
}

async function createIntegration(data, userId) {
  await assertVendorExists(data.config.defaultVendor);
  return Integration.create({ ...data, createdBy: userId });
}

async function listIntegrations() {
  return Integration.find().sort({ createdAt: -1 });
}

async function getIntegrationById(id) {
  const integration = await Integration.findById(id);
  if (!integration) {
    throw ApiError.notFound('Integration not found');
  }
  return integration;
}

async function listSyncLogs(integrationId) {
  await getIntegrationById(integrationId);
  return SyncLog.find({ integration: integrationId }).sort({ createdAt: -1 });
}

module.exports = { createIntegration, listIntegrations, getIntegrationById, listSyncLogs };
