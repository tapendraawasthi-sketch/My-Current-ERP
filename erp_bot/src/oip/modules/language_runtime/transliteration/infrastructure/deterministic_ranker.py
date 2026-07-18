"""Deterministic contextual ranking — ranking_score is not a probability."""

from __future__ import annotations

from .....contracts.transliteration import (
    CandidateKind,
    TransliterationCandidateV1,
    UncertaintyClass,
)
from .. import MAX_CANDIDATES_PER_SPAN
from ..infrastructure.resource_repository import CompactXlResources


def _tie_key(c: TransliterationCandidateV1) -> tuple:
    # Stable tie-break after score
    prov_pri = {
        "lexicon": 0,
        "domain": 1,
        "morphology": 2,
        "grapheme": 3,
        "identity": 4,
        "name_like": 5,
    }
    pp = min((prov_pri.get(p, 9) for p in c.provenance), default=9)
    return (-c.ranking_score, pp, 0 if c.is_identity else 1, c.surface, c.candidate_id)


class DeterministicCandidateRanker:
    def __init__(self, resources: CompactXlResources) -> None:
        self.res = resources

    def rank(
        self,
        candidates: list[TransliterationCandidateV1],
        *,
        surface: str,
        language_form: str,
        neighbors: tuple[str, ...] = (),
        use_context: bool = True,
        prefer_identity: bool = False,
        name_like: bool = False,
        max_candidates: int = MAX_CANDIDATES_PER_SPAN,
    ) -> list[TransliterationCandidateV1]:
        lower = surface.lower()
        neighbor_l = tuple(n.lower() for n in neighbors)
        scored: list[TransliterationCandidateV1] = []

        for c in candidates:
            score = float(c.ranking_score)
            reasons = list(c.reason_codes)
            unc = c.uncertainty_class
            review = c.requires_review

            cfg = self.res.ranking_config or {}
            eng_boost = float(cfg.get("english_identity_boost", 0.45))
            eng_pen = float(cfg.get("english_dev_penalty", -0.85))
            eng_form_pen = float(cfg.get("english_form_dev_penalty", -0.4))
            name_id_boost = float(cfg.get("name_like_identity_boost", 0.45))
            name_pen = float(cfg.get("name_like_dev_penalty", -0.55))
            cons_boost = float(cfg.get("conservative_identity_boost", 0.25))

            if c.is_identity:
                # Resource-backed English identity — not MAI-05 ENGLISH form alone.
                if lower in self.res.english_identity:
                    score += eng_boost
                    reasons.append("ENGLISH_IDENTITY_PREFERRED")
                elif prefer_identity and language_form in {
                    "ENGLISH",
                    "TECHNICAL_ACCOUNTING_ENGLISH",
                }:
                    score += eng_boost * 0.7
                    reasons.append("ENGLISH_FORM_IDENTITY_PREFERRED")
                if prefer_identity or name_like:
                    score += cons_boost
                    reasons.append("CONSERVATIVE_IDENTITY")
                if language_form == "SHARED_OR_AMBIGUOUS_LATIN" and lower not in self.res.domain_terms and lower not in self.res.lexicon:
                    score += 0.3
                    unc = UncertaintyClass.ABSTAIN
                    reasons.append("AMBIGUOUS_ABSTAIN_IDENTITY")

            if c.kind is CandidateKind.LEXICAL:
                score += 0.08
            if c.kind is CandidateKind.DOMAIN:
                score += 0.1
            if c.kind is CandidateKind.GRAPHEME:
                score -= 0.05
            if c.kind is CandidateKind.MORPHOLOGICAL:
                score += 0.04

            if use_context:
                for rule in self.res.context_rules:
                    if str(rule.get("roman", "")).lower() != lower:
                        continue
                    when = [str(x).lower() for x in rule.get("when_neighbor_in", [])]
                    if not any(w in neighbor_l for w in when):
                        continue
                    boost = float(rule.get("boost", 0.1))
                    prefer = rule.get("prefer")
                    if rule.get("prefer_identity") and c.is_identity:
                        score += boost
                        reasons.append("CONTEXT_IDENTITY_BOOST")
                    elif prefer and c.surface == prefer:
                        score += boost
                        reasons.append("CONTEXT_LEXICAL_BOOST")
                    if rule.get("requires_review"):
                        review = True

            # Penalize Devanagari on confirmed English identity. English-form penalty
            # applies only when prefer_identity is set (no strong Romanized evidence).
            if not c.is_identity and lower in self.res.english_identity:
                score += eng_pen
                review = True
                reasons.append("ENGLISH_DEV_PENALTY")
            elif (
                not c.is_identity
                and prefer_identity
                and language_form in {"ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"}
                and lower not in self.res.lexicon
                and lower not in self.res.domain_terms
            ):
                score += eng_form_pen
                review = True
                reasons.append("ENGLISH_FORM_DEV_PENALTY")

            # Boost lexical/morph Devanagari when Romanized evidence is strong.
            morph_stem = None
            if lower.isalpha():
                for suf in sorted(self.res.morphology.keys(), key=len, reverse=True):
                    if lower.endswith(suf) and len(lower) > len(suf) + 1:
                        stem = lower[: -len(suf)]
                        if stem in self.res.lexicon or stem in self.res.domain_terms:
                            morph_stem = stem
                            break
            strong_xl = (
                lower in self.res.lexicon
                or lower in self.res.domain_terms
                or (
                    morph_stem is not None
                    and morph_stem not in self.res.english_identity
                )
            )
            if (
                not c.is_identity
                and not prefer_identity
                and lower not in self.res.english_identity
                and strong_xl
                and c.kind
                in {
                    CandidateKind.LEXICAL,
                    CandidateKind.DOMAIN,
                    CandidateKind.MORPHOLOGICAL,
                }
            ):
                score += 0.22
                reasons.append("ROMANIZED_LEXICAL_BOOST")

            if name_like and not c.is_identity:
                score += name_pen
                review = True
                reasons.append("NAME_LIKE_PENALTY")
            if name_like and c.is_identity:
                score += name_id_boost
                reasons.append("NAME_LIKE_IDENTITY")

            scored.append(
                c.model_copy(
                    update={
                        "ranking_score": round(score, 6),
                        "reason_codes": tuple(dict.fromkeys(reasons)),
                        "uncertainty_class": unc,
                        "requires_review": review,
                    }
                )
            )

        # Deduplicate by surface keeping best score
        best: dict[str, TransliterationCandidateV1] = {}
        for c in scored:
            prev = best.get(c.surface)
            if prev is None or _tie_key(c) < _tie_key(prev):
                best[c.surface] = c
        ordered = sorted(best.values(), key=_tie_key)

        # Cap while guaranteeing identity remains present (not necessarily rank-1)
        idents = [c for c in ordered if c.is_identity]
        capped: list[TransliterationCandidateV1] = []
        for c in ordered:
            if len(capped) >= max_candidates:
                break
            capped.append(c)
        if idents and not any(c.is_identity for c in capped):
            capped = capped[: max_candidates - 1] + [idents[0]]
            capped = sorted(capped, key=_tie_key)

        out: list[TransliterationCandidateV1] = []
        for i, c in enumerate(capped, start=1):
            out.append(c.model_copy(update={"rank": i}))
        return out
