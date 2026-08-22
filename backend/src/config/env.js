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

const nodeEnv = process.env.NODE_ENV || 'development';

function resolveCorsOrigin() {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
  }
  if (nodeEnv === 'production') {
    // Fail closed, not open: an unset CORS_ORIGIN in production must not
    // silently reflect every Origin header. Loud and blocked beats quiet and permissive.
    // eslint-disable-next-line no-console
    console.warn(
      'WARNING: CORS_ORIGIN is not set in production — cross-origin requests will be blocked by default. Set CORS_ORIGIN to your frontend URL(s).'
    );
    return false;
  }
  return true; // dev/test convenience only
}

module.exports = {
  nodeEnv,
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  corsOrigin: resolveCorsOrigin(),
  // Not a real secret — protects the local/demo mock-commerce webhook endpoint only.
  // Safe to default so Phase 2 works out of the box; override in real deployments.
  mockCommerceWebhookSecret: process.env.MOCK_COMMERCE_WEBHOOK_SECRET || 'local-dev-mock-webhook-secret',
  // Phase 3: internal FastAPI ML service. Never exposed to the frontend.
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  mlServiceTimeoutMs: parseInt(process.env.ML_SERVICE_TIMEOUT_MS, 10) || 15000,
  // Optional (SHOULD HAVE) periodic prediction/anomaly run — off by default.
  enablePredictionCron: process.env.ENABLE_PREDICTION_CRON === 'true',
  predictionCronSchedule: process.env.PREDICTION_CRON_SCHEDULE || '0 3 * * *',
  // Phase 4: Gemini LLM provider for the retrieval-grounded AI assistant.
  // Deliberately NOT in `required` above — a missing key must fail the single
  // /api/ai/ask endpoint gracefully (503), not crash the whole application.
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // 'gemini-2.0-flash' was retired by Google (confirmed via a live 404 from
  // the API itself, which named this as the replacement) — the fallback
  // default must not point at a dead model for any deployment that leaves
  // GEMINI_MODEL unset.
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS, 10) || 15000,
};
