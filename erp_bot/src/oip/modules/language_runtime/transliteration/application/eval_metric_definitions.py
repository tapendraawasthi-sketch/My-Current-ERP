"""MAI-07C2 evaluator semantic versions and gate thresholds (eval-only)."""

from __future__ import annotations

# Runtime/resources may be mai-07.2.0 after authorized R1 ranking correction; dataset stays frozen v1.
EVALUATOR_VERSION = "mai-07.1.3"
POPULATION_SCHEMA_VERSION_V1 = "mai07-eval-populations-v1"
POPULATION_SCHEMA_VERSION = "mai07-eval-populations-v2"
CANDIDATE_CAP_K = 5

# Historical C1 (any-acceptable, identity-inclusive) — retained as diagnostic only.
POP_CANDIDATE_RANKING = "CANDIDATE_RANKING_POPULATION"
POP_CORE = "CORE_CANDIDATE_POPULATION"
POP_UNAMBIGUOUS = "UNAMBIGUOUS_ROMANIZED_POPULATION"
POP_IDENTITY = "IDENTITY_POPULATION"
POP_ABSTENTION = "ABSTENTION_POPULATION"
POP_CONTEXT = "CONTEXT_CHALLENGE_POPULATION"

# C2 transliteration-quality populations
POP_TRANSLITERATION_REQUIRED = "TRANSLITERATION_REQUIRED"
POP_CORE_TRANSLITERATION_REQUIRED = "CORE_TRANSLITERATION_REQUIRED"
POP_UNAMBIGUOUS_TRANSLITERATION = "UNAMBIGUOUS_TRANSLITERATION"
POP_TRANSLITERATION_OPTIONAL = "TRANSLITERATION_OPTIONAL_OR_AMBIGUOUS"
POP_IDENTITY_REQUIRED = "IDENTITY_REQUIRED"

CANDIDATE_RANKING_SUITE_IDS: frozenset[str] = frozenset(
    {
        "romanized_core_v1",
        "romanized_common_v1",
        "domain_terms_v1",
        "grapheme_ambiguity_v1",
        "phrase_morph_v1",
        "names_entities_v1",
    }
)

CORE_SUITE_IDS: frozenset[str] = frozenset(
    {
        "romanized_core_v1",
        "romanized_common_v1",
        "domain_terms_v1",
        "grapheme_ambiguity_v1",
        "phrase_morph_v1",
    }
)

IDENTITY_SUITE_IDS: frozenset[str] = frozenset(
    {
        "english_identity_v1",
        "devanagari_identity_v1",
        "protected_spans_v1",
    }
)

UNAMBIGUOUS_PREFERRED_SUITES: frozenset[str] = frozenset(
    {
        "romanized_core_v1",
        "romanized_common_v1",
        "domain_terms_v1",
        "grapheme_ambiguity_v1",
    }
)

UNAMBIGUOUS_IDENTITY_PREF_SUITES: frozenset[str] = frozenset(
    {
        "romanized_core_v1",
        "domain_terms_v1",
    }
)

CONTEXT_EXPECTED_SIZE = 64

# Original thresholds — never weakened. Applied to *target* (non-identity) metrics in C2.
GATE_THRESHOLDS = {
    "target_candidate_recall_at_5": 0.95,
    "core_target_recall_at_5": 0.98,
    "target_candidate_top1_accuracy": 0.88,
    "unambiguous_target_top1": 0.92,
    "target_candidate_mrr": 0.90,
    "candidate_uniqueness_rate": 1.0,
    "identity_presence_rate": 1.0,
    "protected_identity_accuracy": 1.0,
    "devanagari_identity_accuracy": 1.0,
    "english_identity_top1_accuracy": 0.98,
    "false_devanagari_preference_on_english_max": 0.02,
    "abstention_precision": 0.95,
    "abstention_recall": 0.85,
    "context_challenge_n_min": 60,
    "contextual_top1_lift_min": 0.05,
}

# Frozen integrity (dataset immutable). Pre-correction resource/runtime hashes are historical baselines.
FROZEN_DATASET_HASH = "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208"
FROZEN_RESOURCE_HASH = "18628335c0feb74a4f28f65ca70b2683f8b54a54790fd03e9033d8cd08ed4566"
FROZEN_RUNTIME_SEMANTIC_HASH = "b28e8240bf0c4faa1253212c40e721f77148516fb3a2a3303582303b8a035849"
# MAI-07R1 corrective pack (authorized ranking correction; does not replace historical baselines).
POST_R1_RESOURCE_HASH = "0f0af894fa282d7134e2ca1cba26a1000f75733fa435588de6a2083abd3d9dc1"
POST_R1_RUNTIME_SEMANTIC_HASH = "097d500c37392383e974c110568799e738a3989f37c5d69dc20bd6d1141c72fd"
C1_AUDIT_HASH = "a737b9b019fd2ba6a1301ebb99b0316303e9d2cedf2197ecd1e65ab54238b9e6"

__all__ = [
    "EVALUATOR_VERSION",
    "POPULATION_SCHEMA_VERSION_V1",
    "POPULATION_SCHEMA_VERSION",
    "CANDIDATE_CAP_K",
    "POP_CANDIDATE_RANKING",
    "POP_CORE",
    "POP_UNAMBIGUOUS",
    "POP_IDENTITY",
    "POP_ABSTENTION",
    "POP_CONTEXT",
    "POP_TRANSLITERATION_REQUIRED",
    "POP_CORE_TRANSLITERATION_REQUIRED",
    "POP_UNAMBIGUOUS_TRANSLITERATION",
    "POP_TRANSLITERATION_OPTIONAL",
    "POP_IDENTITY_REQUIRED",
    "CANDIDATE_RANKING_SUITE_IDS",
    "CORE_SUITE_IDS",
    "IDENTITY_SUITE_IDS",
    "UNAMBIGUOUS_PREFERRED_SUITES",
    "UNAMBIGUOUS_IDENTITY_PREF_SUITES",
    "CONTEXT_EXPECTED_SIZE",
    "GATE_THRESHOLDS",
    "FROZEN_DATASET_HASH",
    "FROZEN_RESOURCE_HASH",
    "FROZEN_RUNTIME_SEMANTIC_HASH",
    "C1_AUDIT_HASH",
]
