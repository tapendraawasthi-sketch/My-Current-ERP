"""Historical invalidation sidecar for original R3F RC (bytes of RC preserved)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[7]
RC_PATH = REPO / "evals/mai07_r3f_english_identity/MAI_07R3F_RELEASE_CANDIDATE.manifest.json"
OUT = REPO / "evals/mai07_r3f_english_identity/MAI_07R3F_RELEASE_CANDIDATE.INVALIDATION.json"

EXPECTED_RC_HASH = "37e551f29126fea63f77b9cb6b3bc4e867185b61a620b5686ed8471bf10396dd"
EXPECTED_RESOURCE_CLAIM = "e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a"


def write_invalidation(*, repo: Path = REPO) -> dict:
    rc_path = repo / "evals/mai07_r3f_english_identity/MAI_07R3F_RELEASE_CANDIDATE.manifest.json"
    raw = rc_path.read_bytes()
    raw_sha = hashlib.sha256(raw).hexdigest()
    rc = json.loads(raw.decode("utf-8"))
    # Producer contract: manifest_sha256 hashes the pretty JSON body *before* inserting
    # the manifest_sha256 field (same ambiguity class as predictions_sha256).
    field_sha = rc.get("manifest_sha256")
    if field_sha != EXPECTED_RC_HASH:
        raise RuntimeError(f"historical RC manifest_sha256 field drift: {field_sha}")
    if rc.get("resource_content_hash") != EXPECTED_RESOURCE_CLAIM:
        raise RuntimeError("historical RC resource claim drift")
    without = {k: v for k, v in rc.items() if k != "manifest_sha256"}
    recomputed = hashlib.sha256(
        (json.dumps(without, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    ).hexdigest()
    if recomputed != EXPECTED_RC_HASH:
        raise RuntimeError(f"historical RC content recompute drift: {recomputed}")
    payload = {
        "schema_version": "1.0.0",
        "parent_rc_id": "MAI_07R3F_RELEASE_CANDIDATE",
        "parent_rc_manifest_path": "evals/mai07_r3f_english_identity/MAI_07R3F_RELEASE_CANDIDATE.manifest.json",
        "parent_rc_manifest_sha256": EXPECTED_RC_HASH,
        "parent_rc_manifest_raw_sha256": raw_sha,
        "parent_rc_hash_contract_note": (
            "manifest_sha256 is SHA-256 of pretty JSON without the manifest_sha256 field; "
            "raw file bytes differ once the field is written."
        ),
        "parent_rc_status": "INVALIDATED_BY_SEAL_DRIFT",
        "parent_resource_content_hash_claim": EXPECTED_RESOURCE_CLAIM,
        "reason": (
            "Sealed resource pack bytes for e94cc8c… unrestorable; "
            "canonical claim drifted under mutation-prone tooling. "
            "RC file bytes preserved unchanged; do not use for frozen evaluation."
        ),
        "superseded_by_phase": "MAI-07R3F-SEAL-NEW",
        "rc_file_bytes_unchanged": True,
        "prohibited_for_frozen_evaluation": True,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
    }
    out = repo / "evals/mai07_r3f_english_identity/MAI_07R3F_RELEASE_CANDIDATE.INVALIDATION.json"
    body = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    payload["invalidation_sha256"] = digest
    out.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return payload


def main() -> int:
    print(json.dumps(write_invalidation(), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
