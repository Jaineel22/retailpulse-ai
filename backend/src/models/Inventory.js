const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reservedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    reorderThreshold: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

inventorySchema.virtual('status').get(function status() {
  if (this.quantity <= 0) return 'out_of_stock';
  if (this.quantity <= this.reorderThreshold) return 'low_stock';
  return 'in_stock';
});

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;
