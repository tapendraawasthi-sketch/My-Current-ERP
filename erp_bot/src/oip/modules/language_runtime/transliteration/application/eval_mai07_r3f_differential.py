"""MAI-07R3F monotonic differential: guarded reorder vs unguarded ranker (non-frozen)."""

from __future__ import annotations

from typing import Any

from ...application.language_analyzer import analyze_language
from .eval_mai07_r3f import ENGLISH_KINDS, ROMANIZED_KINDS, load_split
from .. import MAX_CANDIDATES_PER_SPAN
from ..infrastructure.deterministic_generator import DeterministicCandidateGenerator
from ..infrastructure.deterministic_ranker import DeterministicCandidateRanker
from ..infrastructure.english_identity_guard import apply_english_identity_guard
from ..infrastructure.resource_repository import load_resources
from ..infrastructure.r3d_safety_gate import span_is_protected
from .transliteration_service import attach_transliteration_to_frame
from ..infrastructure.r3d_safety_gate import count_protected_mutations


def _rank_pair(text: str, case: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    """Return (unguarded_ranked, guarded_ranked, surface) for primary token."""
    res = load_resources()
    frame = analyze_language(text)
    primary = (case.get("primary_token") or text.split()[0]).lower()
    gen = DeterministicCandidateGenerator(res)
    ranker = DeterministicCandidateRanker(res)
    prot = sorted((s.start_offset, s.end_offset) for s in frame.protected_spans)
    for idx, ann in enumerate(frame.span_annotations):
        if ann.original_text.lower() != primary:
            continue
        form = ann.language_form
        surface = ann.original_text
        name_like = form == "NAMED_ENTITY_CANDIDATE" or surface.lower() in res.name_like
        is_prot = span_is_protected(
            start=ann.start_offset,
            end=ann.end_offset,
            protected_reason=getattr(ann, "protected_reason", None),
            protected_ranges=prot,
        )
        if is_prot:
            row = [{"surface": surface, "is_identity": True, "rank": 1}]
            return row, row, surface
        low = surface.lower()
        morph_stem = None
        if low.isalpha():
            for suf in sorted(res.morphology.keys(), key=len, reverse=True):
                if low.endswith(suf) and len(low) > len(suf) + 1:
                    stem = low[: -len(suf)]
                    if (stem in res.lexicon or stem in res.domain_terms) and stem not in res.english_identity:
                        morph_stem = stem
                        break
        strong_romanized = (
            ((low in res.lexicon or low in res.domain_terms) or morph_stem is not None)
            and low not in res.english_identity
        )
        prefer_identity = low in res.english_identity or name_like or (
            form in {"ENGLISH", "TECHNICAL_ACCOUNTING_ENGLISH"} and not strong_romanized
        )
        if strong_romanized or (form == "ROMANIZED_NEPALI" and low not in res.english_identity):
            prefer_identity = False
        tokens = [s.original_text for s in frame.span_annotations]
        left: list[str] = []
        right: list[str] = []
        for j in range(idx - 1, -1, -1):
            if tokens[j].strip():
                left.append(tokens[j])
                if len(left) >= 3:
                    break
        for j in range(idx + 1, len(tokens)):
            if tokens[j].strip():
                right.append(tokens[j])
                if len(right) >= 3:
                    break
        neighbors = tuple(list(reversed(left)) + right)
        generated = gen.generate(
            surface,
            language_form=form,
            neighbors=neighbors,
            use_context=True,
            name_like=name_like,
        )
        ranked = ranker.rank(
            generated,
            surface=surface,
            language_form=form,
            neighbors=neighbors,
            use_context=True,
            prefer_identity=prefer_identity,
            name_like=name_like,
            max_candidates=MAX_CANDIDATES_PER_SPAN,
        )
        guarded, _, _ = apply_english_identity_guard(
            ranked,
            surface=surface,
            language_form=form,
            neighbors=neighbors,
            resources=res,
            name_like=name_like,
            is_protected=False,
        )
        base = [{"surface": c.surface, "is_identity": c.is_identity, "rank": c.rank} for c in ranked]
        g = [{"surface": c.surface, "is_identity": c.is_identity, "rank": c.rank} for c in guarded]
        return base, g, surface
    return [], [], ""


def run_differential(
    split: str = "DEVELOPMENT",
    *,
    cases: list[dict[str, Any]] | None = None,
    r3f_preds: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    del r3f_preds  # harm measured on guard vs unguarded ranker; preds unused
    cases = cases or load_split(split)

    english_identity_harm = 0
    romanized_target_top1_harm = 0
    target_recall_at_5_harm = 0
    proper_name_harm = 0
    protected_harm = 0
    set_mismatch = 0
    records: list[dict[str, Any]] = []

    for case in cases:
        text = case["input_text"]
        base, guarded, _source = _rank_pair(text, case)
        targets = set(case.get("acceptable_devanagari_targets") or [])
        kind = case.get("suite_kind", "")
        identity_exp = bool(case.get("identity_expected"))

        base_top_id = bool(base and base[0].get("is_identity"))
        g_top_id = bool(guarded and guarded[0].get("is_identity"))
        base_t1 = any((not x["is_identity"]) and x["surface"] in targets for x in base[:1]) if targets else False
        g_t1 = any((not x["is_identity"]) and x["surface"] in targets for x in guarded[:1]) if targets else False
        base_r5 = any((not x["is_identity"]) and x["surface"] in targets for x in base[:5]) if targets else False
        g_r5 = any((not x["is_identity"]) and x["surface"] in targets for x in guarded[:5]) if targets else False

        if sorted(x["surface"] for x in base) != sorted(x["surface"] for x in guarded):
            set_mismatch += 1

        harm = False
        if identity_exp or kind in ENGLISH_KINDS:
            if base_top_id and not g_top_id:
                english_identity_harm += 1
                harm = True
        if kind in ROMANIZED_KINDS and targets and not identity_exp:
            if base_t1 and not g_t1:
                romanized_target_top1_harm += 1
                harm = True
            if base_r5 and not g_r5:
                target_recall_at_5_harm += 1
                harm = True
        if kind == "proper_name" and base_top_id and not g_top_id:
            proper_name_harm += 1
            harm = True
        if kind.startswith("protected") or case.get("is_protected"):
            frame = analyze_language(text)
            bundle = attach_transliteration_to_frame(frame, use_context=True).transliteration_bundle
            assert bundle is not None
            if count_protected_mutations(bundle.span_results) > 0:
                protected_harm += 1
                harm = True

        if harm:
            records.append(
                {
                    "case_id": case["case_id"],
                    "suite_kind": kind,
                    "base_top_identity": base_top_id,
                    "guarded_top_identity": g_top_id,
                    "base_target_top1": base_t1,
                    "guarded_target_top1": g_t1,
                }
            )

    preservation = 1.0 if set_mismatch == 0 else 0.0
    return {
        "split": split,
        "english_identity_harm": english_identity_harm,
        "romanized_target_top1_harm": romanized_target_top1_harm,
        "target_recall_at_5_harm": target_recall_at_5_harm,
        "proper_name_harm": proper_name_harm,
        "protected_harm": protected_harm,
        "candidate_set_preservation": preservation,
        "candidate_set_mismatches": set_mismatch,
        "harm_records_sample": records[:20],
        "note": "Differential compares English Identity Guard reorder vs unguarded R3D generate+rank on non-frozen cases only.",
    }
