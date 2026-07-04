#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from falcon_trader import parse_khata_message


def main() -> int:
    raw_text = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    result = parse_khata_message(raw_text.strip())
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
