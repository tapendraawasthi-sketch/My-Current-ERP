"""MAI-07R3C — build frozen derived dataset V2 (deterministic, no runtime gold).

Does not mutate V1, does not tune rankers, does not enable overlays.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from .build_mai07r3a_review_packet import recompute_conflicts
from .eval_candidate_roles_r3c import classify_candidate_role
from .eval_candidate_types import contains_devanagari, project_acceptable_target_surfaces
from .eval_mai07 import load_cases
from .eval_metric_definitions import (
    CANDIDATE_RANKING_SUITE_IDS,
    FROZEN_DATASET_HASH,
    IDENTITY_SUITE_IDS,
)
from .import_mai07r3b_reviews import (
    EXPECTED_COUNTS,
    OFFICIAL_B_COUNTS,
    import_and_validate,
    population_bucket_from_round_a,
)

REPO = Path(__file__).resolve().parents[7]
V1_MANIFEST = REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json"
OUT_DIR = REPO / "evals/mai07"
FROZEN_V2_DIR = OUT_DIR / "frozen_v2"
MANIFESTS_DIR = OUT_DIR / "manifests"
SCHEMA_VERSION = "mai07r3c_dataset_v2_1.0.0"
DATASET_ID = "MAI_07_ROMANIZED_TRANSLITERATION_V2"
CANONICAL_SCORER_VERSION = "mai-07.r3c.canonical.1.0.0"
AUDIT_SCORER_VERSION = "mai-07.r3c.audit.1.0.0"

PRIMARY_POPS = (
    "TRANSLITERATION_REQUIRED",
    "IDENTITY_REQUIRED",
    "TRANSLITERATION_OPTIONAL",
    "NO_TRANSLITERATION_ALLOWED",
    "HUMAN_REVIEW_REQUIRED",
    "LEGACY_V1_INFORMATIONAL",
)

# Locked before observing V2 runtime (section 8).
THRESHOLD_MANIFEST = {
    "schema_version": "1.0.0",
    "threshold_id": "MAI_07_R3C_THRESHOLDS_V1",
    "locked_before_runtime_observation": True,
    "scorer_versions": {
        "canonical": CANONICAL_SCORER_VERSION,
        "audit": AUDIT_SCORER_VERSION,
    },
    "gates": {
        "target_candidate_top1_accuracy": {"op": ">=", "value": 0.88},
        "target_candidate_recall_at_5": {"op": ">=", "value": 0.95},
        "target_candidate_mrr": {"op": ">=", "value": 0.90},
        "core_target_recall_at_5": {"op": ">=", "value": 0.98},
        "unambiguous_target_top1": {"op": ">=", "value": 0.92},
        "english_identity_top1": {"op": ">=", "value": 0.98},
        "false_devanagari_on_english": {"op": "<=", "value": 0.02},
        "protected_mutations": {"op": "==", "value": 0},
        "raw_view_mutations": {"op": "==", "value": 0},
        "deterministic_output_rate": {"op": "==", "value": 1.0},
        "candidate_caps_respected": {"op": "==", "value": 1.0},
    },
    "contextual_lift": {
        "status": "NOT_APPLICABLE_IF_CONTEXT_POPULATION_INVALID",
        "min_lift": 0.05,
        "min_n": 60,
    },
}


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha_file(path: Path) -> str:
    return _sha_bytes(path.read_bytes())


def _canonical_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _round_a_primary_population(policy: str) -> str:
    if policy == "NO_TRANSLITERATION_ALLOWED":
        return "NO_TRANSLITERATION_ALLOWED"
    if policy == "DEVANAGARI_TARGET_REQUIRED":
        return "TRANSLITERATION_REQUIRED"
    if policy == "LATIN_IDENTITY_REQUIRED":
        return "IDENTITY_REQUIRED"
    if policy == "LATIN_IDENTITY_PREFERRED_TARGET_OPTIONAL":
        return "TRANSLITERATION_OPTIONAL"
    if policy in {"BOTH_EQUAL_REVIEW_REQUIRED", "CANNOT_DECIDE"}:
        return "HUMAN_REVIEW_REQUIRED"
    return population_bucket_from_round_a(policy)


def _legacy_unreviewed_population(case: dict[str, Any]) -> tuple[str, list[str], str | None]:
    """Assign primary pop + legacy targets for non-reviewed V1 cases."""
    suite = case.get("suite_id") or ""
    targets = project_acceptable_target_surfaces(
        input_text=case["input_text"],
        acceptable_candidates=case.get("acceptable_candidates") or [],
        preferred_candidate=case.get("preferred_candidate"),
    )
    if case.get("abstention_expected"):
        return "HUMAN_REVIEW_REQUIRED", [], "LEGACY_ABSTENTION_NOT_AUTO_GATED"
    if suite in IDENTITY_SUITE_IDS or (
        case.get("identity_expected") and not targets and suite not in CANDIDATE_RANKING_SUITE_IDS
    ):
        return "IDENTITY_REQUIRED", [], None
    if suite == "context_challenge_v1" or case.get("context_challenge"):
        return "LEGACY_V1_INFORMATIONAL", targets, "CONTEXT_CHALLENGE_INFORMATIONAL"
    if targets and suite in CANDIDATE_RANKING_SUITE_IDS:
        return "TRANSLITERATION_REQUIRED", targets, None
    if targets:
        return "LEGACY_V1_INFORMATIONAL", targets, "TARGETS_PRESENT_BUT_NOT_AUTO_GATED"
    return "LEGACY_V1_INFORMATIONAL", [], "NO_NONVACUOUS_TARGET_EVIDENCE"


def _reviewed_acceptable_targets(
    *,
    source: str,
    candidates: list[dict[str, Any]],
) -> tuple[list[str], list[str], list[str]]:
    """Return (preferred_dev_targets, alternative_dev_targets, diagnostic_surfaces)."""
    preferred: list[str] = []
    alternative: list[str] = []
    diagnostic: list[str] = []
    seen: set[str] = set()
    for c in candidates:
        surface = c["surface"]
        role = classify_candidate_role(surface, source)
        lab = c["acceptability"]
        if lab == "CANNOT_DECIDE":
            continue
        if lab == "INCORRECT":
            continue
        if lab == "UNNATURAL_BUT_POSSIBLE":
            diagnostic.append(surface)
            continue
        if role != "DEVANAGARI_TARGET":
            continue
        if surface in seen:
            continue
        seen.add(surface)
        if lab == "ACCEPTABLE_PREFERRED":
            preferred.append(surface)
        elif lab == "ACCEPTABLE_ALTERNATIVE":
            alternative.append(surface)
    return preferred, alternative, diagnostic


def build_v2_cases(repo: Path = REPO) -> dict[str, Any]:
    """Build in-memory V2 cases + reconciliation report (no IO)."""
    r3b = import_and_validate(repo)
    if not r3b.ok:
        raise RuntimeError(f"R3B import failed: {r3b.errors}")

    v1_cases = load_cases(V1_MANIFEST, repo)
    if len(v1_cases) != 696:
        raise RuntimeError(f"V1 case count {len(v1_cases)} != 696")

    conflicts, tax = recompute_conflicts(repo)
    conflict_ids = {c.case_id for c in conflicts}
    if len(conflict_ids) != 49 or not tax.get("matches_expected"):
        raise RuntimeError(f"conflict recompute failed: {len(conflict_ids)} tax={tax}")

    adj_by_case = {c.case_id: c for c in r3b.adjudicated_cases}
    if len(adj_by_case) != 149:
        raise RuntimeError(f"reviewed count {len(adj_by_case)} != 149")
    missing_conflicts = sorted(conflict_ids - set(adj_by_case))
    if missing_conflicts:
        raise RuntimeError(
            f"conflict cases lack R3B adjudication: {missing_conflicts[:10]}"
        )

    # Official Round B surfaces for reviewed candidates
    review_root = repo / "docs/mokxya-ai/reviews/mai07r3"
    surfaces: dict[tuple[str, int], str] = {}
    with (review_root / "MAI_07R3_ROUND_B_OFFICIAL_RESPONSES_LOCKED.csv").open(
        encoding="utf-8-sig", newline=""
    ) as fh:
        for row in csv.DictReader(fh):
            surfaces[(row["review_id"], int(row["candidate_index"]))] = row[
                "candidate_surface"
            ]

    multi_pref = 0
    unique_pref = 0
    cannot_decide_cases = 0
    b_label_counts: Counter[str] = Counter()
    pop_counts: Counter[str] = Counter()
    v2_cases: list[dict[str, Any]] = []

    for v1 in sorted(v1_cases, key=lambda c: c["case_id"]):
        cid = v1["case_id"]
        source = v1["input_text"]
        adj = adj_by_case.get(cid)
        typed_cands: list[dict[str, Any]] = []
        if adj is None:
            review_status = "LEGACY_V1_UNREVIEWED"
            round_a = None
            round_b = None
            primary_pop, legacy_targets, exclusion = _legacy_unreviewed_population(v1)
            preferred_targets: list[str] = []
            alt_targets: list[str] = []
            acceptable = list(legacy_targets)
            unique_elig = False
            unique_idx = None
            ambiguity = "UNREVIEWED_LEGACY"
            identity_required = primary_pop in {
                "IDENTITY_REQUIRED",
                "NO_TRANSLITERATION_ALLOWED",
            }
            optional_target = primary_pop == "TRANSLITERATION_OPTIONAL"
            human_review = primary_pop == "HUMAN_REVIEW_REQUIRED"
            for surf in v1.get("acceptable_candidates") or []:
                typed_cands.append(
                    {
                        "surface": surf,
                        "candidate_role": classify_candidate_role(surf, source),
                        "acceptability": "LEGACY_V1_SURFACE",
                        "acceptability_provenance": "FROZEN_V1",
                    }
                )
            label_provenance = "LEGACY_V1_UNREVIEWED"
        else:
            review_status = "R3B_REVIEWED"
            exclusion = None
            label_provenance = "R3B_ROUND_A_POLICY_PLUS_OFFICIAL_ROUND_B_EVIDENCE"
            round_a = {
                "span_class": adj.round_a.span_class,
                "preferred_rank_policy": adj.round_a.preferred_rank_policy,
                "devanagari_retention": adj.round_a.devanagari_retention,
                "confidence": adj.round_a.confidence,
            }
            primary_pop = _round_a_primary_population(adj.round_a.preferred_rank_policy)
            identity_required = primary_pop in {
                "IDENTITY_REQUIRED",
                "NO_TRANSLITERATION_ALLOWED",
            }
            optional_target = primary_pop == "TRANSLITERATION_OPTIONAL"
            human_review = primary_pop == "HUMAN_REVIEW_REQUIRED"
            rb_rows = []
            for c in adj.candidates:
                surface = surfaces.get((adj.review_id, c.presentation_candidate_index))
                if surface is None:
                    raise RuntimeError(
                        f"missing Round B surface {adj.review_id}#{c.presentation_candidate_index}"
                    )
                role = classify_candidate_role(surface, source)
                b_label_counts[c.acceptability] += 1
                rb_rows.append(
                    {
                        "presentation_candidate_index": c.presentation_candidate_index,
                        "source_candidate_index": c.source_candidate_index,
                        "surface": surface,
                        "candidate_role": role,
                        "acceptability": c.acceptability,
                        "acceptability_provenance": "EXPLICIT_USER_AUTHORIZED_BULK_SCHEMA_MAPPING",
                    }
                )
                typed_cands.append(rb_rows[-1])
            round_b = rb_rows
            preferred_targets, alt_targets, _diag = _reviewed_acceptable_targets(
                source=source, candidates=rb_rows
            )
            if primary_pop == "TRANSLITERATION_REQUIRED":
                acceptable = preferred_targets + [
                    t for t in alt_targets if t not in preferred_targets
                ]
            elif primary_pop == "TRANSLITERATION_OPTIONAL":
                # Optional Devanagari must not enter required-target denominator.
                acceptable = []
                exclusion = exclusion or "OPTIONAL_DEVANAGARI_EXCLUDED_FROM_REQUIRED_TARGET"
            else:
                acceptable = []
            if "MULTIPLE_BULK_MAPPED_PREFERRED_CANDIDATES" in adj.issues:
                multi_pref += 1
            if adj.unique_top1_gold_eligible:
                unique_pref += 1
            if any(c.acceptability == "CANNOT_DECIDE" for c in adj.candidates) or (
                adj.round_a.preferred_rank_policy == "CANNOT_DECIDE"
            ):
                cannot_decide_cases += 1
            unique_elig = bool(adj.unique_top1_gold_eligible)
            unique_idx = adj.unique_top1_source_candidate_index
            ambiguity = adj.ambiguity_reason

        pop_counts[primary_pop] += 1
        v2 = {
            "schema_version": SCHEMA_VERSION,
            "case_id": f"v2::{cid}",
            "parent_v1_case_id": cid,
            "parent_v1_dataset_hash": FROZEN_DATASET_HASH,
            "suite_id": v1["suite_id"],
            "input_text": source,
            "label_evidence_provenance": label_provenance,
            "review_status": review_status,
            "round_a_policy": round_a,
            "round_b_evidence": round_b,
            "typed_candidates": typed_cands,
            "primary_population": primary_pop,
            "acceptable_target_set": acceptable,
            "preferred_devanagari_targets": preferred_targets if adj else [],
            "alternative_devanagari_targets": alt_targets if adj else [],
            "identity_required": identity_required,
            "optional_target_status": optional_target,
            "human_review_required": human_review,
            "unique_reviewed_preference_eligible": unique_elig if adj else False,
            "unique_reviewed_preference_source_index": unique_idx if adj else None,
            "ambiguity_reason": ambiguity,
            "exclusion_reason": exclusion,
            "is_conflict_set_member": cid in conflict_ids,
            "prohibited_for_training": True,
            "frozen_v1_fields": {
                "acceptable_candidates": list(v1.get("acceptable_candidates") or []),
                "preferred_candidate": v1.get("preferred_candidate"),
                "identity_expected": v1.get("identity_expected"),
                "abstention_expected": v1.get("abstention_expected"),
                "context_challenge": v1.get("context_challenge"),
            },
        }
        v2_cases.append(v2)

    if sum(pop_counts.values()) != 696:
        raise RuntimeError(f"population sum {sum(pop_counts.values())} != 696")
    if b_label_counts["ACCEPTABLE_PREFERRED"] != OFFICIAL_B_COUNTS["ACCEPTABLE_PREFERRED"]:
        raise RuntimeError(f"B preferred count drift: {b_label_counts}")
    if b_label_counts["UNNATURAL_BUT_POSSIBLE"] != OFFICIAL_B_COUNTS["UNNATURAL_BUT_POSSIBLE"]:
        raise RuntimeError(f"B unnatural count drift: {b_label_counts}")
    if b_label_counts["CANNOT_DECIDE"] != OFFICIAL_B_COUNTS["CANNOT_DECIDE"]:
        raise RuntimeError(f"B cannot_decide count drift: {b_label_counts}")
    if multi_pref != 93:
        raise RuntimeError(f"multiple preferred cases {multi_pref} != 93")
    if unique_pref != 120:
        raise RuntimeError(f"unique preference cases {unique_pref} != 120")

    return {
        "cases": v2_cases,
        "reconciliation": {
            "v1_total": 696,
            "v2_total": len(v2_cases),
            "reviewed": 149,
            "unreviewed": 696 - 149,
            "conflicts": 49,
            "conflicts_adjudicated": 49,
            "round_b_label_counts": dict(b_label_counts),
            "multiple_preferred_cases": multi_pref,
            "unique_policy_compatible_preference_cases": unique_pref,
            "cannot_decide_cases": cannot_decide_cases,
            "population_counts": dict(pop_counts),
            "expected_round_b": dict(OFFICIAL_B_COUNTS),
            "expected_conflicts": EXPECTED_COUNTS["conflicts"],
        },
    }


def _suite_bucket(suite_id: str) -> str:
    return suite_id


def write_v2_dataset(repo: Path = REPO) -> dict[str, Any]:
    built = build_v2_cases(repo)
    cases = built["cases"]
    FROZEN_V2_DIR.mkdir(parents=True, exist_ok=True)
    MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)

    by_suite: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for c in cases:
        by_suite[c["suite_id"]].append(c)

    file_entries = []
    for suite_id in sorted(by_suite):
        rows = sorted(by_suite[suite_id], key=lambda x: x["case_id"])
        path = FROZEN_V2_DIR / f"{suite_id}.jsonl"
        body = "\n".join(_canonical_json(r) for r in rows) + "\n"
        path.write_text(body, encoding="utf-8", newline="\n")
        file_entries.append(
            {
                "suite_id": suite_id,
                "path": str(path.relative_to(repo)).replace("\\", "/"),
                "case_count": len(rows),
                "sha256": _sha_bytes(body.encode("utf-8")),
            }
        )

    # Dataset hash: suite_id + NUL + first bytes of each suite file (sorted)
    h = hashlib.sha256()
    for f in sorted(file_entries, key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((repo / f["path"]).read_bytes())
    dataset_hash = h.hexdigest()

    pop_counts = built["reconciliation"]["population_counts"]
    target_n = int(pop_counts.get("TRANSLITERATION_REQUIRED", 0))
    core_n = sum(
        1
        for c in cases
        if c["primary_population"] == "TRANSLITERATION_REQUIRED"
        and c["suite_id"]
        in {
            "romanized_core_v1",
            "romanized_common_v1",
            "domain_terms_v1",
            "grapheme_ambiguity_v1",
            "phrase_morph_v1",
        }
    )
    unamb_n = sum(
        1
        for c in cases
        if c["primary_population"] == "TRANSLITERATION_REQUIRED"
        and c["suite_id"]
        in {
            "romanized_core_v1",
            "romanized_common_v1",
            "domain_terms_v1",
            "grapheme_ambiguity_v1",
        }
        and len(c["acceptable_target_set"]) >= 1
        and not c.get("ambiguity_reason") == "MULTIPLE_BULK_MAPPED_PREFERRED_CANDIDATES"
    )

    def ceil_pass(n: int, thr: float) -> int:
        return int(math.ceil(n * thr)) if n else 0

    population_manifest = {
        "schema_version": "1.0.0",
        "population_manifest_id": "MAI_07_R3C_POPULATIONS_V2",
        "dataset_id": DATASET_ID,
        "dataset_hash": dataset_hash,
        "primary_populations": list(PRIMARY_POPS),
        "disjointness": "each case has exactly one primary_population",
        "total_cases": len(cases),
        "counts": pop_counts,
        "reconciliation_sum": sum(pop_counts.values()),
        "populations": {
            "TRANSLITERATION_REQUIRED": {
                "inclusion": (
                    "reviewed DEVANAGARI_TARGET_REQUIRED OR legacy unreviewed ranking "
                    "suite with non-vacuous projected Devanagari targets"
                ),
                "exclusion": "identity/optional/human-review/informational/no-xlit pops",
                "numerator_definition": "target metric hits among produced candidates",
                "denominator_definition": "cases in this population with scoreable target set "
                "(required reviewed set or legacy projected set)",
                "case_count": target_n,
                "thresholds": {
                    "target_top1": 0.88,
                    "integer_pass_top1": ceil_pass(target_n, 0.88),
                    "target_recall_at_5": 0.95,
                    "integer_pass_recall5": ceil_pass(target_n, 0.95),
                    "target_mrr": 0.90,
                },
                "provenance_required": True,
            },
            "IDENTITY_REQUIRED": {
                "inclusion": "Round A LATIN_IDENTITY_REQUIRED or legacy identity suites",
                "exclusion": "target-required / optional / human-review / informational",
                "case_count": pop_counts.get("IDENTITY_REQUIRED", 0),
                "thresholds": {"english_identity_top1": 0.98},
            },
            "TRANSLITERATION_OPTIONAL": {
                "inclusion": "Round A LATIN_IDENTITY_PREFERRED_TARGET_OPTIONAL",
                "exclusion": "required-target denominator",
                "case_count": pop_counts.get("TRANSLITERATION_OPTIONAL", 0),
                "note": "optional Devanagari excluded from required-target gates",
            },
            "NO_TRANSLITERATION_ALLOWED": {
                "inclusion": "Round A NO_TRANSLITERATION_ALLOWED",
                "case_count": pop_counts.get("NO_TRANSLITERATION_ALLOWED", 0),
            },
            "HUMAN_REVIEW_REQUIRED": {
                "inclusion": "Round A BOTH_EQUAL/CANNOT_DECIDE or legacy abstention",
                "case_count": pop_counts.get("HUMAN_REVIEW_REQUIRED", 0),
                "auto_quality_pass": False,
            },
            "LEGACY_V1_INFORMATIONAL": {
                "inclusion": "unreviewed cases without non-vacuous auto-gate evidence",
                "case_count": pop_counts.get("LEGACY_V1_INFORMATIONAL", 0),
                "auto_quality_pass": False,
            },
        },
        "core_target_denominator": core_n,
        "unambiguous_target_denominator": unamb_n,
    }

    thresh_body = _canonical_json(THRESHOLD_MANIFEST) + "\n"
    thresh_path = MANIFESTS_DIR / "MAI_07_R3C_THRESHOLDS_V1.manifest.json"
    thresh_path.write_text(thresh_body, encoding="utf-8", newline="\n")
    thresh_hash = _sha_bytes(thresh_body.encode("utf-8"))

    pop_body = _canonical_json(population_manifest) + "\n"
    pop_path = MANIFESTS_DIR / "MAI_07_R3C_POPULATIONS_V2.manifest.json"
    pop_path.write_text(pop_body, encoding="utf-8", newline="\n")
    pop_hash = _sha_bytes(pop_body.encode("utf-8"))

    dataset_manifest = {
        "schema_version": "1.0.0",
        "dataset_id": DATASET_ID,
        "dataset_hash": dataset_hash,
        "parent_dataset_id": "MAI_07_ROMANIZED_TRANSLITERATION_V1",
        "parent_dataset_hash": FROZEN_DATASET_HASH,
        "total_cases": len(cases),
        "files": file_entries,
        "prohibited_for_training": True,
        "product_policy": "OPTION_A_CONSERVATIVE_IDENTITY_POLICY",
        "builder": "build_mai07r3c_dataset_v2.py",
        "canonical_scorer_version": CANONICAL_SCORER_VERSION,
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "population_manifest_sha256": pop_hash,
        "threshold_manifest_sha256": thresh_hash,
        "reconciliation": built["reconciliation"],
    }
    ds_body = _canonical_json(dataset_manifest) + "\n"
    ds_path = MANIFESTS_DIR / "MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json"
    ds_path.write_text(ds_body, encoding="utf-8", newline="\n")
    ds_manifest_hash = _sha_bytes(ds_body.encode("utf-8"))

    recon_path = OUT_DIR / "baselines" / "MAI_07R3C_DATASET_RECONCILIATION.json"
    recon_path.parent.mkdir(parents=True, exist_ok=True)
    recon_path.write_text(
        _canonical_json(
            {
                "dataset_hash": dataset_hash,
                "dataset_manifest_sha256": ds_manifest_hash,
                "population_manifest_sha256": pop_hash,
                "threshold_manifest_sha256": thresh_hash,
                **built["reconciliation"],
            }
        )
        + "\n",
        encoding="utf-8",
        newline="\n",
    )

    return {
        "ok": True,
        "dataset_hash": dataset_hash,
        "dataset_manifest_path": str(ds_path.relative_to(repo)).replace("\\", "/"),
        "dataset_manifest_sha256": ds_manifest_hash,
        "population_manifest_sha256": pop_hash,
        "threshold_manifest_sha256": thresh_hash,
        "reconciliation": built["reconciliation"],
        "file_count": len(file_entries),
    }


def build_twice_and_verify(repo: Path = REPO) -> dict[str, Any]:
    a = write_v2_dataset(repo)
    b = write_v2_dataset(repo)
    if a["dataset_hash"] != b["dataset_hash"]:
        raise RuntimeError("non-deterministic dataset hash")
    if a["dataset_manifest_sha256"] != b["dataset_manifest_sha256"]:
        raise RuntimeError("non-deterministic dataset manifest hash")
    return a


def main() -> int:
    report = build_twice_and_verify(REPO)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
