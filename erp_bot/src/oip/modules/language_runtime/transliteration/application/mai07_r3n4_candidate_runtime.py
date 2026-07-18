"""MAI-07R3N4 candidate runtime (identity-anchor) factory — explicit activation only.

Default production/development construction continues to use active
mai-07.1.3-r3f-sealnew. This module never mutates ACTIVE_PACK_VERSION,
RUNTIME_VERSION, or ENABLE_PROMOTION_OVERLAY.

Parent = failed/consumed R3N3 (mai-07.1.8-r3n3-identityinv).
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
from ...infrastructure.compact_resource_repository import (
    CompactResources,
    load_resources as load_mai05_resources,
)
from ...normalization.infrastructure.norm_resource_repository import (
    CompactNormResources,
)
from ...normalization.application.normalization_service import attach_normalization_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure.resource_repository import CompactXlResources, load_resources
from .transliteration_service import transliterate_frame
from .r3n4_candidate_finalization import (
    apply_r3n4_finalize_bundle,
    finalize_candidates_r3n4_compat,
)
from .r3n4_identity_anchor import create_identity_anchor

# Contiguous mixed letter-digit identifier with optional - . / separators (no spaces).
_STRUCTURAL_IDENTIFIER = re.compile(
    r"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z][A-Za-z0-9]*(?:[-./][A-Za-z0-9]+)+$"
)

REPO = Path(__file__).resolve().parents[7]
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
# Historical parent before R3S cutover (immutable lineage record / source pack path).
PARENT_RUNTIME_VERSION = "mai-07.1.3-r3f-sealnew"
PARENT_RESOURCE_HASH = "1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930"
HISTORICAL_PRE_CUTOVER_RUNTIME_VERSION = PARENT_RUNTIME_VERSION
HISTORICAL_PRE_CUTOVER_RESOURCE_HASH = PARENT_RESOURCE_HASH
CANDIDATE_RUNTIME_VERSION = "mai-07.1.9-r3n4-identityanchor"
CANDIDATE_POLICY_VERSION = "mai-07-r3n4.1.0.0"
CANDIDATE_PACK_DIR = XL / "sealed_packs" / CANDIDATE_RUNTIME_VERSION
DEFAULT_ACTIVE = False
ACTIVE_PACK_VERSION = "mai-07.1.11-r3n6-chaincomplete"

# Parent failed R3N3 (consumed attempt; not release evidence).
PARENT_FAILED_R3N3_RUNTIME_VERSION = "mai-07.1.8-r3n3-identityinv"
PARENT_FAILED_R3N3_POLICY_VERSION = "mai-07-r3n3.1.0.0"
PARENT_FAILED_R3N3_PACK_HASH = "1268527c5c5d99e036628dc104340dafe297afadf9938a310a099a38f825c0e7"
PARENT_FAILED_R3N3_RUNTIME_SEMANTIC = "1775e1b365e3f6fb5642634edc84b616db5d4cbe977988f0338ea41e0d46aa46"
PARENT_FAILED_R3N3_LOCK_SEMANTIC = "0aaefd824eec3b56a70f6846b29ecc603e9db85b3186e3264eee705f3d16c59b"
PARENT_FAILED_R3N3_VERDICT = "FAILED_HOLDOUT_QUALITY"
PARENT_FAILED_R3N3_ATTEMPT = "MAI_07R3N3_HOLDOUT_ATTEMPT_001"

# Preserved invalidated/failed grandparents.
PARENT_FAILED_R3N2_RUNTIME_VERSION = "mai-07.1.7-r3n2-freshholdout"
PARENT_FAILED_R3N2_PACK_HASH = "170610284993061dd93efc3150f09f03ac2f1e3d69052c964cbe7c3aab61c1f3"
R3N_INTEGRITY_CLOSURE_SEMANTIC = "fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae"
ACTIVATION_METHOD = "explicit_load_resources_resources_dir_plus_r3n4_factory"


def assert_active_default_immutable() -> None:
    from .mai07_active_default_guard import assert_active_default_immutable as _assert

    _assert(candidate_default_active=DEFAULT_ACTIVE)



def load_r3n4_resources() -> CompactXlResources:
    """Load the R3N4 sealed pack explicitly. Prefer active pack via load_resources()."""
    assert_active_default_immutable()
    if not CANDIDATE_PACK_DIR.is_dir():
        raise FileNotFoundError(f"r3n4_pack_missing:{CANDIDATE_PACK_DIR}")
    return load_resources(resources_dir=CANDIDATE_PACK_DIR)


def _looks_like_spurious_identifier(surface: str) -> bool:
    if " " not in surface and "\t" not in surface:
        return False
    if any(ch.isdigit() for ch in surface):
        return False
    return True


def refine_overmerged_identifier_spans(
    frame: LanguageFrameV1,
    *,
    language_resources: CompactResources | None = None,
) -> LanguageFrameV1:
    """Split space-containing identifier/protected spans that lack digit evidence."""
    res = language_resources or load_mai05_resources()
    raw = frame.raw_text
    kept: list[SpanAnnotationV1] = []
    for ann in frame.span_annotations:
        form = ann.language_form
        is_idish = form == LanguageForm.IDENTIFIER_OR_CODE.value or bool(ann.protected_reason)
        if is_idish and _looks_like_spurious_identifier(ann.original_text):
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
    if " " in surface or "\t" in surface or "\n" in surface:
        return False
    if not _STRUCTURAL_IDENTIFIER.match(surface):
        return False
    return True


def coalesce_structural_identifiers(frame: LanguageFrameV1) -> LanguageFrameV1:
    """Merge abutting fragments into one identifier when letter+digit+separator evidence exists."""
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
            # Create anchor before transform recording (metadata only; not attached to frame).
            _ = create_identity_anchor(
                raw,
                raw_start=anns[i].start_offset,
                raw_end_exclusive=anns[best].end_offset,
                anchor_kind="COALESCED_SPAN",
                created_from="coalesce_structural_identifiers",
            )
            out.append(
                SpanAnnotationV1(
                    start_offset=anns[i].start_offset,
                    end_offset=anns[best].end_offset,
                    original_text=joined,
                    script=cur.script,
                    language_form=LanguageForm.IDENTIFIER_OR_CODE.value,
                    confidence=ConfidenceV1(
                        value=1.0,
                        method="r3n4_structural_identifier",
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


def analyze_language_r3n4(
    raw_text: str,
    *,
    language_resources: CompactResources | None = None,
) -> LanguageFrameV1:
    """R3N4-only analysis: split spurious phrases, then coalesce structural identifiers."""
    assert_active_default_immutable()
    frame = analyze_language(raw_text, resources=language_resources)
    frame = refine_overmerged_identifier_spans(
        frame, language_resources=language_resources
    )
    return coalesce_structural_identifiers(frame)


def apply_r3n4_pipeline_to_frame(
    frame: LanguageFrameV1,
    *,
    resources: CompactXlResources,
    normalization_resources: CompactNormResources | None = None,
    path_spy: list[dict[str, Any]] | None = None,
) -> Any:
    """Normalize + generate/rank + authoritative R3N4 finalize on an analyzed frame."""
    raw_text = frame.raw_text
    for ann in frame.span_annotations:
        _ = create_identity_anchor(
            raw_text,
            raw_start=ann.start_offset,
            raw_end_exclusive=ann.end_offset,
            anchor_kind="SOURCE_SPAN",
            created_from="pre_transform_annotation",
        )
    frame = attach_normalization_to_frame(
        frame, resources=normalization_resources
    )
    bundle = transliterate_frame(
        frame,
        resources=resources,
        use_context=True,
        finalize_candidates_fn=finalize_candidates_r3n4_compat,
    )
    return apply_r3n4_finalize_bundle(bundle, raw_text, path_spy=path_spy)


def transliterate_r3n4(
    raw_text: str,
    *,
    resources: CompactXlResources | None = None,
    language_resources: CompactResources | None = None,
    normalization_resources: CompactNormResources | None = None,
    path_spy: list[dict[str, Any]] | None = None,
) -> Any:
    """Full R3N4 candidate pipeline. Explicit only — never import-side activated.

    1) analyze/refine/coalesce
    2) normalize attachment
    3) generate/rank via transliterate_frame (inner finalize stubbed through)
    4) authoritative apply_r3n4_finalize_bundle — exactly one finalization per span
    """
    assert_active_default_immutable()
    res = resources or load_r3n4_resources()
    frame = analyze_language_r3n4(
        raw_text, language_resources=language_resources
    )
    return apply_r3n4_pipeline_to_frame(
        frame,
        resources=res,
        normalization_resources=normalization_resources,
        path_spy=path_spy,
    )


def candidate_identity_card() -> dict[str, Any]:
    return {
        "parent_runtime_version": PARENT_RUNTIME_VERSION,
        "historical_pre_cutover_runtime": HISTORICAL_PRE_CUTOVER_RUNTIME_VERSION,
        "historical_pre_cutover_resource_hash": HISTORICAL_PRE_CUTOVER_RESOURCE_HASH,
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_policy_version": CANDIDATE_POLICY_VERSION,
        "parent_resource_hash": PARENT_RESOURCE_HASH,
        "parent_failed_r3n3_runtime": PARENT_FAILED_R3N3_RUNTIME_VERSION,
        "parent_failed_r3n3_pack_hash": PARENT_FAILED_R3N3_PACK_HASH,
        "parent_failed_r3n3_lock_semantic": PARENT_FAILED_R3N3_LOCK_SEMANTIC,
        "parent_failed_r3n3_verdict": PARENT_FAILED_R3N3_VERDICT,
        "activation_method": ACTIVATION_METHOD,
        "default_active": DEFAULT_ACTIVE,
        "overlay_enabled": False,
        "pack_dir": str(CANDIDATE_PACK_DIR),
    }
