const { z } = require('zod');

const askSchema = z.object({
  question: z.string().trim().min(3, 'Question must be at least 3 characters').max(500, 'Question is too long'),
});

module.exports = { askSchema };
