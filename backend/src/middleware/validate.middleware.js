const ApiError = require('../utils/ApiError');

function formatZodErrors(zodError) {
  return zodError.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(ApiError.badRequest('Validation failed', formatZodErrors(result.error)));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
