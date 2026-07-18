"""MAI-07 candidate transliteration service — annotation only; never mutates raw."""

from __future__ import annotations

import hashlib
from typing import Iterable

from .....contracts.common import SourceSpanV1
from .....contracts.language import LanguageFrameV1
from .....contracts.transliteration import (
    CalibrationStatus,
    CandidateKind,
    CandidateScript,
    EligibilityDecision,
    TransliterationBundleV1,
    TransliterationCandidateV1,
    TransliterationHypothesisV1,
    TransliterationSpanV1,
    TransliterationStatus,
    UncertaintyClass,
)
from ...domain.taxonomy import LanguageForm
from .. import (
    ENABLE_PROMOTION_OVERLAY,
    MAX_CANDIDATES_PER_SPAN,
    MAX_ELIGIBLE_SPANS,
    MAX_HYPOTHESES,
    MAX_SPAN_CODEPOINTS,
    MAX_TOTAL_CANDIDATES,
    OFFSET_UNIT,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from ..domain.alignment import identity_alignment
from ..infrastructure.deterministic_generator import DeterministicCandidateGenerator
from ..infrastructure.deterministic_ranker import DeterministicCandidateRanker
from ..infrastructure.resource_repository import CompactXlResources, load_resources
from ..infrastructure.r3d_safety_gate import (
    force_protected_span_result,
    make_raw_span,
    sanitize_span_if_protected,
    span_is_protected,
)
from ..infrastructure.english_identity_guard import apply_english_identity_guard
from ..infrastructure.target_promotion_overlay import TargetPromotionOverlay

_PROTECTED_FORMS = frozenset(
    {
        LanguageForm.IDENTIFIER_OR_CODE.value,
        LanguageForm.NUMERIC.value,
        LanguageForm.PUNCTUATION_OR_SYMBOL.value,
    }
)


def _finalize_candidates(
    ranked: list[TransliterationCandidateV1],
    *,
    max_candidates: int,
) -> tuple[list[TransliterationCandidateV1], bool]:
    if not ranked:
        return [], False
    capped = list(ranked[:max_candidates])
    ident = next((c for c in ranked if c.is_identity), None)
    if ident is not None and not any(c.candidate_id == ident.candidate_id for c in capped):
        capped = capped[: max_candidates - 1] + [ident]
    if not any((not c.is_identity) and c.script == CandidateScript.DEVANAGARI for c in capped):
        dev = next((c for c in ranked if (not c.is_identity) and c.script == CandidateScript.DEVANAGARI), None)
        if dev is not None:
            if len(capped) >= max_candidates:
                capped = capped[: max_candidates - 1] + [dev]
            else:
                capped.append(dev)
    capped = sorted(capped, key=lambda c: (c.rank, c.candidate_id))
    out: list[TransliterationCandidateV1] = []
    for i, c in enumerate(capped, start=1):
        out.append(c.model_copy(update={"rank": i}))
    return out, len(ranked) > len(out)


def _sid(*parts: str) -> str:
    return "xls_" + hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]


def _hid(*parts: str) -> str:
    return "xlh_" + hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:12]


def _overlap(a0: int, a1: int, b0: int, b1: int) -> bool:
    return a0 < b1 and b0 < a1


def _protected_ranges(spans: Iterable[SourceSpanV1]) -> list[tuple[int, int]]:
    return sorted((s.start_offset, s.end_offset) for s in spans)


def _morph_stem_evidence(surface: str, resources: CompactXlResources) -> str | None:
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


def _eligibility(
    form: str,
    *,
    protected: bool,
    too_long: bool,
    security: bool,
    surface: str,
    resources: CompactXlResources,
) -> tuple[EligibilityDecision, tuple[str, ...]]:
    if security:
        return EligibilityDecision.SKIPPED_SECURITY, ("SECURITY_SENSITIVE",)
    if protected:
        return EligibilityDecision.SKIPPED_PROTECTED, ("PROTECTED_SPAN",)
    if too_long:
        return EligibilityDecision.SKIPPED_TOO_LONG, ("SPAN_TOO_LONG",)
    if form in {
        LanguageForm.NEPALI_DEVANAGARI.value,
        LanguageForm.NUMERIC.value,
        LanguageForm.PUNCTUATION_OR_SYMBOL.value,
        LanguageForm.IDENTIFIER_OR_CODE.value,
    }:
        return EligibilityDecision.IDENTITY_ONLY, ("FORM_IDENTITY_ONLY",)
    low = surface.lower()
    shared_collision = low in resources.english_identity and (
        low in resources.lexicon or low in resources.domain_terms
    )
    # MAI-07R3H2: shared collision surfaces must GENERATE so Nepali-context /
    # ambiguous retention can keep optional Devanagari alternatives under cap.
    if shared_collision and form not in {
        LanguageForm.IDENTIFIER_OR_CODE.value,
        LanguageForm.NUMERIC.value,
        LanguageForm.PUNCTUATION_OR_SYMBOL.value,
    }:
        return EligibilityDecision.GENERATE, ("SHARED_COLLISION_GENERATE",)
    if form in {LanguageForm.ENGLISH.value, LanguageForm.TECHNICAL_ACCOUNTING_ENGLISH.value}:
        # Multi-signal English identity (Option A): resource membership is high-confidence.
        # MAI-05 ENGLISH form alone is NOT absolute — lexicon may still be Romanized evidence.
        if low in resources.english_identity:
            return EligibilityDecision.IDENTITY_ONLY, ("ENGLISH_IDENTITY_RESOURCE",)
        if surface.isupper() and surface.isalpha() and 2 <= len(surface) <= 6:
            return EligibilityDecision.IDENTITY_ONLY, ("ACRONYM_IDENTITY",)
        if low in resources.lexicon or low in resources.domain_terms:
            # Optional Devanagari may be generated; ranker keeps identity first when English-form.
            return EligibilityDecision.GENERATE, ("ENGLISH_FORM_WITH_VARIANT_EVIDENCE",)
        if _morph_stem_evidence(surface, resources):
            return EligibilityDecision.GENERATE, ("ENGLISH_FORM_WITH_MORPH_EVIDENCE",)
        return EligibilityDecision.IDENTITY_ONLY, ("ENGLISH_IDENTITY",)
    if form == LanguageForm.SHARED_OR_AMBIGUOUS_LATIN.value:
        if low in resources.english_identity:
            return EligibilityDecision.IDENTITY_ONLY, ("ENGLISH_IDENTITY_RESOURCE",)
        if low in resources.name_like:
            return EligibilityDecision.GENERATE, ("NAME_LIKE_SURFACE",)
        if low in resources.lexicon or low in resources.domain_terms:
            return EligibilityDecision.GENERATE, ("AMBIGUOUS_WITH_LEXICAL_EVIDENCE",)
        return EligibilityDecision.ABSTAIN, ("AMBIGUOUS_ABSTAIN",)
    if form == LanguageForm.NAMED_ENTITY_CANDIDATE.value:
        return EligibilityDecision.GENERATE, ("NAME_LIKE_CONSERVATIVE",)
    if form == LanguageForm.ROMANIZED_NEPALI.value:
        return EligibilityDecision.GENERATE, ("ROMANIZED_ELIGIBLE",)
    if form == LanguageForm.UNKNOWN.value:
        return EligibilityDecision.SKIPPED_UNSUPPORTED, ("UNKNOWN_FORM",)
    return EligibilityDecision.SKIPPED_UNSUPPORTED, ("UNSUPPORTED_FORM",)


def transliterate_frame(
    frame: LanguageFrameV1,
    *,
    resources: CompactXlResources | None = None,
    use_context: bool = True,
    finalize_candidates_fn=None,
) -> TransliterationBundleV1:
    """Build TransliterationBundleV1 from MAI-05 spans. Never mutates raw_text.

    ``finalize_candidates_fn`` is optional. Default uses ``_finalize_candidates``
    (active R3F / R3N2 authority). R3N3 passes its reserved-identity finalizer.
    """
    raw = frame.raw_text
    try:
        res = resources or load_resources()
        gen = DeterministicCandidateGenerator(res)
        ranker = DeterministicCandidateRanker(res)
        # MAI-07R3A: R2 overlay is disabled by default and requires an explicit pack config.
        overlay = None
        if ENABLE_PROMOTION_OVERLAY and getattr(res, "promotion_overlay_config", None):
            overlay = TargetPromotionOverlay(res)
        prot = _protected_ranges(frame.protected_spans)
        security = any("BIDI" in f or "CONTROL" in f or "ZERO_WIDTH" in f for f in frame.input_quality_flags)

        # Neighbor tokens from span surfaces
        span_tokens = [s.original_text for s in frame.span_annotations]

        def _neighbors(i: int) -> tuple[str, ...]:
            # Bounded sentence window for R3F multi-signal context (not only ±1).
            left: list[str] = []
            right: list[str] = []
            for j in range(i - 1, -1, -1):
                if span_tokens[j].strip():
                    left.append(span_tokens[j])
                    if len(left) >= 3:
                        break
            for j in range(i + 1, len(span_tokens)):
                if span_tokens[j].strip():
                    right.append(span_tokens[j])
                    if len(right) >= 3:
                        break
            return tuple(list(reversed(left)) + right)

        results: list[TransliterationSpanV1] = []
        total_cands = 0
        abstentions = 0
        truncated = 0
        identity_only = 0
        eligible_count = 0
        warnings: list[str] = []

        annotations = list(frame.span_annotations)
        if len(annotations) > MAX_ELIGIBLE_SPANS:
            warnings.append("ELIGIBLE_SPAN_CAP")
            truncated += 1
            annotations = annotations[:MAX_ELIGIBLE_SPANS]

        for idx, ann in enumerate(annotations):
            surface = ann.original_text
            form = ann.language_form
            # Pre-generation hard gate: any overlap with MAI-05 protected ranges → protected.
            is_prot = span_is_protected(
                start=ann.start_offset,
                end=ann.end_offset,
                protected_reason=getattr(ann, "protected_reason", None),
                protected_ranges=prot,
            )
            too_long = len(surface) > MAX_SPAN_CODEPOINTS
            name_like = form == LanguageForm.NAMED_ENTITY_CANDIDATE.value or surface.lower() in res.name_like
            decision, reasons = _eligibility(
                form,
                protected=is_prot,
                too_long=too_long,
                security=security and form == LanguageForm.UNKNOWN.value,
                surface=surface,
                resources=res,
            )

            neighbors = _neighbors(idx)

            span_id = _sid(str(ann.start_offset), str(ann.end_offset), surface)
            raw_span = make_raw_span(surface, ann.start_offset, ann.end_offset)

            # Structural: never generate over protected content.
            if is_prot:
                identity_only += 1
                results.append(
                    force_protected_span_result(
                        span_id=span_id,
                        raw_span=raw_span,
                        form=form,
                        surface=surface,
                        name_like=name_like,
                        decision=EligibilityDecision.SKIPPED_PROTECTED,
                        reasons=tuple(dict.fromkeys(reasons + ("PROTECTED_SPAN", "R3D_HARD_GATE"))),
                    )
                )
                total_cands += 1
                continue

            if decision in {
                EligibilityDecision.SKIPPED_PROTECTED,
                EligibilityDecision.SKIPPED_UNSUPPORTED,
                EligibilityDecision.SKIPPED_SECURITY,
                EligibilityDecision.SKIPPED_TOO_LONG,
                EligibilityDecision.IDENTITY_ONLY,
                EligibilityDecision.ABSTAIN,
            }:
                if decision is EligibilityDecision.ABSTAIN:
                    abstentions += 1
                if decision is EligibilityDecision.IDENTITY_ONLY:
                    identity_only += 1
                ident = TransliterationCandidateV1(
                    candidate_id=_sid("id", surface, str(ann.start_offset)),
                    surface=surface,
                    script=CandidateScript.LATIN,
                    kind=(
                        CandidateKind.ABSTENTION
                        if decision is EligibilityDecision.ABSTAIN
                        else CandidateKind.IDENTITY
                    ),
                    rank=1,
                    ranking_score=1.0,
                    uncertainty_class=(
                        UncertaintyClass.ABSTAIN
                        if decision is EligibilityDecision.ABSTAIN
                        else UncertaintyClass.HIGH_EVIDENCE
                    ),
                    calibration_status=CalibrationStatus.UNCALIBRATED,
                    alignment=identity_alignment(surface),
                    is_identity=True,
                    requires_review=decision is EligibilityDecision.ABSTAIN or name_like,
                    reason_codes=reasons,
                    provenance=("identity",),
                )
                # MAI-07R3H2: identity-only / skipped paths still record span disposition
                # so review/policy metadata is not lost when generation is skipped.
                guarded, _id_disp, _id_signals = apply_english_identity_guard(
                    [ident],
                    surface=surface,
                    language_form=form,
                    neighbors=neighbors,
                    resources=res,
                    name_like=name_like,
                    is_protected=False,
                )
                id_review = bool(_id_signals.get("review_required"))
                id_review_codes = tuple(_id_signals.get("review_reason_codes") or ())
                if id_review and guarded and guarded[0].is_identity and not guarded[0].requires_review:
                    guarded = [
                        guarded[0].model_copy(
                            update={
                                "requires_review": True,
                                "reason_codes": tuple(
                                    dict.fromkeys(tuple(guarded[0].reason_codes) + ("R3H2_REVIEW_REQUIRED",))
                                ),
                            }
                        )
                    ]
                results.append(
                    TransliterationSpanV1(
                        span_id=span_id,
                        raw_span=raw_span,
                        source_language_form=form,
                        eligibility=decision,
                        decision_reason_codes=tuple(
                            dict.fromkeys(
                                tuple(reasons)
                                + ((_id_signals.get("reorder_reason"),) if _id_signals.get("reorder_reason") else ())
                                + id_review_codes
                            )
                        ),
                        candidates=tuple(guarded),
                        identity_candidate_id=guarded[0].candidate_id if guarded else ident.candidate_id,
                        is_protected=False,
                        is_ambiguous=id_review or decision is EligibilityDecision.ABSTAIN,
                        is_name_like=name_like,
                        review_required=id_review,
                        review_reason_codes=id_review_codes,
                        disposition=_id_disp.value,
                        policy_version=str(_id_signals.get("policy_version") or ""),
                    )
                )
                total_cands += 1
                continue

            eligible_count += 1
            if total_cands >= MAX_TOTAL_CANDIDATES:
                truncated += 1
                warnings.append("TOTAL_CANDIDATE_CAP")
                results.append(
                    TransliterationSpanV1(
                        span_id=span_id,
                        raw_span=raw_span,
                        source_language_form=form,
                        eligibility=EligibilityDecision.ABSTAIN,
                        decision_reason_codes=("TRUNCATED_CAP",),
                        candidates=(),
                        truncated=True,
                        is_name_like=name_like,
                    )
                )
                abstentions += 1
                continue

            low = surface.lower()
            morph_stem = _morph_stem_evidence(surface, res)
            strong_romanized = (
                ((low in res.lexicon or low in res.domain_terms) or morph_stem is not None)
                and low not in res.english_identity
            )
            prefer_identity = (
                low in res.english_identity
                or name_like
                or (
                    form
                    in {
                        LanguageForm.ENGLISH.value,
                        LanguageForm.TECHNICAL_ACCOUNTING_ENGLISH.value,
                    }
                    and not strong_romanized
                )
            )
            # Never demote strong Romanized lexicon/morph evidence via English-form preference.
            if strong_romanized or (
                form == LanguageForm.ROMANIZED_NEPALI.value and low not in res.english_identity
            ):
                prefer_identity = False

            generated = gen.generate(
                surface,
                language_form=form,
                neighbors=neighbors,
                use_context=use_context,
                name_like=name_like,
            )
            ranked = ranker.rank(
                generated,
                surface=surface,
                language_form=form,
                neighbors=neighbors,
                use_context=use_context,
                prefer_identity=prefer_identity,
                name_like=name_like,
                max_candidates=max(MAX_CANDIDATES_PER_SPAN * 3, 12),
            )
            if overlay is not None:
                ranked, _overlay_decision, _overlay_reasons = overlay.apply(
                    ranked,
                    surface=surface,
                    language_form=form,
                    neighbors=neighbors,
                    name_like=name_like,
                    prefer_identity=prefer_identity,
                    is_protected=is_prot,
                    is_security=security and form == LanguageForm.UNKNOWN.value,
                )
            # MAI-07R3H2: identity disposition (reorder only; before finalize/cap).
            ranked, _r3f_disp, _r3f_signals = apply_english_identity_guard(
                ranked,
                surface=surface,
                language_form=form,
                neighbors=neighbors,
                resources=res,
                name_like=name_like,
                is_protected=False,
            )
            pre_cap_surfaces = [c.surface for c in ranked]
            _finalize = finalize_candidates_fn or _finalize_candidates
            ranked, span_truncated = _finalize(
                ranked,
                max_candidates=MAX_CANDIDATES_PER_SPAN,
            )
            if not ranked:
                abstentions += 1
                results.append(
                    TransliterationSpanV1(
                        span_id=span_id,
                        raw_span=raw_span,
                        source_language_form=form,
                        eligibility=EligibilityDecision.ABSTAIN,
                        decision_reason_codes=("NO_CANDIDATES",),
                        candidates=(),
                        is_ambiguous=True,
                        is_name_like=name_like,
                        review_required=False,
                        disposition=_r3f_disp.value,
                        policy_version=str(_r3f_signals.get("policy_version") or ""),
                    )
                )
                continue

            id_ref = next((c.candidate_id for c in ranked if c.is_identity), ranked[0].candidate_id)
            if span_truncated:
                truncated += 1
            review_required = bool(_r3f_signals.get("review_required"))
            review_reasons = tuple(_r3f_signals.get("review_reason_codes") or ())
            if review_required and ranked and ranked[0].is_identity and not ranked[0].requires_review:
                ranked = [
                    (
                        ranked[0].model_copy(
                            update={
                                "requires_review": True,
                                "reason_codes": tuple(
                                    dict.fromkeys(tuple(ranked[0].reason_codes) + ("R3H2_REVIEW_REQUIRED",))
                                ),
                            }
                        )
                    ),
                    *ranked[1:],
                ]
            results.append(
                TransliterationSpanV1(
                    span_id=span_id,
                    raw_span=raw_span,
                    source_language_form=form,
                    eligibility=decision,
                    decision_reason_codes=tuple(
                        dict.fromkeys(
                            tuple(reasons)
                            + ((_r3f_signals.get("reorder_reason"),) if _r3f_signals.get("reorder_reason") else ())
                            + review_reasons
                        )
                    ),
                    candidates=tuple(ranked),
                    identity_candidate_id=id_ref,
                    is_protected=False,
                    is_ambiguous=review_required
                    or any(c.uncertainty_class.value == "AMBIGUOUS" for c in ranked),
                    is_name_like=name_like,
                    truncated=span_truncated,
                    review_required=review_required,
                    review_reason_codes=review_reasons,
                    disposition=_r3f_disp.value,
                    policy_version=str(_r3f_signals.get("policy_version") or ""),
                )
            )
            # Internal evaluation-only role markers are not traced; surfaces omitted from traces.
            _ = pre_cap_surfaces
            total_cands += len(ranked)

        # Pre-serialize hard gate (fail closed on any protected leakage).
        results = [sanitize_span_if_protected(s) for s in results]

        # Hypotheses: top combinations over generated romanized spans (bounded);
        # never rewrite protected spans into hypothesis previews.
        gen_spans = [
            s
            for s in results
            if s.eligibility is EligibilityDecision.GENERATE and s.candidates and not s.is_protected
        ]
        hypotheses: list[TransliterationHypothesisV1] = []
        if gen_spans:
            # top-1 path
            refs = []
            preview_parts = []
            score = 0.0
            cursor = 0
            # rebuild full preview preserving gaps from raw via span order
            for s in results:
                # fill gap
                if s.raw_span.start_offset > cursor:
                    preview_parts.append(raw[cursor : s.raw_span.start_offset])
                if s.is_protected or s.eligibility is EligibilityDecision.SKIPPED_PROTECTED:
                    preview_parts.append(s.raw_span.original_text)
                else:
                    top = s.candidates[0] if s.candidates else None
                    if top is not None:
                        preview_parts.append(top.surface)
                        refs.append(top.candidate_id)
                        score += top.ranking_score
                    else:
                        preview_parts.append(s.raw_span.original_text)
                cursor = s.raw_span.end_offset
            if cursor < len(raw):
                preview_parts.append(raw[cursor:])
            hypotheses.append(
                TransliterationHypothesisV1(
                    hypothesis_id=_hid("top1", raw[:32]),
                    candidate_refs=tuple(refs),
                    preview_surface="".join(preview_parts),
                    aggregate_ranking_score=round(score, 6),
                    status="CANDIDATE_ONLY",
                    authoritative=False,
                )
            )
            # additional: swap in rank-2 for first ambiguous generate span
            for extra_i, s in enumerate(gen_spans[: MAX_HYPOTHESES - 1]):
                if len(s.candidates) < 2:
                    continue
                parts = []
                refs2 = []
                score2 = 0.0
                cursor = 0
                for sp in results:
                    if sp.raw_span.start_offset > cursor:
                        parts.append(raw[cursor : sp.raw_span.start_offset])
                    if sp.is_protected or sp.eligibility is EligibilityDecision.SKIPPED_PROTECTED:
                        parts.append(sp.raw_span.original_text)
                    else:
                        pick = (
                            sp.candidates[1]
                            if sp.span_id == s.span_id and len(sp.candidates) > 1
                            else (sp.candidates[0] if sp.candidates else None)
                        )
                        if pick is None:
                            parts.append(sp.raw_span.original_text)
                        else:
                            parts.append(pick.surface)
                            refs2.append(pick.candidate_id)
                            score2 += pick.ranking_score
                    cursor = sp.raw_span.end_offset
                if cursor < len(raw):
                    parts.append(raw[cursor:])
                hypotheses.append(
                    TransliterationHypothesisV1(
                        hypothesis_id=_hid("alt", str(extra_i), raw[:24]),
                        candidate_refs=tuple(refs2),
                        preview_surface="".join(parts),
                        aggregate_ranking_score=round(score2, 6),
                        status="CANDIDATE_ONLY",
                        authoritative=False,
                    )
                )
                if len(hypotheses) >= MAX_HYPOTHESES:
                    break

        status = TransliterationStatus.COMPLETE
        if warnings:
            status = TransliterationStatus.PARTIAL
        return TransliterationBundleV1(
            analysis_status=status,
            runtime_version=RUNTIME_VERSION,
            resource_version=res.version or RESOURCE_PACK_VERSION,
            resource_hash=res.content_hash,
            offset_unit=OFFSET_UNIT,
            source_authority="RAW",
            matching_view="RAW",
            span_results=tuple(results),
            hypotheses=tuple(hypotheses[:MAX_HYPOTHESES]),
            warnings=tuple(dict.fromkeys(warnings)),
            eligible_span_count=eligible_count,
            candidate_count=total_cands,
            abstention_count=abstentions,
            truncated_count=truncated,
            identity_only_count=identity_only,
            max_candidates_per_span=MAX_CANDIDATES_PER_SPAN,
            max_hypotheses=MAX_HYPOTHESES,
        )
    except Exception as exc:  # noqa: BLE001
        return TransliterationBundleV1(
            analysis_status=TransliterationStatus.FAILED,
            runtime_version=RUNTIME_VERSION,
            resource_version=RESOURCE_PACK_VERSION,
            offset_unit=OFFSET_UNIT,
            source_authority="RAW",
            matching_view="RAW",
            warnings=("TRANSLITERATION_FAILED", type(exc).__name__),
            error_codes=("TRANSLITERATION_FAILED",),
        )


def attach_transliteration_to_frame(
    frame: LanguageFrameV1,
    *,
    use_context: bool = True,
    resources: CompactXlResources | None = None,
) -> LanguageFrameV1:
    bundle = transliterate_frame(frame, resources=resources, use_context=use_context)
    if frame.raw_text != frame.raw_text:  # pragma: no cover
        raise RuntimeError("RAW_TEXT_MUTATION")
    versions = dict(frame.analyzer_versions or {})
    versions["transliteration"] = RUNTIME_VERSION
    versions["transliteration_resources"] = bundle.resource_version
    return frame.model_copy(
        update={
            "transliteration_bundle": bundle,
            # Keep legacy string tuple empty — typed bundle is the sole authority
            "transliteration_candidates": (),
            "analyzer_versions": versions,
        }
    )
