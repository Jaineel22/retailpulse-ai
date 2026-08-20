const { z } = require('zod');
const { objectId } = require('./common');

const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(150),
  sku: z.string().trim().min(1, 'SKU is required').max(50),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(100).optional(),
  price: z.number({ invalid_type_error: 'Price must be a number' }).nonnegative('Price cannot be negative'),
  vendor: objectId('vendor'),
  isActive: z.boolean().optional(),
});

const updateProductSchema = createProductSchema.partial();

module.exports = { createProductSchema, updateProductSchema };
