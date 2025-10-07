from __future__ import annotations

from typing import Any, List, Literal

from pydantic import BaseModel, Field


class StatCard(BaseModel):
    title: str
    value: float | str
    unit: str
    change: str
    change_type: Literal["increase", "decrease", "neutral"]
    trend: str


class UsagePoint(BaseModel):
    date: str = Field(..., description="ISO date string")
    kwh: float


class CostSegment(BaseModel):
    segment: str
    value: float


class SummaryBadge(BaseModel):
    label: str
    value: str


class RecommendationImpact(BaseModel):
    value: str
    period: str


class RecommendationLocalizedText(BaseModel):
    title: str
    impact: str
    tips: List[str]


class RecommendationContent(BaseModel):
    en: RecommendationLocalizedText
    fr: RecommendationLocalizedText


class Recommendation(BaseModel):
    category: str
    impact: RecommendationImpact
    tips: List[str] = []
    meta: dict[str, Any] | None = None
    content: RecommendationContent | None = None


class DailyCostSnapshot(BaseModel):
    date: str
    kwh: float
    cost: float


class WeekendWeekdayComparison(BaseModel):
    weekend_avg_cost_per_kwh: float
    weekday_avg_cost_per_kwh: float
    weekend_avg_daily_cost: float
    weekday_avg_daily_cost: float
    weekend_days: int
    weekday_days: int


class QuarterUsageComparison(BaseModel):
    start_label: str
    start_kwh: float
    end_label: str
    end_kwh: float
    delta_kwh: float
    delta_percent: float | None = None


class PeakWindow(BaseModel):
    start_hour: int
    end_hour: int
    avg_kwh_per_day: float


class SummaryInsights(BaseModel):
    peak_day: DailyCostSnapshot
    weekend_vs_weekday: WeekendWeekdayComparison | None = None
    top_expensive_days: List[DailyCostSnapshot]
    quarter_usage: QuarterUsageComparison | None = None
    peak_window: PeakWindow | None = None
    average_cost_per_kwh: float
    shift_kwh: float
    days_covered: int
    co2_factor: float


class AnalyticsSummary(BaseModel):
    stats: List[StatCard]
    usage: List[UsagePoint]
    cost_breakdown: List[CostSegment]
    badges: List[SummaryBadge]
    recommendations: List[Recommendation]
    insights: SummaryInsights | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str


class DatasetRecord(BaseModel):
    id: int
    original_filename: str
    uploaded_at: str
    total_kwh: float
    total_cost: float
    total_co2: float
    row_count: int


class ReadingRecord(BaseModel):
    reading_date: str
    reading_time: str | None = None
    reading_at: str | None = None
    kwh: float
    cost: float


class DatasetRecord(BaseModel):
    id: int
    original_filename: str
    uploaded_at: str
    total_kwh: float
    total_cost: float
    total_co2: float
    row_count: int


class DatasetDetail(BaseModel):
    dataset: DatasetRecord
    summary: AnalyticsSummary
    readings: List[ReadingRecord]


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    prompt: str
    context: List[ChatHistoryMessage] | None = None


class ChatResponsePayload(BaseModel):
    id: str
    role: Literal["assistant"] = "assistant"
    content: str

    # Optional debug metadata for clients that want it
    analysis: str | None = None
    sql: str | None = None
