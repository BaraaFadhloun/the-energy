from __future__ import annotations

import json
from datetime import datetime, timezone
from hashlib import sha256
from typing import Iterable, List

from postgrest import APIError
from supabase import Client, create_client

from ..core.config import get_settings
from ..schemas import (
    AnalyticsSummary,
    DatasetDetail,
    DatasetRecord,
    ReadingRecord,
)
from .analytics import EnergyReading

SETTINGS = get_settings()
_client: Client | None = None


class SupabaseConfigurationError(RuntimeError):
    """Raised when Supabase credentials are missing."""


class SupabaseStorageError(RuntimeError):
    """Raised when Supabase operations fail."""


def _require_credentials() -> tuple[str, str]:
    if not SETTINGS.supabase_url:
        raise SupabaseConfigurationError("SUPABASE_URL environment variable is not set.")
    if not SETTINGS.supabase_key:
        raise SupabaseConfigurationError(
            "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable is not set."
        )
    return SETTINGS.supabase_url, SETTINGS.supabase_key


def _get_client() -> Client:
    global _client
    if _client is None:
        url, key = _require_credentials()
        _client = create_client(url, key)
    return _client


def get_supabase_client() -> Client:
    """Return a cached Supabase client instance for reuse across services."""
    return _get_client()


def _compute_fingerprint(readings: List[EnergyReading]) -> str:
    payload = [
        (
            reading.reading_at.isoformat(),
            round(reading.kwh, 6),
            round(float(reading.cost or 0.0), 6),
        )
        for reading in readings
    ]
    serialized = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    return sha256(serialized.encode("utf-8")).hexdigest()


def store_dataset(
    original_filename: str,
    readings: Iterable[EnergyReading],
    summary: AnalyticsSummary,
    user_id: str,
) -> None:
    client = _get_client()
    readings_list = list(readings)
    uploaded_at = datetime.now(timezone.utc).isoformat()

    total_kwh = sum(r.kwh for r in readings_list)
    total_cost = sum((r.cost or 0.0) for r in readings_list)
    total_co2 = total_kwh * SETTINGS.co2_factor

    fingerprint = _compute_fingerprint(readings_list)
    summary_payload = summary.model_dump(mode="json")

    try:
        duplicate_check = (
            client.table(SETTINGS.supabase_dataset_table)
            .select("id")
            .eq("fingerprint", fingerprint)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        raise SupabaseStorageError(
            "Failed to check existing datasets: "
            f"{exc.message}. Ensure the 'fingerprint' column exists on {SETTINGS.supabase_dataset_table}."
        ) from exc

    if duplicate_check.data:
        raise SupabaseStorageError("duplicate-dataset")

    dataset_payload = {
        "original_filename": original_filename,
        "uploaded_at": uploaded_at,
        "total_kwh": total_kwh,
        "total_cost": total_cost,
        "total_co2": total_co2,
        "row_count": len(readings_list),
        "summary_json": summary_payload,
        "fingerprint": fingerprint,
        "user_id": user_id,
    }

    try:
        insert_response = client.table(SETTINGS.supabase_dataset_table).insert(dataset_payload).execute()
    except APIError as exc:
        raise SupabaseStorageError(f"Failed to store dataset metadata: {exc.message}") from exc

    inserted_rows: List[dict] = insert_response.data or []
    dataset_id = inserted_rows[0].get("id") if inserted_rows else None
    if dataset_id is None:
        raise SupabaseStorageError("Supabase did not return an inserted dataset id.")

    if readings_list:
        readings_payload = [
            {
                "dataset_id": dataset_id,
                "reading_date": reading.reading_date.isoformat(),
                "reading_at": reading.reading_at.isoformat(),
                "reading_time": reading.reading_time.isoformat(timespec="seconds"),
                "kwh": reading.kwh,
                "cost": float(reading.cost or 0.0),
                "user_id": user_id,
            }
            for reading in readings_list
        ]
        try:
            client.table(SETTINGS.supabase_readings_table).insert(readings_payload).execute()
        except APIError as exc:
            raise SupabaseStorageError(f"Failed to store dataset readings: {exc.message}") from exc


def fetch_latest_summary(user_id: str) -> AnalyticsSummary | None:
    client = _get_client()

    try:
        response = (
            client.table(SETTINGS.supabase_dataset_table)
            .select("summary_json")
            .eq("user_id", user_id)
            .order("uploaded_at", desc=True)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        raise SupabaseStorageError(f"Failed to fetch latest summary: {exc.message}") from exc

    rows = response.data or []
    if not rows:
        return None

    payload = rows[0].get("summary_json")
    if not payload:
        return None

    return AnalyticsSummary.model_validate(payload)


def fetch_dataset_history(limit: int, user_id: str) -> List[DatasetRecord]:
    client = _get_client()

    try:
        response = (
            client.table(SETTINGS.supabase_dataset_table)
            .select("id, original_filename, uploaded_at, total_kwh, total_cost, total_co2, row_count")
            .eq("user_id", user_id)
            .order("uploaded_at", desc=True)
            .limit(limit)
            .execute()
        )
    except APIError as exc:
        raise SupabaseStorageError(f"Failed to load dataset history: {exc.message}") from exc

    rows = response.data or []
    return [DatasetRecord.model_validate(row) for row in rows]


def fetch_dataset_detail(dataset_id: int, user_id: str) -> DatasetDetail:
    client = _get_client()

    try:
        dataset_response = (
            client.table(SETTINGS.supabase_dataset_table)
            .select(
                "id, original_filename, uploaded_at, total_kwh, total_cost, total_co2, row_count, summary_json"
            )
            .eq("id", dataset_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        raise SupabaseStorageError(f"Failed to load dataset detail: {exc.message}") from exc

    dataset_rows = dataset_response.data or []
    if not dataset_rows:
        raise SupabaseStorageError("Dataset not found.")

    dataset_row = dataset_rows[0]
    dataset = DatasetRecord.model_validate({
        "id": dataset_row["id"],
        "original_filename": dataset_row["original_filename"],
        "uploaded_at": dataset_row["uploaded_at"],
        "total_kwh": dataset_row["total_kwh"],
        "total_cost": dataset_row["total_cost"],
        "total_co2": dataset_row["total_co2"],
        "row_count": dataset_row["row_count"],
    })

    summary_payload = dataset_row.get("summary_json") or {}
    summary = AnalyticsSummary.model_validate(summary_payload)

    try:
        readings_response = (
            client.table(SETTINGS.supabase_readings_table)
            .select("reading_date, reading_time, reading_at, kwh, cost")
            .eq("dataset_id", dataset_id)
            .eq("user_id", user_id)
            .order("reading_date")
            .execute()
        )
    except APIError as exc:
        raise SupabaseStorageError(f"Failed to load dataset readings: {exc.message}") from exc

    readings = [ReadingRecord.model_validate(row) for row in (readings_response.data or [])]

    return DatasetDetail(dataset=dataset, summary=summary, readings=readings)


def delete_dataset(dataset_id: int, user_id: str) -> None:
    client = _get_client()

    try:
        _ = (
            client.table(SETTINGS.supabase_readings_table)
            .delete()
            .eq("dataset_id", dataset_id)
            .eq("user_id", user_id)
            .execute()
        )
    except APIError as exc:
        raise SupabaseStorageError(f"Failed to delete dataset readings: {exc.message}") from exc

    try:
        response = (
            client.table(SETTINGS.supabase_dataset_table)
            .delete()
            .eq("id", dataset_id)
            .eq("user_id", user_id)
            .execute()
        )
    except APIError as exc:
        raise SupabaseStorageError(f"Failed to delete dataset metadata: {exc.message}") from exc

    if not response.data:
        raise SupabaseStorageError("Dataset not found.")
