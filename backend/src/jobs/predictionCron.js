/**
 * Optional (SHOULD HAVE, not MUST HAVE) periodic prediction/anomaly run.
 *
 * Disabled unless ENABLE_PREDICTION_CRON=true, and NEVER started under
 * NODE_ENV=test — see server.js, which is the only place this module is
 * required (app.js, which tests import, never touches this file).
 *
 * Deliberately no job queue: this project's scale explicitly rejected
 * Redis/Bull/Kafka/RabbitMQ (see README). A single node-cron schedule that
 * loops over products sequentially is enough here.
 */
const cron = require('node-cron');
const env = require('../config/env');
const Product = require('../models/Product');
const { User } = require('../models/User');
const predictionService = require('../services/prediction.service');
const anomalyService = require('../services/anomaly.service');

async function runForAllProducts(systemUserId) {
  const products = await Product.find({ isActive: true }).select('_id sku');

  for (const product of products) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await predictionService.runPrediction(product._id.toString(), undefined, systemUserId);
    } catch (err) {
      console.error(`[prediction-cron] forecast failed for product ${product.sku}: ${err.message}`);
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await anomalyService.runAnomalyDetection(product._id.toString(), systemUserId);
    } catch (err) {
      console.error(`[prediction-cron] anomaly detection failed for product ${product.sku}: ${err.message}`);
    }
  }
}

function startPredictionCron() {
  if (env.nodeEnv === 'test') return null; // safety net even if accidentally required in tests
  if (!env.enablePredictionCron) return null;

  return cron.schedule(env.predictionCronSchedule, async () => {
    const systemUser = await User.findOne({ role: 'admin' }).select('_id');
    if (!systemUser) {
      console.warn('[prediction-cron] no admin user found to attribute the run to; skipping this run');
      return;
    }
    console.log(`[prediction-cron] starting scheduled run (${env.predictionCronSchedule})`);
    await runForAllProducts(systemUser._id.toString());
    console.log('[prediction-cron] scheduled run complete');
  });
}

module.exports = { startPredictionCron, runForAllProducts };
