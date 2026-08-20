const dotenv = require('dotenv');

dotenv.config();

const required = ['JWT_SECRET'];

if (process.env.NODE_ENV !== 'test') {
  required.push('MONGODB_URI');
}

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : true,
  // Not a real secret — protects the local/demo mock-commerce webhook endpoint only.
  // Safe to default so Phase 2 works out of the box; override in real deployments.
  mockCommerceWebhookSecret: process.env.MOCK_COMMERCE_WEBHOOK_SECRET || 'local-dev-mock-webhook-secret',
  // Phase 3: internal FastAPI ML service. Never exposed to the frontend.
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  mlServiceTimeoutMs: parseInt(process.env.ML_SERVICE_TIMEOUT_MS, 10) || 15000,
  // Optional (SHOULD HAVE) periodic prediction/anomaly run — off by default.
  enablePredictionCron: process.env.ENABLE_PREDICTION_CRON === 'true',
  predictionCronSchedule: process.env.PREDICTION_CRON_SCHEDULE || '0 3 * * *',
};
