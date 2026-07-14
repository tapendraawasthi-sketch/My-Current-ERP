#!/usr/bin/env python3
"""Orchestrate ONLI KB pipeline phases with clear gates.

Does not modify original ZIP or raw extracts. Safe to re-run completed phases
selectively via --from-phase / --to-phase.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import REPO_ROOT, load_phase_status, setup_logging  # noqa: E402

logger = setup_logging("run_kb_pipeline")

PHASES: list[tuple[str, list[str]]] = [
    ("0", ["python", "knowledgebase/scripts/phase0_discover.py"]),
    (
        "1",
        [
            "python",
            "knowledgebase/scripts/validate_kb_package.py",
            "--source-dir",
            "Knowledge source",
            "--extract-to",
            "knowledgebase/raw/nepali_language",
            "--output-dir",
            "knowledgebase/review",
        ],
    ),
    ("2", ["python", "knowledgebase/scripts/parse_kb_to_jsonl.py"]),
    ("3", ["python", "knowledgebase/scripts/analyze_kb_quality.py"]),
    ("4", ["python", "knowledgebase/scripts/build_human_review_sample.py"]),
    ("5", ["python", "knowledgebase/scripts/build_retrieval_indexes.py"]),
    ("5b", ["python", "knowledgebase/scripts/build_semantic_index.py"]),
    ("7", ["python", "knowledgebase/scripts/run_kb_evaluation.py"]),
    ("8", ["python", "knowledgebase/scripts/phase8_release_gate.py"]),
]


def run_cmd(cmd: list[str], cwd: Path) -> int:
    logger.info("Running: %s", " ".join(cmd))
    proc = subprocess.run(cmd, cwd=str(cwd))
    return int(proc.returncode)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run ONLI KB pipeline phases")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--from-phase", type=str, default="0")
    parser.add_argument("--to-phase", type=str, default="8")
    parser.add_argument(
        "--skip-extraction",
        action="store_true",
        help="Phase 1 validates existing raw extract only",
    )
    parser.add_argument(
        "--status-only",
        action="store_true",
        help="Print phase_status.json summary and exit",
    )
    args = parser.parse_args(argv)
    repo = args.repo_root.resolve()

    if args.status_only:
        st = load_phase_status()
        for pid, phase in sorted(st.get("phases", {}).items(), key=lambda x: int(x[0]) if x[0].isdigit() else 99):
            print(f"{pid}: {phase.get('status')} — {phase.get('phase_name')}")
        return 0

    start = args.from_phase
    end = args.to_phase
    in_range = False
    for pid, cmd in PHASES:
        if pid == start or (not in_range and pid.startswith(start)):
            in_range = True
        if not in_range:
            continue
        actual = list(cmd)
        if pid == "1" and args.skip_extraction:
            actual = [
                "python",
                "knowledgebase/scripts/validate_kb_package.py",
                "--source-dir",
                "knowledgebase/raw/nepali_language",
                "--extract-to",
                "knowledgebase/raw/nepali_language",
                "--output-dir",
                "knowledgebase/review",
                "--skip-extraction",
            ]
        code = run_cmd(actual, repo)
        if code != 0:
            logger.error("Phase %s failed with exit %s", pid, code)
            return code
        if pid == end or pid.startswith(end):
            break

    logger.info("Pipeline segment complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
