const express = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('admin'), userController.list);
router.get('/:id', userController.getById);

module.exports = router;
