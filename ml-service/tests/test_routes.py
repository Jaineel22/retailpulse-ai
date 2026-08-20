"""
Route-level tests. Monkeypatches the Mongo-reading functions (fetch_daily_demand /
fetch_daily_activity) so these exercise the real HTTP + pydantic response
validation path without needing a MongoDB instance — see preprocessing.py's
docstring for why I/O is isolated into just those two functions.
"""

import app.routes.ml as ml_routes
from fastapi.testclient import TestClient
from tests.conftest import make_daily_series

from app.main import app

client = TestClient(app)


def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_forecast_returns_expected_schema(monkeypatch):
    daily = make_daily_series(days=90, base=25, trend=0.15, noise=3.0, seed=3)
    monkeypatch.setattr(ml_routes, "fetch_daily_demand", lambda product_id: daily)

    res = client.get("/forecast/64b64b64b64b64b64b64b64b?horizonDays=5")

    assert res.status_code == 200
    body = res.json()
    assert body["productId"] == "64b64b64b64b64b64b64b64b"
    assert body["horizonDays"] == 5
    assert len(body["forecast"]) == 5
    assert len(body["baselineForecast"]) == 5
    assert body["modelName"] == "RandomForestRegressor"
    assert "mae" in body["metrics"]["model"] and "rmse" in body["metrics"]["model"]
    assert "mae" in body["metrics"]["baseline"] and "rmse" in body["metrics"]["baseline"]
    assert isinstance(body["modelBeatsBaseline"], bool)


def test_forecast_rejects_invalid_product_id(monkeypatch):
    def _raise(product_id):
        raise ValueError(f"'{product_id}' is not a valid product id")

    monkeypatch.setattr(ml_routes, "fetch_daily_demand", _raise)

    res = client.get("/forecast/not-a-valid-id")

    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "INVALID_PRODUCT_ID"


def test_forecast_returns_insufficient_history_for_short_series(monkeypatch):
    short = make_daily_series(days=5, base=10, trend=0.0, noise=1.0, seed=1)
    monkeypatch.setattr(ml_routes, "fetch_daily_demand", lambda product_id: short)

    res = client.get("/forecast/64b64b64b64b64b64b64b64b")

    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "INSUFFICIENT_HISTORY"
    assert res.json()["detail"]["daysAvailable"] == 5


def test_anomalies_returns_expected_schema(monkeypatch):
    dates = make_daily_series(days=45, base=20, trend=0.0, noise=2.0, seed=5)["date"]
    demand = make_daily_series(days=45, base=20, trend=0.0, noise=2.0, seed=5)["demand"]
    import pandas as pd

    daily = pd.DataFrame({"date": dates, "demand": demand, "inventory_delta": -demand})
    monkeypatch.setattr(ml_routes, "fetch_daily_activity", lambda product_id: daily)

    res = client.get("/anomalies/64b64b64b64b64b64b64b64b")

    assert res.status_code == 200
    body = res.json()
    assert body["productId"] == "64b64b64b64b64b64b64b64b"
    assert isinstance(body["anomalies"], list)
    for a in body["anomalies"]:
        assert set(a.keys()) == {"timestamp", "score", "reason", "severity"}
