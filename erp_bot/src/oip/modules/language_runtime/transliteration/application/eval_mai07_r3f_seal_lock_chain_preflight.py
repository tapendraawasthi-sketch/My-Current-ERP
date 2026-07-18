"""Write MAI-07R3F-SEAL-LOCK-CHAIN preflight and branch-A discovery artifacts."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .rc_lock_chain import verify_complete_chain
from .rc_lock_chain_discovery import (
    EXPECTED_LOCK_SEMANTIC,
    EXPECTED_POST_HOLDOUT_SEMANTIC,
    branch_a_report,
)

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3f_seal_lock_chain"
REPORTS = OUT / "reports"
RC_ID = "MAI_07R3F_LOCK_CHAIN_RELEASE_CANDIDATE_002"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"


def write_branch_a_discovery(repo: Path = REPO) -> dict:
    REPORTS.mkdir(parents=True, exist_ok=True)
    report = branch_a_report(repo)
    path = REPORTS / "MAI_07R3F_SEAL_LOCK_CHAIN_BRANCH_A_DISCOVERY.json"
    path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return {"path": str(path.relative_to(repo)).replace("\\", "/"), **report}


def write_preflight_report(repo: Path = REPO) -> dict:
    REPORTS.mkdir(parents=True, exist_ok=True)
    branch_a = branch_a_report(repo)
    chains: list[dict] = []
    for chain_path in (
        OUT / f"{RC_ID}.CHAIN_MANIFEST.json",
        repo / "evals/mai07_r3f_seal_new/MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json",
    ):
        if chain_path.exists():
            chain = json.loads(chain_path.read_text(encoding="utf-8"))
            v = verify_complete_chain(chain, repo)
            chains.append({"path": str(chain_path.relative_to(repo)).replace("\\", "/"), "verification": v, "chain": chain})
    chain_ok = any(c["verification"]["ok"] for c in chains)
    if branch_a["status"] == "PASSED_RECOVERED_LOCK_CHAIN":
        verdict = "PASSED_RECOVERED_LOCK_CHAIN"
    elif chain_ok and any(c["chain"].get("verdict") == "PASSED_NEW_LOCK_CHAIN_RC" for c in chains):
        verdict = "PASSED_NEW_LOCK_CHAIN_RC"
    else:
        verdict = "BLOCKED_PRECONDITION_FAILED"
    bundle = {
        "phase": "MAI-07R3F-SEAL-LOCK-CHAIN",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "branch_selected": (
            "A_RECOVERED"
            if branch_a["status"] == "PASSED_RECOVERED_LOCK_CHAIN"
            else ("B_APPEND_ONLY_NEW_RC" if branch_a["branch_b_required"] else "A_RECOVERED")
        ),
        "branch_a_status": branch_a["status"],
        "branch_a_failure": None if branch_a["search"]["ok"] else branch_a["reconstruction"]["note"],
        "expected_missing_lock_semantic_sha256": EXPECTED_LOCK_SEMANTIC,
        "seal_new_post_holdout_semantic_sha256": EXPECTED_POST_HOLDOUT_SEMANTIC,
        "branch_a": branch_a,
        "chains": chains,
        "verdict": verdict,
        "AUTOMATED_ENGINEERING_GATES_PASSED": chain_ok or branch_a["search"]["ok"],
        "QUALITY_GATES_PASSED": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "frozen_v2_opened": False,
        "next_phase": "MAI-07R3G-REAUTHORIZED-002",
    }
    path = REPORTS / "MAI_07R3F_SEAL_LOCK_CHAIN_PREFLIGHT_REPORT.json"
    path.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return bundle


def main() -> int:
    write_branch_a_discovery()
    print(json.dumps(write_preflight_report(), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
