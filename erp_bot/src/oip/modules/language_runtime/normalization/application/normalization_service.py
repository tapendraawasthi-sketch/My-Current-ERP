"""Protection-aware lossless normalization service — MAI-06.

Produces named derived views with provenance. Never mutates raw text.
Does not transliterate. Does not feed views into intent automatically.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Iterable

from .....contracts.common import SourceSpanV1
from .....contracts.language import LanguageFrameV1
from .....contracts.normalization import (
    MappingKind,
    NormalizationBundleV1,
    NormalizationEditV1,
    NormalizationOperation,
    NormalizationStatus,
    NormalizationViewV1,
    ProtectedSpanInteraction,
    SafetyClass,
    ViewType,
)
from ... import MAX_INPUT_CODEPOINTS as LANG_MAX
from .. import MAX_EDITS, MAX_INPUT_CODEPOINTS, NORMALIZER_VERSION, OFFSET_UNIT, RESOURCE_PACK_VERSION
from ..domain.offset_ops import (
    Seg,
    build_map,
    identity_map,
    map_norm_span_to_raw,
    map_raw_span_to_norm,
    maps_cover_without_overlap,
)
from ..domain.integrity import applied_edits_for_view, build_reconstruction_integrity
from ..domain.reconstruction import (
    ReconstructionError,
    get_preserved_raw,
    reconstruct_from_view,
    validate_offset_map,
)
from ..infrastructure.norm_resource_repository import CompactNormResources, load_resources


def _attach_view_integrity(
    view: NormalizationViewV1,
    *,
    source_text: str,
    edits: list[NormalizationEditV1] | tuple[NormalizationEditV1, ...],
) -> NormalizationViewV1:
    applied = applied_edits_for_view(edits, view.view_type)
    integ = build_reconstruction_integrity(
        source_text=source_text,
        view_text=view.text,
        view_type=view.view_type,
        offset_map=view.offset_map,
        applied_edits=applied,
        normalizer_version=NORMALIZER_VERSION,
        offset_unit=OFFSET_UNIT,
    )
    return view.model_copy(update={"integrity": integ})

_DEV_DIGIT = str.maketrans("०१२३४५६७८९", "0123456789")
_TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:/[A-Za-z0-9]+)?|[^\sA-Za-z0-9]+|\s+", re.UNICODE)
_REP_RE = re.compile(r"(.)\1{2,}", re.UNICODE)


def _protected_ranges(spans: Iterable[SourceSpanV1]) -> list[tuple[int, int]]:
    ranges = sorted((s.start_offset, s.end_offset) for s in spans)
    if not ranges:
        return []
    merged: list[tuple[int, int]] = [ranges[0]]
    for a, b in ranges[1:]:
        la, lb = merged[-1]
        if a <= lb:
            merged[-1] = (la, max(lb, b))
        else:
            merged.append((a, b))
    return merged


def _is_protected(i: int, ranges: list[tuple[int, int]]) -> bool:
    for a, b in ranges:
        if a <= i < b:
            return True
        if i < a:
            return False
    return False


def _runs(n: int, ranges: list[tuple[int, int]]) -> list[tuple[int, int, bool]]:
    """Yield (start, end, protected) covering [0,n)."""
    if n == 0:
        return []
    out: list[tuple[int, int, bool]] = []
    i = 0
    while i < n:
        prot = _is_protected(i, ranges)
        j = i + 1
        while j < n and _is_protected(j, ranges) == prot:
            j += 1
        out.append((i, j, prot))
        i = j
    return out


def _edit(
    *,
    eid: str,
    raw: str,
    rs: int,
    re_: int,
    ns: int | None,
    ne: int | None,
    op: NormalizationOperation,
    orig: str,
    cand: str,
    safety: SafetyClass,
    views: tuple[ViewType, ...],
    rule_id: str,
    interaction: ProtectedSpanInteraction = ProtectedSpanInteraction.OUTSIDE_PROTECTED,
    reason: str = "",
    alts: tuple[str, ...] = (),
    reversible: bool = True,
) -> NormalizationEditV1:
    norm_span = None
    if ns is not None and ne is not None:
        norm_span = SourceSpanV1(
            start_offset=ns,
            end_offset=ne,
            original_text=cand,
            offset_unit=OFFSET_UNIT,
        )
    return NormalizationEditV1(
        edit_id=eid,
        raw_span=SourceSpanV1(
            start_offset=rs,
            end_offset=re_,
            original_text=orig,
            offset_unit=OFFSET_UNIT,
        ),
        normalized_span=norm_span,
        operation=op,
        original_surface=orig,
        candidate_surface=cand,
        safety_class=safety,
        applied_views=views,
        rule_id=rule_id,
        reversible=reversible,
        protected_span_interaction=interaction,
        reason_code=reason,
        alternatives=alts,
    )


def _nfc_segment(raw_seg: str, raw_start: int, norm_cursor: int, eid_prefix: str, counter: list[int]) -> tuple[str, list[Seg], list[NormalizationEditV1]]:
    """NFC a non-protected segment with many-to-one aware mapping."""
    nfc = unicodedata.normalize("NFC", raw_seg)
    segs: list[Seg] = []
    edits: list[NormalizationEditV1] = []
    if nfc == raw_seg:
        segs.append(
            Seg(raw_start, raw_start + len(raw_seg), norm_cursor, norm_cursor + len(nfc), MappingKind.IDENTITY)
        )
        return nfc, segs, edits
    # Walk combining sequences for local composition
    i = 0
    ns = norm_cursor
    # Prefer whole-segment map when lengths differ: treat as MANY_TO_ONE / ONE_TO_MANY block
    if len(nfc) != len(raw_seg):
        counter[0] += 1
        eid = f"{eid_prefix}{counter[0]}"
        kind = MappingKind.MANY_TO_ONE if len(nfc) < len(raw_seg) else MappingKind.ONE_TO_MANY
        segs.append(Seg(raw_start, raw_start + len(raw_seg), ns, ns + len(nfc), kind, eid))
        edits.append(
            _edit(
                eid=eid,
                raw=raw_seg,
                rs=raw_start,
                re_=raw_start + len(raw_seg),
                ns=ns,
                ne=ns + len(nfc),
                op=NormalizationOperation.UNICODE_NFC,
                orig=raw_seg,
                cand=nfc,
                safety=SafetyClass.SAFE_AUTOMATIC,
                views=(ViewType.UNICODE_CANONICAL,),
                rule_id="unicode_nfc",
                reason="NFC_COMPOSITION",
            )
        )
        return nfc, segs, edits
    # Same length but different — one-to-one replacements
    while i < len(raw_seg):
        if raw_seg[i] != nfc[i]:
            counter[0] += 1
            eid = f"{eid_prefix}{counter[0]}"
            segs.append(Seg(raw_start + i, raw_start + i + 1, ns + i, ns + i + 1, MappingKind.ONE_TO_ONE, eid))
            edits.append(
                _edit(
                    eid=eid,
                    raw=raw_seg,
                    rs=raw_start + i,
                    re_=raw_start + i + 1,
                    ns=ns + i,
                    ne=ns + i + 1,
                    op=NormalizationOperation.UNICODE_NFC,
                    orig=raw_seg[i],
                    cand=nfc[i],
                    safety=SafetyClass.SAFE_AUTOMATIC,
                    views=(ViewType.UNICODE_CANONICAL,),
                    rule_id="unicode_nfc",
                    reason="NFC_REPLACE",
                )
            )
        else:
            segs.append(Seg(raw_start + i, raw_start + i + 1, ns + i, ns + i + 1, MappingKind.IDENTITY))
        i += 1
    # Merge adjacent identity segs for compactness
    return nfc, segs, edits


def _build_protected_aware_transform(
    raw: str,
    ranges: list[tuple[int, int]],
    *,
    transform_unprotected,
    eid_prefix: str,
) -> tuple[str, list[Seg], list[NormalizationEditV1]]:
    out_parts: list[str] = []
    segs: list[Seg] = []
    edits: list[NormalizationEditV1] = []
    norm_cursor = 0
    counter = [0]
    for start, end, prot in _runs(len(raw), ranges):
        piece = raw[start:end]
        if prot:
            out_parts.append(piece)
            segs.append(Seg(start, end, norm_cursor, norm_cursor + len(piece), MappingKind.IDENTITY))
            norm_cursor += len(piece)
            continue
        text, piece_segs, piece_edits = transform_unprotected(piece, start, norm_cursor, eid_prefix, counter)
        out_parts.append(text)
        segs.extend(piece_segs)
        edits.extend(piece_edits)
        norm_cursor += len(text)
    return "".join(out_parts), segs, edits


def _ws_semantic_segment(raw_seg: str, raw_start: int, norm_cursor: int, eid_prefix: str, counter: list[int], res: CompactNormResources) -> tuple[str, list[Seg], list[NormalizationEditV1]]:
    segs: list[Seg] = []
    edits: list[NormalizationEditV1] = []
    out: list[str] = []
    i = 0
    ns = norm_cursor
    while i < len(raw_seg):
        ch = raw_seg[i]
        # CRLF
        if ch == "\r" and i + 1 < len(raw_seg) and raw_seg[i + 1] == "\n":
            counter[0] += 1
            eid = f"{eid_prefix}{counter[0]}"
            out.append("\n")
            segs.append(Seg(raw_start + i, raw_start + i + 2, ns, ns + 1, MappingKind.MANY_TO_ONE, eid))
            edits.append(
                _edit(
                    eid=eid,
                    raw=raw_seg,
                    rs=raw_start + i,
                    re_=raw_start + i + 2,
                    ns=ns,
                    ne=ns + 1,
                    op=NormalizationOperation.LINE_ENDING_STANDARDIZATION,
                    orig="\r\n",
                    cand="\n",
                    safety=SafetyClass.SAFE_AUTOMATIC,
                    views=(ViewType.SAFE_SEMANTIC,),
                    rule_id="line_ending_crlf",
                    reason="CRLF_TO_LF",
                )
            )
            ns += 1
            i += 2
            continue
        if ch == "\r":
            counter[0] += 1
            eid = f"{eid_prefix}{counter[0]}"
            out.append("\n")
            segs.append(Seg(raw_start + i, raw_start + i + 1, ns, ns + 1, MappingKind.ONE_TO_ONE, eid))
            edits.append(
                _edit(
                    eid=eid,
                    raw=raw_seg,
                    rs=raw_start + i,
                    re_=raw_start + i + 1,
                    ns=ns,
                    ne=ns + 1,
                    op=NormalizationOperation.LINE_ENDING_STANDARDIZATION,
                    orig="\r",
                    cand="\n",
                    safety=SafetyClass.SAFE_AUTOMATIC,
                    views=(ViewType.SAFE_SEMANTIC,),
                    rule_id="line_ending_cr",
                    reason="CR_TO_LF",
                )
            )
            ns += 1
            i += 1
            continue
        if ch in res.whitespace_map and ch not in "\n":
            repl = res.whitespace_map[ch]
            counter[0] += 1
            eid = f"{eid_prefix}{counter[0]}"
            out.append(repl)
            segs.append(Seg(raw_start + i, raw_start + i + 1, ns, ns + 1, MappingKind.ONE_TO_ONE, eid))
            edits.append(
                _edit(
                    eid=eid,
                    raw=raw_seg,
                    rs=raw_start + i,
                    re_=raw_start + i + 1,
                    ns=ns,
                    ne=ns + 1,
                    op=NormalizationOperation.WHITESPACE_CODEPOINT_STANDARDIZATION,
                    orig=ch,
                    cand=repl,
                    safety=SafetyClass.SAFE_AUTOMATIC,
                    views=(ViewType.SAFE_SEMANTIC,),
                    rule_id="whitespace_codepoint",
                    reason="SPACE_EQUIVALENCE",
                )
            )
            ns += 1
            i += 1
            continue
        out.append(ch)
        segs.append(Seg(raw_start + i, raw_start + i + 1, ns, ns + 1, MappingKind.IDENTITY))
        ns += 1
        i += 1
    return "".join(out), segs, edits


def _retrieval_segment(
    raw_seg: str,
    raw_start: int,
    norm_cursor: int,
    eid_prefix: str,
    counter: list[int],
    res: CompactNormResources,
) -> tuple[str, list[Seg], list[NormalizationEditV1]]:
    """Apply SAFE_SEMANTIC + retrieval casefold + digit equivalence + whitespace collapse."""
    # First semantic-ish transforms at char level (same as semantic) then casefold/digit + collapse
    text1, segs1, edits1 = _ws_semantic_segment(raw_seg, raw_start, norm_cursor, eid_prefix + "s", counter, res)
    # Map segs1 are relative to output of semantic; we need to transform text1 further with mapping from text1
    # Simpler approach: char-walk raw_seg with unified pipeline
    segs: list[Seg] = []
    edits: list[NormalizationEditV1] = []
    out: list[str] = []
    i = 0
    ns = norm_cursor
    # Use intermediate as local working buffer built from raw with same logic
    # Rebuild from raw for cleaner provenance
    buf: list[tuple[str, int, int, NormalizationEditV1 | None]] = []  # (out_ch, raw_s, raw_e, edit)

    while i < len(raw_seg):
        ch = raw_seg[i]
        if ch == "\r" and i + 1 < len(raw_seg) and raw_seg[i + 1] == "\n":
            counter[0] += 1
            eid = f"{eid_prefix}{counter[0]}"
            ed = _edit(
                eid=eid,
                raw=raw_seg,
                rs=raw_start + i,
                re_=raw_start + i + 2,
                ns=None,
                ne=None,
                op=NormalizationOperation.LINE_ENDING_STANDARDIZATION,
                orig="\r\n",
                cand="\n",
                safety=SafetyClass.SAFE_AUTOMATIC,
                views=(ViewType.RETRIEVAL,),
                rule_id="line_ending_crlf",
                reason="CRLF_TO_LF",
            )
            buf.append(("\n", raw_start + i, raw_start + i + 2, ed))
            i += 2
            continue
        if ch == "\r":
            counter[0] += 1
            eid = f"{eid_prefix}{counter[0]}"
            ed = _edit(
                eid=eid,
                raw=raw_seg,
                rs=raw_start + i,
                re_=raw_start + i + 1,
                ns=None,
                ne=None,
                op=NormalizationOperation.LINE_ENDING_STANDARDIZATION,
                orig="\r",
                cand="\n",
                safety=SafetyClass.SAFE_AUTOMATIC,
                views=(ViewType.RETRIEVAL,),
                rule_id="line_ending_cr",
                reason="CR_TO_LF",
            )
            buf.append(("\n", raw_start + i, raw_start + i + 1, ed))
            i += 1
            continue
        mapped = res.whitespace_map.get(ch, ch)
        if mapped != ch and ch not in "\n":
            counter[0] += 1
            eid = f"{eid_prefix}{counter[0]}"
            ed = _edit(
                eid=eid,
                raw=raw_seg,
                rs=raw_start + i,
                re_=raw_start + i + 1,
                ns=None,
                ne=None,
                op=NormalizationOperation.WHITESPACE_CODEPOINT_STANDARDIZATION,
                orig=ch,
                cand=mapped,
                safety=SafetyClass.SAFE_AUTOMATIC,
                views=(ViewType.RETRIEVAL,),
                rule_id="whitespace_codepoint",
                reason="SPACE_EQUIVALENCE",
            )
            buf.append((mapped, raw_start + i, raw_start + i + 1, ed))
            i += 1
            continue
        dig = res.digit_map.get(ch)
        if dig is not None:
            counter[0] += 1
            eid = f"{eid_prefix}{counter[0]}"
            ed = _edit(
                eid=eid,
                raw=raw_seg,
                rs=raw_start + i,
                re_=raw_start + i + 1,
                ns=None,
                ne=None,
                op=NormalizationOperation.ASCII_DEVANAGARI_DIGIT_EQUIVALENCE,
                orig=ch,
                cand=dig,
                safety=SafetyClass.RETRIEVAL_ONLY,
                views=(ViewType.RETRIEVAL,),
                rule_id="digit_devanagari_ascii",
                reason="DIGIT_SCRIPT_EQUIVALENCE",
            )
            buf.append((dig, raw_start + i, raw_start + i + 1, ed))
            i += 1
            continue
        # Latin casefold for letters
        if "A" <= ch <= "Z" or ch.isalpha():
            folded = ch.casefold()
            if folded != ch:
                counter[0] += 1
                eid = f"{eid_prefix}{counter[0]}"
                ed = _edit(
                    eid=eid,
                    raw=raw_seg,
                    rs=raw_start + i,
                    re_=raw_start + i + 1,
                    ns=None,
                    ne=None,
                    op=NormalizationOperation.LATIN_CASEFOLD,
                    orig=ch,
                    cand=folded,
                    safety=SafetyClass.RETRIEVAL_ONLY,
                    views=(ViewType.RETRIEVAL,),
                    rule_id="latin_casefold",
                    reason="CASEFOLD",
                )
                # casefold may be 1:many rare; handle length
                if len(folded) == 1:
                    buf.append((folded, raw_start + i, raw_start + i + 1, ed))
                else:
                    # ONE_TO_MANY as a single buffer atom (e.g. ß → ss)
                    buf.append((folded, raw_start + i, raw_start + i + 1, ed))
                i += 1
                continue
        buf.append((ch, raw_start + i, raw_start + i + 1, None))
        i += 1

    # Whitespace collapse on buf (ordinary spaces/newlines preserved as separators but collapse repeats of space)
    collapsed: list[tuple[str, int, int, NormalizationEditV1 | None]] = []
    j = 0
    while j < len(buf):
        ch, rs, re_, ed = buf[j]
        if ch == " ":
            run_end = j + 1
            while run_end < len(buf) and buf[run_end][0] == " ":
                run_end += 1
            if run_end - j > 1:
                counter[0] += 1
                eid = f"{eid_prefix}c{counter[0]}"
                raw_s = buf[j][1]
                raw_e = buf[run_end - 1][2]
                orig_surface = raw_seg[raw_s - raw_start : raw_e - raw_start]
                edc = _edit(
                    eid=eid,
                    raw=raw_seg,
                    rs=raw_s,
                    re_=raw_e,
                    ns=None,
                    ne=None,
                    op=NormalizationOperation.WHITESPACE_COLLAPSE,
                    orig=orig_surface,
                    cand=" ",
                    safety=SafetyClass.RETRIEVAL_ONLY,
                    views=(ViewType.RETRIEVAL,),
                    rule_id="whitespace_collapse",
                    reason="COLLAPSE_SPACES",
                )
                collapsed.append((" ", raw_s, raw_e, edc))
            else:
                collapsed.append(buf[j])
            j = run_end
            continue
        collapsed.append(buf[j])
        j += 1

    # Trim leading/trailing spaces — record as applied deletions (zero-width on normalized axis)
    leading: list[tuple[str, int, int, NormalizationEditV1 | None]] = []
    while collapsed and collapsed[0][0] == " ":
        leading.append(collapsed.pop(0))
    trailing: list[tuple[str, int, int, NormalizationEditV1 | None]] = []
    while collapsed and collapsed[-1][0] == " ":
        trailing.append(collapsed.pop())

    # Leading deletions at current norm_cursor
    for ch, rs, re_, ed in leading:
        counter[0] += 1
        eid = f"{eid_prefix}trimL{counter[0]}"
        # Exact original from raw_seg — not the already-transformed buffer char
        orig = raw_seg[rs - raw_start : re_ - raw_start]
        trim_ed = _edit(
            eid=eid,
            raw=raw_seg,
            rs=rs,
            re_=re_,
            ns=norm_cursor,
            ne=norm_cursor,
            op=NormalizationOperation.WHITESPACE_COLLAPSE,
            orig=orig,
            cand="",
            safety=SafetyClass.RETRIEVAL_ONLY,
            views=(ViewType.RETRIEVAL,),
            rule_id="whitespace_trim_leading",
            reason="TRIM_LEADING",
        )
        trim_ed = trim_ed.model_copy(
            update={
                "normalized_span": SourceSpanV1(
                    start_offset=norm_cursor,
                    end_offset=norm_cursor,
                    original_text="",
                    offset_unit=OFFSET_UNIT,
                ),
                "candidate_surface": "",
                "original_surface": orig,
            }
        )
        edits.append(trim_ed)
        segs.append(Seg(rs, re_, norm_cursor, norm_cursor, MappingKind.MANY_TO_ONE, eid))

    for ch, rs, re_, ed in collapsed:
        kind = MappingKind.IDENTITY
        eid = None
        if ed is not None:
            eid = ed.edit_id
            if (re_ - rs) > 1 or ed.operation is NormalizationOperation.WHITESPACE_COLLAPSE:
                kind = MappingKind.MANY_TO_ONE
            elif len(ch) > 1 and (re_ - rs) == 1:
                kind = MappingKind.ONE_TO_MANY
            elif len(ch) == 1:
                kind = MappingKind.ONE_TO_ONE
            else:
                kind = MappingKind.ONE_TO_MANY
            ed2 = ed.model_copy(
                update={
                    "normalized_span": SourceSpanV1(
                        start_offset=ns,
                        end_offset=ns + len(ch),
                        original_text=ch,
                        offset_unit=OFFSET_UNIT,
                    ),
                    "candidate_surface": ch,
                }
            )
            edits.append(ed2)
        segs.append(Seg(rs, re_, ns, ns + len(ch), kind, eid))
        out.append(ch)
        ns += len(ch)

    for ch, rs, re_, ed in trailing:
        counter[0] += 1
        eid = f"{eid_prefix}trimT{counter[0]}"
        orig = raw_seg[rs - raw_start : re_ - raw_start]
        trim_ed = _edit(
            eid=eid,
            raw=raw_seg,
            rs=rs,
            re_=re_,
            ns=ns,
            ne=ns,
            op=NormalizationOperation.WHITESPACE_COLLAPSE,
            orig=orig,
            cand="",
            safety=SafetyClass.RETRIEVAL_ONLY,
            views=(ViewType.RETRIEVAL,),
            rule_id="whitespace_trim_trailing",
            reason="TRIM_TRAILING",
        )
        trim_ed = trim_ed.model_copy(
            update={
                "normalized_span": SourceSpanV1(
                    start_offset=ns,
                    end_offset=ns,
                    original_text="",
                    offset_unit=OFFSET_UNIT,
                ),
                "candidate_surface": "",
                "original_surface": orig,
            }
        )
        edits.append(trim_ed)
        segs.append(Seg(rs, re_, ns, ns, MappingKind.MANY_TO_ONE, eid))

    # silence unused
    _ = (text1, segs1, edits1)
    return "".join(out), segs, edits


def _security_and_candidates(
    raw: str,
    ranges: list[tuple[int, int]],
    res: CompactNormResources,
    counter: list[int],
) -> list[NormalizationEditV1]:
    edits: list[NormalizationEditV1] = []
    bidi = set("".join(res.security_categories.get("BIDI", [])))
    zw = set("".join(res.security_categories.get("ZERO_WIDTH", [])))
    for i, ch in enumerate(raw):
        if _is_protected(i, ranges):
            continue
        if ch in bidi:
            counter[0] += 1
            edits.append(
                _edit(
                    eid=f"sec{counter[0]}",
                    raw=raw,
                    rs=i,
                    re_=i + 1,
                    ns=None,
                    ne=None,
                    op=NormalizationOperation.BIDI_CONTROL_REVIEW,
                    orig=ch,
                    cand=ch,
                    safety=SafetyClass.SECURITY_REVIEW_REQUIRED,
                    views=(),
                    rule_id="bidi_review",
                    reason="BIDI_CONTROL_PRESENT",
                    reversible=True,
                )
            )
        elif ch in zw:
            counter[0] += 1
            edits.append(
                _edit(
                    eid=f"sec{counter[0]}",
                    raw=raw,
                    rs=i,
                    re_=i + 1,
                    ns=None,
                    ne=None,
                    op=NormalizationOperation.ZERO_WIDTH_REVIEW,
                    orig=ch,
                    cand=ch,
                    safety=SafetyClass.SECURITY_REVIEW_REQUIRED,
                    views=(),
                    rule_id="zw_review",
                    reason="ZERO_WIDTH_PRESENT",
                    reversible=True,
                )
            )
        elif unicodedata.category(ch) == "Cc" and ch not in "\t\n\r":
            counter[0] += 1
            edits.append(
                _edit(
                    eid=f"sec{counter[0]}",
                    raw=raw,
                    rs=i,
                    re_=i + 1,
                    ns=None,
                    ne=None,
                    op=NormalizationOperation.CONTROL_CHARACTER_REVIEW,
                    orig=ch,
                    cand=ch,
                    safety=SafetyClass.SECURITY_REVIEW_REQUIRED,
                    views=(),
                    rule_id="control_review",
                    reason="CONTROL_CHARACTER_PRESENT",
                    reversible=True,
                )
            )

    # Candidate punctuation / abbreviation / repetition — never applied
    for i, ch in enumerate(raw):
        if _is_protected(i, ranges):
            continue
        if ch in res.punctuation_candidates:
            counter[0] += 1
            alts = tuple(res.punctuation_candidates[ch])
            edits.append(
                _edit(
                    eid=f"cand{counter[0]}",
                    raw=raw,
                    rs=i,
                    re_=i + 1,
                    ns=None,
                    ne=None,
                    op=NormalizationOperation.PUNCTUATION_EQUIVALENCE_CANDIDATE,
                    orig=ch,
                    cand=alts[0] if alts else ch,
                    safety=SafetyClass.CANDIDATE_ONLY,
                    views=(),
                    rule_id="punct_candidate",
                    reason="PUNCTUATION_CANDIDATE",
                    alts=alts,
                    reversible=True,
                )
            )

    for m in _TOKEN_RE.finditer(raw):
        tok = m.group(0)
        if not tok.strip() or any(_is_protected(i, ranges) for i in range(m.start(), m.end())):
            continue
        low = tok.lower()
        if low in res.abbreviations:
            counter[0] += 1
            alts = tuple(res.abbreviations[low])
            edits.append(
                _edit(
                    eid=f"abbr{counter[0]}",
                    raw=raw,
                    rs=m.start(),
                    re_=m.end(),
                    ns=None,
                    ne=None,
                    op=NormalizationOperation.ABBREVIATION_EXPANSION_CANDIDATE,
                    orig=tok,
                    cand=alts[0],
                    safety=SafetyClass.CANDIDATE_ONLY,
                    views=(),
                    rule_id="abbr_candidate",
                    reason="ABBREVIATION_CANDIDATE",
                    alts=alts,
                    reversible=True,
                )
            )
        if len(tok) >= res.repetition_min_run and _REP_RE.search(tok):
            reduced = re.sub(r"(.)\1{2,}", r"\1\1", tok)
            if reduced != tok:
                counter[0] += 1
                edits.append(
                    _edit(
                        eid=f"rep{counter[0]}",
                        raw=raw,
                        rs=m.start(),
                        re_=m.end(),
                        ns=None,
                        ne=None,
                        op=NormalizationOperation.REPETITION_REDUCTION_CANDIDATE,
                        orig=tok,
                        cand=reduced,
                        safety=SafetyClass.CANDIDATE_ONLY,
                        views=(),
                        rule_id="repetition_candidate",
                        reason="REPETITION_CANDIDATE",
                        reversible=True,
                    )
                )
    return edits[:MAX_EDITS]


def reconstruct_raw(bundle: NormalizationBundleV1, view_type: ViewType | str = ViewType.RAW) -> str:
    """Deprecated alias for Property A — preserved raw accessor (NOT structural reconstruction)."""
    _ = view_type
    return get_preserved_raw(bundle)


def reconstruct_view_structurally(
    bundle: NormalizationBundleV1,
    view_type: ViewType | str,
) -> str:
    """Property B convenience wrapper — extracts view/edits/map then reconstructs without raw_text."""
    vt = ViewType(view_type) if isinstance(view_type, str) else view_type
    view = bundle.view(vt)
    if view is None:
        raise ReconstructionError("MISSING_VIEW", str(vt))
    applied = [e for e in bundle.edits if vt in e.applied_views]
    return reconstruct_from_view(
        view.text,
        applied,
        view.offset_map,
        integrity=view.integrity,
        view_type=vt,
    )


def normalize_text(
    raw_text: str,
    *,
    protected_spans: tuple[SourceSpanV1, ...] | list[SourceSpanV1] = (),
    language_frame: LanguageFrameV1 | None = None,
    resources: CompactNormResources | None = None,
    input_quality_flags: tuple[str, ...] = (),
) -> NormalizationBundleV1:
    """Build NormalizationBundleV1. Raw text is never mutated."""
    original = raw_text
    try:
        res = resources or load_resources()
        if language_frame is not None:
            protected_spans = language_frame.protected_spans or protected_spans
            input_quality_flags = language_frame.input_quality_flags or input_quality_flags

        prot = tuple(protected_spans)
        ranges = _protected_ranges(prot)
        flags = list(input_quality_flags)
        warnings: list[str] = []
        status = NormalizationStatus.COMPLETE

        if len(original) > min(MAX_INPUT_CODEPOINTS, LANG_MAX):
            flags.append("EXCESSIVE_LENGTH")
            warnings.append("INPUT_BOUNDED")
            status = NormalizationStatus.PARTIAL

        counter = [0]
        # RAW
        raw_view = NormalizationViewV1(
            view_id="raw",
            view_type=ViewType.RAW,
            text=original,
            offset_map=identity_map(len(original)),
            applied_edit_ids=(),
            allowed_uses=("display", "intent_compatible_raw", "audit"),
            status=NormalizationStatus.COMPLETE,
        )

        # UNICODE_CANONICAL (NFC outside protected; NFKC never)
        def nfc_xform(seg, rs, nc, pref, ctr):
            return _nfc_segment(seg, rs, nc, pref, ctr)

        u_text, u_segs, u_edits = _build_protected_aware_transform(
            original, ranges, transform_unprotected=nfc_xform, eid_prefix="nfc"
        )
        # Reject any accidental change inside protected
        for a, b in ranges:
            if u_text[map_raw_span_to_norm(build_map(u_segs, raw_len=len(original), norm_len=len(u_text)), a, b)[0] : map_raw_span_to_norm(build_map(u_segs, raw_len=len(original), norm_len=len(u_text)), a, b)[1]] != original[a:b]:
                # Fall back: verify by reconstructing protected via identity segs
                pass
        u_map = build_map(u_segs, raw_len=len(original), norm_len=len(u_text))
        # Assert protected unchanged in unicode view by direct slice using identity segments
        for a, b in ranges:
            # Find corresponding norm offsets via map
            ns, ne = map_raw_span_to_norm(u_map, a, b)
            if u_text[ns:ne] != original[a:b]:
                warnings.append("UNICODE_PROTECTED_MISMATCH_RECOVERED")
                # Force copy identity for safety — rebuild unicode as raw for protected
                u_text = original
                u_segs = [Seg(0, len(original), 0, len(original), MappingKind.IDENTITY)]
                u_edits = []
                u_map = identity_map(len(original))
                status = NormalizationStatus.PARTIAL
                break

        unicode_view = NormalizationViewV1(
            view_id="unicode_canonical",
            view_type=ViewType.UNICODE_CANONICAL,
            text=u_text,
            offset_map=u_map,
            applied_edit_ids=tuple(e.edit_id for e in u_edits),
            allowed_uses=("display_compatible", "downstream_linguistic"),
            status=status,
        )

        # SAFE_SEMANTIC: NFC base then whitespace/line endings on that raw (apply from original for provenance)
        def sem_xform(seg, rs, nc, pref, ctr, _res=res):
            # NFC first then ws
            nfc_t, nfc_s, nfc_e = _nfc_segment(seg, rs, nc, pref + "n", ctr)
            # Remap: apply ws on nfc_t relative — simpler apply ws on original seg then NFC is wrong order
            # Required order: NFC in unicode; semantic = line endings + space codepoints on RAW then composition not required again
            return _ws_semantic_segment(seg, rs, nc, pref, ctr, _res)

        s_text, s_segs, s_edits = _build_protected_aware_transform(
            original, ranges, transform_unprotected=sem_xform, eid_prefix="sem"
        )
        s_map = build_map(s_segs, raw_len=len(original), norm_len=len(s_text))
        for a, b in ranges:
            ns, ne = map_raw_span_to_norm(s_map, a, b)
            if s_text[ns:ne] != original[a:b]:
                s_text = original
                s_segs = [Seg(0, len(original), 0, len(original), MappingKind.IDENTITY)]
                s_edits = []
                s_map = identity_map(len(original))
                warnings.append("SEMANTIC_PROTECTED_MISMATCH_RECOVERED")
                status = NormalizationStatus.PARTIAL
                break

        semantic_view = NormalizationViewV1(
            view_id="safe_semantic",
            view_type=ViewType.SAFE_SEMANTIC,
            text=s_text,
            offset_map=s_map,
            applied_edit_ids=tuple(e.edit_id for e in s_edits),
            allowed_uses=("meaning_preserving_derive", "not_intent_authority"),
            status=status,
        )

        # RETRIEVAL
        def ret_xform(seg, rs, nc, pref, ctr, _res=res):
            return _retrieval_segment(seg, rs, nc, pref, ctr, _res)

        r_text, r_segs, r_edits = _build_protected_aware_transform(
            original, ranges, transform_unprotected=ret_xform, eid_prefix="ret"
        )
        r_map = build_map(r_segs, raw_len=len(original), norm_len=len(r_text))
        for a, b in ranges:
            ns, ne = map_raw_span_to_norm(r_map, a, b)
            if r_text[ns:ne] != original[a:b]:
                # retrieval may trim around protected — check interior
                # If protected is interior, map must copy exactly
                warnings.append("RETRIEVAL_PROTECTED_MISMATCH_RECOVERED")
                # Rebuild retrieval with identity for whole string when mismatch (safety)
                # Better: only fail that case — force identity map for safety
                r_text_parts = []
                new_segs: list[Seg] = []
                nc = 0
                for start, end, prot in _runs(len(original), ranges):
                    piece = original[start:end]
                    if prot:
                        r_text_parts.append(piece)
                        new_segs.append(Seg(start, end, nc, nc + len(piece), MappingKind.IDENTITY))
                        nc += len(piece)
                    else:
                        t, sg, ed = ret_xform(piece, start, nc, "retfix", counter, res)
                        r_text_parts.append(t)
                        new_segs.extend(sg)
                        nc += len(t)
                r_text = "".join(r_text_parts)
                r_segs = new_segs
                r_map = build_map(r_segs, raw_len=len(original), norm_len=len(r_text))
                # final check
                for a2, b2 in ranges:
                    ns2, ne2 = map_raw_span_to_norm(r_map, a2, b2)
                    if r_text[ns2:ne2] != original[a2:b2]:
                        r_text = original
                        r_segs = [Seg(0, len(original), 0, len(original), MappingKind.IDENTITY)]
                        r_edits = []
                        r_map = identity_map(len(original))
                        break
                break

        retrieval_view = NormalizationViewV1(
            view_id="retrieval",
            view_type=ViewType.RETRIEVAL,
            text=r_text,
            offset_map=r_map,
            applied_edit_ids=tuple(e.edit_id for e in r_edits),
            allowed_uses=("retrieval_only", "not_accounting_identity", "not_intent_authority"),
            status=status,
        )

        candidates = _security_and_candidates(original, ranges, res, counter)
        all_edits = list(u_edits) + list(s_edits) + list(r_edits) + candidates
        # Dedupe edit ids
        seen: set[str] = set()
        deduped: list[NormalizationEditV1] = []
        for e in all_edits:
            if e.edit_id in seen:
                continue
            seen.add(e.edit_id)
            # Never mark CANDIDATE_ONLY as applied
            if e.safety_class is SafetyClass.CANDIDATE_ONLY and e.applied_views:
                e = e.model_copy(update={"applied_views": ()})
            if e.safety_class is SafetyClass.PROHIBITED and e.applied_views:
                e = e.model_copy(update={"applied_views": ()})
            deduped.append(e)

        # Verify maps
        for v in (raw_view, unicode_view, semantic_view, retrieval_view):
            if v.view_type is ViewType.RAW:
                continue
            if not maps_cover_without_overlap(v.offset_map) and v.offset_map.normalized_length > 0:
                warnings.append(f"MAP_COVERAGE_WARN:{v.view_type.value}")

        final_edits = tuple(deduped[:MAX_EDITS])
        raw_view = _attach_view_integrity(raw_view, source_text=original, edits=final_edits)
        unicode_view = _attach_view_integrity(unicode_view, source_text=original, edits=final_edits)
        semantic_view = _attach_view_integrity(semantic_view, source_text=original, edits=final_edits)
        retrieval_view = _attach_view_integrity(retrieval_view, source_text=original, edits=final_edits)

        # Idempotence-friendly: record resource versions
        bundle = NormalizationBundleV1(
            raw_text=original,
            offset_unit=OFFSET_UNIT,
            views=(raw_view, unicode_view, semantic_view, retrieval_view),
            edits=final_edits,
            protected_span_references=prot,
            input_quality_flags=tuple(dict.fromkeys(flags)),
            normalizer_version=NORMALIZER_VERSION,
            resource_pack_version=res.version or RESOURCE_PACK_VERSION,
            status=status,
            warnings=tuple(warnings),
        )
        # Reconstruction law: preservation + structural + integrity
        if get_preserved_raw(bundle) != original:
            raise RuntimeError("RAW_PRESERVATION_FAILED")
        for vt in (ViewType.UNICODE_CANONICAL, ViewType.SAFE_SEMANTIC, ViewType.RETRIEVAL):
            v = bundle.view(vt)
            if v is None:
                continue
            applied = [e for e in bundle.edits if vt in e.applied_views]
            vrep = validate_offset_map(v.offset_map, view_text=v.text, applied_edits=applied)
            if not vrep.ok:
                warnings.append(f"MAP_VALIDATOR:{vt.value}:{','.join(vrep.errors[:3])}")
                status = NormalizationStatus.PARTIAL
                continue
            try:
                rebuilt = reconstruct_from_view(
                    v.text,
                    applied,
                    v.offset_map,
                    integrity=v.integrity,
                    view_type=vt,
                )
            except ReconstructionError as exc:
                warnings.append(f"STRUCTURAL_RECON_ERROR:{vt.value}:{exc.code}")
                status = NormalizationStatus.PARTIAL
                continue
            if rebuilt != original:
                warnings.append(f"STRUCTURAL_RECON_MISMATCH:{vt.value}")
                status = NormalizationStatus.PARTIAL
        bundle = bundle.model_copy(update={"status": status, "warnings": tuple(dict.fromkeys(warnings))})
        return bundle
    except Exception as exc:  # noqa: BLE001
        failed_raw = NormalizationViewV1(
            view_id="raw",
            view_type=ViewType.RAW,
            text=original,
            offset_map=identity_map(len(original)),
            allowed_uses=("display", "intent_compatible_raw", "audit"),
            status=NormalizationStatus.FAILED,
        )
        failed_raw = _attach_view_integrity(failed_raw, source_text=original, edits=())
        return NormalizationBundleV1(
            raw_text=original,
            views=(failed_raw,),
            edits=(),
            protected_span_references=tuple(protected_spans),
            input_quality_flags=input_quality_flags,
            normalizer_version=NORMALIZER_VERSION,
            resource_pack_version=RESOURCE_PACK_VERSION,
            status=NormalizationStatus.FAILED,
            warnings=("NORMALIZATION_FAILED", type(exc).__name__),
        )


def attach_normalization_to_frame(
    frame: LanguageFrameV1,
    *,
    resources: CompactNormResources | None = None,
) -> LanguageFrameV1:
    """Run MAI-06 and attach bundle; also fill unicode_normalized_view from UNICODE_CANONICAL."""
    bundle = normalize_text(
        frame.raw_text,
        language_frame=frame,
        resources=resources,
        input_quality_flags=frame.input_quality_flags,
    )
    u = bundle.view(ViewType.UNICODE_CANONICAL)
    return frame.model_copy(
        update={
            "normalization_bundle": bundle,
            "unicode_normalized_view": u.text if u else frame.raw_text,
            "normalization_edits": tuple(
                {
                    "edit_id": e.edit_id,
                    "operation": e.operation.value,
                    "safety_class": e.safety_class.value,
                    "rule_id": e.rule_id,
                }
                for e in bundle.edits
                if e.applied_views
            ),
            "analyzer_versions": {
                **dict(frame.analyzer_versions or {}),
                "normalizer": NORMALIZER_VERSION,
                "normalization_resources": bundle.resource_pack_version,
            },
        }
    )


# Re-export helpers for tests
__all__ = [
    "normalize_text",
    "attach_normalization_to_frame",
    "reconstruct_raw",
    "reconstruct_view_structurally",
    "reconstruct_from_view",
    "get_preserved_raw",
    "map_norm_span_to_raw",
    "map_raw_span_to_norm",
    "ReconstructionError",
]
