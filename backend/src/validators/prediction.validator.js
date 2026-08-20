const { z } = require('zod');
const { objectId } = require('./common');

const runPredictionSchema = z.object({
  productId: objectId('productId'),
  horizonDays: z.number().int().positive().max(30).optional(),
});

const forecastPointSchema = z.object({
  date: z.string().min(1),
  value: z.number(),
});

// Validates the FastAPI /forecast response BEFORE it is persisted. If this
// fails, the ML response is rejected outright rather than saved as-is —
// corrupt/malformed upstream data must never reach MongoDB.
const mlForecastResponseSchema = z.object({
  productId: z.string().min(1),
  horizonDays: z.number().int().positive(),
  modelName: z.string().min(1),
  historyDays: z.number().int().nonnegative(),
  forecast: z.array(forecastPointSchema).min(1),
  baselineForecast: z.array(forecastPointSchema).min(1),
  metrics: z.object({
    model: z.object({ mae: z.number().nonnegative(), rmse: z.number().nonnegative() }),
    baseline: z.object({ mae: z.number().nonnegative(), rmse: z.number().nonnegative() }),
  }),
  modelBeatsBaseline: z.boolean(),
  generatedAt: z.string().min(1),
});

module.exports = { runPredictionSchema, mlForecastResponseSchema };
