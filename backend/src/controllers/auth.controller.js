const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const authService = require('../services/auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, 201, result, 'User registered successfully');
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, 200, result, 'Login successful');
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getById(req.user.id);
  sendSuccess(res, 200, { user });
});

module.exports = { register, login, me };
