"""
Shared pytest fixtures.

Deliberately no MongoDB fixture: every service function under test operates on
plain pandas DataFrames (see app/services/preprocessing.py's docstring), so
unit tests build synthetic DataFrames directly instead of needing a database.
"""

import numpy as np
import pandas as pd
import pytest


def _mulberry32(seed: int):
    state = seed

    def rng():
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = ((t ^ (t >> 15)) * (1 | t)) & 0xFFFFFFFF
        t = (t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF)) ^ t
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return rng


def make_daily_series(days: int = 60, base: float = 20.0, trend: float = 0.1, noise: float = 3.0, seed: int = 7) -> pd.DataFrame:
    """Builds a deterministic synthetic daily demand series for tests."""
    rng = _mulberry32(seed)
    start = pd.Timestamp("2026-01-01")
    dates = pd.date_range(start, periods=days, freq="D")
    values = []
    for day in range(days):
        value = base + trend * day + (rng() - 0.5) * 2 * noise
        values.append(max(0.0, round(value, 2)))
    return pd.DataFrame({"date": dates, "demand": values})


@pytest.fixture
def daily_series() -> pd.DataFrame:
    return make_daily_series()


@pytest.fixture
def short_daily_series() -> pd.DataFrame:
    return make_daily_series(days=10)
