const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');
const { User } = require('../models/User');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication token is missing');
  }

  const token = header.slice('Bearer '.length).trim();

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User account is no longer active');
  }

  req.user = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
  };

  next();
});

module.exports = authenticate;
