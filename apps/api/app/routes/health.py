"""Health route. Reports whether a model key is present."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.models import Health

router = APIRouter(tags=["health"])


@router.get("/health", response_model=Health)
async def health() -> Health:
    return Health(
        status="ok",
        model=settings.model_name,
        model_configured=settings.model_configured,
    )
