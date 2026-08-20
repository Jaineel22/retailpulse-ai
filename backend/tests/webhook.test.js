const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const { createUser } = require('./helpers/testUtils');
const { createVendor, createIntegration } = require('./helpers/fixtures');
const Product = require('../src/models/Product');
const Inventory = require('../src/models/Inventory');
const { Order } = require('../src/models/Order');
const { WebhookEvent } = require('../src/models/WebhookEvent');

const SECRET = env.mockCommerceWebhookSecret;

function sendWebhook(body, { secret = SECRET, omitSecret = false } = {}) {
  const req = request(app).post('/api/webhooks/mock-commerce');
  if (!omitSecret) req.set('X-Webhook-Secret', secret);
  return req.send(body);
}

describe('Webhooks (mock-commerce)', () => {
  let admin;
  let vendor;
  let product;

  beforeEach(async () => {
    admin = await createUser({ role: 'admin' });
    vendor = await createVendor();
    await createIntegration(vendor._id, admin.user._id);

    product = await Product.create({
      name: 'External Wireless Mouse',
      sku: 'EXT-MOUSE-001',
      price: 25.99,
      vendor: vendor._id,
      externalSource: 'mock-commerce',
      externalId: 'mock-prod-001',
    });
  });

  describe('Authentication', () => {
    it('rejects a request with a missing webhook secret (401)', async () => {
      const res = await sendWebhook(
        { eventId: 'evt-nosecret', provider: 'mock-commerce', type: 'product.updated', data: { externalId: 'mock-prod-001' } },
        { omitSecret: true }
      );
      expect(res.status).toBe(401);
    });

    it('rejects a request with an invalid webhook secret (401)', async () => {
      const res = await sendWebhook(
        { eventId: 'evt-badsecret', provider: 'mock-commerce', type: 'product.updated', data: { externalId: 'mock-prod-001' } },
        { secret: 'wrong-secret' }
      );
      expect(res.status).toBe(401);

      const stored = await WebhookEvent.findOne({ eventId: 'evt-badsecret' });
      expect(stored).toBeNull();
    });
  });

  describe('Validation', () => {
    it('rejects a payload missing eventId (400)', async () => {
      const res = await sendWebhook({ provider: 'mock-commerce', type: 'product.updated', data: { externalId: 'mock-prod-001' } });
      expect(res.status).toBe(400);
    });

    it('rejects an unsupported event type (400)', async () => {
      const res = await sendWebhook({ eventId: 'evt-unsupported', provider: 'mock-commerce', type: 'product.deleted', data: {} });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed payload (400)', async () => {
      const res = await sendWebhook({
        eventId: 'evt-malformed',
        provider: 'mock-commerce',
        type: 'inventory.updated',
        data: { externalId: 'mock-prod-001', quantity: 'not-a-number' },
      });
      expect(res.status).toBe(400);
    });

    it('rejects order.created with an empty items array (400)', async () => {
      const res = await sendWebhook({
        eventId: 'evt-empty-items',
        provider: 'mock-commerce',
        type: 'order.created',
        data: { externalId: 'mock-order-999', items: [] },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Event processing', () => {
    it('processes product.updated and updates the product', async () => {
      const res = await sendWebhook({
        eventId: 'evt-product-1',
        provider: 'mock-commerce',
        type: 'product.updated',
        data: { externalId: 'mock-prod-001', price: 30.5, name: 'External Wireless Mouse v2' },
      });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('processed');

      const updated = await Product.findById(product._id);
      expect(updated.price).toBe(30.5);
      expect(updated.name).toBe('External Wireless Mouse v2');
    });

    it('processes inventory.updated and creates an inventory record', async () => {
      const res = await sendWebhook({
        eventId: 'evt-inventory-1',
        provider: 'mock-commerce',
        type: 'inventory.updated',
        data: { externalId: 'mock-prod-001', quantity: 42, reorderThreshold: 5 },
      });

      expect(res.status).toBe(201);
      const inventory = await Inventory.findOne({ product: product._id });
      expect(inventory.quantity).toBe(42);
    });

    it('processes order.created and computes totals from the internal product price', async () => {
      const res = await sendWebhook({
        eventId: 'evt-order-1',
        provider: 'mock-commerce',
        type: 'order.created',
        data: { externalId: 'mock-order-101', items: [{ externalProductId: 'mock-prod-001', quantity: 3 }] },
      });

      expect(res.status).toBe(201);
      const order = await Order.findOne({ externalSource: 'mock-commerce', externalId: 'mock-order-101' });
      expect(order).not.toBeNull();
      expect(order.items[0].unitPrice).toBe(25.99);
      expect(order.totalAmount).toBe(77.97);
      expect(order.createdBy.toString()).toBe(admin.user._id.toString());
    });

    it('processes order.updated and changes the order status', async () => {
      await sendWebhook({
        eventId: 'evt-order-2',
        provider: 'mock-commerce',
        type: 'order.created',
        data: { externalId: 'mock-order-102', items: [{ externalProductId: 'mock-prod-001', quantity: 1 }] },
      });

      const res = await sendWebhook({
        eventId: 'evt-order-3',
        provider: 'mock-commerce',
        type: 'order.updated',
        data: { externalId: 'mock-order-102', status: 'shipped' },
      });

      expect(res.status).toBe(201);
      const order = await Order.findOne({ externalSource: 'mock-commerce', externalId: 'mock-order-102' });
      expect(order.status).toBe('shipped');
    });

    it('records a failed event with a controlled error when the external entity cannot be resolved', async () => {
      const res = await sendWebhook({
        eventId: 'evt-unresolvable',
        provider: 'mock-commerce',
        type: 'product.updated',
        data: { externalId: 'mock-prod-does-not-exist', price: 1 },
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data.error).toEqual(expect.any(String));

      const stored = await WebhookEvent.findOne({ eventId: 'evt-unresolvable' });
      expect(stored.status).toBe('failed');
    });
  });

  describe('Idempotency (critical)', () => {
    it('processes the same eventId only once, even when submitted twice', async () => {
      const saveSpy = jest.spyOn(Product.prototype, 'save');

      const payload = {
        eventId: 'evt-duplicate-1',
        provider: 'mock-commerce',
        type: 'product.updated',
        data: { externalId: 'mock-prod-001', price: 55.0 },
      };

      const first = await sendWebhook(payload);
      expect(first.status).toBe(201);
      expect(first.body.data.duplicate).toBe(false);

      const second = await sendWebhook(payload);
      expect(second.status).toBe(200);
      expect(second.body.data.duplicate).toBe(true);

      // The core guarantee: the underlying domain mutation only ran once, even
      // though the HTTP endpoint was called twice with the same eventId.
      expect(saveSpy).toHaveBeenCalledTimes(1);

      const eventCount = await WebhookEvent.countDocuments({ provider: 'mock-commerce', eventId: 'evt-duplicate-1' });
      expect(eventCount).toBe(1);

      saveSpy.mockRestore();
    });

    it('enforces eventId uniqueness at the database level (unique index)', async () => {
      await WebhookEvent.create({
        provider: 'mock-commerce',
        eventId: 'evt-direct-insert',
        type: 'product.updated',
        payload: { externalId: 'mock-prod-001' },
        status: 'processed',
      });

      await expect(
        WebhookEvent.create({
          provider: 'mock-commerce',
          eventId: 'evt-direct-insert',
          type: 'product.updated',
          payload: { externalId: 'mock-prod-001' },
          status: 'processed',
        })
      ).rejects.toThrow();
    });
  });
});
