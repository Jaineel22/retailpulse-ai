const { z } = require('zod');
const { objectId } = require('./common');
const { PROVIDERS } = require('../models/Integration');

const createIntegrationSchema = z.object({
  name: z.string().trim().min(1, 'Integration name is required').max(150),
  provider: z.enum(PROVIDERS, {
    errorMap: () => ({ message: `provider must be one of: ${PROVIDERS.join(', ')}` }),
  }),
  isActive: z.boolean().optional(),
  config: z.object({
    defaultVendor: objectId('config.defaultVendor'),
    pageSize: z.number().int().positive().max(50).optional(),
    simulateFailure: z.boolean().optional(),
  }),
});

module.exports = { createIntegrationSchema };
