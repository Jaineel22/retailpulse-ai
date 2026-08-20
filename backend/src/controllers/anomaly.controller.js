const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const anomalyService = require('../services/anomaly.service');

const run = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const anomalies = await anomalyService.runAnomalyDetection(productId, req.user.id);
  sendSuccess(res, 201, { anomalies }, 'Anomaly detection completed successfully');
});

const list = asyncHandler(async (req, res) => {
  const anomalies = await anomalyService.listAnomalies({
    productId: req.query.productId,
    severity: req.query.severity,
  });
  sendSuccess(res, 200, { anomalies });
});

module.exports = { run, list };
