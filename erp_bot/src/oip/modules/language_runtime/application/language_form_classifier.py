"""Deterministic LanguageForm classifier."""

from __future__ import annotations

from dataclasses import dataclass

from ..domain.script import ScriptCategory, classify_char_script
from ..domain.taxonomy import LanguageForm
from ..infrastructure.compact_resource_repository import CompactResources


@dataclass(frozen=True)
class LanguageFormDecision:
    form: LanguageForm
    confidence: float
    evidence_codes: tuple[str, ...]
    alternatives: tuple[LanguageForm, ...]
    classifier_version: str
    abstained: bool


CLASSIFIER_VERSION = "mai-05.1.0-deterministic"


_ENGLISH_FUNC = frozenset(
    {
        "please",
        "show",
        "the",
        "for",
        "this",
        "what",
        "how",
        "when",
        "where",
        "why",
        "with",
        "from",
        "that",
        "have",
        "has",
        "had",
        "will",
        "would",
        "should",
        "could",
        "about",
        "after",
        "before",
        "today",
        "yesterday",
        "tomorrow",
        "customer",
        "supplier",
        "goods",
        "item",
        "items",
        "paid",
        "received",
        "bought",
        "sold",
        "record",
        "create",
        "open",
        "close",
        "hello",
        "thanks",
        "thank",
        "ready",
        "entry",
        "post",
        "confirm",
        "cancel",
        "change",
        "make",
        "it",
        "only",
        "months",
        "month",
        "house",
        "rent",
        "need",
        "went",
        "abroad",
        "shop",
        "theft",
        "missing",
        "explain",
        "simple",
        "simply",
    }
)


def classify_token(
    token: str,
    *,
    script: ScriptCategory,
    resources: CompactResources,
    neighbor_forms: tuple[LanguageForm, ...] = (),
) -> LanguageFormDecision:
    surface = token.strip()
    low = surface.lower()
    if not surface:
        return LanguageFormDecision(
            LanguageForm.UNKNOWN, 0.0, ("empty",), (), CLASSIFIER_VERSION, True
        )

    if script in {ScriptCategory.ASCII_DIGIT, ScriptCategory.DEVANAGARI_DIGIT}:
        return LanguageFormDecision(
            LanguageForm.NUMERIC, 1.0, ("digit_script",), (), CLASSIFIER_VERSION, False
        )
    if script in {
        ScriptCategory.COMMON_PUNCTUATION,
        ScriptCategory.SYMBOL,
        ScriptCategory.EMOJI,
        ScriptCategory.WHITESPACE,
        ScriptCategory.CONTROL,
    }:
        return LanguageFormDecision(
            LanguageForm.PUNCTUATION_OR_SYMBOL,
            1.0,
            ("non_language_script",),
            (),
            CLASSIFIER_VERSION,
            False,
        )

    if script is ScriptCategory.DEVANAGARI or (
        script is ScriptCategory.MIXED and any(classify_char_script(c) is ScriptCategory.DEVANAGARI for c in surface)
    ):
        # Devanagari letters → Nepali Devanagari form (script≠language still stored separately)
        return LanguageFormDecision(
            LanguageForm.NEPALI_DEVANAGARI,
            0.95,
            ("devanagari_letters",),
            (),
            CLASSIFIER_VERSION,
            False,
        )

    if script is ScriptCategory.LATIN or script is ScriptCategory.MIXED:
        # Ambiguous lexicon abstains before technical English / Romanized.
        if low in resources.ambiguous_latin:
            return LanguageFormDecision(
                LanguageForm.SHARED_OR_AMBIGUOUS_LATIN,
                0.55,
                ("ambiguous_lexicon",),
                (LanguageForm.ROMANIZED_NEPALI, LanguageForm.ENGLISH, LanguageForm.TECHNICAL_ACCOUNTING_ENGLISH),
                CLASSIFIER_VERSION,
                True,
            )
        if low in resources.english_accounting:
            return LanguageFormDecision(
                LanguageForm.TECHNICAL_ACCOUNTING_ENGLISH,
                0.92,
                ("accounting_lexicon",),
                (LanguageForm.ENGLISH,),
                CLASSIFIER_VERSION,
                False,
            )
        if low in resources.romanized:
            return LanguageFormDecision(
                LanguageForm.ROMANIZED_NEPALI,
                0.93,
                ("romanized_lexicon",),
                (),
                CLASSIFIER_VERSION,
                False,
            )
        if low in resources.named_entity_candidates:
            # Context: if neighbors are strongly romanized, still abstain for short ambiguous
            return LanguageFormDecision(
                LanguageForm.SHARED_OR_AMBIGUOUS_LATIN,
                0.55,
                ("ambiguous_lexicon",),
                (LanguageForm.ROMANIZED_NEPALI, LanguageForm.ENGLISH, LanguageForm.NAMED_ENTITY_CANDIDATE),
                CLASSIFIER_VERSION,
                True,
            )
        if low in _ENGLISH_FUNC or (len(low) > 3 and low.isalpha() and low not in resources.romanized):
            # Longer alphabetic Latin without romanized signal → English (conservative)
            if low in resources.named_entity_candidates:
                return LanguageFormDecision(
                    LanguageForm.NAMED_ENTITY_CANDIDATE,
                    0.6,
                    ("name_candidate",),
                    (LanguageForm.SHARED_OR_AMBIGUOUS_LATIN,),
                    CLASSIFIER_VERSION,
                    True,
                )
            return LanguageFormDecision(
                LanguageForm.ENGLISH,
                0.8 if low in _ENGLISH_FUNC else 0.7,
                ("english_function_or_default_latin",),
                (LanguageForm.SHARED_OR_AMBIGUOUS_LATIN,),
                CLASSIFIER_VERSION,
                False,
            )
        # Short unknown latin → ambiguous abstention
        return LanguageFormDecision(
            LanguageForm.SHARED_OR_AMBIGUOUS_LATIN,
            0.4,
            ("short_or_unknown_latin",),
            (LanguageForm.ROMANIZED_NEPALI, LanguageForm.ENGLISH),
            CLASSIFIER_VERSION,
            True,
        )

    return LanguageFormDecision(
        LanguageForm.UNKNOWN, 0.0, ("unknown_script",), (), CLASSIFIER_VERSION, True
    )
