const express = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const vendorRoutes = require('./vendor.routes');
const productRoutes = require('./product.routes');
const inventoryRoutes = require('./inventory.routes');
const orderRoutes = require('./order.routes');
const integrationRoutes = require('./integration.routes');
const webhookRoutes = require('./webhook.routes');
const analyticsRoutes = require('./analytics.routes');
const predictionRoutes = require('./prediction.routes');
const anomalyRoutes = require('./anomaly.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vendors', vendorRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/orders', orderRoutes);
router.use('/integrations', integrationRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/predictions', predictionRoutes);
router.use('/anomalies', anomalyRoutes);

module.exports = router;
