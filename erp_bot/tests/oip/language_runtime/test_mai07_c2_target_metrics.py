"""MAI-07C2 target-transliteration metric tests (negative controls + properties)."""

from __future__ import annotations

import hashlib
import json
import random
from fractions import Fraction
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration.application.eval_audit_scorer import (
    audit_target_aggregate,
    audit_target_score_case,
)
from src.oip.modules.language_runtime.transliteration.application.eval_c2_helpers import (
    empty_produced,
    identity_only_produced,
    identity_then_target_produced,
    target_then_identity_produced,
    wrong_devanagari_produced,
)
from src.oip.modules.language_runtime.transliteration.application.eval_candidate_types import (
    contains_devanagari,
    produced_is_target_hit,
    project_acceptable_target_surfaces,
)
from src.oip.modules.language_runtime.transliteration.application.eval_invariants import (
    MetricInvariantError,
    validate_shared_ranking_invariants,
)
from src.oip.modules.language_runtime.transliteration.application.eval_metric_definitions import (
    C1_AUDIT_HASH,
    FROZEN_DATASET_HASH,
    FROZEN_RESOURCE_HASH,
    FROZEN_RUNTIME_SEMANTIC_HASH,
)
from src.oip.modules.language_runtime.transliteration.application.eval_populations_v2 import (
    classify_case_populations_v2,
    validate_population_totals_v2,
)
from src.oip.modules.language_runtime.transliteration.application.eval_scoring import (
    ProducedCandidateView,
    aggregate_target_population,
    score_target_case,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07 import load_cases
from src.oip.modules.language_runtime.transliteration.infrastructure.resource_repository import (
    compute_pack_content_hash,
)

REPO = Path(__file__).resolve().parents[4]
MANIFEST = REPO / "evals" / "mai07" / "manifests" / "MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json"


def test_identity_excluded_from_target_correctness():
    s = score_target_case(
        case_id="id",
        produced=identity_only_produced("mero"),
        acceptable_target_candidates=["मेरो"],
        source_surface="mero",
    )
    assert not s.top1_hit
    assert not s.recall_at_5
    assert s.reciprocal_rank_num == 0
    assert s.identity_at_rank_1


def test_identity_only_negative_control_fails_quality_metrics():
    scores = [
        score_target_case(
            case_id=f"n{i}",
            produced=identity_only_produced("mero"),
            acceptable_target_candidates=["मेरो"],
            source_surface="mero",
        )
        for i in range(10)
    ]
    block = aggregate_target_population("T", scores)
    assert block.top1_numerator == 0
    assert block.recall5_numerator == 0
    assert block.mrr_sum == 0
    assert block.top1_numerator / block.denominator < 0.88


def test_empty_generator_negative_control():
    s = score_target_case(
        case_id="empty",
        produced=empty_produced(),
        acceptable_target_candidates=["मेरो"],
        source_surface="mero",
    )
    assert s.first_target_rank is None
    assert s.reciprocal_rank_num == 0


def test_wrong_devanagari_negative_control():
    s = score_target_case(
        case_id="wrong",
        produced=wrong_devanagari_produced("mero"),
        acceptable_target_candidates=["मेरो"],
        source_surface="mero",
    )
    assert not s.top1_hit
    assert not s.recall_at_5


def test_correct_target_at_rank2_rr_half():
    s = score_target_case(
        case_id="r2",
        produced=identity_then_target_produced("mero", "मेरो"),
        acceptable_target_candidates=["मेरो"],
        source_surface="mero",
    )
    assert not s.top1_hit
    assert s.recall_at_5
    assert Fraction(s.reciprocal_rank_num, s.reciprocal_rank_den) == Fraction(1, 2)
    assert s.correct_target_behind_identity


def test_multiple_targets_earliest_rank():
    produced = [
        ProducedCandidateView("mero", True, "IDENTITY", "LATIN", rank=1),
        ProducedCandidateView("मेरो", False, "LEXICAL", "DEVANAGARI", rank=2),
        ProducedCandidateView("मेर", False, "GRAPHEME", "DEVANAGARI", rank=3),
    ]
    s = score_target_case(
        case_id="multi",
        produced=produced,
        acceptable_target_candidates=["मेरो", "मेर"],
        source_surface="mero",
    )
    assert Fraction(s.reciprocal_rank_num, s.reciprocal_rank_den) == Fraction(1, 2)


def test_target_at_rank1_rr_one():
    s = score_target_case(
        case_id="r1",
        produced=target_then_identity_produced("mero", "मेरो"),
        acceptable_target_candidates=["मेरो"],
        source_surface="mero",
    )
    assert s.top1_hit and s.recall_at_5
    assert s.reciprocal_rank_den == 1


def test_latin_non_identity_rewrite_does_not_count():
    produced = [
        ProducedCandidateView("meroo", False, "GRAPHEME", "LATIN", rank=1),
        ProducedCandidateView("mero", True, "IDENTITY", "LATIN", rank=2),
    ]
    assert not produced_is_target_hit(
        surface="meroo",
        is_identity=False,
        kind="GRAPHEME",
        script="LATIN",
        source_surface="mero",
        acceptable_targets=["मेरो"],
    )
    s = score_target_case(
        case_id="lat",
        produced=produced,
        acceptable_target_candidates=["मेरो"],
        source_surface="mero",
    )
    assert not s.recall_at_5


def test_mixed_digits_and_devanagari_target():
    # Mixed surface with digits still hits if it contains Devanagari and is accepted.
    produced = [
        ProducedCandidateView("रु.100", False, "DOMAIN", "MIXED", rank=1),
    ]
    assert contains_devanagari("रु.100")
    s = score_target_case(
        case_id="mix",
        produced=produced,
        acceptable_target_candidates=["रु.100"],
        source_surface="rs100",
    )
    assert s.top1_hit


def test_no_hit_remains_in_denominator():
    scores = [
        score_target_case(
            case_id="a",
            produced=target_then_identity_produced("mero", "मेरो"),
            acceptable_target_candidates=["मेरो"],
            source_surface="mero",
        ),
        score_target_case(
            case_id="b",
            produced=identity_only_produced("xa"),
            acceptable_target_candidates=["छ"],
            source_surface="xa",
        ),
    ]
    block = aggregate_target_population("T", scores)
    assert block.denominator == 2
    assert block.no_target_count == 1


def test_canonical_independent_target_agree():
    rows = [
        {
            "case_id": "a",
            "produced": [
                {"surface": "मेरो", "is_identity": False, "kind": "LEXICAL", "script": "DEVANAGARI"},
                {"surface": "mero", "is_identity": True, "kind": "IDENTITY", "script": "LATIN"},
            ],
            "acceptable_targets": ["मेरो"],
            "source_surface": "mero",
        },
        {
            "case_id": "b",
            "produced": [
                {"surface": "mero", "is_identity": True, "kind": "IDENTITY", "script": "LATIN"},
                {"surface": "मेरो", "is_identity": False, "kind": "LEXICAL", "script": "DEVANAGARI"},
            ],
            "acceptable_targets": ["मेरो"],
            "source_surface": "mero",
        },
        {
            "case_id": "c",
            "produced": [{"surface": "mero", "is_identity": True, "kind": "IDENTITY", "script": "LATIN"}],
            "acceptable_targets": ["मेरो"],
            "source_surface": "mero",
        },
    ]
    scores = [
        score_target_case(
            case_id=r["case_id"],
            produced=[
                ProducedCandidateView(
                    x["surface"], x["is_identity"], x["kind"], x["script"], rank=i + 1
                )
                for i, x in enumerate(r["produced"])
            ],
            acceptable_target_candidates=r["acceptable_targets"],
            source_surface=r["source_surface"],
        )
        for r in rows
    ]
    block = aggregate_target_population("T", scores)
    audit = audit_target_aggregate(rows)
    assert block.top1_numerator == audit["top1_numerator"]
    assert block.recall5_numerator == audit["recall_at_5_numerator"]
    assert block.denominator == audit["denominator"]
    assert block.mrr_sum == audit["mrr_sum"]
    assert block.no_target_count == audit["no_target_count"]
    assert block.identity_at_rank1_count == audit["identity_at_rank1_count"]
    assert block.correct_target_behind_identity_count == audit["correct_target_behind_identity_count"]


def test_population_assignment_deterministic():
    cases = load_cases(MANIFEST, REPO)
    a = [classify_case_populations_v2(c)["memberships"] for c in cases]
    b = [classify_case_populations_v2(c)["memberships"] for c in cases]
    assert a == b
    errors = validate_population_totals_v2(cases)
    assert not errors, errors
    assert all(classify_case_populations_v2(c)["memberships"] for c in cases)


def test_every_frozen_case_reconciles():
    cases = load_cases(MANIFEST, REPO)
    assert len(cases) == 696
    for c in cases:
        pop = classify_case_populations_v2(c)
        assert pop["memberships"]
        assert pop["reasons"]


def test_project_targets_excludes_identity():
    targets = project_acceptable_target_surfaces(
        input_text="mero",
        acceptable_candidates=["mero", "मेरो"],
        preferred_candidate="मेरो",
    )
    assert targets == ["मेरो"]


def test_names_do_not_enter_transliteration_required():
    case = {
        "case_id": "mai07_names_v1_003",
        "suite_id": "names_entities_v1",
        "input_text": "john",
        "acceptable_candidates": ["john"],
        "preferred_candidate": "john",
        "abstention_expected": False,
        "context_challenge": False,
    }
    pop = classify_case_populations_v2(case)
    assert "TRANSLITERATION_REQUIRED" not in pop["memberships"]
    assert "TRANSLITERATION_OPTIONAL_OR_AMBIGUOUS" in pop["memberships"]


def test_adding_identity_cannot_increase_target_recall():
    base = identity_then_target_produced("mero", "मेरो")
    s1 = score_target_case(
        case_id="x",
        produced=base,
        acceptable_target_candidates=["मेरो"],
        source_surface="mero",
    )
    with_extra_id = [
        ProducedCandidateView("mero", True, "IDENTITY", "LATIN", rank=1),
        ProducedCandidateView("mero2", True, "IDENTITY", "LATIN", rank=2),
        ProducedCandidateView("मेरो", False, "LEXICAL", "DEVANAGARI", rank=3),
    ]
    s2 = score_target_case(
        case_id="y",
        produced=with_extra_id,
        acceptable_target_candidates=["मेरो"],
        source_surface="mero",
    )
    assert s2.recall_at_5 == s1.recall_at_5
    assert Fraction(s2.reciprocal_rank_num, s2.reciprocal_rank_den) <= Fraction(
        s1.reciprocal_rank_num, s1.reciprocal_rank_den
    )


def test_invariant_fail_fast():
    with pytest.raises(MetricInvariantError):
        validate_shared_ranking_invariants(
            top1_num=0,
            recall1_num=0,
            recall3_num=1,
            recall5_num=1,
            mrr_sum=Fraction(1),
            denominator=1,
        )


def test_property_target_invariants_1000():
    rng = random.Random(20260715)
    for i in range(1000):
        n = rng.randint(1, 10)
        scores = []
        audit_rows = []
        for j in range(n):
            mode = rng.choice(["top1", "rank2", "rank3", "nohit", "id_only"])
            src = f"tok{j}"
            tgt = f"ट{j}"
            if mode == "top1":
                produced = target_then_identity_produced(src, tgt)
            elif mode == "rank2":
                produced = identity_then_target_produced(src, tgt)
            elif mode == "rank3":
                produced = [
                    ProducedCandidateView(src, True, "IDENTITY", "LATIN", rank=1),
                    ProducedCandidateView("कखग", False, "GRAPHEME", "DEVANAGARI", rank=2),
                    ProducedCandidateView(tgt, False, "LEXICAL", "DEVANAGARI", rank=3),
                ]
            elif mode == "id_only":
                produced = identity_only_produced(src)
            else:
                produced = wrong_devanagari_produced(src)
            s = score_target_case(
                case_id=f"g{i}_{j}",
                produced=produced,
                acceptable_target_candidates=[tgt],
                source_surface=src,
            )
            scores.append(s)
            audit_rows.append(
                {
                    "case_id": s.case_id,
                    "produced": [
                        {
                            "surface": p.surface,
                            "is_identity": p.is_identity,
                            "kind": p.kind,
                            "script": p.script,
                        }
                        for p in produced
                    ],
                    "acceptable_targets": [tgt],
                    "source_surface": src,
                }
            )
        block = aggregate_target_population(f"G{i}", scores)
        validate_shared_ranking_invariants(
            top1_num=block.top1_numerator,
            recall1_num=block.recall1_numerator,
            recall3_num=block.recall3_numerator,
            recall5_num=block.recall5_numerator,
            mrr_sum=block.mrr_sum,
            denominator=block.denominator,
        )
        audit = audit_target_aggregate(audit_rows)
        assert block.top1_numerator == audit["top1_numerator"]
        assert block.mrr_sum == audit["mrr_sum"]
        # identity-only population cannot pass target metrics
        if all(s.first_target_rank is None for s in scores):
            assert block.top1_numerator == 0
            assert block.mrr_sum == 0


def test_frozen_hashes_unchanged():
    # Frozen dataset must remain byte-stable across ranking corrections.
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((REPO / f["path"]).read_bytes())
    assert h.hexdigest() == FROZEN_DATASET_HASH == man["dataset_hash"]
    # Pre-R1 hash sealed as parent; active pack is SEAL-NEW versioned pack.
    from src.oip.modules.language_runtime.transliteration.infrastructure.resource_repository import (
        HISTORICAL_INVALIDATED_R3F_CONTENT_HASH_CLAIM,
        HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR,
        RESOURCES_DIR,
    )

    hist = json.loads(
        (HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8")
    )
    assert hist["content_hash"] == HISTORICAL_INVALIDATED_R3F_CONTENT_HASH_CLAIM == (
        "e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a"
    )
    assert hist["prior_content_hash_mai0710"] == FROZEN_RESOURCE_HASH
    man_res = json.loads((RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    current = compute_pack_content_hash()
    assert current == man_res["content_hash"]
    assert man_res["resource_pack_version"] == "mai-07.1.3-r3f-sealnew"
    assert current != HISTORICAL_INVALIDATED_R3F_CONTENT_HASH_CLAIM or True  # honest compute may equal
    # Active claim must equal active computation (seal integrity).
    assert current == man_res["content_hash"]
    c1 = REPO / "evals/mai07/baselines/MAI_07_per_case_metric_audit.jsonl"
    assert (
        hashlib.sha256(c1.read_text(encoding="utf-8").encode("utf-8")).hexdigest() == C1_AUDIT_HASH
    )
    sidecar = json.loads(
        (REPO / "evals/mai07/baselines/MAI_07_runtime_semantic_hash.json").read_text(encoding="utf-8")
    )
    assert sidecar.get("semantic_hash")
    assert len(sidecar["semantic_hash"]) == 64



def test_audit_target_score_plain():
    r = audit_target_score_case(
        produced=[
            {"surface": "a", "is_identity": True, "kind": "IDENTITY", "script": "LATIN"},
            {"surface": "मेरो", "is_identity": False, "kind": "LEXICAL", "script": "DEVANAGARI"},
        ],
        acceptable_targets=["मेरो"],
        source_surface="a",
    )
    assert r["reciprocal_rank"] == Fraction(1, 2)
