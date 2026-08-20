"""
Unusual retail behavior detection using Isolation Forest.

WHY Isolation Forest: it's an efficient unsupervised approach for flagging
unusual observations when labeled anomaly data is unavailable — which is
always true here, since nobody has hand-labeled "this day was anomalous" in
the historical data. It isolates points via random recursive partitioning;
anomalies need fewer partitions to isolate than normal points, which gives a
usable anomaly score without needing labels or an assumed distribution.

Isolation Forest itself has no idea WHY a point is unusual — it only returns a
score and an inlier/outlier flag. Everything past that (the `reason` text and
`severity`) is deterministic post-processing over the same features, using
fixed, documented thresholds — never a fabricated/LLM-generated explanation.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

RANDOM_STATE = 42
CONTAMINATION = 0.1  # expect roughly 1 in 10 days to be flagged as unusual

# Severity thresholds, based on the demand rolling z-score's magnitude (how
# many standard deviations a day's demand is from its trailing 7-day mean).
# Fixed, documented numbers rather than anything derived from the model output,
# so severity stays easy to explain and audit.
HIGH_SEVERITY_Z = 3.0
MEDIUM_SEVERITY_Z = 2.0

ANOMALY_FEATURE_COLUMNS = ["demand", "inventory_delta", "rolling_z_score"]


def build_anomaly_features(daily: pd.DataFrame) -> pd.DataFrame:
    """
    Adds the feature set Isolation Forest is fit on. rolling_z_score uses
    demand.shift(1) before computing the rolling mean/std, for the same
    no-leakage reason as forecasting's rolling_mean_7: day t's z-score must
    only reflect days strictly before t.
    """
    df = daily.copy().sort_values("date").reset_index(drop=True)
    rolling_mean = df["demand"].shift(1).rolling(window=7, min_periods=7).mean()
    rolling_std = df["demand"].shift(1).rolling(window=7, min_periods=7).std(ddof=0)

    # A zero-std trailing window (e.g. a slow SKU selling exactly 0 units for a
    # week) is a real, if uncommon, case — not just a division-by-zero to hide.
    # Any deviation from a perfectly flat recent window is itself unusual, so it
    # is treated as an extreme (beyond the "high" threshold) rather than silently
    # collapsed to 0.
    flat_window_deviation = np.sign(df["demand"] - rolling_mean) * (HIGH_SEVERITY_Z + 1)
    df["rolling_z_score"] = np.where(
        rolling_std.fillna(0) > 0,
        (df["demand"] - rolling_mean) / rolling_std,
        np.where(rolling_mean.notna() & (df["demand"] != rolling_mean), flat_window_deviation, 0.0),
    )
    # Rows still in the 7-day warm-up have NaN rolling_mean/rolling_std; drop them
    # by checking the pre-fillna rolling_mean column instead of the already-filled score.
    df = df[rolling_mean.notna()].reset_index(drop=True)
    return df


def _classify(row: pd.Series) -> tuple[str, str]:
    """Deterministic reason + severity derived from the same features the model saw."""
    z = row["rolling_z_score"]
    abs_z = abs(z)

    if abs_z >= MEDIUM_SEVERITY_Z:
        severity = "high" if abs_z >= HIGH_SEVERITY_Z else "medium"
        reason = (
            "Sales volume is significantly above the recent 7-day average."
            if z > 0
            else "Sales volume is significantly below the recent 7-day average."
        )
        return reason, severity

    # Flagged by the model but not from a clean sales spike/drop -> attribute to inventory.
    if row["inventory_delta"] < 0 and abs(row["inventory_delta"]) > row["demand"] * 1.5 + 1:
        return "Inventory decreased unusually relative to recent sales activity.", "low"
    if row["inventory_delta"] > 0 and row["demand"] == 0:
        return "Inventory increased unusually with no corresponding sales activity.", "low"

    return "Unusual combination of sales and inventory activity detected.", "low"


def detect_anomalies(daily: pd.DataFrame) -> list[dict]:
    """Returns one dict per flagged day: timestamp, score, reason, severity."""
    features = build_anomaly_features(daily)
    if len(features) == 0:
        return []

    model = IsolationForest(n_estimators=200, contamination=CONTAMINATION, random_state=RANDOM_STATE)
    predictions = model.fit_predict(features[ANOMALY_FEATURE_COLUMNS])
    scores = model.score_samples(features[ANOMALY_FEATURE_COLUMNS])

    results = []
    for i, is_anomaly in enumerate(predictions):
        if is_anomaly != -1:
            continue
        row = features.iloc[i]
        reason, severity = _classify(row)
        results.append(
            {
                "timestamp": row["date"].strftime("%Y-%m-%d"),
                "score": round(float(scores[i]), 4),
                "reason": reason,
                "severity": severity,
            }
        )
    return results
