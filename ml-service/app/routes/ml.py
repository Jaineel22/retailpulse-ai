from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.config import DEFAULT_HORIZON_DAYS, EVAL_DAYS, MAX_HORIZON_DAYS, MIN_HISTORY_DAYS
from app.models.schemas import AnomalyResponse, ForecastResponse
from app.services import forecasting
from app.services.anomaly_detection import detect_anomalies
from app.services.preprocessing import (
    InsufficientHistoryError,
    build_features,
    fetch_daily_activity,
    fetch_daily_demand,
)

router = APIRouter()


def _insufficient_history_error(exc: InsufficientHistoryError) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={
            "code": "INSUFFICIENT_HISTORY",
            "message": str(exc),
            "minimumDaysRequired": exc.minimum_required,
            "daysAvailable": exc.days_available,
        },
    )


@router.get("/forecast/{product_id}", response_model=ForecastResponse)
def get_forecast(
    product_id: str,
    horizonDays: int = Query(DEFAULT_HORIZON_DAYS, ge=1, le=MAX_HORIZON_DAYS, alias="horizonDays"),
):
    try:
        daily = fetch_daily_demand(product_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_ID", "message": str(exc)}) from exc

    if len(daily) < MIN_HISTORY_DAYS:
        raise _insufficient_history_error(
            InsufficientHistoryError(days_available=len(daily), minimum_required=MIN_HISTORY_DAYS)
        )

    features = build_features(daily)
    # eval_days must leave at least a handful of rows to train on.
    eval_days = EVAL_DAYS
    if len(features) <= eval_days:
        raise _insufficient_history_error(
            InsufficientHistoryError(days_available=len(daily), minimum_required=MIN_HISTORY_DAYS + eval_days)
        )

    result = forecasting.run_forecast(daily, features, horizonDays, eval_days)

    return ForecastResponse(
        productId=product_id,
        horizonDays=horizonDays,
        modelName=result["modelName"],
        historyDays=result["historyDays"],
        forecast=result["forecast"],
        baselineForecast=result["baselineForecast"],
        metrics=result["metrics"],
        modelBeatsBaseline=result["modelBeatsBaseline"],
        generatedAt=result["generatedAt"],
    )


@router.get("/anomalies/{product_id}", response_model=AnomalyResponse)
def get_anomalies(product_id: str):
    try:
        daily = fetch_daily_activity(product_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_ID", "message": str(exc)}) from exc

    if len(daily) < MIN_HISTORY_DAYS:
        raise _insufficient_history_error(
            InsufficientHistoryError(days_available=len(daily), minimum_required=MIN_HISTORY_DAYS)
        )

    anomalies = detect_anomalies(daily)

    return AnomalyResponse(
        productId=product_id,
        historyDays=len(daily),
        generatedAt=datetime.now(timezone.utc),
        anomalies=anomalies,
    )
