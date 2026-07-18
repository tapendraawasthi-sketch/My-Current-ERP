from __future__ import annotations

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n5_canonical_scorer import (
    observe_case,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n5_candidate_runtime import (
    CANDIDATE_RUNTIME_VERSION,
    DEFAULT_ACTIVE,
    PARENT_FAILED_R3N4_ATTEMPT,
    PARENT_FAILED_R3N4_VERDICT,
    assert_active_default_immutable,
    candidate_identity_card,
    transliterate_r3n5,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n5_target_span_contract import (
    TargetSpanContractError,
    create_target_span,
    select_bundle_span_by_target,
    target_span_from_case,
)


def _case(raw: str, surface: str, *, case_id: str = "R3N5-SYN-001") -> dict:
    start = raw.index(surface)
    target = create_target_span(raw, raw_start=start, raw_end_exclusive=start + len(surface))
    return {
        "case_id": case_id,
        "input_text": raw,
        "highlighted_span": surface,
        "population_ids": ["IDENTITY_RETENTION_REQUIRED"],
        "expected_behavior": "IDENTITY_RETAINED",
        **target.to_case_fields(),
    }


def test_r3n5_is_new_unpromoted_candidate_with_consumed_failed_parent():
    assert_active_default_immutable()
    card = candidate_identity_card()
    assert CANDIDATE_RUNTIME_VERSION == "mai-07.1.10-r3n5-targetspan"
    assert DEFAULT_ACTIVE is False
    assert PARENT_FAILED_R3N4_ATTEMPT == "MAI_07R3N4_HOLDOUT_ATTEMPT_001"
    assert PARENT_FAILED_R3N4_VERDICT == "FAILED_HOLDOUT_QUALITY"
    assert card["candidate_promoted"] is False
    assert card["correction_scope"] == "TARGET_SPAN_AND_EVALUATION_PATH_AUTHORITY"


def test_target_contract_is_raw_code_point_and_digest_bound():
    raw = "prefix ledger suffix"
    case = _case(raw, "ledger")
    target = target_span_from_case(case)
    assert raw[target.raw_start : target.raw_end_exclusive] == "ledger"
    tampered = dict(case, input_text="prefix Ledger suffix")
    with pytest.raises(TargetSpanContractError):
        target_span_from_case(tampered)


def test_target_contract_rejects_highlight_drift():
    case = _case("prefix ledger suffix", "ledger")
    case["highlighted_span"] = "Ledger"
    with pytest.raises(TargetSpanContractError, match="highlighted_span_not_target_surface"):
        target_span_from_case(case)


@pytest.mark.parametrize("surface", ["ledger", "VAT", "baaki", "SKU-2026/07"])
def test_r3n5_selects_exact_target_offsets_and_retains_identity(surface: str):
    raw = f"prefix {surface} suffix"
    case = _case(raw, surface, case_id=f"R3N5-SYN-{surface}")
    bundle = transliterate_r3n5(raw)
    target = target_span_from_case(case)
    span = select_bundle_span_by_target(bundle, target)
    assert bundle.runtime_version == CANDIDATE_RUNTIME_VERSION
    assert span is not None
    obs = observe_case(case, bundle)
    assert obs["target_contract_valid"] is True
    assert obs["span_found"] is True
    assert obs["identity_retained"] is True
    assert obs["exact_raw_identity"] is True
    assert obs["exactly_one_identity"] is True
    assert obs["anchor_valid"] is True
    assert obs["finalizer_idempotence"] is True
    assert obs["path_finalized"] is True


def test_surface_search_is_not_used_when_offsets_are_wrong():
    raw = "ledger then ledger"
    case = _case(raw, "ledger")
    # Point at the second occurrence but retain the first occurrence digest/surface.
    second = raw.rindex("ledger")
    case["target_start"] = second
    case["target_end_exclusive"] = second + len("ledger")
    # This is a valid target after rebuilding the source-bound metadata.
    target = create_target_span(raw, raw_start=second, raw_end_exclusive=second + len("ledger"))
    case.update(target.to_case_fields())
    bundle = transliterate_r3n5(raw)
    selected = select_bundle_span_by_target(bundle, target_span_from_case(case))
    assert selected is not None
    assert selected.raw_span.start_offset == second


def test_missing_target_metadata_fails_closed_in_observation():
    case = {
        "case_id": "R3N5-MISSING",
        "input_text": "ledger",
        "highlighted_span": "ledger",
        "population_ids": ["IDENTITY_RETENTION_REQUIRED"],
        "expected_behavior": "IDENTITY_RETAINED",
    }
    obs = observe_case(case, transliterate_r3n5("ledger"))
    assert obs["target_contract_valid"] is False
    assert obs["span_found"] is False
    assert obs["exact_raw_identity"] is False


@pytest.mark.parametrize("bad", ["1", 1.0, True, None])
def test_target_offsets_reject_coercive_types(bad):
    case = _case("prefix ledger suffix", "ledger")
    case["target_start"] = bad
    with pytest.raises(TargetSpanContractError):
        target_span_from_case(case)


def test_wrong_runtime_bundle_is_not_scorable():
    from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n4_candidate_runtime import transliterate_r3n4

    case = _case("prefix ledger suffix", "ledger")
    obs = observe_case(case, transliterate_r3n4(case["input_text"]))
    assert obs["target_contract_valid"] is True
    assert obs["runtime_contract_valid"] is False
    assert obs["span_found"] is False
