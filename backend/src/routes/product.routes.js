const express = require('express');
const productController = require('../controllers/product.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/rbac.middleware');
const validate = require('../middleware/validate.middleware');
const { createProductSchema, updateProductSchema } = require('../validators/product.validator');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('admin', 'operator'), validate(createProductSchema), productController.create);
router.get('/', productController.list);
router.get('/:id', productController.getById);
router.put('/:id', authorize('admin', 'operator'), validate(updateProductSchema), productController.update);
router.delete('/:id', authorize('admin'), productController.remove);

module.exports = router;
