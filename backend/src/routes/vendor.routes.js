const express = require('express');
const vendorController = require('../controllers/vendor.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/rbac.middleware');
const validate = require('../middleware/validate.middleware');
const { createVendorSchema, updateVendorSchema } = require('../validators/vendor.validator');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('admin', 'operator'), validate(createVendorSchema), vendorController.create);
router.get('/', vendorController.list);
router.get('/:id', vendorController.getById);
router.put('/:id', authorize('admin', 'operator'), validate(updateVendorSchema), vendorController.update);
router.delete('/:id', authorize('admin'), vendorController.remove);

module.exports = router;
