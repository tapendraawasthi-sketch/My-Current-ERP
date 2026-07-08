#!/usr/bin/env python3
"""Codegen sector journal templates from nepal-sector-nlu.jsonl files."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.reasoning.sector_journal_templates import build_templates_from_sector_files, write_sector_templates


def main() -> int:
    path = write_sector_templates()
    payload = build_templates_from_sector_files()
    print(f"Wrote {path}")
    print(f"  templates={payload['template_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
