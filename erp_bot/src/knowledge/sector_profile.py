"""
Sector profile — resolve KB sector slugs and boost sector NLU retrieval.

Maps session context / message keywords → `general.sector.<slug>` segments so
mobile-repair, kirana, hardware, etc. examples rank above generic phase4 hits.
"""

from __future__ import annotations

import importlib.util
import re
from functools import lru_cache
from typing import Any

# Coarse COA sector ids (detect_sector) → default KB slug
COARSE_SECTOR_TO_SLUG: dict[str, str] = {
    "retail_kirana": "kirana-grocery",
    "wholesale_trading": "wholesale-grocery",
    "hospitality": "restaurant-cafe",
    "healthcare": "clinic-health",
    "telecom_it": "electronics-mobile-shop",
    "construction_realestate": "hardware-construction-materials-shop",
    "agriculture": "dairy-shop",
}

# High-signal phrases per KB slug (Roman Nepali + English shop context)
SECTOR_PHRASE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "kirana-grocery": ("kirana", "pasal", "grocery", "general store", "mahajani"),
    "mini-mart": ("mini mart", "minimart", "supermarket"),
    "wholesale-grocery": ("wholesale", "distributor", "godown", "bulk"),
    "mobile-repair-shop": (
        "mobile repair",
        "phone repair",
        "screen change",
        "display change",
        "imei",
        "motherboard",
        "battery change",
        "software flash",
    ),
    "electronics-mobile-shop": (
        "mobile shop",
        "phone sale",
        "smartphone",
        "iphone",
        "samsung",
        "handset",
        "feature phone",
    ),
    "computer-laptop-shop": (
        "laptop",
        "computer shop",
        "desktop",
        "assembled pc",
        "ram upgrade",
        "ssd",
        "printer",
    ),
    "hardware-construction-materials-shop": (
        "cement",
        "rod",
        "rebar",
        "sand",
        "aggregate",
        "brick",
        "construction material",
        "hardware shop",
    ),
    "hardware-shop": ("hardware", "nail", "screw", "tools", "pipe fitting"),
    "cement-rod-retail-shop": ("cement bag", "rod", "saria", "tmt"),
    "paint-shop": ("paint", "berger", "asian paints", "dulux", "putty"),
    "sanitary-plumbing-shop": ("sanitary", "plumbing", "tap", "basin", "commode"),
    "electrical-goods-shop": ("electrical", "wire", "switch", "mcb", "led bulb"),
    "dairy-shop": ("dairy", "dahi", "milk", "paneer", "curd"),
    "bakery": ("bakery", "bread", "cake", "pastry", "biscuit"),
    "restaurant-cafe": ("restaurant", "cafe", "menu", "table bill", "kot"),
    "clinic-health": ("clinic", "opd", "patient", "doctor", "consultation"),
    "meat-shop": ("meat", "chicken", "mutton", "butcher"),
    "fruit-vegetable-shop": ("fruit", "vegetable", "sabji", "tarkari"),
}


@lru_cache(maxsize=1)
def known_sector_slugs() -> frozenset[str]:
    slugs: set[str] = set()
    from .knowledge_registry import load_registry

    for seg_id in load_registry().get("segments", {}):
        if seg_id.startswith("general.sector."):
            slugs.add(seg_id.replace("general.sector.", ""))
    for slug in _load_ingest_sector_slugs().values():
        slugs.add(slug)
    return frozenset(slugs)


@lru_cache(maxsize=1)
def _load_ingest_sector_slugs() -> dict[str, str]:
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "scripts" / "ingest_nepal_sector_knowledge.py"
    if not path.exists():
        return {}
    spec = importlib.util.spec_from_file_location("ingest_nepal_sector_knowledge", path)
    if spec is None or spec.loader is None:
        return {}
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return dict(getattr(module, "SECTOR_SLUG", {}))


@lru_cache(maxsize=1)
def display_name_to_slug() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for name, slug in _load_ingest_sector_slugs().items():
        mapping[name.lower().strip()] = slug
        mapping[slug] = slug
    return mapping


def sector_segment_id(slug: str) -> str:
    return f"general.sector.{slug}"


def resolve_sector_slug(hint: Any) -> str | None:
    """Normalize session / COA sector hints to a KB slug."""
    if hint is None:
        return None

    known = known_sector_slugs()

    if isinstance(hint, dict):
        for key in ("sector_slug", "slug", "id", "name"):
            raw = hint.get(key)
            if not raw:
                continue
            resolved = resolve_sector_slug(str(raw))
            if resolved:
                return resolved
        return None

    raw = str(hint).strip().lower()
    if not raw:
        return None

    if raw.startswith("general.sector."):
        slug = raw.replace("general.sector.", "")
        return slug if slug in known else None

    if raw in known:
        return raw

    if raw in COARSE_SECTOR_TO_SLUG:
        return COARSE_SECTOR_TO_SLUG[raw]

    by_name = display_name_to_slug()
    if raw in by_name:
        return by_name[raw]

    normalized = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    if normalized in known:
        return normalized

    return None


def detect_sector_slug_from_text(text: str) -> str | None:
    """Best-match KB sector slug from message keywords."""
    from .knowledge_registry import load_registry

    t = (text or "").lower()
    if not t.strip():
        return None

    best_slug: str | None = None
    best_score = 0.0

    registry = load_registry()
    for seg_id, cfg in registry.get("segments", {}).items():
        if not seg_id.startswith("general.sector."):
            continue
        slug = seg_id.replace("general.sector.", "")
        score = 0.0

        for phrase in SECTOR_PHRASE_KEYWORDS.get(slug, ()):
            if phrase in t:
                score += 3.0 + len(phrase.split()) * 0.5

        for token in slug.split("-"):
            if len(token) >= 4 and re.search(rf"\b{re.escape(token)}\b", t):
                score += 1.0

        label = str(cfg.get("label") or "").lower()
        for word in re.findall(r"[a-z]{4,}", label):
            if word in t:
                score += 0.5

        for name, mapped in _load_ingest_sector_slugs().items():
            if mapped == slug and name.lower() in t:
                score += 2.0

        if score > best_score:
            best_score = score
            best_slug = slug

    return best_slug if best_score >= 2.0 else None


def compute_sector_boost(
    chunk: Any,
    sector_slug: str | None,
    *,
    task: str,
) -> float:
    """Extra ranking score when chunk belongs to the active sector profile."""
    if not sector_slug or task not in {"nlu", "journal_entry", "language", "casual"}:
        return 0.0

    boost = 0.0
    segment = sector_segment_id(sector_slug)
    chunk_segment = str(getattr(chunk, "segment", "") or "")
    metadata = getattr(chunk, "metadata", None) or {}
    tags = list(getattr(chunk, "tags", None) or [])
    chunk_id = str(getattr(chunk, "id", "") or "")

    if chunk_segment == segment:
        boost += 28.0
    elif chunk_segment.startswith(f"{segment}."):
        boost += 20.0

    meta_slug = str(metadata.get("sector_slug") or "")
    if meta_slug == sector_slug:
        boost += 18.0

    if sector_slug in tags:
        boost += 14.0

    if chunk_id.startswith("sector-") and sector_slug.replace("-", "") in chunk_id.replace("-", ""):
        boost += 8.0

    return boost


def effective_sector_profile(
    *,
    sector_profile: str | None = None,
    query: str | None = None,
    session_sector: Any = None,
) -> str | None:
    """Pick the best sector slug: explicit > session > message detect."""
    if sector_profile:
        return resolve_sector_slug(sector_profile)
    resolved = resolve_sector_slug(session_sector)
    if resolved:
        return resolved
    if query:
        return detect_sector_slug_from_text(query)
    return None
