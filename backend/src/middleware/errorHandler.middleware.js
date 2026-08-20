const ApiError = require('../utils/ApiError');

function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Validation failed', errors);
  }

  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for field "${err.path}"`);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : undefined;
    return ApiError.conflict(`Duplicate value for ${field}${value ? `: "${value}"` : ''}`);
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Invalid or expired token');
  }

  return ApiError.internal('Something went wrong');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);

  if (!normalized.isOperational || normalized.statusCode >= 500) {
    console.error(err);
  }

  const body = {
    success: false,
    message: normalized.message,
  };

  if (normalized.errors) {
    body.errors = normalized.errors;
  }

  if (process.env.NODE_ENV === 'development' && normalized.statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(normalized.statusCode).json(body);
}

module.exports = errorHandler;
