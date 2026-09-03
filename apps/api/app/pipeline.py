"""One classification, from upload to result.

The order is fixed and written as a small state graph, so every step is named
and the sequence is something a reader can see rather than infer: pull frames
out of the upload, classify them, then total the materials up.

Nothing is stored. The frames come back inside the result as data URLs and the
service keeps no copy once the response has been sent.

There is no de-duplication across frames. An item that stays in view for several
frames is counted once per frame, and the interface says so.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from collections import defaultdict
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.config import settings
from app.llm import ClassificationFailed, ModelNotConfigured, classify_frame
from app.media import ExtractedFrame, extract
from app.tiling import classify_tiled
from app.models import (
    ClassifiedItem,
    Composition,
    CompositionShare,
    Detection,
    Frame,
    Result,
)

logger = logging.getLogger(__name__)

Classified = tuple[ExtractedFrame, list[ClassifiedItem], str | None]


class RunState(TypedDict, total=False):
    upload: bytes
    content_type: str
    max_frames: int
    tile: bool

    frames: list[ExtractedFrame]
    results: list[Classified]


async def extract_frames(state: RunState) -> dict[str, Any]:
    frames = extract(
        state["upload"], state["content_type"], state.get("max_frames", 1)
    )
    logger.info("%d frames extracted.", len(frames))
    # The upload is not kept once the frames are out of it.
    return {"frames": frames, "upload": b""}


async def classify_frames(state: RunState) -> dict[str, Any]:
    frames = state.get("frames", [])
    semaphore = asyncio.Semaphore(max(1, settings.model_concurrency))

    # A single still gets the tiled treatment, which costs a handful of calls
    # and finds markedly more. A video already has many frames, so each one gets
    # a single pass and the frames themselves supply the coverage.
    #
    # A live capture is also a single frame, but tiling it means five model calls
    # for every scan, which is why the camera could never keep a short cadence.
    # The caller decides, so live mode can trade thoroughness for speed while an
    # upload stays as thorough as it was.
    tiled = len(frames) == 1 and state.get("tile", True)

    async def one(frame: ExtractedFrame) -> Classified:
        try:
            if tiled:
                return frame, await classify_tiled(frame.jpeg, classify_frame), None
            async with semaphore:
                return frame, await classify_frame(frame.jpeg), None
        except (ClassificationFailed, ModelNotConfigured) as error:
            logger.warning("Frame %d: %s", frame.index, error)
            return frame, [], str(error)

    return {"results": list(await asyncio.gather(*(one(f) for f in frames)))}


def _compose(frames: list[Frame]) -> Composition | None:
    if not frames:
        return None

    detections = [d for frame in frames for d in frame.detections]
    total = len(detections)

    counts: dict[str, int] = defaultdict(int)
    confidence: dict[str, float] = defaultdict(float)
    for detection in detections:
        counts[detection.material] += 1
        confidence[detection.material] += detection.confidence

    shares = [
        CompositionShare(
            material=material,
            count=count,
            share=count / total if total else 0.0,
            mean_confidence=confidence[material] / count,
        )
        for material, count in counts.items()
    ]
    shares.sort(key=lambda entry: entry.share, reverse=True)

    used = sum(1 for frame in frames if frame.status == "done")
    return Composition(
        total_detections=total,
        frames_used=used,
        frames_excluded=len(frames) - used,
        shares=shares,
    )


def _to_frames(results: list[Classified]) -> list[Frame]:
    frames: list[Frame] = []
    for extracted, items, error in results:
        encoded = base64.b64encode(extracted.jpeg).decode("ascii")
        frames.append(
            Frame(
                index=extracted.index,
                timestamp_seconds=extracted.timestamp_seconds,
                image=f"data:image/jpeg;base64,{encoded}",
                status="failed" if error else "done",
                detections=[
                    Detection(
                        material=item.material,
                        confidence=item.confidence,
                        box=item.box,
                        note=item.note,
                    )
                    for item in items
                ],
                error=error,
            )
        )
    frames.sort(key=lambda frame: frame.index)
    return frames


def build_graph():
    graph = StateGraph(RunState)
    graph.add_node("extract", extract_frames)
    graph.add_node("classify", classify_frames)
    graph.add_edge(START, "extract")
    graph.add_edge("extract", "classify")
    graph.add_edge("classify", END)
    return graph.compile()


_graph = build_graph()


async def classify(
    upload: bytes,
    content_type: str,
    source_kind: str,
    source_name: str,
    max_frames: int,
    tile: bool = True,
) -> Result:
    started = time.perf_counter()

    state = await _graph.ainvoke(
        {
            "upload": upload,
            "content_type": content_type,
            "max_frames": max_frames,
            "tile": tile,
        }
    )

    results: list[Classified] = state.get("results", [])
    frames = _to_frames(results)
    failures = [error for _, _, error in results if error]

    error: str | None = None
    if results and len(failures) == len(results):
        error = failures[0]
    elif failures:
        error = f"{len(failures)} of {len(results)} frames could not be classified."

    return Result(
        source_kind=source_kind,
        source_name=source_name,
        model=settings.model_name,
        frame_count=len(frames),
        detection_count=sum(len(frame.detections) for frame in frames),
        duration_ms=int((time.perf_counter() - started) * 1000),
        error=error,
        frames=frames,
        composition=_compose(frames),
    )
