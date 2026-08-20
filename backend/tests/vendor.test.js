const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor } = require('./helpers/fixtures');

describe('Vendor CRUD', () => {
  let adminToken;

  beforeEach(async () => {
    const { token } = await createUser({ role: 'admin' });
    adminToken = token;
  });

  it('creates a vendor with valid data', async () => {
    const res = await request(app)
      .post('/api/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Acme Supply', contactEmail: 'hello@acme.com', status: 'active' });

    expect(res.status).toBe(201);
    expect(res.body.data.vendor.name).toBe('Acme Supply');
    expect(res.body.data.vendor.status).toBe('active');
  });

  it('rejects vendor creation with missing name (400)', async () => {
    const res = await request(app)
      .post('/api/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contactEmail: 'hello@acme.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects duplicate vendor names (409)', async () => {
    await createVendor({ name: 'Duplicate Vendor' });

    const res = await request(app)
      .post('/api/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate Vendor' });

    expect(res.status).toBe(409);
  });

  it('reads a vendor by id', async () => {
    const vendor = await createVendor();

    const res = await request(app).get(`/api/vendors/${vendor._id}`).set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.vendor._id).toBe(vendor._id.toString());
  });

  it('returns 404 for a non-existent vendor', async () => {
    const res = await request(app)
      .get('/api/vendors/64b64b64b64b64b64b64b64b')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('updates a vendor', async () => {
    const vendor = await createVendor();

    const res = await request(app)
      .put(`/api/vendors/${vendor._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.vendor.status).toBe('inactive');
  });

  it('deletes a vendor', async () => {
    const vendor = await createVendor();

    const res = await request(app)
      .delete(`/api/vendors/${vendor._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const check = await request(app)
      .get(`/api/vendors/${vendor._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(check.status).toBe(404);
  });
});
