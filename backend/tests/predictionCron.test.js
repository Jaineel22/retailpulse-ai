jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const cron = require('node-cron');
const { startPredictionCron, runForAllProducts } = require('../src/jobs/predictionCron');
const { createUser } = require('./helpers/testUtils');
const { createVendor, createProduct } = require('./helpers/fixtures');
const { Prediction } = require('../src/models/Prediction');
const { Anomaly } = require('../src/models/Anomaly');

function mockFetchByPath({ forecastBody, anomalyBody }) {
  global.fetch = jest.fn().mockImplementation((url) => {
    const isForecast = url.includes('/forecast/');
    return Promise.resolve({
      ok: true,
      json: async () => (isForecast ? forecastBody : anomalyBody),
    });
  });
}

describe('predictionCron', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('never schedules anything while NODE_ENV=test, even as a safety net beyond the env flag', () => {
    const task = startPredictionCron();
    expect(task).toBeNull();
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  it('runForAllProducts triggers prediction + anomaly detection only for active products', async () => {
    const admin = await createUser({ role: 'admin' });
    const vendor = await createVendor();
    const activeProduct = await createProduct(vendor._id, { isActive: true });
    const inactiveProduct = await createProduct(vendor._id, { isActive: false });

    mockFetchByPath({
      forecastBody: {
        productId: activeProduct._id.toString(),
        horizonDays: 7,
        modelName: 'RandomForestRegressor',
        historyDays: 60,
        forecast: [{ date: '2026-01-01', value: 10 }],
        baselineForecast: [{ date: '2026-01-01', value: 9 }],
        metrics: { model: { mae: 1, rmse: 1.2 }, baseline: { mae: 2, rmse: 2.2 } },
        modelBeatsBaseline: true,
        generatedAt: new Date().toISOString(),
      },
      anomalyBody: {
        productId: activeProduct._id.toString(),
        historyDays: 60,
        generatedAt: new Date().toISOString(),
        anomalies: [{ timestamp: '2026-01-01', score: -0.5, reason: 'Sales volume is significantly above the recent 7-day average.', severity: 'medium' }],
      },
    });

    await runForAllProducts(admin.user._id.toString());

    const predictions = await Prediction.find({});
    const anomalies = await Anomaly.find({});

    expect(predictions.length).toBe(1);
    expect(predictions[0].product.toString()).toBe(activeProduct._id.toString());
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].product.toString()).toBe(activeProduct._id.toString());

    // The inactive product must never have been touched.
    expect(predictions.some((p) => p.product.toString() === inactiveProduct._id.toString())).toBe(false);
  });

  it('continues to the next product when one product fails, instead of aborting the whole run', async () => {
    const admin = await createUser({ role: 'admin' });
    const vendor = await createVendor();
    await createProduct(vendor._id, { isActive: true });
    await createProduct(vendor._id, { isActive: true });

    global.fetch = jest.fn().mockRejectedValue(new Error('ML service is unavailable'));

    await expect(runForAllProducts(admin.user._id.toString())).resolves.toBeUndefined();

    const predictions = await Prediction.find({});
    expect(predictions.length).toBe(0); // every call failed, but nothing threw and both products were attempted
    expect(global.fetch).toHaveBeenCalledTimes(4); // 2 products x (forecast + anomalies)
  });
});
