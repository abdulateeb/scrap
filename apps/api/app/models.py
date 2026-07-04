"""Request and response shapes.

Field names go out in camelCase so the TypeScript side can consume them without
a mapping layer. Keep this file in step with apps/web/lib/types.ts.

Nothing is stored. One upload produces one result, the result is returned in the
response, and the service keeps no copy of it.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FrameStatus = Literal["done", "failed"]
SourceKind = Literal["image", "video", "capture"]


def _camel(value: str) -> str:
    head, *rest = value.split("_")
    return head + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class Box(ApiModel):
    """Normalised to 0 to 1 with the origin at the top left of the frame."""

    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width: float = Field(gt=0.0, le=1.0)
    height: float = Field(gt=0.0, le=1.0)


class Detection(ApiModel):
    material: str
    confidence: float = Field(ge=0.0, le=1.0)
    box: Box | None = None
    note: str | None = None


class Frame(ApiModel):
    index: int
    timestamp_seconds: float | None = None
    # The frame itself, as a data URL. Nothing is written to disk, so there is
    # no second request to fetch it and nothing to clean up afterwards.
    image: str
    status: FrameStatus
    detections: list[Detection] = Field(default_factory=list)
    error: str | None = None


class CompositionShare(ApiModel):
    material: str
    count: int
    share: float
    mean_confidence: float


class Composition(ApiModel):
    total_detections: int
    frames_used: int
    frames_excluded: int
    shares: list[CompositionShare]


class Result(ApiModel):
    source_kind: SourceKind
    source_name: str
    model: str
    frame_count: int
    detection_count: int
    duration_ms: int
    error: str | None = None
    frames: list[Frame] = Field(default_factory=list)
    composition: Composition | None = None


class Health(ApiModel):
    status: str
    model: str
    model_configured: bool


class ClassifiedItem(ApiModel):
    """One item as the model returned it, before it becomes a Detection."""

    material: str
    confidence: float
    box: Box | None = None
    note: str | None = None
