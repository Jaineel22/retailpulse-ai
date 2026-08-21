const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor, createProduct } = require('./helpers/fixtures');
const Inventory = require('../src/models/Inventory');
const { Prediction } = require('../src/models/Prediction');
const { Order } = require('../src/models/Order');

async function createPrediction(product, avgDemand, overrides = {}) {
  return Prediction.create({
    product: product._id,
    horizonDays: 7,
    modelName: 'RandomForestRegressor',
    predictedDemand: Array.from({ length: 7 }, (_, i) => ({ date: `2026-01-0${i + 1}`, value: avgDemand })),
    baselineForecast: Array.from({ length: 7 }, (_, i) => ({ date: `2026-01-0${i + 1}`, value: avgDemand })),
    mae: 1,
    rmse: 1.2,
    baselineMae: 2,
    baselineRmse: 2.2,
    modelBeatsBaseline: true,
    generatedAt: new Date(),
    triggeredBy: overrides.triggeredBy,
  });
}

async function createOrder({ vendor, product, unitPrice, quantity, status, createdBy }) {
  const subtotal = Number((unitPrice * quantity).toFixed(2));
  return Order.create({
    vendor: vendor._id,
    items: [{ product: product._id, quantity, unitPrice, subtotal }],
    totalAmount: subtotal,
    status,
    createdBy: createdBy._id,
  });
}

describe('Recommendations', () => {
  let token;
  let user;

  beforeEach(async () => {
    const created = await createUser({ role: 'analyst' });
    token = created.token;
    user = created.user;
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/recommendations');
    expect(res.status).toBe(401);
  });

  it('returns empty arrays with a 200 when there is no data at all', async () => {
    const res = await request(app).get('/api/recommendations').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.stockoutRisks).toEqual([]);
    expect(res.body.data.reorderRecommendations).toEqual([]);
    expect(res.body.data.vendorRecommendations).toEqual([]);
  });

  describe('Stockout risk', () => {
    it('flags HIGH risk when forecasted demand outpaces low stock', async () => {
      const vendor = await createVendor();
      const product = await createProduct(vendor._id, { name: 'Fast Mover' });
      await Inventory.create({ product: product._id, quantity: 5, reservedQuantity: 0, reorderThreshold: 10 });
      await createPrediction(product, 10, { triggeredBy: user._id });

      const res = await request(app).get('/api/recommendations/stockout').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const risk = res.body.data.stockoutRisks.find((r) => r.productName === 'Fast Mover');
      expect(risk.riskLevel).toBe('HIGH');
      expect(risk.currentStock).toBe(5);
      expect(risk.forecastDailyDemand).toBe(10);
      expect(risk.daysOfCover).toBe(0.5);
      expect(risk.reason).toMatch(/covers approximately 0.5 day/);
    });

    it('reports LOW risk for healthy stock relative to forecasted demand', async () => {
      const vendor = await createVendor();
      const product = await createProduct(vendor._id, { name: 'Slow Mover' });
      await Inventory.create({ product: product._id, quantity: 1000, reservedQuantity: 0, reorderThreshold: 10 });
      await createPrediction(product, 5, { triggeredBy: user._id });

      const res = await request(app).get('/api/recommendations/stockout').set('Authorization', `Bearer ${token}`);

      const risk = res.body.data.stockoutRisks.find((r) => r.productName === 'Slow Mover');
      expect(risk.riskLevel).toBe('LOW');
      expect(risk.daysOfCover).toBe(200);
    });

    it('falls back to a reorder-threshold-only rule when no forecast exists yet', async () => {
      const vendor = await createVendor();
      const product = await createProduct(vendor._id, { name: 'No Forecast Yet' });
      await Inventory.create({ product: product._id, quantity: 5, reservedQuantity: 0, reorderThreshold: 10 });
      // Deliberately no Prediction created.

      const res = await request(app).get('/api/recommendations/stockout').set('Authorization', `Bearer ${token}`);

      const risk = res.body.data.stockoutRisks.find((r) => r.productName === 'No Forecast Yet');
      expect(risk.forecastDailyDemand).toBeNull();
      expect(risk.daysOfCover).toBeNull();
      expect(risk.riskLevel).toBe('MEDIUM'); // stock (5) <= reorderThreshold (10)
      expect(risk.reason).toMatch(/No demand forecast is available yet/);
    });

    it('excludes inventory for inactive products', async () => {
      const vendor = await createVendor();
      const product = await createProduct(vendor._id, { name: 'Discontinued', isActive: false });
      await Inventory.create({ product: product._id, quantity: 0, reservedQuantity: 0, reorderThreshold: 10 });

      const res = await request(app).get('/api/recommendations/stockout').set('Authorization', `Bearer ${token}`);

      expect(res.body.data.stockoutRisks.find((r) => r.productName === 'Discontinued')).toBeUndefined();
    });
  });

  describe('Reorder recommendations', () => {
    it('computes recommendedQuantity from reorder threshold + forecasted safety window', async () => {
      const vendor = await createVendor();
      const product = await createProduct(vendor._id, { name: 'Needs Reorder' });
      await Inventory.create({ product: product._id, quantity: 5, reservedQuantity: 0, reorderThreshold: 10 });
      await createPrediction(product, 10, { triggeredBy: user._id });

      const res = await request(app).get('/api/recommendations/reorder').set('Authorization', `Bearer ${token}`);

      const rec = res.body.data.reorderRecommendations.find((r) => r.productName === 'Needs Reorder');
      // targetStock = ceil(10 + 10*7) = 80; recommendedQuantity = 80 - 5 = 75
      expect(rec.recommendedQuantity).toBe(75);
      expect(rec.riskLevel).toBe('HIGH');
      expect(rec.reason).toMatch(/75 unit/);
    });

    it('recommends 0 units when current stock already meets the target', async () => {
      const vendor = await createVendor();
      const product = await createProduct(vendor._id, { name: 'Well Stocked' });
      await Inventory.create({ product: product._id, quantity: 5000, reservedQuantity: 0, reorderThreshold: 10 });
      await createPrediction(product, 1, { triggeredBy: user._id });

      const res = await request(app).get('/api/recommendations/reorder').set('Authorization', `Bearer ${token}`);

      const rec = res.body.data.reorderRecommendations.find((r) => r.productName === 'Well Stocked');
      expect(rec.recommendedQuantity).toBe(0);
      expect(rec.reason).toMatch(/no reorder is currently needed/);
    });
  });

  describe('Vendor decline detection', () => {
    it('flags HIGH severity for a vendor with a high cancellation rate', async () => {
      const vendor = await createVendor({ name: 'Unreliable Vendor' });
      const product = await createProduct(vendor._id, { price: 10 });
      await createOrder({ vendor, product, unitPrice: 10, quantity: 1, status: 'cancelled', createdBy: user });
      await createOrder({ vendor, product, unitPrice: 10, quantity: 1, status: 'cancelled', createdBy: user });
      await createOrder({ vendor, product, unitPrice: 10, quantity: 1, status: 'cancelled', createdBy: user });
      await createOrder({ vendor, product, unitPrice: 10, quantity: 1, status: 'delivered', createdBy: user });

      const res = await request(app).get('/api/recommendations/vendors').set('Authorization', `Bearer ${token}`);

      const concern = res.body.data.vendorRecommendations.find((v) => v.vendorName === 'Unreliable Vendor');
      expect(concern).toBeDefined();
      expect(concern.recommendationType).toBe('vendor_decline');
      expect(concern.severity).toBe('HIGH');
      expect(concern.reason).toMatch(/3 of 4 orders/);
    });

    it('does not flag a healthy vendor with no cancellations', async () => {
      const vendor = await createVendor({ name: 'Reliable Vendor' });
      const product = await createProduct(vendor._id, { price: 10 });
      await createOrder({ vendor, product, unitPrice: 10, quantity: 1, status: 'delivered', createdBy: user });
      await createOrder({ vendor, product, unitPrice: 10, quantity: 1, status: 'delivered', createdBy: user });
      await createOrder({ vendor, product, unitPrice: 10, quantity: 1, status: 'delivered', createdBy: user });

      const res = await request(app).get('/api/recommendations/vendors').set('Authorization', `Bearer ${token}`);

      expect(res.body.data.vendorRecommendations.find((v) => v.vendorName === 'Reliable Vendor')).toBeUndefined();
    });

    it('does not flag a low order count on cancellation-rate alone (insufficient signal)', async () => {
      const vendor = await createVendor({ name: 'New Vendor' });
      const product = await createProduct(vendor._id, { price: 10 });
      await createOrder({ vendor, product, unitPrice: 10, quantity: 1, status: 'cancelled', createdBy: user });

      const res = await request(app).get('/api/recommendations/vendors').set('Authorization', `Bearer ${token}`);

      expect(res.body.data.vendorRecommendations.find((v) => v.vendorName === 'New Vendor')).toBeUndefined();
    });

    it('flags a vendor with listed products but zero orders ever placed', async () => {
      const vendor = await createVendor({ name: 'Dormant Vendor' });
      await createProduct(vendor._id, { price: 10 });

      const res = await request(app).get('/api/recommendations/vendors').set('Authorization', `Bearer ${token}`);

      const concern = res.body.data.vendorRecommendations.find((v) => v.vendorName === 'Dormant Vendor');
      expect(concern.severity).toBe('MEDIUM');
      expect(concern.reason).toMatch(/no orders have ever been placed/);
    });
  });
});
