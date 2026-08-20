const IntegrationAdapter = require('../src/integrations/adapters/IntegrationAdapter');
const MockCommerceAdapter = require('../src/integrations/adapters/MockCommerceAdapter');
const { resolveAdapter } = require('../src/integrations/adapters/adapterFactory');

describe('IntegrationAdapter contract', () => {
  it('requires subclasses to implement fetchProducts/fetchInventory/fetchOrders', async () => {
    const adapter = new IntegrationAdapter();

    await expect(adapter.fetchProducts()).rejects.toThrow('fetchProducts');
    await expect(adapter.fetchInventory()).rejects.toThrow('fetchInventory');
    await expect(adapter.fetchOrders()).rejects.toThrow('fetchOrders');
  });
});

describe('MockCommerceAdapter', () => {
  it('walks every page of the mock provider and returns a flat array', async () => {
    const adapter = new MockCommerceAdapter();

    const products = await adapter.fetchProducts({ pageSize: 2 });
    expect(products.length).toBe(5);
    expect(new Set(products.map((p) => p.externalId)).size).toBe(5);

    const orders = await adapter.fetchOrders({ pageSize: 2 });
    expect(orders.length).toBe(3);
  });

  it('returns the same deterministic data across separate calls', async () => {
    const adapter = new MockCommerceAdapter();

    const first = await adapter.fetchInventory({ pageSize: 2 });
    const second = await adapter.fetchInventory({ pageSize: 2 });

    expect(first).toEqual(second);
  });

  it('simulates an upstream outage when configured to fail', async () => {
    const adapter = new MockCommerceAdapter({ simulateFailure: true });

    await expect(adapter.fetchProducts({ pageSize: 2 })).rejects.toThrow('simulated outage');
  });
});

describe('adapterFactory', () => {
  it('resolves the mock-commerce provider to a MockCommerceAdapter instance', () => {
    const adapter = resolveAdapter('mock-commerce', { pageSize: 2 });
    expect(adapter).toBeInstanceOf(MockCommerceAdapter);
  });

  it('throws for an unregistered provider', () => {
    expect(() => resolveAdapter('nonexistent-provider')).toThrow('No integration adapter registered');
  });

  it('resolves the shopify-stub provider, demonstrating a second pluggable adapter', async () => {
    const adapter = resolveAdapter('shopify-stub');
    await expect(adapter.fetchProducts()).rejects.toThrow('not yet implemented');
  });
});
