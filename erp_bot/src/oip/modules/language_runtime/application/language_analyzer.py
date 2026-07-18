"""Main language analyzer → LanguageFrameV1."""

from __future__ import annotations

import re
from collections import Counter

from ....contracts.common import ConfidenceV1, SourceSpanV1
from ....contracts.language import AnalysisStatus, LanguageFrameV1, SpanAnnotationV1
from .. import ANALYZER_VERSION, MAX_INPUT_CODEPOINTS, MAX_SPANS, OFFSET_UNIT
from ..domain.offsets import assert_span_roundtrip, covered_exactly
from ..domain.protected import detect_protected_spans
from ..domain.script import ScriptCategory, classify_char_script, detect_quality_flags
from ..domain.taxonomy import CodeMixPattern, LanguageForm, ProtectedKind
from ..infrastructure.compact_resource_repository import CompactResources, load_resources
from .language_form_classifier import classify_token

_TOKEN = re.compile(r"\S+|\s+", re.UNICODE)


def _dominant_script(text: str) -> ScriptCategory:
    counts: Counter[ScriptCategory] = Counter()
    for ch in text:
        counts[classify_char_script(ch)] += 1
    if set(counts) <= {ScriptCategory.WHITESPACE}:
        return ScriptCategory.WHITESPACE
    for ignore in (ScriptCategory.WHITESPACE,):
        counts.pop(ignore, None)
    if not counts:
        return ScriptCategory.WHITESPACE
    top = counts.most_common(2)
    letterish = [s for s, c in counts.items() if s in {ScriptCategory.LATIN, ScriptCategory.DEVANAGARI} and c > 0]
    if len(letterish) > 1:
        return ScriptCategory.MIXED
    return top[0][0]


def _code_mix(forms: Counter[str], protected_n: int, total_lang: int) -> CodeMixPattern:
    if total_lang == 0:
        return CodeMixPattern.MOSTLY_IDENTIFIERS if protected_n else CodeMixPattern.UNKNOWN
    has_en = forms.get(LanguageForm.ENGLISH.value, 0) + forms.get(LanguageForm.TECHNICAL_ACCOUNTING_ENGLISH.value, 0)
    has_rom = forms.get(LanguageForm.ROMANIZED_NEPALI.value, 0)
    has_dev = forms.get(LanguageForm.NEPALI_DEVANAGARI.value, 0)
    amb = forms.get(LanguageForm.SHARED_OR_AMBIGUOUS_LATIN.value, 0)
    if amb / max(1, total_lang) > 0.45:
        return CodeMixPattern.AMBIGUOUS
    present = sum(1 for x in (has_en > 0, has_rom > 0, has_dev > 0) if x)
    if present == 3:
        return CodeMixPattern.THREE_WAY_MIX
    if has_en and has_rom and not has_dev:
        return CodeMixPattern.ENGLISH_ROMANIZED
    if has_en and has_dev and not has_rom:
        return CodeMixPattern.ENGLISH_DEVANAGARI
    if has_dev and has_rom and not has_en:
        return CodeMixPattern.DEVANAGARI_ROMANIZED
    if has_en and not has_rom and not has_dev:
        return CodeMixPattern.ENGLISH_ONLY
    if has_dev and not has_en and not has_rom:
        return CodeMixPattern.NEPALI_DEVANAGARI_ONLY
    if has_rom and not has_en and not has_dev:
        return CodeMixPattern.ROMANIZED_NEPALI_ONLY
    return CodeMixPattern.UNKNOWN


def analyze_language(
    raw_text: str,
    *,
    resources: CompactResources | None = None,
) -> LanguageFrameV1:
    """Populate LanguageFrameV1 without mutating raw_text."""
    original = raw_text
    if len(original) > MAX_INPUT_CODEPOINTS:
        # Observe only — do not rewrite; flag and analyze prefix for safety bounds
        quality = detect_quality_flags(original) + ["EXCESSIVE_LENGTH"]
        return LanguageFrameV1(
            analysis_status=AnalysisStatus.PARTIAL,
            raw_text=original,
            unicode_normalized_view=None,
            span_annotations=(),
            input_quality_flags=tuple(dict.fromkeys(quality)),
            analyzer_versions={"language_analyzer": ANALYZER_VERSION},
            warnings=("INPUT_TRUNCATED_FOR_ANALYSIS_BOUNDS",),
            offset_unit=OFFSET_UNIT,
        )

    try:
        res = resources or load_resources()
        quality = detect_quality_flags(original)
        protected = detect_protected_spans(original)
        occupied = set()
        for p in protected:
            occupied.update(range(p.start, p.end))

        annotations: list[SpanAnnotationV1] = []
        protected_sources: list[SourceSpanV1] = []
        kind_list: list[str] = []

        # Emit protected spans first (atomic)
        for p in protected:
            assert_span_roundtrip(original, p.start, p.end, p.surface)
            form = LanguageForm.IDENTIFIER_OR_CODE
            if p.kind in {
                ProtectedKind.NUMBER_LITERAL,
                ProtectedKind.DECIMAL_LITERAL,
                ProtectedKind.PERCENT_LITERAL,
                ProtectedKind.MONEY_LITERAL,
                ProtectedKind.DATE_LITERAL,
                ProtectedKind.FISCAL_YEAR_LITERAL,
                ProtectedKind.TIME_LITERAL,
            }:
                form = LanguageForm.NUMERIC
            annotations.append(
                SpanAnnotationV1(
                    start_offset=p.start,
                    end_offset=p.end,
                    original_text=p.surface,
                    script=_dominant_script(p.surface).value,
                    language_form=form.value,
                    confidence=ConfidenceV1(value=1.0, method="protected_span", grants_authority=False),
                    protected_reason=p.kind.value,
                    offset_unit=OFFSET_UNIT,
                )
            )
            protected_sources.append(
                SourceSpanV1(
                    start_offset=p.start,
                    end_offset=p.end,
                    original_text=p.surface,
                    offset_unit=OFFSET_UNIT,
                )
            )
            kind_list.append(p.kind.value)

        # Tokenize remaining uncovered ranges
        for m in _TOKEN.finditer(original):
            start, end = m.start(), m.end()
            if any(i in occupied for i in range(start, end)):
                # skip wholly covered; split leftovers if partial overlap
                if all(i in occupied for i in range(start, end)):
                    continue
                # rare: token partially covered — emit uncovered subranges only
                i = start
                while i < end:
                    if i in occupied:
                        i += 1
                        continue
                    j = i
                    while j < end and j not in occupied:
                        j += 1
                    _emit_token(original, i, j, annotations, res)
                    i = j
                continue
            _emit_token(original, start, end, annotations, res)
            if len(annotations) >= MAX_SPANS:
                break

        annotations.sort(key=lambda a: a.start_offset)
        # Validate coverage / no overlap of base spans
        spans = [(a.start_offset, a.end_offset) for a in annotations]
        if not covered_exactly(original, spans):
            # Fill gaps explicitly as UNKNOWN rather than fail closed into purchase
            filled = _fill_gaps(original, annotations)
            annotations = filled

        form_counts: Counter[str] = Counter()
        for a in annotations:
            if a.language_form in {
                LanguageForm.PUNCTUATION_OR_SYMBOL.value,
                LanguageForm.NUMERIC.value,
                LanguageForm.IDENTIFIER_OR_CODE.value,
            }:
                continue
            if a.protected_reason:
                continue
            # weight by code points
            form_counts[a.language_form] += max(1, a.end_offset - a.start_offset)

        total = sum(form_counts.values()) or 1
        distribution = {k: round(v / total, 4) for k, v in form_counts.items()}
        amb_flags = tuple(
            sorted(
                {
                    a.language_form
                    for a in annotations
                    if a.language_form == LanguageForm.SHARED_OR_AMBIGUOUS_LATIN.value
                }
            )
        )
        if amb_flags:
            quality = list(quality) + ["AMBIGUOUS_LATIN_PRESENT"]

        pattern = _code_mix(form_counts, len(protected), sum(form_counts.values()))
        # Dominant response language deferred — leave None when ambiguous
        dominant = None
        if pattern not in {CodeMixPattern.AMBIGUOUS, CodeMixPattern.THREE_WAY_MIX, CodeMixPattern.UNKNOWN}:
            if form_counts:
                top_form, top_n = form_counts.most_common(1)[0]
                if top_n / total >= 0.6:
                    dominant = top_form

        # Prove raw text unchanged
        if original != raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")

        return LanguageFrameV1(
            analysis_status=AnalysisStatus.COMPLETE,
            raw_text=raw_text,
            unicode_normalized_view=None,  # MAI-06 territory — observation only
            span_annotations=tuple(annotations),
            language_distribution=distribution,
            dominant_response_language=None,  # deferred to MAI-11
            code_mix_pattern=pattern.value,
            transliteration_candidates=(),
            normalization_edits=(),
            protected_spans=tuple(protected_sources),
            ambiguity_flags=amb_flags,
            analyzer_versions={
                "language_analyzer": ANALYZER_VERSION,
                "resource_pack": res.version,
                "classifier": "mai-05.1.0-deterministic",
            },
            warnings=(),
            offset_unit=OFFSET_UNIT,
            input_quality_flags=tuple(dict.fromkeys(quality)),
            protected_span_kinds=tuple(dict.fromkeys(kind_list)),
        )
    except Exception as exc:  # noqa: BLE001 — fail safe, never route to purchase
        return LanguageFrameV1(
            analysis_status=AnalysisStatus.FAILED,
            raw_text=raw_text,
            span_annotations=(),
            analyzer_versions={"language_analyzer": ANALYZER_VERSION},
            warnings=(f"LANGUAGE_ANALYSIS_FAILED:{type(exc).__name__}",),
            offset_unit=OFFSET_UNIT,
            input_quality_flags=tuple(detect_quality_flags(raw_text)),
        )


def _emit_token(
    text: str,
    start: int,
    end: int,
    annotations: list[SpanAnnotationV1],
    res: CompactResources,
) -> None:
    if start >= end:
        return
    surface = text[start:end]
    assert_span_roundtrip(text, start, end, surface)
    script = _dominant_script(surface)
    decision = classify_token(surface, script=script, resources=res)
    annotations.append(
        SpanAnnotationV1(
            start_offset=start,
            end_offset=end,
            original_text=surface,
            script=script.value,
            language_form=decision.form.value,
            confidence=ConfidenceV1(
                value=float(decision.confidence),
                method="deterministic_lexicon",
                grants_authority=False,
            ),
            protected_reason=None,
            offset_unit=OFFSET_UNIT,
        )
    )


def _fill_gaps(text: str, annotations: list[SpanAnnotationV1]) -> list[SpanAnnotationV1]:
    ordered = sorted(annotations, key=lambda a: a.start_offset)
    out: list[SpanAnnotationV1] = []
    cursor = 0
    for a in ordered:
        if a.start_offset < cursor:
            # overlap — skip lower (should not happen)
            continue
        if a.start_offset > cursor:
            gap = text[cursor : a.start_offset]
            out.append(
                SpanAnnotationV1(
                    start_offset=cursor,
                    end_offset=a.start_offset,
                    original_text=gap,
                    script=_dominant_script(gap).value,
                    language_form=LanguageForm.UNKNOWN.value,
                    offset_unit=OFFSET_UNIT,
                )
            )
        out.append(a)
        cursor = a.end_offset
    if cursor < len(text):
        gap = text[cursor:]
        out.append(
            SpanAnnotationV1(
                start_offset=cursor,
                end_offset=len(text),
                original_text=gap,
                script=_dominant_script(gap).value,
                language_form=LanguageForm.UNKNOWN.value,
                offset_unit=OFFSET_UNIT,
            )
        )
    return out
