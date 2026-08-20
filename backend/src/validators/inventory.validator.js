const { z } = require('zod');
const { objectId } = require('./common');

const createInventorySchema = z.object({
  product: objectId('product'),
  quantity: z.number({ invalid_type_error: 'Quantity must be a number' }).int().nonnegative('Quantity cannot be negative'),
  reservedQuantity: z.number().int().nonnegative('Reserved quantity cannot be negative').optional(),
  reorderThreshold: z.number().int().nonnegative('Reorder threshold cannot be negative').optional(),
});

const updateInventorySchema = z.object({
  quantity: z.number({ invalid_type_error: 'Quantity must be a number' }).int().nonnegative('Quantity cannot be negative').optional(),
  reservedQuantity: z.number().int().nonnegative('Reserved quantity cannot be negative').optional(),
  reorderThreshold: z.number().int().nonnegative('Reorder threshold cannot be negative').optional(),
});

module.exports = { createInventorySchema, updateInventorySchema };
