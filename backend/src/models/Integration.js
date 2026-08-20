const mongoose = require('mongoose');

// Providers the adapter factory knows how to resolve. Adding a real provider later
// only means adding it here and registering an adapter — see src/integrations/adapters.
const PROVIDERS = ['mock-commerce', 'shopify-stub'];

const integrationConfigSchema = new mongoose.Schema(
  {
    // Synced products/orders need a vendor bucket to attach to, since Product.vendor
    // and Order.vendor are required fields in the Phase 1 domain model.
    defaultVendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    pageSize: {
      type: Number,
      min: 1,
      max: 50,
      default: 2,
    },
    // Test/demo hook: when true, the adapter simulates an upstream provider outage.
    simulateFailure: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const integrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    provider: {
      type: String,
      enum: PROVIDERS,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    config: {
      type: integrationConfigSchema,
      required: true,
    },
    lastSyncAt: {
      type: Date,
    },
    lastSyncStatus: {
      type: String,
      enum: ['success', 'failed'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

integrationSchema.index({ provider: 1 });

const Integration = mongoose.model('Integration', integrationSchema);

module.exports = { Integration, PROVIDERS };
