#!/usr/bin/env python3
"""Promote user-feedback.jsonl into lora-instruction-dataset.jsonl."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.khata.feedback_promoter import promote_user_feedback


def main() -> int:
    parser = argparse.ArgumentParser(description="Promote user feedback to LoRA training JSONL")
    parser.add_argument("--dry-run", action="store_true", help="Report counts without writing")
    parser.add_argument(
        "--min-corrected-repeats",
        type=int,
        default=2,
        help="Minimum repeats before promoting corrected entries (default: 2)",
    )
    args = parser.parse_args()

    result = promote_user_feedback(
        dry_run=args.dry_run,
        min_corrected_repeats=args.min_corrected_repeats,
    )

    print(f"Scanned:           {result.scanned}")
    print(f"Eligible:          {result.eligible}")
    print(f"Promoted:          {result.promoted}")
    print(f"Skipped duplicate: {result.skipped_duplicate}")
    print(f"Skipped repeat:    {result.skipped_repeat}")
    print(f"Skipped cancelled: {result.skipped_cancelled}")
    print(f"Output:            {result.output_path}")
    if args.dry_run:
        print("(dry run — no files written)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
