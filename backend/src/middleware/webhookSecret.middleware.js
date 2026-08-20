const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Lightweight mock authentication for the simulated commerce webhook: the
 * (simulated) provider must send a shared secret header. This is NOT a
 * production-grade HMAC payload signature — there is no timestamp/replay
 * window and the secret is static. Real signature verification (e.g. HMAC
 * over the raw request body, as Stripe/Shopify do) is deferred to the
 * security-hardening phase; this exists only to demonstrate that webhook
 * ingestion should never be left unauthenticated.
 */
function verifyWebhookSecret(req, res, next) {
  const provided = req.headers['x-webhook-secret'];

  if (!provided || typeof provided !== 'string') {
    return next(ApiError.unauthorized('Missing webhook secret'));
  }

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(env.mockCommerceWebhookSecret);

  const isValid = providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!isValid) {
    return next(ApiError.unauthorized('Invalid webhook secret'));
  }

  next();
}

module.exports = verifyWebhookSecret;
