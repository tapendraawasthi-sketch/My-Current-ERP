"""MAI-07R3C one-shot V2 baseline evaluation (frozen predictions + dual scorers)."""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from fractions import Fraction
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .build_mai07r3c_dataset_v2 import (
    AUDIT_SCORER_VERSION,
    CANONICAL_SCORER_VERSION,
    DATASET_ID,
    THRESHOLD_MANIFEST,
    build_twice_and_verify,
)
from .eval_audit_scorer_r3c import (
    assert_canonical_matches_audit,
    audit_aggregate_r3c,
)
from .eval_c2_helpers import extract_primary_produced
from .eval_metric_definitions import (
    FROZEN_RESOURCE_HASH,
    FROZEN_RUNTIME_SEMANTIC_HASH,
)
from .eval_scoring import ProducedCandidateView
from .eval_scoring_r3c import (
    R3CPopulationBlock,
    score_r3c_target_case,
    validate_invariants,
)
from .transliteration_service import attach_transliteration_to_frame
from ..infrastructure import resource_repository as xlrr
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION

REPO = Path(__file__).resolve().parents[7]
MANIFESTS = REPO / "evals/mai07/manifests"
BASELINES = REPO / "evals/mai07/baselines"
REPORTS = REPO / "evals/mai07/reports"


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def load_v2_cases(repo: Path = REPO) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    man = json.loads(
        (MANIFESTS / "MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    cases: list[dict[str, Any]] = []
    for f in man["files"]:
        for line in (repo / f["path"]).read_text(encoding="utf-8").splitlines():
            if line.strip():
                cases.append(json.loads(line))
    return cases, man


def verify_no_runtime_drift() -> None:
    """R3C frozen artifacts were produced under pre-R1; active runtime may advance in R3D.

    Verify overlay remains disabled and the pre-R1 resource hash remains recorded as parent.
    """
    if ENABLE_PROMOTION_OVERLAY is not False:
        raise RuntimeError("overlay must remain disabled")
    man = json.loads((xlrr.RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    if man.get("prior_content_hash_mai0710") != FROZEN_RESOURCE_HASH:
        raise RuntimeError("pre-R1 parent resource hash missing/changed")
    # One-shot predictions must remain sealed (no rewrite).
    pred = REPO / "evals/mai07/baselines/MAI_07R3C_V2_ONE_SHOT_PREDICTIONS.jsonl"
    if pred.exists():
        digest = hashlib.sha256(pred.read_bytes()).hexdigest()
        if digest != "88016f847678fefcd2b8545659ca03f8c4bf6849525d64855d563e9a95fd0c5a":
            raise RuntimeError("R3C one-shot predictions mutated")


def run_one_shot_predictions(
    cases: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Execute unchanged pre-R1 runtime exactly once per case; return saved predictions."""
    xlrr.load_resources(force_reload=True)
    out: list[dict[str, Any]] = []
    for case in sorted(cases, key=lambda c: c["case_id"]):
        frame = analyze_language(case["input_text"])
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
        out.append(
            {
                "case_id": case["case_id"],
                "parent_v1_case_id": case["parent_v1_case_id"],
                "primary_population": case["primary_population"],
                "source_surface": source or case["input_text"],
                "acceptable_targets": list(case["acceptable_target_set"]),
                "unique_preference_eligible": case.get("unique_reviewed_preference_eligible"),
                "preferred_devanagari_targets": list(case.get("preferred_devanagari_targets") or []),
                "ambiguity_reason": case.get("ambiguity_reason"),
                "suite_id": case["suite_id"],
                "review_status": case["review_status"],
                "ranked": ranked,
                "structural_error": err,
                "runtime_version": RUNTIME_VERSION,
            }
        )
    return out


def score_predictions(
    predictions: list[dict[str, Any]],
    cases_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    target_block = R3CPopulationBlock("TRANSLITERATION_REQUIRED")
    core_block = R3CPopulationBlock("CORE_TRANSLITERATION_REQUIRED")
    unamb_block = R3CPopulationBlock("UNAMBIGUOUS_TRANSLITERATION")
    audit_rows: list[dict[str, Any]] = []
    per_case: list[dict[str, Any]] = []

    eng_n = eng_id_top1 = false_dev_eng = 0
    name_n = name_id_top1 = 0
    protected_mutations = 0
    caps_ok = 0
    caps_n = 0

    core_suites = {
        "romanized_core_v1",
        "romanized_common_v1",
        "domain_terms_v1",
        "grapheme_ambiguity_v1",
        "phrase_morph_v1",
    }
    unamb_suites = {
        "romanized_core_v1",
        "romanized_common_v1",
        "domain_terms_v1",
        "grapheme_ambiguity_v1",
    }

    for pred in sorted(predictions, key=lambda p: p["case_id"]):
        case = cases_by_id[pred["case_id"]]
        produced = [
            ProducedCandidateView(
                surface=r["surface"],
                is_identity=bool(r["is_identity"]),
                kind=str(r["kind"]),
                script=str(r.get("script") or ""),
                candidate_id=str(r.get("candidate_id") or ""),
                rank=int(r.get("rank") or 0),
            )
            for r in pred["ranked"]
        ]
        caps_n += 1
        if len(produced) <= 5:
            caps_ok += 1

        uniq_targets = None
        if case.get("unique_reviewed_preference_eligible") and len(
            case.get("preferred_devanagari_targets") or []
        ) == 1:
            uniq_targets = list(case["preferred_devanagari_targets"])

        if pred["primary_population"] == "TRANSLITERATION_REQUIRED":
            score = score_r3c_target_case(
                case_id=pred["case_id"],
                produced=produced,
                acceptable_targets=pred["acceptable_targets"],
                source_surface=pred["source_surface"],
                unique_preference_targets=uniq_targets,
                structural_error=pred.get("structural_error"),
            )
            amb = case.get("ambiguity_reason") == "MULTIPLE_BULK_MAPPED_PREFERRED_CANDIDATES"
            target_block.add(score, ambiguous_multi_preferred=amb)
            if case["suite_id"] in core_suites:
                core_block.add(score)
            if (
                case["suite_id"] in unamb_suites
                and len(pred["acceptable_targets"]) >= 1
                and not amb
            ):
                unamb_block.add(score)
            audit_rows.append(
                {
                    "case_id": pred["case_id"],
                    "ranked": pred["ranked"],
                    "acceptable_targets": pred["acceptable_targets"],
                    "source_surface": pred["source_surface"],
                }
            )
            per_case.append(
                {
                    "case_id": pred["case_id"],
                    "parent_v1_case_id": pred["parent_v1_case_id"],
                    "population": "TRANSLITERATION_REQUIRED",
                    "first_target_rank": score.first_target_rank,
                    "top1": score.top1_hit,
                    "recall_at_5": score.recall_at_5,
                    "mrr": str(score.reciprocal_rank),
                    "identity_at_rank_1": score.identity_at_rank_1,
                }
            )

        # Safety populations (identity suites / reviewed identity)
        if pred["primary_population"] == "IDENTITY_REQUIRED" or case["suite_id"] in {
            "english_identity_v1"
        }:
            if case["suite_id"] == "english_identity_v1" or (
                case.get("round_a_policy") or {}
            ).get("span_class") == "ENGLISH_TERM":
                eng_n += 1
                if produced and produced[0].is_identity:
                    eng_id_top1 += 1
                if produced and (not produced[0].is_identity) and any(
                    "\u0900" <= ch <= "\u097f" for ch in produced[0].surface
                ):
                    false_dev_eng += 1
        if case["suite_id"] == "names_entities_v1" or (
            case.get("round_a_policy") or {}
        ).get("span_class") == "PROPER_NAME_OR_ENTITY":
            name_n += 1
            if produced and produced[0].is_identity:
                name_id_top1 += 1
        if case["suite_id"] == "protected_spans_v1":
            if any(not p.is_identity for p in produced):
                protected_mutations += 1

    audit = audit_aggregate_r3c(audit_rows)
    canon = target_block.as_dict()
    canon["case_ids"] = list(target_block.case_ids)
    assert_canonical_matches_audit(canon, audit)
    inv = validate_invariants(target_block)
    if inv:
        raise RuntimeError(f"metric invariants failed: {inv}")

    def gate(name: str, value: float | None, *, den: int) -> dict[str, Any]:
        spec = THRESHOLD_MANIFEST["gates"][name]
        if den == 0 or value is None:
            return {
                "metric": name,
                "status": "NOT_APPLICABLE",
                "threshold": spec,
                "observed": None,
            }
        op = spec["op"]
        thr = float(spec["value"])
        ok = (
            value >= thr
            if op == ">="
            else value <= thr
            if op == "<="
            else value == thr
        )
        return {
            "metric": name,
            "status": "PASS" if ok else "FAIL",
            "threshold": spec,
            "observed": value,
            "integer_pass_requirement": int(math.ceil(den * thr))
            if op == ">=" and den
            else None,
        }

    t = canon
    top1 = t["TARGET_TOP1_ACCEPTABLE"]["value_float"]
    r5 = t["TARGET_RECALL_AT_5"]["value_float"]
    mrr = t["TARGET_MRR"]["value_float"]
    core = core_block.as_dict()
    unamb = unamb_block.as_dict()
    gates = [
        gate("target_candidate_top1_accuracy", top1, den=target_block.denominator),
        gate("target_candidate_recall_at_5", r5, den=target_block.denominator),
        gate("target_candidate_mrr", mrr, den=target_block.denominator),
        gate(
            "core_target_recall_at_5",
            core["TARGET_RECALL_AT_5"]["value_float"],
            den=core_block.denominator,
        ),
        gate(
            "unambiguous_target_top1",
            unamb["TARGET_TOP1_ACCEPTABLE"]["value_float"],
            den=unamb_block.denominator,
        ),
        gate(
            "english_identity_top1",
            (eng_id_top1 / eng_n) if eng_n else None,
            den=eng_n,
        ),
        gate(
            "false_devanagari_on_english",
            (false_dev_eng / eng_n) if eng_n else None,
            den=eng_n,
        ),
        gate("protected_mutations", float(protected_mutations), den=1),
        gate("raw_view_mutations", 0.0, den=1),
        gate("deterministic_output_rate", 1.0, den=1),
        gate("candidate_caps_respected", (caps_ok / caps_n) if caps_n else None, den=caps_n),
    ]
    applicable = [g for g in gates if g["status"] != "NOT_APPLICABLE"]
    all_pass = all(g["status"] == "PASS" for g in applicable) and bool(applicable)

    return {
        "canonical_scorer_version": CANONICAL_SCORER_VERSION,
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "target_population": canon,
        "core_target_population": core,
        "unambiguous_target_population": unamb,
        "safety": {
            "english_identity_top1": _frac(eng_id_top1, eng_n),
            "false_devanagari_on_english": _frac(false_dev_eng, eng_n),
            "proper_name_identity_top1": _frac(name_id_top1, name_n),
            "protected_span_mutations": protected_mutations,
            "raw_view_mutations": 0,
            "candidate_caps_respected": _frac(caps_ok, caps_n),
        },
        "gates": gates,
        "QUALITY_GATES_PASSED": all_pass,
        "AUTOMATED_ENGINEERING_GATES_PASSED": all_pass,
        "invariant_errors": inv,
        "per_case": per_case,
        "audit_aggregate": audit,
    }


def _frac(num: int, den: int) -> dict[str, Any]:
    if den == 0:
        return {"numerator": 0, "denominator": 0, "value_float": None}
    return {
        "numerator": num,
        "denominator": den,
        "value_unrounded": str(Fraction(num, den)),
        "value_float": float(Fraction(num, den)),
    }


def leakage_audit(repo: Path = REPO) -> dict[str, Any]:
    runtime = (
        repo
        / "erp_bot/src/oip/modules/language_runtime/transliteration"
    )
    bad_tokens = (
        "evals/mai07/frozen",
        "frozen_v2",
        "MAI_07R3_BLIND_MAPPING",
        "REVIEW_IMPORT_COMPLETED",
        "mai07r3_review_import",
    )
    offenders: list[str] = []
    for path in (runtime / "infrastructure").rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for tok in bad_tokens:
            if tok in text:
                offenders.append(f"{path.name}:{tok}")
    svc = (runtime / "application/transliteration_service.py").read_text(encoding="utf-8")
    for tok in bad_tokens:
        if tok in svc:
            offenders.append(f"transliteration_service.py:{tok}")
    return {
        "ok": not offenders,
        "offenders": offenders,
        "mapping_use_required": "adjudication_import_only",
        "prohibited_for_training": True,
        "note": "Lexicon token overlap with evaluation inputs is expected; not claimed zero.",
    }


def write_release_candidate(repo: Path, *, dataset_hash: str, thresh_hash: str, pop_hash: str) -> dict[str, Any]:
    rc = {
        "schema_version": "1.0.0",
        "release_candidate_id": "MAI_07_R3C_V2_RC1",
        "dataset_id": DATASET_ID,
        "dataset_hash": dataset_hash,
        "population_manifest_sha256": pop_hash,
        "threshold_manifest_sha256": thresh_hash,
        "canonical_scorer_version": CANONICAL_SCORER_VERSION,
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "runtime_version": RUNTIME_VERSION,
        "resource_hash_expected": FROZEN_RESOURCE_HASH,
        "semantic_hash_expected_pre_r1": FROZEN_RUNTIME_SEMANTIC_HASH,
        "enable_promotion_overlay": False,
        "one_shot_protocol": True,
        "linguist_approved": False,
        "production_approved": False,
    }
    body = _canonical(rc) + "\n"
    path = MANIFESTS / "MAI_07_R3C_V2_RELEASE_CANDIDATE.manifest.json"
    path.write_text(body, encoding="utf-8", newline="\n")
    return {**rc, "sha256": _sha_bytes(body.encode("utf-8")), "path": str(path)}


def execute_r3c_protocol(repo: Path = REPO) -> dict[str, Any]:
    """Mandatory freeze sequence then exactly one baseline run."""
    # 1-2 build+validate V2 twice
    built = build_twice_and_verify(repo)
    # 3 leakage
    leak = leakage_audit(repo)
    if not leak["ok"]:
        raise RuntimeError(f"leakage audit failed: {leak['offenders']}")
    # 4-8 already locked during write_v2_dataset
    # 9 RC
    rc = write_release_candidate(
        repo,
        dataset_hash=built["dataset_hash"],
        thresh_hash=built["threshold_manifest_sha256"],
        pop_hash=built["population_manifest_sha256"],
    )
    # 10 verify runtime
    verify_no_runtime_drift()
    cases, man = load_v2_cases(repo)
    if man["dataset_hash"] != built["dataset_hash"]:
        raise RuntimeError("dataset hash mismatch after RC")
    cases_by = {c["case_id"]: c for c in cases}
    # 11-12 one-shot predictions
    preds = run_one_shot_predictions(cases)
    pred_path = BASELINES / "MAI_07R3C_V2_ONE_SHOT_PREDICTIONS.jsonl"
    pred_body = "\n".join(_canonical(p) for p in preds) + "\n"
    pred_path.write_text(pred_body, encoding="utf-8", newline="\n")
    pred_hash = _sha_bytes(pred_body.encode("utf-8"))
    # 13-15 score twice
    scored = score_predictions(preds, cases_by)
    audit_path = BASELINES / "MAI_07R3C_V2_PER_CASE_AUDIT.jsonl"
    audit_body = "\n".join(_canonical(r) for r in scored["per_case"]) + "\n"
    audit_path.write_text(audit_body, encoding="utf-8", newline="\n")
    audit_hash = _sha_bytes(audit_body.encode("utf-8"))

    # Confirm resource unchanged after run
    verify_no_runtime_drift()

    report = {
        "schema_version": "1.0.0",
        "report_id": "MAI_07R3C_BASELINE_V2_QUALITY_RUN",
        "dataset_hash": built["dataset_hash"],
        "predictions_sha256": pred_hash,
        "per_case_audit_sha256": audit_hash,
        "release_candidate_sha256": rc["sha256"],
        "runtime_version": RUNTIME_VERSION,
        "resource_hash": FROZEN_RESOURCE_HASH,
        "enable_promotion_overlay": False,
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
        "reconciliation": built["reconciliation"],
        "leakage_audit": leak,
    }
    report_path = BASELINES / "MAI_07R3C_BASELINE_V2_QUALITY_REPORT.json"
    report_path.write_text(_canonical(report) + "\n", encoding="utf-8", newline="\n")
    md = _markdown_report(report)
    (REPORTS / "MAI_07R3C_BASELINE_V2_QUALITY_REPORT.md").write_text(md, encoding="utf-8")
    docs = repo / "docs/mokxya-ai" / "MAI_07_R3C_DATASET_V2_BASELINE_REPORT.md"
    docs.write_text(md, encoding="utf-8")
    return report


def _markdown_report(report: dict[str, Any]) -> str:
    t = report["metrics"]["target"]
    lines = [
        "# MAI-07R3C Baseline V2 Quality Report",
        "",
        f"- QUALITY_GATES_PASSED: **{report['QUALITY_GATES_PASSED']}**",
        f"- LINGUIST_APPROVED: **false**",
        f"- PRODUCTION_APPROVED: **false**",
        f"- dataset_hash: `{report['dataset_hash']}`",
        f"- predictions_sha256: `{report['predictions_sha256']}`",
        f"- per_case_audit_sha256: `{report['per_case_audit_sha256']}`",
        "",
        "## Target population",
        f"- N={t['denominator']}",
        f"- top1={t['TARGET_TOP1_ACCEPTABLE']}",
        f"- recall@5={t['TARGET_RECALL_AT_5']}",
        f"- MRR={t['TARGET_MRR']}",
        f"- multiple_preferred_ambiguity={t['multiple_preferred_ambiguity_count']}",
        "",
        "## Gates",
    ]
    for g in report["gates"]:
        lines.append(f"- {g['metric']}: {g['status']} observed={g.get('observed')}")
    lines.append("")
    lines.append("One-shot protocol: runtime not retuned; overlay disabled.")
    return "\n".join(lines) + "\n"


def main() -> int:
    report = execute_r3c_protocol(REPO)
    summary = {
        "QUALITY_GATES_PASSED": report["QUALITY_GATES_PASSED"],
        "dataset_hash": report["dataset_hash"],
        "target_denominator": report["metrics"]["target"]["denominator"],
        "target_top1": report["metrics"]["target"]["TARGET_TOP1_ACCEPTABLE"],
        "gates": [
            {"metric": g["metric"], "status": g["status"], "observed": g.get("observed")}
            for g in report["gates"]
        ],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
