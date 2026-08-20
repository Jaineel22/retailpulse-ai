const bcrypt = require('bcryptjs');
const { User } = require('../../src/models/User');
const { signToken } = require('../../src/utils/jwt');

let emailCounter = 0;

async function createUser({ name = 'Test User', email, password = 'Password123!', role = 'analyst' } = {}) {
  const resolvedEmail = email || `user${++emailCounter}@example.com`;
  const hashed = await bcrypt.hash(password, 4);
  const user = await User.create({ name, email: resolvedEmail, password: hashed, role });
  const token = signToken({ id: user._id.toString(), role: user.role });
  return { user, token, rawPassword: password };
}

module.exports = { createUser };
