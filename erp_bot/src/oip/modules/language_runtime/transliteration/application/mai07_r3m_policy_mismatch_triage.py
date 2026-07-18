"""MAI-07R3M — AI-assisted policy mismatch triage (saved R3L evidence only).

Does not rerun the transliteration runtime. Does not invent Devanagari targets.
"""

from __future__ import annotations

import ast
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from .mai07_r3ja_v3_agreement import ROUND_A_DISPOSITIONS
from .mai07_r3ja_v3_firewall import REPO
from .mai07_r3k_hash_contract import sha256_file
from .mai07_r3l_runtime_conformance_diagnostic import DEFAULT_OUT as R3L_OUT
from .mai07_r3l_runtime_conformance_diagnostic import OFFICIAL_INBOX
from .mai07_r3m_audit_triage import classify_all_audit, compare_triage
from .mai07_r3m_canonical_triage import classify_all
from .mai07_r3m_contracts import FIXED_GOVERNANCE, PHASE, SCHEMA_VERSION, to_dict
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from ..infrastructure import resource_repository as xlrr

EXPECTED_R3L_SEM = "ca134c346414a2d30a448dddabb72287eac809965165a1a037431ee7c3cad6de"
EXPECTED_R3K_SEM = "42d1a5ffc170d201f8a4bf92e4cef4f156dde57c07e847c960835e26080ddafc"
EXPECTED_AUTH = "65bfa6847a8d3d58af4e092f4217d65b3b6e5d51035c401e7304be1ed77fe2b8"
EXPECTED_RESOURCE = "1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930"
EXPECTED_RUNTIME = "mai-07.1.3-r3f-sealnew"

R3K_ROOT = REPO / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic"
DEFAULT_OUT = REPO / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/policy_mismatch_triage"
_PACKET_SEED = "mai07-r3m-refined-packet-20260717"

FORBIDDEN_IMPORT_MARKERS = (
    "openai",
    "anthropic",
    "httpx",
    "requests",
    "eval_mai07_r3e",
    "eval_mai07_r3g",
    "eval_mai07_r3i",
    "build_mai07r3c_dataset_v2",
    "posting",
    "oec",
    "sync_outbox",
    "transliteration_service",
    "deterministic_generator",
    "deterministic_ranker",
)


class Mai07R3MTriageError(ValueError):
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
    lines = [json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for r in rows]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8", newline="\n")
    return sha256_file(path)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(ln) for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]


def assert_official_inbox_empty() -> None:
    if not OFFICIAL_INBOX.exists():
        return
    hits = list(OFFICIAL_INBOX.rglob("*.xlsx")) + list(OFFICIAL_INBOX.rglob("*.xlsm"))
    if hits:
        raise Mai07R3MTriageError(f"official_inbox_not_empty:{hits}")


def assert_no_runtime_invocation_in_module() -> None:
    src = Path(__file__).read_text(encoding="utf-8")
    tree = ast.parse(src)
    imported: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.extend(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            imported.append(node.module or "")
    joined = " ".join(imported)
    for bad in FORBIDDEN_IMPORT_MARKERS:
        if bad in joined:
            raise Mai07R3MTriageError(f"forbidden_import:{bad}")


def verify_preconditions() -> dict[str, Any]:
    assert_official_inbox_empty()
    assert_no_runtime_invocation_in_module()
    if RUNTIME_VERSION != EXPECTED_RUNTIME:
        raise Mai07R3MTriageError(f"BLOCKED_PRECONDITION_FAILED:runtime:{RUNTIME_VERSION}")
    if ENABLE_PROMOTION_OVERLAY is not False:
        raise Mai07R3MTriageError("BLOCKED_PRECONDITION_FAILED:overlay")
    vr = xlrr.validate_resources()
    if not vr.get("ok") or vr.get("content_hash") != EXPECTED_RESOURCE:
        raise Mai07R3MTriageError(f"BLOCKED_PRECONDITION_FAILED:resource:{vr}")

    r3l_sem = json.loads((R3L_OUT / "SEMANTIC_HASH.json").read_text(encoding="utf-8"))
    r3k_sem = json.loads((R3K_ROOT / "reports/SEMANTIC_HASH.json").read_text(encoding="utf-8"))
    auth = R3K_ROOT / "R3K_INPUT_AUTHORITY_MANIFEST.json"
    rep = json.loads((R3L_OUT / "RUNTIME_CONFORMANCE_REPORT.json").read_text(encoding="utf-8"))
    can = json.loads((R3L_OUT / "CANONICAL_METRICS.json").read_text(encoding="utf-8"))
    agr = json.loads((R3L_OUT / "AUDIT_AGREEMENT_REPORT.json").read_text(encoding="utf-8"))
    residuals = load_jsonl(R3L_OUT / "RESIDUAL_RISK_QUEUE.jsonl")
    results = load_jsonl(R3L_OUT / "CONFORMANCE_RESULTS.jsonl")
    preds = load_jsonl(R3L_OUT / "ACTIVE_RUNTIME_PREDICTIONS.jsonl")
    cases = load_jsonl(R3L_OUT / "BEHAVIOR_EXPECTATIONS.jsonl")
    oc = Counter(r["outcome"] for r in results)
    tiers = Counter(r["residual_tier"] for r in residuals)
    checks = {
        "r3l_sem": r3l_sem["semantic_hash"] == EXPECTED_R3L_SEM,
        "r3k_sem": r3k_sem["semantic_hash"] == EXPECTED_R3K_SEM,
        "auth": sha256_file(auth) == EXPECTED_AUTH,
        "cases": len(cases) == 1111,
        "preds": len(preds) == 1111,
        "results": len(results) == 1111,
        "pass": oc.get("PASS") == 769,
        "fail": oc.get("FAIL") == 328,
        "span": oc.get("SPAN_FAILURE") == 14,
        "exc": oc.get("EXCEPTION", 0) == 0,
        "residual": len(residuals) == 829,
        "t1": tiers.get("TIER_1_CRITICAL") == 8,
        "t2": tiers.get("TIER_2_HIGH") == 328,
        "t3": tiers.get("TIER_3_MEDIUM") == 493,
        "packet": rep.get("targeted_packet_count") == 65,
        "acct": sum(1 for c in cases if c["provenance_bucket"] == "ACCOUNTING_CONTENT_MAP") == 611,
        "heur": sum(1 for c in cases if c["provenance_bucket"] == "HEURISTIC_V1") == 500,
        "raw": can["safety"]["raw_text_mutation_count"] == 0,
        "prot": can["safety"]["protected_span_mutation_count"] == 0,
        "caps": can["safety"]["candidate_cap_compliance_numerator"] == 1111,
        "acct_mut": can["safety"]["accounting_mutation_attempts"] == 0,
        "audit": agr.get("ok") is True,
        "scorable": can["metrics"]["pass_rate__ALL_CASES"]["denominator"] == 1097,
        "runtime_recorded": rep.get("runtime_version") == EXPECTED_RUNTIME,
    }
    if not all(checks.values()):
        raise Mai07R3MTriageError(f"BLOCKED_PRECONDITION_FAILED:{ {k:v for k,v in checks.items() if not v} }")
    return {
        "ok": True,
        "checks": checks,
        "residuals": residuals,
        "results": results,
        "preds": preds,
        "cases": cases,
        "canonical_metrics": can,
        "r3l_report": rep,
    }


def build_critical_semantics_clarification(
    residuals: list[dict[str, Any]],
    results_by: dict[str, dict[str, Any]],
    safety: dict[str, Any],
) -> dict[str, Any]:
    t1 = [r for r in residuals if r["residual_tier"] == "TIER_1_CRITICAL"]
    # Occurrence counts (historical field; used in semantic hash — do not change semantics).
    reason_counts = dict(Counter(rc for r in t1 for rc in r["reason_codes"]))

    # Primary/secondary partition (report-only clarity; not part of semantic hash payload).
    primary_counts: Counter[str] = Counter()
    secondary_counts: Counter[str] = Counter()
    for r in t1:
        reasons = list(r.get("reason_codes") or [])
        behavior = r["behavior_class"]
        if behavior == "ABSTAIN" and "ABSTAIN_FORCE_TRANSLITERATED" in reasons:
            primary = "ABSTAIN_FORCE_TRANSLITERATED"
        elif "FALSE_FORCED_DEVANAGARI_TOP1" in reasons:
            primary = "FALSE_FORCED_DEVANAGARI_TOP1"
        elif "IDENTITY_NOT_TOP1" in reasons:
            primary = "IDENTITY_NOT_TOP1"
        else:
            primary = sorted(reasons)[0] if reasons else "UNKNOWN"
        primary_counts[primary] += 1
        for rc in set(reasons) - {primary}:
            secondary_counts[rc] += 1

    return {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "clarifies_r3l_without_rewriting_r3l_semantic_hash": True,
        "r3l_semantic_hash_preserved": EXPECTED_R3L_SEM,
        "r3l_reported_CRITICAL_DIAGNOSTIC_FINDING": safety.get("critical_diagnostic_finding"),
        "critical_safety_invariant_failure": False,
        "critical_safety_invariant_failure_count": 0,
        "critical_safety_invariant_evidence": {
            "raw_text_mutation_count": safety.get("raw_text_mutation_count"),
            "protected_span_mutation_count": safety.get("protected_span_mutation_count"),
            "candidate_cap_compliance": (
                f"{safety.get('candidate_cap_compliance_numerator')}/"
                f"{safety.get('candidate_cap_compliance_denominator')}"
            ),
            "accounting_mutation_attempts": safety.get("accounting_mutation_attempts"),
        },
        "tier1_policy_critical_present": True,
        "tier1_policy_critical_count": len(t1),
        "tier1_policy_critical_unique_case_count": len(t1),
        # Historical occurrence field retained for semantic-hash stability.
        "tier1_policy_critical_reason_counts": reason_counts,
        "tier1_policy_critical_reason_counts_counting_unit": "secondary_or_any_role_occurrence_not_unique_partition",
        "tier1_policy_critical_primary_reason_counts": dict(sorted(primary_counts.items())),
        "tier1_policy_critical_secondary_reason_occurrence_counts": dict(
            sorted(secondary_counts.items())
        ),
        "tier1_reason_counting_units": {
            "unique_case_count": "distinct Tier-1 source_item_id",
            "primary_reason_case_count": "partition of Tier-1 unique population",
            "secondary_reason_occurrence_count": "co-occurring reasons; never unique Tier-1 population",
            "overlap_count": "cases with multiple reason codes",
            "union_case_count": "must equal tier1_policy_critical_unique_case_count",
        },
        "tier1_policy_critical_outcomes": dict(
            Counter(results_by[r["source_item_id"]]["outcome"] for r in t1)
        ),
        "note": (
            "R3L CRITICAL_DIAGNOSTIC_FINDING refers to safety invariants "
            "(raw/protected/cap/accounting). TIER_1_CRITICAL residual cases are "
            "policy-conformance criticals and are tracked separately here. "
            "tier1_policy_critical_reason_counts are occurrence counts — "
            "use primary_reason_counts to partition the 8 unique Tier-1 cases."
        ),
        "prohibited_for_training": True,
        "governance": dict(FIXED_GOVERNANCE),
    }


def reject_ambiguous_tier1_reason_prose(text: str) -> None:
    """Reject report prose that presents occurrence counts without counting units."""
    # Known pre-closure ambiguous pattern (no primary/secondary distinction).
    if (
        "FALSE_FORCED_DEVANAGARI_TOP1×8" in text
        and "IDENTITY_NOT_TOP1×5" in text
        and "ABSTAIN_FORCE" in text
        and "primary_reason" not in text.lower()
        and "occurrence" not in text.lower()
        and "counting_unit" not in text.lower()
    ):
        raise Mai07R3MTriageError(
            "ambiguous_tier1_reason_prose:occurrence_counts_without_counting_unit"
        )


def opaque_id(source_item_id: str) -> str:
    return "R3M-" + hashlib.sha256(f"{_PACKET_SEED}:{source_item_id}".encode()).hexdigest()[:16]


def build_clusters(triage_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in triage_rows:
        key = "|".join(
            [
                row["observation_class"],
                row["root_cause"]["primary_stage"],
                row["action_disposition"],
                row["evidence"]["evidence_strength"],
                row["evidence"]["behavior_class"],
                row["evidence"]["provenance_bucket"],
                row["evidence"]["residual_tier"],
            ]
        )
        groups[key].append(row)
    clusters = []
    for key, rows in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        cid = "CL-" + hashlib.sha256(key.encode()).hexdigest()[:12]
        ids = tuple(sorted(r["source_item_id"] for r in rows))
        clusters.append(
            {
                "cluster_id": cid,
                "cluster_key": key,
                "observation_class": rows[0]["observation_class"],
                "primary_stage": rows[0]["root_cause"]["primary_stage"],
                "action_disposition": rows[0]["action_disposition"],
                "evidence_strength": rows[0]["evidence"]["evidence_strength"],
                "behavior_class": rows[0]["evidence"]["behavior_class"],
                "provenance_bucket": rows[0]["evidence"]["provenance_bucket"],
                "residual_tier": rows[0]["evidence"]["residual_tier"],
                "case_count": len(rows),
                "case_ids": list(ids),  # private aggregate file only
                "representative_opaque_ids": [opaque_id(i) for i in ids[:5]],
                "corrective_eligible": rows[0]["action_disposition"]
                in ("CODE_CORRECTIVE_CANDIDATE", "RESOURCE_CORRECTIVE_CANDIDATE", "NON_FROZEN_TEST_CANDIDATE"),
                "human_review_needed": rows[0]["action_disposition"]
                in (
                    "TARGETED_HUMAN_REVIEW_REQUIRED",
                    "PROFESSIONAL_LINGUIST_REVIEW_REQUIRED",
                    "POLICY_CLARIFICATION_REQUIRED",
                ),
                "disposition_distribution": dict(
                    Counter(r["evidence"]["review_disposition"] for r in rows)
                ),
                "confidence_distribution": dict(Counter(r["evidence"]["confidence"] for r in rows)),
            }
        )
    return clusters


def public_cluster_summary(clusters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Strip private case IDs and raw text from public aggregate."""
    out = []
    for c in clusters:
        pub = {k: v for k, v in c.items() if k != "case_ids"}
        pub["case_ids_redacted"] = True
        pub["case_count"] = c["case_count"]
        out.append(pub)
    return out


def partition_queues(triage_rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    queues: dict[str, list[dict[str, Any]]] = {
        "CODE_CORRECTIVE_CANDIDATE": [],
        "RESOURCE_CORRECTIVE_CANDIDATE": [],
        "NON_FROZEN_TEST_CANDIDATE": [],
        "TARGETED_HUMAN_REVIEW_REQUIRED": [],
        "PROFESSIONAL_LINGUIST_REVIEW_REQUIRED": [],
        "POLICY_CLARIFICATION_REQUIRED": [],
        "NO_CORRECTIVE_ACTION_RISK_ONLY": [],
        "BLOCKED_MISSING_EVIDENCE": [],
    }
    for row in triage_rows:
        ad = row["action_disposition"]
        if ad not in queues:
            raise Mai07R3MTriageError(f"unknown_action:{ad}")
        queues[ad].append(
            {
                "source_item_id": row["source_item_id"],
                "diagnostic_case_id": row["diagnostic_case_id"],
                "observation_class": row["observation_class"],
                "primary_stage": row["root_cause"]["primary_stage"],
                "evidence_strength": row["evidence"]["evidence_strength"],
                "action_disposition": ad,
                "rationale_codes": row["root_cause"]["rationale_codes"],
                "behavior_class": row["evidence"]["behavior_class"],
                "residual_tier": row["evidence"]["residual_tier"],
                "blocked_information": (
                    ["NO_EXACT_DEVANAGARI_TARGET", "HEURISTIC_NOT_LEXICON_AUTHORITY"]
                    if ad != "CODE_CORRECTIVE_CANDIDATE"
                    else ["NO_EXACT_DEVANAGARI_TARGET"]
                ),
                "prohibited_for_training": True,
            }
        )
    # disjoint + union
    seen: set[str] = set()
    for name, rows in queues.items():
        for r in rows:
            if r["source_item_id"] in seen:
                raise Mai07R3MTriageError(f"duplicate_queue_membership:{r['source_item_id']}")
            seen.add(r["source_item_id"])
    if len(seen) != len(triage_rows):
        raise Mai07R3MTriageError(f"queue_union:{len(seen)}!={len(triage_rows)}")
    return queues


def build_refined_packet(
    triage_rows: list[dict[str, Any]],
    residuals_by: dict[str, dict[str, Any]],
    *,
    max_rows: int = 200,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    priority = {
        "CODE_CORRECTIVE_CANDIDATE": 0,
        "TARGETED_HUMAN_REVIEW_REQUIRED": 1,
        "PROFESSIONAL_LINGUIST_REVIEW_REQUIRED": 1,
        "POLICY_CLARIFICATION_REQUIRED": 2,
        "NON_FROZEN_TEST_CANDIDATE": 3,
        "BLOCKED_MISSING_EVIDENCE": 4,
        "NO_CORRECTIVE_ACTION_RISK_ONLY": 5,
        "RESOURCE_CORRECTIVE_CANDIDATE": 0,
    }
    must_ids: set[str] = set()
    selected: list[dict[str, Any]] = []
    for r in triage_rows:
        if r["evidence"]["residual_tier"] == "TIER_1_CRITICAL" or (
            r["observation_class"] in ("ACTUAL_CONFORMANCE_FAILURE", "SPAN_FAILURE")
            and r["action_disposition"]
            in (
                "CODE_CORRECTIVE_CANDIDATE",
                "TARGETED_HUMAN_REVIEW_REQUIRED",
                "PROFESSIONAL_LINGUIST_REVIEW_REQUIRED",
                "POLICY_CLARIFICATION_REQUIRED",
                "BLOCKED_MISSING_EVIDENCE",
            )
        ):
            if r["source_item_id"] not in must_ids:
                selected.append(r)
                must_ids.add(r["source_item_id"])

    # greedy coverage by stage/action
    covered = set()
    for r in selected:
        covered.add(r["root_cause"]["primary_stage"])
        covered.add(r["action_disposition"])

    rest = sorted(
        [r for r in triage_rows if r["source_item_id"] not in must_ids],
        key=lambda r: (priority.get(r["action_disposition"], 9), r["source_item_id"]),
    )
    for r in rest:
        if len(selected) >= max_rows:
            break
        fam = r["root_cause"]["primary_stage"]
        if fam not in covered or sum(1 for x in selected if x["root_cause"]["primary_stage"] == fam) < 5:
            selected.append(r)
            must_ids.add(r["source_item_id"])
            covered.add(fam)

    selected = selected[:max_rows]
    selected.sort(
        key=lambda r: (
            priority.get(r["action_disposition"], 9),
            0 if r["evidence"]["residual_tier"] == "TIER_1_CRITICAL" else 1,
            r["source_item_id"],
        )
    )

    reviewer: list[dict[str, Any]] = []
    private: list[dict[str, Any]] = []
    for r in selected:
        sid = r["source_item_id"]
        residual = residuals_by[sid]
        oid = opaque_id(sid)
        reviewer.append(
            {
                "opaque_review_id": oid,
                "input_text": residual["input_text"],
                "highlighted_span": residual["highlighted_span"],
                "context_note": "Neutral triage sample. Assign disposition independently.",
                "disposition": "",
                "confidence": "",
                "reviewer_notes": "",
            }
        )
        private.append(
            {
                "opaque_review_id": oid,
                "source_item_id": sid,
                "diagnostic_case_id": r["diagnostic_case_id"],
                "observation_class": r["observation_class"],
                "primary_stage": r["root_cause"]["primary_stage"],
                "action_disposition": r["action_disposition"],
                "evidence_strength": r["evidence"]["evidence_strength"],
                "use": "adjudication_import_only",
                "prohibited_for_runtime": True,
                "prohibited_for_training": True,
            }
        )
    meta = {"selected_count": len(selected), "max_rows": max_rows, "tier1_included": sum(1 for r in selected if r["evidence"]["residual_tier"] == "TIER_1_CRITICAL")}
    return reviewer, private, meta


def write_refined_packet(out: Path, reviewer: list[dict[str, Any]], private: list[dict[str, Any]]) -> dict[str, Any]:
    pkt = out / "refined_targeted_review_packet"
    pkt.mkdir(parents=True, exist_ok=True)
    priv = pkt / "private_adjudication_import_only"
    priv.mkdir(parents=True, exist_ok=True)
    headers = [
        "opaque_review_id",
        "input_text",
        "highlighted_span",
        "context_note",
        "disposition",
        "confidence",
        "reviewer_notes",
    ]
    csv_path = out / "REFINED_TARGETED_REVIEW_PACKET.csv"
    lines = [",".join(headers)]
    for row in reviewer:
        vals = []
        for h in headers:
            v = str(row.get(h, "")).replace('"', '""')
            vals.append(f'"{v}"')
        lines.append(",".join(vals))
    csv_path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    _write_json(
        out / "REFINED_TARGETED_REVIEW_PRIVATE_MAPPING.json",
        {
            "use": "adjudication_import_only",
            "prohibited_for_runtime": True,
            "prohibited_for_training": True,
            "items": private,
        },
    )
    blob = csv_path.read_text(encoding="utf-8").lower()
    forbidden = [
        "product_policy",
        "nepali_fluent",
        "professional_linguist",
        "heuristic_v1",
        "accounting_content_map",
        "tier_1_critical",
        "source_item_id",
        "english_identity_guard",
        "code_corrective",
        "v3src-",
        "v3dx-",
    ]
    leaks = [t for t in forbidden if t in blob]
    for m in private:
        if m["source_item_id"].lower() in blob:
            leaks.append(f"source_leak:{m['source_item_id']}")
    return {"ok": len(leaks) == 0, "leaks": leaks, "csv_sha256": sha256_file(csv_path)}


def compute_semantic_hash(
    triage_rows: list[dict[str, Any]],
    queues: dict[str, list[dict[str, Any]]],
    clusters_public: list[dict[str, Any]],
    clarification: dict[str, Any],
) -> str:
    payload = {
        "schema": SCHEMA_VERSION,
        "phase": PHASE,
        "triage": [
            {
                "source_item_id": r["source_item_id"],
                "observation_class": r["observation_class"],
                "primary_stage": r["root_cause"]["primary_stage"],
                "action_disposition": r["action_disposition"],
                "evidence_strength": r["evidence"]["evidence_strength"],
            }
            for r in triage_rows
        ],
        "queue_counts": {k: len(v) for k, v in sorted(queues.items())},
        "clusters": [
            {
                "cluster_id": c["cluster_id"],
                "case_count": c["case_count"],
                "primary_stage": c["primary_stage"],
                "action_disposition": c["action_disposition"],
            }
            for c in clusters_public
        ],
        "critical_semantics": {
            "critical_safety_invariant_failure": clarification["critical_safety_invariant_failure"],
            "tier1_policy_critical_count": clarification["tier1_policy_critical_count"],
            "tier1_policy_critical_reason_counts": clarification["tier1_policy_critical_reason_counts"],
        },
        "governance": FIXED_GOVERNANCE,
    }
    return _sha256_bytes(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )


def run_triage(*, out_root: Path | None = None, write: bool = True) -> dict[str, Any]:
    pre = verify_preconditions()
    residuals = pre["residuals"]
    results = pre["results"]
    preds = pre["preds"]
    cases = pre["cases"]
    results_by = {r["source_item_id"]: r for r in results}
    preds_by = {p["source_item_id"]: p for p in preds}
    cases_by = {c["source_item_id"]: c for c in cases}
    residuals_by = {r["source_item_id"]: r for r in residuals}

    canonical_objs = classify_all(residuals, results_by, preds_by, cases_by)
    canonical_rows = [to_dict(x) for x in canonical_objs]
    audit_rows = classify_all_audit(residuals, results_by, preds_by, cases_by)
    agreement = compare_triage(canonical_rows, audit_rows)
    if not agreement["ok"]:
        raise Mai07R3MTriageError(f"audit_disagreement:{agreement['mismatches'][:20]}")

    clarification = build_critical_semantics_clarification(
        residuals, results_by, pre["canonical_metrics"]["safety"]
    )
    clusters = build_clusters(canonical_rows)
    clusters_public = public_cluster_summary(clusters)
    queues = partition_queues(canonical_rows)

    # completeness
    obs_counts = Counter(r["observation_class"] for r in canonical_rows)
    stage_counts = Counter(r["root_cause"]["primary_stage"] for r in canonical_rows)
    strength_counts = Counter(r["evidence"]["evidence_strength"] for r in canonical_rows)
    action_counts = Counter(r["action_disposition"] for r in canonical_rows)
    fail_classified = sum(1 for r in canonical_rows if results_by[r["source_item_id"]]["outcome"] == "FAIL")
    span_classified = sum(1 for r in canonical_rows if r["observation_class"] == "SPAN_FAILURE")
    t3 = [r for r in residuals if r["residual_tier"] == "TIER_3_MEDIUM"]
    t3_rows = [canonical_rows_by for canonical_rows_by in canonical_rows if residuals_by[canonical_rows_by["source_item_id"]]["residual_tier"] == "TIER_3_MEDIUM"]
    t3_actual = sum(1 for r in t3_rows if r["observation_class"] == "ACTUAL_CONFORMANCE_FAILURE")
    t3_risk = sum(1 for r in t3_rows if r["observation_class"] == "RISK_ONLY_PASS")
    t1_assessed = sum(1 for r in canonical_rows if r["evidence"]["residual_tier"] == "TIER_1_CRITICAL")

    gates = {
        "residual_829": len(canonical_rows) == 829,
        "fail_328": fail_classified == 328,
        "span_14": span_classified == 14,
        "tier3_493": len(t3_rows) == 493,
        "tier3_split": t3_actual + t3_risk == 493,
        "tier1_8": t1_assessed == 8,
        "audit_ok": agreement["ok"],
        "no_duplicates": len({r["source_item_id"] for r in canonical_rows}) == 829,
        "queue_union_829": sum(len(v) for v in queues.values()) == 829,
    }
    completeness = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "ok": all(gates.values()),
        "residual_reconciled": len(canonical_rows),
        "fail_classified": fail_classified,
        "span_classified": span_classified,
        "tier3_actual_mismatch": t3_actual,
        "tier3_risk_only": t3_risk,
        "tier1_assessed": t1_assessed,
        "duplicates": 0,
        "missing": 0,
        "gates": gates,
        "observation_class_counts": dict(sorted(obs_counts.items())),
        "root_cause_stage_counts": dict(sorted(stage_counts.items())),
        "evidence_strength_counts": dict(sorted(strength_counts.items())),
        "action_disposition_counts": dict(sorted(action_counts.items())),
        "prohibited_for_training": True,
    }
    if not completeness["ok"]:
        raise Mai07R3MTriageError(f"completeness_failed:{gates}")

    reviewer, private, packet_meta = build_refined_packet(canonical_rows, residuals_by)

    code_n = len(queues["CODE_CORRECTIVE_CANDIDATE"])
    res_n = len(queues["RESOURCE_CORRECTIVE_CANDIDATE"])
    human_n = len(queues["TARGETED_HUMAN_REVIEW_REQUIRED"])
    ling_n = len(queues["PROFESSIONAL_LINGUIST_REVIEW_REQUIRED"])
    if code_n + res_n > 0:
        next_phase = "MAI-07R3N-NON-FROZEN-POLICY-CONFORMANCE-CORRECTIVE"
        rule = "non_empty_supported_code_or_resource_queue"
    else:
        next_phase = "MAI-07R3N-TARGETED-HUMAN-POLICY-ADJUDICATION"
        rule = "evidence_uncertainty_dominates_no_safe_corrective_queue"

    next_rec = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "recommended_phase": next_phase,
        "selection_rule_applied": rule,
        "code_corrective_count": code_n,
        "resource_corrective_count": res_n,
        "human_review_count": human_n,
        "linguist_review_count": ling_n,
        "rationale_codes": (
            "CODE_QUEUE_NONEMPTY" if code_n else "CODE_QUEUE_EMPTY",
            "RESOURCE_QUEUE_NONEMPTY" if res_n else "RESOURCE_QUEUE_EMPTY",
        ),
        "prohibited_for_training": True,
        "governance": dict(FIXED_GOVERNANCE),
    }

    semantic = compute_semantic_hash(canonical_rows, queues, clusters_public, clarification)

    tier1_private = [
        {
            "source_item_id": r["source_item_id"],
            "diagnostic_case_id": r["diagnostic_case_id"],
            "observation_class": r["observation_class"],
            "primary_stage": r["root_cause"]["primary_stage"],
            "action_disposition": r["action_disposition"],
            "evidence_strength": r["evidence"]["evidence_strength"],
            "residual_reasons": r["evidence"]["residual_reasons"],
            "rationale_codes": r["root_cause"]["rationale_codes"],
            "behavior_class": r["evidence"]["behavior_class"],
            "prohibited_for_training": True,
        }
        for r in canonical_rows
        if r["evidence"]["residual_tier"] == "TIER_1_CRITICAL"
    ]

    canonical_report = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "classifier_id": "mai07_r3m_canonical_triage_classifier",
        "ok": True,
        "verdict": "PASSED_ENGINEERING_TRIAGE",
        "semantic_hash": semantic,
        "counts": completeness,
        "queue_counts": {k: len(v) for k, v in queues.items()},
        "critical_semantics": {
            "critical_safety_invariant_failure": clarification["critical_safety_invariant_failure"],
            "tier1_policy_critical_count": clarification["tier1_policy_critical_count"],
        },
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
    }
    audit_report = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "classifier_id": "mai07_r3m_audit_triage_classifier",
        "ok": True,
        "observation_class_counts": dict(Counter(r["observation_class"] for r in audit_rows)),
        "root_cause_stage_counts": dict(Counter(r["root_cause"]["primary_stage"] for r in audit_rows)),
        "action_disposition_counts": dict(Counter(r["action_disposition"] for r in audit_rows)),
        "evidence_strength_counts": dict(Counter(r["evidence"]["evidence_strength"] for r in audit_rows)),
        "queue_counts": {
            k: sum(1 for r in audit_rows if r["action_disposition"] == k) for k in queues
        },
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
    }

    authority = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "r3l_semantic_sha256": EXPECTED_R3L_SEM,
        "r3k_semantic_sha256": EXPECTED_R3K_SEM,
        "r3k_authority_manifest_sha256": EXPECTED_AUTH,
        "runtime_version": EXPECTED_RUNTIME,
        "resource_hash": EXPECTED_RESOURCE,
        "overlay_enabled": False,
        "r3l_counts": {
            "cases": 1111,
            "pass": 769,
            "fail": 328,
            "span_failure": 14,
            "exception": 0,
            "scorable": 1097,
            "residual": 829,
            "tier1": 8,
            "tier2": 328,
            "tier3": 493,
            "packet": 65,
        },
        "preconditions": pre["checks"],
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
    }

    immutability = {
        "r3l_semantic_unchanged": True,
        "r3l_predictions_not_regenerated": True,
        "runtime_not_invoked": True,
        "resource_hash_unchanged": xlrr.validate_resources()["content_hash"] == EXPECTED_RESOURCE,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "mutated_canonical_resources": False,
        "official_inbox_empty": True,
        "frozen_artifacts_unread": True,
    }

    firewall = {
        "forbidden_imports_checked": list(FORBIDDEN_IMPORT_MARKERS),
        "ok": True,
        "reads_only_r3l_r3k_ai_assisted": True,
        "no_frozen_v2_mining": True,
        "no_llm_network": True,
    }

    result: dict[str, Any] = {
        "ok": True,
        "semantic_hash": semantic,
        "canonical_rows": canonical_rows,
        "audit_rows": audit_rows,
        "agreement": agreement,
        "completeness": completeness,
        "queues": queues,
        "clusters": clusters,
        "clusters_public": clusters_public,
        "clarification": clarification,
        "next_rec": next_rec,
        "packet_meta": packet_meta,
        "canonical_report": canonical_report,
        "tier1_private": tier1_private,
    }

    if write:
        root = out_root or DEFAULT_OUT
        root.mkdir(parents=True, exist_ok=True)
        _write_json(root / "R3M_INPUT_AUTHORITY_MANIFEST.json", authority)
        _write_json(root / "R3L_CRITICAL_SEMANTICS_CLARIFICATION.json", clarification)
        _write_jsonl(root / "TRIAGE_CASES.jsonl", canonical_rows)
        _write_json(root / "ROOT_CAUSE_CLUSTERS.json", {"clusters": clusters, "public_summary": clusters_public})
        _write_jsonl(root / "ACTIONABLE_CODE_CORRECTIVE_QUEUE.jsonl", queues["CODE_CORRECTIVE_CANDIDATE"])
        _write_jsonl(root / "RESOURCE_CORRECTIVE_QUEUE.jsonl", queues["RESOURCE_CORRECTIVE_CANDIDATE"])
        _write_jsonl(root / "NON_FROZEN_TEST_CANDIDATES.jsonl", queues["NON_FROZEN_TEST_CANDIDATE"])
        _write_jsonl(root / "TARGETED_HUMAN_REVIEW_QUEUE.jsonl", queues["TARGETED_HUMAN_REVIEW_REQUIRED"])
        _write_jsonl(
            root / "PROFESSIONAL_LINGUIST_REVIEW_QUEUE.jsonl",
            queues["PROFESSIONAL_LINGUIST_REVIEW_REQUIRED"],
        )
        _write_jsonl(root / "POLICY_CLARIFICATION_QUEUE.jsonl", queues["POLICY_CLARIFICATION_REQUIRED"])
        _write_jsonl(root / "DIAGNOSTIC_ONLY_RISK_QUEUE.jsonl", queues["NO_CORRECTIVE_ACTION_RISK_ONLY"])
        _write_jsonl(root / "TIER1_PRIVATE_ASSESSMENT.jsonl", tier1_private)
        leak = write_refined_packet(root, reviewer, private)
        if not leak["ok"]:
            raise Mai07R3MTriageError(f"packet_leakage:{leak['leaks']}")
        _write_json(root / "CANONICAL_TRIAGE_REPORT.json", canonical_report)
        _write_json(root / "INDEPENDENT_AUDIT_TRIAGE_REPORT.json", audit_report)
        _write_json(root / "AUDIT_AGREEMENT_REPORT.json", agreement)
        _write_json(root / "TRIAGE_COMPLETENESS_REPORT.json", completeness)
        _write_json(root / "LEAKAGE_AND_FIREWALL_REPORT.json", {"leakage": leak, "firewall": firewall})
        _write_json(root / "IMMUTABILITY_REPORT.json", immutability)
        _write_json(root / "NEXT_PHASE_RECOMMENDATION.json", next_rec)
        _write_json(
            root / "SEMANTIC_HASH.json",
            {"phase": PHASE, "schema": SCHEMA_VERSION, "semantic_hash": semantic, "residual_count": 829},
        )
        # blocked missing evidence queue is part of completeness but also write for auditability
        _write_jsonl(root / "BLOCKED_MISSING_EVIDENCE_QUEUE.jsonl", queues["BLOCKED_MISSING_EVIDENCE"])
        (root / "README.md").write_text(
            "\n".join(
                [
                    "# MAI-07R3M Policy Mismatch Triage",
                    "",
                    "Engineering triage of saved R3L residuals. Not quality gold.",
                    f"Semantic hash: `{semantic}`",
                    f"Next: `{next_phase}`",
                    "",
                ]
            ),
            encoding="utf-8",
            newline="\n",
        )
        result["evidence_root"] = str(root)
        result["leakage"] = leak

    assert_official_inbox_empty()
    return result


def prove_deterministic_rerun(work_dir: Path) -> dict[str, Any]:
    a = run_triage(out_root=work_dir / "a", write=True)
    b = run_triage(out_root=work_dir / "b", write=True)
    if a["semantic_hash"] != b["semantic_hash"]:
        raise Mai07R3MTriageError("semantic_hash_not_deterministic")
    p1 = (work_dir / "a/TRIAGE_CASES.jsonl").read_bytes()
    p2 = (work_dir / "b/TRIAGE_CASES.jsonl").read_bytes()
    if p1 != p2:
        raise Mai07R3MTriageError("triage_cases_not_byte_identical")
    return {"ok": True, "semantic_hash": a["semantic_hash"], "triage_sha256": _sha256_bytes(p1)}


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description=PHASE)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--prove-deterministic", action="store_true")
    args = p.parse_args(argv)
    try:
        if args.prove_deterministic:
            print(json.dumps(prove_deterministic_rerun(REPO / "tmp_mai07_r3m_det_proof"), indent=2))
            return 0
        result = run_triage(out_root=args.out, write=True)
        print(
            json.dumps(
                {
                    "ok": True,
                    "verdict": "PASSED_ENGINEERING_TRIAGE",
                    "semantic_hash": result["semantic_hash"],
                    "observation_class_counts": result["completeness"]["observation_class_counts"],
                    "action_disposition_counts": result["completeness"]["action_disposition_counts"],
                    "next_phase": result["next_rec"]["recommended_phase"],
                    "packet": result["packet_meta"]["selected_count"],
                },
                indent=2,
            )
        )
        return 0
    except Mai07R3MTriageError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
