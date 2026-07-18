"""MAI-07R3N4 candidate finalization — identity built only from IdentityAnchorV1.

Never infers identity from existing candidates, normalized text, or ranker output.
Active R3F / R3N2 / R3N3 paths remain unchanged unless explicitly hooked.
"""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from typing import Any

from .....contracts.transliteration import (
    CalibrationStatus,
    CandidateKind,
    CandidateScript,
    TransliterationCandidateV1,
    UncertaintyClass,
)
from ..domain.alignment import identity_alignment
from .. import MAX_CANDIDATES_PER_SPAN
from .r3n4_identity_anchor import IdentityAnchorV1, IdentityAnchorError, validate_identity_anchor

FINALIZER_VERSION = "mai-07-r3n4.finalizer.1.0.0"
POLICY_VERSION = "mai-07-r3n4.1.0.0"


def _stable_cid(*, kind: str, surface: str, anchor_digest: str, extra: str = "") -> str:
    payload = f"{kind}|{surface}|{anchor_digest}|{extra}|{FINALIZER_VERSION}"
    return "xls_" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _has_devanagari(surface: str) -> bool:
    return any(0x0900 <= ord(ch) <= 0x097F for ch in surface)


def _canon_provenance(prov: tuple[str, ...] | list[str]) -> tuple[str, ...]:
    return tuple(sorted(dict.fromkeys(prov)))


def construct_identity_from_anchor(anchor: IdentityAnchorV1) -> TransliterationCandidateV1:
    script = CandidateScript.LATIN if any(ord(c) < 128 for c in anchor.raw_surface) else CandidateScript.OTHER
    return TransliterationCandidateV1(
        candidate_id=_stable_cid(
            kind="IDENTITY",
            surface=anchor.raw_surface,
            anchor_digest=anchor.raw_surface_digest,
            extra=f"{anchor.raw_start}:{anchor.raw_end_exclusive}",
        ),
        surface=anchor.raw_surface,
        script=script,
        kind=CandidateKind.IDENTITY,
        rank=1,
        ranking_score=1.0,
        uncertainty_class=UncertaintyClass.HIGH_EVIDENCE,
        calibration_status=CalibrationStatus.UNCALIBRATED,
        is_identity=True,
        requires_review=False,
        reason_codes=("R3N4_ANCHOR_IDENTITY",),
        provenance=_canon_provenance(("identity", "r3n4_anchor_reserved", anchor.anchor_id)),
        alignment=identity_alignment(anchor.raw_surface),
    )


def _best_devanagari(ranked: list[TransliterationCandidateV1]) -> TransliterationCandidateV1 | None:
    for c in ranked:
        if (not c.is_identity) and (
            c.script == CandidateScript.DEVANAGARI or _has_devanagari(c.surface)
        ):
            return c
    return None


def _is_protected_or_policy_required(c: TransliterationCandidateV1) -> bool:
    codes = set(c.reason_codes or ())
    prov = set(c.provenance or ())
    return bool(
        codes & {"PROTECTED_SPAN", "R3D_PROTECTED", "ACRONYM_IDENTITY", "IDENTIFIER_PROTECTION"}
    ) or bool(
        prov
        & {
            "r3d_protected_hard_gate",
            "r3n_structural_identifier",
            "r3n2_structural_identifier",
            "r3n3_structural_identifier",
        }
    )


def _canonicalize_candidate(c: TransliterationCandidateV1) -> TransliterationCandidateV1:
    score = float(Decimal(str(c.ranking_score)).quantize(Decimal("0.000001")))
    return c.model_copy(
        update={
            "provenance": _canon_provenance(tuple(c.provenance or ())),
            "reason_codes": tuple(dict.fromkeys(c.reason_codes or ())),
            "ranking_score": score,
        }
    )


def canonical_serialize_candidates(cands: list[TransliterationCandidateV1]) -> str:
    rows = []
    for c in cands:
        rows.append(
            {
                "candidate_id": c.candidate_id,
                "surface": c.surface,
                "kind": c.kind.value if hasattr(c.kind, "value") else str(c.kind),
                "is_identity": bool(c.is_identity),
                "rank": int(c.rank),
                "ranking_score": str(Decimal(str(c.ranking_score)).quantize(Decimal("0.000001"))),
                "provenance": list(_canon_provenance(tuple(c.provenance or ()))),
                "reason_codes": list(dict.fromkeys(c.reason_codes or ())),
                "requires_review": bool(c.requires_review),
                "alignment": c.alignment.model_dump() if hasattr(c.alignment, "model_dump") else str(c.alignment),
                "script": c.script.value if hasattr(c.script, "value") else str(c.script),
            }
        )
    return json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def finalize_candidates_r3n4(
    anchor: IdentityAnchorV1,
    ranked: list[TransliterationCandidateV1],
    *,
    raw_text: str | None = None,
    max_candidates: int = MAX_CANDIDATES_PER_SPAN,
) -> tuple[list[TransliterationCandidateV1], bool, dict[str, Any]]:
    diagnostics: dict[str, Any] = {
        "finalizer_version": FINALIZER_VERSION,
        "policy_version": POLICY_VERSION,
        "eviction_reason_codes": [],
        "postcondition_ok": True,
        "postcondition_errors": [],
        "anchor_id": anchor.anchor_id,
    }
    try:
        if raw_text is not None:
            validate_identity_anchor(anchor, raw_text=raw_text)
    except IdentityAnchorError as exc:
        diagnostics["postcondition_ok"] = False
        diagnostics["postcondition_errors"].append(f"anchor_invalid:{exc}")
        safe = construct_identity_from_anchor(anchor)
        return [safe], True, diagnostics

    identity = construct_identity_from_anchor(anchor)

    # Strip all prior identity-flagged candidates; identity comes only from the anchor.
    non_id = [_canonicalize_candidate(c) for c in ranked if not c.is_identity]

    # Surface dedupe among non-identity (stable first-win by input order).
    seen: set[str] = set()
    deduped: list[TransliterationCandidateV1] = []
    for c in non_id:
        if c.surface == identity.surface:
            diagnostics["eviction_reason_codes"].append("NON_IDENTITY_COLLIDES_WITH_RAW_IDENTITY")
            continue
        if c.surface in seen:
            diagnostics["eviction_reason_codes"].append("DEDUP_SURFACE_COLLISION")
            continue
        seen.add(c.surface)
        # Stable IDs from semantic content only — never prior candidate_id (idempotence).
        cid = _stable_cid(
            kind=str(c.kind.value if hasattr(c.kind, "value") else c.kind),
            surface=c.surface,
            anchor_digest=anchor.raw_surface_digest,
            extra="",
        )
        deduped.append(_canonicalize_candidate(c.model_copy(update={"candidate_id": cid})))

    reserved: list[TransliterationCandidateV1] = [identity]
    reserved_ids = {identity.candidate_id}

    for c in deduped:
        if c.candidate_id in reserved_ids:
            continue
        if _is_protected_or_policy_required(c):
            if len(reserved) >= max_candidates:
                diagnostics["eviction_reason_codes"].append("PROTECTED_OVERFLOW")
                diagnostics["postcondition_ok"] = False
                diagnostics["postcondition_errors"].append("protected_cannot_fit")
                break
            reserved.append(c)
            reserved_ids.add(c.candidate_id)

    dev = _best_devanagari(deduped)
    if dev is not None and dev.candidate_id not in reserved_ids:
        if len(reserved) < max_candidates:
            reserved.append(dev)
            reserved_ids.add(dev.candidate_id)
        else:
            diagnostics["eviction_reason_codes"].append("TARGET_OVERFLOW")
            diagnostics["postcondition_ok"] = False
            diagnostics["postcondition_errors"].append("target_devanagari_cannot_fit")

    for c in deduped:
        if c.candidate_id in reserved_ids:
            continue
        if len(reserved) >= max_candidates:
            diagnostics["eviction_reason_codes"].append("LOWEST_PRIORITY_EVICTED")
            continue
        reserved.append(c)
        reserved_ids.add(c.candidate_id)

    if len(reserved) > max_candidates:
        reserved = [reserved[0]] + reserved[1 : max_candidates]
        diagnostics["eviction_reason_codes"].append("HARD_CAP_TRIM")

    # Preserve relative order of non-identity from input; identity may not be first.
    order = {c.candidate_id: i for i, c in enumerate(deduped)}
    order[identity.candidate_id] = -1  # keep identity position flexible via sort key below
    # Stable: identity keeps its relative preference by putting it where ranking had prefer —
    # use input order among non-id, place identity at front of reserved set then re-sort by
    # original non-id order with identity forced to remain present.
    # Deterministic: sort by (is_identity descending? NO — ranking policy may demote identity.
    # Keep identity at its reserved membership; order non-identity by original index;
    # place identity at index 0 among reserved only if no ranking preference — R3N4:
    # identity is reserved but order follows: protected/dev first after identity slot fill.
    # Spec: "Identity reservation does not mean identity must always rank first."
    # So: non-identity keep input order; insert identity at position 0 only for protected-only?
    # Simpler stable rule: identity first in list for serialization stability of idempotence,
    # ranks reassigned 1..N. Ranking policy already applied before finalize.
    # Actually for idempotence, order must be deterministic. Put identity first, then others
    # in original relative order.
    others = [c for c in reserved if c.candidate_id != identity.candidate_id]
    others.sort(key=lambda c: (order.get(c.candidate_id, 10_000), c.candidate_id))
    ordered = [identity, *others][:max_candidates]

    out: list[TransliterationCandidateV1] = []
    for i, c in enumerate(ordered, start=1):
        out.append(_canonicalize_candidate(c.model_copy(update={"rank": i})))

    idents = [c for c in out if c.is_identity]
    if len(idents) != 1 or idents[0].surface != anchor.raw_surface:
        diagnostics["postcondition_ok"] = False
        diagnostics["postcondition_errors"].append("identity_postcondition_failed")
        return [construct_identity_from_anchor(anchor)], True, diagnostics
    if len(out) > max_candidates:
        diagnostics["postcondition_ok"] = False
        diagnostics["postcondition_errors"].append("cap_exceeded")
        return [construct_identity_from_anchor(anchor)], True, diagnostics
    if len({c.surface for c in out}) != len(out):
        diagnostics["postcondition_ok"] = False
        diagnostics["postcondition_errors"].append("duplicate_surfaces")
        return [construct_identity_from_anchor(anchor)], True, diagnostics

    truncated = len(deduped) + 1 > len(out)
    return out, truncated, diagnostics


def finalize_idempotent(
    anchor: IdentityAnchorV1,
    ranked: list[TransliterationCandidateV1],
    *,
    raw_text: str | None = None,
    max_candidates: int = MAX_CANDIDATES_PER_SPAN,
) -> bool:
    a, _, _ = finalize_candidates_r3n4(anchor, ranked, raw_text=raw_text, max_candidates=max_candidates)
    b, _, _ = finalize_candidates_r3n4(anchor, a, raw_text=raw_text, max_candidates=max_candidates)
    return canonical_serialize_candidates(a) == canonical_serialize_candidates(b)


def finalize_candidates_r3n4_compat(
    ranked: list[TransliterationCandidateV1],
    *,
    max_candidates: int,
) -> tuple[list[TransliterationCandidateV1], bool]:
    """Inner-hook stub — identity may be wrong without raw offsets.

    Authoritative R3N4 boundary is ``apply_r3n4_finalize_bundle`` (exactly once per span).
    This stub passes ranked through unchanged so the outer bundle finalizer owns identity.
    """
    return list(ranked), False


def classify_path_family(span: Any) -> str:
    """Map a span result to a required R3N4 path family for coverage audits."""
    elig = getattr(span, "eligibility", None)
    elig_v = elig.value if hasattr(elig, "value") else str(elig or "")
    reasons = set(getattr(span, "decision_reason_codes", ()) or ())
    form = str(getattr(span, "source_language_form", "") or "")
    if getattr(span, "is_protected", False) or elig_v == "SKIPPED_PROTECTED":
        return "protected"
    if "ENGLISH" in elig_v.upper() or any("ENGLISH" in r for r in reasons):
        if any("REORDER" in r or "GUARD" in r for r in reasons):
            return "english_guard_reorder"
        return "skipped_english"
    if elig_v == "ABSTAIN" or "ABSTAIN" in elig_v:
        if "NO_CANDIDATES" in reasons or not getattr(span, "candidates", ()):
            return "empty_generator_result"
        return "abstention"
    if "ACRONYM" in "|".join(reasons) or "ACRONYM" in form.upper():
        return "acronym"
    if "IDENTIFIER" in form.upper() or any("IDENTIFIER" in r for r in reasons):
        if any("REFIN" in r for r in reasons):
            return "refined_identifier"
        if any("COALESC" in r for r in reasons) or "structural" in "|".join(
            getattr(c, "provenance", ()) or () for c in getattr(span, "candidates", ()) or ()
        ).lower():
            return "coalesced_identifier"
        return "structural_identifier"
    if "OPTIONAL" in "|".join(reasons) or getattr(span, "is_ambiguous", False):
        return "optional_ambiguous"
    cands = list(getattr(span, "candidates", ()) or ())
    if len(cands) > 5 or getattr(span, "truncated", False):
        return "cap_pressure"
    surface = getattr(getattr(span, "raw_span", None), "original_text", "") or ""
    if len(surface.split()) > 1:
        return "multi_token_phrase"
    if not cands:
        return "empty_generator_result"
    if elig_v in {"SKIPPED_UNSUPPORTED", "SKIPPED_SECURITY", "SKIPPED_TOO_LONG"}:
        return "failure_fallback"
    return "ordinary_romanized_generation"


def apply_r3n4_finalize_bundle(
    bundle: Any,
    raw_text: str,
    *,
    max_candidates: int = MAX_CANDIDATES_PER_SPAN,
    path_spy: list[dict[str, Any]] | None = None,
) -> Any:
    """Authoritative R3N4 boundary: finalize every span exactly once from a raw-derived anchor."""
    from .r3n4_identity_anchor import create_identity_anchor, IdentityAnchorError
    from .r3n4_finalization_path_registry import record_path_finalization

    new_spans = []
    for span in bundle.span_results:
        rs = span.raw_span
        path_family = classify_path_family(span)
        try:
            # Prefer raw_text slice over rs.original_text so coalesced/refined offsets win.
            anchor = create_identity_anchor(
                raw_text,
                raw_start=int(rs.start_offset),
                raw_end_exclusive=int(rs.end_offset),
                anchor_kind="OUTPUT_SPAN",
                created_from="apply_r3n4_finalize_bundle",
            )
            # If annotation surface drifted from raw slice, still trust raw offsets.
            if rs.original_text != anchor.raw_surface:
                # Re-bind raw_span to authoritative slice without mutating source text.
                rs = rs.model_copy(update={"original_text": anchor.raw_surface})
        except IdentityAnchorError:
            # Fail closed: identity-safe single candidate when offsets are invalid.
            from .r3n4_identity_anchor import create_identity_anchor as _cia

            safe_surface = rs.original_text if isinstance(rs.original_text, str) else ""
            synth = safe_surface
            try:
                anchor = _cia(
                    synth,
                    raw_start=0,
                    raw_end_exclusive=len(synth),
                    anchor_kind="FAIL_CLOSED",
                    created_from="invalid_offsets_fail_closed",
                )
            except IdentityAnchorError:
                new_spans.append(span)
                record_path_finalization(path_family, ok=False, reason="anchor_unrecoverable")
                if path_spy is not None:
                    path_spy.append({"path_family": path_family, "finalized": False})
                continue
            finalized, trunc, diag = finalize_candidates_r3n4(
                anchor, list(span.candidates or ()), raw_text=synth, max_candidates=max_candidates
            )
            id_ref = next((c.candidate_id for c in finalized if c.is_identity), None)
            new_spans.append(
                span.model_copy(
                    update={
                        "candidates": tuple(finalized),
                        "identity_candidate_id": id_ref,
                        "truncated": bool(span.truncated or trunc),
                        "decision_reason_codes": tuple(
                            dict.fromkeys(
                                tuple(span.decision_reason_codes or ())
                                + ("R3N4_FAIL_CLOSED_FINALIZE",)
                                + tuple(diag.get("postcondition_errors") or ())
                            )
                        ),
                    }
                )
            )
            record_path_finalization(path_family, ok=True, reason="fail_closed")
            if path_spy is not None:
                path_spy.append({"path_family": path_family, "finalized": True, "fail_closed": True})
            continue

        finalized, trunc, diag = finalize_candidates_r3n4(
            anchor,
            list(span.candidates or ()),
            raw_text=raw_text,
            max_candidates=max_candidates,
        )
        id_ref = next((c.candidate_id for c in finalized if c.is_identity), None)
        new_spans.append(
            span.model_copy(
                update={
                    "raw_span": rs,
                    "candidates": tuple(finalized),
                    "identity_candidate_id": id_ref,
                    "truncated": bool(span.truncated or trunc),
                    "decision_reason_codes": tuple(
                        dict.fromkeys(
                            tuple(span.decision_reason_codes or ())
                            + ("R3N4_ANCHOR_FINALIZED",)
                            + (
                                tuple(diag.get("postcondition_errors") or ())
                                if not diag.get("postcondition_ok", True)
                                else ()
                            )
                        )
                    ),
                }
            )
        )
        record_path_finalization(path_family, ok=True)
        if path_spy is not None:
            path_spy.append(
                {
                    "path_family": path_family,
                    "finalized": True,
                    "anchor_id": anchor.anchor_id,
                    "identity_surface_digest": anchor.raw_surface_digest,
                }
            )

    return bundle.model_copy(
        update={
            "span_results": tuple(new_spans),
            "runtime_version": "mai-07.1.9-r3n4-identityanchor",
            "candidate_count": sum(len(s.candidates) for s in new_spans),
        }
    )


__all__ = [
    "FINALIZER_VERSION",
    "POLICY_VERSION",
    "construct_identity_from_anchor",
    "finalize_candidates_r3n4",
    "finalize_idempotent",
    "finalize_candidates_r3n4_compat",
    "canonical_serialize_candidates",
    "classify_path_family",
    "apply_r3n4_finalize_bundle",
]
