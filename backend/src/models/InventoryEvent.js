const mongoose = require('mongoose');

const INVENTORY_EVENT_TYPES = ['restock', 'sale', 'adjustment'];

const inventoryEventSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      enum: INVENTORY_EVENT_TYPES,
      required: true,
    },
    // Positive = stock increase (restock), negative = stock decrease (sale).
    delta: {
      type: Number,
      required: true,
    },
    source: {
      type: String,
      trim: true,
      default: 'manual',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The ML service's primary query pattern: "give me this product's events in date order".
inventoryEventSchema.index({ product: 1, createdAt: 1 });
inventoryEventSchema.index({ type: 1 });

const InventoryEvent = mongoose.model('InventoryEvent', inventoryEventSchema);

module.exports = { InventoryEvent, INVENTORY_EVENT_TYPES };
