const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const ApiError = require('../utils/ApiError');
const integrationService = require('../services/integration.service');
const syncService = require('../services/sync.service');

const create = asyncHandler(async (req, res) => {
  const integration = await integrationService.createIntegration(req.body, req.user.id);
  sendSuccess(res, 201, { integration }, 'Integration created successfully');
});

const list = asyncHandler(async (req, res) => {
  const integrations = await integrationService.listIntegrations();
  sendSuccess(res, 200, { integrations });
});

const getById = asyncHandler(async (req, res) => {
  const integration = await integrationService.getIntegrationById(req.params.id);
  sendSuccess(res, 200, { integration });
});

const listSyncLogs = asyncHandler(async (req, res) => {
  const syncLogs = await integrationService.listSyncLogs(req.params.id);
  sendSuccess(res, 200, { syncLogs });
});

const sync = asyncHandler(async (req, res) => {
  const integration = await integrationService.getIntegrationById(req.params.id);

  if (!integration.isActive) {
    throw ApiError.badRequest('Integration is not active');
  }

  const syncLog = await syncService.runSync(integration, req.user.id);

  if (syncLog.status === 'failed') {
    return res.status(502).json({
      success: false,
      message: 'Sync failed',
      data: { syncLog },
    });
  }

  sendSuccess(res, 200, { syncLog }, 'Sync completed successfully');
});

module.exports = { create, list, getById, listSyncLogs, sync };
