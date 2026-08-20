const express = require('express');
const orderController = require('../controllers/order.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/rbac.middleware');
const validate = require('../middleware/validate.middleware');
const { createOrderSchema, updateOrderStatusSchema } = require('../validators/order.validator');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('admin', 'operator'), validate(createOrderSchema), orderController.create);
router.get('/', orderController.list);
router.get('/:id', orderController.getById);
router.put('/:id', authorize('admin', 'operator'), validate(updateOrderStatusSchema), orderController.updateStatus);
router.delete('/:id', authorize('admin'), orderController.remove);

module.exports = router;
