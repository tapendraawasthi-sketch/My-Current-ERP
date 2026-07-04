#!/usr/bin/env python3
"""Build nepali-grammar-reference-verbatim-part2.txt from raw Part 2 paste.

Normalizes:
  - Devanagari section numbers (३४) → Arabic (34) for parser compatibility
  - === section header blocks → long ━ delimiters matching Part 1 format
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RAW = REPO / "data" / "ekhata" / "source" / "nepali-grammar-reference-verbatim-part2-raw.txt"
OUT = REPO / "data" / "ekhata" / "source" / "nepali-grammar-reference-verbatim-part2.txt"
DELIM = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

_DEV_TO_AR = str.maketrans("०१२३४५६७८९", "0123456789")


def _dev_to_ar(text: str) -> str:
    return text.translate(_DEV_TO_AR)


def normalize_part2(raw: str) -> str:
    """Convert Part 2 paste into Part-1-compatible verbatim format."""
    text = raw.replace("\r\n", "\n").strip()

    # Normalize Devanagari digits in खण्ड headers and subsection numbers (३४.१)
    _DIGITS = r"[०१२३४५६७८९0-9]"
    text = re.sub(
        rf"(खण्ड\s+)({_DIGITS}+)",
        lambda m: m.group(1) + _dev_to_ar(m.group(2)),
        text,
    )
    text = re.sub(
        rf"^({_DIGITS}+(?:\.{_DIGITS}+)*)",
        lambda m: _dev_to_ar(m.group(1)),
        text,
        flags=re.MULTILINE,
    )

    # Replace === header blocks (खण्ड + SECTION) with long delimiter format
    header_block = re.compile(
        r"={50,}\s*\n"
        r"(खण्ड\s+\d+:[^\n]+\nSECTION\s+\d+:[^\n]+)\s*\n"
        r"={50,}",
        re.MULTILINE,
    )
    text = header_block.sub(lambda m: f"{DELIM}\n{m.group(1).strip()}\n\n", text)

    # Ensure document opens with Part 2 header (no leading delim required for intro)
    intro = """===========================================================================
   सम्पूर्ण नेपाली व्याकरण ज्ञान — भाग २
   COMPLETE NEPALI GRAMMAR KNOWLEDGE — PART 2
   AI प्रशिक्षणका लागि | FOR AI TRAINING
   (Standard Nepali + Romanized + Halkhabar + Code-Switch Variations)
===========================================================================
   VERBATIM EDITION Part 2 — Sections 34–80 with all Halkhabar variation lines.
===========================================================================

"""
    if not text.startswith("="):
        text = intro + text
    elif "भाग २" not in text[:800]:
        text = intro + text

    # Strip duplicate intro === blocks before first section
    first_section = text.find(DELIM)
    if first_section > 0:
        preamble = text[:first_section]
        if preamble.count("=") > 20:
            text = intro + text[first_section:]

    return text + "\n"


def main() -> None:
    src = RAW
    if len(sys.argv) > 1:
        src = Path(sys.argv[1])

    if not src.exists():
        print(f"Raw Part 2 file not found: {src}", file=sys.stderr)
        print("Place the user-provided Part 2 document at:", RAW, file=sys.stderr)
        sys.exit(1)

    raw = src.read_text(encoding="utf-8")
    normalized = normalize_part2(raw)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(normalized, encoding="utf-8")

    sections = len(re.findall(r"^SECTION\s+\d+:", normalized, re.MULTILINE))
    print(f"Wrote {OUT} ({len(normalized):,} bytes, {sections} sections detected)")


if __name__ == "__main__":
    main()
