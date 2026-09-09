"""The one route that does the work.

Open access, no token, nothing stored. An upload goes in, a classified result
comes back, and the service forgets it.

The one header this route reads is a model API key the browser may have saved.
It is not authentication and it guards nothing here. It is the caller saying
which key to spend on their own request, and like the upload it is used for that
request and then dropped.
"""

from __future__ import annotations

import logging

from fastapi import (
    APIRouter,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
    status,
)

from app.config import settings
from app.media import IMAGE_TYPES, MediaUnreadable, UnsupportedMedia, VIDEO_TYPES
from app.models import Result
from app.pipeline import classify

logger = logging.getLogger(__name__)
router = APIRouter(tags=["classify"])

ACCEPTED = IMAGE_TYPES | VIDEO_TYPES
SOURCE_KINDS = {"image", "video", "capture"}


@router.post("/classify", response_model=Result)
async def classify_upload(
    file: UploadFile = File(...),
    source_kind: str = Form("image"),
    max_frames: int | None = Form(None),
    thorough: bool | None = Form(None),
    x_scrap_api_key: str | None = Header(default=None, alias="X-Scrap-Api-Key"),
) -> Result:
    content_type = (file.content_type or "").lower()
    if content_type not in ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a JPEG, PNG or WebP image, or an MP4, MOV or MKV video.",
        )

    payload = await file.read()
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )
    if len(payload) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                "The uploaded file is larger than the "
                f"{settings.max_upload_bytes // (1024 * 1024)} MB limit."
            ),
        )

    wanted = max_frames or settings.default_video_frames
    wanted = max(1, min(wanted, settings.max_video_frames))

    kind = source_kind if source_kind in SOURCE_KINDS else "image"

    # Tiling costs five model calls instead of one. An upload is worth that. A
    # live capture is not, by default, because the camera is scanning repeatedly
    # and cadence matters more there than squeezing every small item out of one
    # frame. The caller can ask for either explicitly.
    tile = thorough if thorough is not None else kind != "capture"

    try:
        return await classify(
            upload=payload,
            content_type=content_type,
            source_kind=kind,
            source_name=file.filename or "upload",
            max_frames=wanted,
            tile=tile,
            api_key=x_scrap_api_key,
        )
    except (UnsupportedMedia, MediaUnreadable) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)
        ) from error
