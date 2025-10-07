from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List

from dotenv import load_dotenv

API_TITLE = "Energy Insight API"
API_VERSION = "0.4.0"

DEFAULT_ALLOWED_ORIGINS = ["*"]

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")


def _fetch_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    default_rate: float = _fetch_float("ENERGY_INSIGHT_DEFAULT_RATE", 0.32)
    co2_factor: float = _fetch_float("ENERGY_INSIGHT_CO2_FACTOR", 0.45)
    cost_bucket_percentile: float = _fetch_float("ENERGY_INSIGHT_COST_BUCKET_PERCENTILE", 0.66)
    openai_model: str = os.getenv("OPENAI_RECOMMENDATION_MODEL", "gpt-4o-mini")
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
    supabase_dataset_table: str = os.getenv("SUPABASE_DATASET_TABLE", "energy_datasets")
    supabase_readings_table: str = os.getenv("SUPABASE_READINGS_TABLE", "energy_readings")
    supabase_db_url: str = os.getenv("SUPABASE_DB_URL", "")
    supabase_jwt_secret: str = os.getenv("SUPABASE_JWT_SECRET", "")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def get_allowed_origins() -> List[str]:
    raw = os.getenv("ENERGY_INSIGHT_CORS_ORIGINS")
    if not raw:
        return DEFAULT_ALLOWED_ORIGINS
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or DEFAULT_ALLOWED_ORIGINS
