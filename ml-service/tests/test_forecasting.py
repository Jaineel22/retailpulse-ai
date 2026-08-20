import pandas as pd
import pytest

from app.services import forecasting
from app.services.preprocessing import build_features
from tests.conftest import make_daily_series


@pytest.fixture
def trainable_data():
    daily = make_daily_series(days=90, base=25, trend=0.15, noise=3.0, seed=11)
    features = build_features(daily)
    return daily, features


def test_evaluate_trains_and_returns_mae_rmse_for_model_and_baseline(trainable_data):
    daily, features = trainable_data

    metrics = forecasting.evaluate(daily, features, eval_days=14)

    for group in ("model", "baseline"):
        assert group in metrics
        assert metrics[group]["mae"] >= 0
        assert metrics[group]["rmse"] >= 0
        # RMSE is never smaller than MAE for the same predictions.
        assert metrics[group]["rmse"] >= metrics[group]["mae"] - 1e-9


def test_baseline_uses_previous_actual_day_as_prediction(trainable_data):
    daily, features = trainable_data
    _, test = features.iloc[: len(features) - 14], features.iloc[len(features) - 14 :]

    baseline_preds = forecasting._naive_eval_baseline(test, daily)
    demand_by_date = daily.set_index("date")["demand"]

    for i, date in enumerate(test["date"]):
        expected = demand_by_date.get(date - pd.Timedelta(days=1), 0.0)
        assert baseline_preds[i] == pytest.approx(expected)


def test_forecast_future_returns_horizon_days_points_with_expected_schema(trainable_data):
    daily, features = trainable_data
    horizon = 7

    points = forecasting.forecast_future(daily, features, horizon)

    assert len(points) == horizon
    last_known_date = daily["date"].max()
    for i, point in enumerate(points, start=1):
        assert set(point.keys()) == {"date", "value"}
        assert point["date"] == (last_known_date + pd.Timedelta(days=i)).strftime("%Y-%m-%d")
        assert point["value"] >= 0


def test_naive_future_forecast_repeats_last_observed_value(trainable_data):
    daily, _ = trainable_data
    last_value = round(float(daily.sort_values("date").iloc[-1]["demand"]), 2)

    points = forecasting.naive_future_forecast(daily, horizon_days=7)

    assert len(points) == 7
    assert all(p["value"] == last_value for p in points)


def test_run_forecast_returns_full_expected_schema(trainable_data):
    daily, features = trainable_data

    result = forecasting.run_forecast(daily, features, horizon_days=7, eval_days=14)

    assert result["modelName"] == "RandomForestRegressor"
    assert len(result["forecast"]) == 7
    assert len(result["baselineForecast"]) == 7
    assert isinstance(result["modelBeatsBaseline"], bool)
    assert "model" in result["metrics"] and "baseline" in result["metrics"]
    assert result["historyDays"] == len(daily)
