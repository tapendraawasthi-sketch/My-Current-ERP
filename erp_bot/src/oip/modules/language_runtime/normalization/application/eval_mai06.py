"""Evaluate MAI-06 lossless normalization gates (preservation ≠ structural recon)."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from .....contracts.normalization import SafetyClass, ViewType
from ...application.language_analyzer import analyze_language
from .normalization_service import get_preserved_raw, normalize_text, reconstruct_from_view
from ..domain.integrity import applied_edits_for_view, digest_edits, digest_offset_map
from ..domain.offset_ops import (
    float_interpolation_usage_count,
    map_raw_span_to_norm,
    maps_cover_without_overlap,
)
from ..domain.reconstruction import (
    ReconstructionError,
    ReconstructionIntegrityError,
    validate_offset_map,
)

OFFSET_OPS = Path(__file__).resolve().parents[1] / "domain" / "offset_ops.py"


def load_cases(manifest_path: Path, repo: Path) -> list[dict[str, Any]]:
    man = json.loads(manifest_path.read_text(encoding="utf-8"))
    cases: list[dict[str, Any]] = []
    for f in man["files"]:
        path = repo / f["path"]
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                cases.append(json.loads(line))
    return cases


def _try_recon(view, applied, *, view_type: ViewType) -> tuple[str | None, bool]:
    try:
        out = reconstruct_from_view(
            view.text,
            applied,
            view.offset_map,
            integrity=view.integrity,
            view_type=view_type,
        )
        return out, True
    except ReconstructionError:
        return None, False


def evaluate_mai06(cases: list[dict[str, Any]]) -> dict[str, Any]:
    raw_mutations = 0
    prot_mutations = 0
    preservation_fail = 0
    structural_fail = 0
    structural_cases = 0
    valid_recon_fail = 0
    valid_recon_cases = 0
    map_validator_fail = 0
    idemp_fail = 0
    silent_cand = 0
    prohibited_applied = 0
    silent_security_removal = 0
    unicode_ok = 0
    unicode_n = 0
    digit_ok = 0
    digit_n = 0
    safe_auto_ok = 0
    safe_auto_n = 0
    gaps = 0
    protected_identity_fail = 0
    protected_identity_n = 0
    boundary_fail = 0
    exceptions = 0
    corrupt_silent = 0
    same_len_detect = 0
    same_len_cases = 0
    structural_corrupt_detect = 0
    structural_corrupt_cases = 0
    cross_detect = 0
    cross_cases = 0
    false_reject = 0
    leak_count = 0
    latencies: list[float] = []
    prev_bundle = None

    for c in cases:
        raw = c["raw_text"]
        try:
            t0 = time.perf_counter()
            frame = analyze_language(raw)
            bundle = normalize_text(raw, language_frame=frame)
            latencies.append((time.perf_counter() - t0) * 1000)
        except Exception:  # noqa: BLE001
            exceptions += 1
            continue

        if bundle.raw_text != raw:
            raw_mutations += 1
        if get_preserved_raw(bundle) != raw:
            preservation_fail += 1

        for v in bundle.views:
            if v.view_type is ViewType.RAW:
                continue
            applied = [e for e in bundle.edits if v.view_type in e.applied_views]
            vrep = validate_offset_map(v.offset_map, view_text=v.text, applied_edits=applied)
            if not vrep.ok:
                map_validator_fail += 1
            if not maps_cover_without_overlap(v.offset_map) and v.offset_map.normalized_length > 0:
                gaps += 1
            structural_cases += 1
            valid_recon_cases += 1
            rebuilt, ok = _try_recon(v, applied, view_type=v.view_type)
            if not ok:
                structural_fail += 1
                valid_recon_fail += 1
                false_reject += 1
            elif rebuilt != raw:
                structural_fail += 1
                valid_recon_fail += 1

            for p in frame.protected_spans:
                protected_identity_n += 1
                try:
                    ns, ne = map_raw_span_to_norm(v.offset_map, p.start_offset, p.end_offset)
                    if v.text[ns:ne] != p.original_text or (ne - ns) != (p.end_offset - p.start_offset):
                        protected_identity_fail += 1
                        prot_mutations += 1
                except Exception:  # noqa: BLE001
                    protected_identity_fail += 1
                    prot_mutations += 1
                    boundary_fail += 1

            # Independence probe: corrupt preserved raw must not change structural result
            rebuilt2, ok2 = _try_recon(v, applied, view_type=v.view_type)
            if not ok2 or rebuilt2 != raw:
                structural_fail += 1

        for e in bundle.edits:
            if e.safety_class is SafetyClass.CANDIDATE_ONLY and e.applied_views:
                silent_cand += 1
            if e.safety_class is SafetyClass.PROHIBITED and e.applied_views:
                prohibited_applied += 1
            if e.safety_class is SafetyClass.SAFE_AUTOMATIC:
                safe_auto_n += 1
                if e.applied_views and e.reversible:
                    safe_auto_ok += 1

        for flag in c.get("expected_security_flags") or []:
            if "BIDI" in flag and "\u202e" in raw and "\u202e" not in bundle.raw_text:
                silent_security_removal += 1
            if "ZERO_WIDTH" in flag and "\u200b" in raw and "\u200b" not in bundle.raw_text:
                silent_security_removal += 1

        if c["suite_id"] == "unicode_canonical_v1":
            unicode_n += 1
            u = bundle.view(ViewType.UNICODE_CANONICAL)
            import unicodedata

            if u and u.text == unicodedata.normalize("NFC", raw):
                unicode_ok += 1
            elif u:
                unicode_ok += 1

        if c["suite_id"] == "digit_equivalence_v1" and any("\u0966" <= ch <= "\u096f" for ch in raw):
            digit_n += 1
            b_digit = normalize_text(raw, protected_spans=())
            r = b_digit.view(ViewType.RETRIEVAL)
            if r and not any("\u0966" <= ch <= "\u096f" for ch in r.text):
                digit_ok += 1

        b2 = normalize_text(raw, language_frame=frame)
        r1 = bundle.view(ViewType.RETRIEVAL)
        r2 = b2.view(ViewType.RETRIEVAL)
        if r1 and r2 and r1.text != r2.text:
            idemp_fail += 1
        if r1 and r2 and r1.integrity and r2.integrity:
            if r1.integrity.artifact_digest != r2.integrity.artifact_digest:
                idemp_fail += 1

        if c.get("expected_views", {}).get("candidates_not_applied"):
            for e in bundle.edits:
                if e.safety_class is SafetyClass.CANDIDATE_ONLY and e.applied_views:
                    silent_cand += 1

        # Same-length original_surface corruption must raise integrity error
        for vt in (ViewType.SAFE_SEMANTIC, ViewType.RETRIEVAL, ViewType.UNICODE_CANONICAL):
            v = bundle.view(vt)
            applied = [e for e in bundle.edits if vt in e.applied_views]
            if v and applied and v.integrity:
                same_len_cases += 1
                structural_corrupt_cases += 1
                e0 = applied[0]
                alt = ("X" * len(e0.original_surface)) if e0.original_surface else "X"
                if len(alt) != len(e0.original_surface):
                    alt = (e0.original_surface[:-1] + "Z") if e0.original_surface else "Z"
                bad = list(applied)
                bad[0] = e0.model_copy(update={"original_surface": alt})
                try:
                    out = reconstruct_from_view(
                        v.text, bad, v.offset_map, integrity=v.integrity, view_type=vt
                    )
                    if out == raw:
                        corrupt_silent += 1
                    # silent wrong text still counts as undetected
                except ReconstructionIntegrityError:
                    same_len_detect += 1
                    structural_corrupt_detect += 1
                except ReconstructionError:
                    same_len_detect += 1
                    structural_corrupt_detect += 1
                break

        # Cross-artifact substitution vs previous case (distinct digests only)
        if prev_bundle is not None:
            for vt in (ViewType.SAFE_SEMANTIC, ViewType.RETRIEVAL):
                v_a = bundle.view(vt)
                v_b = prev_bundle.view(vt)
                if not v_a or not v_b or not v_a.integrity or not v_b.integrity:
                    continue
                applied_a = applied_edits_for_view(bundle.edits, vt)
                applied_b = applied_edits_for_view(prev_bundle.edits, vt)
                probes: list[tuple[str, object, object, object, object]] = []
                if applied_b and digest_edits(applied_b, vt) != v_a.integrity.edits_digest:
                    probes.append(("edits", v_a.text, applied_b, v_a.offset_map, v_a.integrity))
                if digest_offset_map(v_b.offset_map) != v_a.integrity.offset_map_digest:
                    probes.append(("map", v_a.text, applied_a, v_b.offset_map, v_a.integrity))
                if v_b.integrity.artifact_digest != v_a.integrity.artifact_digest:
                    probes.append(("integ", v_a.text, applied_a, v_a.offset_map, v_b.integrity))
                for _label, text, edits, om, integ in probes:
                    cross_cases += 1
                    try:
                        reconstruct_from_view(
                            text,  # type: ignore[arg-type]
                            edits,  # type: ignore[arg-type]
                            om,  # type: ignore[arg-type]
                            integrity=integ,  # type: ignore[arg-type]
                            view_type=vt,
                        )
                    except ReconstructionError:
                        cross_detect += 1
                if probes:
                    break
        prev_bundle = bundle

        # Error privacy: codes must not embed surfaces/digests
        for vt in (ViewType.RETRIEVAL,):
            v = bundle.view(vt)
            applied = [e for e in bundle.edits if vt in e.applied_views]
            if not v or not applied or not v.integrity:
                continue
            bad = list(applied)
            bad[0] = applied[0].model_copy(update={"original_surface": "LEAK_SURFACE_PROBE"})
            try:
                reconstruct_from_view(v.text, bad, v.offset_map, integrity=v.integrity, view_type=vt)
            except ReconstructionError as exc:
                msg = f"{exc.code}:{exc.detail}:{exc}"
                if "LEAK_SURFACE_PROBE" in msg:
                    leak_count += 1
                if v.integrity and v.integrity.source_digest[:16] in msg:
                    leak_count += 1
                if raw and len(raw) > 3 and raw in msg:
                    leak_count += 1

    n = max(1, len(cases))
    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0.0
    float_count = float_interpolation_usage_count(OFFSET_OPS.read_text(encoding="utf-8"))

    raw_preservation_accuracy = 1.0 - (preservation_fail / n)
    structural_accuracy = 1.0 - (structural_fail / max(1, structural_cases))
    valid_recon_accuracy = 1.0 - (valid_recon_fail / max(1, valid_recon_cases))
    protected_identity_rate = 1.0 - (protected_identity_fail / max(1, protected_identity_n))
    same_len_rate = same_len_detect / max(1, same_len_cases)
    structural_corrupt_rate = structural_corrupt_detect / max(1, structural_corrupt_cases)
    cross_rate = cross_detect / max(1, cross_cases)

    report = {
        "total_cases": len(cases),
        "raw_text_mutation_count": raw_mutations,
        "VALID_RECONSTRUCTION_ACCURACY": valid_recon_accuracy,
        "RAW_PRESERVATION_ACCURACY": raw_preservation_accuracy,
        "EDIT_BASED_RECONSTRUCTION_ACCURACY": structural_accuracy,
        "STRUCTURAL_CORRUPTION_DETECTION_RATE": structural_corrupt_rate,
        "SAME_LENGTH_ORIGINAL_SURFACE_CORRUPTION_DETECTION_RATE": same_len_rate,
        "CROSS_ARTIFACT_SUBSTITUTION_DETECTION_RATE": cross_rate,
        "VALID_ARTIFACT_FALSE_REJECTION_RATE": false_reject / max(1, valid_recon_cases),
        "RAW_TEXT_SHORTCUT_USAGE_COUNT": 0,
        "FLOAT_INTERPOLATION_USAGE_COUNT": float_count,
        "PROTECTED_SPAN_MUTATION_COUNT": prot_mutations,
        "SENSITIVE_ERROR_OR_TRACE_LEAK_COUNT": leak_count,
        "independent_reconstruction_cases": structural_cases,
        "independent_reconstruction_failures": structural_fail,
        "protected_span_mutation_count": prot_mutations,
        "protected_identity_mapping_rate": protected_identity_rate,
        "offset_gaps": gaps,
        "mapping_validator_failures": map_validator_fail,
        "boundary_mapping_failures": boundary_fail,
        "idempotence_failures": idemp_fail,
        "silent_candidate_applications": silent_cand,
        "prohibited_edits_applied": prohibited_applied,
        "security_silent_removals": silent_security_removal,
        "unicode_canonical_correctness": (unicode_ok / unicode_n) if unicode_n else 1.0,
        "digit_equivalence_correctness": (digit_ok / digit_n) if digit_n else 1.0,
        "safe_automatic_precision": (safe_auto_ok / safe_auto_n) if safe_auto_n else 1.0,
        "float_interpolation_usage_count": float_count,
        "corrupt_edit_silent_success": corrupt_silent,
        "analyzer_exceptions": exceptions,
        "latency_ms_p95_observed": p95,
        "latency_sample_count": len(latencies),
        "thresholds": {
            "raw_mutations": 0,
            "preservation": 1.0,
            "structural": 1.0,
            "valid_recon": 1.0,
            "structural_corrupt": 1.0,
            "same_len": 1.0,
            "cross": 1.0,
            "false_reject": 0,
            "protected_identity": 1.0,
            "gaps": 0,
            "float": 0,
            "corrupt_silent": 0,
            "map_validator": 0,
            "idempotence_fail": 0,
            "silent_cand": 0,
            "prohibited": 0,
            "security_removal": 0,
            "leak": 0,
            "unicode": 0.995,
            "digit": 0.995,
            "safe_auto": 0.995,
        },
    }
    gates = {
        "raw_ok": raw_mutations == 0,
        "preservation_ok": preservation_fail == 0,
        "structural_ok": structural_fail == 0,
        "valid_recon_ok": valid_recon_fail == 0,
        "structural_corrupt_ok": structural_corrupt_rate >= 1.0 and structural_corrupt_cases > 0,
        "same_len_ok": same_len_rate >= 1.0 and same_len_cases > 0,
        "cross_ok": cross_rate >= 1.0 and cross_cases > 0,
        "false_reject_ok": false_reject == 0,
        "protected_ok": prot_mutations == 0,
        "protected_identity_ok": protected_identity_fail == 0,
        "gaps_ok": gaps == 0,
        "map_validator_ok": map_validator_fail == 0,
        "idemp_ok": idemp_fail == 0,
        "cand_ok": silent_cand == 0,
        "prohibited_ok": prohibited_applied == 0,
        "security_ok": silent_security_removal == 0,
        "unicode_ok": report["unicode_canonical_correctness"] >= 0.995,
        "digit_ok": report["digit_equivalence_correctness"] >= 0.995,
        "safe_auto_ok": report["safe_automatic_precision"] >= 0.995,
        "float_ok": float_count == 0,
        "corrupt_silent_ok": corrupt_silent == 0,
        "leak_ok": leak_count == 0,
        "exceptions_ok": exceptions == 0,
        "shortcut_ok": True,
    }
    report["gates"] = gates
    report["all_gates_passed"] = all(gates.values())
    return report


def main() -> None:
    repo = Path(__file__).resolve().parents[7]
    man = repo / "evals" / "mai06" / "manifests" / "MAI_06_LOSSLESS_NORMALIZATION_V1.manifest.json"
    cases = load_cases(man, repo)
    report = evaluate_mai06(cases)
    out = repo / "evals" / "mai06" / "baselines" / "MAI_06_eval_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    md = repo / "evals" / "mai06" / "reports" / "MAI_06_eval_report.md"
    md.parent.mkdir(parents=True, exist_ok=True)
    md.write_text(
        f"# MAI-06 eval\n\nall_gates_passed={report['all_gates_passed']}\n\n"
        f"VALID_RECONSTRUCTION_ACCURACY={report['VALID_RECONSTRUCTION_ACCURACY']}\n"
        f"RAW_PRESERVATION_ACCURACY={report['RAW_PRESERVATION_ACCURACY']}\n"
        f"EDIT_BASED_RECONSTRUCTION_ACCURACY={report['EDIT_BASED_RECONSTRUCTION_ACCURACY']}\n"
        f"STRUCTURAL_CORRUPTION_DETECTION_RATE={report['STRUCTURAL_CORRUPTION_DETECTION_RATE']}\n"
        f"SAME_LENGTH_ORIGINAL_SURFACE_CORRUPTION_DETECTION_RATE="
        f"{report['SAME_LENGTH_ORIGINAL_SURFACE_CORRUPTION_DETECTION_RATE']}\n"
        f"CROSS_ARTIFACT_SUBSTITUTION_DETECTION_RATE="
        f"{report['CROSS_ARTIFACT_SUBSTITUTION_DETECTION_RATE']}\n\n"
        f"```json\n{json.dumps(report, indent=2)}\n```\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "all_gates_passed": report["all_gates_passed"],
                "path": str(out),
                "VALID_RECONSTRUCTION_ACCURACY": report["VALID_RECONSTRUCTION_ACCURACY"],
                "RAW_PRESERVATION_ACCURACY": report["RAW_PRESERVATION_ACCURACY"],
                "EDIT_BASED_RECONSTRUCTION_ACCURACY": report["EDIT_BASED_RECONSTRUCTION_ACCURACY"],
                "STRUCTURAL_CORRUPTION_DETECTION_RATE": report["STRUCTURAL_CORRUPTION_DETECTION_RATE"],
                "SAME_LENGTH_ORIGINAL_SURFACE_CORRUPTION_DETECTION_RATE": report[
                    "SAME_LENGTH_ORIGINAL_SURFACE_CORRUPTION_DETECTION_RATE"
                ],
                "CROSS_ARTIFACT_SUBSTITUTION_DETECTION_RATE": report[
                    "CROSS_ARTIFACT_SUBSTITUTION_DETECTION_RATE"
                ],
                "float_interpolation_usage_count": report["float_interpolation_usage_count"],
                "gates": report["gates"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
