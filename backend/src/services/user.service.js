const { User } = require('../models/User');
const ApiError = require('../utils/ApiError');

async function listUsers() {
  const users = await User.find().sort({ createdAt: -1 });
  return users.map((u) => u.toSafeObject());
}

async function getUserById(id) {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user.toSafeObject();
}

module.exports = { listUsers, getUserById };
