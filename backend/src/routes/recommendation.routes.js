const express = require('express');
const recommendationController = require('../controllers/recommendation.controller');
const authenticate = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

// Read-only, computed on demand from existing data — every authenticated role
// may view recommendations (same philosophy as analytics/predictions/anomalies).
router.get('/', recommendationController.all);
router.get('/stockout', recommendationController.stockout);
router.get('/reorder', recommendationController.reorder);
router.get('/vendors', recommendationController.vendors);

module.exports = router;
