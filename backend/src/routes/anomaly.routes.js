const express = require('express');
const anomalyController = require('../controllers/anomaly.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/rbac.middleware');
const validate = require('../middleware/validate.middleware');
const { runAnomalyDetectionSchema } = require('../validators/anomaly.validator');

const router = express.Router();

router.use(authenticate);

router.post('/run', authorize('admin', 'operator'), validate(runAnomalyDetectionSchema), anomalyController.run);
router.get('/', anomalyController.list);

module.exports = router;
