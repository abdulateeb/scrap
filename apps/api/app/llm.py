"""The single place where a model is called.

Every request goes through LiteLLM, so the provider is a string in the
environment rather than a dependency in the code. Swapping the model, or moving
from one provider to another, is an environment change and nothing more.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

import litellm

from app.config import settings
from app.materials import normalise
from app.models import Box, ClassifiedItem
from app.prompt import RESPONSE_SCHEMA, SYSTEM_PROMPT, USER_PROMPT

logger = logging.getLogger(__name__)

# LiteLLM chatters on import and retries on its own schedule. Both are turned
# off so this module stays the only place that decides what happens on failure.
litellm.drop_params = True
litellm.suppress_debug_info = True
litellm.set_verbose = False


class ModelNotConfigured(RuntimeError):
    """Raised when a classification is asked for without an API key."""


class ClassificationFailed(RuntimeError):
    """Raised when the model could not produce a usable answer."""


def _messages(image_bytes: bytes, media_type: str) -> list[dict[str, Any]]:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": USER_PROMPT},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{media_type};base64,{encoded}"},
                },
            ],
        },
    ]


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _to_box(raw: dict[str, Any]) -> Box | None:
    keys = ("x", "y", "width", "height")
    if not all(isinstance(raw.get(key), (int, float)) for key in keys):
        return None

    x = _clamp(float(raw["x"]))
    y = _clamp(float(raw["y"]))
    width = _clamp(float(raw["width"]))
    height = _clamp(float(raw["height"]))

    # A zero sized box carries no information, and one that runs off the frame
    # is trimmed rather than dropped.
    width = min(width, 1.0 - x)
    height = min(height, 1.0 - y)
    if width <= 0.001 or height <= 0.001:
        return None

    return Box(x=x, y=y, width=width, height=height)


def parse_items(payload: str) -> list[ClassifiedItem]:
    """Turn the model's JSON into items, discarding anything malformed."""
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as error:
        raise ClassificationFailed(
            "The model did not return valid JSON."
        ) from error

    raw_items = data.get("items")
    if not isinstance(raw_items, list):
        raise ClassificationFailed("The model response had no items list.")

    items: list[ClassifiedItem] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        material = raw.get("material")
        if not isinstance(material, str):
            continue

        confidence = raw.get("confidence", 0.0)
        if not isinstance(confidence, (int, float)):
            confidence = 0.0

        label = raw.get("label") or raw.get("note")
        items.append(
            ClassifiedItem(
                material=normalise(material),
                confidence=_clamp(float(confidence)),
                box=_to_box(raw),
                note=label.strip() if isinstance(label, str) and label.strip() else None,
            )
        )
    return items


async def warm_up() -> None:
    """Open the connection to the provider once, at startup.

    Failure here is not interesting. If the provider is unreachable the first
    real classification will say so properly.
    """
    if not settings.model_configured:
        return
    try:
        await litellm.acompletion(
            model=settings.model_name,
            messages=[{"role": "user", "content": "ok"}],
            api_key=settings.gemini_api_key,
            max_tokens=4,
            timeout=30,
            num_retries=0,
        )
        logger.info("Model connection warm.")
    except Exception as error:
        logger.info("Warm up call did not complete: %s", error)


async def classify_frame(
    image_bytes: bytes, media_type: str = "image/jpeg"
) -> list[ClassifiedItem]:
    """Classify one frame. Retries once, then gives up with a clear error."""
    if not settings.model_configured:
        raise ModelNotConfigured(
            "No model API key is set. Add GEMINI_API_KEY to the environment."
        )

    last_error: Exception | None = None

    for attempt in range(settings.model_max_retries + 1):
        try:
            response = await litellm.acompletion(
                model=settings.model_name,
                messages=_messages(image_bytes, media_type),
                api_key=settings.gemini_api_key,
                # No temperature override. Gemini 3 models degrade badly below
                # the default, and LiteLLM warns that a low value can send them
                # into loops, so sampling guidance lives in the system prompt.
                timeout=settings.model_timeout_seconds,
                num_retries=0,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "waste_classification",
                        "schema": RESPONSE_SCHEMA,
                    },
                },
            )
            content = response.choices[0].message.content or ""
            items = parse_items(content)

            # The model occasionally answers with an empty list for a picture
            # that plainly contains waste. It is not deterministic, so an empty
            # answer is retried before it is believed.
            if not items and attempt < settings.model_max_retries:
                logger.info("Empty result on attempt %d, retrying.", attempt + 1)
                continue

            return items
        except Exception as error:
            last_error = error
            logger.warning(
                "Classification attempt %d failed: %s", attempt + 1, error
            )

    raise ClassificationFailed(
        f"The model could not classify this frame: {last_error}"
    )
