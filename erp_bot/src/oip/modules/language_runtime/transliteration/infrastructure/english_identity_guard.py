"""MAI-07R3H canonical identity-disposition authority.

Single deterministic policy used by product, direct service, and evaluators.
Runs after candidate generation/contextual ranking and before final capped serialize.
It reorders exactly once, preserves candidate surfaces, and never reads frozen data.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
import re

from .....contracts.transliteration import TransliterationCandidateV1
from ..infrastructure.resource_repository import CompactXlResources

GUARD_VERSION = "mai-07-r3h2.1.0.0"
EVAL_VERSION = "mai-07-r3h2-eval.1.0.0"
POLICY_VERSION = GUARD_VERSION
# Historical R3H policy id retained for lineage documentation only.
PARENT_R3H_POLICY_VERSION = "mai-07-r3h.1.0.0"
_DEV_RE = re.compile(r"[\u0900-\u097F]")


class Disposition(str, Enum):
    PROTECTED_IDENTITY_REQUIRED = "PROTECTED_IDENTITY_REQUIRED"
    NAME_IDENTITY_REQUIRED = "NAME_IDENTITY_REQUIRED"
    ACRONYM_IDENTITY_REQUIRED = "ACRONYM_IDENTITY_REQUIRED"
    ENGLISH_IDENTITY_REQUIRED = "ENGLISH_IDENTITY_REQUIRED"
    ROMANIZED_TARGET_PREFERRED = "ROMANIZED_TARGET_PREFERRED"
    SHARED_CONTEXT_IDENTITY_PREFERRED = "SHARED_CONTEXT_IDENTITY_PREFERRED"
    SHARED_CONTEXT_TARGET_PREFERRED = "SHARED_CONTEXT_TARGET_PREFERRED"
    AMBIGUOUS_IDENTITY_FIRST_REVIEW = "AMBIGUOUS_IDENTITY_FIRST_REVIEW"
    KEEP_BASE_ORDER = "KEEP_BASE_ORDER"
    UNSUPPORTED = "UNSUPPORTED"
    # Historical aliases retained for backward-compatible tests/report readers.
    PROTECTED_SPAN = "PROTECTED_IDENTITY_REQUIRED"
    ACRONYM_IDENTIFIER = "ACRONYM_IDENTITY_REQUIRED"
    HIGH_CONFIDENCE_PROPER_NAME = "NAME_IDENTITY_REQUIRED"
    HIGH_CONFIDENCE_ENGLISH_IDENTITY = "ENGLISH_IDENTITY_REQUIRED"
    HIGH_CONFIDENCE_ROMANIZED_NEPALI = "ROMANIZED_TARGET_PREFERRED"
    SHARED_AMBIGUOUS_LATIN = "AMBIGUOUS_IDENTITY_FIRST_REVIEW"
    UNKNOWN = "KEEP_BASE_ORDER"


def _cfg(resources: CompactXlResources) -> dict[str, Any]:
    return dict(getattr(resources, "english_identity_guard", None) or {})


def _is_r3n_policy(cfg: dict[str, Any]) -> bool:
    ver = str(cfg.get("version") or cfg.get("guard_id") or cfg.get("policy_version") or "")
    return ver.startswith("mai-07-r3n")


def _weights(cfg: dict[str, Any]) -> dict[str, float]:
    w = dict(cfg.get("weights") or {})
    return {
        "english_context_ratio_high": float(w.get("english_context_ratio_high", 0.5)),
        "english_context_ratio_borrow": float(w.get("english_context_ratio_borrow", 0.4)),
        "neighbor_english_function_min": float(w.get("neighbor_english_function_min", 1)),
        "nepali_particle_block_english": float(w.get("nepali_particle_block_english", 1)),
        "min_signals_for_high_confidence_english": float(w.get("min_signals_for_high_confidence_english", 2)),
        "shared_term_target_min": float(w.get("shared_term_target_min", 2)),
    }


def _morph_stem(surface: str, resources: CompactXlResources) -> str | None:
    low = surface.lower()
    if not low.isalpha():
        return None
    for suf in sorted(resources.morphology.keys(), key=len, reverse=True):
        if low.endswith(suf) and len(low) > len(suf) + 1:
            stem = low[: -len(suf)]
            if stem in resources.lexicon or stem in resources.domain_terms:
                if stem not in resources.english_identity:
                    return stem
    return None


def _contains_devanagari(text: str) -> bool:
    return bool(_DEV_RE.search(text))


def _phrase_hits(surface: str, neighbors: tuple[str, ...], phrases: tuple[str, ...]) -> int:
    if not phrases:
        return 0
    tokens = tuple(x.lower() for x in neighbors if x and x.strip())
    if not tokens:
        return 0
    joined = " ".join(tokens)
    low = surface.lower()
    hits = 0
    for phrase in phrases:
        p = phrase.lower().strip()
        if not p:
            continue
        if low in p and p in f"{joined} {low}" or p in f"{low} {joined}" or p in joined:
            hits += 1
    return hits


def compute_signals(
    *,
    surface: str,
    language_form: str,
    neighbors: tuple[str, ...],
    resources: CompactXlResources,
    name_like: bool,
    is_protected: bool,
    ranked: list[TransliterationCandidateV1] | None = None,
) -> dict[str, Any]:
    cfg = _cfg(resources)
    weights = _weights(cfg)
    low = surface.lower()
    eng_func = frozenset(str(x).lower() for x in (cfg.get("english_function_words") or []))
    nep_part = frozenset(str(x).lower() for x in (cfg.get("nepali_context_particles") or []))
    tech_terms = frozenset(str(x).lower() for x in (cfg.get("technical_english_terms") or []))
    eng_phrases = tuple(str(x) for x in (cfg.get("english_phrases") or ()))
    nep_phrases = tuple(str(x) for x in (cfg.get("romanized_nepali_phrases") or ()))
    neighbor_l = tuple(n.lower() for n in neighbors if n and n.strip())

    in_eng = low in resources.english_identity
    in_lex = low in resources.lexicon
    in_dom = low in resources.domain_terms
    in_name = name_like or low in resources.name_like
    morph = _morph_stem(surface, resources)
    shared_surface = in_eng and (in_lex or in_dom)
    strong_romanized_lex = (in_lex or in_dom or morph is not None) and not in_eng

    neighbor_eng = sum(1 for n in neighbor_l if n in eng_func or n in resources.english_identity)
    if _is_r3n_policy(cfg):
        # R3N: Nepali-particle evidence is particles only — lexicon neighbors are not particles.
        neighbor_nep = sum(1 for n in neighbor_l if n in nep_part)
        neighbor_rom_lex = sum(
            1
            for n in neighbor_l
            if (n in resources.lexicon or n in resources.domain_terms)
            and n not in resources.english_identity
            and n not in nep_part
        )
    else:
        neighbor_nep = sum(
            1
            for n in neighbor_l
            if n in nep_part or (n in resources.lexicon and n not in resources.english_identity)
        )
        neighbor_rom_lex = 0
    neighbor_tech = sum(1 for n in neighbor_l if n in tech_terms)
    neighbor_dev = sum(1 for n in neighbors if _contains_devanagari(n))
    # Sentence English ratio from neighbors only — do not credit MAI-05 form alone
    # (many Romanized tokens are weakly labeled ENGLISH).
    if neighbor_l:
        eng_ratio = neighbor_eng / float(len(neighbor_l))
    else:
        eng_ratio = 1.0 if in_eng else 0.0

    is_acronym = bool(surface.isupper() and surface.isalpha() and 2 <= len(surface) <= 6)
    # R3N: also treat mixed letter-digit / punct identifiers structurally.
    if _is_r3n_policy(cfg):
        is_identifier = bool(
            language_form in {"IDENTIFIER_OR_CODE", "NUMERIC", "PUNCTUATION_OR_SYMBOL"}
            or (
                any(ch.isdigit() for ch in surface)
                and (any(ch.isalpha() for ch in surface) or any(ch in "-_/." for ch in surface))
            )
            or (any(ch in "-_/." for ch in surface) and any(ch.isalpha() for ch in surface))
        )
    else:
        is_identifier = bool(
            language_form in {"IDENTIFIER_OR_CODE", "NUMERIC", "PUNCTUATION_OR_SYMBOL"}
            or any(ch.isdigit() for ch in surface)
            and any(ch in "-_/." for ch in surface)
        )

    top_dev_rank = None
    if ranked:
        for c in ranked:
            if not c.is_identity and _contains_devanagari(c.surface):
                top_dev_rank = c.rank
                break

    signals = {
        "version": str(cfg.get("version") or POLICY_VERSION),
        "surface_lower": low,
        "language_form": language_form,
        "in_english_identity": in_eng,
        "in_lexicon": in_lex,
        "in_domain": in_dom,
        "shared_surface": shared_surface,
        "morph_stem": morph,
        "strong_romanized_lex": strong_romanized_lex,
        "neighbor_english_function_count": neighbor_eng,
        "neighbor_nepali_particle_count": neighbor_nep,
        "neighbor_romanized_lexicon_count": neighbor_rom_lex,
        "neighbor_technical_english_count": neighbor_tech,
        "neighbor_devanagari_count": neighbor_dev,
        "english_phrase_hits": _phrase_hits(surface, neighbors, eng_phrases),
        "romanized_phrase_hits": _phrase_hits(surface, neighbors, nep_phrases),
        "english_context_ratio": round(eng_ratio, 6),
        "name_like": in_name,
        "is_acronym": is_acronym,
        "is_identifier": is_identifier,
        "is_protected": is_protected,
        "top_devanagari_rank": top_dev_rank,
        "weights": weights,
        "r3n_policy": _is_r3n_policy(cfg),
        "provenance": (
            ("mai-07-r3n-identity-policy", str(cfg.get("version") or POLICY_VERSION))
            if _is_r3n_policy(cfg)
            else ("mai-07-r3h-identity-policy", POLICY_VERSION)
        ),
    }
    return signals


def _high_confidence_english(signals: dict[str, Any], language_form: str) -> bool:
    w = signals["weights"]
    votes: list[str] = []
    if signals["in_english_identity"]:
        votes.append("english_identity_lexicon")
    if language_form in {"ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"}:
        votes.append("language_form_english")
    if signals["english_context_ratio"] >= w["english_context_ratio_high"]:
        votes.append("english_context_ratio")
    if signals["neighbor_english_function_count"] >= w["neighbor_english_function_min"]:
        votes.append("neighbor_english_function")
    if signals["neighbor_technical_english_count"] >= 1:
        votes.append("technical_english_context")
    if signals["english_phrase_hits"] >= 1:
        votes.append("english_phrase")
    if not signals["strong_romanized_lex"]:
        votes.append("absence_strong_romanized")
    if signals["morph_stem"] is None:
        votes.append("absence_nepali_morphology")
    if signals["neighbor_nepali_particle_count"] < w["nepali_particle_block_english"]:
        votes.append("absence_nepali_particles")
    if (signals["in_lexicon"] or signals["in_domain"]) and signals["english_context_ratio"] >= w[
        "english_context_ratio_borrow"
    ]:
        votes.append("domain_borrow_english_context")

    if (
        signals["strong_romanized_lex"]
        and signals["neighbor_nepali_particle_count"] >= w["nepali_particle_block_english"]
        and signals["english_context_ratio"] < w["english_context_ratio_high"]
        and not signals["in_english_identity"]
    ):
        return False

    if signals["in_english_identity"]:
        return True

    # Context-driven English identity (authored English sentences / counterfactuals).
    # When strong Romanized lexicon evidence exists, require stronger English context
    # so templates like "check <roman>" do not demote genuine Romanized top-1.
    if signals["neighbor_nepali_particle_count"] < w["nepali_particle_block_english"]:
        if signals["strong_romanized_lex"]:
            if (
                signals["english_context_ratio"] >= w["english_context_ratio_high"]
                and signals["neighbor_english_function_count"] >= 2
            ):
                return True
        elif (
            signals["english_context_ratio"] >= w["english_context_ratio_high"]
            and signals["neighbor_english_function_count"] >= w["neighbor_english_function_min"]
        ):
            return True

    if language_form in {"ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"} and len(set(votes)) >= int(
        w["min_signals_for_high_confidence_english"]
    ):
        if signals["strong_romanized_lex"]:
            positive = {
                "english_identity_lexicon",
                "english_context_ratio",
                "neighbor_english_function",
                "domain_borrow_english_context",
                "technical_english_context",
                "english_phrase",
            }
            if not (set(votes) & positive):
                return False
        return True
    return False


def _high_confidence_romanized(signals: dict[str, Any], language_form: str) -> bool:
    """Positive Romanized evidence required — not merely absence of English."""
    if signals["in_english_identity"] or signals["is_acronym"] or signals["is_identifier"]:
        return False
    if not signals["strong_romanized_lex"]:
        return False
    # R3N: English/technical form without Nepali particles must not flip to Romanized target
    # from lexicon membership alone.
    if signals.get("r3n_policy") and language_form in {
        "ENGLISH",
        "TECHNICAL_ACCOUNTING_ENGLISH",
    }:
        if signals["neighbor_nepali_particle_count"] < signals["weights"]["nepali_particle_block_english"]:
            if signals["neighbor_devanagari_count"] < 1 and signals["romanized_phrase_hits"] < 1:
                return False
    if (
        signals["english_context_ratio"] >= signals["weights"]["english_context_ratio_high"]
        and signals["neighbor_english_function_count"] >= (2 if signals["strong_romanized_lex"] else signals["weights"]["neighbor_english_function_min"])
        and signals["neighbor_nepali_particle_count"] < signals["weights"]["nepali_particle_block_english"]
    ):
        return False
    if language_form == "ROMANIZED_NEPALI":
        return True
    if signals["morph_stem"] is not None and language_form not in {"ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"}:
        return True
    if signals["neighbor_nepali_particle_count"] >= 1 and signals["english_context_ratio"] < 0.5:
        return True
    if signals["neighbor_devanagari_count"] >= 1:
        return True
    if signals["romanized_phrase_hits"] >= 1:
        return True
    if (
        signals["neighbor_english_function_count"] < 1
        and signals["english_context_ratio"] < signals["weights"]["english_context_ratio_borrow"]
        and language_form != "SHARED_OR_AMBIGUOUS_LATIN"
    ):
        return True
    return False


def _r3n_decisive_english(signals: dict[str, Any], language_form: str) -> bool:
    """Multi-signal English identity for R3N — form alone is never sufficient."""
    if signals["neighbor_nepali_particle_count"] >= signals["weights"]["nepali_particle_block_english"]:
        return False
    if signals["neighbor_devanagari_count"] >= 1 and signals["romanized_phrase_hits"] >= 1:
        return False
    votes: list[str] = []
    if signals["in_english_identity"]:
        votes.append("english_identity_lexicon")
    if language_form in {"ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"}:
        votes.append("language_form_english")
    if signals["english_context_ratio"] >= signals["weights"]["english_context_ratio_high"]:
        votes.append("english_context_ratio")
    if signals["neighbor_english_function_count"] >= signals["weights"]["neighbor_english_function_min"]:
        votes.append("neighbor_english_function")
    if signals["neighbor_technical_english_count"] >= 1:
        votes.append("technical_english_context")
    if signals["english_phrase_hits"] >= 1:
        votes.append("english_phrase")
    if signals["morph_stem"] is None:
        votes.append("absence_nepali_morphology")
    if signals["neighbor_nepali_particle_count"] < signals["weights"]["nepali_particle_block_english"]:
        votes.append("absence_nepali_particles")
    # Require form + at least one independent non-form signal, or resource + form.
    independent = {
        "english_identity_lexicon",
        "english_context_ratio",
        "neighbor_english_function",
        "technical_english_context",
        "english_phrase",
    }
    if "language_form_english" in votes and (set(votes) & independent):
        return True
    if "english_identity_lexicon" in votes and "language_form_english" in votes:
        return True
    if len(set(votes) & independent) >= 2 and "absence_nepali_particles" in votes:
        return True
    return False


def classify_disposition(
    *,
    surface: str,
    language_form: str,
    neighbors: tuple[str, ...],
    resources: CompactXlResources,
    name_like: bool = False,
    is_protected: bool = False,
    ranked: list[TransliterationCandidateV1] | None = None,
) -> tuple[Disposition, dict[str, Any]]:
    signals = compute_signals(
        surface=surface,
        language_form=language_form,
        neighbors=neighbors,
        resources=resources,
        name_like=name_like,
        is_protected=is_protected,
        ranked=ranked,
    )
    if is_protected:
        return Disposition.PROTECTED_IDENTITY_REQUIRED, signals
    if signals["is_acronym"] or signals["is_identifier"] or language_form in {
        "IDENTIFIER_OR_CODE",
        "NUMERIC",
        "PUNCTUATION_OR_SYMBOL",
    }:
        return Disposition.ACRONYM_IDENTITY_REQUIRED, signals
    if signals["name_like"]:
        return Disposition.NAME_IDENTITY_REQUIRED, signals
    if signals["name_like"] and language_form == "NAMED_ENTITY_CANDIDATE":
        return Disposition.NAME_IDENTITY_REQUIRED, signals
    if signals["shared_surface"]:
        # One canonical shared-collision policy (MAI-07R3H2):
        # decisive English → identity; decisive Nepali → target; else identity+review.
        # Lexicon membership alone is never decisive for shared surfaces.
        w = signals["weights"]
        nepali_decisive = signals["neighbor_nepali_particle_count"] >= w["nepali_particle_block_english"]
        english_decisive = (not nepali_decisive) and (
            signals["english_phrase_hits"] >= 1
            or signals["neighbor_technical_english_count"] >= 1
            or (
                language_form in {"ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"}
                and signals["english_context_ratio"] >= w["english_context_ratio_high"]
                and signals["neighbor_english_function_count"] >= w["neighbor_english_function_min"]
            )
            or (
                # Explicit English function-word / accounting context without Nepali particles.
                signals["neighbor_english_function_count"] >= max(2, w["neighbor_english_function_min"])
                and signals["english_context_ratio"] >= w["english_context_ratio_high"]
            )
            or (
                # R3N: resource + English/technical form + no Nepali particles.
                bool(signals.get("r3n_policy"))
                and signals["in_english_identity"]
                and language_form in {"ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"}
            )
        )
        if english_decisive:
            return Disposition.SHARED_CONTEXT_IDENTITY_PREFERRED, signals
        if nepali_decisive:
            return Disposition.SHARED_CONTEXT_TARGET_PREFERRED, signals
        return Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW, signals
    if signals.get("r3n_policy") and _r3n_decisive_english(signals, language_form):
        return Disposition.ENGLISH_IDENTITY_REQUIRED, signals
    if _high_confidence_english(signals, language_form):
        return Disposition.ENGLISH_IDENTITY_REQUIRED, signals
    if _high_confidence_romanized(signals, language_form):
        return Disposition.ROMANIZED_TARGET_PREFERRED, signals
    if language_form == "SHARED_OR_AMBIGUOUS_LATIN":
        if signals["strong_romanized_lex"] and signals["neighbor_nepali_particle_count"] >= 1:
            return Disposition.SHARED_CONTEXT_TARGET_PREFERRED, signals
        return Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW, signals
    if language_form == "NAMED_ENTITY_CANDIDATE":
        return Disposition.NAME_IDENTITY_REQUIRED, signals
    if signals["strong_romanized_lex"]:
        return Disposition.KEEP_BASE_ORDER, signals
    if language_form == "UNKNOWN":
        return Disposition.UNSUPPORTED, signals
    return Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW, signals


def _force_identity_first(
    ranked: list[TransliterationCandidateV1],
    *,
    surface: str,
    reason: str,
    review_required: bool = False,
) -> list[TransliterationCandidateV1]:
    if not ranked:
        return ranked
    idents = [c for c in ranked if c.is_identity and c.surface == surface]
    if not idents:
        idents = [c for c in ranked if c.is_identity]
    if not idents:
        return ranked
    ident = idents[0]
    rest = [c for c in ranked if c.candidate_id != ident.candidate_id]
    ordered = [ident] + rest
    out: list[TransliterationCandidateV1] = []
    for i, c in enumerate(ordered, start=1):
        reasons = tuple(dict.fromkeys(tuple(c.reason_codes) + (reason,)))
        prov = tuple(dict.fromkeys(tuple(c.provenance) + ("mai-07-r3h2-identity-policy",)))
        # Review metadata is authoritative on the identity decision (rank-1 when forced).
        needs_review = bool(review_required) if c.candidate_id == ident.candidate_id else c.requires_review
        if review_required and c.candidate_id == ident.candidate_id:
            reasons = tuple(dict.fromkeys(reasons + ("R3H2_REVIEW_REQUIRED",)))
        out.append(
            c.model_copy(
                update={
                    "rank": i,
                    "reason_codes": reasons,
                    "provenance": prov,
                    "requires_review": needs_review,
                }
            )
        )
    return out


def _prefer_first_target(
    ranked: list[TransliterationCandidateV1],
    *,
    reason: str,
) -> list[TransliterationCandidateV1]:
    if not ranked:
        return ranked
    target = next((c for c in ranked if (not c.is_identity) and _contains_devanagari(c.surface)), None)
    if target is None:
        return ranked
    rest = [c for c in ranked if c.candidate_id != target.candidate_id]
    ordered = [target] + rest
    out: list[TransliterationCandidateV1] = []
    for i, c in enumerate(ordered, start=1):
        reasons = tuple(dict.fromkeys(tuple(c.reason_codes) + (reason,)))
        prov = tuple(dict.fromkeys(tuple(c.provenance) + ("mai-07-r3h2-identity-policy",)))
        out.append(
            c.model_copy(
                update={
                    "rank": i,
                    "reason_codes": reasons,
                    "provenance": prov,
                    "requires_review": False if c.candidate_id == target.candidate_id else c.requires_review,
                }
            )
        )
    return out


def apply_english_identity_guard(
    ranked: list[TransliterationCandidateV1],
    *,
    surface: str,
    language_form: str,
    neighbors: tuple[str, ...] = (),
    resources: CompactXlResources,
    name_like: bool = False,
    is_protected: bool = False,
) -> tuple[list[TransliterationCandidateV1], Disposition, dict[str, Any]]:
    """Apply canonical R3H2 policy once. Never drop or fabricate candidates."""
    disposition, signals = classify_disposition(
        surface=surface,
        language_form=language_form,
        neighbors=neighbors,
        resources=resources,
        name_like=name_like,
        is_protected=is_protected,
        ranked=ranked,
    )
    before_surfaces = [c.surface for c in ranked]
    reason_map = {
        Disposition.PROTECTED_IDENTITY_REQUIRED: "R3H2_PROTECTED_IDENTITY_REQUIRED",
        Disposition.ACRONYM_IDENTITY_REQUIRED: "R3H2_ACRONYM_IDENTITY_REQUIRED",
        Disposition.NAME_IDENTITY_REQUIRED: "R3H2_NAME_IDENTITY_REQUIRED",
        Disposition.ENGLISH_IDENTITY_REQUIRED: "R3H2_ENGLISH_IDENTITY_REQUIRED",
        Disposition.SHARED_CONTEXT_IDENTITY_PREFERRED: "R3H2_SHARED_CONTEXT_IDENTITY_PREFERRED",
        Disposition.SHARED_CONTEXT_TARGET_PREFERRED: "R3H2_SHARED_CONTEXT_TARGET_PREFERRED",
        Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW: "R3H2_AMBIGUOUS_IDENTITY_FIRST_REVIEW",
        Disposition.KEEP_BASE_ORDER: "R3H2_KEEP_BASE_ORDER",
        Disposition.ROMANIZED_TARGET_PREFERRED: "R3H2_ROMANIZED_TARGET_PREFERRED",
        Disposition.UNSUPPORTED: "R3H2_UNSUPPORTED",
    }
    reason = reason_map[disposition]
    review_required = disposition is Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW
    if disposition in {
        Disposition.ROMANIZED_TARGET_PREFERRED,
        Disposition.SHARED_CONTEXT_TARGET_PREFERRED,
    }:
        out = _prefer_first_target(ranked, reason=reason)
    elif disposition in {
        Disposition.KEEP_BASE_ORDER,
        Disposition.UNSUPPORTED,
    }:
        out = ranked
    else:
        out = _force_identity_first(
            ranked,
            surface=surface,
            reason=reason,
            review_required=review_required,
        )
    after_surfaces = [c.surface for c in out]
    assert sorted(before_surfaces) == sorted(after_surfaces), "guard must preserve candidate surfaces"
    signals = dict(signals)
    signals["disposition"] = disposition.value
    signals["guard_applied"] = True
    signals["reorder_reason"] = reason
    signals["policy_version"] = POLICY_VERSION
    signals["review_required"] = review_required
    signals["review_reason_codes"] = (
        ("R3H2_AMBIGUOUS_IDENTITY_FIRST_REVIEW", "R3H2_REVIEW_REQUIRED") if review_required else ()
    )
    return out, disposition, signals
