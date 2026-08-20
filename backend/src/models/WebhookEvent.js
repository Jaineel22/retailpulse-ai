const mongoose = require('mongoose');

const WEBHOOK_EVENT_TYPES = ['product.updated', 'inventory.updated', 'order.created', 'order.updated'];

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    // The idempotency key supplied by the (simulated) external provider.
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: WEBHOOK_EVENT_TYPES,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['received', 'processed', 'failed'],
      default: 'received',
    },
    processedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
  },
  { timestamps: true }
);

// Database-level idempotency guarantee: a (provider, eventId) pair can only be recorded once,
// even under concurrent duplicate deliveries. This is what makes webhook processing survive
// application restarts and race conditions, unlike an in-memory Set.
webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

module.exports = { WebhookEvent, WEBHOOK_EVENT_TYPES };
