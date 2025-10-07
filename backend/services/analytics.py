from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, datetime, time
from typing import Dict, List, Sequence, Tuple

from ..core.config import get_settings
from ..schemas import (
    AnalyticsSummary,
    CostSegment,
    DailyCostSnapshot,
    PeakWindow,
    StatCard,
    SummaryBadge,
    SummaryInsights,
    UsagePoint,
    WeekendWeekdayComparison,
    QuarterUsageComparison,
)

SETTINGS = get_settings()


class CSVParseError(Exception):
    """Raised when an uploaded CSV fails validation."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class EnergyReading:
    __slots__ = ("reading_at", "kwh", "cost")

    def __init__(self, reading_at: datetime, kwh: float, cost: float | None) -> None:
        self.reading_at = reading_at
        self.kwh = kwh
        self.cost = cost

    @property
    def reading_date(self) -> date:
        return self.reading_at.date()

    @property
    def reading_time(self) -> time:
        return self.reading_at.time()


def parse_energy_csv(file_bytes: bytes) -> List[EnergyReading]:
    """Parse UTF-8 CSV content into structured energy readings."""
    try:
        decoded = file_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise CSVParseError("CSV file must be UTF-8 encoded") from exc

    reader = csv.DictReader(io.StringIO(decoded))
    fieldnames = reader.fieldnames or []
    has_datetime = "datetime" in fieldnames
    required_columns = {"kwh"}
    if not has_datetime:
        required_columns.add("date")

    if not fieldnames or not required_columns.issubset(fieldnames):
        missing = ", ".join(sorted(required_columns - set(fieldnames)))
        if missing:
            raise CSVParseError(f"CSV requires columns: {missing}")
        raise CSVParseError("CSV headers missing required columns")

    readings: List[EnergyReading] = []
    for row in reader:
        raw_datetime = (row.get("datetime") or "").strip() if has_datetime else (row.get("date") or "").strip()
        kwh_raw = (row.get("kwh") or "").strip()
        if not raw_datetime or not kwh_raw:
            continue
        try:
            reading_at = _parse_csv_datetime(raw_datetime, row.get("time"))
            kwh_value = float(kwh_raw)
        except ValueError:
            continue

        cost_value: float | None = None
        cost_raw = (row.get("cost") or "").strip()
        if cost_raw:
            try:
                cost_value = float(cost_raw)
            except ValueError:
                cost_value = None

        readings.append(EnergyReading(reading_at, kwh_value, cost_value))

    if not readings:
        raise CSVParseError("No valid rows found in CSV")

    return readings


def _parse_csv_datetime(value: str, time_raw: str | None) -> datetime:
    """Parse datetime or date/time strings from CSV into a datetime object."""
    value = value.strip()
    if not value:
        raise ValueError("empty datetime")

    try:
        # First try to parse as full ISO datetime
        return datetime.fromisoformat(value)
    except ValueError:
        pass

    # Attempt to combine separate date and time columns
    try:
        date_part = date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("invalid date") from exc

    time_part = (time_raw or "").strip() if time_raw is not None else ""
    if not time_part:
        combined = datetime.combine(date_part, time.min)
        return combined

    try:
        parsed_time = time.fromisoformat(time_part)
    except ValueError as exc:
        raise ValueError("invalid time") from exc

    return datetime.combine(date_part, parsed_time)


def build_analytics_summary(readings: List[EnergyReading]) -> AnalyticsSummary:
    """Aggregate analytics metrics from a list of readings."""
    readings.sort(key=lambda r: r.reading_at)
    _compute_costs(readings)

    total_kwh = sum(r.kwh for r in readings)
    total_cost = sum(r.cost or 0.0 for r in readings)
    total_co2 = total_kwh * SETTINGS.co2_factor

    daily_totals = _aggregate_daily_totals(readings)
    usage = [
        UsagePoint(date=day.isoformat(), kwh=round(data["kwh"], 2))
        for day, data in daily_totals
    ]

    peak_day = max(daily_totals, key=lambda item: item[1]["kwh"])

    stats = [
        StatCard(
            title="Total Consumption",
            value=round(total_kwh, 2),
            unit="kWh",
            change="N/A",
            change_type="neutral",
            trend="Based on latest dataset",
        ),
        StatCard(
            title="Total Cost",
            value=round(total_cost, 2),
            unit="",
            change="N/A",
            change_type="neutral",
            trend="Based on latest dataset",
        ),
        StatCard(
            title="CO₂ Emission",
            value=round(total_co2, 2),
            unit="kg",
            change="N/A",
            change_type="neutral",
            trend=f"Factor {SETTINGS.co2_factor:.2f} kg/kWh",
        ),
        StatCard(
            title="Peak Usage Day",
            value=round(peak_day[1]["kwh"], 1),
            unit="kWh",
            change=peak_day[0].isoformat(),
            change_type="neutral",
            trend="Highest daily consumption",
        ),
    ]

    breakdown_totals = _cost_breakdown(readings)
    cost_breakdown = [
        CostSegment(segment=name, value=round(value, 2))
        for name, value in breakdown_totals.items()
    ]

    badges = [
        SummaryBadge(label="Carbon", value=f"{total_co2:.1f} kg CO₂"),
        SummaryBadge(label="Cost", value=f"{total_cost:.2f} €"),
        SummaryBadge(
            label="Window",
            value=f"{daily_totals[0][0].isoformat()} → {daily_totals[-1][0].isoformat()}",
        ),
    ]

    insights = _calculate_insights(readings, daily_totals, total_kwh, total_cost)
    return AnalyticsSummary(
        stats=stats,
        usage=usage,
        cost_breakdown=cost_breakdown,
        badges=badges,
        recommendations=[],
        insights=insights,
    )


def _compute_costs(readings: Sequence[EnergyReading]) -> None:
    provided_costs = [r.cost for r in readings if r.cost is not None]
    if provided_costs:
        kwh_with_cost = sum(r.kwh for r in readings if r.cost is not None)
        rate = (sum(provided_costs) / kwh_with_cost) if kwh_with_cost else SETTINGS.default_rate
        for reading in readings:
            if reading.cost is None:
                reading.cost = reading.kwh * rate
    else:
        for reading in readings:
            reading.cost = reading.kwh * SETTINGS.default_rate


def _cost_breakdown(readings: Sequence[EnergyReading]) -> dict[str, float]:
    buckets: dict[str, float] = defaultdict(float)
    threshold = _kwh_threshold(readings, SETTINGS.cost_bucket_percentile)
    for reading in readings:
        bucket = _bucket_for_reading(reading, threshold)
        buckets[bucket] += reading.cost or 0.0
    return buckets


def _aggregate_daily_totals(readings: Sequence[EnergyReading]) -> List[Tuple[date, Dict[str, float]]]:
    daily: Dict[date, Dict[str, float]] = defaultdict(lambda: {"kwh": 0.0, "cost": 0.0})
    for reading in readings:
        bucket = daily[reading.reading_date]
        bucket["kwh"] += reading.kwh
        bucket["cost"] += reading.cost or 0.0
    ordered = sorted(daily.items(), key=lambda item: item[0])
    return ordered


def _calculate_insights(
    readings: Sequence[EnergyReading],
    daily_totals: List[Tuple[date, Dict[str, float]]],
    total_kwh: float,
    total_cost: float,
) -> SummaryInsights | None:
    if not readings or not daily_totals or total_kwh <= 0:
        return None

    days_covered = len(daily_totals)
    average_cost_per_kwh = total_cost / total_kwh if total_kwh else 0.0

    peak_day_date, peak_day_data = max(daily_totals, key=lambda item: item[1]["kwh"])
    peak_day_snapshot = DailyCostSnapshot(
        date=peak_day_date.isoformat(),
        kwh=round(peak_day_data["kwh"], 2),
        cost=round(peak_day_data["cost"], 2),
    )

    top_expensive = sorted(daily_totals, key=lambda item: item[1]["cost"], reverse=True)[:5]
    top_expensive_snapshots = [
        DailyCostSnapshot(
            date=day.isoformat(),
            kwh=round(data["kwh"], 2),
            cost=round(data["cost"], 2),
        )
        for day, data in top_expensive
    ]

    weekend_vs_weekday = _calculate_weekend_weekday_comparison(daily_totals)
    peak_window = _calculate_peak_window(readings, days_covered)
    quarter_usage = _calculate_quarter_usage(readings)

    return SummaryInsights(
        peak_day=peak_day_snapshot,
        weekend_vs_weekday=weekend_vs_weekday,
        top_expensive_days=top_expensive_snapshots,
        quarter_usage=quarter_usage,
        peak_window=peak_window,
        average_cost_per_kwh=average_cost_per_kwh,
        shift_kwh=5.0,
        days_covered=days_covered,
        co2_factor=SETTINGS.co2_factor,
    )


def _calculate_weekend_weekday_comparison(
    daily_totals: List[Tuple[date, Dict[str, float]]]
) -> WeekendWeekdayComparison | None:
    weekend_entries = [(day, data) for day, data in daily_totals if day.weekday() >= 5]
    weekday_entries = [(day, data) for day, data in daily_totals if day.weekday() < 5]

    if not weekend_entries and not weekday_entries:
        return None

    def _averages(entries: List[Tuple[date, Dict[str, float]]]) -> Tuple[float, float]:
        if not entries:
            return 0.0, 0.0
        total_cost = sum(data["cost"] for _, data in entries)
        total_kwh = sum(data["kwh"] for _, data in entries)
        avg_daily_cost = total_cost / len(entries)
        avg_cost_per_kwh = total_cost / total_kwh if total_kwh else 0.0
        return avg_daily_cost, avg_cost_per_kwh

    weekend_avg_daily, weekend_avg_per_kwh = _averages(weekend_entries)
    weekday_avg_daily, weekday_avg_per_kwh = _averages(weekday_entries)

    return WeekendWeekdayComparison(
        weekend_avg_cost_per_kwh=round(weekend_avg_per_kwh, 2),
        weekday_avg_cost_per_kwh=round(weekday_avg_per_kwh, 2),
        weekend_avg_daily_cost=round(weekend_avg_daily, 2),
        weekday_avg_daily_cost=round(weekday_avg_daily, 2),
        weekend_days=len(weekend_entries),
        weekday_days=len(weekday_entries),
    )


def _calculate_peak_window(readings: Sequence[EnergyReading], days_covered: int) -> PeakWindow | None:
    if not readings or days_covered == 0:
        return None

    hourly_totals: Dict[int, float] = defaultdict(float)
    for reading in readings:
        hourly_totals[reading.reading_at.hour] += reading.kwh

    best_total = -1.0
    best_start = 0
    window_hours = 2
    for start_hour in range(24):
        window_total = 0.0
        for offset in range(window_hours):
            hour = (start_hour + offset) % 24
            window_total += hourly_totals.get(hour, 0.0)
        if window_total > best_total:
            best_total = window_total
            best_start = start_hour

    if best_total <= 0:
        return None

    avg_per_day = best_total / days_covered
    return PeakWindow(
        start_hour=best_start,
        end_hour=(best_start + window_hours) % 24,
        avg_kwh_per_day=round(avg_per_day, 2),
    )


def _calculate_quarter_usage(readings: Sequence[EnergyReading]) -> QuarterUsageComparison | None:
    if not readings:
        return None

    quarter_totals: Dict[Tuple[int, int], float] = defaultdict(float)
    for reading in readings:
        dt = reading.reading_at
        quarter = (dt.month - 1) // 3 + 1
        quarter_totals[(dt.year, quarter)] += reading.kwh

    if len(quarter_totals) < 2:
        return None

    sorted_totals = sorted(quarter_totals.items())
    start_key, start_value = sorted_totals[0]
    end_key, end_value = sorted_totals[-1]
    delta = end_value - start_value
    delta_percent = (delta / start_value * 100) if start_value else None

    return QuarterUsageComparison(
        start_label=f"{start_key[0]}Q{start_key[1]}",
        start_kwh=round(start_value, 2),
        end_label=f"{end_key[0]}Q{end_key[1]}",
        end_kwh=round(end_value, 2),
        delta_kwh=round(delta, 2),
        delta_percent=round(delta_percent, 2) if delta_percent is not None else None,
    )



def _kwh_threshold(readings: Sequence[EnergyReading], percentile: float) -> float:
    if not readings:
        return 0.0
    sorted_kwh = sorted(r.kwh for r in readings)
    index = min(int(len(sorted_kwh) * percentile), len(sorted_kwh) - 1)
    return sorted_kwh[index]


def _bucket_for_reading(reading: EnergyReading, threshold: float) -> str:
    if reading.reading_date.weekday() >= 5:
        return "Weekend"
    if reading.kwh >= threshold:
        return "Peak Hours"
    return "Off-Peak"
