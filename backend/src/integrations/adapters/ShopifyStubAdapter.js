const IntegrationAdapter = require('./IntegrationAdapter');

/**
 * Deliberately unimplemented second adapter. It exists only to prove the
 * adapter factory can resolve more than one provider without the sync
 * service knowing anything about it — a real Shopify adapter would replace
 * this file's internals without touching sync.service.js or the routes.
 */
class ShopifyStubAdapter extends IntegrationAdapter {
  async fetchProducts() {
    throw new Error('Shopify integration is not yet implemented');
  }

  async fetchInventory() {
    throw new Error('Shopify integration is not yet implemented');
  }

  async fetchOrders() {
    throw new Error('Shopify integration is not yet implemented');
  }
}

module.exports = ShopifyStubAdapter;
