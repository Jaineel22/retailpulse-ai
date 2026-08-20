const MockCommerceAdapter = require('./MockCommerceAdapter');
const ShopifyStubAdapter = require('./ShopifyStubAdapter');

// provider string -> adapter constructor. Adding a real provider later is a
// one-line addition here; sync.service.js and webhook.service.js never change.
const REGISTRY = {
  'mock-commerce': MockCommerceAdapter,
  'shopify-stub': ShopifyStubAdapter,
};

function resolveAdapter(provider, config = {}) {
  const AdapterClass = REGISTRY[provider];
  if (!AdapterClass) {
    throw new Error(`No integration adapter registered for provider "${provider}"`);
  }
  return new AdapterClass(config);
}

module.exports = { resolveAdapter };
