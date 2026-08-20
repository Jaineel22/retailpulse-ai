const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');

describe('Auth', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new user, hashes the password, and never returns it', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'StrongPass123',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toEqual(expect.any(String));
      expect(res.body.data.user.email).toBe('jane@example.com');
      expect(res.body.data.user.role).toBe('analyst');
      expect(res.body.data.user.password).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('StrongPass123');

      const { User } = require('../src/models/User');
      const stored = await User.findOne({ email: 'jane@example.com' }).select('+password');
      expect(stored.password).not.toBe('StrongPass123');
    });

    it('rejects duplicate registration with 409', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Jane Doe',
        email: 'dup@example.com',
        password: 'StrongPass123',
      });

      const res = await request(app).post('/api/auth/register').send({
        name: 'Jane Doe Again',
        email: 'dup@example.com',
        password: 'AnotherPass123',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects registration with invalid payload (400)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: '',
        email: 'not-an-email',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    it('ignores a client-supplied role and always defaults to analyst', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Would-be Admin',
        email: 'wouldbeadmin@example.com',
        password: 'StrongPass123',
        role: 'admin',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('analyst');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials', async () => {
      await createUser({ email: 'login@example.com', password: 'CorrectPass123', role: 'operator' });

      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'CorrectPass123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toEqual(expect.any(String));
      expect(res.body.data.user.email).toBe('login@example.com');
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('rejects an incorrect password with 401', async () => {
      await createUser({ email: 'wrongpass@example.com', password: 'CorrectPass123' });

      const res = await request(app).post('/api/auth/login').send({
        email: 'wrongpass@example.com',
        password: 'WrongPassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects login for a non-existent account with 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'ghost@example.com',
        password: 'WhateverPass123',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('rejects requests without a token (401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects requests with an invalid token (401)', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('returns the authenticated user without the password', async () => {
      const { token, user } = await createUser({ email: 'me@example.com', role: 'admin' });

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('me@example.com');
      expect(res.body.data.user.id).toBe(user._id.toString());
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.user.password).toBeUndefined();
    });
  });
});
