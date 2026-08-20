import pandas as pd
import pytest

from app.services.anomaly_detection import HIGH_SEVERITY_Z, MEDIUM_SEVERITY_Z, build_anomaly_features, detect_anomalies


def _steady_activity_with_spike(spike_day_index: int, spike_value: float, days: int = 40) -> pd.DataFrame:
    dates = pd.date_range("2026-01-01", periods=days, freq="D")
    demand = [20.0 + (i % 3) for i in range(days)]  # tiny, low-variance pattern
    demand[spike_day_index] = spike_value
    inventory_delta = [-d for d in demand]  # every day is a pure sale, no restocks
    return pd.DataFrame({"date": dates, "demand": demand, "inventory_delta": inventory_delta})


def test_build_anomaly_features_output_shape():
    daily = _steady_activity_with_spike(spike_day_index=20, spike_value=20.0)  # no real spike here
    features = build_anomaly_features(daily)

    assert len(features) == len(daily) - 7  # 7-day warm-up dropped
    for col in ["demand", "inventory_delta", "rolling_z_score"]:
        assert col in features.columns
    assert not features["rolling_z_score"].isna().any()


def test_detect_anomalies_flags_an_injected_sales_spike_as_high_severity():
    daily = _steady_activity_with_spike(spike_day_index=25, spike_value=200.0)

    anomalies = detect_anomalies(daily)
    spike_date = daily.iloc[25]["date"].strftime("%Y-%m-%d")

    matching = [a for a in anomalies if a["timestamp"] == spike_date]
    assert len(matching) == 1, "the injected spike day should be flagged as an anomaly"
    assert matching[0]["severity"] == "high"
    assert "above" in matching[0]["reason"].lower()


def test_detect_anomalies_flags_an_injected_sales_drop():
    daily = _steady_activity_with_spike(spike_day_index=25, spike_value=0.0)
    # Make the drop unambiguous relative to the steady ~20-21 baseline.
    daily.loc[10:24, "demand"] = 20.0
    daily.loc[10:24, "inventory_delta"] = -20.0

    anomalies = detect_anomalies(daily)
    drop_date = daily.iloc[25]["date"].strftime("%Y-%m-%d")

    matching = [a for a in anomalies if a["timestamp"] == drop_date]
    assert len(matching) == 1
    assert matching[0]["severity"] in ("medium", "high")
    assert "below" in matching[0]["reason"].lower()


def test_anomaly_output_schema_and_severity_values():
    daily = _steady_activity_with_spike(spike_day_index=30, spike_value=150.0)

    anomalies = detect_anomalies(daily)

    assert len(anomalies) > 0
    for a in anomalies:
        assert set(a.keys()) == {"timestamp", "score", "reason", "severity"}
        assert a["severity"] in ("low", "medium", "high")
        assert isinstance(a["reason"], str) and len(a["reason"]) > 0


def test_detect_anomalies_returns_empty_list_when_no_features_available():
    empty = pd.DataFrame(columns=["date", "demand", "inventory_delta"])
    assert detect_anomalies(empty) == []


def test_severity_threshold_constants_are_ordered():
    # Sanity check on the documented thresholds themselves: high must require a
    # larger deviation than medium, otherwise the severity logic is inverted.
    assert HIGH_SEVERITY_Z > MEDIUM_SEVERITY_Z
