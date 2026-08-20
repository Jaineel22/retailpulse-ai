const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const ApiError = require('../utils/ApiError');
const userService = require('../services/user.service');

const list = asyncHandler(async (req, res) => {
  const users = await userService.listUsers();
  sendSuccess(res, 200, { users });
});

const getById = asyncHandler(async (req, res) => {
  const isSelf = req.user.id === req.params.id;
  const isAdmin = req.user.role === 'admin';

  if (!isSelf && !isAdmin) {
    throw ApiError.forbidden('You cannot access another user\'s data');
  }

  const user = await userService.getUserById(req.params.id);
  sendSuccess(res, 200, { user });
});

module.exports = { list, getById };
