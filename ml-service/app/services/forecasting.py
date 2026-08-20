"""
Demand forecasting: RandomForestRegressor vs. a naive "repeat last value"
baseline, evaluated on a chronological holdout.

WHY RandomForestRegressor over HistGradientBoostingRegressor: per-product
training sets here are small (tens of rows once lag/rolling warm-up rows are
dropped), and Random Forest's bagging/averaging is more stable and less prone
to overfitting on small tabular datasets than gradient boosting, which
typically needs more data to tune well. It also needs no learning-rate/
iteration tuning to get sensible out-of-the-box results, which keeps the
model's behavior — an ensemble of decision trees, averaged — easy to explain.

Every function here takes plain DataFrames rather than a product_id, so tests
can exercise the actual forecasting logic with a synthetic DataFrame and never
need a database (see tests/test_forecasting.py).
"""

from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from app.services.preprocessing import FEATURE_COLUMNS, chronological_split
from app.utils.metrics import mae, rmse

MODEL_NAME = "RandomForestRegressor"
RANDOM_STATE = 42


def _make_model() -> RandomForestRegressor:
    return RandomForestRegressor(n_estimators=200, min_samples_leaf=2, random_state=RANDOM_STATE)


def _naive_eval_baseline(test_df: pd.DataFrame, daily: pd.DataFrame) -> np.ndarray:
    """
    Walk-forward naive baseline for the EVALUATION window only: each test
    day's prediction is the previous day's ACTUAL demand (a persistence
    forecast) — the standard definition of a naive time-series baseline, and
    what the model has to beat to be worth using.
    """
    demand_by_date = daily.set_index("date")["demand"]
    preds = [demand_by_date.get(date - pd.Timedelta(days=1), 0.0) for date in test_df["date"]]
    return np.array(preds, dtype=float)


def evaluate(daily: pd.DataFrame, features: pd.DataFrame, eval_days: int) -> dict:
    """Trains on all-but-last `eval_days` feature rows; scores model + baseline on the rest."""
    train, test = chronological_split(features, eval_days)

    model = _make_model()
    model.fit(train[FEATURE_COLUMNS], train["demand"])
    model_preds = model.predict(test[FEATURE_COLUMNS])

    baseline_preds = _naive_eval_baseline(test, daily)
    y_true = test["demand"].to_numpy()

    return {
        "model": {"mae": mae(y_true, model_preds), "rmse": rmse(y_true, model_preds)},
        "baseline": {"mae": mae(y_true, baseline_preds), "rmse": rmse(y_true, baseline_preds)},
    }


def _week_of_month(date: pd.Timestamp) -> int:
    return ((date.day - 1) // 7) + 1


def forecast_future(daily: pd.DataFrame, features: pd.DataFrame, horizon_days: int) -> list[dict]:
    """
    Recursive multi-step forecast: trains a final model on ALL available
    feature rows (the eval split above intentionally withholds recent data;
    the production forecast should not), then predicts one day at a time,
    feeding each day's own prediction back into the rolling history so the
    next day's lag/rolling features can be computed. This is the standard,
    non-leaky way to do multi-step forecasting with lag features — a single
    one-shot prediction can't work here because day 2's lag_7 may depend on a
    day that is itself only known via day 1's forecast.
    """
    model = _make_model()
    model.fit(features[FEATURE_COLUMNS], features["demand"])

    history = daily[["date", "demand"]].copy()
    last_date = history["date"].max()

    points = []
    for step in range(1, horizon_days + 1):
        next_date = last_date + pd.Timedelta(days=step)
        demand_by_date = history.set_index("date")["demand"]

        lag_7 = demand_by_date.get(next_date - pd.Timedelta(days=7), 0.0)
        lag_14 = demand_by_date.get(next_date - pd.Timedelta(days=14), 0.0)

        window_start = next_date - pd.Timedelta(days=7)
        window_end = next_date - pd.Timedelta(days=1)
        window = history[(history["date"] >= window_start) & (history["date"] <= window_end)]
        rolling_mean_7 = float(window["demand"].mean()) if len(window) > 0 else 0.0

        row = pd.DataFrame(
            [
                {
                    "lag_7": lag_7,
                    "lag_14": lag_14,
                    "rolling_mean_7": rolling_mean_7,
                    "day_of_week": next_date.dayofweek,
                    "week_of_month": _week_of_month(next_date),
                }
            ]
        )
        prediction = float(max(0.0, model.predict(row[FEATURE_COLUMNS])[0]))

        points.append({"date": next_date.strftime("%Y-%m-%d"), "value": round(prediction, 2)})
        history = pd.concat([history, pd.DataFrame([{"date": next_date, "demand": prediction}])], ignore_index=True)

    return points


def naive_future_forecast(daily: pd.DataFrame, horizon_days: int) -> list[dict]:
    """
    The FUTURE-facing naive baseline: there is no new ground truth to roll
    forward day-by-day into the genuine future, so it repeats the single last
    observed actual demand value across the whole horizon — exactly the
    blueprint's own example (last observed = 10 -> [10, 10, ..., 10]).
    """
    last_date = daily["date"].max()
    last_value = float(daily.sort_values("date").iloc[-1]["demand"])
    return [
        {"date": (last_date + pd.Timedelta(days=step)).strftime("%Y-%m-%d"), "value": round(last_value, 2)}
        for step in range(1, horizon_days + 1)
    ]


def run_forecast(daily: pd.DataFrame, features: pd.DataFrame, horizon_days: int, eval_days: int) -> dict:
    metrics = evaluate(daily, features, eval_days)
    forecast_points = forecast_future(daily, features, horizon_days)
    baseline_points = naive_future_forecast(daily, horizon_days)

    return {
        "forecast": forecast_points,
        "baselineForecast": baseline_points,
        "metrics": metrics,
        "modelBeatsBaseline": metrics["model"]["mae"] < metrics["baseline"]["mae"],
        "historyDays": len(daily),
        "modelName": MODEL_NAME,
        "generatedAt": datetime.now(timezone.utc),
    }
