from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.concurrency import run_in_threadpool

from ..schemas import (
    AnalyticsSummary,
    ChatRequest,
    ChatResponsePayload,
    DatasetDetail,
    DatasetRecord,
    HealthResponse,
)
from ..services.analytics import CSVParseError, build_analytics_summary, parse_energy_csv
from ..services.recommendations import apply_ai_recommendations
from ..services.supabase_storage import (
    SupabaseConfigurationError,
    SupabaseStorageError,
    delete_dataset,
    fetch_dataset_detail,
    fetch_dataset_history,
    fetch_latest_summary,
    store_dataset,
)
from ..services.chat_agent import run_chat_agent
from .deps import AuthenticatedUser, get_current_user

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check() -> HealthResponse:
    return HealthResponse(service="Energy Insight")


@router.post("/api/upload", response_model=AnalyticsSummary, tags=["analytics"], status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AnalyticsSummary:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    try:
        readings = parse_energy_csv(await file.read())
    except CSVParseError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from exc

    summary = build_analytics_summary(readings)
    summary = await apply_ai_recommendations(summary)

    try:
        await run_in_threadpool(
            store_dataset,
            file.filename or "upload.csv",
            readings,
            summary,
            current_user.id,
        )
    except SupabaseStorageError as exc:
        if str(exc) == 'duplicate-dataset':
            raise HTTPException(status_code=409, detail='Identical dataset already stored.') from exc
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return summary


@router.post("/api/chat", response_model=ChatResponsePayload, tags=["analytics"])
async def chat_with_assistant(
    request: ChatRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ChatResponsePayload:
    try:
        result = await run_in_threadpool(
            run_chat_agent,
            request.prompt,
            request.context or [],
            current_user.id,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ChatResponsePayload(
        id=result.get("id", "resp-unknown"),
        content=result.get("content", "I’m unable to respond right now."),
        analysis=result.get("analysis"),
        sql=result.get("sql"),
    )


@router.get("/api/analytics/history", response_model=List[DatasetRecord], tags=["analytics"])
async def analytics_history(
    limit: int = 50,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> List[DatasetRecord]:
    try:
        history = await run_in_threadpool(fetch_dataset_history, limit, current_user.id)
    except (SupabaseConfigurationError, SupabaseStorageError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return history


@router.get("/api/analytics/datasets/{dataset_id}", response_model=DatasetDetail, tags=["analytics"])
async def analytics_dataset(
    dataset_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> DatasetDetail:
    try:
        detail = await run_in_threadpool(fetch_dataset_detail, dataset_id, current_user.id)
    except SupabaseStorageError as exc:
        if "not found" in str(exc).lower():
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return detail


@router.get("/api/analytics/summary", response_model=AnalyticsSummary, tags=["analytics"])
async def analytics_summary(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AnalyticsSummary:
    try:
        summary = await run_in_threadpool(fetch_latest_summary, current_user.id)
    except (SupabaseConfigurationError, SupabaseStorageError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if summary is None:
        raise HTTPException(status_code=404, detail="No analytics available. Upload a dataset first.")
    return summary


@router.delete("/api/analytics/datasets/{dataset_id}", status_code=204, response_class=Response, tags=["analytics"])
async def delete_analytics_dataset(
    dataset_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Response:
    try:
        await run_in_threadpool(delete_dataset, dataset_id, current_user.id)
    except SupabaseStorageError as exc:
        status = 404 if "not found" in str(exc).lower() else 500
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return Response(status_code=204)
