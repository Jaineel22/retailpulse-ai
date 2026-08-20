const env = require('../config/env');
const ApiError = require('./ApiError');

/**
 * Thin HTTP client for the internal FastAPI ML service. Uses Node's built-in
 * fetch (no new dependency needed) with an explicit timeout via AbortController,
 * so a hung/unreachable ML service can never hang or crash the Express process
 * — it always resolves into a safe ApiError instead.
 */
async function callMlService(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.mlServiceTimeoutMs);

  let res;
  try {
    res = await fetch(`${env.mlServiceUrl}${path}`, { signal: controller.signal });
  } catch (err) {
    throw ApiError.badGateway('ML service is unavailable');
  } finally {
    clearTimeout(timeout);
  }

  let body = null;
  try {
    body = await res.json();
  } catch (err) {
    // Non-JSON response body — fall through with body === null.
  }

  if (!res.ok) {
    const code = body && body.detail && body.detail.code;
    if (code === 'INSUFFICIENT_HISTORY') {
      const { minimumDaysRequired, daysAvailable } = body.detail;
      throw ApiError.badRequest(
        `Insufficient historical data to analyze this product (need at least ${minimumDaysRequired} days, have ${daysAvailable}).`
      );
    }
    if (code === 'INVALID_PRODUCT_ID') {
      throw ApiError.badRequest(body.detail.message);
    }
    throw ApiError.badGateway('ML service returned an unexpected error');
  }

  return body;
}

function getForecast(productId, horizonDays) {
  return callMlService(`/forecast/${productId}?horizonDays=${horizonDays}`);
}

function getAnomalies(productId) {
  return callMlService(`/anomalies/${productId}`);
}

module.exports = { getForecast, getAnomalies };
