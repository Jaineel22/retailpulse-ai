const express = require('express');
const predictionController = require('../controllers/prediction.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/rbac.middleware');
const validate = require('../middleware/validate.middleware');
const { runPredictionSchema } = require('../validators/prediction.validator');

const router = express.Router();

router.use(authenticate);

// Triggering ML work mirrors the write/operational permission used for sync
// (Phase 2): admin + operator. Reading persisted predictions is open to all roles.
router.post('/run', authorize('admin', 'operator'), validate(runPredictionSchema), predictionController.run);
router.get('/:productId', predictionController.list);

module.exports = router;
