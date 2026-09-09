"""Health route. Reports whether a model key is present.

A key saved in the browser counts as present, because that is the key the same
browser will send on its next classification. Reporting only the environment key
would tell somebody who has just pasted their own key that nothing is set up.
"""

from __future__ import annotations

from fastapi import APIRouter, Header

from app.config import settings
from app.llm import resolve_key
from app.models import Health

router = APIRouter(tags=["health"])


@router.get("/health", response_model=Health)
async def health(
    x_scrap_api_key: str | None = Header(default=None, alias="X-Scrap-Api-Key"),
) -> Health:
    return Health(
        status="ok",
        model=settings.model_name,
        model_configured=bool(resolve_key(x_scrap_api_key)),
    )
