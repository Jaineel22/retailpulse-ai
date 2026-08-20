const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const webhookService = require('../services/webhook.service');

const handleMockCommerce = asyncHandler(async (req, res) => {
  const result = await webhookService.processMockCommerceWebhook(req.body);

  if (result.duplicate) {
    return sendSuccess(
      res,
      200,
      { duplicate: true, eventId: result.event.eventId, status: result.event.status },
      'Event already recorded; ignored'
    );
  }

  if (result.event.status === 'failed') {
    return res.status(400).json({
      success: false,
      message: 'Webhook received but could not be applied',
      data: { eventId: result.event.eventId, error: result.event.error },
    });
  }

  sendSuccess(
    res,
    201,
    { duplicate: false, eventId: result.event.eventId, status: result.event.status },
    'Event processed successfully'
  );
});

module.exports = { handleMockCommerce };
