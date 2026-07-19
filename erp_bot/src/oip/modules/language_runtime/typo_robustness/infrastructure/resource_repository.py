"""Load MAI-08 candidate-only abbr/typo resources."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .. import RESOURCE_PACK_VERSION

_RESOURCE_PATH = (
    Path(__file__).resolve().parent.parent / "resources" / "shop_abbr_typo_candidates.json"
)


@dataclass(frozen=True)
class TypoCodeMixResources:
    resource_version: str
    abbreviations: dict[str, str]
    typo_probes: dict[str, str]


@lru_cache(maxsize=1)
def load_resources() -> TypoCodeMixResources:
    data = json.loads(_RESOURCE_PATH.read_text(encoding="utf-8"))
    return TypoCodeMixResources(
        resource_version=str(data.get("resource_version") or RESOURCE_PACK_VERSION),
        abbreviations={str(k).lower(): str(v) for k, v in (data.get("abbreviations") or {}).items()},
        typo_probes={str(k).lower(): str(v) for k, v in (data.get("typo_probes") or {}).items()},
    )
