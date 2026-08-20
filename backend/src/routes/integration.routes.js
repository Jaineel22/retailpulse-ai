const express = require('express');
const integrationController = require('../controllers/integration.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/rbac.middleware');
const validate = require('../middleware/validate.middleware');
const { createIntegrationSchema } = require('../validators/integration.validator');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('admin'), validate(createIntegrationSchema), integrationController.create);
router.get('/', integrationController.list);
router.get('/:id', integrationController.getById);
router.get('/:id/sync-logs', integrationController.listSyncLogs);
router.post('/:id/sync', authorize('admin', 'operator'), integrationController.sync);

module.exports = router;
