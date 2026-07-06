"""Turning an upload into frames the model can read.

A still image becomes one frame. A video is sampled at an even spacing across
its whole length, so a run describes the belt over time rather than whatever
happened in the first few seconds.

Frames are downscaled before they are sent. A larger image costs more and tells
the model very little extra about what material an item is made of.
"""

from __future__ import annotations

import io
import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

from app.config import settings

logger = logging.getLogger(__name__)

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-matroska"}


class UnsupportedMedia(ValueError):
    """Raised when the upload is neither a supported image nor a video."""


class MediaUnreadable(ValueError):
    """Raised when the file is of a supported type but cannot be decoded."""


@dataclass(frozen=True)
class ExtractedFrame:
    index: int
    jpeg: bytes
    timestamp_seconds: float | None


def _encode(image: Image.Image) -> bytes:
    """Downscale, drop transparency, and encode as JPEG."""
    image = ImageOps.exif_transpose(image)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    elif image.mode == "L":
        image = image.convert("RGB")

    edge = settings.frame_max_edge
    if max(image.size) > edge:
        image.thumbnail((edge, edge), Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=settings.jpeg_quality, optimize=True)
    return buffer.getvalue()


def frame_from_image(data: bytes) -> ExtractedFrame:
    try:
        with Image.open(io.BytesIO(data)) as image:
            jpeg = _encode(image)
    except Exception as error:
        raise MediaUnreadable("The image could not be read.") from error

    return ExtractedFrame(index=0, jpeg=jpeg, timestamp_seconds=None)


def _frame_to_jpeg(frame: np.ndarray) -> bytes:
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return _encode(Image.fromarray(rgb))


def frames_from_video(data: bytes, max_frames: int) -> list[ExtractedFrame]:
    """Sample up to max_frames evenly spaced frames from the video."""
    max_frames = max(1, min(max_frames, settings.max_video_frames))

    # OpenCV reads from a path rather than a buffer, so the upload is written to
    # a temporary file that is removed as soon as the frames are out.
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as handle:
        handle.write(data)
        temporary = Path(handle.name)

    try:
        capture = cv2.VideoCapture(str(temporary))
        if not capture.isOpened():
            raise MediaUnreadable("The video could not be opened.")

        total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)

        if total <= 0:
            positions = list(range(max_frames))
        else:
            wanted = min(max_frames, total)
            step = total / wanted
            positions = [int(index * step) for index in range(wanted)]

        frames: list[ExtractedFrame] = []
        for order, position in enumerate(positions):
            capture.set(cv2.CAP_PROP_POS_FRAMES, position)
            read, frame = capture.read()
            if not read or frame is None:
                logger.warning("Could not read frame %d, skipping it.", position)
                continue
            timestamp = position / fps if fps > 0 else None
            frames.append(
                ExtractedFrame(
                    index=order,
                    jpeg=_frame_to_jpeg(frame),
                    timestamp_seconds=timestamp,
                )
            )

        capture.release()

        if not frames:
            raise MediaUnreadable("No frame could be read from the video.")
        return frames
    finally:
        temporary.unlink(missing_ok=True)


def extract(
    data: bytes, content_type: str, max_frames: int
) -> list[ExtractedFrame]:
    """The single entry point used by the pipeline."""
    if content_type in IMAGE_TYPES:
        return [frame_from_image(data)]
    if content_type in VIDEO_TYPES:
        return frames_from_video(data, max_frames)
    raise UnsupportedMedia(
        "Upload a JPEG, PNG or WebP image, or an MP4, MOV or MKV video."
    )
