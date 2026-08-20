const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    externalSource: {
      type: String,
      trim: true,
    },
    externalId: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

productSchema.index({ vendor: 1 });
productSchema.index({ category: 1 });
// Enforces "one internal product per external record" for synced products, without
// constraining products that were created directly through the Phase 1 API (no externalId).
productSchema.index(
  { externalSource: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
