"""The material categories a recovery facility works with.

This list is the contract with apps/web. The same keys appear in
apps/web/lib/materials.ts, and the classification prompt is built from the
descriptions below, so a category is added in both places or in neither.
"""

from __future__ import annotations

from typing import Final

MATERIAL_KEYS: Final[tuple[str, ...]] = (
    "plastic",
    "paper",
    "cardboard",
    "metal",
    "glass",
    "organic",
    "textiles",
    "ewaste",
    "other",
)

MATERIAL_GUIDE: Final[dict[str, str]] = {
    "plastic": (
        "bottles, films, bags, rigid packaging, containers, plastic caps"
    ),
    "paper": "newspaper, office paper, magazines, envelopes, mixed paper",
    "cardboard": "corrugated boxes, cartons, thick board, beverage cartons",
    "metal": "cans, foil, tins, wire, ferrous and non ferrous scrap",
    "glass": "bottles, jars, broken glass pieces",
    "organic": "food waste, garden waste, wood, other wet fraction",
    "textiles": "cloth, rags, fabric offcuts, footwear, carpet",
    "ewaste": (
        "cables, circuit boards, batteries, small electronic appliances"
    ),
    "other": (
        "anything that clearly does not belong to the categories above, "
        "including unidentifiable fragments"
    ),
}


def guide_lines() -> str:
    """The category list as it appears inside the prompt."""
    return "\n".join(
        f"- {key}: {description}" for key, description in MATERIAL_GUIDE.items()
    )


def normalise(value: str) -> str:
    """Map whatever the model returned onto a known key.

    The model is asked for an exact key, but a stray plural, capital letter or
    hyphen should not cost a detection.
    """
    cleaned = value.strip().lower().replace("-", "").replace("_", "")
    cleaned = cleaned.replace(" ", "")

    if cleaned in MATERIAL_KEYS:
        return cleaned

    aliases = {
        "ewaste": "ewaste",
        "electronicwaste": "ewaste",
        "electronics": "ewaste",
        "plastics": "plastic",
        "papers": "paper",
        "metals": "metal",
        "glasses": "glass",
        "textile": "textiles",
        "cloth": "textiles",
        "organics": "organic",
        "food": "organic",
        "carton": "cardboard",
        "corrugated": "cardboard",
    }
    return aliases.get(cleaned, "other")
