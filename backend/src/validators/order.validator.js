const { z } = require('zod');
const { objectId } = require('./common');
const { ORDER_STATUSES } = require('../models/Order');

const orderItemSchema = z.object({
  product: objectId('product'),
  quantity: z.number({ invalid_type_error: 'Quantity must be a number' }).int().positive('Quantity must be at least 1'),
});

const createOrderSchema = z.object({
  vendor: objectId('vendor'),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` }),
  }),
});

module.exports = { createOrderSchema, updateOrderStatusSchema };
