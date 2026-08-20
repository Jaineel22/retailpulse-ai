const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor } = require('./helpers/fixtures');
const Product = require('../src/models/Product');
const Inventory = require('../src/models/Inventory');
const { Order } = require('../src/models/Order');

describe('Integrations & Sync', () => {
  let adminToken;
  let operatorToken;
  let analystToken;
  let vendor;

  beforeEach(async () => {
    const admin = await createUser({ role: 'admin' });
    adminToken = admin.token;
    const operator = await createUser({ role: 'operator' });
    operatorToken = operator.token;
    const analyst = await createUser({ role: 'analyst' });
    analystToken = analyst.token;
    vendor = await createVendor();
  });

  describe('Integration CRUD/read', () => {
    it('allows admin to create an integration', async () => {
      const res = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Mock Commerce',
          provider: 'mock-commerce',
          config: { defaultVendor: vendor._id.toString(), pageSize: 2 },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.integration.provider).toBe('mock-commerce');
      expect(res.body.data.integration.isActive).toBe(true);
    });

    it('forbids operator and analyst from creating an integration', async () => {
      const payload = {
        name: 'Should Fail',
        provider: 'mock-commerce',
        config: { defaultVendor: vendor._id.toString() },
      };

      const operatorRes = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(payload);
      expect(operatorRes.status).toBe(403);

      const analystRes = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${analystToken}`)
        .send(payload);
      expect(analystRes.status).toBe(403);
    });

    it('rejects an integration referencing a non-existent vendor (400)', async () => {
      const res = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bad Vendor',
          provider: 'mock-commerce',
          config: { defaultVendor: '64b64b64b64b64b64b64b64b' },
        });
      expect(res.status).toBe(400);
    });

    it('allows any authenticated role to list and read integrations', async () => {
      const created = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Readable', provider: 'mock-commerce', config: { defaultVendor: vendor._id.toString() } });

      const list = await request(app).get('/api/integrations').set('Authorization', `Bearer ${analystToken}`);
      expect(list.status).toBe(200);
      expect(list.body.data.integrations.length).toBe(1);

      const getOne = await request(app)
        .get(`/api/integrations/${created.body.data.integration._id}`)
        .set('Authorization', `Bearer ${analystToken}`);
      expect(getOne.status).toBe(200);
    });
  });

  describe('Sync', () => {
    async function createIntegrationViaApi(overrides = {}) {
      const res = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: overrides.name || 'Sync Test Integration',
          provider: 'mock-commerce',
          config: { defaultVendor: vendor._id.toString(), pageSize: 2, simulateFailure: !!overrides.simulateFailure },
        });
      return res.body.data.integration;
    }

    it('forbids analyst from triggering a sync but allows operator and admin', async () => {
      const integration = await createIntegrationViaApi();

      const analystRes = await request(app)
        .post(`/api/integrations/${integration._id}/sync`)
        .set('Authorization', `Bearer ${analystToken}`);
      expect(analystRes.status).toBe(403);

      const operatorRes = await request(app)
        .post(`/api/integrations/${integration._id}/sync`)
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(operatorRes.status).toBe(200);
    });

    it('performs a successful sync that creates products, inventory, and orders, and records a success SyncLog', async () => {
      const integration = await createIntegrationViaApi();

      const res = await request(app)
        .post(`/api/integrations/${integration._id}/sync`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.syncLog.status).toBe('success');
      expect(res.body.data.syncLog.counts.productsCreated).toBe(5);
      expect(res.body.data.syncLog.counts.inventoryCreated).toBe(5);
      expect(res.body.data.syncLog.counts.ordersCreated).toBe(3);

      const products = await Product.find({ externalSource: 'mock-commerce' });
      expect(products.length).toBe(5);
      expect(products.every((p) => p.vendor.toString() === vendor._id.toString())).toBe(true);

      const inventoryCount = await Inventory.countDocuments({});
      expect(inventoryCount).toBe(5);

      const orders = await Order.find({ externalSource: 'mock-commerce' });
      expect(orders.length).toBe(3);
      expect(orders.every((o) => o.createdBy.toString())).toBe(true);

      const syncLogsRes = await request(app)
        .get(`/api/integrations/${integration._id}/sync-logs`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(syncLogsRes.status).toBe(200);
      expect(syncLogsRes.body.data.syncLogs.length).toBe(1);
    });

    it('does not create duplicate products/inventory/orders when synced twice (external ID upsert)', async () => {
      const integration = await createIntegrationViaApi();

      await request(app).post(`/api/integrations/${integration._id}/sync`).set('Authorization', `Bearer ${adminToken}`);
      const second = await request(app)
        .post(`/api/integrations/${integration._id}/sync`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(second.status).toBe(200);
      expect(second.body.data.syncLog.counts.productsCreated).toBe(0);
      expect(second.body.data.syncLog.counts.productsUpdated).toBe(5);
      expect(second.body.data.syncLog.counts.ordersCreated).toBe(0);
      expect(second.body.data.syncLog.counts.ordersUpdated).toBe(3);

      const productCount = await Product.countDocuments({ externalSource: 'mock-commerce' });
      expect(productCount).toBe(5);
      const orderCount = await Order.countDocuments({ externalSource: 'mock-commerce' });
      expect(orderCount).toBe(3);
    });

    it('marks the SyncLog failed and returns a safe error response when the adapter fails', async () => {
      const integration = await createIntegrationViaApi({ simulateFailure: true });

      const res = await request(app)
        .post(`/api/integrations/${integration._id}/sync`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.data.syncLog.status).toBe('failed');
      expect(res.body.data.syncLog.error).toEqual(expect.any(String));
      expect(res.body.data.syncLog.error).not.toMatch(/at .*\(.*:\d+:\d+\)/); // no stack trace leaked

      const products = await Product.countDocuments({ externalSource: 'mock-commerce' });
      expect(products).toBe(0);
    });

    it('rejects triggering a sync for an inactive integration (400)', async () => {
      const created = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Inactive Integration',
          provider: 'mock-commerce',
          isActive: false,
          config: { defaultVendor: vendor._id.toString() },
        });

      const res = await request(app)
        .post(`/api/integrations/${created.body.data.integration._id}/sync`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });
});
