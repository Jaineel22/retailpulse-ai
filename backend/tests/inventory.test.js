const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor, createProduct } = require('./helpers/fixtures');

describe('Inventory', () => {
  let adminToken;
  let analystToken;
  let product;

  beforeEach(async () => {
    const admin = await createUser({ role: 'admin' });
    adminToken = admin.token;
    const analyst = await createUser({ role: 'analyst' });
    analystToken = analyst.token;
    const vendor = await createVendor();
    product = await createProduct(vendor._id);
  });

  it('creates an inventory record for a product', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product: product._id.toString(), quantity: 50, reorderThreshold: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data.inventory.quantity).toBe(50);
    expect(res.body.data.inventory.status).toBe('in_stock');
  });

  it('rejects a negative quantity (400)', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product: product._id.toString(), quantity: -10 });

    expect(res.status).toBe(400);
  });

  it('rejects inventory for a non-existent product (400)', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product: '64b64b64b64b64b64b64b64b', quantity: 10 });

    expect(res.status).toBe(400);
  });

  it('rejects a second inventory record for the same product (409)', async () => {
    await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product: product._id.toString(), quantity: 10 });

    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product: product._id.toString(), quantity: 20 });

    expect(res.status).toBe(409);
  });

  it('forbids analysts from creating inventory but allows reading', async () => {
    const forbidden = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ product: product._id.toString(), quantity: 10 });
    expect(forbidden.status).toBe(403);

    const readRes = await request(app).get('/api/inventory').set('Authorization', `Bearer ${analystToken}`);
    expect(readRes.status).toBe(200);
  });

  it('updates quantity and reflects low_stock status', async () => {
    const created = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ product: product._id.toString(), quantity: 100, reorderThreshold: 20 });

    const res = await request(app)
      .put(`/api/inventory/${created.body.data.inventory._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.inventory.quantity).toBe(5);
    expect(res.body.data.inventory.status).toBe('low_stock');
  });
});
