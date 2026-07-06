"""Patch based classification.

A single pass over a whole frame finds the obvious items and misses the small
ones, because everything competes for the same limited attention. Cutting the
frame into overlapping tiles and classifying each one separately gives every
region a full pass, which is the technique the construction waste literature
reports as worth about thirteen percent.

Each tile is classified on its own, the boxes are mapped back into whole frame
coordinates, and overlapping duplicates of the same material are merged.
"""

from __future__ import annotations

import asyncio
import io
import logging
from dataclasses import dataclass

from PIL import Image

from app.config import settings
from app.models import Box, ClassifiedItem

logger = logging.getLogger(__name__)

# Tiles overlap so an item sitting on a seam is whole in at least one of them.
OVERLAP = 0.12
IOU_MERGE = 0.45


@dataclass(frozen=True)
class Tile:
    jpeg: bytes
    left: float
    top: float
    width: float
    height: float


def cut(jpeg: bytes, grid: int) -> list[Tile]:
    """Cut the frame into grid by grid overlapping tiles."""
    if grid <= 1:
        return []

    with Image.open(io.BytesIO(jpeg)) as image:
        image = image.convert("RGB")
        width, height = image.size
        step_x, step_y = 1.0 / grid, 1.0 / grid
        span_x = min(1.0, step_x + OVERLAP)
        span_y = min(1.0, step_y + OVERLAP)

        tiles: list[Tile] = []
        for row in range(grid):
            for column in range(grid):
                left = min(column * step_x, 1.0 - span_x)
                top = min(row * step_y, 1.0 - span_y)
                crop = image.crop(
                    (
                        int(left * width),
                        int(top * height),
                        int((left + span_x) * width),
                        int((top + span_y) * height),
                    )
                )
                edge = settings.frame_max_edge
                if max(crop.size) > edge:
                    crop.thumbnail((edge, edge), Image.Resampling.LANCZOS)

                buffer = io.BytesIO()
                crop.save(buffer, format="JPEG", quality=settings.jpeg_quality)
                tiles.append(
                    Tile(buffer.getvalue(), left, top, span_x, span_y)
                )
        return tiles


def _remap(item: ClassifiedItem, tile: Tile) -> ClassifiedItem:
    box = item.box
    if box is None:
        return item
    return ClassifiedItem(
        material=item.material,
        confidence=item.confidence,
        note=item.note,
        box=Box(
            x=tile.left + box.x * tile.width,
            y=tile.top + box.y * tile.height,
            width=max(0.001, box.width * tile.width),
            height=max(0.001, box.height * tile.height),
        ),
    )


def _iou(a: Box, b: Box) -> float:
    ax2, ay2 = a.x + a.width, a.y + a.height
    bx2, by2 = b.x + b.width, b.y + b.height
    left, top = max(a.x, b.x), max(a.y, b.y)
    right, bottom = min(ax2, bx2), min(ay2, by2)
    if right <= left or bottom <= top:
        return 0.0
    overlap = (right - left) * (bottom - top)
    union = a.width * a.height + b.width * b.height - overlap
    return overlap / union if union > 0 else 0.0


def merge(items: list[ClassifiedItem]) -> list[ClassifiedItem]:
    """Drop duplicates of the same item found in more than one tile."""
    ordered = sorted(items, key=lambda item: item.confidence, reverse=True)
    kept: list[ClassifiedItem] = []

    for item in ordered:
        if item.box is None:
            kept.append(item)
            continue
        duplicate = any(
            other.box is not None
            and other.material == item.material
            and _iou(item.box, other.box) > IOU_MERGE
            for other in kept
        )
        if not duplicate:
            kept.append(item)

    return kept


async def classify_tiled(
    jpeg: bytes,
    classify_one,
    grid: int | None = None,
) -> list[ClassifiedItem]:
    """Classify the whole frame and each tile, then merge the results.

    The whole frame pass is kept because it catches large items that no single
    tile contains, and the tiles catch the small ones the whole frame pass
    glosses over.
    """
    grid = grid or settings.tile_grid
    tiles = cut(jpeg, grid)

    whole = Tile(jpeg, 0.0, 0.0, 1.0, 1.0)
    passes = [whole, *tiles]

    semaphore = asyncio.Semaphore(max(1, settings.model_concurrency))

    async def run(tile: Tile) -> list[ClassifiedItem]:
        async with semaphore:
            try:
                found = await classify_one(tile.jpeg)
            except Exception as error:
                logger.warning("Tile pass failed: %s", error)
                return []
            return [_remap(item, tile) for item in found]

    results = await asyncio.gather(*(run(tile) for tile in passes))
    everything = [item for group in results for item in group]

    merged = merge(everything)
    logger.info(
        "Tiled pass: %d raw detections over %d passes, %d after merge.",
        len(everything),
        len(passes),
        len(merged),
    )
    return merged
