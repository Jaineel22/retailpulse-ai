const { z } = require('zod');

const createVendorSchema = z.object({
  name: z.string().trim().min(1, 'Vendor name is required').max(150),
  contactEmail: z.string().trim().toLowerCase().email('Invalid email address').optional(),
  contactPhone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateVendorSchema = createVendorSchema.partial();

module.exports = { createVendorSchema, updateVendorSchema };
