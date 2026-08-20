const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor, createProduct } = require('./helpers/fixtures');

describe('Order', () => {
  let adminToken;
  let analystToken;
  let vendor;
  let otherVendor;
  let product;

  beforeEach(async () => {
    const admin = await createUser({ role: 'admin' });
    adminToken = admin.token;
    const analyst = await createUser({ role: 'analyst' });
    analystToken = analyst.token;
    vendor = await createVendor();
    otherVendor = await createVendor();
    product = await createProduct(vendor._id, { price: 20 });
  });

  it('creates an order and computes totals from the stored product price, ignoring any client-supplied price', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendor: vendor._id.toString(),
        items: [{ product: product._id.toString(), quantity: 3, unitPrice: 0.01 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.order.items[0].unitPrice).toBe(20);
    expect(res.body.data.order.items[0].subtotal).toBe(60);
    expect(res.body.data.order.totalAmount).toBe(60);
    expect(res.body.data.order.status).toBe('pending');
    expect(res.body.data.order.orderNumber).toEqual(expect.any(String));
  });

  it('rejects an order where the product does not belong to the specified vendor (400)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendor: otherVendor._id.toString(),
        items: [{ product: product._id.toString(), quantity: 1 }],
      });

    expect(res.status).toBe(400);
  });

  it('rejects an order with an invalid quantity (400)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendor: vendor._id.toString(),
        items: [{ product: product._id.toString(), quantity: 0 }],
      });

    expect(res.status).toBe(400);
  });

  it('rejects an order with no items (400)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vendor: vendor._id.toString(), items: [] });

    expect(res.status).toBe(400);
  });

  it('forbids analysts from creating orders but allows reading', async () => {
    const forbidden = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ vendor: vendor._id.toString(), items: [{ product: product._id.toString(), quantity: 1 }] });
    expect(forbidden.status).toBe(403);

    const readRes = await request(app).get('/api/orders').set('Authorization', `Bearer ${analystToken}`);
    expect(readRes.status).toBe(200);
  });

  it('updates an order status through a valid transition value', async () => {
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vendor: vendor._id.toString(), items: [{ product: product._id.toString(), quantity: 2 }] });

    const res = await request(app)
      .put(`/api/orders/${created.body.data.order._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe('confirmed');
  });

  it('rejects an invalid order status value (400)', async () => {
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vendor: vendor._id.toString(), items: [{ product: product._id.toString(), quantity: 1 }] });

    const res = await request(app)
      .put(`/api/orders/${created.body.data.order._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'not-a-real-status' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent order', async () => {
    const res = await request(app)
      .get('/api/orders/64b64b64b64b64b64b64b64b')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
