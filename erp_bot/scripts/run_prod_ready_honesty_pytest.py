"""PR-B6 — run launch-critical NEXT/PR-B honesty pytest pack (no vacuous skip)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LR = ROOT / "erp_bot" / "tests" / "oip" / "language_runtime"

PATTERNS = (
    "test_mai_next*.py",
    "test_mai_pr_b*.py",
    "test_mai_capability_truth_matrix.py",
)


def main() -> int:
    files: list[Path] = []
    for pat in PATTERNS:
        files.extend(sorted(LR.glob(pat)))
    # de-dupe preserve order
    seen: set[Path] = set()
    unique: list[Path] = []
    for f in files:
        if f not in seen and f.is_file():
            seen.add(f)
            unique.append(f)
    if not unique:
        print("NO_HONESTY_TESTS_FOUND", file=sys.stderr)
        return 2
    rel = [str(p.relative_to(ROOT / "erp_bot")) for p in unique]
    print(f"Running {len(rel)} honesty test modules…")
    cmd = [sys.executable, "-m", "pytest", *rel, "-q", "--tb=line"]
    return subprocess.call(cmd, cwd=str(ROOT / "erp_bot"))


if __name__ == "__main__":
    raise SystemExit(main())
