const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const aiService = require('../services/ai.service');

const ask = asyncHandler(async (req, res) => {
  const result = await aiService.ask(req.body.question);
  sendSuccess(res, 200, result);
});

module.exports = { ask };
