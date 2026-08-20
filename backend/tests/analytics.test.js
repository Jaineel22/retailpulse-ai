const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers/testUtils');
const { createVendor, createProduct } = require('./helpers/fixtures');
const { Order } = require('../src/models/Order');
const Inventory = require('../src/models/Inventory');

async function createOrder({ vendor, product, quantity, unitPrice, status, createdBy, createdAt }) {
  const subtotal = Number((unitPrice * quantity).toFixed(2));
  return Order.create({
    vendor: vendor._id,
    items: [{ product: product._id, quantity, unitPrice, subtotal }],
    totalAmount: subtotal,
    status,
    createdBy: createdBy._id,
    createdAt,
  });
}

describe('Analytics (MongoDB aggregation)', () => {
  let analystToken;
  let admin;

  beforeEach(async () => {
    const analyst = await createUser({ role: 'analyst' });
    analystToken = analyst.token;
    admin = (await createUser({ role: 'admin' })).user;
  });

  it('rejects unauthenticated access to all four analytics endpoints', async () => {
    const paths = ['/api/analytics/summary', '/api/analytics/sales-trend', '/api/analytics/top-products', '/api/analytics/vendor-performance'];
    for (const path of paths) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });

  it('allows the analyst role (read-only) to read every analytics endpoint', async () => {
    const paths = ['/api/analytics/summary', '/api/analytics/sales-trend', '/api/analytics/top-products', '/api/analytics/vendor-performance'];
    for (const path of paths) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get(path).set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
    }
  });

  describe('GET /api/analytics/summary', () => {
    it('computes totals correctly, excluding cancelled orders from sales', async () => {
      const vendor = await createVendor();
      const product = await createProduct(vendor._id, { price: 10 });

      await createOrder({ vendor, product, quantity: 2, unitPrice: 10, status: 'delivered', createdBy: admin });
      await createOrder({ vendor, product, quantity: 3, unitPrice: 10, status: 'confirmed', createdBy: admin });
      await createOrder({ vendor, product, quantity: 5, unitPrice: 10, status: 'cancelled', createdBy: admin });

      await Inventory.create({ product: product._id, quantity: 0, reorderThreshold: 10 }); // out of stock
      const product2 = await createProduct(vendor._id, { price: 5 });
      await Inventory.create({ product: product2._id, quantity: 3, reorderThreshold: 10 }); // low stock
      const product3 = await createProduct(vendor._id, { price: 5 });
      await Inventory.create({ product: product3._id, quantity: 50, reorderThreshold: 10 }); // healthy

      const res = await request(app).get('/api/analytics/summary').set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      // sales = (2*10) + (3*10) = 50, cancelled order excluded
      expect(res.body.data.totalSales).toBe(50);
      expect(res.body.data.totalOrders).toBe(3);
      // average over the 2 non-cancelled orders: 50 / 2 = 25
      expect(res.body.data.averageOrderValue).toBe(25);
      expect(res.body.data.outOfStockProductCount).toBe(1);
      expect(res.body.data.lowStockProductCount).toBe(1);
    });

    it('returns zeroed values when there is no data at all', async () => {
      const res = await request(app).get('/api/analytics/summary').set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalSales).toBe(0);
      expect(res.body.data.totalOrders).toBe(0);
      expect(res.body.data.averageOrderValue).toBe(0);
    });
  });

  describe('GET /api/analytics/sales-trend', () => {
    it('groups sales by day and excludes cancelled orders and out-of-range dates', async () => {
      const vendor = await createVendor();
      const product = await createProduct(vendor._id, { price: 10 });

      const day1 = new Date();
      day1.setDate(day1.getDate() - 2);
      const day2 = new Date();
      day2.setDate(day2.getDate() - 1);
      const tooOld = new Date();
      tooOld.setDate(tooOld.getDate() - 90);

      await createOrder({ vendor, product, quantity: 1, unitPrice: 10, status: 'delivered', createdBy: admin, createdAt: day1 });
      await createOrder({ vendor, product, quantity: 2, unitPrice: 10, status: 'delivered', createdBy: admin, createdAt: day1 });
      await createOrder({ vendor, product, quantity: 1, unitPrice: 10, status: 'confirmed', createdBy: admin, createdAt: day2 });
      await createOrder({ vendor, product, quantity: 9, unitPrice: 10, status: 'cancelled', createdBy: admin, createdAt: day2 });
      await createOrder({ vendor, product, quantity: 9, unitPrice: 10, status: 'delivered', createdBy: admin, createdAt: tooOld });

      const res = await request(app).get('/api/analytics/sales-trend?days=30').set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const dates = res.body.data.trend.map((t) => t.date);
      expect(dates).toEqual([...dates].sort()); // ascending order
      const day1Str = day1.toISOString().slice(0, 10);
      const day2Str = day2.toISOString().slice(0, 10);
      const day1Entry = res.body.data.trend.find((t) => t.date === day1Str);
      const day2Entry = res.body.data.trend.find((t) => t.date === day2Str);
      expect(day1Entry).toEqual({ date: day1Str, sales: 30, orders: 2 });
      expect(day2Entry).toEqual({ date: day2Str, sales: 10, orders: 1 }); // cancelled order excluded
      expect(res.body.data.trend.find((t) => t.sales === 90)).toBeUndefined(); // too-old order excluded
    });
  });

  describe('GET /api/analytics/top-products', () => {
    it('ranks products by revenue with correct quantitySold', async () => {
      const vendor = await createVendor();
      const productA = await createProduct(vendor._id, { name: 'Product A', price: 10 });
      const productB = await createProduct(vendor._id, { name: 'Product B', price: 80 });

      await createOrder({ vendor, product: productA, quantity: 3, unitPrice: 10, status: 'delivered', createdBy: admin });
      await createOrder({ vendor, product: productA, quantity: 2, unitPrice: 10, status: 'delivered', createdBy: admin });
      await createOrder({ vendor, product: productB, quantity: 1, unitPrice: 80, status: 'delivered', createdBy: admin });

      const res = await request(app).get('/api/analytics/top-products?limit=5').set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const products = res.body.data.products;
      // Product B's single order (revenue 80) outranks Product A's combined revenue (50).
      expect(products[0].productName).toBe('Product B');
      const productAEntry = products.find((p) => p.productName === 'Product A');
      expect(productAEntry.quantitySold).toBe(5);
      expect(productAEntry.revenue).toBe(50);
    });
  });

  describe('GET /api/analytics/vendor-performance', () => {
    it('computes per-vendor order/product counts and sales value', async () => {
      const vendorA = await createVendor({ name: 'Vendor A' });
      const vendorB = await createVendor({ name: 'Vendor B' });
      const productA1 = await createProduct(vendorA._id, { price: 20 });
      await createProduct(vendorA._id, { price: 5 });
      await createProduct(vendorB._id, { price: 5 });

      await createOrder({ vendor: vendorA, product: productA1, quantity: 2, unitPrice: 20, status: 'delivered', createdBy: admin });
      await createOrder({ vendor: vendorA, product: productA1, quantity: 1, unitPrice: 20, status: 'cancelled', createdBy: admin });

      const res = await request(app).get('/api/analytics/vendor-performance').set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      const vendorAEntry = res.body.data.vendors.find((v) => v.name === 'Vendor A');
      const vendorBEntry = res.body.data.vendors.find((v) => v.name === 'Vendor B');

      expect(vendorAEntry.productCount).toBe(2);
      expect(vendorAEntry.orderCount).toBe(2); // includes the cancelled order in volume
      expect(vendorAEntry.nonCancelledOrderCount).toBe(1);
      expect(vendorAEntry.salesValue).toBe(40); // cancelled order excluded from revenue
      expect(vendorAEntry.averageOrderValue).toBe(40); // 40 / 1 non-cancelled order, not / 2

      expect(vendorBEntry.productCount).toBe(1);
      expect(vendorBEntry.orderCount).toBe(0);
      expect(vendorBEntry.nonCancelledOrderCount).toBe(0);
      expect(vendorBEntry.salesValue).toBe(0);
      expect(vendorBEntry.averageOrderValue).toBe(0);
    });
  });
});
