const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor, createProduct } = require('./helpers/fixtures');
const { Anomaly } = require('../src/models/Anomaly');

function mockFetchOnce({ ok, body, throwError }) {
  global.fetch = jest.fn().mockImplementation(() => {
    if (throwError) return Promise.reject(new Error('connect ECONNREFUSED'));
    return Promise.resolve({ ok, json: async () => body });
  });
}

function validAnomalyResponse(productId, anomalies) {
  return {
    productId,
    historyDays: 60,
    generatedAt: new Date().toISOString(),
    anomalies: anomalies || [
      { timestamp: '2026-01-01', score: -0.72, reason: 'Sales volume is significantly above the recent 7-day average.', severity: 'high' },
    ],
  };
}

describe('Anomalies', () => {
  let adminToken;
  let operatorToken;
  let analystToken;
  let vendor;
  let product;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    adminToken = (await createUser({ role: 'admin' })).token;
    operatorToken = (await createUser({ role: 'operator' })).token;
    analystToken = (await createUser({ role: 'analyst' })).token;
    vendor = await createVendor();
    product = await createProduct(vendor._id);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('forbids analyst from triggering anomaly detection but allows operator', async () => {
    mockFetchOnce({ ok: true, body: validAnomalyResponse(product._id.toString()) });

    const forbidden = await request(app)
      .post('/api/anomalies/run')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ productId: product._id.toString() });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .post('/api/anomalies/run')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ productId: product._id.toString() });
    expect(allowed.status).toBe(201);
  });

  it('persists detected anomalies and exposes them via GET /api/anomalies', async () => {
    mockFetchOnce({ ok: true, body: validAnomalyResponse(product._id.toString()) });

    const runRes = await request(app)
      .post('/api/anomalies/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });
    expect(runRes.status).toBe(201);
    expect(runRes.body.data.anomalies.length).toBe(1);

    const listRes = await request(app).get('/api/anomalies').set('Authorization', `Bearer ${analystToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.anomalies.length).toBe(1);
    expect(listRes.body.data.anomalies[0].severity).toBe('high');
  });

  it('does not duplicate anomalies when re-run for the same product/day (upsert)', async () => {
    mockFetchOnce({ ok: true, body: validAnomalyResponse(product._id.toString()) });

    await request(app)
      .post('/api/anomalies/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });

    mockFetchOnce({
      ok: true,
      body: validAnomalyResponse(product._id.toString(), [
        { timestamp: '2026-01-01', score: -0.91, reason: 'Sales volume is significantly above the recent 7-day average.', severity: 'high' },
      ]),
    });
    await request(app)
      .post('/api/anomalies/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });

    const count = await Anomaly.countDocuments({ product: product._id });
    expect(count).toBe(1); // updated in place, not duplicated
    const stored = await Anomaly.findOne({ product: product._id });
    expect(stored.score).toBe(-0.91); // reflects the latest run's value
  });

  it('returns 502 and persists nothing when the ML service is unreachable', async () => {
    mockFetchOnce({ throwError: true });

    const res = await request(app)
      .post('/api/anomalies/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });

    expect(res.status).toBe(502);
    const count = await Anomaly.countDocuments({});
    expect(count).toBe(0);
  });

  it('rejects a malformed ML response without persisting', async () => {
    mockFetchOnce({ ok: true, body: { productId: product._id.toString(), anomalies: [{ severity: 'not-a-real-severity' }] } });

    const res = await request(app)
      .post('/api/anomalies/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });

    expect(res.status).toBe(502);
    const count = await Anomaly.countDocuments({});
    expect(count).toBe(0);
  });

  it('returns 404 and never calls the ML service for a non-existent product', async () => {
    global.fetch = jest.fn();

    const res = await request(app)
      .post('/api/anomalies/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: '64b64b64b64b64b64b64b64b' });

    expect(res.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('filters the anomaly list by severity', async () => {
    mockFetchOnce({
      ok: true,
      body: validAnomalyResponse(product._id.toString(), [
        { timestamp: '2026-01-01', score: -0.9, reason: 'Sales volume is significantly above the recent 7-day average.', severity: 'high' },
        { timestamp: '2026-01-02', score: -0.3, reason: 'Unusual combination of sales and inventory activity detected.', severity: 'low' },
      ]),
    });
    await request(app)
      .post('/api/anomalies/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });

    const res = await request(app).get('/api/anomalies?severity=high').set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.anomalies.length).toBe(1);
    expect(res.body.data.anomalies[0].severity).toBe('high');
  });
});
