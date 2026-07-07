#!/usr/bin/env python3
"""Add aliases_flat to COA alias chunks by parsing content field."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ALIAS_PATH = ROOT / "data/ekhata/knowledge/professional/sector/coa/nepal-sme-coa-aliases.jsonl"
PREFIXES = ("aliases_english:", "aliases_romanized:", "aliases_nepali:", "aliases_misspelled_slang:", "shopkeeper_phrases:")


def flatten_from_content(content: str, title: str) -> list[str]:
    flat: list[str] = []
    for line in content.split("\n"):
        for prefix in PREFIXES:
            if line.startswith(prefix):
                part = line.split(":", 1)[1]
                for token in part.split(","):
                    t = token.strip().lower()
                    if len(t) >= 2:
                        flat.append(t)
    # title after account id e.g. "1001 Cash in Hand"
    parts = title.split(" ", 1)
    if len(parts) == 2:
        flat.append(parts[1].lower())
    return list(dict.fromkeys(flat))


def main() -> None:
    rows = []
    for line in ALIAS_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        row["aliases_flat"] = flatten_from_content(row.get("content", ""), row.get("title", ""))
        rows.append(row)
    with ALIAS_PATH.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Patched aliases_flat on {len(rows)} COA rows")


if __name__ == "__main__":
    main()
