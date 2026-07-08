#!/usr/bin/env python3
"""Tests for feedback → LoRA promotion pipeline."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.khata import feedback_promoter as fp


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def test_confirmed_promoted_once() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        feedback = root / "user-feedback.jsonl"
        lora = root / "lora.jsonl"
        manifest = root / "manifest.json"
        fp.MANIFEST_FILE = manifest
        fp.PROMOTED_AUDIT = root / "audit.jsonl"

        rows = [
            {
                "id": "c1",
                "label": "confirmed",
                "narration": "Ram lai 500 diye",
                "intent": "credit_sale",
                "amount": 500,
                "party": "Ram",
            }
        ]
        _write_jsonl(feedback, rows)

        r1 = fp.promote_user_feedback(feedback_path=feedback, lora_path=lora)
        assert r1.promoted == 1
        assert lora.exists()

        r2 = fp.promote_user_feedback(feedback_path=feedback, lora_path=lora)
        assert r2.promoted == 0
        assert r2.skipped_duplicate == 1


def test_corrected_requires_repeat() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        feedback = root / "user-feedback.jsonl"
        lora = root / "lora.jsonl"
        fp.MANIFEST_FILE = root / "manifest.json"
        fp.PROMOTED_AUDIT = root / "audit.jsonl"

        row = {
            "id": "x1",
            "label": "corrected",
            "narration": "Ram le 500 tiryo",
            "correctedNarration": "Ram le 500 cash ma tiryo",
            "intent": "payment_received",
            "amount": 500,
            "party": "Ram",
        }
        _write_jsonl(feedback, [row])

        r1 = fp.promote_user_feedback(
            feedback_path=feedback, lora_path=lora, min_corrected_repeats=2
        )
        assert r1.promoted == 0
        assert r1.skipped_repeat == 1

        _write_jsonl(feedback, [row, {**row, "id": "x2"}])
        r2 = fp.promote_user_feedback(
            feedback_path=feedback, lora_path=lora, min_corrected_repeats=2
        )
        assert r2.promoted == 1
        content = lora.read_text(encoding="utf-8")
        assert "cash ma tiryo" in content


def test_cancelled_skipped() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        feedback = root / "user-feedback.jsonl"
        lora = root / "lora.jsonl"
        fp.MANIFEST_FILE = root / "manifest.json"
        fp.PROMOTED_AUDIT = root / "audit.jsonl"

        _write_jsonl(
            feedback,
            [
                {
                    "id": "k1",
                    "label": "cancelled",
                    "narration": "test",
                    "intent": "unknown",
                    "amount": 0,
                }
            ],
        )
        r = fp.promote_user_feedback(feedback_path=feedback, lora_path=lora)
        assert r.skipped_cancelled == 1
        assert r.promoted == 0


def test_feedback_to_lora_row_shape() -> None:
    row = fp.feedback_to_lora_row(
        {
            "label": "confirmed",
            "narration": "aaja 200 ko nagad bikri",
            "intent": "cash_sale",
            "amount": 200,
            "party": None,
            "journalLines": [{"account": "Cash", "debit": 200, "credit": 0}],
        }
    )
    assert "instruction" in row
    assert row["input"] == "aaja 200 ko nagad bikri"
    out = json.loads(row["output"])
    assert out["intent"] == "cash_sale"
    assert out["source"] == "user_confirmed"


def main() -> int:
    tests = [
        test_confirmed_promoted_once,
        test_corrected_requires_repeat,
        test_cancelled_skipped,
        test_feedback_to_lora_row_shape,
    ]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL {fn.__name__}: {exc}")
        except Exception as exc:
            failed += 1
            print(f"ERROR {fn.__name__}: {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
