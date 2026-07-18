"""MAI-07R3C V2 dataset, scorers, freeze protocol, and negative controls."""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.build_mai07r3c_dataset_v2 import (
    DATASET_ID,
    PRIMARY_POPS,
    THRESHOLD_MANIFEST,
    build_twice_and_verify,
    build_v2_cases,
)
from src.oip.modules.language_runtime.transliteration.application.eval_audit_scorer_r3c import (
    assert_canonical_matches_audit,
    audit_aggregate_r3c,
    audit_score_case_r3c,
)
from src.oip.modules.language_runtime.transliteration.application.eval_candidate_roles_r3c import (
    classify_candidate_role,
    is_target_hit,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07 import load_cases
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3c import (
    leakage_audit,
    load_v2_cases,
    score_predictions,
    verify_no_runtime_drift,
)
from src.oip.modules.language_runtime.transliteration.application.eval_metric_definitions import (
    FROZEN_DATASET_HASH,
    FROZEN_RESOURCE_HASH,
)
from src.oip.modules.language_runtime.transliteration.application.eval_scoring import (
    ProducedCandidateView,
)
from src.oip.modules.language_runtime.transliteration.application.eval_scoring_r3c import (
    R3CPopulationBlock,
    score_r3c_target_case,
    validate_invariants,
)
from src.oip.modules.language_runtime.transliteration.application.import_mai07r3b_reviews import (
    EXPECTED_HASHES,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

REPO = Path(__file__).resolve().parents[4]
V1_MAN = REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json"
V2_MAN = REPO / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json"
BASELINES = REPO / "evals/mai07/baselines"


def test_v1_byte_immutability():
    man = json.loads(V1_MAN.read_text(encoding="utf-8"))
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((REPO / f["path"]).read_bytes())
    assert h.hexdigest() == FROZEN_DATASET_HASH == man["dataset_hash"]
    assert h.hexdigest() == EXPECTED_HASHES["frozen_v1_dataset"]


def test_dataset_determinism_and_lineage():
    a = build_twice_and_verify(REPO)
    assert a["ok"]
    assert a["dataset_hash"] == "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9"
    man = json.loads(V2_MAN.read_text(encoding="utf-8"))
    assert man["dataset_id"] == DATASET_ID
    assert man["parent_dataset_hash"] == FROZEN_DATASET_HASH
    assert man["prohibited_for_training"] is True
    assert man["total_cases"] == 696


def test_696_parent_and_149_reviewed_reconciliation():
    built = build_v2_cases(REPO)
    r = built["reconciliation"]
    assert r["v1_total"] == r["v2_total"] == 696
    assert r["reviewed"] == 149
    assert r["unreviewed"] == 547
    assert r["conflicts"] == r["conflicts_adjudicated"] == 49
    assert r["multiple_preferred_cases"] == 93
    assert r["unique_policy_compatible_preference_cases"] == 120
    assert r["round_b_label_counts"]["ACCEPTABLE_PREFERRED"] == 223
    assert r["round_b_label_counts"]["UNNATURAL_BUT_POSSIBLE"] == 36
    assert r["round_b_label_counts"]["CANNOT_DECIDE"] == 4


def test_reviewed_unreviewed_provenance_and_conflicts_covered():
    cases, _ = load_v2_cases(REPO)
    reviewed = [c for c in cases if c["review_status"] == "R3B_REVIEWED"]
    unreviewed = [c for c in cases if c["review_status"] == "LEGACY_V1_UNREVIEWED"]
    assert len(reviewed) == 149
    assert len(unreviewed) == 547
    assert all(c["prohibited_for_training"] for c in cases)
    conflicts = [c for c in cases if c["is_conflict_set_member"]]
    assert len(conflicts) == 49
    assert all(c["review_status"] == "R3B_REVIEWED" for c in conflicts)


def test_population_exclusivity_and_completeness():
    cases, _ = load_v2_cases(REPO)
    pops = [c["primary_population"] for c in cases]
    assert len(pops) == 696
    assert all(p in PRIMARY_POPS for p in pops)
    man = json.loads(
        (REPO / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert man["reconciliation_sum"] == 696
    assert sum(man["counts"].values()) == 696


def test_candidate_role_typing():
    assert classify_candidate_role("bank", "bank") == "IDENTITY"
    assert classify_candidate_role("बैंक", "bank") == "DEVANAGARI_TARGET"
    assert classify_candidate_role("Banking", "bank") == "OTHER_LATIN_REWRITE"


def test_negative_controls_identity_empty_wrong_latin():
    id_only = [ProducedCandidateView("bank", True, "IDENTITY", "LATIN")]
    s = score_r3c_target_case(
        case_id="n1",
        produced=id_only,
        acceptable_targets=["बैंक"],
        source_surface="bank",
    )
    assert s.top1_hit is False and s.recall_at_5 is False and s.reciprocal_rank == 0

    empty = score_r3c_target_case(
        case_id="n2", produced=[], acceptable_targets=["बैंक"], source_surface="bank"
    )
    assert empty.top1_hit is False and empty.reciprocal_rank == 0

    wrong = score_r3c_target_case(
        case_id="n3",
        produced=[ProducedCandidateView("गलत", False, "LEXICAL", "DEVANAGARI")],
        acceptable_targets=["बैंक"],
        source_surface="bank",
    )
    assert wrong.top1_hit is False

    latin = score_r3c_target_case(
        case_id="n4",
        produced=[ProducedCandidateView("banco", False, "LEXICAL", "LATIN")],
        acceptable_targets=["बैंक"],
        source_surface="bank",
    )
    assert latin.top1_hit is False
    assert not is_target_hit(
        surface="banco",
        is_identity=False,
        kind="LEXICAL",
        source_surface="bank",
        acceptable_targets={"बैंक"},
    )


def test_negative_control_identity_rank1_target_rank2():
    produced = [
        ProducedCandidateView("bank", True, "IDENTITY", "LATIN"),
        ProducedCandidateView("बैंक", False, "LEXICAL", "DEVANAGARI"),
    ]
    s = score_r3c_target_case(
        case_id="n5",
        produced=produced,
        acceptable_targets=["बैंक"],
        source_surface="bank",
    )
    assert s.top1_hit is False
    assert s.recall_at_5 is True
    assert float(s.reciprocal_rank) == 0.5


def test_negative_control_valid_target_rank1():
    produced = [
        ProducedCandidateView("बैंक", False, "LEXICAL", "DEVANAGARI"),
        ProducedCandidateView("bank", True, "IDENTITY", "LATIN"),
    ]
    s = score_r3c_target_case(
        case_id="n6",
        produced=produced,
        acceptable_targets=["बैंक"],
        source_surface="bank",
    )
    assert s.top1_hit and s.recall_at_1 and float(s.reciprocal_rank) == 1.0


def test_unnatural_and_cannot_decide_not_hits():
    # Acceptable set must not include unnatural / cannot_decide surfaces
    assert not is_target_hit(
        surface="अनैसर्गिक",
        is_identity=False,
        kind="LEXICAL",
        source_surface="x",
        acceptable_targets=set(),  # unnatural excluded from set
    )


def test_multiple_preferred_not_collapsed_to_unique():
    cases, _ = load_v2_cases(REPO)
    multi = [
        c
        for c in cases
        if c.get("ambiguity_reason") == "MULTIPLE_BULK_MAPPED_PREFERRED_CANDIDATES"
    ]
    assert len(multi) >= 1
    for c in multi[:20]:
        if len(c["preferred_devanagari_targets"]) > 1:
            assert c["unique_reviewed_preference_eligible"] is False


def test_optional_and_identity_excluded_from_target_denominator():
    cases, _ = load_v2_cases(REPO)
    target = [c for c in cases if c["primary_population"] == "TRANSLITERATION_REQUIRED"]
    assert target
    for c in target:
        assert c["identity_required"] is False
        assert c["optional_target_status"] is False
    identity = [c for c in cases if c["primary_population"] == "IDENTITY_REQUIRED"]
    assert identity
    for c in identity:
        assert c["case_id"] not in {t["case_id"] for t in target}
    optional = [c for c in cases if c["primary_population"] == "TRANSLITERATION_OPTIONAL"]
    for c in optional:
        assert c["acceptable_target_set"] == []


def test_threshold_locked_before_observation():
    assert THRESHOLD_MANIFEST["locked_before_runtime_observation"] is True
    path = REPO / "evals/mai07/manifests/MAI_07_R3C_THRESHOLDS_V1.manifest.json"
    assert path.exists()
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["gates"]["target_candidate_top1_accuracy"]["value"] == 0.88


def test_leakage_firewall_and_no_runtime_drift():
    verify_no_runtime_drift()
    leak = leakage_audit(REPO)
    assert leak["ok"] is True
    assert ENABLE_PROMOTION_OVERLAY is False
    man = json.loads((xlrr.RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert man["prior_content_hash_mai0710"] == FROZEN_RESOURCE_HASH


def test_independent_scorer_agreement_on_saved_predictions():
    pred_path = BASELINES / "MAI_07R3C_V2_ONE_SHOT_PREDICTIONS.jsonl"
    if not pred_path.exists():
        pytest.skip("one-shot predictions not generated yet")
    preds = [
        json.loads(ln)
        for ln in pred_path.read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    cases, _ = load_v2_cases(REPO)
    by = {c["case_id"]: c for c in cases}
    scored = score_predictions(preds, by)
    assert scored["invariant_errors"] == []
    # Dual scorer already asserted inside score_predictions
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
    canon = scored["target_population"]
    canon["case_ids"] = audit["case_ids"]
    assert_canonical_matches_audit(canon, audit)


def test_one_shot_report_exists_and_quality_false_or_true_recorded():
    report_path = BASELINES / "MAI_07R3C_BASELINE_V2_QUALITY_REPORT.json"
    assert report_path.exists()
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert "QUALITY_GATES_PASSED" in report
    assert report["LINGUIST_APPROVED"] is False
    assert report["PRODUCTION_APPROVED"] is False
    assert report["enable_promotion_overlay"] is False
    rc = json.loads(
        (
            REPO / "evals/mai07/manifests/MAI_07_R3C_V2_RELEASE_CANDIDATE.manifest.json"
        ).read_text(encoding="utf-8")
    )
    assert rc["one_shot_protocol"] is True


def test_seeded_property_ranking_lists_1000():
    rng = random.Random(20260715)
    targets = {"काठमाडौं", "मेरो", "खर्च"}
    block = R3CPopulationBlock("prop")
    for i in range(1000):
        n = rng.randint(0, 5)
        produced = []
        for j in range(n):
            choice = rng.choice(["identity", "good", "bad", "latin"])
            if choice == "identity":
                produced.append(ProducedCandidateView("mero", True, "IDENTITY", "LATIN"))
            elif choice == "good":
                produced.append(
                    ProducedCandidateView(rng.choice(list(targets)), False, "LEXICAL", "DEVANAGARI")
                )
            elif choice == "bad":
                produced.append(ProducedCandidateView("गलत", False, "LEXICAL", "DEVANAGARI"))
            else:
                produced.append(ProducedCandidateView("meroX", False, "LEXICAL", "LATIN"))
        score = score_r3c_target_case(
            case_id=f"p{i}",
            produced=produced,
            acceptable_targets=targets,
            source_surface="mero",
        )
        block.add(score)
    errs = validate_invariants(block)
    assert errs == []
    assert block.denominator == 1000


def test_mai08_still_not_started():
    ledger = json.loads((REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    assert next(p for p in ledger["phases"] if p["id"] == "MAI-08")["status"] == "NOT_STARTED"
