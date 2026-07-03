"""Runtime configuration for the Scrap API.

Nothing here raises when a value is missing. The service starts even without a
model key, reports that plainly on /api/health, and refuses only the requests
that actually need the missing piece.

There is no database and no authentication. The application is open access.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ------------------------------------------------------------- service
    app_name: str = "Scrap API"
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")

    # --------------------------------------------------------------- model
    # Every call goes through LiteLLM, so the provider is a string in the
    # environment and never a code change.
    model_name: str = Field(
        default="gemini/gemini-3.5-flash-lite", alias="SCRAP_MODEL"
    )
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    model_timeout_seconds: int = Field(default=60)
    model_max_retries: int = Field(default=2)
    model_concurrency: int = Field(default=4)

    # Cutting a frame into tiles and classifying each one finds the small items
    # a single whole frame pass misses. 2 means a 2 by 2 grid plus the whole
    # frame, so five passes. Set to 1 to switch tiling off.
    tile_grid: int = Field(default=2, alias="SCRAP_TILE_GRID")

    # How often the live camera mode sends a frame to the model. A model call
    # takes seconds, so this is a scan cadence and not a frame rate.
    live_interval_seconds: int = Field(default=4, alias="SCRAP_LIVE_INTERVAL")

    # ---------------------------------------------------------------- media
    max_upload_bytes: int = Field(default=200 * 1024 * 1024)
    default_video_frames: int = Field(default=8)
    max_video_frames: int = Field(default=20)
    frame_max_edge: int = Field(default=1400)
    jpeg_quality: int = Field(default=88)

    @property
    def model_configured(self) -> bool:
        return bool(self.gemini_api_key.strip())



@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
