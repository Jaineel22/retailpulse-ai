const express = require('express');
const inventoryController = require('../controllers/inventory.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/rbac.middleware');
const validate = require('../middleware/validate.middleware');
const { createInventorySchema, updateInventorySchema } = require('../validators/inventory.validator');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('admin', 'operator'), validate(createInventorySchema), inventoryController.create);
router.get('/', inventoryController.list);
router.get('/:id', inventoryController.getById);
router.put('/:id', authorize('admin', 'operator'), validate(updateInventorySchema), inventoryController.update);
router.delete('/:id', authorize('admin'), inventoryController.remove);

module.exports = router;
