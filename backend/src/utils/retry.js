/**
 * Retries an async operation with exponential backoff (no jitter).
 * Intended for transient adapter/upstream-provider failures, not for masking bugs.
 */
async function withRetry(fn, { retries = 2, baseDelayMs = 50 } = {}) {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      attempt += 1;
      if (attempt > retries) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = withRetry;
