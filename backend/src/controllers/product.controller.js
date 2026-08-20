const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const productService = require('../services/product.service');

const create = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  sendSuccess(res, 201, { product }, 'Product created successfully');
});

const list = asyncHandler(async (req, res) => {
  const products = await productService.listProducts(req.query);
  sendSuccess(res, 200, { products });
});

const getById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  sendSuccess(res, 200, { product });
});

const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  sendSuccess(res, 200, { product }, 'Product updated successfully');
});

const remove = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  sendSuccess(res, 200, null, 'Product deleted successfully');
});

module.exports = { create, list, getById, update, remove };
