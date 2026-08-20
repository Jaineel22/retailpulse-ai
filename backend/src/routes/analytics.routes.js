const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const authenticate = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

// Read-only for every authenticated role — analytics is exactly what the
// analyst role exists for, and there's no write operation here to restrict.
router.get('/summary', analyticsController.summary);
router.get('/sales-trend', analyticsController.salesTrend);
router.get('/top-products', analyticsController.topProducts);
router.get('/vendor-performance', analyticsController.vendorPerformance);

module.exports = router;
