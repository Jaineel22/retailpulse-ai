function sendSuccess(res, statusCode, data, message) {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess };
