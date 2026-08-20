const { z } = require('zod');
const { ORDER_STATUSES } = require('../models/Order');

const baseFields = {
  eventId: z.string().trim().min(1, 'eventId is required'),
  provider: z.literal('mock-commerce'),
};

const productUpdatedEvent = z.object({
  ...baseFields,
  type: z.literal('product.updated'),
  data: z.object({
    externalId: z.string().trim().min(1),
    name: z.string().trim().min(1).optional(),
    price: z.number().nonnegative().optional(),
    category: z.string().trim().optional(),
    description: z.string().trim().optional(),
  }),
});

const inventoryUpdatedEvent = z.object({
  ...baseFields,
  type: z.literal('inventory.updated'),
  data: z.object({
    externalId: z.string().trim().min(1),
    quantity: z.number().int().nonnegative(),
    reorderThreshold: z.number().int().nonnegative().optional(),
  }),
});

const orderItemSchema = z.object({
  externalProductId: z.string().trim().min(1),
  quantity: z.number().int().positive(),
});

const orderCreatedEvent = z.object({
  ...baseFields,
  type: z.literal('order.created'),
  data: z.object({
    externalId: z.string().trim().min(1),
    status: z.enum(ORDER_STATUSES).optional(),
    items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
  }),
});

const orderUpdatedEvent = z.object({
  ...baseFields,
  type: z.literal('order.updated'),
  data: z.object({
    externalId: z.string().trim().min(1),
    status: z.enum(ORDER_STATUSES),
  }),
});

const mockCommerceWebhookSchema = z.discriminatedUnion('type', [
  productUpdatedEvent,
  inventoryUpdatedEvent,
  orderCreatedEvent,
  orderUpdatedEvent,
]);

module.exports = { mockCommerceWebhookSchema };
