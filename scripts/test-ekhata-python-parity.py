#!/usr/bin/env python3
"""Batch compare Python falcon_trader parser vs expected corpus labels.

Run via npm run test:ekhata-python-parity (reads stdin JSON array).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "erp_bot" / "src"))

from falcon_trader import classify, parse_khata_message  # noqa: E402
from falcon_trader.normalizer import normalize  # noqa: E402


def main() -> int:
    payload = json.load(sys.stdin)
    samples = payload.get("samples", [])
    results: list[dict] = []

    for sample in samples:
        text = str(sample.get("input", "")).strip()
        expected = sample.get("expected") or {}
        parsed = parse_khata_message(text)
        intent_only = classify(normalize(text), raw_text=text)
        results.append(
            {
                "input": text,
                "expected_intent": expected.get("intent"),
                "expected_amount": expected.get("amount"),
                "py_intent": intent_only or parsed.get("intent"),
                "py_amount": parsed.get("AMOUNT"),
            }
        )

    print(json.dumps({"results": results}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
