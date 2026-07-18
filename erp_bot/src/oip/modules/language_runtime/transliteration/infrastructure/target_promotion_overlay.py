"""MAI-07R2 monotonic target-promotion overlay — never demotes a base target@1."""

from __future__ import annotations

from enum import Enum
from typing import Any

from .....contracts.transliteration import CandidateKind, TransliterationCandidateV1
from ..infrastructure.resource_repository import CompactXlResources


class OverlayDecision(str, Enum):
    KEEP_BASE_ORDER = "KEEP_BASE_ORDER"
    PROMOTE_EXISTING_TARGET = "PROMOTE_EXISTING_TARGET"
    ABSTAIN_FROM_PROMOTION = "ABSTAIN_FROM_PROMOTION"


def _is_acronym(surface: str, *, min_len: int, min_upper_ratio: float) -> bool:
    letters = [c for c in surface if c.isalpha()]
    if len(letters) < min_len:
        return False
    upper = sum(1 for c in letters if c.isupper())
    return (upper / len(letters)) >= min_upper_ratio and surface.isupper()


def _has_devanagari(text: str) -> bool:
    return any("\u0900" <= ch <= "\u097F" for ch in text)


def _neighbor_nepali_signal(
    neighbors: tuple[str, ...],
    resources: CompactXlResources,
) -> bool:
    for n in neighbors:
        if _has_devanagari(n):
            return True
        low = n.lower()
        if low in resources.lexicon or low in resources.domain_terms:
            return True
    return False


def _neighbor_english_only(
    neighbors: tuple[str, ...],
    resources: CompactXlResources,
) -> bool:
    if not neighbors:
        return False
    hits = 0
    for n in neighbors:
        low = n.lower()
        if low in resources.english_identity:
            hits += 1
        elif _has_devanagari(n) or low in resources.lexicon or low in resources.domain_terms:
            return False
    return hits > 0 and hits == len(neighbors)


def _eligible_target(
    c: TransliterationCandidateV1,
    *,
    allowed_kinds: set[str],
    blocked_kinds: set[str],
) -> bool:
    if c.is_identity:
        return False
    if not _has_devanagari(c.surface):
        return False
    kind = c.kind.value
    if kind in blocked_kinds:
        return False
    if kind not in allowed_kinds:
        return False
    if c.kind is CandidateKind.GRAPHEME or "grapheme" in c.provenance:
        # Weak grapheme-only blocked unless also has stronger provenance (should not happen).
        if not any(p in {"lexicon", "domain", "morphology"} for p in c.provenance):
            return False
    return True


class TargetPromotionOverlay:
    """Promote an existing non-identity candidate above identity under strict evidence."""

    def __init__(self, resources: CompactXlResources) -> None:
        self.res = resources
        self.config: dict[str, Any] = dict(getattr(resources, "promotion_overlay_config", {}) or {})

    def decide(
        self,
        ranked: list[TransliterationCandidateV1],
        *,
        surface: str,
        language_form: str,
        neighbors: tuple[str, ...] = (),
        name_like: bool = False,
        prefer_identity: bool = False,
        is_protected: bool = False,
        is_security: bool = False,
    ) -> tuple[OverlayDecision, tuple[str, ...]]:
        cfg = self.config
        if not ranked:
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("BLOCK_NO_CANDIDATES",)

        if not ranked[0].is_identity:
            return OverlayDecision.KEEP_BASE_ORDER, ("KEEP_BASE_TARGET_ALREADY_FIRST",)

        if is_protected:
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("BLOCK_PROTECTED",)
        if is_security:
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("BLOCK_SECURITY",)
        if language_form in set(cfg.get("block_language_forms") or []):
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("BLOCK_ENGLISH_FORM",)
        lower = surface.lower()
        if prefer_identity or lower in self.res.english_identity:
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_ENGLISH",)
        if name_like or lower in self.res.name_like:
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_NAME",)
        if _is_acronym(
            surface,
            min_len=int(cfg.get("acronym_min_length", 2)),
            min_upper_ratio=float(cfg.get("acronym_min_upper_ratio", 0.75)),
        ):
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_ACRONYM",)
        if _neighbor_english_only(neighbors, self.res):
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_ENGLISH_CONTEXT",)

        allowed = set(cfg.get("allowed_candidate_kinds") or [])
        blocked = set(cfg.get("blocked_candidate_kinds") or [])
        eligible = [
            c
            for c in ranked
            if _eligible_target(c, allowed_kinds=allowed, blocked_kinds=blocked)
        ]
        if not eligible:
            non_id = [c for c in ranked if not c.is_identity]
            if non_id and all(c.kind is CandidateKind.GRAPHEME for c in non_id):
                return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_WEAK_GRAPHEME",)
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("BLOCK_NO_TARGET",)

        evidence: list[str] = []
        top = eligible[0]
        if language_form == "ROMANIZED_NEPALI":
            evidence.append("FORM_ROMANIZED_NEPALI")
        if "lexicon" in top.provenance or top.kind is CandidateKind.LEXICAL:
            evidence.append("EXACT_LEXICON_PROVENANCE")
        if "domain" in top.provenance or top.kind is CandidateKind.DOMAIN:
            evidence.append("DOMAIN_PROVENANCE")
        if "morphology" in top.provenance or top.kind is CandidateKind.MORPHOLOGICAL:
            evidence.append("MORPHOLOGY_PROVENANCE")
        if _neighbor_nepali_signal(neighbors, self.res):
            evidence.append("NEIGHBOR_ROMANIZED_OR_DEVANAGARI")

        strong_prov = any(
            e in evidence
            for e in (
                "EXACT_LEXICON_PROVENANCE",
                "DOMAIN_PROVENANCE",
                "MORPHOLOGY_PROVENANCE",
            )
        )
        if not strong_prov:
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_WEAK_GRAPHEME", *evidence)

        required_forms = set(cfg.get("required_language_forms") or ["ROMANIZED_NEPALI"])
        amb_form = str(cfg.get("allowed_ambiguous_form") or "SHARED_OR_AMBIGUOUS_LATIN")
        default_latin = set(cfg.get("allowed_default_latin_forms") or [])

        if language_form in required_forms:
            reason = (
                "PROMOTE_EXACT_ROMANIZED"
                if "EXACT_LEXICON_PROVENANCE" in evidence
                else (
                    "PROMOTE_DOMAIN_WITH_CONTEXT"
                    if "DOMAIN_PROVENANCE" in evidence
                    else "PROMOTE_MORPHOLOGY_WITH_CONTEXT"
                )
            )
            return OverlayDecision.PROMOTE_EXISTING_TARGET, (reason, *evidence)

        if language_form in default_latin:
            # MAI-05 often labels curated XL stems as ENGLISH / TECH via default-Latin.
            # Allow promotion only with strong XL provenance and no english_identity/name blockers
            # (already enforced above).
            if cfg.get("require_lexicon_or_domain_for_default_latin", True) and strong_prov:
                return OverlayDecision.PROMOTE_EXISTING_TARGET, (
                    "PROMOTE_DEFAULT_LATIN_WITH_XL_LEXICON",
                    *evidence,
                )
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_AMBIGUOUS", *evidence)

        if language_form == amb_form:
            if cfg.get("require_extra_signal_for_ambiguous", True):
                if strong_prov and "NEIGHBOR_ROMANIZED_OR_DEVANAGARI" in evidence:
                    return OverlayDecision.PROMOTE_EXISTING_TARGET, (
                        "PROMOTE_AMBIGUOUS_WITH_CONTEXT",
                        *evidence,
                    )
                return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_AMBIGUOUS", *evidence)
            if strong_prov:
                return OverlayDecision.PROMOTE_EXISTING_TARGET, (
                    "PROMOTE_AMBIGUOUS_STRONG_LEXICON",
                    *evidence,
                )
            return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_AMBIGUOUS", *evidence)

        return OverlayDecision.ABSTAIN_FROM_PROMOTION, ("KEEP_IDENTITY_AMBIGUOUS",)
    def apply(
        self,
        ranked: list[TransliterationCandidateV1],
        *,
        surface: str,
        language_form: str,
        neighbors: tuple[str, ...] = (),
        name_like: bool = False,
        prefer_identity: bool = False,
        is_protected: bool = False,
        is_security: bool = False,
    ) -> tuple[list[TransliterationCandidateV1], OverlayDecision, tuple[str, ...]]:
        decision, reasons = self.decide(
            ranked,
            surface=surface,
            language_form=language_form,
            neighbors=neighbors,
            name_like=name_like,
            prefer_identity=prefer_identity,
            is_protected=is_protected,
            is_security=is_security,
        )
        if decision is not OverlayDecision.PROMOTE_EXISTING_TARGET:
            return ranked, decision, reasons

        if not ranked or not ranked[0].is_identity:
            # Monotonic safety: never demote an existing target@1
            return ranked, OverlayDecision.KEEP_BASE_ORDER, ("KEEP_BASE_TARGET_ALREADY_FIRST",)

        allowed = set(self.config.get("allowed_candidate_kinds") or [])
        blocked = set(self.config.get("blocked_candidate_kinds") or [])
        promote = next(
            (
                c
                for c in ranked
                if _eligible_target(c, allowed_kinds=allowed, blocked_kinds=blocked)
            ),
            None,
        )
        if promote is None:
            return ranked, OverlayDecision.ABSTAIN_FROM_PROMOTION, ("BLOCK_NO_TARGET",)

        identity = ranked[0]
        others = [c for c in ranked if c.candidate_id not in {identity.candidate_id, promote.candidate_id}]
        # Preserve relative non-identity order among remaining; place promote then identity then rest
        # Spec: move highest-ranked eligible immediately above identity; preserve all other relative ordering.
        rest_non_id = [c for c in ranked[1:] if c.candidate_id != promote.candidate_id]
        new_order = [promote, identity] + rest_non_id

        out: list[TransliterationCandidateV1] = []
        for i, c in enumerate(new_order, start=1):
            extra = list(c.reason_codes) + list(reasons) + ["OVERLAY_PROMOTE_EXISTING_TARGET"]
            out.append(
                c.model_copy(
                    update={
                        "rank": i,
                        "reason_codes": tuple(dict.fromkeys(extra)),
                    }
                )
            )
        return out, decision, reasons


__all__ = ["OverlayDecision", "TargetPromotionOverlay"]
