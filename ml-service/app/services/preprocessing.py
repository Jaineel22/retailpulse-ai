"""
Turns raw `inventoryevents` documents into a leakage-safe, model-ready feature
table.

Kept deliberately separate from Mongo I/O: `fetch_daily_demand()` is the only
function that talks to the database. Every other function operates on a plain
pandas DataFrame, which is what makes them unit-testable without a database
(see tests/test_preprocessing.py).
"""

import numpy as np
import pandas as pd
from bson import ObjectId
from bson.errors import InvalidId

from app.db import get_database

FEATURE_COLUMNS = ["lag_7", "lag_14", "rolling_mean_7", "day_of_week", "week_of_month"]


class InsufficientHistoryError(Exception):
    """Raised when a product does not have enough historical data to model."""

    def __init__(self, days_available: int, minimum_required: int):
        self.days_available = days_available
        self.minimum_required = minimum_required
        super().__init__(
            f"Only {days_available} day(s) of history available; at least {minimum_required} required"
        )


def fetch_daily_demand(product_id: str) -> pd.DataFrame:
    """
    Reads this product's 'sale' inventory events and returns a continuous daily
    demand series (missing days filled with 0 sales), sorted by date ascending.
    Columns: date (datetime64), demand (float).
    """
    try:
        object_id = ObjectId(product_id)
    except InvalidId as exc:
        raise ValueError(f"'{product_id}' is not a valid product id") from exc

    db = get_database()
    rows = list(
        db.inventoryevents.find(
            {"product": object_id, "type": "sale"},
            {"delta": 1, "createdAt": 1, "_id": 0},
        )
    )

    if not rows:
        return pd.DataFrame(columns=["date", "demand"])

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["createdAt"]).dt.normalize()
    # 'sale' events store a negative delta (stock decrease); demand is the positive quantity sold.
    df["demand"] = -df["delta"]
    daily = df.groupby("date", as_index=False)["demand"].sum()

    full_range = pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")
    daily = (
        daily.set_index("date")
        .reindex(full_range, fill_value=0)
        .rename_axis("date")
        .reset_index()
    )
    daily["demand"] = daily["demand"].astype(float)
    return daily


def fetch_daily_activity(product_id: str) -> pd.DataFrame:
    """
    Like fetch_daily_demand, but includes ALL event types (not just 'sale') so
    anomaly detection can see net inventory movement alongside demand.
    Columns: date, demand (sale-only, positive), inventory_delta (net of every
    event type that day — restocks positive, sales negative, adjustments as-is).
    """
    try:
        object_id = ObjectId(product_id)
    except InvalidId as exc:
        raise ValueError(f"'{product_id}' is not a valid product id") from exc

    db = get_database()
    rows = list(
        db.inventoryevents.find(
            {"product": object_id},
            {"type": 1, "delta": 1, "createdAt": 1, "_id": 0},
        )
    )

    if not rows:
        return pd.DataFrame(columns=["date", "demand", "inventory_delta"])

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["createdAt"]).dt.normalize()
    df["sale_demand"] = np.where(df["type"] == "sale", -df["delta"], 0.0)
    daily = df.groupby("date", as_index=False).agg(demand=("sale_demand", "sum"), inventory_delta=("delta", "sum"))

    full_range = pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")
    daily = (
        daily.set_index("date")
        .reindex(full_range, fill_value=0)
        .rename_axis("date")
        .reset_index()
    )
    daily["demand"] = daily["demand"].astype(float)
    daily["inventory_delta"] = daily["inventory_delta"].astype(float)
    return daily


def build_features(daily: pd.DataFrame) -> pd.DataFrame:
    """
    Adds lag/rolling/calendar features to a daily demand series.

    CRITICAL (no data leakage): rolling_mean_7 is computed on demand.shift(1)
    before rolling, so day t's rolling mean only ever averages days strictly
    before t — never t itself. Rows whose lag/rolling window isn't fully
    populated yet (the first 14 days) are dropped rather than filled, since a
    guessed value there would be more misleading than useful.
    """
    df = daily.copy().sort_values("date").reset_index(drop=True)
    df["lag_7"] = df["demand"].shift(7)
    df["lag_14"] = df["demand"].shift(14)
    df["rolling_mean_7"] = df["demand"].shift(1).rolling(window=7, min_periods=7).mean()
    df["day_of_week"] = df["date"].dt.dayofweek
    df["week_of_month"] = ((df["date"].dt.day - 1) // 7) + 1

    df = df.dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)
    return df


def chronological_split(df: pd.DataFrame, eval_days: int):
    """
    Splits a time-ordered feature table into (train, test) by taking the last
    `eval_days` rows as the test set. Deliberately NOT a random split — see
    docs/API.md and README for why random splitting leaks future information
    into training for time-series data.
    """
    if len(df) <= eval_days:
        raise ValueError(
            f"Not enough feature rows ({len(df)}) to reserve {eval_days} for a chronological test split"
        )
    train = df.iloc[: len(df) - eval_days].reset_index(drop=True)
    test = df.iloc[len(df) - eval_days :].reset_index(drop=True)
    return train, test


def get_model_ready_data(product_id: str, min_history_days: int) -> pd.DataFrame:
    """Fetches + feature-engineers a product's history, raising InsufficientHistoryError early."""
    daily = fetch_daily_demand(product_id)
    if len(daily) < min_history_days:
        raise InsufficientHistoryError(days_available=len(daily), minimum_required=min_history_days)

    features = build_features(daily)
    if len(features) == 0:
        raise InsufficientHistoryError(days_available=len(daily), minimum_required=min_history_days)

    return features
