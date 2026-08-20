const mongoose = require('mongoose');

const forecastPointSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const predictionSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    horizonDays: {
      type: Number,
      required: true,
    },
    modelName: {
      type: String,
      required: true,
    },
    predictedDemand: {
      type: [forecastPointSchema],
      required: true,
    },
    baselineForecast: {
      type: [forecastPointSchema],
      required: true,
    },
    mae: { type: Number, required: true },
    rmse: { type: Number, required: true },
    baselineMae: { type: Number, required: true },
    baselineRmse: { type: Number, required: true },
    modelBeatsBaseline: { type: Boolean, required: true },
    generatedAt: { type: Date, required: true },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

predictionSchema.index({ product: 1, generatedAt: -1 });

const Prediction = mongoose.model('Prediction', predictionSchema);

module.exports = { Prediction };
