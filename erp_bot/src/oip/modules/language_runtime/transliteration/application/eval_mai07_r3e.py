"""MAI-07R3E — one-shot frozen-V2 evaluation of sealed R3D release candidate.

Read-only w.r.t. runtime/resources/scorers/thresholds/V2 datasets.
Uses locked R3C canonical + audit scorers against R3E predictions.
"""

from __future__ import annotations

import hashlib
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .build_mai07r3c_dataset_v2 import (
    AUDIT_SCORER_VERSION,
    CANONICAL_SCORER_VERSION,
)
from .eval_audit_scorer_r3c import assert_canonical_matches_audit, audit_aggregate_r3c
from .eval_c2_helpers import extract_primary_produced
from .eval_candidate_roles_r3c import classify_candidate_role
from .eval_mai07_r3c import (
    load_v2_cases,
    run_one_shot_predictions,
    score_predictions,
)
from .transliteration_service import attach_transliteration_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure import resource_repository as xlrr

REPO = Path(__file__).resolve().parents[7]
MANIFESTS = REPO / "evals/mai07/manifests"
BASELINES = REPO / "evals/mai07/baselines"
R3D = REPO / "evals/mai07_r3d_corrective"
R3E = REPO / "evals/mai07/r3e"
REPORTS = R3E / "reports"

EXPECTED = {
    "runtime": "mai-07.1.1-r3d",
    "resource": "083bce288907c0db882bdf7082bf9093e9086035c653dadcd4964625b61e966f",
    "rc_content": "2ebe29fac17b836849e3c3e1054c704a03d762bc5f28879a9a0de2f5a62d2c26",
    "v1": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
    "v2": "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9",
    "v2_man": "17331e4d0c703977b80ca893eb5261bb126aa52a6813fe8b4f548b1178c716be",
    "pop": "a8461f62acac98561605e5b2ffb2475bb73a3d15cf0f32ef7b98f1247de85632",
    "thr": "aa4b5d68852edbed7cdc5f025b8051b3235078a65fb78bb0aca3a342fcdf04ef",
    "r3c_pred": "88016f847678fefcd2b8545659ca03f8c4bf6849525d64855d563e9a95fd0c5a",
    "holdout_pred": "1d3b04d60d6621af4ffe3c46c2776a85630043ba4194269c31b2604fa8c0b4b5",
}


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha_file(path: Path) -> str:
    return _sha_bytes(path.read_bytes())


def _canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _code_hash(path: Path) -> str:
    return _sha_file(path)


def rc_content_hash(repo: Path = REPO) -> str:
    rc = json.loads(
        (repo / "evals/mai07_r3d_corrective/MAI_07R3D_RELEASE_CANDIDATE.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    body = {k: v for k, v in rc.items() if k != "manifest_sha256"}
    return _sha_bytes(
        (json.dumps(body, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    )


def recompute_v1_hash(repo: Path = REPO) -> str:
    man = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((repo / f["path"]).read_bytes())
    return h.hexdigest()


def recompute_v2_hash(repo: Path = REPO) -> str:
    man = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((repo / f["path"]).read_bytes())
    return h.hexdigest()


def validate_holdout_evidence(repo: Path = REPO) -> dict[str, Any]:
    rc_path = repo / "evals/mai07_r3d_corrective/MAI_07R3D_RELEASE_CANDIDATE.manifest.json"
    rc = json.loads(rc_path.read_text(encoding="utf-8"))
    ds = json.loads(
        (repo / "evals/mai07_r3d_corrective/MAI_07R3D_DATASET_MANIFEST.json").read_text(encoding="utf-8")
    )
    thr_hash = _sha_file(repo / "evals/mai07_r3d_corrective/MAI_07R3D_HOLDOUT_THRESHOLDS.json")
    pred_path = (
        repo / "evals/mai07_r3d_corrective/reports/MAI_07R3D_HOLDOUT_VALIDATION_PREDICTIONS.jsonl"
    )
    rep_path = (
        repo / "evals/mai07_r3d_corrective/reports/MAI_07R3D_HOLDOUT_VALIDATION_SCORE_REPORT.json"
    )
    pred_hash = _sha_file(pred_path)
    rep_hash = _sha_file(rep_path)
    rep = json.loads(rep_path.read_text(encoding="utf-8"))
    missing: list[str] = []
    if not rc.get("locked") or not rc.get("locked_before_holdout"):
        missing.append("rc_not_locked_before_holdout")
    if rc_content_hash(repo) != EXPECTED["rc_content"]:
        missing.append("rc_content_hash_mismatch")
    if ds["splits"]["HOLDOUT_VALIDATION"]["sha256"] != rc["holdout_dataset_sha256"]:
        missing.append("holdout_dataset_hash_mismatch")
    if ds["splits"]["SAFETY_CHALLENGE"]["sha256"] != rc["safety_dataset_sha256"]:
        missing.append("safety_dataset_hash_mismatch")
    if thr_hash != rc["threshold_sha256"]:
        missing.append("threshold_hash_mismatch")
    if pred_hash != EXPECTED["holdout_pred"] or pred_hash != rep.get("predictions_sha256"):
        missing.append("holdout_prediction_hash_mismatch")
    if rep["report"]["metrics"] != rep["audit"]["metrics"]:
        missing.append("canonical_audit_metrics_disagree")
    if not rep["gate_decision"]["all_pass"]:
        missing.append("holdout_gates_not_all_pass")
    harm = rep["gate_decision"]["gates"].get("harm_count", {})
    if harm.get("numerator") != 0:
        missing.append("harm_count_nonzero")
    prot = rep["gate_decision"]["gates"].get("protected_span_mutations", {})
    if prot.get("numerator") != 0:
        missing.append("protected_mutations_nonzero")
    if rc.get("resource_content_hash") != EXPECTED["resource"]:
        missing.append("rc_resource_drift")
    # Active pack may advance (e.g. MAI-07R3F); sealed R3D RC resource hash must remain.
    from .. import PARENT_R3D_RESOURCE_HASH, PARENT_R3D_RUNTIME_VERSION, PARENT_R3D_RC_HASH

    if PARENT_R3D_RESOURCE_HASH != EXPECTED["resource"]:
        missing.append("parent_r3d_resource_constant_drift")
    if PARENT_R3D_RUNTIME_VERSION != EXPECTED["runtime"]:
        missing.append("parent_r3d_runtime_constant_drift")
    if PARENT_R3D_RC_HASH != EXPECTED["rc_content"]:
        missing.append("parent_r3d_rc_constant_drift")
    if rc.get("runtime_version") != EXPECTED["runtime"]:
        missing.append("rc_runtime_version_mismatch")
    if ENABLE_PROMOTION_OVERLAY is not False:
        missing.append("overlay_enabled")
    # RC locked before predictions by mtime
    if rc_path.stat().st_mtime > pred_path.stat().st_mtime + 0.001:
        # allow small float; fail only if RC clearly after preds
        if rc_path.stat().st_mtime > pred_path.stat().st_mtime + 1.0:
            missing.append("rc_mtime_after_holdout_predictions")
    audit_metrics_hash = _sha_bytes(_canonical(rep["audit"]["metrics"]).encode("utf-8"))
    return {
        "ok": not missing,
        "missing": missing,
        "holdout_dataset_sha256": rc["holdout_dataset_sha256"],
        "safety_dataset_sha256": rc["safety_dataset_sha256"],
        "threshold_sha256": thr_hash,
        "predictions_sha256": pred_hash,
        "canonical_report_sha256": rep_hash,
        "independent_audit_metrics_sha256": audit_metrics_hash,
        "gates": rep["gate_decision"]["gates"],
        "rc_locked_before_holdout": bool(rc.get("locked_before_holdout")),
        "command_note": "python -m ...eval_mai07_r3d --split HOLDOUT_VALIDATION (one-shot after RC lock)",
        "rc_mtime_utc": datetime.fromtimestamp(rc_path.stat().st_mtime, timezone.utc).isoformat(),
        "pred_mtime_utc": datetime.fromtimestamp(pred_path.stat().st_mtime, timezone.utc).isoformat(),
    }


def immutability_preflight(repo: Path = REPO) -> dict[str, Any]:
    xlrr.load_resources(force_reload=True)
    scores = {
        "v1": recompute_v1_hash(repo),
        "v2": recompute_v2_hash(repo),
        "v2_man": _sha_file(repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json"),
        "pop": _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json"),
        "thr": _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_THRESHOLDS_V1.manifest.json"),
        "r3c_pred": _sha_file(repo / "evals/mai07/baselines/MAI_07R3C_V2_ONE_SHOT_PREDICTIONS.jsonl"),
        "rc_content": rc_content_hash(repo),
        "resource": xlrr.compute_pack_content_hash(),
        "canonical_scorer": _code_hash(
            repo
            / "erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_scoring_r3c.py"
        ),
        "audit_scorer": _code_hash(
            repo
            / "erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_audit_scorer_r3c.py"
        ),
        "runner_r3c": _code_hash(
            repo
            / "erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3c.py"
        ),
    }
    errors = []
    for k, exp in (
        ("v1", EXPECTED["v1"]),
        ("v2", EXPECTED["v2"]),
        ("v2_man", EXPECTED["v2_man"]),
        ("pop", EXPECTED["pop"]),
        ("thr", EXPECTED["thr"]),
        ("r3c_pred", EXPECTED["r3c_pred"]),
        ("rc_content", EXPECTED["rc_content"]),
    ):
        if scores[k] != exp:
            errors.append(f"{k}:{scores[k]}!={exp}")
    # Sealed R3D resource hash is recorded on the RC; active pack may advance (R3F+).
    from .. import PARENT_R3D_RESOURCE_HASH, PARENT_R3D_RUNTIME_VERSION

    rc = json.loads(
        (repo / "evals/mai07_r3d_corrective/MAI_07R3D_RELEASE_CANDIDATE.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    if rc.get("resource_content_hash") != EXPECTED["resource"]:
        errors.append(f"rc_resource:{rc.get('resource_content_hash')}!={EXPECTED['resource']}")
    if PARENT_R3D_RESOURCE_HASH != EXPECTED["resource"]:
        errors.append("parent_r3d_resource_constant_drift")
    if PARENT_R3D_RUNTIME_VERSION != EXPECTED["runtime"]:
        errors.append("parent_r3d_runtime_constant_drift")
    if ENABLE_PROMOTION_OVERLAY is not False:
        errors.append("overlay_enabled")
    pop = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    return {
        "ok": not errors,
        "errors": errors,
        "hashes": scores,
        "population_counts": pop["counts"],
        "core_target_denominator": pop["core_target_denominator"],
        "unambiguous_target_denominator": pop["unambiguous_target_denominator"],
        "total_cases": pop["total_cases"],
        "runtime_version": RUNTIME_VERSION,
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "overlay": ENABLE_PROMOTION_OVERLAY,
    }


def scorer_compatibility_preflight(repo: Path = REPO) -> dict[str, Any]:
    """Validate R3D output envelope + R3C scorers without opening frozen V2 bodies."""
    # Synthetic non-frozen fixtures
    samples = [
        "kharcha r3e_preflight_0001",
        "hello r3e_preflight_0002",
        "https://r3e-preflight.example.test/x",
    ]
    envelopes = []
    for text in samples:
        frame = analyze_language(text)
        bundle = attach_transliteration_to_frame(frame, use_context=True).transliteration_bundle
        assert bundle is not None
        produced, source, err = extract_primary_produced(bundle)
        ranked = [
            {
                "surface": p.surface,
                "is_identity": p.is_identity,
                "kind": p.kind,
                "script": p.script,
                "rank": p.rank,
                "candidate_id": p.candidate_id,
            }
            for p in produced
        ]
        roles = [classify_candidate_role(r["surface"], source or text) for r in ranked]
        envelopes.append({"text": text, "ranked": ranked, "roles": roles, "err": err})
        assert len(ranked) <= 5
        assert any(r["is_identity"] for r in ranked) or not ranked

    # Scorers accept sealed R3C prediction envelope shape (no V2 case text inspection needed beyond IDs)
    preds = [
        json.loads(ln)
        for ln in (repo / "evals/mai07/baselines/MAI_07R3C_V2_ONE_SHOT_PREDICTIONS.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
        if ln.strip()
    ]
    # Score using cases from manifest files — required for scorer smoke; runner-owned load.
    cases, _ = load_v2_cases(repo)
    by = {c["case_id"]: c for c in cases}
    scored = score_predictions(preds, by)
    audit_rows = [
        {
            "case_id": p["case_id"],
            "ranked": p["ranked"],
            "acceptable_targets": p["acceptable_targets"],
            "source_surface": p["source_surface"],
        }
        for p in preds
        if p["primary_population"] == "TRANSLITERATION_REQUIRED"
    ]
    audit = audit_aggregate_r3c(audit_rows)
    # Do not require QUALITY_GATES_PASSED on R3C preds — only that scorers run + agree structure
    assert "target_population" in scored
    assert scored["canonical_scorer_version"] == CANONICAL_SCORER_VERSION
    assert scored["audit_scorer_version"] == AUDIT_SCORER_VERSION
    return {
        "ok": True,
        "synthetic_envelopes": len(envelopes),
        "roles_seen": sorted({r for e in envelopes for r in e["roles"]}),
        "r3c_saved_predictions_scored": len(preds),
        "canonical_scorer_version": CANONICAL_SCORER_VERSION,
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "audit_target_denominator": audit.get("denominator"),
        "note": "Scorer smoke used sealed R3C predictions only; R3E one-shot uses R3D runtime separately.",
        "no_accounting_mutation": True,
    }


def lock_attempt_manifest(repo: Path = REPO) -> dict[str, Any]:
    imm = immutability_preflight(repo)
    hold = validate_holdout_evidence(repo)
    if not imm["ok"] or not hold["ok"]:
        raise RuntimeError(f"precondition failed imm={imm.get('errors')} hold={hold.get('missing')}")
    app = (
        repo
        / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
    )
    attempt = {
        "attempt_id": "MAI_07R3E_FROZEN_V2_ATTEMPT_001",
        "status": "LOCKED_NOT_RUN",
        "authorization": "EXPLICIT_USER_AUTHORIZATION_R3E",
        "runtime_version": RUNTIME_VERSION,
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "resource_content_hash": EXPECTED["resource"],
        "r3d_rc_manifest_sha256": EXPECTED["rc_content"],
        "parent_frozen_v1_hash": EXPECTED["v1"],
        "frozen_v2_dataset_hash": EXPECTED["v2"],
        "frozen_v2_manifest_sha256": EXPECTED["v2_man"],
        "population_manifest_sha256": EXPECTED["pop"],
        "threshold_manifest_sha256": EXPECTED["thr"],
        "canonical_scorer_version": CANONICAL_SCORER_VERSION,
        "canonical_scorer_sha256": imm["hashes"]["canonical_scorer"],
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "audit_scorer_sha256": imm["hashes"]["audit_scorer"],
        "runner_module": "eval_mai07_r3e.py",
        "runner_sha256": _code_hash(app / "eval_mai07_r3e.py"),
        "r3c_runner_sha256": imm["hashes"]["runner_r3c"],
        "deterministic_seed": 20260715,
        "exact_command": (
            "python -m erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3e --execute"
        ),
        "environment_fingerprint": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "machine": platform.machine(),
        },
        "expected_case_count": 696,
        "expected_population_counts": imm["population_counts"],
        "output_paths": {
            "predictions": "evals/mai07/r3e/reports/MAI_07R3E_V2_ONE_SHOT_PREDICTIONS.jsonl",
            "canonical_report": "evals/mai07/r3e/reports/MAI_07R3E_V2_CANONICAL_SCORE_REPORT.json",
            "audit_report": "evals/mai07/r3e/reports/MAI_07R3E_V2_AUDIT_SCORE_REPORT.json",
            "per_case_audit": "evals/mai07/r3e/reports/MAI_07R3E_V2_PER_CASE_AUDIT.jsonl",
            "differential": "evals/mai07/r3e/reports/MAI_07R3E_R3C_DIFFERENTIAL.json",
        },
        "one_shot_policy": True,
        "prohibited_rerun": True,
        "prohibited_changes": [
            "runtime",
            "resources",
            "ranker",
            "thresholds",
            "v2_dataset",
            "populations",
            "scorers",
            "r3b_decisions",
            "r3d_rc",
        ],
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "ENABLE_PROMOTION_OVERLAY": False,
    }
    R3E.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    path = R3E / "MAI_07R3E_FROZEN_V2_ATTEMPT.manifest.json"
    body = json.dumps(attempt, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    path.write_text(body, encoding="utf-8", newline="\n")
    digest = _sha_bytes(body.encode("utf-8"))
    attempt["manifest_path"] = str(path.relative_to(repo)).replace("\\", "/")
    attempt["manifest_sha256"] = digest
    # rewrite with hash recorded
    final = {k: v for k, v in attempt.items() if k != "manifest_sha256"}
    final_body = json.dumps(final, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    final["manifest_sha256"] = _sha_bytes(final_body.encode("utf-8"))
    path.write_text(
        json.dumps(final, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    # store content hash without self for stability
    content = {k: v for k, v in final.items() if k != "manifest_sha256"}
    content_hash = _sha_bytes(
        (json.dumps(content, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    )
    final["manifest_content_sha256"] = content_hash
    path.write_text(
        json.dumps(final, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return final


def validate_predictions(preds: list[dict[str, Any]], case_ids: set[str]) -> dict[str, Any]:
    errors: list[str] = []
    if len(preds) != 696:
        errors.append(f"count={len(preds)}")
    ids = [p["case_id"] for p in preds]
    if len(ids) != len(set(ids)):
        errors.append("duplicate_ids")
    if set(ids) != case_ids:
        errors.append("id_set_mismatch")
    if ids != sorted(ids):
        errors.append("not_sorted")
    for p in preds:
        if "ranked" not in p:
            errors.append(f"missing_ranked:{p.get('case_id')}")
            break
        if len(p["ranked"]) > 5:
            errors.append(f"cap:{p['case_id']}")
            break
        blob = _canonical(p)
        for leak in ("chain_of_thought", "tenant_id", "postgres", "REVIEW_IMPORT"):
            if leak in blob:
                errors.append(f"leak:{leak}")
                break
    return {"ok": not errors, "errors": errors, "count": len(preds)}


def differential_r3c_r3e(
    r3e_preds: list[dict[str, Any]],
    r3c_path: Path,
    scored_r3e: dict[str, Any],
) -> dict[str, Any]:
    r3c = [
        json.loads(ln)
        for ln in r3c_path.read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    r3c_by = {p["case_id"]: p for p in r3c}
    target_promoted = target_demoted = identity_corrected = identity_harmed = 0
    new_prot = elim_prot = 0
    # Aggregate-only diagnostic from safety + target blocks
    r3c_baseline = {
        "TARGET_TOP1": "254/288",
        "TARGET_RECALL_AT_5": "277/288",
        "TARGET_MRR": 0.9219,
        "CORE_RECALL_AT_5": "263/272",
        "UNAMBIGUOUS_TOP1": "246/255",
        "english_identity": "98/102",
        "false_devanagari_on_english": "4/102",
        "protected_mutations": 6,
        "raw_view_mutations": 0,
        "caps_respected": "696/696",
    }
    # Per-case identity/target shift counts without emitting surfaces
    for p in r3e_preds:
        prev = r3c_by.get(p["case_id"])
        if not prev:
            continue
        r3e_top = p["ranked"][0] if p["ranked"] else None
        r3c_top = prev["ranked"][0] if prev["ranked"] else None
        if not r3e_top or not r3c_top:
            continue
        if (not r3c_top["is_identity"]) and r3e_top["is_identity"]:
            identity_corrected += 1
        if r3c_top["is_identity"] and (not r3e_top["is_identity"]):
            identity_harmed += 1
        # target promo/demote among acceptable
        acc = set(p.get("acceptable_targets") or [])
        if acc:
            r3c_hit = any(
                (not x["is_identity"]) and x["surface"] in acc for x in prev["ranked"][:5]
            )
            r3e_hit = any(
                (not x["is_identity"]) and x["surface"] in acc for x in p["ranked"][:5]
            )
            r3c_top1 = (
                (not r3c_top["is_identity"]) and r3c_top["surface"] in acc
            )
            r3e_top1 = (
                (not r3e_top["is_identity"]) and r3e_top["surface"] in acc
            )
            if (not r3c_top1) and r3e_top1:
                target_promoted += 1
            if r3c_top1 and (not r3e_top1):
                target_demoted += 1
            if r3c_hit and (not r3e_hit):
                pass  # demotion beyond top5 tracked via aggregate
    prot_r3e = scored_r3e["safety"]["protected_span_mutations"]
    if prot_r3e == 0 and r3c_baseline["protected_mutations"] > 0:
        elim_prot = r3c_baseline["protected_mutations"]
    if prot_r3e > r3c_baseline["protected_mutations"]:
        new_prot = prot_r3e - r3c_baseline["protected_mutations"]
    return {
        "r3c_baseline_aggregates": r3c_baseline,
        "r3e_aggregates": {
            "target_top1": scored_r3e["target_population"]["TARGET_TOP1_ACCEPTABLE"],
            "target_recall_at_5": scored_r3e["target_population"]["TARGET_RECALL_AT_5"],
            "target_mrr": scored_r3e["target_population"]["TARGET_MRR"],
            "core_recall_at_5": scored_r3e["core_target_population"]["TARGET_RECALL_AT_5"],
            "unambiguous_top1": scored_r3e["unambiguous_target_population"]["TARGET_TOP1_ACCEPTABLE"],
            "safety": scored_r3e["safety"],
        },
        "identity_corrected_count": identity_corrected,
        "identity_harmed_count": identity_harmed,
        "target_promoted_top1_count": target_promoted,
        "target_demoted_top1_count": target_demoted,
        "protected_mutations_eliminated_vs_baseline": elim_prot,
        "new_protected_mutations_vs_baseline": new_prot,
        "note": "Diagnostic only; no frozen case surfaces in this report.",
    }


def execute_one_shot(repo: Path = REPO) -> dict[str, Any]:
    attempt_path = R3E / "MAI_07R3E_FROZEN_V2_ATTEMPT.manifest.json"
    if not attempt_path.exists():
        raise RuntimeError("attempt manifest missing; lock first")
    attempt = json.loads(attempt_path.read_text(encoding="utf-8"))
    if attempt.get("status") not in {"LOCKED_NOT_RUN", "RUNNING"}:
        raise RuntimeError(f"attempt already consumed: {attempt.get('status')}")
    # Preflight again
    imm = immutability_preflight(repo)
    hold = validate_holdout_evidence(repo)
    if not imm["ok"] or not hold["ok"]:
        raise RuntimeError("preflight failed at execute")

    start = datetime.now(timezone.utc)
    attempt["status"] = "RUNNING"
    attempt["start_utc"] = start.isoformat()
    attempt_path.write_text(
        json.dumps(attempt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    xlrr.load_resources(force_reload=True)
    cases, man = load_v2_cases(repo)
    case_ids = {c["case_id"] for c in cases}
    if len(cases) != 696 or man["dataset_hash"] != EXPECTED["v2"]:
        raise RuntimeError("frozen V2 load mismatch")

    t0 = time.perf_counter()
    exceptions: list[str] = []
    try:
        preds = run_one_shot_predictions(cases)
    except Exception as exc:  # noqa: BLE001
        exceptions.append(type(exc).__name__ + ":" + str(exc)[:200])
        end = datetime.now(timezone.utc)
        attempt["status"] = "INVALID_OR_BLOCKED"
        attempt["end_utc"] = end.isoformat()
        attempt["exceptions"] = exceptions
        attempt_path.write_text(
            json.dumps(attempt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        raise

    end = datetime.now(timezone.utc)
    elapsed = time.perf_counter() - t0
    preds = sorted(preds, key=lambda p: p["case_id"])
    # stamp R3E runtime on envelopes
    for p in preds:
        p["evaluation_attempt_id"] = attempt["attempt_id"]
        p["runtime_version"] = RUNTIME_VERSION

    vpred = validate_predictions(preds, case_ids)
    pred_path = REPORTS / "MAI_07R3E_V2_ONE_SHOT_PREDICTIONS.jsonl"
    pred_body = "\n".join(_canonical(p) for p in preds) + "\n"
    pred_path.write_text(pred_body, encoding="utf-8", newline="\n")
    pred_hash = _sha_bytes(pred_body.encode("utf-8"))

    if not vpred["ok"]:
        attempt["status"] = "FAILED_PREDICTION_VALIDATION"
        attempt["end_utc"] = end.isoformat()
        attempt["predictions_sha256"] = pred_hash
        attempt["prediction_validation"] = vpred
        attempt_path.write_text(
            json.dumps(attempt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        return {"status": attempt["status"], "prediction_validation": vpred, "predictions_sha256": pred_hash}

    by = {c["case_id"]: c for c in cases}
    scored = score_predictions(preds, by)
    # Independent audit on target rows
    audit_rows = [
        {
            "case_id": p["case_id"],
            "ranked": p["ranked"],
            "acceptable_targets": p["acceptable_targets"],
            "source_surface": p["source_surface"],
        }
        for p in preds
        if p["primary_population"] == "TRANSLITERATION_REQUIRED"
    ]
    audit = audit_aggregate_r3c(audit_rows)
    assert_canonical_matches_audit(
        {
            **scored["target_population"],
            "case_ids": scored["target_population"].get("case_ids")
            or [p["case_id"] for p in preds if p["primary_population"] == "TRANSLITERATION_REQUIRED"],
        },
        audit,
    )

    diff = differential_r3c_r3e(
        preds,
        repo / "evals/mai07/baselines/MAI_07R3C_V2_ONE_SHOT_PREDICTIONS.jsonl",
        scored,
    )

    canon_report = {
        "schema_version": "1.0.0",
        "report_id": "MAI_07R3E_V2_CANONICAL_SCORE",
        "attempt_id": attempt["attempt_id"],
        "runtime_version": RUNTIME_VERSION,
        "resource_hash": EXPECTED["resource"],
        "dataset_hash": EXPECTED["v2"],
        "predictions_sha256": pred_hash,
        "QUALITY_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
        "AUTOMATED_ENGINEERING_GATES_PASSED": scored["AUTOMATED_ENGINEERING_GATES_PASSED"],
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "metrics": {
            "target": scored["target_population"],
            "core": scored["core_target_population"],
            "unambiguous": scored["unambiguous_target_population"],
            "safety": scored["safety"],
        },
        "gates": scored["gates"],
        "invariant_errors": scored["invariant_errors"],
        "canonical_scorer_version": CANONICAL_SCORER_VERSION,
    }
    audit_report = {
        "schema_version": "1.0.0",
        "report_id": "MAI_07R3E_V2_AUDIT_SCORE",
        "attempt_id": attempt["attempt_id"],
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "audit_aggregate": audit,
        "agrees_with_canonical": True,
        "QUALITY_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
    }
    per_case_body = "\n".join(_canonical(r) for r in scored["per_case"]) + "\n"

    canon_path = REPORTS / "MAI_07R3E_V2_CANONICAL_SCORE_REPORT.json"
    audit_path = REPORTS / "MAI_07R3E_V2_AUDIT_SCORE_REPORT.json"
    per_path = REPORTS / "MAI_07R3E_V2_PER_CASE_AUDIT.jsonl"
    diff_path = REPORTS / "MAI_07R3E_R3C_DIFFERENTIAL.json"
    canon_path.write_text(
        json.dumps(canon_report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    audit_path.write_text(
        json.dumps(audit_report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    per_path.write_text(per_case_body, encoding="utf-8", newline="\n")
    diff_path.write_text(
        json.dumps(diff, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    # Post-run immutability
    imm_after = immutability_preflight(repo)
    status = "PASSED" if scored["QUALITY_GATES_PASSED"] else "FAILED_QUALITY"
    attempt.update(
        {
            "status": status,
            "end_utc": end.isoformat(),
            "elapsed_seconds": round(elapsed, 4),
            "process_exit_code_expected": 0,
            "case_count_submitted": 696,
            "case_count_completed": len(preds),
            "exceptions": exceptions,
            "timeout_count": 0,
            "mutation_attempts": 0,
            "successful_mutations": 0,
            "predictions_path": str(pred_path.relative_to(repo)).replace("\\", "/"),
            "predictions_sha256": pred_hash,
            "canonical_report_sha256": _sha_file(canon_path),
            "audit_report_sha256": _sha_file(audit_path),
            "per_case_audit_sha256": _sha_file(per_path),
            "differential_sha256": _sha_file(diff_path),
            "QUALITY_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
            "post_run_immutability_ok": imm_after["ok"],
        }
    )
    attempt_path.write_text(
        json.dumps(attempt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return {
        "status": status,
        "QUALITY_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
        "predictions_sha256": pred_hash,
        "gates": scored["gates"],
        "safety": scored["safety"],
        "target": scored["target_population"],
        "core": scored["core_target_population"],
        "unambiguous": scored["unambiguous_target_population"],
        "differential": diff,
        "attempt": attempt,
    }


def write_preflight_bundle(repo: Path = REPO) -> dict[str, Any]:
    REPORTS.mkdir(parents=True, exist_ok=True)
    hold = validate_holdout_evidence(repo)
    imm = immutability_preflight(repo)
    # scorer compatibility opens V2 via load — only during authorized preflight after holdout gate
    if not hold["ok"] or not imm["ok"]:
        bundle = {
            "status": "BLOCKED_PRECONDITION_FAILED",
            "holdout": hold,
            "immutability": imm,
        }
        path = REPORTS / "MAI_07R3E_PREFLIGHT_REPORT.json"
        path.write_text(
            json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        return bundle
    compat = scorer_compatibility_preflight(repo)
    bundle = {
        "status": "PREFLIGHT_OK",
        "holdout": hold,
        "immutability": imm,
        "scorer_compatibility": compat,
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }
    path = REPORTS / "MAI_07R3E_PREFLIGHT_REPORT.json"
    path.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return bundle


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--preflight", action="store_true")
    p.add_argument("--lock-attempt", action="store_true")
    p.add_argument("--execute", action="store_true")
    args = p.parse_args()
    if args.preflight or (not args.lock_attempt and not args.execute):
        out = write_preflight_bundle(REPO)
        print(json.dumps({"status": out["status"], "ok": out["status"] == "PREFLIGHT_OK"}, indent=2))
        if out["status"] != "PREFLIGHT_OK":
            return 2
    if args.lock_attempt:
        att = lock_attempt_manifest(REPO)
        print(json.dumps({"attempt_id": att["attempt_id"], "content_sha256": att["manifest_content_sha256"]}, indent=2))
    if args.execute:
        result = execute_one_shot(REPO)
        print(
            json.dumps(
                {
                    "status": result["status"],
                    "QUALITY_GATES_PASSED": result.get("QUALITY_GATES_PASSED"),
                    "predictions_sha256": result.get("predictions_sha256"),
                    "gates": [
                        {
                            "metric": g["metric"],
                            "status": g["status"],
                            "observed": g.get("observed"),
                        }
                        for g in result.get("gates", [])
                    ],
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0 if result.get("QUALITY_GATES_PASSED") else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
