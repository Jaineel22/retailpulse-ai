const express = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const vendorRoutes = require('./vendor.routes');
const productRoutes = require('./product.routes');
const inventoryRoutes = require('./inventory.routes');
const orderRoutes = require('./order.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vendors', vendorRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/orders', orderRoutes);

module.exports = router;
