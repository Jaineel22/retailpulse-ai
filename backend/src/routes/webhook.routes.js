const express = require('express');
const webhookController = require('../controllers/webhook.controller');
const verifyWebhookSecret = require('../middleware/webhookSecret.middleware');
const validate = require('../middleware/validate.middleware');
const { mockCommerceWebhookSchema } = require('../validators/webhook.validator');

const router = express.Router();

// No JWT here on purpose — this endpoint is called by an external system, not a
// logged-in RetailPulse user. It is protected by the shared-secret header instead.
router.post('/mock-commerce', verifyWebhookSecret, validate(mockCommerceWebhookSchema), webhookController.handleMockCommerce);

module.exports = router;
