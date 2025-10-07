from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Sequence

from pydantic import ValidationError

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency
    OpenAI = None  # type: ignore[assignment]

from ..core.config import get_settings
from ..schemas import (
    AnalyticsSummary,
    Recommendation,
    RecommendationContent,
    RecommendationImpact,
    RecommendationLocalizedText,
)

logger = logging.getLogger("energy_insight.ai")
SETTINGS = get_settings()

_openai_client: object | None = None
_client_status_logged = False
SYSTEM_PROMPT = """
You are Energy Insight's virtual energy manager. Use the provided analytics summary and insights to craft actionable,
data-backed recommendations. Always produce exactly three entries with the categories cost_saving, co2_reduction, and
efficiency. Respond ONLY with valid JSON matching this schema:
{"recommendations":[{"category":"cost_saving"|"co2_reduction"|"efficiency","impact":{"value":string,"period":string},"content":{"en":{"title":string,"impact":string,"tips":[string,string,string]},"fr":{"title":string,"impact":string,"tips":[string,string,string]}}}]}
Set the top-level "tips" array for each recommendation to the same English tips included in content.en.tips.
Impact.value must include the numeric value with unit (for example "€300" or "5 kg CO₂") and impact.period must be a
simple identifier such as "per_month", "per_year", or "per_day". Each tips array must contain exactly three concise
items (<= 120 characters), specific to the supplied data, grounded in the supplied data, and free of Markdown or
numbering. Do not add explanatory text outside the JSON. Every string value must fit on a single line without literal
newline characters; escape any internal double quotes with \".
""".strip()


RECOMMENDATION_FUNCTION = {
    "name": "provide_recommendations",
    "description": "Return exactly three recommendations tailored to the energy analytics summary",
    "parameters": {
        "type": "object",
        "properties": {
            "recommendations": {
                "type": "array",
                "minItems": 3,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "enum": ["cost_saving", "co2_reduction", "efficiency"],
                        },
                        "impact": {
                            "type": "object",
                            "properties": {
                                "value": {"type": "string"},
                                "period": {"type": "string"},
                            },
                            "required": ["value", "period"],
                        },
                        "tips": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 3,
                            "maxItems": 3,
                        },
                        "content": {
                            "type": "object",
                            "properties": {
                                "en": {
                                    "type": "object",
                                    "properties": {
                                        "title": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "tips": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "minItems": 3,
                                            "maxItems": 3,
                                        },
                                    },
                                    "required": ["title", "impact", "tips"],
                                },
                                "fr": {
                                    "type": "object",
                                    "properties": {
                                        "title": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "tips": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "minItems": 3,
                                            "maxItems": 3,
                                        },
                                    },
                                    "required": ["title", "impact", "tips"],
                                },
                            },
                            "required": ["en", "fr"],
                        },
                    },
                    "required": ["category", "impact", "tips", "content"],
                },
            }
        },
        "required": ["recommendations"],
    },
}


def _format_currency(value: float | None) -> str:
    if value is None or value <= 0:
        return "€0"
    if value >= 100:
        return f"€{value:.0f}"
    return f"€{value:.2f}"


def _safe_float(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace("€", "").replace(",", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _iso_date_label(date_str: str | None) -> str:
    if not date_str:
        return "votre periode"
    try:
        return datetime.fromisoformat(date_str).strftime("%Y-%m-%d")
    except ValueError:
        return date_str


def _build_recommendation(
    *,
    category: str,
    impact_value: str,
    impact_period: str,
    title_en: str,
    impact_text_en: str,
    tips_en: Sequence[str],
    title_fr: str,
    impact_text_fr: str,
    tips_fr: Sequence[str],
) -> Recommendation:
    tips_en_list = list(tips_en)
    tips_fr_list = list(tips_fr)
    return Recommendation(
        category=category,
        impact=RecommendationImpact(value=impact_value, period=impact_period),
        tips=tips_en_list,
        content=RecommendationContent(
            en=RecommendationLocalizedText(
                title=title_en,
                impact=impact_text_en,
                tips=tips_en_list,
            ),
            fr=RecommendationLocalizedText(
                title=title_fr,
                impact=impact_text_fr,
                tips=tips_fr_list,
            ),
        ),
    )


def _fallback_cost_recommendation(summary: AnalyticsSummary) -> Recommendation:
    insights = summary.insights
    top_day = insights.top_expensive_days[0] if insights and insights.top_expensive_days else None
    second_day = insights.top_expensive_days[1] if insights and len(insights.top_expensive_days) > 1 else None
    low_day = insights.top_expensive_days[-1] if insights and insights.top_expensive_days else None
    high_cost = top_day.cost if top_day else _safe_float(_stat_value(summary, "total cost")) or 0.0
    total_cost = _safe_float(_stat_value(summary, "total cost")) or high_cost
    avg_daily_cost = (total_cost / insights.days_covered) if insights and insights.days_covered else total_cost
    delta_cost = max(high_cost - avg_daily_cost, 0.0)
    day_label = _iso_date_label(top_day.date if top_day else None)
    next_label = _iso_date_label(second_day.date) if second_day else day_label
    low_label = _iso_date_label(low_day.date) if low_day else day_label
    impact_value = _format_currency(high_cost)
    avg_cost_value = _format_currency(avg_daily_cost)
    delta_value = _format_currency(delta_cost)
    tips_en = [
        f"Check which circuits pushed {day_label} to {impact_value}.",
        f"Target {low_label} habits so days track closer to {avg_cost_value}.",
        f"Shift wash and heat runs off {next_label} evenings to trim peaks.",
    ]
    tips_fr = [
        f"Reperez les postes qui montent {day_label} a {impact_value}.",
        f"Reproduisez les habitudes de {low_label} pour viser {avg_cost_value}.",
        f"Planifiez lavage ou chauffage hors des soirees du {next_label}.",
    ]
    return _build_recommendation(
        category="cost_saving",
        impact_value=impact_value,
        impact_period="per_day",
        title_en=f"Reduce {day_label} spend",
        impact_text_en=f"Moving peak loads trims about {delta_value} versus the average {avg_cost_value} day.",
        tips_en=tips_en,
        title_fr=f"Calmer le cout du {day_label}",
        impact_text_fr=f"Reporter les pics fait gagner env. {delta_value} face a la moyenne {avg_cost_value}.",
        tips_fr=tips_fr,
    )


def _fallback_co2_recommendation(summary: AnalyticsSummary) -> Recommendation:
    insights = summary.insights
    co2_total = _safe_float(_stat_value(summary, "co2 emission")) or 0.0
    days = insights.days_covered if insights and insights.days_covered else 30
    daily_co2 = co2_total / days if days else co2_total
    weekend_vs_weekday = insights.weekend_vs_weekday if insights else None
    weekend_label = "weekends"
    weekday_label = "weekdays"
    if weekend_vs_weekday:
        weekend_label = f"weekends ({weekend_vs_weekday.weekend_avg_cost_per_kwh:.2f} €/kWh)"
        weekday_label = f"weekdays ({weekend_vs_weekday.weekday_avg_cost_per_kwh:.2f} €/kWh)"
    impact_value = f"{daily_co2:.1f} kg CO2"
    tips_en = [
        f"Keep efficient devices on during {weekend_label} when demand spikes.",
        f"Dial HVAC by 1°C on {weekday_label} evenings to curb base load.",
        "Disconnect chargers and media boxes overnight to stop idle draw.",
    ]
    tips_fr = [
        f"Gardez les appareils sobres actifs le {weekend_label} quand la demande monte.",
        f"Adaptez chauffage ou climatisation de 1°C les soirs de {weekday_label}.",
        "Debranchez chargeurs et box la nuit pour couper la veille.",
    ]
    return _build_recommendation(
        category="co2_reduction",
        impact_value=impact_value,
        impact_period="per_day",
        title_en="Lower daily CO2",
        impact_text_en=f"Trimming idle loads keeps emissions near {impact_value} per day.",
        tips_en=tips_en,
        title_fr="Reduire le CO2 quotidien",
        impact_text_fr=f"Limiter les usages passifs fixe l'empreinte autour de {impact_value} par jour.",
        tips_fr=tips_fr,
    )


def _fallback_efficiency_recommendation(summary: AnalyticsSummary) -> Recommendation:
    insights = summary.insights
    if insights and insights.peak_window:
        window = insights.peak_window
        start_hour = window.start_hour
        end_hour = window.end_hour
        avg_kwh = window.avg_kwh_per_day
        window_label = f"{start_hour:02d}:00-{end_hour:02d}:00"
    else:
        avg_kwh = _safe_float(_stat_value(summary, "peak usage day")) or 0.0
        window_label = "les heures de pointe"
    impact_value = f"{avg_kwh:.1f} kWh"
    usage_points = summary.usage[:3]
    sample_dates = ", ".join(point.date for point in usage_points) if usage_points else "recent days"
    days_text = f"{summary.usage[0].date} -> {summary.usage[-1].date}" if summary.usage else "votre periode"
    tips_en = [
        f"Stagger high loads outside {window_label} to smooth demand.",
        f"Sequence appliances so {sample_dates} do not overlap cycles.",
        f"Review {days_text} usage to find low-load slots for chores.",
    ]
    tips_fr = [
        f"Echelonnez les fortes charges hors {window_label} pour lisser la demande.",
        f"Ordonnez les appareils pour que {sample_dates} ne se chevauchent pas.",
        f"Analysez {days_text} pour caler les taches sur des creux.",
    ]
    return _build_recommendation(
        category="efficiency",
        impact_value=impact_value,
        impact_period="per_day",
        title_en="Smooth the load curve",
        impact_text_en=f"Balancing demand keeps daily peaks close to {impact_value}.",
        tips_en=tips_en,
        title_fr="Lissee la charge",
        impact_text_fr=f"Equilibrer la demande maintient les pics autour de {impact_value}.",
        tips_fr=tips_fr,
    )


def _build_fallback_recommendations(summary: AnalyticsSummary) -> List[Recommendation]:
    fallbacks = [
        _fallback_cost_recommendation(summary),
        _fallback_co2_recommendation(summary),
        _fallback_efficiency_recommendation(summary),
    ]
    return fallbacks


def _ensure_required_recommendations(
    recommendations: List[Recommendation], summary: AnalyticsSummary
) -> List[Recommendation]:
    required = ("cost_saving", "co2_reduction", "efficiency")
    result = list(recommendations)
    existing = {rec.category for rec in result}
    for category in required:
        if category not in existing:
            fallback = _fallback_for_category(category, summary)
            if fallback:
                result.append(fallback)
                existing.add(category)
    for category in required:
        if len(result) >= 3:
            break
        if category not in existing:
            fallback = _fallback_for_category(category, summary)
            if fallback:
                result.append(fallback)
                existing.add(category)
    return result


def _fallback_for_category(category: str, summary: AnalyticsSummary) -> Recommendation | None:
    if category == "cost_saving":
        return _fallback_cost_recommendation(summary)
    if category == "co2_reduction":
        return _fallback_co2_recommendation(summary)
    if category == "efficiency":
        return _fallback_efficiency_recommendation(summary)
    return None


def _stat_value(summary: AnalyticsSummary, keyword: str) -> object | None:
    keyword_lower = keyword.lower()
    for stat in summary.stats:
        if stat.title.lower() == keyword_lower:
            return stat.value
    return None


def _sanitize_json_like(payload: str) -> str:
    result: list[str] = []
    in_string = False
    escaped = False
    for ch in payload:
        if in_string:
            if escaped:
                result.append(ch)
                escaped = False
                continue
            if ch == "\\":
                result.append(ch)
                escaped = True
                continue
            if ch == "\"":
                in_string = False
                result.append(ch)
                continue
            if ch in ("\n", "\r"):
                result.append(" ")
                continue
            result.append(ch)
        else:
            if ch == "\"":
                in_string = True
            result.append(ch)
    return "".join(result)


async def apply_ai_recommendations(summary: AnalyticsSummary) -> AnalyticsSummary:
    recommendations = await _request_ai_recommendations(summary)
    if recommendations:
        return summary.model_copy(update={"recommendations": recommendations})
    return summary.model_copy(update={"recommendations": []})


def _get_openai_client() -> object | None:
    global _openai_client, _client_status_logged
    if OpenAI is None:
        if not _client_status_logged:
            logger.warning("openai package is not installed; AI recommendations disabled.")
            _client_status_logged = True
        return None
    if not os.getenv("OPENAI_API_KEY"):
        if not _client_status_logged:
            logger.info("OPENAI_API_KEY not set; returning empty recommendations.")
            _client_status_logged = True
        return None
    if _openai_client is None:
        _openai_client = OpenAI()
        logger.info("OpenAI client initialized for model '%s'.", SETTINGS.openai_model)
    return _openai_client


def _build_recommendation_prompt(summary: AnalyticsSummary) -> str:
    payload = summary.model_dump()
    return (
        "Analytics summary JSON (including insights):\n"
        f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n"
        "Use these metrics to tailor cost saving, CO₂ reduction, and efficiency advice in both English and French."
    )


def _normalize_recommendations(
    data: Dict[str, Any], summary: AnalyticsSummary
) -> List[Recommendation] | None:
    recommendations = data.get("recommendations")
    if not isinstance(recommendations, list):
        logger.warning("OpenAI JSON payload missing 'recommendations' array.")
        return _build_fallback_recommendations(summary)

    validated: List[Recommendation] = []
    for item in recommendations:
        if not isinstance(item, dict):
            continue
        if "impact" not in item or not isinstance(item["impact"], dict):
            item["impact"] = {"value": "", "period": ""}
        content = item.get("content")
        if isinstance(content, dict) and "en" in content:
            tips_fallback = content["en"].get("tips") if isinstance(content["en"], dict) else []
            item.setdefault("tips", tips_fallback or [])
        try:
            validated.append(Recommendation.model_validate(item))
        except ValidationError as exc:
            logger.warning("Skipping invalid recommendation entry %s: %s", item, exc)

    if not validated:
        return _build_fallback_recommendations(summary)

    normalized = _ensure_required_recommendations(validated, summary)
    order = {"cost_saving": 0, "co2_reduction": 1, "efficiency": 2}
    normalized.sort(key=lambda rec: order.get(rec.category, 99))
    return normalized[:3]


def _parse_recommendation_payload(
    content: str, summary: AnalyticsSummary
) -> List[Recommendation] | None:
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        try:
            data = json.loads(content, strict=False)
        except json.JSONDecodeError:
            sanitized = _sanitize_json_like(content)
            try:
                data = json.loads(sanitized)
            except json.JSONDecodeError:
                snippet = content[:500].replace("\n", "\\n")
                logger.warning("Failed to decode OpenAI recommendation payload. Sample: %s", snippet)
                return _build_fallback_recommendations(summary)
    if not isinstance(data, dict):
        logger.warning("OpenAI payload is not a JSON object.")
        return _build_fallback_recommendations(summary)

    return _normalize_recommendations(data, summary)


async def _request_ai_recommendations(summary: AnalyticsSummary) -> List[Recommendation] | None:
    client = _get_openai_client()
    if client is None:
        return None

    user_prompt = _build_recommendation_prompt(summary)

    def _invoke():
        return client.chat.completions.create(
            model=SETTINGS.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            functions=[RECOMMENDATION_FUNCTION],
            function_call={"name": "provide_recommendations"},
            temperature=0.2,
            max_tokens=700,
        )

    try:
        completion = await asyncio.to_thread(_invoke)
    except Exception:
        logger.exception("OpenAI recommendation request failed.")
        return None

    if not completion.choices:
        logger.warning("OpenAI recommendation response contained no choices.")
        return _build_fallback_recommendations(summary)

    message = completion.choices[0].message
    func_call = getattr(message, "function_call", None)
    if not func_call or not getattr(func_call, "arguments", None):
        content = getattr(message, "content", None)
        if not content:
            logger.warning("OpenAI recommendation response missing function call arguments and content.")
            return _build_fallback_recommendations(summary)
        return _parse_recommendation_payload(content, summary)

    try:
        payload = json.loads(func_call.arguments)
    except json.JSONDecodeError:
        logger.warning("Failed to parse function call arguments for recommendations.")
        return _build_fallback_recommendations(summary)

    if not isinstance(payload, dict):
        logger.warning("Function call arguments not a JSON object.")
        return _build_fallback_recommendations(summary)

    return _normalize_recommendations(payload, summary)
