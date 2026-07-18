"""MAI-07R3H2 non-frozen evaluation and one-shot holdout runner (shared-collision pack).

Governance:
- Uses the R3H2 sealed pack (mai-07.1.5-r3h2-shared) explicitly via
  load_resources(resources_dir=...). Never mutates ACTIVE_PACK_VERSION or the
  historical active default (mai-07.1.3-r3f-sealnew).
- Every write (predictions, score reports, lock, attempt, qualification,
  chain) requires MAI07_AUTHORIZE_EVAL_WRITE=1. Read-only paths (--score-development
  without --write, --check-preflight) never require it.
- DEVELOPMENT scoring is required before --lock. --one-shot refuses to run a
  second time once CHAIN_PATH exists (append-only chain).
- This module does not execute holdout on import; running the holdout requires
  an explicit --one-shot invocation by an operator.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .transliteration_service import transliterate_frame
from .eval_mai07_r3h2_canonical_scorer import score_split as canonical_score_split
from .eval_mai07_r3h2_audit_scorer import compare_reports, score_split_audit
from .rc_lock_chain import (
    bind_predictions,
    build_locked_rc,
    create_attempt,
    create_lock_record,
    create_qualification_result,
)
from .. import MAX_CANDIDATES_PER_SPAN, RUNTIME_VERSION
from ..infrastructure.english_identity_guard import GUARD_VERSION, POLICY_VERSION
from ..infrastructure.r3d_safety_gate import count_protected_mutations
from ..infrastructure.resource_repository import CompactXlResources, compute_pack_content_hash, load_resources
from ..infrastructure.seal_contract_v2 import SEAL_CONTRACT_VERSION, predictions_canonical_list_sha256, sha256_file

REPO = Path(__file__).resolve().parents[7]
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
PACK_VERSION = "mai-07.1.5-r3h2-shared"
R3H2_RESOURCES_DIR = XL / "sealed_packs" / PACK_VERSION
RUNTIME_CLAIM = PACK_VERSION

OUT = REPO / "evals" / "mai07_r3h2_shared_collision"
REPORTS = OUT / "reports"
RC_ID = "MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001"
LOCKED_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
LOCK_RECORD_PATH = OUT / f"{RC_ID}.LOCK_RECORD.json"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"

AUTHORIZE_ENV = "MAI07_AUTHORIZE_EVAL_WRITE"
HOLDOUT_FAMILY_SPLITS = (
    "HOLDOUT_VALIDATION",
    "SAFETY_CHALLENGE",
    "CONTEXT_COUNTERFACTUAL",
    "OOV_GENERALIZATION",
    "MONOTONIC_PARENT_COMPARISON",
)


def _require_write_authorized() -> None:
    if os.environ.get(AUTHORIZE_ENV) != "1":
        raise PermissionError(
            f"Refusing to write MAI-07R3H2 evaluation artifacts without authorization. "
            f"Set {AUTHORIZE_ENV}=1 to explicitly authorize this write."
        )


def _r3h2_resources() -> CompactXlResources:
    return load_resources(resources_dir=R3H2_RESOURCES_DIR)


def load_split(split: str) -> list[dict[str, Any]]:
    path = OUT / f"{split.lower()}.jsonl"
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return sorted(rows, key=lambda row: row["case_id"])


def _has_devanagari(text: str) -> bool:
    return any("\u0900" <= ch <= "\u097F" for ch in text)


def _select_target_span(bundle: Any, case: dict[str, Any]):
    primary = case["primary_token"].lower()
    spans = list(bundle.span_results)
    for span in spans:
        if span.raw_span.original_text.lower() == primary:
            return span
    # Prefer single-token spans equal to primary; never promote multi-token
    # protected/merged spans (e.g. "bill ko") merely because they contain primary.
    for span in spans:
        toks = span.raw_span.original_text.lower().split()
        if len(toks) == 1 and toks[0].strip("'\"[]()") == primary:
            return span
    for span in spans:
        cleaned = span.raw_span.original_text.lower().strip("'\"[]()")
        if cleaned == primary:
            return span
    return next((span for span in spans if span.candidates and len(span.raw_span.original_text.split()) == 1), None)


def _predict_case_detailed(case: dict[str, Any], resources: CompactXlResources) -> dict[str, Any]:
    """Build the full R3H2 prediction envelope for one case.

    pre_cap_has_acceptable_target uses the simplified v1 heuristic: an
    acceptable target is considered pre-cap-present if it already survived
    the cap (post_cap true), or if the span was truncated by the per-span
    candidate cap, the top-ranked candidate is identity, the case declares
    acceptable targets, and the resource pack carries lexical/domain evidence
    for the primary token (i.e. a target candidate existed to be generated).
    """
    frame = analyze_language(case["input_text"])
    bundle = transliterate_frame(frame, resources=resources, use_context=True)
    target_span = _select_target_span(bundle, case)

    ranked: list[dict[str, Any]] = []
    for cand in target_span.candidates if target_span is not None else ():
        ranked.append(
            {
                "candidate_id": cand.candidate_id,
                "surface": cand.surface,
                "script": cand.script.value,
                "kind": cand.kind.value,
                "rank": cand.rank,
                "is_identity": cand.is_identity,
                "reason_codes": list(cand.reason_codes),
                "requires_review": cand.requires_review,
            }
        )

    acceptable_targets = set(case.get("acceptable_devanagari_targets") or [])
    post_cap_has_acceptable_target = any(
        (not c["is_identity"]) and c["surface"] in acceptable_targets for c in ranked[:5]
    )
    pre_cap_has_acceptable_target = post_cap_has_acceptable_target
    if (
        not pre_cap_has_acceptable_target
        and target_span is not None
        and target_span.truncated
        and acceptable_targets
        and ranked
        and ranked[0].get("is_identity")
    ):
        token_low = case["primary_token"].lower()
        if token_low in resources.lexicon or token_low in resources.domain_terms:
            pre_cap_has_acceptable_target = True

    disposition = target_span.disposition if target_span is not None else None
    policy_version = target_span.policy_version if target_span is not None else None
    span_review_required = bool(target_span.review_required) if target_span is not None else False
    span_review_reason_codes = list(target_span.review_reason_codes) if target_span is not None else []
    candidate_surfaces_sorted = sorted(c["surface"] for c in ranked)

    return {
        "case_id": case["case_id"],
        "source_surface": target_span.raw_span.original_text if target_span is not None else case["primary_token"],
        "ranked": ranked,
        "runtime_version": RUNTIME_VERSION,
        "runtime_claim": RUNTIME_CLAIM,
        "resource_version": resources.version,
        "policy_version": policy_version,
        "guard_version": GUARD_VERSION,
        "candidate_count": len(ranked),
        "protected_mutations": count_protected_mutations(bundle.span_results),
        "raw_ok": frame.raw_text == case["input_text"],
        "caps_ok": all(len(span.candidates) <= MAX_CANDIDATES_PER_SPAN for span in bundle.span_results),
        "span_review_required": span_review_required,
        "span_review_reason_codes": span_review_reason_codes,
        "disposition": disposition,
        "pre_cap_has_acceptable_target": pre_cap_has_acceptable_target,
        "post_cap_has_acceptable_target": post_cap_has_acceptable_target,
        "policy_invoked": disposition is not None,
        "candidate_surfaces_sorted": candidate_surfaces_sorted,
    }


def run_predictions(cases: list[dict[str, Any]], resources: CompactXlResources) -> list[dict[str, Any]]:
    return [_predict_case_detailed(case, resources) for case in cases]


def load_thresholds() -> dict[str, Any]:
    return json.loads((OUT / "MAI_07R3H2_THRESHOLDS.json").read_text(encoding="utf-8"))


def _prediction_fingerprint(pred: dict[str, Any]) -> tuple[Any, ...]:
    ranked = tuple(
        (c.get("surface"), c.get("is_identity"), c.get("rank"), c.get("requires_review"))
        for c in (pred.get("ranked") or [])
    )
    surfaces = pred.get("candidate_surfaces_sorted") or []
    return (
        pred.get("case_id"),
        ranked,
        pred.get("disposition"),
        pred.get("span_review_required"),
        tuple(pred.get("span_review_reason_codes") or ()),
        tuple(surfaces),
    )


def measure_architecture_metrics(
    cases: list[dict[str, Any]],
    predictions: list[dict[str, Any]],
    resources: CompactXlResources,
) -> dict[str, Any]:
    """Measure parity/determinism/preservation — never hard-code pass values."""
    # Determinism: repeat the same path and compare fingerprints.
    repeat = run_predictions(cases, resources)
    by_first = {_prediction_fingerprint(p) for p in predictions}
    by_repeat = {_prediction_fingerprint(p) for p in repeat}
    deterministic_matches = sum(
        1
        for a, b in zip(
            sorted(predictions, key=lambda p: p["case_id"]),
            sorted(repeat, key=lambda p: p["case_id"]),
            strict=True,
        )
        if _prediction_fingerprint(a) == _prediction_fingerprint(b)
    )
    deterministic_den = len(cases)

    # Cross-path parity: direct transliterate_frame vs analyzer+attach path when available.
    from .transliteration_service import attach_transliteration_to_frame

    parity_matches = 0
    for case, direct_pred in zip(cases, predictions, strict=True):
        frame = analyze_language(case["input_text"])
        updated = attach_transliteration_to_frame(frame, resources=resources, use_context=True)
        bundle = updated.transliteration_bundle
        assert bundle is not None
        # Rebuild a minimal comparable fingerprint from the attach path.
        target = _select_target_span(bundle, case)
        ranked = []
        if target is not None:
            for cand in target.candidates:
                ranked.append(
                    {
                        "surface": cand.surface,
                        "is_identity": cand.is_identity,
                        "rank": cand.rank,
                        "requires_review": cand.requires_review,
                    }
                )
        attach_fp = (
            case["case_id"],
            tuple((c["surface"], c["is_identity"], c["rank"], c["requires_review"]) for c in ranked),
            getattr(target, "disposition", None) if target is not None else None,
            bool(getattr(target, "review_required", False)) if target is not None else False,
            tuple(getattr(target, "review_reason_codes", ()) or ()) if target is not None else (),
            tuple(sorted(c["surface"] for c in ranked)),
        )
        if attach_fp == _prediction_fingerprint(direct_pred):
            parity_matches += 1

    preserved = sum(1 for p in predictions if bool(p.get("caps_ok")))
    return {
        "deterministic_output": {
            "numerator": deterministic_matches,
            "denominator": deterministic_den,
            "value": (deterministic_matches / deterministic_den) if deterministic_den else None,
        },
        "measured_cross_path_parity": {
            "numerator": parity_matches,
            "denominator": len(cases),
            "value": (parity_matches / len(cases)) if cases else None,
        },
        "measured_candidate_set_preservation": {
            "numerator": preserved,
            "denominator": len(cases),
            "value": (preserved / len(cases)) if cases else None,
        },
        "fingerprint_set_equal_on_repeat": by_first == by_repeat,
    }


def measure_monotonic_harm(
    cases: list[dict[str, Any]],
    candidate_preds: list[dict[str, Any]],
) -> dict[str, Any]:
    """Parent (R3F sealnew active) vs R3H2 candidate harm on MONOTONIC population."""
    parent_dir = XL / "sealed_packs" / "mai-07.1.3-r3f-sealnew"
    parent_resources = load_resources(resources_dir=parent_dir)
    parent_preds = run_predictions(cases, parent_resources)
    by_parent = {p["case_id"]: p for p in parent_preds}
    by_cand = {p["case_id"]: p for p in candidate_preds}

    def top_identity(pred: dict[str, Any]) -> bool:
        ranked = pred.get("ranked") or []
        return bool(ranked and ranked[0].get("is_identity"))

    def top_target(pred: dict[str, Any], case: dict[str, Any]) -> bool:
        ranked = pred.get("ranked") or []
        if not ranked or ranked[0].get("is_identity"):
            return False
        return ranked[0].get("surface") in set(case.get("acceptable_devanagari_targets") or [])

    english_harm = 0
    english_den = 0
    romanized_harm = 0
    romanized_den = 0
    protected_harm = 0
    protected_den = 0
    gen_parent = gen_cand = ret_parent = ret_cand = 0
    target_den = 0

    for case in cases:
        cid = case["case_id"]
        p = by_parent[cid]
        c = by_cand[cid]
        kind = case.get("suite_kind")
        if kind in {"english_identity", "technical_english", "shared_collision_english_context"}:
            english_den += 1
            if top_identity(p) and not top_identity(c):
                english_harm += 1
        if kind == "clear_romanized_control":
            romanized_den += 1
            target_den += 1
            if top_target(p, case) and not top_target(c, case):
                romanized_harm += 1
            if p.get("pre_cap_has_acceptable_target"):
                gen_parent += 1
            if c.get("pre_cap_has_acceptable_target"):
                gen_cand += 1
            if p.get("post_cap_has_acceptable_target"):
                ret_parent += 1
            if c.get("post_cap_has_acceptable_target"):
                ret_cand += 1
        if case.get("is_protected") or str(kind or "").startswith("protected"):
            protected_den += 1
            if bool(c.get("protected_mutations")):
                protected_harm += 1

    return {
        "english_cases_harmed": {"numerator": english_harm, "denominator": max(english_den, 0), "value": english_harm},
        "clear_romanized_cases_harmed": {
            "numerator": romanized_harm,
            "denominator": max(romanized_den, 0),
            "value": romanized_harm,
        },
        "protected_cases_harmed": {
            "numerator": protected_harm,
            "denominator": max(protected_den, 0),
            "value": protected_harm,
        },
        "target_generation_delta": {
            "parent": gen_parent,
            "candidate": gen_cand,
            "not_reduced": gen_cand >= gen_parent,
        },
        "target_retention_delta": {
            "parent": ret_parent,
            "candidate": ret_cand,
            "not_reduced": ret_cand >= ret_parent,
        },
    }


def _merge_measured_gates(
    report: Any,
    measured: dict[str, Any],
    thresholds: dict[str, Any],
) -> None:
    """Attach measured architecture/monotonic metrics into an existing ScoreReport."""
    from .r3h2_scoring_contracts import EvaluationPopulation, build_metric, evaluate_gate

    gates_spec = dict((thresholds or {}).get("gates") or {})
    for metric_id, payload in measured.items():
        if not isinstance(payload, dict) or "numerator" not in payload or "denominator" not in payload:
            continue
        spec = gates_spec.get(metric_id)
        if not spec:
            continue
        den = int(payload["denominator"])
        num = int(payload["numerator"])
        pop = EvaluationPopulation(
            population_id=f"measured::{metric_id}",
            case_ids=tuple(f"{metric_id}:{i}" for i in range(den)),
            required=True,
            description=f"measured metric population for {metric_id}",
        )
        metric = build_metric(
            metric_id=metric_id,
            population=pop,
            numerator=num,
            required=True,
            threshold=spec.get("value"),
            operation=spec.get("op"),
        )
        # Integer harm counts use numerator as the compared value under == 0.
        if spec.get("op") == "==" and isinstance(spec.get("value"), int) and spec.get("value") == 0:
            metric = build_metric(
                metric_id=metric_id,
                population=EvaluationPopulation(
                    population_id=f"measured::{metric_id}",
                    case_ids=("harm_unit",) if den == 0 else tuple(f"{metric_id}:{i}" for i in range(max(den, 1))),
                    required=den > 0,
                    description=f"measured harm count for {metric_id}",
                ),
                numerator=num,
                required=den > 0,
                threshold=float(spec.get("value")),
                operation="==",
            )
            if den == 0:
                # Optional when population absent on this split.
                from .r3h2_scoring_contracts import MetricApplicability, MetricResult, GateOutcome, GateResult

                metric = MetricResult(
                    metric_id=metric_id,
                    population_id=f"measured::{metric_id}",
                    numerator=0,
                    denominator=0,
                    value=None,
                    applicability=MetricApplicability.NOT_APPLICABLE,
                    threshold=float(spec.get("value")),
                    operation="==",
                )
                report.metrics[metric_id] = metric
                report.gates[metric_id] = GateResult(
                    metric_id=metric_id, outcome=GateOutcome.NOT_APPLICABLE, metric=metric
                )
                continue
        report.metrics[metric_id] = metric
        report.gates[metric_id] = evaluate_gate(metric)
    report.extras["measured"] = measured


def score_split(split: str, *, write: bool = False) -> dict[str, Any]:
    resources = _r3h2_resources()
    cases = load_split(split)
    predictions = run_predictions(cases, resources)
    thresholds = load_thresholds()

    measured = measure_architecture_metrics(cases, predictions, resources)
    if split == "MONOTONIC_PARENT_COMPARISON":
        measured.update(measure_monotonic_harm(cases, predictions))

    canonical_report = canonical_score_split(cases, predictions, thresholds, measured_extras=measured)
    audit_report = score_split_audit(cases, predictions, thresholds, measured_extras=measured)
    _merge_measured_gates(canonical_report, measured, thresholds)
    _merge_measured_gates(audit_report, measured, thresholds)
    agreement = compare_reports(canonical_report, audit_report)
    if not agreement["ok"]:
        raise RuntimeError(f"CANONICAL_AUDIT_SCORER_DISAGREEMENT:{split}:{agreement['mismatches']}")

    payload = {
        "split": split,
        "canonical_report": canonical_report.to_dict(),
        "audit_report": audit_report.to_dict(),
        "agreement": agreement,
        "all_required_pass": canonical_report.all_required_pass,
        "predictions_canonical_list_sha256": predictions_canonical_list_sha256(predictions),
        "measured": measured,
    }

    if write:
        _require_write_authorized()
        REPORTS.mkdir(parents=True, exist_ok=True)
        pred_path = REPORTS / f"MAI_07R3H2_{split}_PREDICTIONS.jsonl"
        from .canonical_path_guard import write_text_guarded

        write_text_guarded(
            pred_path,
            "\n".join(json.dumps(p, ensure_ascii=False, sort_keys=True) for p in predictions) + "\n",
            authorize=True,
        )
        payload["prediction_path"] = str(pred_path.relative_to(REPO)).replace("\\", "/")
        payload["predictions_jsonl_raw_sha256"] = sha256_file(pred_path)
        report_path = REPORTS / f"MAI_07R3H2_{split}_SCORE_REPORT.json"
        write_text_guarded(
            report_path,
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            authorize=True,
        )
        payload["report_path"] = str(report_path.relative_to(REPO)).replace("\\", "/")
    return payload


def score_development(*, write: bool = False) -> dict[str, Any]:
    """DEVELOPMENT score report — required to exist and pass before --lock."""
    return score_split("DEVELOPMENT", write=write)


def check_preflight() -> dict[str, Any]:
    """Read-only preflight: dataset/threshold presence, resource pack integrity, lock/chain state."""
    manifest_path = OUT / "MAI_07R3H2_DATASET_MANIFEST.json"
    threshold_path = OUT / "MAI_07R3H2_THRESHOLDS.json"
    errors: list[str] = []
    if not manifest_path.exists():
        errors.append("missing_dataset_manifest")
    if not threshold_path.exists():
        errors.append("missing_threshold_manifest")
    if not R3H2_RESOURCES_DIR.exists():
        errors.append("missing_r3h2_sealed_pack")
    resource_ok = True
    if R3H2_RESOURCES_DIR.exists():
        try:
            man = json.loads((R3H2_RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
            computed = compute_pack_content_hash(man, resources_dir=R3H2_RESOURCES_DIR)
            if computed != man.get("content_hash"):
                errors.append("r3h2_pack_content_hash_mismatch")
                resource_ok = False
        except Exception as exc:  # noqa: BLE001
            errors.append(f"r3h2_pack_read_error:{type(exc).__name__}")
            resource_ok = False
    return {
        "ok": not errors,
        "errors": errors,
        "dataset_manifest_present": manifest_path.exists(),
        "threshold_manifest_present": threshold_path.exists(),
        "r3h2_pack_present": R3H2_RESOURCES_DIR.exists(),
        "r3h2_pack_content_hash_ok": resource_ok,
        "locked_present": LOCKED_PATH.exists(),
        "chain_present": CHAIN_PATH.exists(),
        "holdout_already_consumed": CHAIN_PATH.exists(),
    }


def build_rc_lock() -> dict[str, Any]:
    _require_write_authorized()
    resources = _r3h2_resources()
    thresholds_path = OUT / "MAI_07R3H2_THRESHOLDS.json"
    manifest_path = OUT / "MAI_07R3H2_DATASET_MANIFEST.json"
    thresholds = json.loads(thresholds_path.read_text(encoding="utf-8"))
    dataset_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    dev_report = score_development(write=False)
    if not dev_report["all_required_pass"]:
        raise RuntimeError("DEVELOPMENT_SCORE_REQUIRED_BEFORE_LOCK: required gates not passing on DEVELOPMENT")

    body = {
        "schema_version": "2.0.0",
        "manifest_id": RC_ID,
        "runtime_version": RUNTIME_VERSION,
        "runtime_claim": RUNTIME_CLAIM,
        "resource_pack_version": PACK_VERSION,
        "resource_content_sha256": compute_pack_content_hash(resources_dir=R3H2_RESOURCES_DIR),
        "resource_pack_path": str(R3H2_RESOURCES_DIR.relative_to(REPO)).replace("\\", "/"),
        "parent_pack_version": "mai-07.1.4-r3h-englishid",
        "active_default_pack_version_unchanged": "mai-07.1.3-r3f-sealnew",
        "policy_version": POLICY_VERSION,
        "guard_version": GUARD_VERSION,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "threshold_manifest_sha256": sha256_file(thresholds_path),
        "dataset_manifest_sha256": sha256_file(manifest_path),
        "fresh_development_dataset_sha256": dataset_manifest["splits"]["DEVELOPMENT"]["sha256"],
        "fresh_holdout_dataset_sha256": dataset_manifest["splits"]["HOLDOUT_VALIDATION"]["sha256"],
        "fresh_safety_dataset_sha256": dataset_manifest["splits"]["SAFETY_CHALLENGE"]["sha256"],
        "fresh_counterfactual_dataset_sha256": dataset_manifest["splits"]["CONTEXT_COUNTERFACTUAL"]["sha256"],
        "fresh_oov_dataset_sha256": dataset_manifest["splits"]["OOV_GENERALIZATION"]["sha256"],
        "fresh_monotonic_parent_comparison_dataset_sha256": dataset_manifest["splits"][
            "MONOTONIC_PARENT_COMPARISON"
        ]["sha256"],
        "development_score_all_required_pass": True,
        "development_predictions_canonical_list_sha256": dev_report["predictions_canonical_list_sha256"],
        "no_frozen_v2_run": True,
        "no_frozen_prediction_use": True,
        "quality_gates_passed": False,
        "linguist_approved": False,
        "production_approved": False,
        "threshold_manifest": thresholds,
    }
    result = build_locked_rc(body, output_path=LOCKED_PATH)
    locked_body = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    record = create_lock_record(
        rc_id=RC_ID, locked_path=LOCKED_PATH, locked_body=locked_body, provenance="MAI_07R3H2"
    )
    LOCK_RECORD_PATH.write_text(
        json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    return result


def run_holdout_once() -> dict[str, Any]:
    _require_write_authorized()
    if CHAIN_PATH.exists():
        raise RuntimeError("FAILED_HOLDOUT_CANNOT_RERUN")
    if not LOCKED_PATH.exists():
        build_rc_lock()
    locked = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    attempt = create_attempt(
        attempt_id="MAI_07R3H2_HOLDOUT_ATTEMPT_001",
        rc_id=RC_ID,
        lock_semantic_sha256=locked["rc_manifest_semantic_sha256"],
        lock_raw_sha256=locked["rc_manifest_raw_sha256"],
        command="python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3h2 --one-shot",
        split="HOLDOUT_VALIDATION",
    )
    split_reports = {split: score_split(split, write=True) for split in HOLDOUT_FAMILY_SPLITS}
    pred_path = REPORTS / "MAI_07R3H2_HOLDOUT_VALIDATION_PREDICTIONS.jsonl"
    predictions = [json.loads(line) for line in pred_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    bound_attempt = bind_predictions(attempt, pred_path=pred_path, preds=predictions)
    gate_all_pass = all(rep["all_required_pass"] for rep in split_reports.values())
    qual = create_qualification_result(
        rc_id=RC_ID,
        lock_semantic_sha256=locked["rc_manifest_semantic_sha256"],
        gate_all_pass=gate_all_pass,
        attempt_id=attempt["attempt_id"],
        metrics_summary=split_reports["HOLDOUT_VALIDATION"]["canonical_report"]["metrics"],
    )
    qual_path = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
    qual_path.write_text(
        json.dumps(qual, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    attempt_path = OUT / f"{attempt['attempt_id']}.json"
    attempt_path.write_text(
        json.dumps(bound_attempt, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    chain = {
        "schema_version": "2.0.0",
        "locked_not_run_path": str(LOCKED_PATH.relative_to(REPO)).replace("\\", "/"),
        "locked_semantic_sha256": locked["rc_manifest_semantic_sha256"],
        "locked_raw_sha256": locked["rc_manifest_raw_sha256"],
        "holdout_attempt_path": str(attempt_path.relative_to(REPO)).replace("\\", "/"),
        "qualification_path": str(qual_path.relative_to(REPO)).replace("\\", "/"),
        "split_reports": split_reports,
    }
    CHAIN_PATH.write_text(
        json.dumps(chain, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    return chain


def main() -> int:
    import argparse

    from .build_mai07r3h2_shared_collision_datasets import write_datasets

    parser = argparse.ArgumentParser()
    parser.add_argument("--write-datasets", action="store_true")
    parser.add_argument("--output", default="")
    parser.add_argument("--score-development", action="store_true")
    parser.add_argument("--lock", action="store_true")
    parser.add_argument("--one-shot", action="store_true")
    parser.add_argument("--check-preflight", action="store_true")
    parser.add_argument("--write", action="store_true", help="Persist artifacts (requires MAI07_AUTHORIZE_EVAL_WRITE=1)")
    args = parser.parse_args()

    if args.check_preflight:
        print(json.dumps(check_preflight(), ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    if args.write_datasets:
        if not args.output:
            raise SystemExit("--write-datasets requires --output DIR")
        result = write_datasets(Path(args.output))
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    if args.score_development:
        print(json.dumps(score_development(write=args.write), ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    if args.lock:
        print(json.dumps(build_rc_lock(), ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    if args.one_shot:
        print(json.dumps(run_holdout_once(), ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    raise SystemExit("require --check-preflight, --write-datasets, --score-development, --lock, or --one-shot")


if __name__ == "__main__":
    raise SystemExit(main())
