const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor, createProduct } = require('./helpers/fixtures');
const { Prediction } = require('../src/models/Prediction');

function mockFetchOnce({ ok, body, throwError }) {
  global.fetch = jest.fn().mockImplementation(() => {
    if (throwError) return Promise.reject(new Error('connect ECONNREFUSED'));
    return Promise.resolve({ ok, json: async () => body });
  });
}

function validForecastResponse(productId, overrides = {}) {
  return {
    productId,
    horizonDays: 7,
    modelName: 'RandomForestRegressor',
    historyDays: 60,
    forecast: [{ date: '2026-01-01', value: 10 }],
    baselineForecast: [{ date: '2026-01-01', value: 9 }],
    metrics: { model: { mae: 1.2, rmse: 1.5 }, baseline: { mae: 2.0, rmse: 2.5 } },
    modelBeatsBaseline: true,
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Predictions', () => {
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

  it('forbids analyst from triggering a prediction but allows operator', async () => {
    mockFetchOnce({ ok: true, body: validForecastResponse(product._id.toString()) });

    const forbidden = await request(app)
      .post('/api/predictions/run')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ productId: product._id.toString() });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .post('/api/predictions/run')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ productId: product._id.toString() });
    expect(allowed.status).toBe(201);
  });

  it('persists a successful prediction with the ML service response', async () => {
    mockFetchOnce({ ok: true, body: validForecastResponse(product._id.toString(), { horizonDays: 14 }) });

    const res = await request(app)
      .post('/api/predictions/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString(), horizonDays: 14 });

    expect(res.status).toBe(201);
    expect(res.body.data.prediction.horizonDays).toBe(14);
    expect(res.body.data.prediction.modelBeatsBaseline).toBe(true);
    expect(res.body.data.prediction.mae).toBe(1.2);

    const stored = await Prediction.findById(res.body.data.prediction._id);
    expect(stored).not.toBeNull();
    expect(stored.product.toString()).toBe(product._id.toString());
  });

  it('returns 404 and never calls the ML service for a non-existent product', async () => {
    global.fetch = jest.fn();

    const res = await request(app)
      .post('/api/predictions/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: '64b64b64b64b64b64b64b64b' });

    expect(res.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 502 and does not persist anything when the ML service is unreachable', async () => {
    mockFetchOnce({ throwError: true });

    const res = await request(app)
      .post('/api/predictions/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    const count = await Prediction.countDocuments({});
    expect(count).toBe(0);
  });

  it('returns 400 with a clear message when the ML service reports insufficient history', async () => {
    mockFetchOnce({
      ok: false,
      body: {
        detail: { code: 'INSUFFICIENT_HISTORY', message: 'not enough data', minimumDaysRequired: 21, daysAvailable: 3 },
      },
    });

    const res = await request(app)
      .post('/api/predictions/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient historical data/i);
  });

  it('rejects and does not persist a malformed ML response', async () => {
    mockFetchOnce({ ok: true, body: { productId: product._id.toString() /* missing everything else */ } });

    const res = await request(app)
      .post('/api/predictions/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });

    expect(res.status).toBe(502);
    const count = await Prediction.countDocuments({});
    expect(count).toBe(0);
  });

  it('lists persisted predictions for a product, readable by any authenticated role', async () => {
    mockFetchOnce({ ok: true, body: validForecastResponse(product._id.toString()) });
    await request(app)
      .post('/api/predictions/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: product._id.toString() });

    const res = await request(app)
      .get(`/api/predictions/${product._id.toString()}`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.predictions.length).toBe(1);
  });
});
