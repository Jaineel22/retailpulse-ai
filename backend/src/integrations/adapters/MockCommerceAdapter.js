const IntegrationAdapter = require('./IntegrationAdapter');
const mockCommerceProvider = require('../mockCommerceProvider');

/**
 * Adapter for the simulated "mock-commerce" provider. Translates the mock
 * provider's paginated response shape into the flat arrays IntegrationAdapter
 * callers expect, so the sync/webhook services never deal with pages directly.
 */
class MockCommerceAdapter extends IntegrationAdapter {
  constructor({ simulateFailure = false } = {}) {
    super();
    this.simulateFailure = simulateFailure;
  }

  async #fetchAllPages(fetchPage, options) {
    if (this.simulateFailure) {
      throw new Error('mock-commerce provider is unreachable (simulated outage)');
    }

    const pageSize = options && options.pageSize ? options.pageSize : undefined;
    let page = 1;
    let all = [];

    // Demonstrates walking a paginated upstream API rather than assuming one page.
    while (true) {
      const result = await fetchPage({ page, pageSize });
      all = all.concat(result.data);
      if (!result.hasMore) break;
      page += 1;
    }

    return all;
  }

  async fetchProducts(options) {
    return this.#fetchAllPages(mockCommerceProvider.getProducts, options);
  }

  async fetchInventory(options) {
    return this.#fetchAllPages(mockCommerceProvider.getInventory, options);
  }

  async fetchOrders(options) {
    return this.#fetchAllPages(mockCommerceProvider.getOrders, options);
  }
}

module.exports = MockCommerceAdapter;
