"""Scrap API entry point.

    uvicorn main:app --host 0.0.0.0 --port 5000 --reload

The service is open access and stateless. There is no database, no account and
no token. An upload is classified, the result is returned, and nothing is kept.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.llm import warm_up
from app.routes import classify, health

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
)
logger = logging.getLogger("scrap")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "Scrap API ready. Model %s, key %s.",
        settings.model_name,
        "present" if settings.model_configured else "missing",
    )
    # The very first call to the provider pays for the connection setup, and on
    # a cold start that has been slow enough to hit the timeout. Pay it here, in
    # the background, so the first real classification does not.
    asyncio.create_task(warm_up())
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "Classifies waste on the conveyor belt of a material recovery facility."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# The browser reaches this service through a rewrite in the web application, so
# requests normally arrive same origin. This stays as a fallback for the case
# where the two are served from different hosts. There are no credentials on any
# request, so none are allowed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(health.router, prefix="/api")
app.include_router(classify.router, prefix="/api")
