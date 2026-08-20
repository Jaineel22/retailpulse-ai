const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor } = require('./helpers/fixtures');

describe('RBAC', () => {
  it('rejects unauthenticated access to a protected route (401)', async () => {
    const res = await request(app).get('/api/vendors');
    expect(res.status).toBe(401);
  });

  it('allows operator to create a vendor, forbids analyst', async () => {
    const { token: operatorToken } = await createUser({ role: 'operator' });
    const { token: analystToken } = await createUser({ role: 'analyst' });

    const operatorRes = await request(app)
      .post('/api/vendors')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ name: 'Operator Vendor' });
    expect(operatorRes.status).toBe(201);

    const analystRes = await request(app)
      .post('/api/vendors')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ name: 'Analyst Vendor' });
    expect(analystRes.status).toBe(403);
    expect(analystRes.body.success).toBe(false);
  });

  it('allows all authenticated roles to read vendors', async () => {
    await createVendor();
    const { token: analystToken } = await createUser({ role: 'analyst' });

    const res = await request(app).get('/api/vendors').set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(200);
  });

  it('forbids operator from deleting a vendor, allows admin', async () => {
    const vendor = await createVendor();
    const { token: operatorToken } = await createUser({ role: 'operator' });
    const { token: adminToken } = await createUser({ role: 'admin' });

    const operatorDelete = await request(app)
      .delete(`/api/vendors/${vendor._id}`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(operatorDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/api/vendors/${vendor._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDelete.status).toBe(200);
  });

  it('restricts user listing to admins only', async () => {
    const { token: analystToken } = await createUser({ role: 'analyst' });
    const { token: adminToken } = await createUser({ role: 'admin' });

    const forbidden = await request(app).get('/api/users').set('Authorization', `Bearer ${analystToken}`);
    expect(forbidden.status).toBe(403);

    const allowed = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body.data.users)).toBe(true);
  });

  it('prevents a user from reading another user\'s record, but allows self and admin', async () => {
    const { token: userAToken } = await createUser({ role: 'analyst' });
    const { user: userB } = await createUser({ role: 'analyst' });
    const { token: adminToken } = await createUser({ role: 'admin' });

    const crossAccess = await request(app)
      .get(`/api/users/${userB._id}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(crossAccess.status).toBe(403);

    const selfAccess = await request(app)
      .get(`/api/users/${userB._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(selfAccess.status).toBe(200);
  });
});
