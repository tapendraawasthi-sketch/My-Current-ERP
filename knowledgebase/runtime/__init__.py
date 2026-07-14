"""Knowledgebase runtime helpers (path resolution + feature-flag defaults)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

KB_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = KB_ROOT.parent
CONFIG_PATH = KB_ROOT / "config.json"


def load_kb_config() -> dict[str, Any]:
    with CONFIG_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def is_enabled() -> bool:
    raw = os.environ.get("ORBIX_NP_KB_ENABLED")
    if raw is None:
        return True  # owner-attested default; set false to disable
    return raw.strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def lexical_db_path() -> Path:
    root = os.environ.get("ORBIX_NP_KB_ROOT", "").strip()
    base = Path(root) if root else KB_ROOT
    return base / "indexes" / "lexical" / "kb_lexical.sqlite"
