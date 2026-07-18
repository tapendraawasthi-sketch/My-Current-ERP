"""Deterministic bounded Romanized→Devanagari candidate generation."""

from __future__ import annotations

import hashlib
import re
import unicodedata

from .....contracts.common import SourceSpanV1
from .....contracts.transliteration import (
    CalibrationStatus,
    CandidateKind,
    CandidateScript,
    TransliterationCandidateV1,
    UncertaintyClass,
)
from .. import MAX_BEAM_WIDTH, MAX_CANDIDATES_PER_SPAN, MAX_SPAN_CODEPOINTS
from ..domain.alignment import identity_alignment
from ..infrastructure.resource_repository import CompactXlResources

_CONTROL_RE = re.compile(r"[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]")
_TOKEN_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?|[०-९0-9]+|[^\sA-Za-z0-9]+|\s+", re.UNICODE)

# Bounded romanization spelling alternatives (engineering-curated; not linguist-approved).
_ASPIRATION_SWAPS = (
    ("th", "t"),
    ("dh", "d"),
    ("bh", "b"),
    ("kh", "k"),
    ("gh", "g"),
    ("ch", "c"),
    ("t", "th"),
    ("d", "dh"),
    ("b", "bh"),
    ("k", "kh"),
    ("g", "gh"),
    ("c", "ch"),
)


def _roman_spelling_alts(lower: str) -> list[str]:
    """Return a small set of romanization spellings for lexicon recall (excludes self)."""
    if not lower.isalpha() or len(lower) > MAX_SPAN_CODEPOINTS:
        return []
    out: list[str] = []
    seen = {lower}
    for a, b in _ASPIRATION_SWAPS:
        if a not in lower:
            continue
        alt = lower.replace(a, b, 1)
        if alt not in seen and alt.isalpha():
            seen.add(alt)
            out.append(alt)
        if len(out) >= 4:
            break
    for long_v, short_v in (("aa", "a"), ("ii", "i"), ("uu", "u"), ("ee", "e"), ("oo", "o")):
        if lower.endswith(long_v) and len(lower) > len(long_v) + 1:
            alt = lower[: -len(long_v)] + short_v
            if alt not in seen:
                seen.add(alt)
                out.append(alt)
        if lower.endswith(short_v) and len(lower) > 2:
            alt = lower[: -len(short_v)] + long_v
            if alt not in seen and len(alt) <= MAX_SPAN_CODEPOINTS:
                seen.add(alt)
                out.append(alt)
        if len(out) >= 6:
            break
    return out[:6]


def _cid(*parts: str) -> str:
    h = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"xlc_{h}"


def _safe_devanagari(surface: str) -> str | None:
    if _CONTROL_RE.search(surface):
        return None
    nfc = unicodedata.normalize("NFC", surface)
    if _CONTROL_RE.search(nfc):
        return None
    return nfc


def _beam_grapheme(text: str, rules: list[tuple[str, str, float]], beam: int) -> list[tuple[str, float]]:
    """Longest-match weighted beam over lowercase Latin letters only."""
    s = text.lower()
    if not s.isalpha() or len(s) > MAX_SPAN_CODEPOINTS:
        return []
    # state: list of (dev_surface, cost, index)
    beam_states: list[tuple[str, float, int]] = [("", 0.0, 0)]
    finals: list[tuple[str, float]] = []
    while beam_states:
        nxt: list[tuple[str, float, int]] = []
        for surf, cost, i in beam_states:
            if i >= len(s):
                finals.append((surf, cost))
                continue
            matched = False
            for roman, dev, rc in rules:
                if s.startswith(roman, i):
                    matched = True
                    nxt.append((surf + dev, cost + rc, i + len(roman)))
                    if len(roman) >= 2:
                        break  # prefer longest first (rules pre-sorted)
            if not matched:
                # fail this branch
                continue
        # prune
        nxt.sort(key=lambda x: (x[1], x[0], x[2]))
        beam_states = nxt[:beam]
        if len(finals) >= beam:
            break
    finals.sort(key=lambda x: (x[1], x[0]))
    out: list[tuple[str, float]] = []
    seen: set[str] = set()
    for surf, cost in finals:
        safe = _safe_devanagari(surf)
        if not safe or safe in seen:
            continue
        seen.add(safe)
        out.append((safe, cost))
        if len(out) >= MAX_CANDIDATES_PER_SPAN:
            break
    return out


def morph_compose(stem_devs: list[str], suffix_key: str, morph: dict[str, list[str]]) -> list[str]:
    sufs = morph.get(suffix_key.lower(), [])
    out: list[str] = []
    for st in stem_devs:
        for su in sufs:
            cand = _safe_devanagari(st + su)
            if cand:
                out.append(cand)
    return out


class DeterministicCandidateGenerator:
    def __init__(self, resources: CompactXlResources) -> None:
        self.res = resources

    def generate(
        self,
        surface: str,
        *,
        language_form: str,
        neighbors: tuple[str, ...] = (),
        use_context: bool = True,
        name_like: bool = False,
        max_candidates: int = MAX_CANDIDATES_PER_SPAN,
        enable_r3d_spelling_alts: bool = True,
    ) -> list[TransliterationCandidateV1]:
        raw = surface
        lower = surface.lower()
        cands: list[TransliterationCandidateV1] = []

        # Always identity first conceptually; ranker will re-rank.
        cands.append(
            TransliterationCandidateV1(
                candidate_id=_cid("id", raw),
                surface=raw,
                script=CandidateScript.LATIN if any(ord(c) < 128 for c in raw) else CandidateScript.OTHER,
                kind=CandidateKind.IDENTITY,
                rank=1,
                ranking_score=0.55,
                uncertainty_class=UncertaintyClass.HIGH_EVIDENCE,
                calibration_status=CalibrationStatus.UNCALIBRATED,
                provenance=("identity",),
                reason_codes=("IDENTITY_REQUIRED",),
                alignment=identity_alignment(raw),
                is_identity=True,
                requires_review=False,
            )
        )

        def add_dev(surface_dev: str, kind: CandidateKind, score: float, prov: str, reasons: tuple[str, ...], review: bool = False) -> None:
            safe = _safe_devanagari(surface_dev)
            if not safe:
                return
            if any(c.surface == safe for c in cands):
                return
            cands.append(
                TransliterationCandidateV1(
                    candidate_id=_cid(kind.value, raw, safe),
                    surface=safe,
                    script=CandidateScript.DEVANAGARI,
                    kind=kind,
                    rank=len(cands) + 1,
                    ranking_score=score,
                    uncertainty_class=UncertaintyClass.MODERATE,
                    calibration_status=CalibrationStatus.UNCALIBRATED,
                    provenance=(prov,),
                    reason_codes=reasons,
                    alignment=identity_alignment(raw, safe),
                    is_identity=False,
                    requires_review=review or name_like,
                )
            )

        # Lexical / domain / ambiguity
        for src, kind, base in (
            (self.res.lexicon, CandidateKind.LEXICAL, 0.92),
            (self.res.domain_terms, CandidateKind.DOMAIN, 0.9),
            (self.res.ambiguity, CandidateKind.LEXICAL, 0.8),
        ):
            for i, dev in enumerate(src.get(lower, [])):
                add_dev(dev, kind, base - i * 0.02, "lexicon" if kind is CandidateKind.LEXICAL else kind.value.lower(), ("LEXICAL_VARIANT",))

        # Bounded romanization variants (aspiration / vowel length) for recall — only when Romanized-eligible.
        if (
            enable_r3d_spelling_alts
            and language_form in {"ROMANIZED_NEPALI", "SHARED_OR_AMBIGUOUS_LATIN"}
            and lower not in self.res.english_identity
        ):
            for alt in _roman_spelling_alts(lower):
                for i, dev in enumerate(self.res.lexicon.get(alt, [])[:2]):
                    add_dev(dev, CandidateKind.LEXICAL, 0.86 - i * 0.02, "lexicon", ("SPELLING_VARIANT_LEXICON",))
                for i, dev in enumerate(self.res.domain_terms.get(alt, [])[:2]):
                    add_dev(dev, CandidateKind.DOMAIN, 0.84 - i * 0.02, "domain", ("SPELLING_VARIANT_DOMAIN",))

        # Morphology: stem+suffix if ends with known suffix
        for suf, _ in sorted(self.res.morphology.items(), key=lambda kv: -len(kv[0])):
            if lower.endswith(suf) and len(lower) > len(suf) + 1:
                stem = lower[: -len(suf)]
                stem_devs = self.res.lexicon.get(stem, [])
                if (
                    not stem_devs
                    and enable_r3d_spelling_alts
                    and language_form == "ROMANIZED_NEPALI"
                ):
                    for alt in _roman_spelling_alts(stem):
                        stem_devs = self.res.lexicon.get(alt, [])
                        if stem_devs:
                            break
                if stem_devs:
                    for composed in morph_compose(stem_devs, suf, self.res.morphology):
                        add_dev(composed, CandidateKind.MORPHOLOGICAL, 0.84, "morphology", ("MORPH_COMPOSE",))
                break

        # Grapheme beam for romanized-only generations
        if language_form in {"ROMANIZED_NEPALI", "SHARED_OR_AMBIGUOUS_LATIN", "NAMED_ENTITY_CANDIDATE"}:
            for surf, cost in _beam_grapheme(lower, self.res.grapheme_rules, MAX_BEAM_WIDTH):
                add_dev(surf, CandidateKind.GRAPHEME, max(0.4, 0.75 - 0.03 * cost), "grapheme", ("GRAPHEME_BEAM",), review=name_like)

        # Name-like: optional Devanagari if lexicon has it, always review
        if name_like and lower in self.res.lexicon:
            for dev in self.res.lexicon[lower]:
                add_dev(dev, CandidateKind.LEXICAL, 0.7, "name_like", ("NAME_LIKE_OPTIONAL",), review=True)

        return cands[: max(1, max_candidates * 3)]  # over-generate; ranker trims
