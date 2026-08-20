"""
Pydantic response models for the ML service's API surface.

Field names are camelCase throughout (rather than idiomatic snake_case) on
purpose: this is an internal service whose only client is the Node backend,
and keeping one naming convention across the whole system's JSON avoids a
translation layer at the Node boundary.
"""

from datetime import datetime
from typing import List

from pydantic import BaseModel


class ForecastPoint(BaseModel):
    date: str
    value: float


class MetricPair(BaseModel):
    mae: float
    rmse: float


class ForecastMetrics(BaseModel):
    model: MetricPair
    baseline: MetricPair


class ForecastResponse(BaseModel):
    productId: str
    horizonDays: int
    modelName: str
    historyDays: int
    forecast: List[ForecastPoint]
    baselineForecast: List[ForecastPoint]
    metrics: ForecastMetrics
    modelBeatsBaseline: bool
    generatedAt: datetime


class AnomalyPoint(BaseModel):
    timestamp: str
    score: float
    reason: str
    severity: str


class AnomalyResponse(BaseModel):
    productId: str
    historyDays: int
    generatedAt: datetime
    anomalies: List[AnomalyPoint]


class ErrorDetail(BaseModel):
    code: str
    message: str
    minimumDaysRequired: int | None = None
    daysAvailable: int | None = None
