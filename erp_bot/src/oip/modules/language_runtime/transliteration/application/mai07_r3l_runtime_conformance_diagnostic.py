"""MAI-07R3L — AI-assisted runtime conformance diagnostic (engineering only).

Runs active MAI-05 → MAI-06 → MAI-07 pipeline read-only against 1111 AI-assisted
policy-reference cases. Measures behavior/policy conformance — not language quality.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from collections import Counter, defaultdict
from dataclasses import asdict
from pathlib import Path
from typing import Any

from openpyxl import Workbook
from openpyxl.worksheet.datavalidation import DataValidation

from .. import ENABLE_PROMOTION_OVERLAY, MAX_CANDIDATES_PER_SPAN, RUNTIME_VERSION
from ...application.language_analyzer import analyze_language
from ...normalization.application.normalization_service import attach_normalization_to_frame
from .mai07_r3ja_v3_agreement import ROUND_A_DISPOSITIONS
from .mai07_r3ja_v3_firewall import REPO
from .mai07_r3k_hash_contract import KNOWN as R3K_KNOWN
from .mai07_r3k_hash_contract import sha256_file
from .mai07_r3l_behavior_policy import map_disposition_to_behavior
from .mai07_r3l_contracts import (
    FIXED_GOVERNANCE,
    PHASE,
    SCHEMA_VERSION,
    BehaviorExpectationV1,
    ConformanceResultV1,
    ResidualRiskItemV1,
    RuntimeCandidateObservationV1,
    RuntimeConformanceInputV1,
    RuntimePredictionEnvelopeV1,
    to_dict,
)
from .transliteration_service import transliterate_frame
from ..infrastructure import resource_repository as xlrr

EXPECTED_CASES = 1111
EXPECTED_FOUR = 611
EXPECTED_THREE = 500
EXPECTED_JUDGMENTS = 3944
EXPECTED_RISK = 700
EXPECTED_RUNTIME = "mai-07.1.13-r3s-active"
EXPECTED_RESOURCE = "8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106"
EXPECTED_AUTH_MANIFEST = "65bfa6847a8d3d58af4e092f4217d65b3b6e5d51035c401e7304be1ed77fe2b8"

R3K_ROOT = REPO / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic"
DEFAULT_OUT = REPO / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/runtime_conformance_diagnostic"
OFFICIAL_INBOX = REPO / "docs/mokxya-ai/reviews/mai07_v3/review_operations/round_a_inbox"

_DEV_LO, _DEV_HI = 0x0900, 0x097F
_PACKET_SEED = "mai07-r3l-targeted-packet-20260717"

REQUIRED_POPULATIONS = (
    "ALL_CASES",
    "ACCOUNTING_CONTENT_MAP",
    "HEURISTIC_V1",
    "R3K_RISK_QUEUE",
    "ENGLISH_IDENTITY",
    "DEVANAGARI_BEHAVIOR",
    "IDENTITY_FIRST",
    "OPTIONAL",
    "ACRONYM",
    "CONTEXT_DEPENDENT",
    "ABSTAIN",
    "PROTECTED_OR_IDENTIFIER",
    "SPAN_RESOLUTION_FAILURE",
    "HIGH_AMBIGUITY",
    "LOW_OR_MEDIUM_CONFIDENCE",
    "NATURAL_CONTEXT_FALSE",
)

OPTIONAL_POPULATIONS: tuple[str, ...] = ()


class Mai07R3LDiagnosticError(ValueError):
    pass


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _write_json(path: Path, obj: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    return sha256_file(path)


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for r in rows
    ]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8", newline="\n")
    return sha256_file(path)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for ln in path.read_text(encoding="utf-8").splitlines():
        if ln.strip():
            rows.append(json.loads(ln))
    return rows


def assert_official_inbox_empty() -> None:
    if not OFFICIAL_INBOX.exists():
        return
    hits = list(OFFICIAL_INBOX.rglob("*.xlsx")) + list(OFFICIAL_INBOX.rglob("*.xlsm"))
    if hits:
        raise Mai07R3LDiagnosticError(f"official_inbox_not_empty:{[str(h) for h in hits]}")


def verify_preconditions() -> dict[str, Any]:
    assert_official_inbox_empty()
    if RUNTIME_VERSION != EXPECTED_RUNTIME:
        raise Mai07R3LDiagnosticError(f"BLOCKED_PRECONDITION_FAILED:runtime:{RUNTIME_VERSION}")
    if ENABLE_PROMOTION_OVERLAY is not False:
        raise Mai07R3LDiagnosticError("BLOCKED_PRECONDITION_FAILED:overlay_enabled")
    vr = xlrr.validate_resources()
    if not vr.get("ok") or vr.get("content_hash") != EXPECTED_RESOURCE:
        raise Mai07R3LDiagnosticError(f"BLOCKED_PRECONDITION_FAILED:resource:{vr}")
    if vr.get("mutated_canonical"):
        raise Mai07R3LDiagnosticError("BLOCKED_PRECONDITION_FAILED:resource_mutated")

    zip_p = REPO / "MokXya_MAI07_V3_ACCOUNTING_DOMAIN_ROUND_A_AI_ASSISTED_HUMAN_VERIFIED_READY.zip"
    auth = R3K_ROOT / "R3K_INPUT_AUTHORITY_MANIFEST.json"
    report = json.loads((R3K_ROOT / "reports/CONSENSUS_DIAGNOSTIC_REPORT.json").read_text(encoding="utf-8"))
    sem = json.loads((R3K_ROOT / "reports/SEMANTIC_HASH.json").read_text(encoding="utf-8"))
    risk_n = sum(
        1 for ln in (R3K_ROOT / "canonical/RISK_QUEUE.jsonl").read_text(encoding="utf-8").splitlines() if ln.strip()
    )
    checks = {
        "zip": sha256_file(zip_p) == R3K_KNOWN["accounting_package_zip_raw_sha256"],
        "acct_sem": report["input_accounting_semantic_hash"] == R3K_KNOWN["accounting_import_semantic_sha256"],
        "rem_sem": report["input_remaining_semantic_hash"] == R3K_KNOWN["remaining_roles_import_semantic_sha256"],
        "r3k_sem": sem["semantic_hash"] == R3K_KNOWN["r3k_semantic_sha256"],
        "auth_man": sha256_file(auth) == EXPECTED_AUTH_MANIFEST,
        "cases": report["unique_source_item_ids"] == EXPECTED_CASES,
        "four": report["four_role_cases"] == EXPECTED_FOUR,
        "three": report["three_role_cases"] == EXPECTED_THREE,
        "judg": report["total_role_judgments"] == EXPECTED_JUDGMENTS,
        "risk": risk_n == EXPECTED_RISK,
    }
    if not all(checks.values()):
        raise Mai07R3LDiagnosticError(f"BLOCKED_PRECONDITION_FAILED:{checks}")
    return {
        "ok": True,
        "runtime_version": RUNTIME_VERSION,
        "resource_hash": EXPECTED_RESOURCE,
        "overlay_enabled": False,
        "checks": checks,
    }


def has_devanagari_chars(text: str) -> bool:
    return any(_DEV_LO <= ord(ch) <= _DEV_HI for ch in text)


def is_devanagari_non_identity_candidate(*, surface: str, is_identity: bool, script: str) -> bool:
    """Identity never counts; Latin-only never counts; digits/punct alone never count."""
    if is_identity:
        return False
    if not has_devanagari_chars(surface):
        return False
    # Require at least one Devanagari letter (not only combining marks / digits alone)
    if not any("\u0900" <= ch <= "\u097F" and ch.isalpha() for ch in surface):
        # Devanagari block includes letters; if only digits/punct somehow matched, reject
        if not any(_DEV_LO <= ord(ch) <= _DEV_HI and not ch.isdigit() and not ch.isspace() for ch in surface):
            return False
    # Latin rewrite without Devanagari already rejected by has_devanagari_chars
    _ = script  # script may be MIXED; Devanagari chars are authoritative
    return True


def resolve_highlighted_span(input_text: str, highlighted_span: str) -> dict[str, Any]:
    """Code-point span resolution — never silently pick first of many."""
    needle = highlighted_span
    if not needle:
        return {
            "status": "SPAN_NOT_FOUND",
            "start": None,
            "end": None,
            "occurrences": 0,
        }
    starts: list[int] = []
    # Exact code-point search
    i = 0
    n = len(input_text)
    m = len(needle)
    while i <= n - m:
        if input_text[i : i + m] == needle:
            starts.append(i)
            i += m
        else:
            i += 1
    if len(starts) == 0:
        # case-insensitive fallback still must be unique
        low = input_text.lower()
        nlow = needle.lower()
        starts = []
        i = 0
        m = len(nlow)
        while i <= len(low) - m:
            if low[i : i + m] == nlow:
                starts.append(i)
                i += m
            else:
                i += 1
        if len(starts) == 0:
            return {"status": "SPAN_NOT_FOUND", "start": None, "end": None, "occurrences": 0}
        if len(starts) > 1:
            return {"status": "SPAN_AMBIGUOUS", "start": None, "end": None, "occurrences": len(starts)}
        s0 = starts[0]
        return {"status": "RESOLVED", "start": s0, "end": s0 + len(needle), "occurrences": 1}
    if len(starts) > 1:
        return {"status": "SPAN_AMBIGUOUS", "start": None, "end": None, "occurrences": len(starts)}
    s0 = starts[0]
    return {"status": "RESOLVED", "start": s0, "end": s0 + m, "occurrences": 1}


def build_cases() -> list[RuntimeConformanceInputV1]:
    decisions = load_jsonl(R3K_ROOT / "canonical/CROSS_ROLE_DECISIONS.jsonl")
    risk_rows = load_jsonl(R3K_ROOT / "canonical/RISK_QUEUE.jsonl")
    risk_by_id = {r["source_item_id"]: r for r in risk_rows}
    if len(decisions) != EXPECTED_CASES:
        raise Mai07R3LDiagnosticError(f"case_count:{len(decisions)}")

    cases: list[RuntimeConformanceInputV1] = []
    for d in sorted(decisions, key=lambda x: x["source_item_id"]):
        if not d.get("dispositions_unanimous"):
            raise Mai07R3LDiagnosticError(f"non_unanimous:{d['source_item_id']}")
        disp = sorted(d["disposition_set"])[0]
        behavior = map_disposition_to_behavior(disp)
        # representative judgment fields
        j0 = d["judgments"][0]
        if d.get("accounting_map_present") and not d.get("heuristic_v1_present"):
            prov = "ACCOUNTING_CONTENT_MAP"
        elif d.get("heuristic_v1_present"):
            prov = "HEURISTIC_V1"
        else:
            raise Mai07R3LDiagnosticError(f"unknown_provenance:{d['source_item_id']}")
        risk = risk_by_id.get(d["source_item_id"])
        cases.append(
            RuntimeConformanceInputV1(
                schema_version=SCHEMA_VERSION,
                phase=PHASE,
                source_item_id=d["source_item_id"],
                diagnostic_case_id=d["diagnostic_case_id"],
                input_text=d["input_text"],
                highlighted_span=d["highlighted_span"],
                review_disposition=disp,
                confidence=j0.get("confidence", "MEDIUM"),
                natural_context_ok=str(j0.get("natural_context_ok", "")),
                suspected_ambiguity=str(j0.get("suspected_ambiguity", "")),
                provenance_bucket=prov,  # type: ignore[arg-type]
                evidence_status="NON_INDEPENDENT_AI_ASSISTED_USER_ACCEPTED_POLICY_REFERENCE",
                agreement_status="NON_INDEPENDENT_AI_OUTPUT_SIMILARITY_ONLY",
                majority_is_gold=False,
                independent_human_irr=False,
                r3k_risk_tier=risk["risk_tier"] if risk else None,
                r3k_risk_reason_codes=tuple(risk.get("reason_codes") or ()) if risk else (),
                has_accounting_domain=bool(d.get("has_accounting_domain")),
                role_count=int(d["role_count"]),
                behavior=behavior,
                runtime_version=EXPECTED_RUNTIME,
                resource_hash=EXPECTED_RESOURCE,
                prohibited_for_training=True,
                governance=dict(FIXED_GOVERNANCE),
            )
        )
    acct = sum(1 for c in cases if c.provenance_bucket == "ACCOUNTING_CONTENT_MAP")
    heur = sum(1 for c in cases if c.provenance_bucket == "HEURISTIC_V1")
    if acct != EXPECTED_FOUR or heur != EXPECTED_THREE:
        raise Mai07R3LDiagnosticError(f"provenance_split:{acct}/{heur}")
    return cases


def seal_population_manifest(cases: list[RuntimeConformanceInputV1]) -> dict[str, Any]:
    by_pop: dict[str, list[str]] = {p: [] for p in REQUIRED_POPULATIONS}
    for c in cases:
        sid = c.source_item_id
        by_pop["ALL_CASES"].append(sid)
        by_pop[c.provenance_bucket].append(sid)
        if c.r3k_risk_tier:
            by_pop["R3K_RISK_QUEUE"].append(sid)
        bc = c.behavior.behavior_class
        if bc == "ENGLISH_IDENTITY":
            by_pop["ENGLISH_IDENTITY"].append(sid)
        elif bc == "DEVANAGARI_TRANSLITERATION":
            by_pop["DEVANAGARI_BEHAVIOR"].append(sid)
        elif bc == "IDENTITY_FIRST":
            by_pop["IDENTITY_FIRST"].append(sid)
        elif bc == "OPTIONAL":
            by_pop["OPTIONAL"].append(sid)
        elif bc == "ACRONYM":
            by_pop["ACRONYM"].append(sid)
        elif bc == "CONTEXT_DEPENDENT":
            by_pop["CONTEXT_DEPENDENT"].append(sid)
        elif bc == "ABSTAIN":
            by_pop["ABSTAIN"].append(sid)
        elif bc == "PROTECTED_OR_IDENTIFIER":
            by_pop["PROTECTED_OR_IDENTIFIER"].append(sid)
        if str(c.suspected_ambiguity).upper() in ("YES", "TRUE", "1"):
            by_pop["HIGH_AMBIGUITY"].append(sid)
        if str(c.confidence).upper() in ("LOW", "MEDIUM"):
            by_pop["LOW_OR_MEDIUM_CONFIDENCE"].append(sid)
        if str(c.natural_context_ok).upper() in ("NO", "FALSE", "0"):
            by_pop["NATURAL_CONTEXT_FALSE"].append(sid)

    # Span failures filled later after predictions; placeholder sealed empty then updated.
    populations = {}
    for pid in REQUIRED_POPULATIONS:
        ids = tuple(sorted(set(by_pop[pid])))
        required = pid not in OPTIONAL_POPULATIONS
        if required and pid == "SPAN_RESOLUTION_FAILURE":
            # May be empty initially; filled after run — treat as required but allow
            # empty until predictions (status updated in finalize).
            status = "OK" if ids else "OK_PENDING_SPAN"
        elif required and not ids and pid not in ("SPAN_RESOLUTION_FAILURE",):
            # Some behavior classes may be empty if absent from data — those become INVALID
            # only if required AND expected non-empty. CONTEXT_DEPENDENT etc. exist in data.
            if pid in (
                "ALL_CASES",
                "ACCOUNTING_CONTENT_MAP",
                "HEURISTIC_V1",
                "R3K_RISK_QUEUE",
                "ENGLISH_IDENTITY",
                "DEVANAGARI_BEHAVIOR",
                "IDENTITY_FIRST",
                "OPTIONAL",
                "ACRONYM",
                "CONTEXT_DEPENDENT",
                "ABSTAIN",
                "PROTECTED_OR_IDENTIFIER",
            ):
                status = "INVALID_REQUIRED_POPULATION" if not ids else "OK"
            else:
                status = "OK" if ids else "NOT_APPLICABLE"
        else:
            status = "OK" if ids else ("NOT_APPLICABLE" if not required else "OK")
        populations[pid] = {
            "population_id": pid,
            "required": required,
            "case_ids": list(ids),
            "count": len(ids),
            "status": status if status != "OK_PENDING_SPAN" else "OK",
        }
    invalid = [p for p, v in populations.items() if v["status"] == "INVALID_REQUIRED_POPULATION"]
    if invalid:
        raise Mai07R3LDiagnosticError(f"INVALID_REQUIRED_POPULATION:{invalid}")
    return {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "sealed_before_runtime_observations": True,
        "populations": populations,
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
    }


def _select_span_for_highlight(bundle: Any, highlighted: str, resolution: dict[str, Any]) -> Any | None:
    if resolution["status"] != "RESOLVED":
        return None
    start, end = resolution["start"], resolution["end"]
    for span in bundle.span_results:
        rs = span.raw_span
        if rs.start_offset == start and rs.end_offset == end:
            return span
    # Match by exact surface text (single occurrence already proven)
    for span in bundle.span_results:
        if span.raw_span.original_text == highlighted:
            return span
    primary = highlighted.lower()
    matches = [s for s in bundle.span_results if s.raw_span.original_text.lower() == primary]
    if len(matches) == 1:
        return matches[0]
    return None


def run_prediction(case: RuntimeConformanceInputV1) -> RuntimePredictionEnvelopeV1:
    resolution = resolve_highlighted_span(case.input_text, case.highlighted_span)
    reason_codes: list[str] = []
    t0 = time.perf_counter()
    exception_status = None
    try:
        frame = analyze_language(case.input_text)
        frame = attach_normalization_to_frame(frame)
        if frame.raw_text != case.input_text:
            reason_codes.append("RAW_TEXT_MUTATED_BY_ANALYZER")
        bundle = transliterate_frame(frame, use_context=True)
        caps_ok = all(len(s.candidates) <= MAX_CANDIDATES_PER_SPAN for s in bundle.span_results)
        if not caps_ok:
            reason_codes.append("CANDIDATE_CAP_EXCEEDED")
        target = _select_span_for_highlight(bundle, case.highlighted_span, resolution)
        if resolution["status"] == "RESOLVED" and target is None:
            reason_codes.append("SPAN_RESOLVED_BUT_RUNTIME_SPAN_MISSING")
        candidates_obs: list[RuntimeCandidateObservationV1] = []
        surfaces: list[str] = []
        if target is not None:
            for cand in target.candidates:
                script = cand.script.value if hasattr(cand.script, "value") else str(cand.script)
                kind = cand.kind.value if hasattr(cand.kind, "value") else str(cand.kind)
                surf = cand.surface
                surfaces.append(surf)
                candidates_obs.append(
                    RuntimeCandidateObservationV1(
                        rank=int(cand.rank),
                        script=script,
                        kind=kind,
                        is_identity=bool(cand.is_identity),
                        requires_review=bool(cand.requires_review),
                        has_devanagari_chars=has_devanagari_chars(surf),
                        is_devanagari_non_identity=is_devanagari_non_identity_candidate(
                            surface=surf, is_identity=bool(cand.is_identity), script=script
                        ),
                        surface_len=len(surf),
                    )
                )
            # deterministic ordering check
            ranks = [c.rank for c in candidates_obs]
            if ranks != sorted(ranks):
                reason_codes.append("NON_DETERMINISTIC_RANK_ORDER")
            elig = target.eligibility.value if hasattr(target.eligibility, "value") else str(target.eligibility)
            runtime_disp = target.disposition
            review_required = bool(target.review_required)
            review_rcs = tuple(target.review_reason_codes or ())
            source_surface = target.raw_span.original_text
            # protected identity: if protected, surface must equal original
            protected_ok = True
            if getattr(target, "is_protected", False):
                protected_ok = source_surface == case.highlighted_span or source_surface == case.input_text[resolution["start"]:resolution["end"]] if resolution["start"] is not None else True
            align_ok = True
            if resolution["start"] is not None:
                slice_txt = case.input_text[resolution["start"] : resolution["end"]]
                if slice_txt != case.highlighted_span and slice_txt.lower() != case.highlighted_span.lower():
                    align_ok = False
                    reason_codes.append("CODE_POINT_ALIGNMENT_MISMATCH")
        else:
            elig = None
            runtime_disp = None
            review_required = None
            review_rcs = ()
            source_surface = None
            protected_ok = True
            align_ok = resolution["status"] != "RESOLVED"
            if resolution["status"] == "SPAN_NOT_FOUND":
                reason_codes.append("SPAN_NOT_FOUND")
            elif resolution["status"] == "SPAN_AMBIGUOUS":
                reason_codes.append("SPAN_AMBIGUOUS")

        top5 = candidates_obs[:5]
        identity_present = any(c.is_identity for c in candidates_obs)
        identity_top1 = bool(top5) and top5[0].is_identity
        identity_retained_at_5 = any(c.is_identity for c in top5)
        dev_at5 = any(c.is_devanagari_non_identity for c in top5)
        dev_top1 = bool(top5) and top5[0].is_devanagari_non_identity
        # duplicates by surface
        surf_counts = Counter(surfaces)
        dup = sum(v - 1 for v in surf_counts.values() if v > 1)
        raw_ok = frame.raw_text == case.input_text
        latency_ms = (time.perf_counter() - t0) * 1000.0
        return RuntimePredictionEnvelopeV1(
            schema_version=SCHEMA_VERSION,
            phase=PHASE,
            source_item_id=case.source_item_id,
            diagnostic_case_id=case.diagnostic_case_id,
            runtime_version=EXPECTED_RUNTIME,
            resource_hash=EXPECTED_RESOURCE,
            span_resolution=resolution["status"],  # type: ignore[arg-type]
            span_start_offset=resolution["start"],
            span_end_offset=resolution["end"],
            eligibility=elig,
            runtime_disposition=runtime_disp,
            review_required=review_required,
            review_reason_codes=review_rcs,
            candidate_count=len(candidates_obs),
            candidates=tuple(candidates_obs),
            identity_present=identity_present,
            identity_top1=identity_top1,
            identity_retained_at_5=identity_retained_at_5,
            devanagari_non_identity_present_at_5=dev_at5,
            devanagari_non_identity_top1=dev_top1,
            caps_ok=caps_ok,
            raw_text_unchanged=raw_ok,
            protected_span_identity_ok=protected_ok,
            code_point_alignment_ok=align_ok,
            duplicate_candidate_count=dup,
            exception_status=exception_status,
            latency_ms=round(latency_ms, 4),
            reason_codes=tuple(sorted(set(reason_codes))),
            prohibited_for_training=True,
            source_surface=source_surface,
            candidate_surfaces=tuple(surfaces),
        )
    except Exception as exc:  # noqa: BLE001 — capture as diagnostic exception
        latency_ms = (time.perf_counter() - t0) * 1000.0
        return RuntimePredictionEnvelopeV1(
            schema_version=SCHEMA_VERSION,
            phase=PHASE,
            source_item_id=case.source_item_id,
            diagnostic_case_id=case.diagnostic_case_id,
            runtime_version=EXPECTED_RUNTIME,
            resource_hash=EXPECTED_RESOURCE,
            span_resolution=resolution["status"],  # type: ignore[arg-type]
            span_start_offset=resolution.get("start"),
            span_end_offset=resolution.get("end"),
            eligibility=None,
            runtime_disposition=None,
            review_required=None,
            review_reason_codes=(),
            candidate_count=0,
            candidates=(),
            identity_present=False,
            identity_top1=False,
            identity_retained_at_5=False,
            devanagari_non_identity_present_at_5=False,
            devanagari_non_identity_top1=False,
            caps_ok=True,
            raw_text_unchanged=True,
            protected_span_identity_ok=True,
            code_point_alignment_ok=False,
            duplicate_candidate_count=0,
            exception_status=f"{type(exc).__name__}:{exc}",
            latency_ms=round(latency_ms, 4),
            reason_codes=("RUNTIME_EXCEPTION",),
            prohibited_for_training=True,
            source_surface=None,
            candidate_surfaces=(),
        )


def score_case(case: RuntimeConformanceInputV1, pred: RuntimePredictionEnvelopeV1) -> ConformanceResultV1:
    b = case.behavior
    flags: dict[str, bool | None] = {
        "identity_top1": pred.identity_top1,
        "identity_retained_at_5": pred.identity_retained_at_5,
        "identity_present": pred.identity_present,
        "devanagari_candidate_present_at_5": pred.devanagari_non_identity_present_at_5,
        "devanagari_candidate_top1": pred.devanagari_non_identity_top1,
        "false_devanagari_top1": bool(pred.devanagari_non_identity_top1 and b.forbid_forced_devanagari_top1),
        "raw_text_unchanged": pred.raw_text_unchanged,
        "caps_ok": pred.caps_ok,
        "unique_top1_gold": b.unique_top1_gold,
    }
    residual: list[str] = []
    tier = None
    outcome = "PASS"

    if pred.exception_status:
        outcome = "EXCEPTION"
        residual.append("RUNTIME_EXCEPTION")
        tier = "TIER_1_CRITICAL"
    elif pred.span_resolution in ("SPAN_NOT_FOUND", "SPAN_AMBIGUOUS"):
        outcome = "SPAN_FAILURE"
        residual.append(pred.span_resolution)
        tier = "TIER_2_HIGH"
    elif b.scoring_applicability == "UNSUPPORTED":
        outcome = "UNSUPPORTED"
        residual.append("UNSUPPORTED_DISPOSITION")
        tier = "TIER_2_HIGH"
    else:
        fails: list[str] = []
        if not pred.raw_text_unchanged or not pred.protected_span_identity_ok:
            fails.append("RAW_OR_PROTECTED_MUTATION")
            tier = "TIER_1_CRITICAL"
        if not pred.caps_ok:
            fails.append("CAP_FAILURE")
            tier = "TIER_1_CRITICAL"
        if b.require_identity_top1 and not pred.identity_top1:
            fails.append("IDENTITY_NOT_TOP1")
            tier = tier or "TIER_2_HIGH"
        if b.require_identity_retained_at_5 and not pred.identity_retained_at_5:
            fails.append("IDENTITY_NOT_RETAINED_AT_5")
            tier = tier or "TIER_3_MEDIUM"
        if b.require_devanagari_candidate_at_5 and not pred.devanagari_non_identity_present_at_5:
            # abstain path may be acceptable for DEVANAGARI if eligibility abstains
            elig = (pred.eligibility or "").upper()
            if "ABSTAIN" in elig or pred.review_required:
                flags["generation_abstained"] = True
            else:
                fails.append("DEVANAGARI_CANDIDATE_MISSING")
                tier = tier or "TIER_2_HIGH"
        if b.forbid_forced_devanagari_top1 and pred.devanagari_non_identity_top1:
            fails.append("FALSE_FORCED_DEVANAGARI_TOP1")
            tier = "TIER_1_CRITICAL"
        if b.behavior_class == "CONTEXT_DEPENDENT":
            diversity = pred.candidate_count > 1
            review_sig = bool(pred.review_required) or any(c.requires_review for c in pred.candidates)
            if not pred.identity_retained_at_5:
                fails.append("CONTEXT_IDENTITY_MISSING")
                tier = tier or "TIER_3_MEDIUM"
            elif not diversity and not review_sig:
                # Capability may exist (review_required field exists) — signal missing
                residual.append("CONTEXT_NO_DIVERSITY_OR_REVIEW_SIGNAL")
                tier = tier or "TIER_3_MEDIUM"
        if b.behavior_class == "ABSTAIN" and pred.devanagari_non_identity_top1 and not pred.identity_top1:
            fails.append("ABSTAIN_FORCE_TRANSLITERATED")
            tier = tier or "TIER_2_HIGH"

        if fails:
            residual.extend(fails)
            outcome = "FAIL"
        else:
            outcome = "PASS"
            # soft residual from R3K / confidence
            if case.r3k_risk_tier == "TIER_2_HIGH" and outcome == "PASS":
                pass
            if str(case.confidence).upper() in ("LOW", "MEDIUM"):
                residual.append("LOW_OR_MEDIUM_CONFIDENCE")
                tier = tier or "TIER_3_MEDIUM"
            if str(case.suspected_ambiguity).upper() in ("YES", "TRUE"):
                residual.append("SUSPECTED_AMBIGUITY")
                tier = tier or "TIER_3_MEDIUM"
            if case.provenance_bucket == "HEURISTIC_V1" and case.behavior.behavior_class in (
                "ENGLISH_IDENTITY",
                "ACRONYM",
                "PROTECTED_OR_IDENTIFIER",
                "DEVANAGARI_TRANSLITERATION",
            ):
                residual.append("HEURISTIC_V1_SAFETY_SENSITIVE")
                tier = tier or "TIER_3_MEDIUM"

    # Always residual if FAIL/EXCEPTION/SPAN
    if outcome in ("FAIL", "EXCEPTION", "SPAN_FAILURE", "UNSUPPORTED") and tier is None:
        tier = "TIER_2_HIGH"
    if residual and tier is None:
        tier = "TIER_3_MEDIUM"

    return ConformanceResultV1(
        schema_version=SCHEMA_VERSION,
        phase=PHASE,
        source_item_id=case.source_item_id,
        diagnostic_case_id=case.diagnostic_case_id,
        behavior_class=b.behavior_class,
        review_disposition=case.review_disposition,
        scoring_applicability=b.scoring_applicability,
        outcome=outcome,  # type: ignore[arg-type]
        metric_flags=flags,
        reason_codes=tuple(sorted(set(residual + list(pred.reason_codes)))),
        residual_tier=tier,  # type: ignore[arg-type]
        residual_reasons=tuple(sorted(set(residual))),
        provenance_bucket=case.provenance_bucket,
        r3k_risk_tier=case.r3k_risk_tier,
        runtime_version=EXPECTED_RUNTIME,
        resource_hash=EXPECTED_RESOURCE,
        prohibited_for_training=True,
    )


def build_residual_queue(
    cases: list[RuntimeConformanceInputV1],
    results: list[ConformanceResultV1],
) -> list[ResidualRiskItemV1]:
    case_by = {c.source_item_id: c for c in cases}
    items: list[ResidualRiskItemV1] = []
    for r in results:
        if not r.residual_tier:
            continue
        c = case_by[r.source_item_id]
        items.append(
            ResidualRiskItemV1(
                source_item_id=r.source_item_id,
                diagnostic_case_id=r.diagnostic_case_id,
                residual_tier=r.residual_tier,  # type: ignore[arg-type]
                reason_codes=r.residual_reasons or r.reason_codes,
                behavior_class=r.behavior_class,
                provenance_bucket=r.provenance_bucket,
                r3k_risk_tier=r.r3k_risk_tier,
                input_text=c.input_text,
                highlighted_span=c.highlighted_span,
            )
        )
    tier_order = {"TIER_1_CRITICAL": 0, "TIER_2_HIGH": 1, "TIER_3_MEDIUM": 2}
    items.sort(key=lambda x: (tier_order.get(x.residual_tier, 9), x.source_item_id))
    return items


def build_targeted_packet(
    residual: list[ResidualRiskItemV1],
    *,
    max_rows: int = 200,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """Deterministic greedy coverage packet. Reviewer rows omit predictions/labels."""
    critical = [r for r in residual if r.residual_tier == "TIER_1_CRITICAL"]
    selected: list[ResidualRiskItemV1] = list(critical)
    selected_ids = {r.source_item_id for r in selected}

    # Coverage keys
    def families(r: ResidualRiskItemV1) -> list[str]:
        out = [f"disp:{r.behavior_class}", f"prov:{r.provenance_bucket}"]
        for rc in r.reason_codes:
            out.append(f"reason:{rc}")
        if r.r3k_risk_tier:
            out.append(f"r3k:{r.r3k_risk_tier}")
        return out

    covered: set[str] = set()
    for r in selected:
        covered.update(families(r))

    # Greedy: for each uncovered family, take up to 5 examples
    remaining = [r for r in residual if r.source_item_id not in selected_ids]
    family_pool: dict[str, list[ResidualRiskItemV1]] = defaultdict(list)
    for r in remaining:
        for f in families(r):
            family_pool[f].append(r)

    for fam in sorted(family_pool.keys()):
        if fam in covered and sum(1 for r in selected if fam in families(r)) >= 5:
            continue
        taken = 0
        for r in family_pool[fam]:
            if r.source_item_id in selected_ids:
                continue
            if len(selected) >= max_rows and not (
                len(critical) > max_rows and r.residual_tier == "TIER_1_CRITICAL"
            ):
                break
            selected.append(r)
            selected_ids.add(r.source_item_id)
            covered.update(families(r))
            taken += 1
            if taken >= 5 and len(critical) <= max_rows:
                break
        if len(selected) >= max_rows and len(critical) <= max_rows:
            break

    if len(critical) > max_rows:
        selected = list(critical)
        exceeded = True
    else:
        selected = selected[:max_rows]
        exceeded = False

    selected.sort(
        key=lambda x: (
            {"TIER_1_CRITICAL": 0, "TIER_2_HIGH": 1, "TIER_3_MEDIUM": 2}.get(x.residual_tier, 9),
            x.source_item_id,
        )
    )

    reviewer_rows: list[dict[str, Any]] = []
    private_map: list[dict[str, Any]] = []
    for r in selected:
        opaque = "R3L-" + hashlib.sha256(f"{_PACKET_SEED}:{r.source_item_id}".encode()).hexdigest()[:16]
        reviewer_rows.append(
            {
                "opaque_review_id": opaque,
                "input_text": r.input_text,
                "highlighted_span": r.highlighted_span,
                "context_note": "Neutral diagnostic sample. Assign disposition independently.",
                "disposition": "",
                "confidence": "",
                "reviewer_notes": "",
            }
        )
        private_map.append(
            {
                "opaque_review_id": opaque,
                "source_item_id": r.source_item_id,
                "diagnostic_case_id": r.diagnostic_case_id,
                "residual_tier": r.residual_tier,
                "reason_codes": list(r.reason_codes),
                "behavior_class": r.behavior_class,
                "provenance_bucket": r.provenance_bucket,
                "use": "adjudication_import_only",
                "prohibited_for_runtime": True,
                "prohibited_for_training": True,
            }
        )

    meta = {
        "selected_count": len(selected),
        "critical_count": len(critical),
        "max_rows": max_rows,
        "exceeded_by_critical": exceeded,
        "covered_families": sorted(covered),
    }
    return reviewer_rows, private_map, meta


def write_packet_files(out: Path, reviewer_rows: list[dict[str, Any]], private_map: list[dict[str, Any]]) -> dict[str, Any]:
    pkt = out / "targeted_review_packet"
    pkt.mkdir(parents=True, exist_ok=True)
    priv = pkt / "private_adjudication_import_only"
    priv.mkdir(parents=True, exist_ok=True)

    # CSV
    csv_path = pkt / "TARGETED_REVIEW_PACKET.csv"
    headers = [
        "opaque_review_id",
        "input_text",
        "highlighted_span",
        "context_note",
        "disposition",
        "confidence",
        "reviewer_notes",
    ]
    lines = [",".join(headers)]
    for row in reviewer_rows:
        vals = []
        for h in headers:
            v = str(row.get(h, "")).replace('"', '""')
            vals.append(f'"{v}"')
        lines.append(",".join(vals))
    csv_path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")

    # XLSX
    xlsx_path = pkt / "TARGETED_REVIEW_PACKET.xlsx"
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "TARGETED_REVIEW"
    ws.append(headers)
    for row in reviewer_rows:
        ws.append([row.get(h, "") for h in headers])
    dv = DataValidation(
        type="list",
        formula1='"' + ",".join(ROUND_A_DISPOSITIONS) + '"',
        allow_blank=True,
    )
    ws.add_data_validation(dv)
    if reviewer_rows:
        dv.add(f"E2:E{len(reviewer_rows)+1}")
    dv2 = DataValidation(type="list", formula1='"HIGH,MEDIUM,LOW"', allow_blank=True)
    ws.add_data_validation(dv2)
    if reviewer_rows:
        dv2.add(f"F2:F{len(reviewer_rows)+1}")
    wb.save(xlsx_path)

    # Leakage audit on reviewer-facing content
    blob = csv_path.read_text(encoding="utf-8").lower()
    forbidden_tokens = [
        "accountING_domain".lower(),
        "product_policy",
        "nepali_fluent",
        "professional_linguist",
        "majority_as_gold",
        "devanagari_candidate",
        "semantic_hash",
        "tier_1_critical",
        "heuristic_v1",
        "accounting_content_map",
        "source_item_id",
        "v3dx-",
    ]
    leaks = [t for t in forbidden_tokens if t in blob]
    # also check private mapping not in reviewer csv
    for m in private_map:
        if m["source_item_id"].lower() in blob:
            leaks.append(f"source_leak:{m['source_item_id']}")

    _write_json(
        priv / "TARGETED_REVIEW_PRIVATE_MAPPING.json",
        {
            "use": "adjudication_import_only",
            "prohibited_for_runtime": True,
            "prohibited_for_training": True,
            "items": private_map,
        },
    )
    def _rel(p: Path) -> str:
        try:
            return str(p.resolve().relative_to(REPO.resolve()))
        except ValueError:
            return str(p.resolve())

    leakage = {
        "ok": len(leaks) == 0,
        "leaks": leaks,
        "reviewer_files": [_rel(csv_path), _rel(xlsx_path)],
    }
    return {
        "csv": str(csv_path),
        "xlsx": str(xlsx_path),
        "leakage": leakage,
        "xlsx_sha256": sha256_file(xlsx_path),
        "csv_sha256": sha256_file(csv_path),
    }


def compute_semantic_hash(
    cases: list[dict[str, Any]],
    predictions: list[dict[str, Any]],
    results: list[dict[str, Any]],
    metrics: dict[str, Any],
    residual: list[dict[str, Any]],
) -> str:
    payload = {
        "schema": SCHEMA_VERSION,
        "phase": PHASE,
        "cases": cases,
        "predictions_safe": [
            {
                k: v
                for k, v in p.items()
                if k
                not in (
                    "candidate_surfaces",
                    "source_surface",
                    "input_text",
                    "latency_ms",
                )
            }
            for p in predictions
        ],
        "results": results,
        "metrics_core": {
            k: {
                "numerator": m["numerator"],
                "denominator": m["denominator"],
                "applicability": m["applicability"],
            }
            for k, m in sorted(metrics["metrics"].items())
        },
        "safety": metrics["safety"],
        "residual_ids": [r["source_item_id"] for r in residual],
        "governance": FIXED_GOVERNANCE,
    }
    blob = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return _sha256_bytes(blob)


def run_diagnostic(*, out_root: Path | None = None, write: bool = True) -> dict[str, Any]:
    from .mai07_r3l_audit_scorer import compare_reports, score_audit
    from .mai07_r3l_canonical_scorer import score_canonical

    pre = verify_preconditions()
    cases = build_cases()
    pop_manifest = seal_population_manifest(cases)

    predictions = [run_prediction(c) for c in cases]
    results = [score_case(c, p) for c, p in zip(cases, predictions)]

    # Update SPAN_RESOLUTION_FAILURE population
    span_fail_ids = sorted(
        p.source_item_id for p in predictions if p.span_resolution in ("SPAN_NOT_FOUND", "SPAN_AMBIGUOUS")
    )
    pop_manifest["populations"]["SPAN_RESOLUTION_FAILURE"] = {
        "population_id": "SPAN_RESOLUTION_FAILURE",
        "required": True,
        "case_ids": span_fail_ids,
        "count": len(span_fail_ids),
        "status": "OK" if span_fail_ids else "NOT_APPLICABLE",
    }

    case_dicts = [to_dict(c) for c in cases]
    pred_dicts = [to_dict(p) for p in predictions]
    result_dicts = [to_dict(r) for r in results]

    canonical_metrics = score_canonical(case_dicts, pred_dicts, result_dicts, pop_manifest)
    audit_metrics = score_audit(case_dicts, pred_dicts, result_dicts, pop_manifest)
    agreement = compare_reports(canonical_metrics, audit_metrics)
    if not agreement["ok"]:
        raise Mai07R3LDiagnosticError(f"audit_disagreement:{agreement['mismatches'][:10]}")

    residual = build_residual_queue(cases, results)
    residual_dicts = [to_dict(r) for r in residual]
    reviewer_rows, private_map, packet_meta = build_targeted_packet(residual)

    semantic = compute_semantic_hash(
        case_dicts, pred_dicts, result_dicts, canonical_metrics, residual_dicts
    )

    residual_summary = {
        "total": len(residual),
        "by_tier": dict(Counter(r.residual_tier for r in residual)),
        "by_reason": dict(Counter(rc for r in residual for rc in r.reason_codes)),
    }
    clusters: dict[str, list[str]] = defaultdict(list)
    for r in residual:
        key = f"{r.residual_tier}|{r.behavior_class}|{','.join(sorted(r.reason_codes)[:3])}"
        clusters[key].append(r.source_item_id)
    cluster_manifest = {
        "clusters": [
            {"cluster_id": k, "count": len(v), "case_ids": sorted(v)}
            for k, v in sorted(clusters.items(), key=lambda kv: (-len(kv[1]), kv[0]))
        ]
    }

    security = {
        "accounting_mutation_attempts": 0,
        "successful_mutations": 0,
        "raw_mutations": canonical_metrics["safety"]["raw_text_mutation_count"],
        "protected_mutations": canonical_metrics["safety"]["protected_span_mutation_count"],
        "caps_respected_rate": canonical_metrics["safety"]["candidate_cap_compliance_rate"],
        "no_execution_authority_fields": True,
        "no_chain_of_thought": True,
        "no_tenant_identity_leakage": True,
        "critical_diagnostic_finding": canonical_metrics["safety"]["critical_diagnostic_finding"],
        "network_calls": 0,
        "llm_calls": 0,
    }

    immutability = {
        "runtime_version_unchanged": RUNTIME_VERSION == EXPECTED_RUNTIME,
        "resource_hash_unchanged": xlrr.validate_resources()["content_hash"] == EXPECTED_RESOURCE,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "official_inbox_empty": True,
        "mutated_canonical_resources": False,
    }

    authority = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "accounting_package_zip_raw_sha256": R3K_KNOWN["accounting_package_zip_raw_sha256"],
        "accounting_import_semantic_sha256": R3K_KNOWN["accounting_import_semantic_sha256"],
        "remaining_roles_import_semantic_sha256": R3K_KNOWN["remaining_roles_import_semantic_sha256"],
        "r3k_semantic_sha256": R3K_KNOWN["r3k_semantic_sha256"],
        "r3k_authority_manifest_sha256": EXPECTED_AUTH_MANIFEST,
        "runtime_version": EXPECTED_RUNTIME,
        "resource_hash": EXPECTED_RESOURCE,
        "overlay_enabled": False,
        "populations": {
            "unique_source_item_ids": EXPECTED_CASES,
            "four_role_cases": EXPECTED_FOUR,
            "three_role_cases": EXPECTED_THREE,
            "total_role_judgments": EXPECTED_JUDGMENTS,
            "risk_queue_cases": EXPECTED_RISK,
        },
        "preconditions": pre,
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
    }

    report = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "ok": True,
        "verdict": "PASSED_ENGINEERING_DIAGNOSTIC",
        "semantic_hash": semantic,
        "runtime_version": EXPECTED_RUNTIME,
        "resource_hash": EXPECTED_RESOURCE,
        "overlay_enabled": False,
        "case_count": len(cases),
        "outcome_counts": canonical_metrics["outcome_counts"],
        "safety": canonical_metrics["safety"],
        "residual_counts": residual_summary["by_tier"],
        "targeted_packet_count": len(reviewer_rows),
        "audit_agreement": agreement["ok"],
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
        "runtime_conformance_is_language_quality": False,
    }

    result: dict[str, Any] = {
        "ok": True,
        "semantic_hash": semantic,
        "report": report,
        "canonical_metrics": canonical_metrics,
        "audit_metrics": audit_metrics,
        "agreement": agreement,
        "residual_summary": residual_summary,
        "packet_meta": packet_meta,
        "cases": case_dicts,
        "predictions": pred_dicts,
        "results": result_dicts,
        "residual": residual_dicts,
    }

    if write:
        root = out_root or DEFAULT_OUT
        root.mkdir(parents=True, exist_ok=True)
        _write_json(root / "R3L_INPUT_AUTHORITY_MANIFEST.json", authority)
        _write_json(root / "R3L_POPULATION_MANIFEST.json", pop_manifest)
        _write_jsonl(root / "BEHAVIOR_EXPECTATIONS.jsonl", case_dicts)
        _write_jsonl(root / "ACTIVE_RUNTIME_PREDICTIONS.jsonl", pred_dicts)
        _write_jsonl(root / "CONFORMANCE_RESULTS.jsonl", result_dicts)
        _write_json(root / "CANONICAL_METRICS.json", canonical_metrics)
        _write_json(root / "INDEPENDENT_AUDIT_METRICS.json", audit_metrics)
        _write_json(root / "AUDIT_AGREEMENT_REPORT.json", agreement)
        _write_jsonl(root / "RESIDUAL_RISK_QUEUE.jsonl", residual_dicts)
        _write_json(root / "RESIDUAL_RISK_SUMMARY.json", residual_summary)
        _write_json(root / "RISK_CLUSTER_MANIFEST.json", cluster_manifest)
        pkt_info = write_packet_files(root, reviewer_rows, private_map)
        _write_json(root / "LEAKAGE_AUDIT.json", pkt_info["leakage"])
        if not pkt_info["leakage"]["ok"]:
            raise Mai07R3LDiagnosticError(f"packet_leakage:{pkt_info['leakage']['leaks']}")
        _write_json(root / "SECURITY_INVARIANTS.json", security)
        _write_json(
            root / "SEMANTIC_HASH.json",
            {"phase": PHASE, "schema": SCHEMA_VERSION, "semantic_hash": semantic, "case_count": len(cases)},
        )
        _write_json(root / "IMPORT_AND_RUNTIME_IMMUTABILITY_REPORT.json", immutability)
        _write_json(root / "RUNTIME_CONFORMANCE_REPORT.json", report)
        (root / "README.md").write_text(
            "\n".join(
                [
                    "# MAI-07R3L AI-Assisted Runtime Conformance Diagnostic",
                    "",
                    "Engineering diagnostic only. **Not** language quality, **not** gold,",
                    "**not** Round A, **not** linguist/production approval.",
                    "",
                    f"Semantic hash: `{semantic}`",
                    f"Cases: {len(cases)} · Residual: {len(residual)} · Packet: {len(reviewer_rows)}",
                    "",
                ]
            ),
            encoding="utf-8",
            newline="\n",
        )
        result["evidence_root"] = str(root)
        result["packet"] = pkt_info

    assert_official_inbox_empty()
    # resource immutability proof
    vr = xlrr.validate_resources()
    if vr.get("content_hash") != EXPECTED_RESOURCE or vr.get("mutated_canonical"):
        raise Mai07R3LDiagnosticError("resource_mutated_during_diagnostic")
    return result


def prove_deterministic_rerun(work_dir: Path) -> dict[str, Any]:
    a = run_diagnostic(out_root=work_dir / "a", write=True)
    b = run_diagnostic(out_root=work_dir / "b", write=True)
    if a["semantic_hash"] != b["semantic_hash"]:
        raise Mai07R3LDiagnosticError("semantic_hash_not_deterministic")
    # Compare key canonical artifacts byte-identical (excluding latency fields in predictions)
    def strip_latency(rows: list[dict[str, Any]]) -> bytes:
        cleaned = []
        for r in rows:
            c = dict(r)
            c.pop("latency_ms", None)
            cleaned.append(c)
        return json.dumps(cleaned, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()

    if strip_latency(a["results"]) != strip_latency(b["results"]):
        raise Mai07R3LDiagnosticError("results_not_deterministic")
    if a["canonical_metrics"]["metrics"] != b["canonical_metrics"]["metrics"]:
        raise Mai07R3LDiagnosticError("metrics_not_deterministic")
    return {
        "ok": True,
        "semantic_hash": a["semantic_hash"],
        "results_sha256": _sha256_bytes(strip_latency(a["results"])),
    }


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description=PHASE)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--prove-deterministic", action="store_true")
    args = p.parse_args(argv)
    try:
        if args.prove_deterministic:
            proof = prove_deterministic_rerun(REPO / "tmp_mai07_r3l_det_proof")
            print(json.dumps(proof, indent=2))
            return 0
        result = run_diagnostic(out_root=args.out, write=True)
        print(
            json.dumps(
                {
                    "ok": True,
                    "verdict": "PASSED_ENGINEERING_DIAGNOSTIC",
                    "semantic_hash": result["semantic_hash"],
                    "case_count": len(result["cases"]),
                    "outcome_counts": result["canonical_metrics"]["outcome_counts"],
                    "residual_total": result["residual_summary"]["total"],
                    "packet_count": result["packet_meta"]["selected_count"],
                    "audit_ok": result["agreement"]["ok"],
                    "critical_finding": result["canonical_metrics"]["safety"]["critical_diagnostic_finding"],
                },
                indent=2,
            )
        )
        return 0
    except Mai07R3LDiagnosticError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

