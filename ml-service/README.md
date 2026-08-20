# RetailPulse AI — ML Service (Phase 3)

An internal FastAPI service providing demand forecasting and anomaly detection
for RetailPulse AI. It is **never called by the frontend** — only the Node
backend calls it, and only the Node backend talks to end users.

```
Node backend (auth, RBAC, orchestration, persistence)
        │  GET /forecast/{productId}?horizonDays=N
        │  GET /anomalies/{productId}
        ▼
FastAPI ML service (this directory)
        │  reads inventoryevents directly
        ▼
MongoDB (same database as Node — no second database)
```

## Why Python is a separate service from Node

Python provides the natural ML/data ecosystem (pandas, NumPy, scikit-learn)
for feature engineering and model training; Node stays the primary
application/API layer (auth, RBAC, request orchestration, persistence). Each
side does the part it's actually good at instead of forcing tabular ML into
Node or forcing HTTP/auth plumbing into Python.

## Why this service reads MongoDB directly

The Phase 3 architecture diagram shows `FastAPI → MongoDB` directly, and
`pymongo` is a required dependency — so this service queries the
`inventoryevents` collection itself rather than having Node serialize
potentially large historical arrays into every request body. Node still owns
everything user-facing: it validates the product exists and the caller is
authorized *before* ever calling this service, and it validates + persists
the response afterward. This service defines **no** Product/Order/Inventory
model of its own — it only reads the one collection it needs.

## Endpoints

### `GET /forecast/{productId}?horizonDays=7`
Trains a `RandomForestRegressor` on that product's daily sales history,
evaluates it against a naive baseline on a chronological holdout, and returns
a `horizonDays`-day forecast. See the root [`docs/API.md`](../docs/API.md) for
the full response shape and the forecasting methodology writeup.

### `GET /anomalies/{productId}`
Runs Isolation Forest over the product's daily demand/inventory-delta/rolling
z-score features and returns flagged days with a deterministic reason and
severity.

### `GET /health`
Liveness check.

Both ML endpoints return `422 { "detail": { "code": "INSUFFICIENT_HISTORY", ... } }`
when a product doesn't have enough sale history (default: 21 days), and
`400 { "detail": { "code": "INVALID_PRODUCT_ID", ... } }` for a malformed id.

## Forecasting methodology (brief — full writeup in docs/API.md)

- **Features**: `lag_7`, `lag_14`, `rolling_mean_7` (computed on `shift(1)` so
  it never includes the current day — no leakage), `day_of_week`, `week_of_month`.
- **Model**: `RandomForestRegressor` (200 trees, `min_samples_leaf=2`,
  `random_state=42`) — chosen over `HistGradientBoostingRegressor` because
  per-product training sets are small (tens of rows), and Random Forest's
  bagging is more stable on small tabular data and needs no tuning to behave
  sensibly, which keeps its behavior easy to explain.
- **Evaluation**: chronological split — train on all but the last `ML_EVAL_DAYS`
  (default 14) days, evaluate MAE/RMSE on that held-out tail. Never a random
  split, which would leak future rows into training for time-series data.
- **Baseline**: for evaluation, a walk-forward persistence forecast
  (`prediction[t] = actual[t-1]`); for the genuine future forecast, the single
  last observed value repeated across the horizon (there's no new ground truth
  to roll forward into the unknown future).
- **Future forecast**: a model retrained on *all* available history (the eval
  split is only for honest metrics) predicts one day at a time, recursively
  feeding each day's own prediction back in as history for the next day's lag
  features.

## Anomaly detection methodology

- **Model**: `IsolationForest` (`contamination=0.1`, `random_state=42`) —
  chosen because it's an efficient unsupervised way to flag unusual
  observations without labeled anomaly data, which doesn't exist here.
- **Features**: daily demand, daily net inventory delta, rolling z-score of
  demand (also leakage-safe via `shift(1)`).
- Isolation Forest only returns a score + inlier/outlier flag — it has no
  concept of "why". The `reason` text and `severity` are deterministic
  post-processing over fixed, documented z-score thresholds (`>= 3.0` high,
  `>= 2.0` medium, otherwise low), never an LLM-generated explanation.

## Running locally

```bash
cd ml-service
python -m venv .venv
./.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # point MONGODB_URI at the same DB the Node backend uses
uvicorn app.main:app --reload --port 8000
```

Requires the backend's seed data (`npm run seed` in `backend/`) to exist first
— without seeded `inventoryevents`, every product will return
`INSUFFICIENT_HISTORY`.

## Testing

```bash
pytest -v
```

No MongoDB is required to run the test suite: every service function
(`preprocessing`, `forecasting`, `anomaly_detection`) operates on plain pandas
DataFrames, and the one route-level test file monkeypatches the two functions
that actually touch MongoDB (`fetch_daily_demand`, `fetch_daily_activity`).

## Known limitations

- `RandomForestRegressor` cannot extrapolate beyond the range of target values
  seen during training — on a product with a strong, near-monotonic trend,
  this can make the naive baseline (which tracks the trend by definition,
  since it's just "yesterday's value") temporarily competitive or better. See
  the root README's Phase 3 section for the actual measured numbers.
- No authentication inside FastAPI — this service is internal-only by design;
  it must not be exposed publicly. RBAC/authentication live entirely in Node.
- No scheduled/cron execution in this phase (SHOULD-HAVE, not MUST-HAVE) —
  forecasting and anomaly detection are triggered on demand via the Node API.
