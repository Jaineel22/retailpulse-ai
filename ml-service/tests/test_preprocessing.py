import numpy as np
import pandas as pd
import pytest

from app.services.preprocessing import FEATURE_COLUMNS, build_features, chronological_split


def test_build_features_output_shape(daily_series):
    features = build_features(daily_series)

    # First 14 rows are dropped (lag_14 needs 14 prior days); the rest survive.
    assert len(features) == len(daily_series) - 14
    for col in FEATURE_COLUMNS + ["date", "demand"]:
        assert col in features.columns
    assert not features[FEATURE_COLUMNS].isna().any().any()


def test_lag_features_match_shifted_values(daily_series):
    features = build_features(daily_series)
    raw = daily_series.set_index("date")["demand"]

    for _, row in features.iterrows():
        expected_lag_7 = raw.loc[row["date"] - pd.Timedelta(days=7)]
        expected_lag_14 = raw.loc[row["date"] - pd.Timedelta(days=14)]
        assert row["lag_7"] == pytest.approx(expected_lag_7)
        assert row["lag_14"] == pytest.approx(expected_lag_14)


def test_rolling_mean_uses_only_prior_days_not_leakage(daily_series):
    """
    CRITICAL correctness test: rolling_mean_7 for day t must be the mean of
    days [t-7 .. t-1], and must NOT change if we corrupt day t's own demand
    value — proving day t's own value never leaks into its own feature.
    """
    features = build_features(daily_series)
    raw = daily_series.set_index("date")["demand"]

    sample_date = features.iloc[20]["date"]
    expected_window = [raw.loc[sample_date - pd.Timedelta(days=d)] for d in range(1, 8)]
    expected_mean = np.mean(expected_window)

    actual = features[features["date"] == sample_date]["rolling_mean_7"].iloc[0]
    assert actual == pytest.approx(expected_mean)

    # Corrupt day t's own demand in a copy; rolling_mean_7 for that same day must be unchanged.
    corrupted = daily_series.copy()
    corrupted.loc[corrupted["date"] == sample_date, "demand"] = 999999
    corrupted_features = build_features(corrupted)
    corrupted_value = corrupted_features[corrupted_features["date"] == sample_date]["rolling_mean_7"].iloc[0]
    assert corrupted_value == pytest.approx(actual)


def test_chronological_split_preserves_order_and_sizes(daily_series):
    features = build_features(daily_series)
    train, test = chronological_split(features, eval_days=10)

    assert len(test) == 10
    assert len(train) == len(features) - 10
    # Every train date must be earlier than every test date (no shuffling).
    assert train["date"].max() < test["date"].min()
    # Test set is exactly the tail of the full series, in original order.
    pd.testing.assert_frame_equal(test.reset_index(drop=True), features.tail(10).reset_index(drop=True))


def test_chronological_split_raises_when_too_few_rows(short_daily_series):
    # A 10-day series can't even produce a lag_14 feature, so build_features()
    # drops every row — chronological_split must refuse to split an empty/tiny frame.
    features = build_features(short_daily_series)
    assert len(features) < 10
    with pytest.raises(ValueError):
        chronological_split(features, eval_days=10)
