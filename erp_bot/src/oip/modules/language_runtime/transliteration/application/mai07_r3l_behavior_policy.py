"""MAI-07R3L — exhaustive review-disposition → behavior-expectation mapping.

Maps ROUND_A_DISPOSITIONS to behavioral policy classes. Never invents Devanagari
target spellings. Unknown dispositions fail closed as UNKNOWN_UNSUPPORTED.
"""

from __future__ import annotations

from .mai07_r3ja_v3_agreement import ROUND_A_DISPOSITIONS
from .mai07_r3l_contracts import BehaviorClass, BehaviorExpectationV1, ScoringApplicability

# Exact ROUND_A enum (must match serialized review dispositions).
KNOWN_DISPOSITIONS: frozenset[str] = frozenset(ROUND_A_DISPOSITIONS)


def map_disposition_to_behavior(disposition: str) -> BehaviorExpectationV1:
    d = disposition.strip()
    if d not in KNOWN_DISPOSITIONS:
        return BehaviorExpectationV1(
            behavior_class="UNKNOWN_UNSUPPORTED",
            review_disposition=d,
            scoring_applicability="UNSUPPORTED",
            unique_top1_gold=False,
            require_identity_top1=False,
            require_identity_retained_at_5=False,
            require_devanagari_candidate_at_5=False,
            forbid_forced_devanagari_top1=False,
            forbid_raw_mutation=True,
            allow_abstain_or_review=True,
            reason_codes=("UNKNOWN_DISPOSITION_FAIL_CLOSED",),
        )

    if d == "ENGLISH_IDENTITY_REQUIRED":
        return BehaviorExpectationV1(
            behavior_class="ENGLISH_IDENTITY",
            review_disposition=d,
            scoring_applicability="SCORABLE",
            unique_top1_gold=True,
            require_identity_top1=True,
            require_identity_retained_at_5=True,
            require_devanagari_candidate_at_5=False,
            forbid_forced_devanagari_top1=True,
            forbid_raw_mutation=True,
            allow_abstain_or_review=False,
            reason_codes=("EXPECT_IDENTITY_TOP1", "FORBID_FALSE_DEVANAGARI_TOP1"),
        )

    if d == "DEVANAGARI_TRANSLITERATION_REQUIRED":
        return BehaviorExpectationV1(
            behavior_class="DEVANAGARI_TRANSLITERATION",
            review_disposition=d,
            scoring_applicability="SCORABLE",
            unique_top1_gold=False,  # no exact spelling gold
            require_identity_top1=False,
            require_identity_retained_at_5=False,
            require_devanagari_candidate_at_5=True,
            forbid_forced_devanagari_top1=False,
            forbid_raw_mutation=True,
            allow_abstain_or_review=True,
            reason_codes=(
                "EXPECT_DEVANAGARI_SCRIPT_CANDIDATE_AT_5",
                "NO_EXACT_TARGET_SPELLING",
                "NOT_TARGET_ACCURACY",
            ),
        )

    if d == "IDENTITY_FIRST_REVIEW_REQUIRED":
        return BehaviorExpectationV1(
            behavior_class="IDENTITY_FIRST",
            review_disposition=d,
            scoring_applicability="SCORABLE",
            unique_top1_gold=True,
            require_identity_top1=True,
            require_identity_retained_at_5=True,
            require_devanagari_candidate_at_5=False,
            forbid_forced_devanagari_top1=False,
            forbid_raw_mutation=True,
            allow_abstain_or_review=True,
            reason_codes=("EXPECT_IDENTITY_TOP1", "ALTERNATIVES_ALLOWED"),
        )

    if d == "TRANSLITERATION_OPTIONAL":
        return BehaviorExpectationV1(
            behavior_class="OPTIONAL",
            review_disposition=d,
            scoring_applicability="SCORABLE",
            unique_top1_gold=False,
            require_identity_top1=False,
            require_identity_retained_at_5=True,
            require_devanagari_candidate_at_5=False,
            forbid_forced_devanagari_top1=False,
            forbid_raw_mutation=True,
            allow_abstain_or_review=True,
            reason_codes=("NO_UNIQUE_TOP1_GOLD", "EXPECT_IDENTITY_RETAINED"),
        )

    if d == "ACRONYM_OR_IDENTIFIER":
        return BehaviorExpectationV1(
            behavior_class="ACRONYM",
            review_disposition=d,
            scoring_applicability="SCORABLE",
            unique_top1_gold=True,
            require_identity_top1=True,
            require_identity_retained_at_5=True,
            require_devanagari_candidate_at_5=False,
            forbid_forced_devanagari_top1=True,
            forbid_raw_mutation=True,
            allow_abstain_or_review=False,
            reason_codes=("EXPECT_ACRONYM_IDENTITY_TOP1", "FORBID_CHAR_BY_CHAR_FORCE"),
        )

    if d == "CONTEXT_DEPENDENT":
        return BehaviorExpectationV1(
            behavior_class="CONTEXT_DEPENDENT",
            review_disposition=d,
            scoring_applicability="SCORABLE",
            unique_top1_gold=False,
            require_identity_top1=False,
            require_identity_retained_at_5=True,
            require_devanagari_candidate_at_5=False,
            forbid_forced_devanagari_top1=False,
            forbid_raw_mutation=True,
            allow_abstain_or_review=True,
            reason_codes=("NO_UNIQUE_TOP1_GOLD", "EXPECT_IDENTITY_AVAILABLE", "REPORT_DIVERSITY_OR_REVIEW"),
        )

    if d == "ABSTAIN_CANNOT_DECIDE":
        return BehaviorExpectationV1(
            behavior_class="ABSTAIN",
            review_disposition=d,
            scoring_applicability="SCORABLE",
            unique_top1_gold=False,
            require_identity_top1=False,
            require_identity_retained_at_5=False,
            require_devanagari_candidate_at_5=False,
            forbid_forced_devanagari_top1=True,
            forbid_raw_mutation=True,
            allow_abstain_or_review=True,
            reason_codes=("FORBID_FORCED_DEVANAGARI_REWRITE", "ABSTAIN_OR_IDENTITY_OR_REVIEW_OK"),
        )

    if d in ("PROTECTED", "NO_TRANSLITERATION_ALLOWED", "NAME_OR_ENTITY"):
        return BehaviorExpectationV1(
            behavior_class="PROTECTED_OR_IDENTIFIER",
            review_disposition=d,
            scoring_applicability="SCORABLE",
            unique_top1_gold=True,
            require_identity_top1=True,
            require_identity_retained_at_5=True,
            require_devanagari_candidate_at_5=False,
            forbid_forced_devanagari_top1=True,
            forbid_raw_mutation=True,
            allow_abstain_or_review=False,
            reason_codes=("EXPECT_PROTECTED_OR_NAME_IDENTITY", "FORBID_MUTATION"),
        )

    # Exhaustive guard — should be unreachable if KNOWN_DISPOSITIONS is complete.
    return BehaviorExpectationV1(
        behavior_class="UNKNOWN_UNSUPPORTED",
        review_disposition=d,
        scoring_applicability="UNSUPPORTED",
        unique_top1_gold=False,
        require_identity_top1=False,
        require_identity_retained_at_5=False,
        require_devanagari_candidate_at_5=False,
        forbid_forced_devanagari_top1=False,
        forbid_raw_mutation=True,
        allow_abstain_or_review=True,
        reason_codes=("UNMAPPED_KNOWN_DISPOSITION",),
    )


def assert_exhaustive_mapping() -> None:
    for d in ROUND_A_DISPOSITIONS:
        b = map_disposition_to_behavior(d)
        if b.behavior_class == "UNKNOWN_UNSUPPORTED" and d in KNOWN_DISPOSITIONS:
            # NAME_OR_ENTITY / NO_TRANSLITERATION map to PROTECTED_OR_IDENTIFIER
            if d not in ("PROTECTED", "NO_TRANSLITERATION_ALLOWED", "NAME_OR_ENTITY"):
                # All known should map to a concrete class
                if b.reason_codes == ("UNMAPPED_KNOWN_DISPOSITION",):
                    raise ValueError(f"unmapped_disposition:{d}")
        if d in KNOWN_DISPOSITIONS and b.behavior_class == "UNKNOWN_UNSUPPORTED":
            raise ValueError(f"known_mapped_to_unsupported:{d}")


# Validate at import for fail-closed exhaustiveness of known dispositions.
for _d in ROUND_A_DISPOSITIONS:
    _b = map_disposition_to_behavior(_d)
    if _b.behavior_class == "UNKNOWN_UNSUPPORTED":
        raise RuntimeError(f"R3L mapping incomplete for known disposition {_d}")
