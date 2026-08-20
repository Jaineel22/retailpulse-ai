const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor, createProduct } = require('./helpers/fixtures');

describe('Product CRUD', () => {
  let adminToken;
  let analystToken;
  let vendor;

  beforeEach(async () => {
    const admin = await createUser({ role: 'admin' });
    adminToken = admin.token;
    const analyst = await createUser({ role: 'analyst' });
    analystToken = analyst.token;
    vendor = await createVendor();
  });

  it('creates a product for a valid vendor', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Widget', sku: 'WID-001', price: 19.99, vendor: vendor._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.data.product.sku).toBe('WID-001');
    expect(res.body.data.product.vendor._id).toBe(vendor._id.toString());
  });

  it('rejects product creation for a non-existent vendor (400)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Widget', sku: 'WID-002', price: 19.99, vendor: '64b64b64b64b64b64b64b64b' });

    expect(res.status).toBe(400);
  });

  it('rejects a negative price (400)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Widget', sku: 'WID-003', price: -5, vendor: vendor._id.toString() });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate SKUs (409)', async () => {
    await createProduct(vendor._id, { sku: 'DUPSKU' });

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Widget', sku: 'DUPSKU', price: 9.99, vendor: vendor._id.toString() });

    expect(res.status).toBe(409);
  });

  it('forbids analysts from creating products (403)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ name: 'Widget', sku: 'WID-004', price: 9.99, vendor: vendor._id.toString() });

    expect(res.status).toBe(403);
  });

  it('allows analysts to read products', async () => {
    await createProduct(vendor._id);

    const res = await request(app).get('/api/products').set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.products.length).toBe(1);
  });

  it('updates a product', async () => {
    const product = await createProduct(vendor._id);

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 42.5 });

    expect(res.status).toBe(200);
    expect(res.body.data.product.price).toBe(42.5);
  });

  it('deletes a product (admin only)', async () => {
    const product = await createProduct(vendor._id);

    const forbidden = await request(app)
      .delete(`/api/products/${product._id}`)
      .set('Authorization', `Bearer ${analystToken}`);
    expect(forbidden.status).toBe(403);

    const res = await request(app)
      .delete(`/api/products/${product._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
