const bcrypt = require('bcryptjs');
const { User } = require('../models/User');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');

const SALT_ROUNDS = 10;

async function register({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name,
    email,
    password: passwordHash,
    role: 'analyst',
  });

  const token = signToken({ id: user._id.toString(), role: user.role });

  return { token, user: user.toSafeObject() };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw ApiError.unauthorized('User account is no longer active');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken({ id: user._id.toString(), role: user.role });

  return { token, user: user.toSafeObject() };
}

async function getById(id) {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user.toSafeObject();
}

module.exports = { register, login, getById };
