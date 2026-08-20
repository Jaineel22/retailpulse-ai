const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const orderService = require('../services/order.service');

const create = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body, req.user.id);
  sendSuccess(res, 201, { order }, 'Order created successfully');
});

const list = asyncHandler(async (req, res) => {
  const orders = await orderService.listOrders(req.query);
  sendSuccess(res, 200, { orders });
});

const getById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  sendSuccess(res, 200, { order });
});

const updateStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
  sendSuccess(res, 200, { order }, 'Order status updated successfully');
});

const remove = asyncHandler(async (req, res) => {
  await orderService.deleteOrder(req.params.id);
  sendSuccess(res, 200, null, 'Order deleted successfully');
});

module.exports = { create, list, getById, updateStatus, remove };
