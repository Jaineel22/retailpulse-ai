const env = require('../config/env');
const ApiError = require('./ApiError');

/**
 * Thin client for the Gemini API. Deliberately the ONLY place in the backend
 * that talks to the LLM provider — everything else builds a prompt and hands
 * it here. Uses Node's built-in fetch with an explicit AbortController
 * timeout, same pattern as mlServiceClient.js, so a slow/unreachable provider
 * can never hang or crash the Express process.
 */
async function askGemini(prompt) {
  if (!env.geminiApiKey) {
    // Missing configuration must fail this one endpoint gracefully, not the app.
    throw ApiError.serviceUnavailable('AI assistant is not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.aiTimeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    // Never log the API key (it's only ever in the URL of this one request,
    // never in `err`, and we don't log `url` at all).
    throw ApiError.badGateway('AI provider is unavailable');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // Never return the provider's raw error body to the client — it can
    // contain implementation details we don't want to leak.
    throw ApiError.badGateway('AI provider returned an unexpected error');
  }

  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw ApiError.badGateway('AI provider returned an unexpected response');
  }

  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw ApiError.badGateway('AI provider returned an empty response');
  }

  return text.trim();
}

module.exports = { askGemini };
