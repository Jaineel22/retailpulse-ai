/**
 * Contract every commerce integration adapter must implement.
 *
 * An adapter's job is to talk to one specific external commerce provider and
 * return data in a plain, provider-agnostic shape. Nothing above this layer
 * (the sync service, webhook service, controllers) should know anything
 * provider-specific — that is what keeps a second provider pluggable without
 * rewriting the integration service.
 *
 * fetchProducts/fetchOrders/fetchInventory must each resolve to a plain array
 * (adapters are responsible for walking any pagination the provider exposes).
 */
class IntegrationAdapter {
  /**
   * @param {{ pageSize?: number }} [options]
   * @returns {Promise<Array<{ externalId: string, name: string, sku: string, price: number, category?: string, description?: string }>>}
   */
  async fetchProducts(options) {
    throw new Error(`${this.constructor.name} must implement fetchProducts()`);
  }

  /**
   * @param {{ pageSize?: number }} [options]
   * @returns {Promise<Array<{ externalId: string, quantity: number, reorderThreshold?: number }>>}
   */
  async fetchInventory(options) {
    throw new Error(`${this.constructor.name} must implement fetchInventory()`);
  }

  /**
   * @param {{ pageSize?: number }} [options]
   * @returns {Promise<Array<{ externalId: string, status?: string, items: Array<{ externalProductId: string, quantity: number }> }>>}
   */
  async fetchOrders(options) {
    throw new Error(`${this.constructor.name} must implement fetchOrders()`);
  }
}

module.exports = IntegrationAdapter;
