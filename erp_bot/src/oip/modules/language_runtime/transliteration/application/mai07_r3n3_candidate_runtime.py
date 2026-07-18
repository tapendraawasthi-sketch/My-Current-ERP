"""MAI-07R3N3 candidate runtime (identity-invariant) factory — explicit activation only.

Default production/development construction continues to use active
mai-07.1.3-r3f-sealnew. This module never mutates ACTIVE_PACK_VERSION,
RUNTIME_VERSION, or ENABLE_PROMOTION_OVERLAY.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .....contracts.common import ConfidenceV1, SourceSpanV1
from .....contracts.language import LanguageFrameV1, SpanAnnotationV1
from ...application.language_analyzer import analyze_language, _emit_token, _fill_gaps
from ...domain.offsets import covered_exactly
from ...domain.taxonomy import LanguageForm, ProtectedKind
from ...infrastructure.compact_resource_repository import load_resources as load_mai05_resources
from ...normalization.application.normalization_service import attach_normalization_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from ..infrastructure.resource_repository import CompactXlResources, load_resources
from .transliteration_service import transliterate_frame
from .r3n3_candidate_finalization import finalize_candidates_r3n3_compat

# Contiguous mixed letter-digit identifier with optional - . / separators (no spaces).
_STRUCTURAL_IDENTIFIER = re.compile(
    r"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z][A-Za-z0-9]*(?:[-./][A-Za-z0-9]+)+$"
)

REPO = Path(__file__).resolve().parents[7]
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
PARENT_RUNTIME_VERSION = "mai-07.1.3-r3f-sealnew"
PARENT_RESOURCE_HASH = "1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930"
CANDIDATE_RUNTIME_VERSION = "mai-07.1.8-r3n3-identityinv"
CANDIDATE_POLICY_VERSION = "mai-07-r3n3.1.0.0"
CANDIDATE_PACK_DIR = XL / "sealed_packs" / CANDIDATE_RUNTIME_VERSION
DEFAULT_ACTIVE = False
# DEVELOPMENT_PARENT_ONLY: useful R3N code (refine/coalesce/guard policy) is starting
# implementation only — never release evidence. Invalidated parent version:
# DEVELOPMENT_PARENT_ONLY: failed R3N2 is parent implementation, not release evidence.
PARENT_FAILED_R3N2_RUNTIME_VERSION = "mai-07.1.7-r3n2-freshholdout"
PARENT_FAILED_R3N2_POLICY_VERSION = "mai-07-r3n2.1.0.0"
PARENT_FAILED_R3N2_PACK_HASH = "170610284993061dd93efc3150f09f03ac2f1e3d69052c964cbe7c3aab61c1f3"
PARENT_FAILED_R3N2_RUNTIME_SEMANTIC = "c1777bdff80680069398244d0941adb2c3baca79c37da43edeed0d54b7e3e998"
PARENT_FAILED_R3N2_LOCK_SEMANTIC = "25f9eac74b8c9331a474c54ef2bb723157789aba00cab7bb8194dbb6b999c710"
PARENT_FAILED_R3N2_VERDICT = "FAILED_HOLDOUT_QUALITY"
R3N_INTEGRITY_CLOSURE_SEMANTIC = "fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae"
ACTIVATION_METHOD = "explicit_load_resources_resources_dir_plus_r3n3_factory"


def assert_active_default_immutable() -> None:
    from .mai07_active_default_guard import assert_active_default_immutable as _assert

    _assert(candidate_default_active=DEFAULT_ACTIVE)



def load_r3n3_resources() -> CompactXlResources:
    """Load the R3N sealed pack explicitly. Never the silent default."""
    assert_active_default_immutable()
    if not CANDIDATE_PACK_DIR.is_dir():
        raise FileNotFoundError(f"r3n3_pack_missing:{CANDIDATE_PACK_DIR}")
    return load_resources(resources_dir=CANDIDATE_PACK_DIR)


def _looks_like_spurious_identifier(surface: str) -> bool:
    """True when a protected/identifier span is a multi-word phrase without a digit ID."""
    if " " not in surface and "\t" not in surface:
        return False
    # Real invoice/VAT/account refs almost always carry a digit in the value token.
    if any(ch.isdigit() for ch in surface):
        return False
    # Explicit separators after label still allowed only with digits (handled above).
    return True


def refine_overmerged_identifier_spans(frame: LanguageFrameV1) -> LanguageFrameV1:
    """Split space-containing identifier/protected spans that lack digit evidence.

    General structural rule — not case-specific. Active default analyzer is unchanged;
    only the R3N candidate factory applies this refinement.
    """
    res = load_mai05_resources()
    raw = frame.raw_text
    kept: list[SpanAnnotationV1] = []
    for ann in frame.span_annotations:
        form = ann.language_form
        is_idish = form == LanguageForm.IDENTIFIER_OR_CODE.value or bool(ann.protected_reason)
        if is_idish and _looks_like_spurious_identifier(ann.original_text):
            # Re-tokenize the covered range into ordinary tokens.
            sub: list[SpanAnnotationV1] = []
            chunk = raw[ann.start_offset : ann.end_offset]
            for m in re.finditer(r"\S+|\s+", chunk, re.UNICODE):
                abs_s = ann.start_offset + m.start()
                abs_e = ann.start_offset + m.end()
                if m.group().isspace():
                    continue
                _emit_token(raw, abs_s, abs_e, sub, res)
            if sub:
                kept.extend(sub)
                continue
        kept.append(ann)
    kept.sort(key=lambda a: a.start_offset)
    if not covered_exactly(raw, [(a.start_offset, a.end_offset) for a in kept]):
        kept = _fill_gaps(raw, kept)
    return _with_protected_spans(frame, kept)


def _with_protected_spans(frame: LanguageFrameV1, kept: list[SpanAnnotationV1]) -> LanguageFrameV1:
    prot = tuple(
        SourceSpanV1(
            start_offset=a.start_offset,
            end_offset=a.end_offset,
            original_text=a.original_text,
            offset_unit=a.offset_unit,
        )
        for a in kept
        if a.protected_reason
    )
    return frame.model_copy(update={"span_annotations": tuple(kept), "protected_spans": prot})


def _is_structural_identifier_surface(surface: str) -> bool:
    """Structural evidence only — not a memorized term list."""
    if " " in surface or "\t" in surface or "\n" in surface:
        return False
    if not _STRUCTURAL_IDENTIFIER.match(surface):
        return False
    # Reject pure short Latin tokens with a trailing digit glued without separator
    # (already excluded by requiring separator groups). Ordinary Romanized Nepali
    # never matches because it lacks digits.
    return True


def coalesce_structural_identifiers(frame: LanguageFrameV1) -> LanguageFrameV1:
    """Merge abutting fragments into one identifier when letter+digit+separator evidence exists.

    Protects codes such as letter-separator-digit forms that the base tokenizer splits.
    Does not classify ordinary short Latin as acronyms. Active default analyzer unchanged.
    """
    raw = frame.raw_text
    anns = sorted(frame.span_annotations, key=lambda a: a.start_offset)
    out: list[SpanAnnotationV1] = []
    i = 0
    while i < len(anns):
        cur = anns[i]
        if cur.protected_reason and any(ch.isdigit() for ch in cur.original_text) and " " not in cur.original_text:
            out.append(cur)
            i += 1
            continue

        # Maximal abutting run without whitespace gaps.
        j = i
        while j + 1 < len(anns) and anns[j].end_offset == anns[j + 1].start_offset:
            joined_probe = raw[anns[i].start_offset : anns[j + 1].end_offset]
            if any(ch.isspace() for ch in joined_probe):
                break
            j += 1

        best = i
        for end in range(i + 1, j + 1):
            joined = raw[anns[i].start_offset : anns[end].end_offset]
            if _is_structural_identifier_surface(joined):
                best = end

        if best > i:
            joined = raw[anns[i].start_offset : anns[best].end_offset]
            out.append(
                SpanAnnotationV1(
                    start_offset=anns[i].start_offset,
                    end_offset=anns[best].end_offset,
                    original_text=joined,
                    script=cur.script,
                    language_form=LanguageForm.IDENTIFIER_OR_CODE.value,
                    confidence=ConfidenceV1(
                        value=1.0,
                        method="r3n3_structural_identifier",
                        grants_authority=False,
                    ),
                    protected_reason=ProtectedKind.UNKNOWN_IDENTIFIER.value,
                    offset_unit=cur.offset_unit,
                )
            )
            i = best + 1
            continue

        out.append(cur)
        i += 1

    out.sort(key=lambda a: a.start_offset)
    if not covered_exactly(raw, [(a.start_offset, a.end_offset) for a in out]):
        out = _fill_gaps(raw, out)
    return _with_protected_spans(frame, out)


def analyze_language_r3n3(raw_text: str) -> LanguageFrameV1:
    """R3N3-only analysis: split spurious phrases, then coalesce structural identifiers."""
    assert_active_default_immutable()
    frame = analyze_language(raw_text)
    frame = refine_overmerged_identifier_spans(frame)
    return coalesce_structural_identifiers(frame)


def transliterate_r3n3(
    raw_text: str,
    *,
    resources: CompactXlResources | None = None,
) -> Any:
    """Full R3N3 candidate pipeline. Explicit only — never import-side activated.

    Uses reserved-identity finalization (R3N3-only). Active R3F finalize path unchanged.
    """
    assert_active_default_immutable()
    res = resources or load_r3n3_resources()
    frame = analyze_language_r3n3(raw_text)
    frame = attach_normalization_to_frame(frame)
    return transliterate_frame(
        frame,
        resources=res,
        use_context=True,
        finalize_candidates_fn=finalize_candidates_r3n3_compat,
    )


def candidate_identity_card() -> dict[str, Any]:
    return {
        "parent_runtime_version": PARENT_RUNTIME_VERSION,
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_policy_version": CANDIDATE_POLICY_VERSION,
        "parent_resource_hash": PARENT_RESOURCE_HASH,
        "activation_method": ACTIVATION_METHOD,
        "default_active": DEFAULT_ACTIVE,
        "overlay_enabled": False,
        "pack_dir": str(CANDIDATE_PACK_DIR),
    }
