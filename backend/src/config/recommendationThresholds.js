/**
 * Centralized, explainable thresholds for the rule-based recommendation
 * engine (backend/src/services/recommendation.service.js). Deliberately not
 * scattered across controllers/services — every number a recommendation
 * depends on lives here, so the logic stays auditable and interview-defensible.
 */
module.exports = {
  stockoutRisk: {
    // Days of cover thresholds. "Days of cover" = availableStock / forecastDailyDemand.
    highRiskMaxDaysOfCover: 3,
    mediumRiskMaxDaysOfCover: 7,
  },
  reorder: {
    // Extra buffer (in days of forecasted demand) added on top of reorderThreshold
    // when computing target stock, so a reorder covers the lead time, not just
    // top off to the bare minimum.
    safetyWindowDays: 7,
  },
  vendorPerformance: {
    // Below this many total orders, cancellation-rate signal is too noisy to act on
    // (e.g. 1 cancelled order out of 1 total looks like 100% but means nothing).
    minOrderCountForSignal: 3,
    highCancellationRate: 0.5,
    mediumCancellationRate: 0.25,
  },
};
