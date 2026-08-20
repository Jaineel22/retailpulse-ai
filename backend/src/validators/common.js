const { z } = require('zod');
const mongoose = require('mongoose');

const objectId = (fieldName = 'id') =>
  z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: `${fieldName} must be a valid ObjectId`,
  });

module.exports = { objectId };
