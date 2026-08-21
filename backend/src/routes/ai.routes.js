const express = require('express');
const aiController = require('../controllers/ai.controller');
const authenticate = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { askSchema } = require('../validators/ai.validator');

const router = express.Router();

router.use(authenticate);

// Read-only from the caller's perspective (no domain mutation) — open to any
// authenticated role, same as analytics/predictions/anomalies.
router.post('/ask', validate(askSchema), aiController.ask);

module.exports = router;
