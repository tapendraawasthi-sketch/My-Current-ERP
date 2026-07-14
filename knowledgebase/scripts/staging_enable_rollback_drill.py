#!/usr/bin/env python3
"""Staging enable + rollback drill for NP KB (interpretation only)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import REPO_ROOT, atomic_write_text, utc_now_iso  # noqa: E402


def _run_smoke(enabled: bool) -> dict:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    if enabled:
        env["ORBIX_NP_KB_ENABLED"] = "true"
        env["ORBIX_NP_KB_ROOT"] = "knowledgebase"
        env["ORBIX_NP_KB_REVIEW_POLICY"] = "development_all"
        cmd = [sys.executable, str(REPO_ROOT / "knowledgebase/scripts/smoke_test_retrieval.py"), "--enable"]
    else:
        env["ORBIX_NP_KB_ENABLED"] = "false"
        cmd = [sys.executable, str(REPO_ROOT / "knowledgebase/scripts/smoke_test_retrieval.py")]
    proc = subprocess.run(cmd, cwd=str(REPO_ROOT), env=env, capture_output=True, text=True)
    return {
        "returncode": proc.returncode,
        "stdout_tail": (proc.stdout or "")[-500:],
        "stderr_tail": (proc.stderr or "")[-300:],
    }


def main() -> int:
    enabled = _run_smoke(True)
    disabled = _run_smoke(False)

    # Confirm env off after drill
    rollback_ok = disabled["returncode"] == 0 and enabled["returncode"] == 0

    report = {
        "generated_at": utc_now_iso(),
        "drill": "staging_enable_then_rollback",
        "enable_smoke": enabled,
        "disable_smoke": disabled,
        "rollback_tested": rollback_ok,
        "kb_posting_authority": False,
        "note": "Flag toggled for drill only; does not edit committed .env. Runtime enable remains operator-controlled.",
    }
    out = REPO_ROOT / "knowledgebase" / "review" / "rollback_drill_report.json"
    atomic_write_text(out, json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 0 if rollback_ok else 1


if __name__ == "__main__":
    sys.exit(main())
