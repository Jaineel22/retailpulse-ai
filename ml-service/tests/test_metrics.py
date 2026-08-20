import numpy as np
import pytest

from app.utils.metrics import mae, rmse


def test_mae_perfect_predictions_is_zero():
    y = np.array([1, 2, 3, 4])
    assert mae(y, y) == 0.0


def test_mae_known_value():
    y_true = np.array([10, 20, 30])
    y_pred = np.array([12, 18, 33])
    # |10-12| + |20-18| + |30-33| = 2 + 2 + 3 = 7 / 3
    assert mae(y_true, y_pred) == pytest.approx(7 / 3)


def test_rmse_perfect_predictions_is_zero():
    y = np.array([5, 6, 7])
    assert rmse(y, y) == 0.0


def test_rmse_known_value():
    y_true = np.array([0, 0, 0])
    y_pred = np.array([3, 4, 0])
    # sqrt((9 + 16 + 0) / 3) = sqrt(25/3)
    assert rmse(y_true, y_pred) == pytest.approx(np.sqrt(25 / 3))


def test_rmse_penalizes_large_errors_more_than_mae():
    y_true = np.array([0, 0, 0, 0])
    y_pred = np.array([1, 1, 1, 10])
    assert rmse(y_true, y_pred) > mae(y_true, y_pred)
